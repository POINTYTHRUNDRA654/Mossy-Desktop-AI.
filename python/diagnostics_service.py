"""
Mod Diagnostics Service — port 8022
Parses Fallout 4 / Skyrim crash logs, F4SE / SKSE logs, MO2 logs, and the
Papyrus script log.  Extracts structured error information and returns it
ready for AI-powered diagnosis.

No external dependencies — pure Python parsing with regex.
"""
import os
import re
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

# ── Default log locations ──────────────────────────────────────────────────
DOCUMENTS = os.path.expanduser("~\\Documents") if os.name == "nt" else os.path.expanduser("~/Documents")
MY_GAMES_FO4 = os.path.join(DOCUMENTS, "My Games", "Fallout4")
MY_GAMES_SSE = os.path.join(DOCUMENTS, "My Games", "Skyrim Special Edition")

DEFAULT_CRASH_LOG_DIRS = [
    MY_GAMES_FO4,
    MY_GAMES_SSE,
    os.path.join(os.path.expanduser("~"), "Documents", "My Games", "Fallout4", "F4SE"),
    os.path.join(os.path.expanduser("~"), "Documents", "My Games", "Skyrim Special Edition", "SKSE"),
]

DEFAULT_F4SE_LOG_PATHS = [
    os.path.join(MY_GAMES_FO4, "F4SE", "f4se.log"),
    os.path.join(MY_GAMES_SSE, "SKSE", "skse.log"),
]

DEFAULT_PAPYRUS_LOG_PATHS = [
    os.path.join(MY_GAMES_FO4, "Logs", "Script", "Papyrus.0.log"),
    os.path.join(MY_GAMES_SSE, "Logs", "Script", "Papyrus.0.log"),
]

# ── Patterns ───────────────────────────────────────────────────────────────
# Crash log patterns (F4SE Crash Logger, Buffout 4, .NET Script Framework)
CRASH_ADDRESS_RE   = re.compile(r'Unhandled exception.*?(?:0x[0-9A-Fa-f]+)', re.IGNORECASE)
CRASH_MODULE_RE    = re.compile(r'\[\s*[0-9]+\s*\]\s+([A-Za-z0-9_\-. ]+\.(?:dll|exe))', re.IGNORECASE)
CRASH_FORM_ID_RE   = re.compile(r'Form\s+ID\s*[:=]\s*(0x[0-9A-Fa-f]{8})', re.IGNORECASE)
CRASH_STACK_RE     = re.compile(r'^\s*(0x[0-9A-Fa-f]+)\s+(.+)$', re.MULTILINE)

# F4SE / SKSE log patterns
PLUGIN_LOAD_FAIL_RE = re.compile(r"(?:couldn't load plugin|plugin .+? failed|error loading .+?\.dll)", re.IGNORECASE)
VERSION_MISMATCH_RE = re.compile(r"version mismatch|expected version|compiled for version", re.IGNORECASE)
SKSE_ERROR_RE       = re.compile(r"ERROR\s*[:\-]?\s*(.+)", re.IGNORECASE)

# Papyrus log patterns
PAPYRUS_ERROR_RE   = re.compile(r"error\s*:\s*(.+)", re.IGNORECASE)
PAPYRUS_WARN_RE    = re.compile(r"warning\s*:\s*(.+)", re.IGNORECASE)
PAPYRUS_STACK_RE   = re.compile(r"stack\s*:\s*(.+)", re.IGNORECASE)
PAPYRUS_VMDIE_RE   = re.compile(r"virtual machine is.*?dying", re.IGNORECASE)
PAPYRUS_TIMEOUT_RE = re.compile(r"failed to find.+?function|unloaded while", re.IGNORECASE)

# MO2 log patterns
MO2_ERROR_RE       = re.compile(r"\[error\]\s*(.+)", re.IGNORECASE)
MO2_CONFLICT_RE    = re.compile(r"conflict between\s+(.+?)\s+and\s+(.+)", re.IGNORECASE)
MO2_LOCKED_RE      = re.compile(r"access denied|locked by another", re.IGNORECASE)

# ── Helpers ────────────────────────────────────────────────────────────────

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


def _read_log_tail(path: str, max_lines: int = 2000) -> List[str]:
    """Read the last N lines of a log file."""
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    return [l.rstrip() for l in lines[-max_lines:]]


def _classify_crash(lines: List[str]) -> str:
    """Return a brief human-readable classification of the crash cause."""
    text = "\n".join(lines)
    if re.search(r"ninode|bshavok|bhkworld|havok", text, re.IGNORECASE):
        return "Physics / Havok engine crash — often caused by high-poly meshes or broken physics objects"
    if re.search(r"papyrus|papyrus virtual machine", text, re.IGNORECASE):
        return "Papyrus script crash — script stack overflow or runaway script"
    if re.search(r"settlement|workshop", text, re.IGNORECASE):
        return "Workshop / settlement crash — exceeding object budget or broken precombines"
    if re.search(r"precombine|previs", text, re.IGNORECASE):
        return "Broken precombines/previs — a mod disabled precombines without rebuilding them"
    if re.search(r"texture|imageSpace|bsstream", text, re.IGNORECASE):
        return "Texture streaming crash — missing texture, invalid DDS format, or VRAM overflow"
    if re.search(r"actor|npc_|biped", text, re.IGNORECASE):
        return "NPC / actor crash — broken NPC record or missing race/body part template"
    if re.search(r"uGridsToLoad|uExteriorCellBuffer", text, re.IGNORECASE):
        return "Cell loading crash — uGridsToLoad set too high or cell limit exceeded"
    if re.search(r"stack overflow", text, re.IGNORECASE):
        return "Stack overflow — infinite script loop or recursive function call"
    return "Unknown crash type — review the full stack trace for more detail"


# ── Request Models ─────────────────────────────────────────────────────────

class ParseCrashRequest(BaseModel):
    log_path: str

class ParseLogRequest(BaseModel):
    log_path: str

class ScanDirRequest(BaseModel):
    directory: str
    max_results: int = 20

class DetectGamesRequest(BaseModel):
    pass


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/detect-game-folders")
def detect_game_folders():
    """Detect Fallout 4 and Skyrim SE installation folders."""
    common_roots = [
        r"C:\Program Files (x86)\Steam\steamapps\common",
        r"C:\Program Files\Steam\steamapps\common",
        r"D:\SteamLibrary\steamapps\common",
        r"D:\Games\steamapps\common",
        r"E:\SteamLibrary\steamapps\common",
        r"F:\SteamLibrary\steamapps\common",
    ]
    game_dirs = {
        "Fallout 4": "Fallout 4",
        "Skyrim SE": "Skyrim Special Edition",
        "Skyrim": "Skyrim",
        "Fallout NV": "Fallout New Vegas",
    }
    found: List[Dict[str, str]] = []
    for root in common_roots:
        for label, subfolder in game_dirs.items():
            full = os.path.join(root, subfolder)
            if Path(full).is_dir():
                found.append({"game": label, "path": full})

    log_dirs: List[str] = []
    for d in DEFAULT_CRASH_LOG_DIRS:
        if Path(d).is_dir():
            log_dirs.append(d)

    return {"status": "ok", "game_folders": found, "log_directories": log_dirs}


@app.post("/scan-crash-logs")
def scan_crash_logs(req: ScanDirRequest):
    """Find recent crash log files in a directory."""
    safe_dir = _validate_dir_path(req.directory)
    if safe_dir is None:
        return {"status": "error", "message": "Directory not found or invalid path"}

    crash_files: List[Dict[str, Any]] = []
    patterns = ["crash-*.log", "*.log", "*.txt"]
    for root, _dirs, files in os.walk(safe_dir):
        for fname in sorted(files, reverse=True):
            fpath = os.path.join(root, fname)
            if fname.lower().endswith((".log", ".txt")) and any(
                kw in fname.lower() for kw in ("crash", "exception", "error", "papyrus", "f4se", "skse")
            ):
                crash_files.append({
                    "name": fname,
                    "path": fpath,
                    "size": os.path.getsize(fpath),
                    "modified": datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat(),
                })
                if len(crash_files) >= req.max_results:
                    break
        if len(crash_files) >= req.max_results:
            break

    crash_files.sort(key=lambda x: x.get("modified", ""), reverse=True)
    return {"status": "ok", "crash_logs": crash_files, "count": len(crash_files)}


@app.post("/parse-crash-log")
def parse_crash_log(req: ParseCrashRequest):
    """Parse a crash log file and return structured crash data."""
    safe = _validate_path(req.log_path)
    if safe is None:
        return {"status": "error", "message": "Crash log file not found or invalid path"}

    lines = _read_log_tail(safe)
    text = "\n".join(lines)

    # Extract crash address
    crash_addresses: List[str] = re.findall(r'0x[0-9A-Fa-f]{6,}', text)[:10]

    # Extract DLLs / modules mentioned
    modules: List[str] = []
    for m in CRASH_MODULE_RE.finditer(text):
        mod = m.group(1).strip()
        if mod not in modules:
            modules.append(mod)

    # Extract form IDs
    form_ids: List[str] = list(dict.fromkeys(CRASH_FORM_ID_RE.findall(text)))

    # Extract stack frames
    stack_frames: List[str] = [m.group(0).strip() for m in CRASH_STACK_RE.finditer(text)][:30]

    # Look for specific error messages
    error_lines: List[str] = []
    for line in lines:
        if any(kw in line.lower() for kw in ("error", "exception", "crash", "fatal", "assert")):
            error_lines.append(line.strip())

    classification = _classify_crash(lines)
    first_lines = "\n".join(lines[:20])
    last_lines = "\n".join(lines[-30:])

    return {
        "status": "ok",
        "log_path": safe,
        "log_name": Path(safe).name,
        "classification": classification,
        "crash_addresses": crash_addresses,
        "modules_mentioned": modules[:20],
        "form_ids": form_ids[:20],
        "stack_frames": stack_frames,
        "error_lines": error_lines[:20],
        "log_header": first_lines,
        "log_tail": last_lines,
        "total_lines": len(lines),
        "ai_prompt": (
            f"Crash classification: {classification}\n"
            f"Crash addresses: {', '.join(crash_addresses[:5]) if crash_addresses else 'none found'}\n"
            f"Modules: {', '.join(modules[:5]) if modules else 'none found'}\n"
            f"Form IDs: {', '.join(form_ids[:5]) if form_ids else 'none found'}\n"
            f"Log tail:\n{last_lines}\n"
            "Please explain the likely cause of this Fallout 4 / Skyrim crash and suggest fixes."
        ),
    }


@app.post("/parse-f4se-log")
def parse_f4se_log(req: ParseLogRequest):
    """Parse an F4SE or SKSE log file for errors and version mismatches."""
    safe = _validate_path(req.log_path)
    if safe is None:
        return {"status": "error", "message": "Log file not found or invalid path"}

    lines = _read_log_tail(safe)
    errors: List[str] = []
    version_issues: List[str] = []
    failed_plugins: List[str] = []

    for line in lines:
        if PLUGIN_LOAD_FAIL_RE.search(line):
            failed_plugins.append(line.strip())
        elif VERSION_MISMATCH_RE.search(line):
            version_issues.append(line.strip())
        elif SKSE_ERROR_RE.search(line):
            errors.append(line.strip())

    return {
        "status": "ok",
        "log_path": safe,
        "errors": errors[:50],
        "version_issues": version_issues[:20],
        "failed_plugins": failed_plugins[:20],
        "total_lines": len(lines),
        "has_issues": bool(errors or version_issues or failed_plugins),
    }


@app.post("/scan-papyrus-log")
def scan_papyrus_log(req: ParseLogRequest):
    """Parse Papyrus.0.log for script errors, stack dumps, and VM dying."""
    safe = _validate_path(req.log_path)
    if safe is None:
        return {"status": "error", "message": "Log file not found or invalid path"}

    lines = _read_log_tail(safe)
    errors: List[str] = []
    warnings: List[str] = []
    stack_dumps: List[str] = []
    vm_dying = False
    timeout_kills: List[str] = []

    for line in lines:
        if PAPYRUS_VMDIE_RE.search(line):
            vm_dying = True
        if m := PAPYRUS_ERROR_RE.search(line):
            errors.append(m.group(1).strip())
        if m := PAPYRUS_WARN_RE.search(line):
            warnings.append(m.group(1).strip())
        if PAPYRUS_STACK_RE.search(line):
            stack_dumps.append(line.strip())
        if PAPYRUS_TIMEOUT_RE.search(line):
            timeout_kills.append(line.strip())

    # Deduplicate and truncate
    errors = list(dict.fromkeys(errors))[:50]
    warnings = list(dict.fromkeys(warnings))[:50]
    stack_dumps = stack_dumps[:20]
    timeout_kills = list(dict.fromkeys(timeout_kills))[:20]

    # Count log volume (proxy for script load)
    suspicious_scripts: Dict[str, int] = {}
    script_re = re.compile(r'\b([A-Za-z0-9_]+Script)\b')
    for line in lines:
        for script in script_re.findall(line):
            suspicious_scripts[script] = suspicious_scripts.get(script, 0) + 1
    top_scripts = sorted(suspicious_scripts.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "status": "ok",
        "log_path": safe,
        "total_lines": len(lines),
        "vm_dying": vm_dying,
        "errors": errors,
        "warnings": warnings,
        "stack_dumps_count": len(stack_dumps),
        "stack_dumps_sample": stack_dumps,
        "timeout_kills": timeout_kills,
        "top_active_scripts": [{"script": s, "mentions": c} for s, c in top_scripts],
        "health": "critical" if vm_dying else ("warning" if errors else "ok"),
    }


@app.post("/parse-mo2-log")
def parse_mo2_log(req: ParseLogRequest):
    """Parse a Mod Organizer 2 log file for errors and conflicts."""
    safe = _validate_path(req.log_path)
    if safe is None:
        return {"status": "error", "message": "Log file not found or invalid path"}

    lines = _read_log_tail(safe)
    errors: List[str] = []
    conflicts: List[Dict[str, str]] = []
    access_issues: List[str] = []

    for line in lines:
        if m := MO2_ERROR_RE.search(line):
            errors.append(m.group(1).strip())
        if m := MO2_CONFLICT_RE.search(line):
            conflicts.append({"mod_a": m.group(1).strip(), "mod_b": m.group(2).strip()})
        if MO2_LOCKED_RE.search(line):
            access_issues.append(line.strip())

    return {
        "status": "ok",
        "log_path": safe,
        "errors": errors[:50],
        "conflicts": conflicts[:50],
        "access_issues": access_issues[:20],
        "total_lines": len(lines),
        "has_issues": bool(errors or conflicts or access_issues),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8022)
