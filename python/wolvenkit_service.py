"""
WolvenKit Automation Service — port 8010
Automates Cyberpunk 2077 and Witcher 3 modding via WolvenKit CLI.

GitHub: https://github.com/WolvenKit/WolvenKit
WolvenKit CLI wraps Red Engine archive operations: extract, pack, convert, export, import.

Install WolvenKit CLI:
    Download from https://github.com/WolvenKit/WolvenKit/releases
    Extract to a directory and note the path to WolvenKit.CLI.exe (Windows).

This service calls the WolvenKit CLI via subprocess and returns structured results.
"""
import os
import subprocess
import json
import shutil
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI()

# ── Default WolvenKit CLI paths ───────────────────────────────────────────
DEFAULT_CLI_PATHS = [
    r"C:\Program Files\WolvenKit\WolvenKit.CLI.exe",
    r"C:\WolvenKit\WolvenKit.CLI.exe",
    r"D:\WolvenKit\WolvenKit.CLI.exe",
    r"D:\Tools\WolvenKit\WolvenKit.CLI.exe",
]

WOLVENKIT_PATH_FILE = Path(
    os.environ.get("MOSSY_DATA_ROOT", os.path.join(os.path.expanduser("~"), "Mossy-AI"))
) / "wolvenkit_path.txt"


def _find_cli() -> Optional[str]:
    """Find WolvenKit CLI on the system."""
    # Check saved path first
    if WOLVENKIT_PATH_FILE.exists():
        saved = WOLVENKIT_PATH_FILE.read_text().strip()
        if os.path.exists(saved):
            return saved

    # Check default locations
    for p in DEFAULT_CLI_PATHS:
        if os.path.exists(p):
            return p

    # Try PATH
    found = shutil.which("WolvenKit.CLI") or shutil.which("wolvenkit-cli")
    return found


def _run_cli(args: List[str], cwd: Optional[str] = None, timeout: int = 120) -> dict:
    """Run WolvenKit CLI and return structured output."""
    cli = _find_cli()
    if not cli:
        return {
            "status": "error",
            "message": "WolvenKit CLI not found. Download from https://github.com/WolvenKit/WolvenKit/releases and set the path.",
            "cli_path": None,
        }

    try:
        result = subprocess.run(
            [cli] + args,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
        return {
            "status": "ok" if result.returncode == 0 else "error",
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "cli_path": cli,
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": f"CLI timed out after {timeout}s"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    cli = _find_cli()
    return {
        "status": "healthy",
        "service": "wolvenkit-automation",
        "cli_found": cli is not None,
        "cli_path": cli,
        "github": "https://github.com/WolvenKit/WolvenKit",
    }


class SetCliPathRequest(BaseModel):
    path: str


@app.post("/set-cli-path")
async def set_cli_path(req: SetCliPathRequest):
    """Save the WolvenKit CLI path for future use."""
    if not os.path.exists(req.path):
        return {"status": "error", "message": f"File not found: {req.path}"}
    WOLVENKIT_PATH_FILE.parent.mkdir(parents=True, exist_ok=True)
    WOLVENKIT_PATH_FILE.write_text(req.path)
    return {"status": "ok", "saved_path": req.path}


class ExtractRequest(BaseModel):
    archive_path: str          # path to .archive file
    output_dir: str            # where to extract
    pattern: Optional[str] = None  # file pattern filter


@app.post("/extract")
async def extract_archive(req: ExtractRequest):
    """Extract a .archive file using WolvenKit CLI."""
    args = ["extract", "--path", req.archive_path, "--outpath", req.output_dir]
    if req.pattern:
        args += ["--pattern", req.pattern]
    result = _run_cli(args)

    # Count extracted files if successful
    if result["status"] == "ok":
        try:
            out_path = Path(req.output_dir)
            count = sum(1 for _ in out_path.rglob("*") if _.is_file())
            result["files_extracted"] = count
        except Exception:
            result["files_extracted"] = -1

    return result


class PackRequest(BaseModel):
    input_dir: str             # directory containing mod files
    output_path: str           # output .archive path
    game: Optional[str] = "Cyberpunk2077"


@app.post("/pack")
async def pack_archive(req: PackRequest):
    """Pack a mod directory into a .archive file using WolvenKit CLI."""
    args = ["pack", "--path", req.input_dir, "--outpath", req.output_path]
    return _run_cli(args)


class ConvertRequest(BaseModel):
    input_path: str            # source file path
    output_dir: str            # output directory
    format: Optional[str] = "json"   # target format: json, glb, png, wav …


@app.post("/convert")
async def convert_file(req: ConvertRequest):
    """Convert a Red Engine file to/from another format."""
    args = [
        "convert", "--path", req.input_path,
        "--outpath", req.output_dir,
        "--format", req.format or "json",
    ]
    return _run_cli(args)


class SearchRequest(BaseModel):
    archive_dir: str           # directory containing .archive files
    pattern: str               # search pattern (e.g. *.mesh, *.xbm)


@app.post("/search")
async def search_archives(req: SearchRequest):
    """Search for files across multiple .archive files."""
    args = ["search", "--path", req.archive_dir, "--pattern", req.pattern]
    result = _run_cli(args)

    # Parse matched files from output
    if result["status"] == "ok" and result.get("stdout"):
        matches = [line.strip() for line in result["stdout"].split("\n") if line.strip()]
        result["matches"] = matches
        result["match_count"] = len(matches)

    return result


class ExportRequest(BaseModel):
    input_path: str            # .mesh, .xbm, .ent etc.
    output_dir: str
    export_format: Optional[str] = "GLB"  # GLB, OBJ, PNG, WAV …


@app.post("/export")
async def export_asset(req: ExportRequest):
    """Export a game asset to an open format (GLB, PNG, WAV, etc.)."""
    args = [
        "export", "--path", req.input_path,
        "--outpath", req.output_dir,
        "--format", req.export_format or "GLB",
    ]
    return _run_cli(args)


@app.get("/supported-games")
async def supported_games():
    return {
        "games": [
            {"id": "Cyberpunk2077", "name": "Cyberpunk 2077", "engine": "REDengine 4"},
            {"id": "Witcher3",      "name": "The Witcher 3",   "engine": "REDengine 3"},
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8010)
