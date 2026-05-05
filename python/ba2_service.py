"""
BA2 / BSA Archive Handler Service — port 8013
Inspect, extract, and create Bethesda archive files (.ba2 for Fallout 4, .bsa for Skyrim/FO3/FNV).
Also supports extracting .7z archives (most Nexus mod downloads) via py7zr.

BA2 format reference: https://en.uesp.net/wiki/Fallout4:BA2
BSA format reference: https://en.uesp.net/wiki/Skyrim:BSA

Archive2.exe (Creation Kit) is used when available.  Native fallbacks via
`construct` binary DSL (BA2/BSA struct parsing) and `py7zr` (7-Zip) ensure
all operations work without external executables.
"""
import os
import struct
import shutil
import subprocess
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI
from pydantic import BaseModel

# construct — declarative binary struct parser for BA2/BSA formats
try:
    from construct import (  # type: ignore
        Struct, Const, Bytes, Int32ul, Int16ul, Int64ul,
        Int8ul, GreedyBytes, Computed, this, len_, Array,
    )
    CONSTRUCT_AVAILABLE = True
except ImportError:
    CONSTRUCT_AVAILABLE = False

# py7zr — native Python 7-Zip library (no 7z.exe required)
try:
    import py7zr  # type: ignore
    PY7ZR_AVAILABLE = True
except ImportError:
    PY7ZR_AVAILABLE = False

# imageio — DDS read for texture inspection
try:
    import imageio  # type: ignore
    IMAGEIO_AVAILABLE = True
except ImportError:
    IMAGEIO_AVAILABLE = False

try:
    from bethesda_structs.archive import BA2Archive  # type: ignore
    BETHESDA_STRUCTS = True
except ImportError:
    BETHESDA_STRUCTS = False

app = FastAPI()

DATA_DIR = Path(
    os.environ.get("MOSSY_DATA_ROOT", os.path.join(os.path.expanduser("~"), "Mossy-AI"))
) / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

ARCHIVE2_PATH_FILE = DATA_DIR / "archive2_path.txt"

DEFAULT_ARCHIVE2_PATHS = [
    r"C:\Program Files (x86)\Steam\steamapps\common\Fallout 4\Tools\Archive2\Archive2.exe",
    r"D:\SteamLibrary\steamapps\common\Fallout 4\Tools\Archive2\Archive2.exe",
    r"C:\Program Files (x86)\Bethesda Softworks\Fallout 4\Tools\Archive2\Archive2.exe",
    r"C:\Program Files\Bethesda.net Launcher\games\Fallout4\Tools\Archive2\Archive2.exe",
]

# BA2 header constants
BA2_MAGIC = b"BTDX"
BSA_MAGIC = b"BSA\x00"
BSA_VERSION_FO3_FNV = 0x67
BSA_VERSION_SKYRIM_LE = 0x68
BSA_VERSION_SKYRIM_SE = 0x69

# ── construct BA2 General (GNRL) file-entry struct ────────────────────────
# Each entry is 36 bytes: nameHash(4) ext(4) dirHash(4) flags(4)
#   offset(8) packedSize(4) unpackedSize(4) sentinel(4)
_BA2_GNRL_ENTRY = Struct(
    "name_hash"    / Int32ul,
    "ext"          / Bytes(4),
    "dir_hash"     / Int32ul,
    "flags"        / Int32ul,
    "offset"       / Int64ul,
    "packed_size"  / Int32ul,
    "unpacked_size"/ Int32ul,
    "sentinel"     / Int32ul,
)

# BA2 DX10 (texture) chunk descriptor — 24 bytes per entry
_BA2_DX10_ENTRY = Struct(
    "name_hash"   / Int32ul,
    "ext"         / Bytes(4),
    "dir_hash"    / Int32ul,
    "unknown_08"  / Int8ul,
    "num_chunks"  / Int8ul,
    "chunk_hdr_sz"/ Int16ul,
    "height"      / Int16ul,
    "width"       / Int16ul,
    "num_mips"    / Int8ul,
    "dxgi_format" / Int8ul,
    "cube_maps"   / Int16ul,
)


def _find_archive2() -> Optional[str]:
    if ARCHIVE2_PATH_FILE.exists():
        saved = ARCHIVE2_PATH_FILE.read_text().strip()
        if os.path.exists(saved):
            return saved
    for p in DEFAULT_ARCHIVE2_PATHS:
        if os.path.exists(p):
            return p
    return shutil.which("Archive2") or shutil.which("Archive2.exe")


def _parse_ba2(path: str) -> dict:
    """Parse a BA2 archive header using construct when available, raw struct otherwise."""
    files = []
    try:
        with open(path, "rb") as f:
            magic = f.read(4)
            if magic != BA2_MAGIC:
                return {"error": f"Not a BA2 file (magic={magic!r})"}

            version = struct.unpack("<I", f.read(4))[0]
            type_bytes = f.read(4)
            archive_type_raw = type_bytes.rstrip(b"\x00").decode("ascii", errors="replace")
            file_count = struct.unpack("<I", f.read(4))[0]
            names_offset = struct.unpack("<Q", f.read(8))[0]

            archive_type = {"GNRL": "general", "DX10": "textures"}.get(archive_type_raw, "sound")

            if CONSTRUCT_AVAILABLE and archive_type_raw == "GNRL":
                entry_size = 36
                for i in range(min(file_count, 10000)):
                    raw = f.read(entry_size)
                    if len(raw) < entry_size:
                        break
                    e = _BA2_GNRL_ENTRY.parse(raw)
                    compressed = e.packed_size != 0 and e.packed_size != e.unpacked_size
                    ext_str = e.ext.rstrip(b"\x00").decode("ascii", errors="replace")
                    files.append({
                        "name": f"file_{i:05d}.{ext_str}",
                        "size": e.unpacked_size,
                        "packed_size": e.packed_size,
                        "compressed": compressed,
                        "ext": ext_str,
                    })
            elif CONSTRUCT_AVAILABLE and archive_type_raw == "DX10":
                entry_size = 24
                for i in range(min(file_count, 10000)):
                    raw = f.read(entry_size)
                    if len(raw) < entry_size:
                        break
                    e = _BA2_DX10_ENTRY.parse(raw)
                    # Skip chunk headers (8 bytes each)
                    f.seek(e.num_chunks * 24, 1)
                    files.append({
                        "name": f"texture_{i:05d}.dds",
                        "size": 0,
                        "packed_size": 0,
                        "compressed": False,
                        "ext": "dds",
                        "width": e.width,
                        "height": e.height,
                        "num_mips": e.num_mips,
                        "dxgi_format": e.dxgi_format,
                    })
            else:
                # Fallback: raw struct (same logic as before)
                for i in range(min(file_count, 10000)):
                    try:
                        if archive_type_raw == "GNRL":
                            entry = f.read(36)
                            if len(entry) < 36:
                                break
                            packed_size = struct.unpack("<I", entry[20:24])[0]
                            unpacked_size = struct.unpack("<I", entry[24:28])[0]
                            compressed = packed_size != 0 and packed_size != unpacked_size
                            files.append({"name": f"file_{i:05d}", "size": unpacked_size, "compressed": compressed})
                        else:
                            entry = f.read(24)
                            if len(entry) < 24:
                                break
                            files.append({"name": f"texture_{i:05d}.dds", "size": 0, "compressed": False})
                    except struct.error:
                        break

            # Read file names from name table
            try:
                f.seek(names_offset)
                for i in range(len(files)):
                    raw = f.read(2)
                    if len(raw) < 2:
                        break
                    name_len = struct.unpack("<H", raw)[0]
                    name = f.read(name_len).decode("utf-8", errors="replace")
                    if i < len(files):
                        files[i]["name"] = name
            except Exception:
                pass

        total_size = os.path.getsize(path)
        return {
            "format": "ba2",
            "version": version,
            "archive_type": archive_type,
            "file_count": file_count,
            "files": files,
            "total_size_bytes": total_size,
            "construct_used": CONSTRUCT_AVAILABLE,
        }
    except Exception as e:
        return {"error": str(e)}


def _parse_bsa(path: str) -> dict:
    """Parse a BSA archive header (Skyrim/FO3/FNV)."""
    try:
        with open(path, "rb") as f:
            magic = f.read(4)
            if magic != BSA_MAGIC:
                return {"error": f"Not a BSA file (magic={magic!r})"}

            version = struct.unpack("<I", f.read(4))[0]
            if version == BSA_VERSION_FO3_FNV:
                game_ver = "Fallout 3 / FNV"
            elif version == BSA_VERSION_SKYRIM_LE:
                game_ver = "Skyrim LE"
            elif version == BSA_VERSION_SKYRIM_SE:
                game_ver = "Skyrim SE"
            else:
                game_ver = f"unknown ({version:#x})"

            folder_offset = struct.unpack("<I", f.read(4))[0]
            archive_flags = struct.unpack("<I", f.read(4))[0]
            folder_count = struct.unpack("<I", f.read(4))[0]
            file_count = struct.unpack("<I", f.read(4))[0]

        total_size = os.path.getsize(path)
        return {
            "format": "bsa",
            "version": version,
            "game_version": game_ver,
            "archive_type": "general",
            "file_count": file_count,
            "folder_count": folder_count,
            "files": [],
            "total_size_bytes": total_size,
        }
    except Exception as e:
        return {"error": str(e)}


# ── Request Models ─────────────────────────────────────────────────────────

class InspectRequest(BaseModel):
    archive_path: str


class ExtractRequest(BaseModel):
    archive_path: str
    output_dir: str
    files: Optional[List[str]] = None


class Extract7zRequest(BaseModel):
    archive_path: str
    output_dir: str
    files: Optional[List[str]] = None


class CreateRequest(BaseModel):
    input_dir: str
    output_path: str
    archive_type: str = "general"
    compress: bool = True


class SetArchive2PathRequest(BaseModel):
    path: str


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ba2",
        "supported_formats": ["ba2", "bsa", "7z"],
        "archive2_found": _find_archive2() is not None,
        "bethesda_structs": BETHESDA_STRUCTS,
        "construct_available": CONSTRUCT_AVAILABLE,
        "py7zr_available": PY7ZR_AVAILABLE,
        "imageio_available": IMAGEIO_AVAILABLE,
    }


@app.post("/inspect")
def inspect(req: InspectRequest):
    path = req.archive_path
    if not os.path.exists(path):
        return {"status": "error", "message": f"File not found: {path}"}

    with open(path, "rb") as f:
        magic = f.read(4)

    if magic == BA2_MAGIC:
        result = _parse_ba2(path)
    elif magic == BSA_MAGIC:
        result = _parse_bsa(path)
    else:
        # Try 7z inspection
        if PY7ZR_AVAILABLE and path.lower().endswith(".7z"):
            try:
                with py7zr.SevenZipFile(path, mode="r") as z:
                    names = z.getnames()
                return {
                    "status": "ok",
                    "format": "7z",
                    "file_count": len(names),
                    "files": [{"name": n, "size": 0, "compressed": True} for n in names[:500]],
                    "total_size_bytes": os.path.getsize(path),
                }
            except Exception as e:
                return {"status": "error", "message": f"7z inspect error: {e}"}
        return {"status": "error", "message": f"Unknown archive format (magic={magic!r})"}

    if "error" in result:
        return {"status": "error", "message": result["error"]}

    return {"status": "ok", **result}


@app.post("/extract")
def extract(req: ExtractRequest):
    archive_path = req.archive_path
    output_dir = req.output_dir

    if not os.path.exists(archive_path):
        return {"status": "error", "message": f"Archive not found: {archive_path}"}

    os.makedirs(output_dir, exist_ok=True)
    errors = []

    archive2 = _find_archive2()
    if archive2:
        cmd = [archive2, archive_path, "-extract=" + output_dir]
        if req.files:
            for fn in req.files[:50]:
                cmd.extend(["-files=" + fn])
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if result.returncode != 0:
                errors.append(result.stderr.strip())
            extracted = sum(1 for _ in Path(output_dir).rglob("*") if _.is_file())
            return {
                "status": "ok" if not errors else "partial",
                "extracted_count": extracted,
                "output_dir": output_dir,
                "errors": errors,
            }
        except subprocess.TimeoutExpired:
            return {"status": "error", "message": "Archive2.exe timed out"}
        except Exception as e:
            errors.append(str(e))

    if BETHESDA_STRUCTS:
        try:
            arc = BA2Archive.parse_file(archive_path)
            count = 0
            for file_entry in arc.files:
                if req.files and file_entry.filename not in req.files:
                    continue
                out_path = Path(output_dir) / file_entry.filename
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_bytes(file_entry.read())
                count += 1
            return {
                "status": "ok",
                "extracted_count": count,
                "output_dir": output_dir,
                "errors": [],
            }
        except Exception as e:
            errors.append(f"bethesda_structs error: {e}")

    return {
        "status": "unavailable",
        "extracted_count": 0,
        "output_dir": output_dir,
        "errors": errors or ["Archive2.exe not found and bethesda_structs not installed. Install Creation Kit or run: pip install bethesda-structs"],
    }


@app.post("/extract-7z")
def extract_7z(req: Extract7zRequest):
    """Extract a .7z archive using py7zr (no external tools required)."""
    if not PY7ZR_AVAILABLE:
        return {
            "status": "unavailable",
            "message": "py7zr is not installed. Run: pip install py7zr",
            "extracted_count": 0,
        }

    if not os.path.exists(req.archive_path):
        return {"status": "error", "message": f"Archive not found: {req.archive_path}"}

    os.makedirs(req.output_dir, exist_ok=True)

    try:
        with py7zr.SevenZipFile(req.archive_path, mode="r") as z:
            if req.files:
                z.extract(path=req.output_dir, targets=req.files)
            else:
                z.extractall(path=req.output_dir)
        extracted = sum(1 for _ in Path(req.output_dir).rglob("*") if _.is_file())
        return {
            "status": "ok",
            "extracted_count": extracted,
            "output_dir": req.output_dir,
            "errors": [],
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/create")
def create(req: CreateRequest):
    archive2 = _find_archive2()
    if not archive2:
        return {
            "status": "unavailable",
            "message": "Archive2.exe not found. Install the Fallout 4 Creation Kit from Bethesda.net or Steam.",
            "output_path": req.output_path,
            "file_count": 0,
        }

    if not os.path.isdir(req.input_dir):
        return {"status": "error", "message": f"Input directory not found: {req.input_dir}"}

    archive_flag = "1" if req.archive_type == "textures" else "0"
    compress_flag = "1" if req.compress else "0"

    cmd = [
        archive2,
        req.input_dir,
        f"-create={req.output_path}",
        f"-format={archive_flag}",
        f"-compression={compress_flag}",
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        file_count = sum(1 for _ in Path(req.input_dir).rglob("*") if _.is_file())
        return {
            "status": "ok" if result.returncode == 0 else "error",
            "output_path": req.output_path,
            "file_count": file_count,
            "stdout": result.stdout[:2048],
            "stderr": result.stderr[:2048],
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Archive2.exe timed out"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/archive2-path")
def get_archive2_path():
    path = _find_archive2()
    return {
        "status": "ok",
        "found": path is not None,
        "path": path,
        "checked_paths": DEFAULT_ARCHIVE2_PATHS,
    }


@app.post("/set-archive2-path")
def set_archive2_path(req: SetArchive2PathRequest):
    p = req.path.strip()
    if not os.path.exists(p):
        return {"status": "error", "message": f"File not found: {p}"}
    ARCHIVE2_PATH_FILE.write_text(p)
    return {"status": "ok", "message": "Archive2.exe path saved", "path": p}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8013)
