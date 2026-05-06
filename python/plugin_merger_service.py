"""
Plugin Merger Service — port 8021
Analyses and merges multiple Fallout 4 / Skyrim ESP/ESM plugins into a
single merged ESP, reducing the plugin count below the 255/254 limit.

Uses `construct` for binary record parsing and writing.  Provides:
- Conflict analysis between selected plugins
- Merge record list with override resolution
- Output plugin generation

construct: https://github.com/construct/construct
"""
import os
import struct
from pathlib import Path
from typing import Optional, List, Dict, Any, Set

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

DATA_DIR = Path(
    os.environ.get("MOSSY_DATA_ROOT", os.path.join(os.path.expanduser("~"), "Mossy-AI"))
) / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Lightweight record reader (no external deps) ───────────────────────────
# Bethesda record layout:
#   4s  type, I  data_size, I  flags, I  form_id, I  timestamp, I  version_info
_REC_HEADER = struct.Struct("<4sIIIII")
_REC_HDR_SIZE = _REC_HEADER.size  # 20 bytes

_GROUP_HEADER = struct.Struct("<4sIIIHHI")
_GRP_HDR_SIZE = _GROUP_HEADER.size  # 24 bytes

RECORD_TYPES_OF_INTEREST = {
    b"WEAP", b"ARMO", b"NPC_", b"CELL", b"REFR",
    b"CONT", b"MISC", b"AMMO", b"FACT", b"KYWD",
    b"PERK", b"COBJ", b"LVLI", b"LVLC", b"LVLN",
}

_SAFE_PLUGIN_NAME_RE = __import__("re").compile(r'^[\w\- .]+\.(esp|esm|esl)$', __import__("re").IGNORECASE)


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


def _scan_records(plugin_path: str) -> Dict[str, Any]:
    """Scan a plugin file and return a dict of formId -> (type, size, offset)."""
    records: Dict[int, Dict[str, Any]] = {}
    file_size = os.path.getsize(plugin_path)
    try:
        with open(plugin_path, "rb") as f:
            # Read TES4 header record
            hdr_bytes = f.read(_REC_HDR_SIZE)
            if len(hdr_bytes) < _REC_HDR_SIZE:
                return {"error": "File too small"}
            rtype, dsize, flags, form_id, _, _ = _REC_HEADER.unpack(hdr_bytes)
            if rtype not in (b"TES4",):
                return {"error": "Not a valid plugin (missing TES4 header)"}
            # Skip TES4 data
            f.seek(dsize, 1)
            offset = f.tell()

            max_scan = min(file_size, 1_500_000)  # scan first 1.5 MB for speed
            while offset < max_scan:
                f.seek(offset)
                raw = f.read(_REC_HDR_SIZE)
                if len(raw) < _REC_HDR_SIZE:
                    break
                rtype, dsize, flags, form_id, _, _ = _REC_HEADER.unpack(raw)
                if rtype == b"GRUP":
                    # Group — re-read with group struct
                    f.seek(offset)
                    grp_raw = f.read(_GRP_HDR_SIZE)
                    if len(grp_raw) < _GRP_HDR_SIZE:
                        break
                    _, grp_size, _, _, _, _, _ = _GROUP_HEADER.unpack(grp_raw)
                    offset += grp_size if grp_size > _GRP_HDR_SIZE else _GRP_HDR_SIZE
                    continue
                if rtype in RECORD_TYPES_OF_INTEREST:
                    records[form_id] = {
                        "type": rtype.decode("ascii", errors="replace"),
                        "size": dsize,
                        "offset": offset,
                        "flags": flags,
                    }
                offset += _REC_HDR_SIZE + dsize
    except Exception:
        return {"error": "Parse error"}
    return records


def _read_masters(plugin_path: str) -> List[str]:
    """Extract master file list from TES4 record."""
    masters: List[str] = []
    try:
        with open(plugin_path, "rb") as f:
            hdr = f.read(_REC_HDR_SIZE)
            if len(hdr) < _REC_HDR_SIZE:
                return masters
            _, dsize, _, _, _, _ = _REC_HEADER.unpack(hdr)
            data = f.read(dsize)
        # MAST subrecords: 4s + I + string
        i = 0
        while i < len(data) - 6:
            subtype = data[i:i+4]
            sub_size = struct.unpack_from("<I", data, i + 4)[0]
            if subtype == b"MAST":
                name_bytes = data[i+8:i+8+sub_size]
                name = name_bytes.rstrip(b"\x00").decode("utf-8", errors="replace")
                masters.append(name)
            i += 8 + sub_size
    except Exception:
        pass
    return masters


# ── Request Models ─────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    plugin_paths: List[str]

class MergeRequest(BaseModel):
    plugin_paths: List[str]
    output_path: str
    merged_plugin_name: str = "MossyMerged.esp"

class ListRecordsRequest(BaseModel):
    plugin_path: str


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/list-records")
def list_records(req: ListRecordsRequest):
    """List all records in a single plugin file."""
    safe = _validate_path(req.plugin_path)
    if safe is None:
        return {"status": "error", "message": "Plugin file not found or invalid path"}
    records = _scan_records(safe)
    if isinstance(records, dict) and "error" in records:
        return {"status": "error", "message": records["error"]}
    masters = _read_masters(safe)
    return {
        "status": "ok",
        "plugin": Path(safe).name,
        "masters": masters,
        "record_count": len(records),
        "records_sample": [
            {"form_id": f"0x{fid:08X}", **info}
            for fid, info in list(records.items())[:50]
        ],
    }


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    """Analyse a set of plugins for mergeability and record conflicts."""
    if len(req.plugin_paths) < 2:
        return {"status": "error", "message": "Provide at least 2 plugins to analyse"}
    if len(req.plugin_paths) > 50:
        return {"status": "error", "message": "Maximum 50 plugins per analysis"}

    all_data: Dict[str, Dict[int, Any]] = {}
    master_deps: Dict[str, List[str]] = {}
    for path in req.plugin_paths:
        safe = _validate_path(path)
        if safe is None:
            return {"status": "error", "message": f"Plugin not found: {path}"}
        all_data[safe] = _scan_records(safe)
        if isinstance(all_data[safe], dict) and "error" in all_data[safe]:
            return {"status": "error", "message": f"Failed to parse {Path(safe).name}: {all_data[safe]['error']}"}
        master_deps[Path(safe).name] = _read_masters(safe)

    # Build form_id -> [plugins that contain it]
    form_id_map: Dict[int, List[str]] = {}
    for plugin_path, records in all_data.items():
        for fid in records:
            if fid not in form_id_map:
                form_id_map[fid] = []
            form_id_map[fid].append(Path(plugin_path).name)

    # Conflicts = formIDs appearing in > 1 plugin
    conflicts: List[Dict[str, Any]] = [
        {"form_id": f"0x{fid:08X}", "in_plugins": plugins, "conflict_type": "Override"}
        for fid, plugins in form_id_map.items()
        if len(plugins) > 1
    ]

    # Shared masters = dependencies all plugins need
    all_masters: Set[str] = set()
    for masters in master_deps.values():
        all_masters.update(masters)

    summary: List[Dict[str, Any]] = [
        {
            "plugin": Path(p).name,
            "records": len(r),
            "masters": master_deps.get(Path(p).name, []),
        }
        for p, r in all_data.items()
    ]

    return {
        "status": "ok",
        "plugins_analysed": len(req.plugin_paths),
        "total_unique_records": len(form_id_map),
        "conflict_count": len(conflicts),
        "conflicts_sample": conflicts[:100],
        "shared_master_requirements": sorted(all_masters),
        "plugin_summary": summary,
        "merge_safe": len(conflicts) < 200,
        "recommendation": (
            "Safe to merge — few conflicts detected."
            if len(conflicts) < 200
            else f"Caution: {len(conflicts)} conflicting records. Review conflicts before merging."
        ),
    }


@app.post("/merge")
def merge(req: MergeRequest):
    """
    Merge selected plugins into one.  The last plugin in the list wins on
    conflicting records (consistent with how Bethesda games apply overrides).
    Output is written as a minimal ESP shell with a TES4 header listing all
    source plugins as masters, preserving the raw record bytes from the winner.
    """
    if len(req.plugin_paths) < 2:
        return {"status": "error", "message": "Provide at least 2 plugins to merge"}
    if len(req.plugin_paths) > 50:
        return {"status": "error", "message": "Maximum 50 plugins per merge"}

    # Validate output directory
    out_path = Path(req.output_path)
    if not out_path.parent.exists():
        try:
            out_path.parent.mkdir(parents=True, exist_ok=True)
        except Exception:
            return {"status": "error", "message": "Cannot create output directory"}

    # Validate plugin name
    if not _SAFE_PLUGIN_NAME_RE.match(req.merged_plugin_name.strip()):
        return {"status": "error", "message": "Invalid merged plugin name — use letters, digits, spaces, hyphens, dots only"}

    # Collect records: last plugin wins on conflict
    merged_records: Dict[int, bytes] = {}
    all_masters: List[str] = []
    seen_masters: Set[str] = set()

    for plugin_path in req.plugin_paths:
        safe = _validate_path(plugin_path)
        if safe is None:
            return {"status": "error", "message": f"Plugin not found: {plugin_path}"}
        name = Path(safe).name
        if name not in seen_masters:
            all_masters.append(name)
            seen_masters.add(name)
        for master in _read_masters(safe):
            if master not in seen_masters:
                all_masters.append(master)
                seen_masters.add(master)

        file_size = os.path.getsize(safe)
        max_scan = min(file_size, 5_000_000)  # 5 MB scan limit
        try:
            with open(safe, "rb") as f:
                # Skip TES4 header
                hdr = f.read(_REC_HDR_SIZE)
                if len(hdr) < _REC_HDR_SIZE:
                    continue
                _, dsize, _, _, _, _ = _REC_HEADER.unpack(hdr)
                f.seek(dsize, 1)
                offset = f.tell()
                while offset < max_scan:
                    f.seek(offset)
                    raw = f.read(_REC_HDR_SIZE)
                    if len(raw) < _REC_HDR_SIZE:
                        break
                    rtype, dsize, flags, form_id, ts, vi = _REC_HEADER.unpack(raw)
                    if rtype == b"GRUP":
                        f.seek(offset)
                        grp_raw = f.read(_GRP_HDR_SIZE)
                        if len(grp_raw) < _GRP_HDR_SIZE:
                            break
                        _, grp_size, _, _, _, _, _ = _GROUP_HEADER.unpack(grp_raw)
                        offset += grp_size if grp_size > _GRP_HDR_SIZE else _GRP_HDR_SIZE
                        continue
                    if rtype in RECORD_TYPES_OF_INTEREST:
                        record_bytes = raw + f.read(dsize)
                        merged_records[form_id] = record_bytes
                    offset += _REC_HDR_SIZE + dsize
        except Exception:
            return {"status": "error", "message": f"Failed to read records from {name}"}

    # Build TES4 header
    def _mast_subrecord(name: str) -> bytes:
        encoded = name.encode("utf-8") + b"\x00"
        return b"MAST" + struct.pack("<I", len(encoded)) + encoded + b"DATA" + b"\x08\x00\x00\x00" + b"\x00" * 8

    tes4_data = b"HEDR\x0c\x00" + struct.pack("<fII", 1.7, len(merged_records), 0x800)
    for master_name in all_masters:
        tes4_data += _mast_subrecord(master_name)
    tes4_data += b"CNAM\x01\x00\x00"  # empty author

    tes4_header = b"TES4" + struct.pack("<IIIII", len(tes4_data), 0, 0, 0, 0) + tes4_data

    # Write output ESP
    with open(str(out_path), "wb") as f:
        f.write(tes4_header)
        for record_bytes in merged_records.values():
            f.write(record_bytes)

    return {
        "status": "ok",
        "output_path": str(out_path),
        "merged_record_count": len(merged_records),
        "masters_included": all_masters,
        "plugins_merged": len(req.plugin_paths),
        "file_size": os.path.getsize(str(out_path)),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8021)
