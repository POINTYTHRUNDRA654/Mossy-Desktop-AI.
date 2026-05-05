"""
FO4Edit / xEdit Integration Service — port 8012
Conflict detection and record inspection for Fallout 4 plugin files.

GitHub: https://github.com/TES5Edit/TES5Edit (FO4Edit is a variant of xEdit)

FO4Edit.exe is an external tool; this service launches it via subprocess for
conflict detection and also provides a pure-Python plugin header parser.
"""
import os
import struct
import subprocess
import shutil
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

DATA_DIR = Path(
    os.environ.get("MOSSY_DATA_ROOT", os.path.join(os.path.expanduser("~"), "Mossy-AI"))
) / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

FO4EDIT_PATH_FILE = DATA_DIR / "fo4edit_path.txt"

DEFAULT_FO4EDIT_PATHS = [
    r"C:\Program Files (x86)\Steam\steamapps\common\Fallout 4\Tools\FO4Edit\FO4Edit.exe",
    r"C:\Tools\FO4Edit\FO4Edit.exe",
    r"D:\Tools\FO4Edit\FO4Edit.exe",
    r"C:\FO4Edit\FO4Edit.exe",
    r"D:\FO4Edit\FO4Edit.exe",
    r"C:\xEdit\FO4Edit.exe",
    r"D:\xEdit\FO4Edit.exe",
]

SUPPORTED_GAMES = ["fo4", "sse", "fo3", "fnv", "le", "enderal", "starfield"]


def _find_fo4edit() -> Optional[str]:
    if FO4EDIT_PATH_FILE.exists():
        saved = FO4EDIT_PATH_FILE.read_text().strip()
        if os.path.exists(saved):
            return saved
    for p in DEFAULT_FO4EDIT_PATHS:
        if os.path.exists(p):
            return p
    found = shutil.which("FO4Edit") or shutil.which("FO4Edit.exe")
    return found


def _parse_esp_header(plugin_path: str) -> dict:
    """Parse TES4 record from .esp/.esm file to extract masters and record count."""
    masters = []
    record_count = 0
    form_ids_sample = []

    try:
        with open(plugin_path, "rb") as f:
            magic = f.read(4)
            if magic != b"TES4":
                return {"error": f"Not a valid plugin file (magic={magic!r})"}

            size = struct.unpack("<I", f.read(4))[0]
            flags = struct.unpack("<I", f.read(4))[0]
            form_id = struct.unpack("<I", f.read(4))[0]
            f.read(4)  # version control
            f.read(4)  # version / unknown

            # Read subrecords within TES4
            bytes_read = 0
            while bytes_read < size:
                sub_type = f.read(4)
                if len(sub_type) < 4:
                    break
                sub_size = struct.unpack("<H", f.read(2))[0]
                sub_data = f.read(sub_size)
                bytes_read += 6 + sub_size

                if sub_type == b"HEDR":
                    if len(sub_data) >= 8:
                        record_count = struct.unpack("<I", sub_data[4:8])[0]
                elif sub_type == b"MAST":
                    master_name = sub_data.rstrip(b"\x00").decode("utf-8", errors="replace")
                    masters.append(master_name)
                elif sub_type == b"CNAM":
                    pass  # author field

            form_ids_sample.append(f"0x{form_id:08X}")

    except Exception as e:
        return {"error": str(e)}

    return {
        "masters": masters,
        "record_count": record_count,
        "form_ids_sample": form_ids_sample,
    }


def _mock_conflict_result(plugins_dir: str, plugin_names: List[str]) -> dict:
    """Return a simulated conflict result when FO4Edit is unavailable."""
    plugins = plugin_names or ["Fallout4.esm", "DLCRobot.esm", "CustomMod.esp"]
    conflicts = [
        {
            "plugin": plugins[-1] if plugins else "CustomMod.esp",
            "record_type": "WEAP",
            "form_id": "0x001A2B3C",
            "conflict_type": "conflict",
            "masters": [plugins[0]] if plugins else ["Fallout4.esm"],
        },
        {
            "plugin": plugins[-1] if plugins else "CustomMod.esp",
            "record_type": "NPC_",
            "form_id": "0x000D3F9A",
            "conflict_type": "override",
            "masters": [plugins[0]] if plugins else ["Fallout4.esm"],
        },
        {
            "plugin": plugins[0] if plugins else "Fallout4.esm",
            "record_type": "CELL",
            "form_id": "0x0000803E",
            "conflict_type": "identical",
            "masters": [],
        },
    ]
    return {
        "status": "mock",
        "conflicts": conflicts,
        "warnings": [
            "FO4Edit not found — showing simulated results.",
            "Install FO4Edit and set its path to run real conflict detection.",
        ],
        "error_count": 1,
    }


# ── Request Models ────────────────────────────────────────────────────────

class SetPathRequest(BaseModel):
    path: str


class CheckConflictsRequest(BaseModel):
    plugins_dir: str
    plugin_names: Optional[List[str]] = None


class GetRecordsRequest(BaseModel):
    plugin_path: str
    record_types: Optional[List[str]] = None


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    xedit_path = _find_fo4edit()
    return {
        "status": "ok",
        "service": "fo4edit",
        "fo4edit_found": xedit_path is not None,
        "xedit_path": xedit_path,
    }


@app.post("/set-path")
def set_path(req: SetPathRequest):
    path = req.path.strip()
    if not os.path.exists(path):
        return {"status": "error", "message": f"File not found: {path}"}
    FO4EDIT_PATH_FILE.write_text(path)
    return {"status": "ok", "message": "Path saved", "path": path}


@app.post("/check-conflicts")
def check_conflicts(req: CheckConflictsRequest):
    xedit_path = _find_fo4edit()
    plugin_names = req.plugin_names or []

    if not xedit_path:
        return _mock_conflict_result(req.plugins_dir, plugin_names)

    # Build plugin list arg — FO4Edit accepts plugin names as args
    cmd = [
        xedit_path,
        "-fo4",
        "-nobuildrefs",
        "-IKnowWhatImDoing",
        "-Autoexit",
        "-autoload",
    ] + plugin_names

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
            cwd=req.plugins_dir if os.path.isdir(req.plugins_dir) else None,
        )
        output = result.stdout + result.stderr
        conflicts = []
        warnings = []
        error_count = 0

        for line in output.splitlines():
            if "conflict" in line.lower():
                error_count += 1
                conflicts.append({
                    "plugin": "unknown",
                    "record_type": "UNKN",
                    "form_id": "0x00000000",
                    "conflict_type": "conflict",
                    "masters": [],
                    "raw": line.strip(),
                })
            elif "warning" in line.lower():
                warnings.append(line.strip())

        return {
            "status": "ok",
            "conflicts": conflicts,
            "warnings": warnings,
            "error_count": error_count,
            "raw_output": output[:4096],
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "FO4Edit timed out after 300s"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/get-records")
def get_records(req: GetRecordsRequest):
    plugin_path = req.plugin_path
    if not os.path.exists(plugin_path):
        return {"status": "error", "message": f"Plugin not found: {plugin_path}"}

    plugin_name = os.path.basename(plugin_path)
    parsed = _parse_esp_header(plugin_path)

    if "error" in parsed:
        return {"status": "error", "message": parsed["error"]}

    return {
        "status": "ok",
        "plugin_name": plugin_name,
        "masters": parsed["masters"],
        "record_count": parsed["record_count"],
        "form_ids_sample": parsed["form_ids_sample"],
    }


@app.get("/supported-games")
def supported_games():
    return {"status": "ok", "games": SUPPORTED_GAMES}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8012)
