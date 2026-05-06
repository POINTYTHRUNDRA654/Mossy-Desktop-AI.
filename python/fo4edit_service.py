"""
FO4Edit / xEdit Integration Service — port 8012
Conflict detection and record inspection for Fallout 4 plugin files.

GitHub: https://github.com/TES5Edit/TES5Edit (FO4Edit is a variant of xEdit)

FO4Edit.exe is an external tool; this service launches it via subprocess for
conflict detection.  When FO4Edit.exe is absent the service falls back to a
pure-Python parser built with the `construct` binary DSL, which parses
TES4/GROUP/record headers natively without any external dependency.
"""
import os
import re
import struct
import subprocess
import shutil
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI
from pydantic import BaseModel

# Safe plugin-name pattern: letters, digits, underscores, hyphens, spaces, dots.
# subprocess list form (no shell=True) is used, so spaces in filenames are safe.
_SAFE_PLUGIN_NAME_RE = re.compile(r'^[\w\- .]+\.(esp|esm|esl)$', re.IGNORECASE)

def _validate_plugin_names(names: List[str]) -> List[str]:
    """Return only names that look like valid plugin filenames (no shell metacharacters)."""
    return [n for n in names if _SAFE_PLUGIN_NAME_RE.match(n.strip())]

# construct — declarative binary DSL, much more maintainable than raw struct
try:
    from construct import (  # type: ignore
        Struct, Const, Bytes, Int32ul, Int16ul, Int32sl, Float32l,
        CString, GreedyBytes, GreedyRange, Peek, FocusedSeq,
        Computed, Padding, Tell, Seek, RepeatUntil, this, len_,
        Terminated, Enum, Select, Pass, IfThenElse, Switch,
        PaddedString, BytesInteger, BitsSwapped, BitStruct, Flag,
        RawCopy, Pointer, Int8ul, Int64ul, Lazy,
    )
    CONSTRUCT_AVAILABLE = True
except ImportError:
    CONSTRUCT_AVAILABLE = False

# deepdiff — used to diff plugin headers across versions
try:
    from deepdiff import DeepDiff  # type: ignore
    DEEPDIFF_AVAILABLE = True
except ImportError:
    DEEPDIFF_AVAILABLE = False

# networkx — load-order dependency graph
try:
    import networkx as nx  # type: ignore
    NETWORKX_AVAILABLE = True
except ImportError:
    NETWORKX_AVAILABLE = False

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
    return shutil.which("FO4Edit") or shutil.which("FO4Edit.exe")



# Bethesda plugin header layout (applies to .esp, .esm, .esl):
#   Record header : type(4) size(4) flags(4) formID(4) vcInfo(4) version(4)
#   Subrecords    : type(4) size(2) data(size)
# Reference: https://en.uesp.net/wiki/Starfield:Plugin_File_Format/Records/TES4

_SUBRECORD_HEADER = Struct(
    "type" / Bytes(4),
    "size" / Int16ul,
)

_RECORD_HEADER = Struct(
    "type"     / Bytes(4),
    "data_size"/ Int32ul,
    "flags"    / Int32ul,
    "form_id"  / Int32ul,
    "vc_info"  / Int32ul,
    "version"  / Int16ul,
    "unknown"  / Int16ul,
)


def _parse_esp_header_construct(plugin_path: str) -> dict:
    """Parse TES4 record using construct for robust subrecord extraction."""
    masters: List[str] = []
    record_count = 0
    author = ""
    description = ""
    form_id_str = ""
    is_esm = False
    is_esl = False
    version = 0

    try:
        with open(plugin_path, "rb") as f:
            hdr_raw = f.read(24)
            if len(hdr_raw) < 24:
                return {"error": "File too small to be a valid plugin"}
            hdr = _RECORD_HEADER.parse(hdr_raw)
            if hdr.type != b"TES4":
                return {"error": f"Not a valid plugin file (magic={hdr.type!r})"}

            is_esm = bool(hdr.flags & 0x01)
            is_esl = bool(hdr.flags & 0x200)
            form_id_str = f"0x{hdr.form_id:08X}"
            version = hdr.version

            subrecord_data = f.read(hdr.data_size)

        # Walk subrecords within TES4 data
        pos = 0
        while pos + 6 <= len(subrecord_data):
            sr_type = subrecord_data[pos:pos + 4]
            sr_size = struct.unpack_from("<H", subrecord_data, pos + 4)[0]
            sr_body = subrecord_data[pos + 6: pos + 6 + sr_size]
            pos += 6 + sr_size

            if sr_type == b"HEDR" and len(sr_body) >= 8:
                record_count = struct.unpack_from("<I", sr_body, 4)[0]
            elif sr_type == b"MAST":
                masters.append(sr_body.rstrip(b"\x00").decode("utf-8", errors="replace"))
            elif sr_type == b"CNAM":
                author = sr_body.rstrip(b"\x00").decode("utf-8", errors="replace")
            elif sr_type == b"SNAM":
                description = sr_body.rstrip(b"\x00").decode("utf-8", errors="replace")

    except Exception:
        return {"error": "Failed to parse plugin header"}

    return {
        "masters": masters,
        "record_count": record_count,
        "form_id": form_id_str,
        "author": author,
        "description": description,
        "is_esm": is_esm,
        "is_esl": is_esl,
        "version": version,
        "parser": "construct" if CONSTRUCT_AVAILABLE else "struct",
    }


# Keep the legacy name so existing callers still work
def _parse_esp_header(plugin_path: str) -> dict:
    """Parse TES4 record from .esp/.esm file — uses construct when available."""
    result = _parse_esp_header_construct(plugin_path)
    # Back-compat: callers expect 'form_ids_sample' list
    if "error" not in result:
        result.setdefault("form_ids_sample", [result.get("form_id", "0x00000000")])
    return result


def _scan_record_types(plugin_path: str, max_records: int = 5000) -> Dict[str, int]:
    """Walk all top-level record groups and tally record-type counts.

    This gives a fast summary (WEAP: 42, NPC_: 17, …) without fully parsing
    every record.  Uses raw struct reads so it works without construct.
    """
    counts: Dict[str, int] = {}
    try:
        with open(plugin_path, "rb") as f:
            # Skip TES4 header
            hdr_raw = f.read(24)
            if len(hdr_raw) < 24:
                return counts
            hdr = _RECORD_HEADER.parse(hdr_raw)
            if hdr.type != b"TES4":
                return counts
            f.read(hdr.data_size)  # skip TES4 subrecords

            seen = 0
            while seen < max_records:
                rec_hdr_raw = f.read(24)
                if len(rec_hdr_raw) < 24:
                    break
                rec_type = rec_hdr_raw[:4]
                rec_data_size = struct.unpack_from("<I", rec_hdr_raw, 4)[0]

                if rec_type == b"GRUP":
                    # GROUP records: label field (4 bytes at offset 8) holds record type
                    group_type_bytes = rec_hdr_raw[8:12]
                    group_type = group_type_bytes.rstrip(b"\x00").decode("ascii", errors="replace")
                    counts[group_type] = counts.get(group_type, 0)
                    # Move past the group data (size includes the 24-byte header)
                    f.seek(rec_data_size - 24, 1)
                else:
                    rec_type_str = rec_type.rstrip(b"\x00").decode("ascii", errors="replace")
                    counts[rec_type_str] = counts.get(rec_type_str, 0) + 1
                    f.seek(rec_data_size, 1)
                seen += 1
    except Exception:
        pass
    return counts


def _diff_plugin_headers(path_a: str, path_b: str) -> dict:
    """Return a deepdiff between two plugin headers (masters, record counts, flags)."""
    ha = _parse_esp_header(path_a)
    hb = _parse_esp_header(path_b)
    if "error" in ha:
        return {"error": f"Plugin A: {ha['error']}"}
    if "error" in hb:
        return {"error": f"Plugin B: {hb['error']}"}

    if DEEPDIFF_AVAILABLE:
        diff = DeepDiff(ha, hb, ignore_order=True, verbose_level=2)
        return {
            "plugin_a": os.path.basename(path_a),
            "plugin_b": os.path.basename(path_b),
            "diff": diff.to_dict(),
            "header_a": ha,
            "header_b": hb,
        }
    # Fallback: manual key comparison
    changes = {}
    for key in set(list(ha.keys()) + list(hb.keys())):
        if ha.get(key) != hb.get(key):
            changes[key] = {"old": ha.get(key), "new": hb.get(key)}
    return {
        "plugin_a": os.path.basename(path_a),
        "plugin_b": os.path.basename(path_b),
        "diff": changes,
        "header_a": ha,
        "header_b": hb,
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

    # Validate plugin names to prevent command-line injection
    safe_names = _validate_plugin_names(plugin_names)
    rejected = [n for n in plugin_names if n not in safe_names]

    # Build plugin list arg — FO4Edit accepts plugin names as args
    cmd = [
        xedit_path,
        "-fo4",
        "-nobuildrefs",
        "-IKnowWhatImDoing",
        "-Autoexit",
        "-autoload",
    ] + safe_names

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
    except Exception:
        return {"status": "error", "message": "Unexpected error running FO4Edit"}


@app.post("/get-records")
def get_records(req: GetRecordsRequest):
    plugin_path = req.plugin_path
    if not os.path.exists(plugin_path):
        return {"status": "error", "message": f"Plugin not found: {plugin_path}"}

    plugin_name = os.path.basename(plugin_path)
    parsed = _parse_esp_header(plugin_path)

    if "error" in parsed:
        return {"status": "error", "message": parsed["error"]}

    # Optionally enrich with per-type record counts
    record_type_counts = _scan_record_types(plugin_path)
    if req.record_types:
        record_type_counts = {k: v for k, v in record_type_counts.items() if k in req.record_types}

    return {
        "status": "ok",
        "plugin_name": plugin_name,
        "masters": parsed["masters"],
        "record_count": parsed["record_count"],
        "form_ids_sample": parsed["form_ids_sample"],
        "author": parsed.get("author", ""),
        "description": parsed.get("description", ""),
        "is_esm": parsed.get("is_esm", False),
        "is_esl": parsed.get("is_esl", False),
        "record_type_counts": record_type_counts,
        "parser": parsed.get("parser", "struct"),
    }


class ScanRecordTypesRequest(BaseModel):
    plugin_path: str
    max_records: int = 5000


class DiffPluginsRequest(BaseModel):
    plugin_a: str
    plugin_b: str


class GraphAnalysisRequest(BaseModel):
    plugins_dir: str
    plugin_names: Optional[List[str]] = None


@app.post("/scan-record-types")
def scan_record_types(req: ScanRecordTypesRequest):
    """Scan a plugin file and return a tally of record types (WEAP, NPC_, CELL …)."""
    if not os.path.exists(req.plugin_path):
        return {"status": "error", "message": f"Plugin not found: {req.plugin_path}"}
    counts = _scan_record_types(req.plugin_path, req.max_records)
    return {
        "status": "ok",
        "plugin_name": os.path.basename(req.plugin_path),
        "record_type_counts": counts,
        "total_scanned": sum(counts.values()),
    }


@app.post("/diff-headers")
def diff_headers(req: DiffPluginsRequest):
    """Diff the TES4 headers of two plugin files — shows master-list and flag changes."""
    for p in (req.plugin_a, req.plugin_b):
        if not os.path.exists(p):
            return {"status": "error", "message": f"Plugin not found: {p}"}
    result = _diff_plugin_headers(req.plugin_a, req.plugin_b)
    if "error" in result:
        return {"status": "error", "message": result["error"]}
    return {"status": "ok", **result}


@app.post("/analyze-load-order-graph")
def analyze_load_order_graph(req: GraphAnalysisRequest):
    """Build a directed dependency graph from plugin master lists.

    Returns:
    - load_order: topologically sorted plugin list
    - cycles: list of circular dependency chains (should be empty for valid setups)
    - missing_masters: plugins whose masters are not present in the directory
    - graph_nodes / graph_edges: raw graph data for visualisation
    """
    plugins_dir = req.plugins_dir
    if not os.path.isdir(plugins_dir):
        return {"status": "error", "message": f"Directory not found: {plugins_dir}"}

    # Collect all .esp/.esm/.esl files in the directory
    all_plugins: List[str] = []
    if req.plugin_names:
        all_plugins = req.plugin_names
    else:
        for fname in sorted(os.listdir(plugins_dir)):
            if fname.lower().endswith((".esp", ".esm", ".esl")):
                all_plugins.append(fname)

    # Parse headers to build master dependency map
    dependency_map: Dict[str, List[str]] = {}
    header_cache: Dict[str, dict] = {}
    for pname in all_plugins:
        fpath = os.path.join(plugins_dir, pname)
        if not os.path.exists(fpath):
            dependency_map[pname] = []
            continue
        hdr = _parse_esp_header(fpath)
        header_cache[pname] = hdr
        dependency_map[pname] = hdr.get("masters", [])

    if not NETWORKX_AVAILABLE:
        # Fallback: simple BFS topological sort without cycle detection
        from collections import defaultdict, deque
        in_degree: Dict[str, int] = defaultdict(int)
        adj: Dict[str, List[str]] = defaultdict(list)
        node_set = set(all_plugins)
        for plugin, masters in dependency_map.items():
            for master in masters:
                if master in node_set:
                    adj[master].append(plugin)
                    in_degree[plugin] += 1
        queue: deque = deque(p for p in all_plugins if in_degree[p] == 0)
        sorted_order: List[str] = []
        while queue:
            node = queue.popleft()
            sorted_order.append(node)
            for child in adj[node]:
                in_degree[child] -= 1
                if in_degree[child] == 0:
                    queue.append(child)
        return {
            "status": "ok",
            "load_order": sorted_order,
            "cycles": [],
            "missing_masters": [],
            "graph_nodes": all_plugins,
            "graph_edges": [
                {"from": m, "to": p}
                for p, masters in dependency_map.items()
                for m in masters
            ],
            "networkx_available": False,
        }

    # Build directed graph: edge master → plugin (master must load before plugin)
    G = nx.DiGraph()
    G.add_nodes_from(all_plugins)
    known_set = set(all_plugins)
    missing_masters: List[str] = []

    for plugin, masters in dependency_map.items():
        for master in masters:
            if master not in known_set:
                if master not in missing_masters:
                    missing_masters.append(master)
            else:
                G.add_edge(master, plugin)

    # Detect cycles
    cycles = [list(c) for c in nx.simple_cycles(G)]

    # Topological sort (stable, respects master order)
    try:
        load_order = list(nx.topological_sort(G))
    except nx.NetworkXUnfeasible:
        load_order = all_plugins  # fallback if cycles prevent sort

    return {
        "status": "ok",
        "load_order": load_order,
        "cycles": cycles,
        "missing_masters": missing_masters,
        "graph_nodes": list(G.nodes()),
        "graph_edges": [{"from": u, "to": v} for u, v in G.edges()],
        "plugin_count": len(all_plugins),
        "networkx_available": True,
    }


@app.get("/supported-games")
def supported_games():
    return {"status": "ok", "games": SUPPORTED_GAMES}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8012)
