"""
Cell Editor Service — port 8017

Full round-trip workflow for editing Fallout 4 / Bethesda interior cells in Blender:

  1. /list-cells          → scan a plugin, list all CELL records
  2. /extract-cell        → pull one CELL + all REFR placed-object records as JSON
  3. /blender-addon       → download the Blender 4.x add-on (.py) that imports the JSON,
                             lets you move/add/remove objects, then re-exports to JSON
  4. /generate-patch-esp  → convert the Blender-export JSON back into a patch .esp file
                             that overrides the original cell with your new layout

ESP/ESM format reference:
  https://en.uesp.net/wiki/Fallout4:Plugin_File_Format
  https://en.uesp.net/wiki/Fallout4:CELL
  https://en.uesp.net/wiki/Fallout4:REFR
"""
from __future__ import annotations

import json
import os
import struct
import zlib
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

DATA_DIR = Path(
    os.environ.get("MOSSY_DATA_ROOT", os.path.join(os.path.expanduser("~"), "Mossy-AI"))
) / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Binary constants ──────────────────────────────────────────────────────────
RECORD_HEADER_SIZE = 24      # bytes: type(4)+size(4)+flags(4)+formID(4)+vc(4)+ver(2)+unk(2)
SUBRECORD_HEADER_SIZE = 6    # bytes: type(4)+size(2)
FLAG_COMPRESSED = 0x00040000
FLAG_ESM        = 0x00000001

T_GRUP = b"GRUP"
T_TES4 = b"TES4"
T_CELL = b"CELL"
T_REFR = b"REFR"
T_ACHR = b"ACHR"    # placed actor

PLACED_TYPES = {T_REFR, T_ACHR}

# ── Low-level binary helpers ──────────────────────────────────────────────────

def _pack_subrecord(sr_type: bytes, data: bytes) -> bytes:
    return sr_type + struct.pack("<H", len(data)) + data


def _pack_record(rec_type: bytes, flags: int, form_id: int, body: bytes) -> bytes:
    hdr = rec_type + struct.pack("<IIIHH", len(body), flags & ~FLAG_COMPRESSED, form_id, 0, 44)
    return hdr + body


def _pack_grup(label: bytes, group_type: int, children: bytes) -> bytes:
    total = RECORD_HEADER_SIZE + len(children)
    hdr = b"GRUP" + struct.pack("<I", total) + label + struct.pack("<IIHH", group_type, 0, 44, 0)
    return hdr + children


def _read_header(data: bytes, offset: int) -> Tuple[Optional[Dict], int]:
    """Return (header_dict, offset_after_header) or (None, offset) on error."""
    if offset + RECORD_HEADER_SIZE > len(data):
        return None, offset
    rec_type = data[offset: offset + 4]
    size_val = struct.unpack_from("<I", data, offset + 4)[0]
    field_a  = struct.unpack_from("<I", data, offset + 8)[0]   # flags or group label
    field_b  = struct.unpack_from("<I", data, offset + 12)[0]  # formID or group_type
    if rec_type == T_GRUP:
        return {
            "is_grup":    True,
            "total_size": size_val,                  # includes the 24-byte header
            "label":      data[offset + 8: offset + 12],
            "group_type": field_b,
            "data_end":   offset + size_val,
            "children_start": offset + RECORD_HEADER_SIZE,
        }, offset + RECORD_HEADER_SIZE
    else:
        return {
            "is_grup":    False,
            "rec_type":   rec_type,
            "data_size":  size_val,
            "flags":      field_a,
            "form_id":    field_b,
            "data_start": offset + RECORD_HEADER_SIZE,
            "data_end":   offset + RECORD_HEADER_SIZE + size_val,
            "rec_start":  offset,
        }, offset + RECORD_HEADER_SIZE


def _get_record_body(data: bytes, hdr: Dict) -> bytes:
    """Return decompressed record body bytes."""
    raw = data[hdr["data_start"]: hdr["data_end"]]
    if hdr.get("flags", 0) & FLAG_COMPRESSED and len(raw) >= 4:
        try:
            raw = zlib.decompress(raw[4:])
        except Exception:
            pass
    return raw


def _parse_subrecords(body: bytes) -> List[Dict]:
    srs, pos = [], 0
    while pos + SUBRECORD_HEADER_SIZE <= len(body):
        sr_type = body[pos: pos + 4]
        sr_size = struct.unpack_from("<H", body, pos + 4)[0]
        sr_data = body[pos + 6: pos + 6 + sr_size]
        srs.append({"type": sr_type, "size": sr_size, "data": sr_data})
        pos += SUBRECORD_HEADER_SIZE + sr_size
    return srs


# ── TES4 master list ─────────────────────────────────────────────────────────

def _parse_tes4_masters(data: bytes) -> List[str]:
    hdr, after_hdr = _read_header(data, 0)
    if not hdr or hdr["rec_type"] != T_TES4:
        return []
    body = _get_record_body(data, hdr)
    masters = [
        sr["data"].rstrip(b"\x00").decode("utf-8", errors="replace")
        for sr in _parse_subrecords(body)
        if sr["type"] == b"MAST"
    ]
    return masters


# ── REFR / ACHR parser ───────────────────────────────────────────────────────

def _parse_placed(form_id: int, flags: int, rec_type: bytes, body: bytes) -> Dict:
    edid = ""
    base_id = 0
    pos_x = pos_y = pos_z = 0.0
    rot_x = rot_y = rot_z = 0.0
    scale = 1.0
    raw_srs: List[Dict] = []

    for sr in _parse_subrecords(body):
        t = sr["type"]
        d = sr["data"]
        raw_srs.append({"type": t.decode("latin-1"), "data": d.hex()})
        if t == b"EDID":
            edid = d.rstrip(b"\x00").decode("utf-8", errors="replace")
        elif t == b"NAME" and len(d) >= 4:
            base_id = struct.unpack_from("<I", d)[0]
        elif t == b"DATA" and len(d) >= 24:
            pos_x, pos_y, pos_z, rot_x, rot_y, rot_z = struct.unpack_from("<6f", d)
        elif t == b"XSCL" and len(d) >= 4:
            scale = struct.unpack_from("<f", d)[0]

    return {
        "form_id":     form_id,
        "form_id_hex": f"0x{form_id:08X}",
        "rec_type":    rec_type.decode("ascii"),
        "flags":       flags,
        "edid":        edid,
        "base_id":     base_id,
        "base_id_hex": f"0x{base_id:08X}",
        "pos":         [round(pos_x, 4), round(pos_y, 4), round(pos_z, 4)],
        "rot":         [round(rot_x, 6), round(rot_y, 6), round(rot_z, 6)],
        "scale":       round(scale, 6),
        "subrecords":  raw_srs,   # preserved so the writer can round-trip all data
    }


# ── Group walker: collect placed objects inside cell-children groups ──────────

def _collect_placed(data: bytes, start: int, end: int) -> List[Dict]:
    """Walk a GRUP range and collect all REFR/ACHR records (recurses into sub-groups)."""
    placed: List[Dict] = []
    pos = start
    while pos < end:
        hdr, next_pos = _read_header(data, pos)
        if hdr is None:
            break
        if hdr["is_grup"]:
            total = hdr["total_size"]
            if total < RECORD_HEADER_SIZE:
                break
            # Recurse into type-8 (persistent) and type-10 (temporary) children groups
            placed.extend(_collect_placed(data, hdr["children_start"], hdr["data_end"]))
            pos = hdr["data_end"]
        elif hdr["rec_type"] in PLACED_TYPES:
            body = _get_record_body(data, hdr)
            placed.append(_parse_placed(hdr["form_id"], hdr["flags"], hdr["rec_type"], body))
            pos = hdr["data_end"]
        else:
            pos = hdr["data_end"]
    return placed


# ── Cell scanner ─────────────────────────────────────────────────────────────

def _scan_for_cells(data: bytes) -> List[Dict]:
    """Scan the entire file for CELL records and return a summary list."""
    cells: List[Dict] = []
    # Skip TES4
    hdr, after = _read_header(data, 0)
    if hdr is None:
        return cells
    pos = hdr["data_end"]
    _walk_cells(data, pos, len(data), cells)
    return cells


def _walk_cells(data: bytes, start: int, end: int, cells: List[Dict]) -> None:
    pos = start
    while pos < end:
        hdr, next_pos = _read_header(data, pos)
        if hdr is None:
            break
        if hdr["is_grup"]:
            total = hdr["total_size"]
            if total < RECORD_HEADER_SIZE:
                break
            _walk_cells(data, hdr["children_start"], hdr["data_end"], cells)
            pos = hdr["data_end"]
        elif hdr["rec_type"] == T_CELL:
            body = _get_record_body(data, hdr)
            edid = ""
            full_name = ""
            cell_data_flags = 0
            for sr in _parse_subrecords(body):
                if sr["type"] == b"EDID":
                    edid = sr["data"].rstrip(b"\x00").decode("utf-8", errors="replace")
                elif sr["type"] == b"FULL":
                    if len(sr["data"]) == 4:
                        ref = struct.unpack_from("<I", sr["data"])[0]
                        full_name = f"[LSTRING:{ref:#010x}]"
                    else:
                        full_name = sr["data"].rstrip(b"\x00").decode("utf-8", errors="replace")
                elif sr["type"] == b"DATA" and sr["data"]:
                    cell_data_flags = sr["data"][0]
            cells.append({
                "form_id":     hdr["form_id"],
                "form_id_hex": f"0x{hdr['form_id']:08X}",
                "edid":        edid,
                "full_name":   full_name or edid,
                "is_interior": bool(cell_data_flags & 0x01),
            })
            pos = hdr["data_end"]
        else:
            pos = hdr["data_end"]


# ── Cell + children extractor ────────────────────────────────────────────────

def _extract_cell(data: bytes, target_form_id: int) -> Optional[Dict]:
    """Locate a CELL by FormID and return it plus all its placed objects."""
    hdr, after = _read_header(data, 0)
    if hdr is None:
        return None
    return _find_cell_in_range(data, hdr["data_end"], len(data), target_form_id)


def _find_cell_in_range(data: bytes, start: int, end: int, target: int) -> Optional[Dict]:
    """Recursive search for a CELL with the given FormID."""
    pos = start
    cell_info: Optional[Dict] = None

    while pos < end:
        hdr, next_pos = _read_header(data, pos)
        if hdr is None:
            break

        if hdr["is_grup"]:
            total = hdr["total_size"]
            if total < RECORD_HEADER_SIZE:
                break

            if hdr["group_type"] == 6:
                # Cell-children group: label = the CELL's FormID
                label_fid = struct.unpack_from("<I", hdr["label"])[0]
                if label_fid == target and cell_info is not None:
                    placed = _collect_placed(data, hdr["children_start"], hdr["data_end"])
                    cell_info["placed"] = placed
                    return cell_info
                # Wrong cell or cell_info not set yet — skip children
                pos = hdr["data_end"]
            else:
                # Descend into block/sub-block/worldspace groups
                result = _find_cell_in_range(data, hdr["children_start"], hdr["data_end"], target)
                if result is not None:
                    return result
                pos = hdr["data_end"]

        elif hdr["rec_type"] == T_CELL and hdr["form_id"] == target:
            body = _get_record_body(data, hdr)
            edid = ""
            full_name = ""
            cell_data_flags = 0
            raw_srs: List[Dict] = []
            for sr in _parse_subrecords(body):
                raw_srs.append({"type": sr["type"].decode("latin-1"), "data": sr["data"].hex()})
                if sr["type"] == b"EDID":
                    edid = sr["data"].rstrip(b"\x00").decode("utf-8", errors="replace")
                elif sr["type"] == b"FULL":
                    if len(sr["data"]) != 4:
                        full_name = sr["data"].rstrip(b"\x00").decode("utf-8", errors="replace")
                elif sr["type"] == b"DATA" and sr["data"]:
                    cell_data_flags = sr["data"][0]
            cell_info = {
                "form_id":      hdr["form_id"],
                "form_id_hex":  f"0x{hdr['form_id']:08X}",
                "flags":        hdr["flags"],
                "edid":         edid,
                "full_name":    full_name or edid,
                "is_interior":  bool(cell_data_flags & 0x01),
                "raw_subrecords": raw_srs,
                "placed":       [],   # filled after we find the GRUP(6)
            }
            pos = hdr["data_end"]

        else:
            pos = hdr["data_end"]

    # If we found the CELL but not the GRUP(6) (no placed objects), return anyway
    return cell_info


# ── Patch ESP writer ──────────────────────────────────────────────────────────

def _build_refr_body(ref: Dict) -> bytes:
    """Rebuild a REFR/ACHR record body: updated DATA/XSCL, all other subrecords intact."""
    body = b""
    saw_data = saw_xscl = False
    for sr in ref.get("subrecords", []):
        t = sr["type"].encode("latin-1")
        if t == b"DATA":
            pos, rot = ref["pos"], ref["rot"]
            body += _pack_subrecord(b"DATA", struct.pack("<6f", *pos, *rot))
            saw_data = True
        elif t == b"XSCL":
            body += _pack_subrecord(b"XSCL", struct.pack("<f", ref.get("scale", 1.0)))
            saw_xscl = True
        else:
            body += _pack_subrecord(t, bytes.fromhex(sr["data"]))
    if not saw_data:
        pos, rot = ref["pos"], ref["rot"]
        body += _pack_subrecord(b"DATA", struct.pack("<6f", *pos, *rot))
    if not saw_xscl and abs(ref.get("scale", 1.0) - 1.0) > 1e-5:
        body += _pack_subrecord(b"XSCL", struct.pack("<f", ref["scale"]))
    return body


def _build_patch_esp(
    cell_data: Dict,
    modified_refs: List[Dict],
    source_plugin_name: str,
    original_masters: List[str],
) -> bytes:
    """
    Build a minimal patch ESP that overrides positions/rotations/scales in one cell.

    Master list layout:
      index 0..N-1  : original masters copied from source plugin
      index N       : source plugin itself

    All FormIDs from the source plugin keep their original top bytes, which
    now index into this same master list — so nothing needs to be renumbered.
    """
    # ── TES4 ──────────────────────────────────────────────────────────────────
    masters_for_patch = original_masters + [source_plugin_name]
    tes4_body = b""
    tes4_body += _pack_subrecord(b"HEDR", struct.pack("<fI", 0.94, len(modified_refs)))
    tes4_body += _pack_subrecord(b"CNAM", b"Mossy Desktop AI\x00")
    tes4_body += _pack_subrecord(b"SNAM", b"Cell layout patch generated by Mossy AI Blender integration\x00")
    for m in masters_for_patch:
        tes4_body += _pack_subrecord(b"MAST", m.encode("utf-8") + b"\x00")
        tes4_body += _pack_subrecord(b"DATA", struct.pack("<Q", 0))
    tes4_record = _pack_record(b"TES4", FLAG_ESM, 0x00000000, tes4_body)

    # ── REFR records ──────────────────────────────────────────────────────────
    refr_bytes = b""
    for ref in modified_refs:
        rt = ref.get("rec_type", "REFR").encode("ascii")
        refr_bytes += _pack_record(rt, ref.get("flags", 0), ref["form_id"], _build_refr_body(ref))

    # ── Cell children GRUP(6) ─────────────────────────────────────────────────
    cell_fid = cell_data["form_id"]
    children_grup = _pack_grup(struct.pack("<I", cell_fid), 6, refr_bytes)

    # ── Minimal CELL override record ──────────────────────────────────────────
    cell_body = b""
    for sr in cell_data.get("raw_subrecords", []):
        t = sr["type"].encode("latin-1")
        cell_body += _pack_subrecord(t, bytes.fromhex(sr["data"]))
    cell_record = _pack_record(b"CELL", cell_data.get("flags", 0), cell_fid, cell_body)

    # ── Group hierarchy: top CELL > block 0 > sub-block 0 ────────────────────
    sub_block = _pack_grup(struct.pack("<I", 0), 3, cell_record + children_grup)
    block     = _pack_grup(struct.pack("<I", 0), 2, sub_block)
    top_cell  = _pack_grup(b"CELL", 0, block)

    return tes4_record + top_cell


# ── Blender 4.x add-on source (embedded) ─────────────────────────────────────

_BLENDER_ADDON_SOURCE = r'''# Mossy AI — FO4 Cell Editor Add-on for Blender 4.x
# Install via Edit > Preferences > Add-ons > Install, then enable.
# Panel appears in 3D View > Sidebar (N) > FO4 Cell tab.
#
# Workflow:
#   1. Click "Import Cell JSON" and select the JSON exported by the Mossy service.
#   2. Edit objects in the 3D viewport (move, rotate, scale).
#   3. Click "Export Cell JSON" and save. Then feed that file back to Mossy.

bl_info = {
    "name":        "FO4 Cell Editor",
    "author":      "Mossy Desktop AI",
    "version":     (1, 0, 0),
    "blender":     (4, 0, 0),
    "location":    "View3D > Sidebar > FO4 Cell",
    "description": "Import / export Fallout 4 cell layouts for round-trip editing",
    "category":    "Import-Export",
}

import bpy
import json
import math
import os
from bpy.props import StringProperty
from bpy.types import Operator, Panel, AddonPreferences

# ── Constants ─────────────────────────────────────────────────────────────────
# Bethesda position units → Blender metres  (approx: 1 unit ≈ 1 cm)
POS_SCALE = 0.01
# Rotation: Bethesda uses ZYX Euler in radians; Blender Euler mode 'ZYX' matches directly.

PROP_FORM_ID   = "fo4_form_id"
PROP_BASE_ID   = "fo4_base_id"
PROP_BASE_NAME = "fo4_base_name"
PROP_REC_TYPE  = "fo4_rec_type"
PROP_CELL_FID  = "fo4_cell_form_id"
PROP_PLUGIN    = "fo4_plugin"
PROP_SUBRECORDS = "fo4_subrecords_json"

# ── Utility ───────────────────────────────────────────────────────────────────

def tag_object(obj, ref: dict, cell_form_id_hex: str, plugin_name: str):
    obj[PROP_FORM_ID]    = ref["form_id_hex"]
    obj[PROP_BASE_ID]    = ref["base_id_hex"]
    obj[PROP_BASE_NAME]  = ref.get("edid", "")
    obj[PROP_REC_TYPE]   = ref.get("rec_type", "REFR")
    obj[PROP_CELL_FID]   = cell_form_id_hex
    obj[PROP_PLUGIN]     = plugin_name
    obj[PROP_SUBRECORDS] = json.dumps(ref.get("subrecords", []))


def make_placeholder_mesh(name: str, scale_bl: float) -> bpy.types.Object:
    """Create a small cube with the given base scale as placeholder for a placed object."""
    bpy.ops.mesh.primitive_cube_add(size=0.3 * scale_bl)
    obj = bpy.context.active_object
    obj.name = name
    return obj


# ── Import operator ───────────────────────────────────────────────────────────

class FO4_OT_ImportCell(Operator):
    """Import a Fallout 4 cell JSON file exported by Mossy AI"""
    bl_idname  = "fo4cell.import_json"
    bl_label   = "Import Cell JSON"
    bl_options = {'REGISTER', 'UNDO'}

    filepath: StringProperty(subtype='FILE_PATH')
    filter_glob: StringProperty(default='*.json', options={'HIDDEN'})

    def execute(self, context):
        if not os.path.isfile(self.filepath):
            self.report({'ERROR'}, f"File not found: {self.filepath}")
            return {'CANCELLED'}

        with open(self.filepath, "r", encoding="utf-8") as fh:
            cell_data = json.load(fh)

        cell_fid  = cell_data.get("form_id_hex", "0x00000000")
        cell_name = cell_data.get("full_name") or cell_data.get("edid") or cell_fid
        plugin    = cell_data.get("source_plugin", "unknown.esp")
        placed    = cell_data.get("placed", [])

        # Create a collection for this cell
        col = bpy.data.collections.new(f"FO4_Cell_{cell_name}")
        bpy.context.scene.collection.children.link(col)

        imported = 0
        for ref in placed:
            form_hex  = ref.get("form_id_hex", "0x00000000")
            base_hex  = ref.get("base_id_hex", "0x00000000")
            edid      = ref.get("edid", "") or base_hex
            rec_type  = ref.get("rec_type", "REFR")
            pos       = ref.get("pos", [0, 0, 0])
            rot       = ref.get("rot", [0, 0, 0])
            scale_val = ref.get("scale", 1.0)

            # Create placeholder cube named after editor-id / FormID
            obj_name = f"{rec_type}_{edid or form_hex}"
            obj = make_placeholder_mesh(obj_name, scale_val)

            # Position (scale game units → metres)
            obj.location.x =  pos[0] * POS_SCALE
            obj.location.y =  pos[1] * POS_SCALE
            obj.location.z =  pos[2] * POS_SCALE

            # Rotation — Bethesda ZYX Euler directly into Blender ZYX mode
            obj.rotation_mode  = 'ZYX'
            obj.rotation_euler = (rot[0], rot[1], rot[2])
            obj.scale          = (scale_val, scale_val, scale_val)

            # Tag with FO4 metadata
            tag_object(obj, ref, cell_fid, plugin)

            # Move into the cell collection
            for coll in list(obj.users_collection):
                coll.objects.unlink(obj)
            col.objects.link(obj)
            imported += 1

        self.report({'INFO'}, f"Imported {imported} placed objects for {cell_name}")
        return {'FINISHED'}

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}


# ── Export operator ───────────────────────────────────────────────────────────

class FO4_OT_ExportCell(Operator):
    """Export the current cell objects back to JSON for Mossy AI patch generation"""
    bl_idname  = "fo4cell.export_json"
    bl_label   = "Export Cell JSON"
    bl_options = {'REGISTER'}

    filepath: StringProperty(subtype='FILE_PATH')
    filter_glob: StringProperty(default='*.json', options={'HIDDEN'})

    def execute(self, context):
        # Collect all objects that carry FO4 metadata
        tagged = [
            obj for obj in bpy.data.objects
            if PROP_FORM_ID in obj and PROP_CELL_FID in obj
        ]

        if not tagged:
            self.report({'WARNING'}, "No FO4-tagged objects found. Import a cell first.")
            return {'CANCELLED'}

        # Group by cell FormID
        cells: dict = {}
        for obj in tagged:
            cfid = obj[PROP_CELL_FID]
            if cfid not in cells:
                cells[cfid] = {
                    "form_id_hex": cfid,
                    "source_plugin": obj.get(PROP_PLUGIN, ""),
                    "placed": [],
                }
            pos_bl = obj.location
            # Convert back to Bethesda units
            pos_game = [pos_bl.x / POS_SCALE, pos_bl.y / POS_SCALE, pos_bl.z / POS_SCALE]

            obj.rotation_mode = 'ZYX'
            rot = list(obj.rotation_euler)
            scale = float(obj.scale.x)  # uniform scale assumed

            # Rebuild FormID integer from hex string
            form_id_hex = obj[PROP_FORM_ID]
            try:
                form_id_int = int(form_id_hex, 16)
            except (ValueError, TypeError):
                form_id_int = 0

            base_id_hex = obj.get(PROP_BASE_ID, "0x00000000")
            try:
                base_id_int = int(base_id_hex, 16)
            except (ValueError, TypeError):
                base_id_int = 0

            # Restore raw subrecords (or empty list)
            try:
                subrecords = json.loads(obj.get(PROP_SUBRECORDS, "[]"))
            except Exception:
                subrecords = []

            cells[cfid]["placed"].append({
                "form_id":     form_id_int,
                "form_id_hex": form_id_hex,
                "rec_type":    obj.get(PROP_REC_TYPE, "REFR"),
                "flags":       0,
                "edid":        obj.get(PROP_BASE_NAME, ""),
                "base_id":     base_id_int,
                "base_id_hex": base_id_hex,
                "pos":         [round(v, 4) for v in pos_game],
                "rot":         [round(v, 6) for v in rot],
                "scale":       round(scale, 6),
                "subrecords":  subrecords,
            })

        # Write one JSON per cell (or a combined JSON if multi-cell)
        output = list(cells.values())
        output_path = self.filepath
        if not output_path.endswith(".json"):
            output_path += ".json"

        with open(output_path, "w", encoding="utf-8") as fh:
            json.dump(output if len(output) > 1 else output[0], fh, indent=2)

        self.report({'INFO'}, f"Exported {sum(len(c['placed']) for c in output)} objects → {output_path}")
        return {'FINISHED'}

    def invoke(self, context, event):
        self.filepath = "fo4_cell_export.json"
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}


# ── Sidebar panel ─────────────────────────────────────────────────────────────

class FO4_PT_CellPanel(Panel):
    bl_label       = "FO4 Cell Editor"
    bl_idname      = "FO4_PT_cell_panel"
    bl_space_type  = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category    = "FO4 Cell"

    def draw(self, context):
        layout = self.layout
        col = layout.column(align=True)
        col.label(text="Round-trip cell editing:", icon='MODIFIER')
        col.separator()
        col.operator("fo4cell.import_json", text="Import Cell JSON", icon='IMPORT')
        col.operator("fo4cell.export_json", text="Export Cell JSON", icon='EXPORT')
        col.separator()

        # Active object info
        obj = context.active_object
        if obj and PROP_FORM_ID in obj:
            box = layout.box()
            box.label(text="Selected Object", icon='OBJECT_DATA')
            box.label(text=f"FormID : {obj[PROP_FORM_ID]}")
            box.label(text=f"Base   : {obj[PROP_BASE_ID]}")
            if obj.get(PROP_BASE_NAME):
                box.label(text=f"EdID   : {obj[PROP_BASE_NAME]}")
            box.label(text=f"Type   : {obj.get(PROP_REC_TYPE, 'REFR')}")
            box.label(text=f"Plugin : {obj.get(PROP_PLUGIN, '')}")
        else:
            layout.label(text="(Select an imported object)", icon='INFO')


# ── Registration ──────────────────────────────────────────────────────────────

_CLASSES = [FO4_OT_ImportCell, FO4_OT_ExportCell, FO4_PT_CellPanel]

def register():
    for cls in _CLASSES:
        bpy.utils.register_class(cls)

def unregister():
    for cls in reversed(_CLASSES):
        bpy.utils.unregister_class(cls)

if __name__ == "__main__":
    register()
'''

# ── Request / response models ─────────────────────────────────────────────────

class ListCellsRequest(BaseModel):
    plugin_path: str


class ExtractCellRequest(BaseModel):
    plugin_path: str
    cell_form_id: int       # decimal or parsed from hex string by the frontend


class GeneratePatchRequest(BaseModel):
    original_plugin_path: str
    blender_export_json: Dict[str, Any]   # the JSON the Blender add-on exports
    output_esp_path: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

_PLUGIN_EXTENSIONS = {".esp", ".esm", ".esl"}


def _safe_plugin_path(raw: str) -> Optional[Path]:
    """Resolve and validate a plugin file path — must exist and have a known extension."""
    try:
        p = Path(raw).resolve()
        if p.suffix.lower() not in _PLUGIN_EXTENSIONS:
            return None
        return p
    except Exception:
        return None


def _safe_output_path(raw: str) -> Path:
    """Resolve an output ESP path, ensuring it ends with a plugin extension."""
    p = Path(raw).resolve()
    if p.suffix.lower() not in _PLUGIN_EXTENSIONS:
        p = p.with_suffix(".esp")
    return p


@app.get("/health")
def health():
    return {"status": "ok", "service": "cell-editor", "version": "1.0.0"}


@app.post("/list-cells")
def list_cells(req: ListCellsRequest):
    """Scan a plugin file and return all CELL records."""
    safe = _safe_plugin_path(req.plugin_path)
    if safe is None or not safe.is_file():
        return {"status": "error", "message": "Plugin file not found or unsupported extension."}
    try:
        data = safe.read_bytes()
    except OSError:
        return {"status": "error", "message": "Could not read plugin file."}

    cells = _scan_for_cells(data)
    return {
        "status":     "ok",
        "plugin":     safe.name,
        "cell_count": len(cells),
        "cells":      cells,
    }


@app.post("/extract-cell")
def extract_cell(req: ExtractCellRequest):
    """Extract one CELL and all its placed objects (REFR/ACHR records)."""
    safe = _safe_plugin_path(req.plugin_path)
    if safe is None or not safe.is_file():
        return {"status": "error", "message": "Plugin file not found or unsupported extension."}
    try:
        data = safe.read_bytes()
    except OSError:
        return {"status": "error", "message": "Could not read plugin file."}

    cell = _extract_cell(data, req.cell_form_id)
    if cell is None:
        return {"status": "error", "message": f"Cell 0x{req.cell_form_id:08X} not found in {safe.name}"}

    cell["source_plugin"] = safe.name
    cell["placed_count"]  = len(cell.get("placed", []))
    return {"status": "ok", **cell}


@app.post("/generate-patch-esp")
def generate_patch_esp(req: GeneratePatchRequest):
    """
    Convert a Blender-export JSON back to a patch .esp file.

    The blender_export_json must have the same structure as what /extract-cell
    returns (with 'placed' objects' pos/rot/scale updated to reflect edits).
    """
    safe_orig = _safe_plugin_path(req.original_plugin_path)
    if safe_orig is None or not safe_orig.is_file():
        return {"status": "error", "message": "Original plugin not found or unsupported extension."}

    try:
        orig_data = safe_orig.read_bytes()
    except OSError:
        return {"status": "error", "message": "Could not read original plugin."}

    orig_masters       = _parse_tes4_masters(orig_data)
    source_plugin_name = safe_orig.name

    cell_data   = req.blender_export_json
    placed_refs = cell_data.get("placed", [])

    if not placed_refs:
        return {"status": "error", "message": "No placed objects in export JSON."}
    if "form_id" not in cell_data and "form_id_hex" not in cell_data:
        return {"status": "error", "message": "Missing 'form_id' or 'form_id_hex' in export JSON."}

    # Resolve form_id from either key
    if "form_id" not in cell_data:
        try:
            cell_data = dict(cell_data)
            cell_data["form_id"] = int(cell_data["form_id_hex"], 16)
        except (ValueError, KeyError):
            return {"status": "error", "message": "Invalid form_id_hex in export JSON."}

    try:
        esp_bytes = _build_patch_esp(cell_data, placed_refs, source_plugin_name, orig_masters)
    except Exception:
        return {"status": "error", "message": "Patch generation failed — check the export JSON structure."}

    out_path = _safe_output_path(req.output_esp_path)

    try:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(esp_bytes)
    except OSError:
        return {"status": "error", "message": "Could not write patch file — check the output path permissions."}

    return {
        "status":          "ok",
        "output_path":     str(out_path),
        "file_size_bytes": len(esp_bytes),
        "placed_count":    len(placed_refs),
        "masters_used":    orig_masters + [source_plugin_name],
    }


@app.get("/blender-addon")
def blender_addon():
    """Return the Blender 4.x add-on Python source as a string."""
    return {"status": "ok", "source": _BLENDER_ADDON_SOURCE, "filename": "mossy_fo4_cell_editor.py"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8017)
