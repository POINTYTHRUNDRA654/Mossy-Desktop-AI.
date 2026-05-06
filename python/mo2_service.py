"""
Mod Organizer 2 (MO2) Integration Service — port 8018
Detects MO2 installations, manages profiles, toggles mods, and reads/writes
load order files (loadorder.txt, plugins.txt).

MO2 GitHub: https://github.com/ModOrganizer2/modorganizer
Uses pure-Python INI parsing and filesystem access — no MO2 API DLL required.
"""
import os
import re
import shutil
from configparser import ConfigParser, RawConfigParser
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

# ── Known MO2 install locations ───────────────────────────────────────────
DEFAULT_MO2_PATHS: List[str] = [
    r"C:\Program Files\ModOrganizer",
    r"C:\Program Files\Mod Organizer 2",
    r"C:\Modding\MO2",
    r"C:\Modding\Mod Organizer 2",
    r"D:\Modding\MO2",
    r"D:\Modding\Mod Organizer 2",
    r"D:\Games\ModOrganizer",
    r"D:\Games\Mod Organizer 2",
    r"D:\MO2",
    r"C:\Games\ModOrganizer",
    r"C:\Games\Mod Organizer 2",
]

MO2_PATH_FILE = DATA_DIR / "mo2_path.txt"

# ── Helpers ────────────────────────────────────────────────────────────────

def _find_mo2() -> Optional[str]:
    """Return the path to ModOrganizer.exe if found."""
    # 1. Saved path
    if MO2_PATH_FILE.exists():
        saved = MO2_PATH_FILE.read_text(encoding="utf-8").strip()
        exe = Path(saved) / "ModOrganizer.exe"
        if exe.is_file():
            return str(exe.parent)
    # 2. Common locations
    for loc in DEFAULT_MO2_PATHS:
        exe = Path(loc) / "ModOrganizer.exe"
        if exe.is_file():
            return loc
    return None


def _read_ini(path: str) -> Dict[str, Dict[str, str]]:
    """Read an INI file returning section → key → value dict."""
    cfg = RawConfigParser()
    cfg.read(path, encoding="utf-8")
    return {s: dict(cfg[s]) for s in cfg.sections()}


def _get_instance_dir(mo2_dir: str) -> Optional[str]:
    """Read the active instance's data directory from ModOrganizer.ini."""
    ini_path = Path(mo2_dir) / "ModOrganizer.ini"
    if not ini_path.is_file():
        return None
    cfg = RawConfigParser()
    cfg.read(str(ini_path), encoding="utf-8")
    # Instance folder is stored in [Settings] -> base_directory
    try:
        base = cfg["Settings"]["base_directory"].strip()
        base = base.replace("%BASE_DIR%", mo2_dir)
        return base if Path(base).is_dir() else mo2_dir
    except (KeyError, Exception):
        return mo2_dir


def _validate_path(raw: str) -> Optional[str]:
    try:
        p = Path(raw).resolve()
        if p.exists():
            return str(p)
    except Exception:
        pass
    return None


# ── Request Models ─────────────────────────────────────────────────────────

class SetPathRequest(BaseModel):
    path: str

class SwitchProfileRequest(BaseModel):
    mo2_dir: str
    profile: str

class ToggleModRequest(BaseModel):
    mo2_dir: str
    profile: str
    mod_name: str
    enabled: bool

class WriteLoadOrderRequest(BaseModel):
    mo2_dir: str
    profile: str
    load_order: List[str]   # plugin filenames in desired order


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    mo2 = _find_mo2()
    return {"status": "ok", "mo2_found": mo2 is not None, "mo2_dir": mo2}


@app.get("/detect")
def detect():
    """Auto-detect MO2 installation and return metadata."""
    mo2_dir = _find_mo2()
    if not mo2_dir:
        return {"status": "not_found", "checked_paths": DEFAULT_MO2_PATHS}

    instance_dir = _get_instance_dir(mo2_dir) or mo2_dir
    profiles_dir = Path(instance_dir) / "profiles"
    profiles: List[str] = []
    if profiles_dir.is_dir():
        profiles = [p.name for p in sorted(profiles_dir.iterdir()) if p.is_dir()]

    mo2_ini = Path(mo2_dir) / "ModOrganizer.ini"
    current_profile = None
    if mo2_ini.is_file():
        cfg = RawConfigParser()
        cfg.read(str(mo2_ini), encoding="utf-8")
        try:
            current_profile = cfg["Settings"]["selected_profile"].strip('"\'')
        except (KeyError, Exception):
            pass

    return {
        "status": "found",
        "mo2_dir": mo2_dir,
        "instance_dir": instance_dir,
        "profiles": profiles,
        "current_profile": current_profile,
        "profiles_count": len(profiles),
    }


@app.post("/set-path")
def set_path(req: SetPathRequest):
    """Manually save the MO2 installation directory."""
    p = req.path.strip()
    exe = Path(p) / "ModOrganizer.exe"
    if not exe.is_file():
        return {"status": "error", "message": f"ModOrganizer.exe not found in: {p}"}
    MO2_PATH_FILE.write_text(p, encoding="utf-8")
    return {"status": "ok", "message": "MO2 path saved", "path": p}


@app.get("/list-profiles")
def list_profiles(mo2_dir: str = ""):
    """List all profiles in the MO2 instance."""
    mo2 = mo2_dir.strip() or _find_mo2()
    if not mo2:
        return {"status": "error", "message": "MO2 not found"}
    instance = _get_instance_dir(mo2) or mo2
    profiles_dir = Path(instance) / "profiles"
    if not profiles_dir.is_dir():
        return {"status": "error", "message": f"Profiles directory not found: {profiles_dir}"}
    profiles = [p.name for p in sorted(profiles_dir.iterdir()) if p.is_dir()]
    return {"status": "ok", "profiles": profiles, "count": len(profiles)}


@app.get("/get-profile")
def get_profile(mo2_dir: str = ""):
    """Return the currently selected MO2 profile."""
    mo2 = mo2_dir.strip() or _find_mo2()
    if not mo2:
        return {"status": "error", "message": "MO2 not found"}
    ini = Path(mo2) / "ModOrganizer.ini"
    if not ini.is_file():
        return {"status": "error", "message": "ModOrganizer.ini not found"}
    cfg = RawConfigParser()
    cfg.read(str(ini), encoding="utf-8")
    try:
        profile = cfg["Settings"]["selected_profile"].strip('"\'')
        return {"status": "ok", "profile": profile}
    except (KeyError, Exception):
        return {"status": "error", "message": "Could not read selected_profile from ModOrganizer.ini"}


@app.post("/switch-profile")
def switch_profile(req: SwitchProfileRequest):
    """Switch MO2 to a different profile by writing ModOrganizer.ini."""
    mo2 = req.mo2_dir.strip() or _find_mo2()
    if not mo2:
        return {"status": "error", "message": "MO2 not found"}
    instance = _get_instance_dir(mo2) or mo2
    prof_dir = Path(instance) / "profiles" / req.profile
    if not prof_dir.is_dir():
        return {"status": "error", "message": f"Profile '{req.profile}' does not exist"}
    ini = Path(mo2) / "ModOrganizer.ini"
    if not ini.is_file():
        return {"status": "error", "message": "ModOrganizer.ini not found"}
    cfg = RawConfigParser()
    cfg.read(str(ini), encoding="utf-8")
    if "Settings" not in cfg:
        cfg["Settings"] = {}
    cfg["Settings"]["selected_profile"] = f"@ByteArray({req.profile})"
    with open(str(ini), "w", encoding="utf-8") as f:
        cfg.write(f)
    return {"status": "ok", "switched_to": req.profile}


@app.get("/list-mods")
def list_mods(mo2_dir: str = "", profile: str = ""):
    """Return the list of mods from modlist.txt for a profile."""
    mo2 = mo2_dir.strip() or _find_mo2()
    if not mo2:
        return {"status": "error", "message": "MO2 not found"}
    instance = _get_instance_dir(mo2) or mo2

    # Determine profile
    if not profile:
        pf = get_profile(mo2_dir=mo2)
        profile = pf.get("profile") or ""

    modlist_path = Path(instance) / "profiles" / profile / "modlist.txt"
    if not modlist_path.is_file():
        return {"status": "error", "message": f"modlist.txt not found for profile '{profile}'"}

    mods: List[Dict[str, Any]] = []
    for line in modlist_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("+"):
            mods.append({"name": line[1:], "enabled": True})
        elif line.startswith("-"):
            mods.append({"name": line[1:], "enabled": False})

    return {"status": "ok", "profile": profile, "mods": mods, "count": len(mods)}


@app.post("/toggle-mod")
def toggle_mod(req: ToggleModRequest):
    """Enable or disable a mod in modlist.txt."""
    mo2 = req.mo2_dir.strip() or _find_mo2()
    if not mo2:
        return {"status": "error", "message": "MO2 not found"}
    instance = _get_instance_dir(mo2) or mo2
    modlist_path = Path(instance) / "profiles" / req.profile / "modlist.txt"
    if not modlist_path.is_file():
        return {"status": "error", "message": f"modlist.txt not found for profile '{req.profile}'"}

    lines = modlist_path.read_text(encoding="utf-8").splitlines()
    found = False
    new_lines: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            new_lines.append(line)
            continue
        name = stripped[1:]
        if name == req.mod_name:
            prefix = "+" if req.enabled else "-"
            new_lines.append(prefix + name)
            found = True
        else:
            new_lines.append(line)

    if not found:
        return {"status": "error", "message": f"Mod '{req.mod_name}' not found in modlist.txt"}

    modlist_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    return {"status": "ok", "mod": req.mod_name, "enabled": req.enabled}


@app.get("/get-load-order")
def get_load_order(mo2_dir: str = "", profile: str = ""):
    """Return the plugin load order from plugins.txt."""
    mo2 = mo2_dir.strip() or _find_mo2()
    if not mo2:
        return {"status": "error", "message": "MO2 not found"}
    instance = _get_instance_dir(mo2) or mo2
    if not profile:
        pf = get_profile(mo2_dir=mo2)
        profile = pf.get("profile") or ""

    plugins_path = Path(instance) / "profiles" / profile / "plugins.txt"
    loadorder_path = Path(instance) / "profiles" / profile / "loadorder.txt"

    plugins: List[Dict[str, Any]] = []
    if plugins_path.is_file():
        for line in plugins_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("*"):
                plugins.append({"name": line[1:], "enabled": True})
            else:
                plugins.append({"name": line, "enabled": False})

    load_order: List[str] = []
    if loadorder_path.is_file():
        for line in loadorder_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                load_order.append(line)

    return {
        "status": "ok",
        "profile": profile,
        "plugins": plugins,
        "load_order": load_order,
        "plugin_count": len(plugins),
    }


@app.post("/write-load-order")
def write_load_order(req: WriteLoadOrderRequest):
    """Write a new loadorder.txt and plugins.txt for a profile."""
    mo2 = req.mo2_dir.strip() or _find_mo2()
    if not mo2:
        return {"status": "error", "message": "MO2 not found"}
    instance = _get_instance_dir(mo2) or mo2
    prof_dir = Path(instance) / "profiles" / req.profile
    if not prof_dir.is_dir():
        return {"status": "error", "message": f"Profile '{req.profile}' not found"}

    # Backup originals
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    for fname in ("loadorder.txt", "plugins.txt"):
        src = prof_dir / fname
        if src.is_file():
            src.rename(prof_dir / f"{fname}.{ts}.bak")

    # Write loadorder.txt
    (prof_dir / "loadorder.txt").write_text(
        "\n".join(req.load_order) + "\n", encoding="utf-8"
    )
    # Write plugins.txt (all enabled with *)
    (prof_dir / "plugins.txt").write_text(
        "\n".join(f"*{p}" for p in req.load_order) + "\n", encoding="utf-8"
    )
    return {"status": "ok", "written": len(req.load_order), "profile": req.profile}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8018)
