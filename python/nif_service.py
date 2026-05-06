"""
NIF Mesh Inspector Service — port 8019
Reads Bethesda NIF (NetImmerse/Gamebryo/Creation Engine) mesh files and
returns block trees, geometry statistics, texture path references, and
OBJ export for Blender import.

Uses `niffile` (modern, fast) with `pyffi` as a fallback, and falls back to
pure-Python struct parsing when neither is installed.

NIF format reference: https://github.com/niftools/nifxml
niffile: https://github.com/niftools/niffile
pyffi:   https://github.com/niftools/pyffi
"""
import os
import struct
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

DATA_DIR = Path(
    os.environ.get("MOSSY_DATA_ROOT", os.path.join(os.path.expanduser("~"), "Mossy-AI"))
) / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Optional imports ───────────────────────────────────────────────────────
try:
    import niffile  # type: ignore
    NIFFILE_AVAILABLE = True
except ImportError:
    NIFFILE_AVAILABLE = False

try:
    from pyffi.formats.nif import NifFormat  # type: ignore
    PYFFI_AVAILABLE = True
except ImportError:
    PYFFI_AVAILABLE = False

# ── Pure-Python NIF header reader (works without any library) ──────────────
_NIF_MAGIC = b"Gamebryo File Format, Version"
_NIF_MAGIC2 = b"NetImmerse File Format, Version"

def _parse_nif_header_raw(path: str) -> Dict[str, Any]:
    """Read the NIF file header without any library dependency."""
    try:
        with open(path, "rb") as f:
            header_bytes = f.read(256)
        magic = header_bytes[:30]
        if not (magic.startswith(_NIF_MAGIC) or magic.startswith(_NIF_MAGIC2)):
            return {"error": "Not a valid NIF file"}

        # Try to read version string (null-terminated after magic)
        nl = header_bytes.find(b"\n")
        version_str = header_bytes[:nl].decode("ascii", errors="replace").strip() if nl > 0 else "unknown"

        # Block count is a 32-bit LE integer at a known offset after the header
        # Exact offset varies by version; approximate from end of header string
        offset = nl + 1
        block_count = 0
        if len(header_bytes) >= offset + 4:
            block_count = struct.unpack_from("<I", header_bytes, offset)[0]
            if block_count > 100000:  # sanity
                block_count = 0

        return {
            "version_string": version_str,
            "block_count_approx": block_count,
            "file_size": os.path.getsize(path),
        }
    except Exception:
        return {"error": "Failed to parse NIF header"}


def _validate_path(raw: str) -> Optional[str]:
    try:
        p = Path(raw).resolve()
        if p.is_file():
            return str(p)
    except Exception:
        pass
    return None


def _validate_dir_path(raw: str) -> Optional[str]:
    try:
        p = Path(raw).resolve()
        if p.is_dir():
            return str(p)
    except Exception:
        pass
    return None


# ── Request Models ─────────────────────────────────────────────────────────

class InspectRequest(BaseModel):
    nif_path: str

class FindNifsRequest(BaseModel):
    directory: str
    max_files: int = 500

class ExportObjRequest(BaseModel):
    nif_path: str
    output_dir: str


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "niffile_available": NIFFILE_AVAILABLE,
        "pyffi_available": PYFFI_AVAILABLE,
    }


@app.post("/inspect")
def inspect(req: InspectRequest):
    """Full NIF inspection: block tree, geometry stats, texture paths."""
    safe = _validate_path(req.nif_path)
    if safe is None:
        return {"status": "error", "message": "NIF file not found or invalid path"}

    file_name = Path(safe).name
    file_size = os.path.getsize(safe)

    # ── niffile (fastest, most modern) ────────────────────────────────────
    if NIFFILE_AVAILABLE:
        try:
            nif = niffile.NifFile(safe)  # type: ignore
            blocks: List[Dict[str, Any]] = []
            textures: List[str] = []
            vertex_total = 0
            triangle_total = 0
            for i, block in enumerate(nif.blocks):
                btype = type(block).__name__
                entry: Dict[str, Any] = {"index": i, "type": btype, "name": getattr(block, "name", "")}
                blocks.append(entry)
                # Geometry stats
                if hasattr(block, "vertex_count"):
                    vc = block.vertex_count
                    vertex_total += vc if isinstance(vc, int) else 0
                if hasattr(block, "triangle_count"):
                    tc = block.triangle_count
                    triangle_total += tc if isinstance(tc, int) else 0
                # Texture path extraction
                if "Texture" in btype and hasattr(block, "file_name"):
                    tex = getattr(block, "file_name", "")
                    if tex and tex not in textures:
                        textures.append(str(tex))
            return {
                "status": "ok",
                "file": file_name,
                "file_size": file_size,
                "block_count": len(blocks),
                "blocks": blocks[:200],
                "textures": textures,
                "vertex_total": vertex_total,
                "triangle_total": triangle_total,
                "library": "niffile",
            }
        except Exception:
            pass  # fall through to pyffi

    # ── pyffi fallback ─────────────────────────────────────────────────────
    if PYFFI_AVAILABLE:
        try:
            stream = open(safe, "rb")
            data = NifFormat.Data()  # type: ignore
            data.read(stream)
            stream.close()
            blocks: List[Dict[str, Any]] = []
            textures: List[str] = []
            vertex_total = 0
            triangle_total = 0
            for i, block in enumerate(data.blocks):
                btype = block.__class__.__name__
                blocks.append({"index": i, "type": btype, "name": getattr(block, "name", b"").decode("utf-8", errors="replace")})
                if hasattr(block, "num_vertices"):
                    vertex_total += int(block.num_vertices)
                if hasattr(block, "num_triangles"):
                    triangle_total += int(block.num_triangles)
                if "Texture" in btype and hasattr(block, "file_name"):
                    tex = block.file_name.decode("utf-8", errors="replace")
                    if tex and tex not in textures:
                        textures.append(tex)
            return {
                "status": "ok",
                "file": file_name,
                "file_size": file_size,
                "block_count": len(blocks),
                "blocks": blocks[:200],
                "textures": textures,
                "vertex_total": vertex_total,
                "triangle_total": triangle_total,
                "library": "pyffi",
            }
        except Exception:
            pass  # fall through to raw parser

    # ── Raw header fallback ────────────────────────────────────────────────
    hdr = _parse_nif_header_raw(safe)
    if "error" in hdr:
        return {"status": "error", "message": hdr["error"]}
    return {
        "status": "ok",
        "file": file_name,
        "file_size": file_size,
        "library": "raw",
        "note": "Install niffile or pyffi for full block tree and texture extraction",
        **hdr,
    }


@app.post("/list-textures")
def list_textures(req: InspectRequest):
    """Return only the texture path references from a NIF (fast scan)."""
    result = inspect(req)
    if result.get("status") != "ok":
        return result
    return {
        "status": "ok",
        "file": result.get("file"),
        "textures": result.get("textures", []),
        "count": len(result.get("textures", [])),
    }


@app.post("/get-geometry-stats")
def get_geometry_stats(req: InspectRequest):
    """Return vertex count, triangle count, and LOD info for a NIF."""
    result = inspect(req)
    if result.get("status") != "ok":
        return result
    lod_blocks = [b for b in result.get("blocks", []) if "LOD" in b.get("type", "")]
    return {
        "status": "ok",
        "file": result.get("file"),
        "vertex_total": result.get("vertex_total", 0),
        "triangle_total": result.get("triangle_total", 0),
        "lod_nodes": len(lod_blocks),
        "block_count": result.get("block_count", 0),
    }


@app.post("/find-nifs")
def find_nifs(req: FindNifsRequest):
    """Recursively scan a directory for NIF files."""
    safe_dir = _validate_dir_path(req.directory)
    if safe_dir is None:
        return {"status": "error", "message": "Directory not found or invalid path"}

    nif_files: List[Dict[str, Any]] = []
    for root, _dirs, files in os.walk(safe_dir):
        for fname in files:
            if fname.lower().endswith(".nif"):
                full_path = os.path.join(root, fname)
                nif_files.append({
                    "path": full_path,
                    "name": fname,
                    "size": os.path.getsize(full_path),
                    "relative": os.path.relpath(full_path, safe_dir),
                })
                if len(nif_files) >= req.max_files:
                    break
        if len(nif_files) >= req.max_files:
            break

    return {
        "status": "ok",
        "directory": safe_dir,
        "nif_files": nif_files,
        "count": len(nif_files),
        "truncated": len(nif_files) >= req.max_files,
    }


@app.post("/export-obj")
def export_obj(req: ExportObjRequest):
    """Export NIF geometry to OBJ using pyffi (for Blender import)."""
    safe = _validate_path(req.nif_path)
    if safe is None:
        return {"status": "error", "message": "NIF file not found or invalid path"}

    os.makedirs(req.output_dir, exist_ok=True)
    out_path = Path(req.output_dir) / (Path(safe).stem + ".obj")

    if not PYFFI_AVAILABLE:
        return {
            "status": "unavailable",
            "message": "pyffi is required for OBJ export. Run: pip install pyffi",
        }

    try:
        stream = open(safe, "rb")
        data = NifFormat.Data()  # type: ignore
        data.read(stream)
        stream.close()

        verts: List[str] = ["# Exported by Mossy NIF Service"]
        faces: List[str] = []
        vertex_offset = 1

        for block in data.blocks:
            if hasattr(block, "vertices") and hasattr(block, "triangles"):
                vv = block.vertices
                tt = block.triangles
                if vv:
                    for v in vv:
                        verts.append(f"v {v.x:.6f} {v.y:.6f} {v.z:.6f}")
                    for tri in tt:
                        a, b, c = tri.v_1 + vertex_offset, tri.v_2 + vertex_offset, tri.v_3 + vertex_offset
                        faces.append(f"f {a} {b} {c}")
                    vertex_offset += len(vv)

        out_path.write_text("\n".join(verts + faces), encoding="utf-8")
        return {
            "status": "ok",
            "output_path": str(out_path),
            "vertex_count": vertex_offset - 1,
            "face_count": len(faces),
        }
    except Exception:
        return {"status": "error", "message": "Failed to export NIF to OBJ"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8019)
