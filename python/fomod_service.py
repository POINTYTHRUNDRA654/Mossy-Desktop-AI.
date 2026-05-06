"""
FOMOD Installer XML Builder Service — port 8015
Generates ModuleConfig.xml and info.xml for FOMOD mod installers.

FOMOD is used by Nexus Mod Manager, Mod Organizer 2, and Vortex.
Spec: https://fomod-docs.readthedocs.io/
"""
import os
import xml.etree.ElementTree as ET
from xml.dom import minidom
from pathlib import Path
from typing import Optional, List, Any
from fastapi import FastAPI
from pydantic import BaseModel

try:
    from lxml import etree as lxml_etree  # type: ignore
    HAS_LXML = True
except ImportError:
    HAS_LXML = False

app = FastAPI()

FOMOD_SPEC_VERSION = "2.0"

TEMPLATES = [
    {
        "id": "simple",
        "name": "Simple Single-Option Installer",
        "description": "Installs all files with no options.",
        "name": "My Mod",
        "author": "Author",
        "version": "1.0.0",
        "description": "A simple mod.",
        "nexus_id": "",
        "required_files": [{"source": "Data/", "destination": ""}],
        "groups": [],
        "conditions": [],
    },
    {
        "id": "enb",
        "name": "ENB Preset Selector",
        "description": "Lets user choose between ENB presets.",
        "mod_name": "My ENB",
        "author": "Author",
        "version": "1.0.0",
        "description": "ENB preset installer.",
        "nexus_id": "",
        "required_files": [],
        "groups": [
            {
                "name": "Choose ENB Preset",
                "type": "SelectExactlyOne",
                "plugins": [
                    {"name": "Performance", "description": "Optimized for performance.", "image": "", "files": [{"source": "ENB_Performance/", "destination": ""}], "flags": []},
                    {"name": "Balanced", "description": "Balanced preset.", "image": "", "files": [{"source": "ENB_Balanced/", "destination": ""}], "flags": []},
                    {"name": "Ultra", "description": "Maximum quality.", "image": "", "files": [{"source": "ENB_Ultra/", "destination": ""}], "flags": []},
                ],
            }
        ],
        "conditions": [],
    },
    {
        "id": "main_patches",
        "name": "Main + Patches Multi-Group",
        "description": "Core files plus optional compatibility patches.",
        "mod_name": "My Mod With Patches",
        "author": "Author",
        "version": "1.0.0",
        "description": "Core mod with patches.",
        "nexus_id": "",
        "required_files": [{"source": "Core/", "destination": ""}],
        "groups": [
            {
                "name": "Compatibility Patches",
                "type": "SelectAny",
                "plugins": [
                    {"name": "AWKCR Patch", "description": "Patch for AWKCR.", "image": "", "files": [{"source": "Patches/AWKCR/", "destination": ""}], "flags": []},
                    {"name": "CBBE Patch", "description": "Patch for CBBE.", "image": "", "files": [{"source": "Patches/CBBE/", "destination": ""}], "flags": []},
                ],
            }
        ],
        "conditions": [],
    },
    {
        "id": "texture_quality",
        "name": "Texture Quality Options",
        "description": "High / Medium / Low texture resolution selector.",
        "mod_name": "My Texture Pack",
        "author": "Author",
        "version": "1.0.0",
        "description": "Choose texture quality.",
        "nexus_id": "",
        "required_files": [],
        "groups": [
            {
                "name": "Texture Resolution",
                "type": "SelectExactlyOne",
                "plugins": [
                    {"name": "2K Textures", "description": "2048×2048 resolution.", "image": "", "files": [{"source": "2K/", "destination": ""}], "flags": []},
                    {"name": "1K Textures", "description": "1024×1024 resolution.", "image": "", "files": [{"source": "1K/", "destination": ""}], "flags": []},
                    {"name": "512 Textures", "description": "512×512 resolution (performance).", "image": "", "files": [{"source": "512/", "destination": ""}], "flags": []},
                ],
            }
        ],
        "conditions": [],
    },
    {
        "id": "body_type",
        "name": "Body Type Selector",
        "description": "Choose CBBE, AWKCR, or Vanilla body meshes.",
        "mod_name": "My Armor Mod",
        "author": "Author",
        "version": "1.0.0",
        "description": "Body type compatibility selector.",
        "nexus_id": "",
        "required_files": [],
        "groups": [
            {
                "name": "Body Type",
                "type": "SelectExactlyOne",
                "plugins": [
                    {"name": "CBBE", "description": "Caliente's Beautiful Bodies Enhancer.", "image": "", "files": [{"source": "CBBE/", "destination": ""}], "flags": []},
                    {"name": "Vanilla", "description": "Vanilla body meshes.", "image": "", "files": [{"source": "Vanilla/", "destination": ""}], "flags": []},
                ],
            }
        ],
        "conditions": [],
    },
]


def _indent_xml(elem: ET.Element, level: int = 0) -> None:
    pad = "\n" + "  " * level
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = pad + "  "
        if not elem.tail or not elem.tail.strip():
            elem.tail = pad
        for child in elem:
            _indent_xml(child, level + 1)
        if not child.tail or not child.tail.strip():
            child.tail = pad
    else:
        if level and (not elem.tail or not elem.tail.strip()):
            elem.tail = pad


def _build_module_config(data: dict) -> str:
    root = ET.Element("config", {
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xsi:noNamespaceSchemaLocation": "http://qconsulting.ca/fo3/ModConfig5.0.xsd",
    })

    mod_name_el = ET.SubElement(root, "moduleName")
    mod_name_el.text = data.get("name", "My Mod")

    # Module image (optional)
    image_path = data.get("image", "")
    if image_path:
        ET.SubElement(root, "moduleImage", {"path": image_path})

    # Required files
    required_files = data.get("required_files", [])
    if required_files:
        req_el = ET.SubElement(root, "requiredInstallFiles")
        for f in required_files:
            ET.SubElement(req_el, "folder", {
                "source": f.get("source", ""),
                "destination": f.get("destination", ""),
            })

    # Install steps
    groups = data.get("groups", [])
    if groups:
        steps_el = ET.SubElement(root, "installSteps", {"order": "Explicit"})
        step_el = ET.SubElement(steps_el, "installStep", {"name": "Options"})
        opt_groups_el = ET.SubElement(step_el, "optionalFileGroups", {"order": "Explicit"})

        for group in groups:
            group_el = ET.SubElement(opt_groups_el, "group", {
                "name": group.get("name", "Group"),
                "type": group.get("type", "SelectAtLeastOne"),
            })
            plugins_el = ET.SubElement(group_el, "plugins", {"order": "Explicit"})

            for plugin in group.get("plugins", []):
                plugin_el = ET.SubElement(plugins_el, "plugin", {"name": plugin.get("name", "Option")})
                desc_el = ET.SubElement(plugin_el, "description")
                desc_el.text = plugin.get("description", "")

                img = plugin.get("image", "")
                if img:
                    ET.SubElement(plugin_el, "image", {"path": img})

                files_el = ET.SubElement(plugin_el, "files")
                for f in plugin.get("files", []):
                    ET.SubElement(files_el, "folder", {
                        "source": f.get("source", ""),
                        "destination": f.get("destination", ""),
                        "priority": "0",
                    })

                flags = plugin.get("flags", [])
                if flags:
                    cond_flags_el = ET.SubElement(plugin_el, "conditionFlags")
                    for flag in flags:
                        flag_el = ET.SubElement(cond_flags_el, "flag", {"name": flag.get("name", "")})
                        flag_el.text = flag.get("value", "true")

                type_desc_el = ET.SubElement(plugin_el, "typeDescriptor")
                ET.SubElement(type_desc_el, "type", {"name": "Optional"})

    _indent_xml(root)
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")


def _build_info_xml(data: dict) -> str:
    root = ET.Element("fomod")
    ET.SubElement(root, "Name").text = data.get("name", "My Mod")
    ET.SubElement(root, "Author").text = data.get("author", "Author")
    ET.SubElement(root, "Version").text = data.get("version", "1.0.0")
    ET.SubElement(root, "Description").text = data.get("description", "")
    nexus_id = data.get("nexus_id", "")
    if nexus_id:
        ET.SubElement(root, "Id").text = str(nexus_id)
        ET.SubElement(root, "Website").text = f"https://www.nexusmods.com/fallout4/mods/{nexus_id}"
    _indent_xml(root)
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")


def _parse_module_config(xml_str: str) -> dict:
    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError as e:
        return {"error": str(e)}

    result: dict = {"name": "", "groups": [], "required_files": [], "conditions": []}

    name_el = root.find("moduleName")
    if name_el is not None:
        result["name"] = name_el.text or ""

    req_el = root.find("requiredInstallFiles")
    if req_el is not None:
        for f in req_el.findall("folder"):
            result["required_files"].append({
                "source": f.get("source", ""),
                "destination": f.get("destination", ""),
            })

    for step in root.findall(".//installStep"):
        for group_el in step.findall(".//group"):
            group = {
                "name": group_el.get("name", ""),
                "type": group_el.get("type", "SelectAtLeastOne"),
                "plugins": [],
            }
            for plugin_el in group_el.findall(".//plugin"):
                plugin: dict = {
                    "name": plugin_el.get("name", ""),
                    "description": "",
                    "image": "",
                    "files": [],
                    "flags": [],
                }
                desc = plugin_el.find("description")
                if desc is not None:
                    plugin["description"] = desc.text or ""
                img = plugin_el.find("image")
                if img is not None:
                    plugin["image"] = img.get("path", "")
                for f in plugin_el.findall(".//folder"):
                    plugin["files"].append({
                        "source": f.get("source", ""),
                        "destination": f.get("destination", ""),
                    })
                for flag in plugin_el.findall(".//flag"):
                    plugin["flags"].append({
                        "name": flag.get("name", ""),
                        "value": flag.text or "true",
                    })
                group["plugins"].append(plugin)
            result["groups"].append(group)

    return result


def _validate_fomod(xml_str: str) -> dict:
    errors = []
    warnings = []

    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError as e:
        return {"valid": False, "errors": [f"XML parse error: {e}"], "warnings": []}

    if root.find("moduleName") is None:
        errors.append("Missing required element: <moduleName>")

    has_steps = root.find(".//installSteps") is not None
    has_opt_groups = root.find(".//optionalFileGroups") is not None
    if not has_steps and not has_opt_groups and root.find("requiredInstallFiles") is None:
        warnings.append("No installSteps, optionalFileGroups, or requiredInstallFiles found — mod will install nothing.")

    for plugin_el in root.findall(".//plugin"):
        if plugin_el.find("typeDescriptor") is None:
            warnings.append(f"Plugin '{plugin_el.get('name', '?')}' missing <typeDescriptor>")

    return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}


def _ai_suggest(description: str, mod_files: List[str]) -> dict:
    """Rule-based FOMOD structure suggestion from description and file list."""
    groups = []

    # Detect texture quality variants
    tex_variants = {"2k": [], "4k": [], "1k": [], "512": []}
    for f in mod_files:
        fl = f.lower()
        for key in tex_variants:
            if key in fl:
                tex_variants[key].append(f)

    quality_options = [(k, v) for k, v in tex_variants.items() if v]
    if len(quality_options) >= 2:
        groups.append({
            "name": "Texture Resolution",
            "type": "SelectExactlyOne",
            "plugins": [
                {"name": k.upper(), "description": f"{k.upper()} textures", "image": "", "files": [{"source": k + "/", "destination": ""}], "flags": []}
                for k, _ in quality_options
            ],
        })

    # Detect ENB presets
    enb_files = [f for f in mod_files if "enb" in f.lower()]
    if enb_files:
        groups.append({
            "name": "ENB Preset",
            "type": "SelectExactlyOne",
            "plugins": [
                {"name": "Include ENB Files", "description": "Install ENB preset files.", "image": "", "files": [{"source": "ENB/", "destination": ""}], "flags": []},
                {"name": "Skip ENB Files", "description": "Do not install ENB files.", "image": "", "files": [], "flags": []},
            ],
        })

    required = [f for f in mod_files if "core" in f.lower() or "main" in f.lower() or "required" in f.lower()]

    return {
        "name": "My Mod",
        "author": "Author",
        "version": "1.0.0",
        "description": description,
        "nexus_id": "",
        "required_files": [{"source": r, "destination": ""} for r in required[:5]],
        "groups": groups,
        "conditions": [],
        "ai_notes": "Structure auto-generated from file list analysis. Review and adjust before publishing.",
    }


# ── Request Models ─────────────────────────────────────────────────────────

class CreateInstallerRequest(BaseModel):
    name: str
    author: str = "Author"
    version: str = "1.0.0"
    description: str = ""
    nexus_id: str = ""
    groups: List[Any] = []
    conditions: List[Any] = []
    required_files: List[Any] = []
    image: str = ""


class ValidateRequest(BaseModel):
    module_config_xml: str


class ParseRequest(BaseModel):
    module_config_xml: str


class AiGenerateRequest(BaseModel):
    description: str
    mod_files: List[str] = []


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "fomod", "fomod_spec_version": FOMOD_SPEC_VERSION, "lxml_available": HAS_LXML}


@app.post("/create-installer")
def create_installer(req: CreateInstallerRequest):
    data = req.dict()
    module_config_xml = _build_module_config(data)
    info_xml = _build_info_xml(data)
    return {"status": "ok", "module_config_xml": module_config_xml, "info_xml": info_xml}


@app.post("/validate")
def validate(req: ValidateRequest):
    result = _validate_fomod(req.module_config_xml)
    return {"status": "ok", **result}


@app.post("/parse")
def parse(req: ParseRequest):
    result = _parse_module_config(req.module_config_xml)
    if "error" in result:
        return {"status": "error", "message": result["error"]}
    return {"status": "ok", **result}


@app.get("/templates")
def templates():
    return {"status": "ok", "templates": TEMPLATES}


@app.post("/ai-generate")
def ai_generate(req: AiGenerateRequest):
    result = _ai_suggest(req.description, req.mod_files)
    return {"status": "ok", **result}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8015)
