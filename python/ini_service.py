"""
Smart INI Tweaker Service — port 8020
Reads, edits, and validates Fallout 4 / Skyrim INI configuration files.
Ships with a curated database of known settings with descriptions and
safe default values.

Uses `configobj` when available for comment-preserving round-trip editing;
falls back to the stdlib `configparser`.

configobj: https://github.com/DiffSK/configobj
"""
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

DATA_DIR = Path(
    os.environ.get("MOSSY_DATA_ROOT", os.path.join(os.path.expanduser("~"), "Mossy-AI"))
) / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

try:
    from configobj import ConfigObj  # type: ignore
    CONFIGOBJ_AVAILABLE = True
except ImportError:
    CONFIGOBJ_AVAILABLE = False

# ── Known settings database ────────────────────────────────────────────────
# Format: {section: {key: {description, default, preset_low, preset_high}}}
FO4_SETTINGS_DB: Dict[str, Dict[str, Dict[str, Any]]] = {
    "Display": {
        "iSize W": {"desc": "Render width", "default": 1920, "low": 1280, "high": 2560},
        "iSize H": {"desc": "Render height", "default": 1080, "low": 720, "high": 1440},
        "fMouseHeadingSensitivity": {"desc": "Mouse sensitivity multiplier", "default": 0.0125, "low": 0.008, "high": 0.02},
        "bFull Screen": {"desc": "Fullscreen mode (1=full, 0=windowed)", "default": 1, "low": 0, "high": 1},
        "bBorderless": {"desc": "Borderless window (requires bFull Screen=0)", "default": 0, "low": 0, "high": 1},
    },
    "Grass": {
        "iMinGrassSize": {"desc": "Grass density — lower=denser (GPU heavy)", "default": 20, "low": 60, "high": 10},
        "fGrassMaxStartFadeDistance": {"desc": "Grass draw distance", "default": 7000, "low": 3500, "high": 12000},
    },
    "LOD": {
        "fLODFadeOutMultObjects": {"desc": "Object LOD fade distance multiplier", "default": 4.0, "low": 2.0, "high": 8.0},
        "fLODFadeOutMultItems": {"desc": "Item LOD fade distance multiplier", "default": 3.0, "low": 1.5, "high": 6.0},
    },
    "Shadow": {
        "iShadowMapResolution": {"desc": "Shadow map resolution (power of 2)", "default": 2048, "low": 1024, "high": 4096},
        "fShadowDistance": {"desc": "Max shadow draw distance", "default": 3000, "low": 2000, "high": 5000},
    },
    "General": {
        "iNumHWThreads": {"desc": "CPU thread count override (0=auto)", "default": 0, "low": 2, "high": 16},
        "bEnableFileSelection": {"desc": "Allow loading loose files from Data folder", "default": 1, "low": 0, "high": 1},
        "sResourceDataDirsFinal": {"desc": "Comma-separated list of Data sub-folders to load", "default": "TEXTURES, MESHES, MUSIC, SOUND, INTERFACE, PROGRAMS, MATERIALS, LODSETTINGS, VIS, MISC, SCRIPTS, SHADERSFX", "low": None, "high": None},
    },
    "Archive": {
        "sResourceIndexFileList": {"desc": "Ordered list of BA2 archives to load", "default": "", "low": None, "high": None},
        "sResourceStartUpArchiveList": {"desc": "Startup BA2 archives", "default": "", "low": None, "high": None},
    },
    "Papyrus": {
        "fUpdateBudgetMS": {"desc": "Script update budget per frame (ms)", "default": 1.2, "low": 1.5, "high": 0.8},
        "iMaxDesyncTime": {"desc": "Max seconds before script is terminated", "default": 100, "low": 100, "high": 200},
        "bEnableLogging": {"desc": "Enable Papyrus debug logging (impacts FPS)", "default": 0, "low": 0, "high": 1},
    },
    "Water": {
        "iWaterReflectHeight": {"desc": "Water reflection texture height", "default": 512, "low": 256, "high": 1024},
        "iWaterReflectWidth": {"desc": "Water reflection texture width", "default": 512, "low": 256, "high": 1024},
    },
    "Particles": {
        "iMaxDesired": {"desc": "Max simultaneous particles", "default": 750, "low": 500, "high": 1500},
    },
}

# Named performance presets
PRESETS: Dict[str, Dict[str, Dict[str, Any]]] = {
    "Ultra": {
        "Grass": {"iMinGrassSize": 10, "fGrassMaxStartFadeDistance": 14000},
        "LOD": {"fLODFadeOutMultObjects": 8.0, "fLODFadeOutMultItems": 6.0},
        "Shadow": {"iShadowMapResolution": 4096, "fShadowDistance": 5000},
        "Water": {"iWaterReflectHeight": 1024, "iWaterReflectWidth": 1024},
        "Particles": {"iMaxDesired": 1500},
    },
    "High": {
        "Grass": {"iMinGrassSize": 20, "fGrassMaxStartFadeDistance": 10000},
        "LOD": {"fLODFadeOutMultObjects": 6.0, "fLODFadeOutMultItems": 4.0},
        "Shadow": {"iShadowMapResolution": 2048, "fShadowDistance": 4000},
        "Water": {"iWaterReflectHeight": 512, "iWaterReflectWidth": 512},
        "Particles": {"iMaxDesired": 1000},
    },
    "Medium": {
        "Grass": {"iMinGrassSize": 40, "fGrassMaxStartFadeDistance": 7000},
        "LOD": {"fLODFadeOutMultObjects": 4.0, "fLODFadeOutMultItems": 3.0},
        "Shadow": {"iShadowMapResolution": 1024, "fShadowDistance": 3000},
        "Water": {"iWaterReflectHeight": 256, "iWaterReflectWidth": 256},
        "Particles": {"iMaxDesired": 750},
    },
    "Low": {
        "Grass": {"iMinGrassSize": 60, "fGrassMaxStartFadeDistance": 4000},
        "LOD": {"fLODFadeOutMultObjects": 2.0, "fLODFadeOutMultItems": 1.5},
        "Shadow": {"iShadowMapResolution": 512, "fShadowDistance": 2000},
        "Water": {"iWaterReflectHeight": 128, "iWaterReflectWidth": 128},
        "Particles": {"iMaxDesired": 400},
    },
    "Potato": {
        "Grass": {"iMinGrassSize": 80, "fGrassMaxStartFadeDistance": 2000},
        "LOD": {"fLODFadeOutMultObjects": 1.0, "fLODFadeOutMultItems": 1.0},
        "Shadow": {"iShadowMapResolution": 256, "fShadowDistance": 1500},
        "Water": {"iWaterReflectHeight": 64, "iWaterReflectWidth": 64},
        "Particles": {"iMaxDesired": 200},
    },
}

# Default search paths for FO4 INIs
DEFAULT_INI_PATHS = [
    os.path.join(os.path.expanduser("~"), "Documents", "My Games", "Fallout4"),
    os.path.join(os.path.expanduser("~"), "Documents", "My Games", "Skyrim Special Edition"),
    os.path.join(os.path.expanduser("~"), "Documents", "My Games", "Skyrim"),
    os.path.join(os.path.expanduser("~"), "Documents", "My Games", "Fallout New Vegas"),
    os.path.join(os.path.expanduser("~"), "Documents", "My Games", "Oblivion"),
]


def _validate_path(raw: str) -> Optional[str]:
    try:
        p = Path(raw).resolve()
        if p.is_file():
            return str(p)
    except Exception:
        pass
    return None


def _read_ini_raw(path: str) -> Dict[str, Dict[str, str]]:
    from configparser import RawConfigParser
    cfg = RawConfigParser()
    cfg.read(path, encoding="utf-8")
    return {s: dict(cfg[s]) for s in cfg.sections()}


def _write_ini_raw(path: str, data: Dict[str, Dict[str, str]]) -> None:
    from configparser import RawConfigParser
    cfg = RawConfigParser()
    for section, keys in data.items():
        cfg[section] = keys
    with open(path, "w", encoding="utf-8") as f:
        cfg.write(f)


# ── Request Models ──────────────────────────────────────────────────────────

class ReadIniRequest(BaseModel):
    path: str

class WriteIniRequest(BaseModel):
    path: str
    values: Dict[str, Dict[str, str]]  # section -> key -> value

class ApplyPresetRequest(BaseModel):
    path: str
    preset: str

class BackupRequest(BaseModel):
    path: str


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "configobj_available": CONFIGOBJ_AVAILABLE}


@app.get("/known-settings")
def known_settings():
    """Return the database of known FO4/Skyrim settings with descriptions."""
    return {"status": "ok", "settings": FO4_SETTINGS_DB}


@app.get("/presets")
def list_presets():
    """Return available performance presets."""
    return {"status": "ok", "presets": list(PRESETS.keys()), "details": PRESETS}


@app.get("/detect-ini-files")
def detect_ini_files():
    """Scan default game INI locations."""
    found: List[Dict[str, str]] = []
    for folder in DEFAULT_INI_PATHS:
        if Path(folder).is_dir():
            for f in Path(folder).iterdir():
                if f.suffix.lower() == ".ini":
                    found.append({"path": str(f), "name": f.name, "folder": folder})
    return {"status": "ok", "ini_files": found, "count": len(found)}


@app.post("/read")
def read_ini(req: ReadIniRequest):
    """Read an INI file and return its contents as a nested dict."""
    safe = _validate_path(req.path)
    if safe is None:
        return {"status": "error", "message": "INI file not found or invalid path"}

    if CONFIGOBJ_AVAILABLE:
        try:
            cfg = ConfigObj(safe, encoding="utf-8")  # type: ignore
            data = {s: dict(cfg[s]) for s in cfg.sections}
            return {"status": "ok", "path": safe, "data": data, "library": "configobj"}
        except Exception:
            pass  # fall through

    try:
        data = _read_ini_raw(safe)
        return {"status": "ok", "path": safe, "data": data, "library": "configparser"}
    except Exception:
        return {"status": "error", "message": "Failed to read INI file"}


@app.post("/write")
def write_ini(req: WriteIniRequest):
    """Write values into an INI file (creates backup first)."""
    safe = _validate_path(req.path)
    if safe is None:
        return {"status": "error", "message": "INI file not found or invalid path"}

    # Backup
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = safe + f".{ts}.bak"
    shutil.copy2(safe, backup_path)

    if CONFIGOBJ_AVAILABLE:
        try:
            cfg = ConfigObj(safe, encoding="utf-8")  # type: ignore
            for section, keys in req.values.items():
                if section not in cfg:
                    cfg[section] = {}
                for key, val in keys.items():
                    cfg[section][key] = val
            cfg.write()
            return {"status": "ok", "backup": backup_path, "written": sum(len(v) for v in req.values.values())}
        except Exception:
            pass

    try:
        current = _read_ini_raw(safe)
        for section, keys in req.values.items():
            if section not in current:
                current[section] = {}
            current[section].update(keys)
        _write_ini_raw(safe, current)
        return {"status": "ok", "backup": backup_path, "written": sum(len(v) for v in req.values.values())}
    except Exception:
        return {"status": "error", "message": "Failed to write INI file"}


@app.post("/apply-preset")
def apply_preset(req: ApplyPresetRequest):
    """Apply a named performance preset to an INI file."""
    safe = _validate_path(req.path)
    if safe is None:
        return {"status": "error", "message": "INI file not found or invalid path"}

    if req.preset not in PRESETS:
        return {"status": "error", "message": f"Unknown preset '{req.preset}'. Available: {list(PRESETS.keys())}"}

    preset_data = PRESETS[req.preset]
    write_req = WriteIniRequest(
        path=safe,
        values={section: {k: str(v) for k, v in keys.items()} for section, keys in preset_data.items()},
    )
    return write_ini(write_req)


@app.post("/backup")
def backup_ini(req: BackupRequest):
    """Create a timestamped backup of an INI file."""
    safe = _validate_path(req.path)
    if safe is None:
        return {"status": "error", "message": "INI file not found or invalid path"}
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = safe + f".{ts}.bak"
    shutil.copy2(safe, backup_path)
    return {"status": "ok", "backup": backup_path, "original": safe}


@app.post("/validate")
def validate_ini(req: ReadIniRequest):
    """Compare an INI file against the known-settings database and report issues."""
    safe = _validate_path(req.path)
    if safe is None:
        return {"status": "error", "message": "INI file not found or invalid path"}

    data_resp = read_ini(ReadIniRequest(path=safe))
    if data_resp.get("status") != "ok":
        return data_resp
    data: Dict[str, Dict[str, str]] = data_resp.get("data", {})

    warnings: List[Dict[str, str]] = []
    # Check for common misconfigurations
    papyrus = data.get("Papyrus", {})
    if papyrus.get("bEnableLogging", "0") == "1":
        warnings.append({"section": "Papyrus", "key": "bEnableLogging", "msg": "Papyrus logging is ON — disable in production for better FPS"})
    if papyrus.get("bEnableTrace", "0") == "1":
        warnings.append({"section": "Papyrus", "key": "bEnableTrace", "msg": "Papyrus trace logging is ON — disable to reduce log spam"})

    general = data.get("General", {})
    if general.get("bEnableFileSelection", "0") == "0":
        warnings.append({"section": "General", "key": "bEnableFileSelection", "msg": "Loose file loading is disabled — mods with loose textures/meshes won't load"})

    shadow = data.get("Shadow", {})
    res = shadow.get("iShadowMapResolution", "2048")
    try:
        if int(res) > 4096:
            warnings.append({"section": "Shadow", "key": "iShadowMapResolution", "msg": f"Shadow resolution {res} is very high — may cause GPU stutter"})
    except ValueError:
        pass

    return {"status": "ok", "path": safe, "warnings": warnings, "warning_count": len(warnings)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8020)
