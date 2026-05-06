"""
Fallout 4 Modding Knowledge Base Bootstrap
Initialize the shared knowledge base with expert Fallout 4 modding knowledge.
Expanded to 50+ topics covering: Fallout 4 modding, PC hardware/GPU, Mossy
architecture, and user-profile entries.  Re-running this script is safe —
duplicate topics are simply overwritten in the vector store.
"""

import requests
import json
from typing import List

# Port for multi-agent service
AGENT_COLLAB_SERVICE = "http://localhost:8004"

# ---------------------------------------------------------------------------
# SECTION 1 — Fallout 4 Modding (expanded from 8 → 42 topics)
# ---------------------------------------------------------------------------
FALLOUT4_KNOWLEDGE: List[dict] = [
    {
        "topic": "Mod Load Order Basics",
        "content": """
Load order determines which mods override others. Two critical rules:
1. Masters (ESM) load first, plugins (ESP) load after.
2. Last loaded file wins conflicts — put patches/compatibility mods last.

Use LOOT (Load Order Optimisation Tool) for automatic sorting.
Dependencies must load BEFORE dependent mods.
Plugin limit: 254 active ESP/ESM before game crashes.  ESL-flagged plugins
don't count against this limit (up to 4096 ESLs allowed).
        """,
        "tags": ["load-order", "basics", "critical"],
        "confidence": 0.95,
    },
    {
        "topic": "FOMOD Installation",
        "content": """
FOMOD (Fallout MOD) installers provide guided installation with options.
Installation steps:
1. Select package version (main/optional patches).
2. Choose variant (body/armor/weapon textures).
3. Optional features (extra mods, patches).
4. Complete installation.

Always read installer screenshots — they guide complex setups.
Some mods have mutually-exclusive options; choose only one.
MO2 and Vortex both support FOMOD natively.
        """,
        "tags": ["installation", "fomod", "packaging"],
        "confidence": 0.92,
    },
    {
        "topic": "Texture Quality vs Performance",
        "content": """
Fallout 4 is VRAM-intensive. Balance quality vs frame rate:

Resolution Guidelines:
- 4K textures (4096×4096): 8 GB+ VRAM only.
- 2K textures (2048×2048): 4–6 GB VRAM recommended.
- 1K textures (1024×1024): 2–4 GB VRAM, stable 60 FPS.
- 512px textures: Low-end systems, light mods only.

Tools:
- CAO (Cathedral Assets Optimizer): Compress and resize textures losslessly.
- ScanCross: Find broken texture references.
- NifTools / NifSkope: Preview and edit mesh+texture combinations.

Pro tip: Mix resolutions — 2K for player-visible objects, 1K for distant/NPCs.
        """,
        "tags": ["textures", "performance", "vram", "optimization"],
        "confidence": 0.88,
    },
    {
        "topic": "Merging and Batching Plugins",
        "content": """
Reduce active ESP count (max 254) by merging or converting to ESL:

ESL Conversion (easiest):
1. Open plugin in FO4Edit.
2. Check ESL flag in File Header record.
3. Validate: no Form IDs above 0xFFF (ESL limit).
4. Save — plugin no longer counts against 254 limit.

Merge Strategy (zMerge / zEdit):
1. Identify 'mergeable' plugins (no scripts, no master edits).
2. Use zEdit's zMerge plugin to combine multiple ESPs into one.
3. Merged plugin inherits all records; originals deactivated.

Caution: Don't merge mods that contain scripts or have external masters
unless you know exactly what you're doing.
        """,
        "tags": ["advanced", "optimization", "plugin-management", "esl"],
        "confidence": 0.85,
    },
    {
        "topic": "Conflict Resolution",
        "content": """
Common Fallout 4 conflicts and solutions:

Navigation Mesh (Navmesh) Conflicts:
- Cause: Multiple mods edit the same cell navmesh.
- Fix: Prioritize one mod, delete the navmesh edit from the other, or use a
  dedicated navmesh patch.
- Check: FO4Edit > right-click record > Apply Filter > modified navmeshes.

Texture Conflicts:
- Layer order: Base texture > Weather > ENB > Effects (last wins).
- Tool: FO4Edit > Search > Texture Sets.

Script Conflicts:
- Multiple mods modifying the same quest or actor script.
- Fix: Create a compatibility patch in Creation Kit or FO4Edit.

Master Record (REFR/NPC_) Conflicts:
- Different mods alter the same base form ID.
- Fix: Create a compatibility patch that carries the winning values.
        """,
        "tags": ["troubleshooting", "conflicts", "resolution"],
        "confidence": 0.90,
    },
    {
        "topic": "Custom Patches & Compatibility",
        "content": """
Create compatibility patches between conflicting mods:

Creation Kit Method:
1. Load base game + both conflicting mods as active plugins.
2. Find conflicts in the record view (highlighted in red/orange).
3. Make compatible edits (merge values, keep both changes).
4. Save as a new ESP that lists all three as masters.
5. Load patch LAST in load order.

FO4Edit Method (faster for record-level conflicts):
1. Open FO4Edit with conflicting mods loaded.
2. Right-click the conflicting record > Copy as override into new file.
3. In the patch: apply winning values from each mod intelligently.
4. Save with correct master references.

Golden Rules:
- Always test patches in-game (use quicksave before testing).
- Describe which mods the patch is for in the plugin description field.
- Load the patch after ALL mods it patches.
        """,
        "tags": ["patches", "compatibility", "fo4edit", "creation-kit"],
        "confidence": 0.87,
    },
    {
        "topic": "ENB & Shader Mods",
        "content": """
ENB (Enhanced Natural Beauty) overhauls Fallout 4 lighting and post-processing.

Compatibility:
- ENB version: 0.496+ for Fallout 4 (always use the latest binary).
- Load: After weather mods; ENB reads weather records at runtime.
- Performance cost: −10 to −30 FPS typical.

Installation:
1. Download ENB binaries (enbdev.com) + a preset (Nexus).
2. Copy d3d11.dll and d3dcompiler_46e.dll to Fallout4 root folder.
3. Install preset data folder via MO2.
4. Edit enblocal.ini:
   - VideoMemorySizeMb = <your VRAM in MB>
   - EnableVSync=false (use RTSS or driver-level vsync instead).

Common Issues:
- Black screen: Outdated ENB binary — update to latest.
- Flickering: Conflict with FXAA/TAA shaders; disable in Fallout4Prefs.ini.
- Low FPS: Lower SubSurfaceScattering and AmbientOcclusion quality.

Reshade alternative: Lighter performance hit, simpler setup, no injector.
        """,
        "tags": ["graphics", "enb", "visual-enhancement", "reshade"],
        "confidence": 0.84,
    },
    {
        "topic": "Script Lag & Optimization",
        "content": """
Fallout 4 Papyrus scripts can cause severe stutter and lag.

Identifying Script Lag:
- Enable Papyrus logging in Fallout4Custom.ini:
  [Papyrus]
  bEnableLogging=1
  bEnableTrace=1
  bLoadDebugInformation=1
- Open logs/papyrus.0.log and look for "overloaded" messages.
- Console command: clk (toggle script lag monitor in some frameworks).

Common Causes:
1. OnUpdate() or RegisterForUpdate() events firing every frame.
2. Infinite loops caused by bad condition checks.
3. Too many persistent actors in one cell.
4. Uncleaned deleted references (ITMs / UDRs).

Fixes:
- Use Script Lag Monitor Framework mod.
- Remove or disable script-heavy companion/follower AI mods.
- Run FO4Edit > apply filter for ITMs and delete undeleted references.
- Clean official Bethesda master files with FO4Edit QuickAutoClean.
        """,
        "tags": ["optimization", "scripting", "papyrus", "performance"],
        "confidence": 0.82,
    },

    # ── New topics from here ──────────────────────────────────────────────
    {
        "topic": "Creation Kit Scripting (Papyrus Basics)",
        "content": """
Papyrus is Fallout 4's scripting language. Scripts attach to quests, actors,
items, and world objects.

Key Concepts:
- Every script extends a base type (ObjectReference, Actor, Quest…).
- Events (OnInit, OnActivate, OnEquipped) fire automatically.
- Functions can be native (C++ engine) or user-defined.
- Conditional blocks use if/elseif/endif syntax.
- No direct memory access; data lives in properties linked in the CK.

Workflow:
1. Create a new script in the Creation Kit Script Editor.
2. Define properties (ObjectReference, Actor, Int, String…).
3. Implement event handlers.
4. Compile with F7 — errors show in the Output window.
5. Attach script to a form (NPC, container, activator) via its Properties panel.

Performance Tips:
- Avoid RegisterForUpdate intervals shorter than 5 seconds.
- Prefer OnTriggerEnter over polling OnUpdate for location detection.
- Use Utility.WaitMenuMode(0.5) inside loops to yield to the engine.
        """,
        "tags": ["papyrus", "scripting", "creation-kit", "programming"],
        "confidence": 0.91,
    },
    {
        "topic": "FO4Edit Record Types Deep Dive",
        "content": """
FO4Edit (xEdit) displays every record type in the game's plugins.

Critical Record Types:
- NPC_  : Actor definition (stats, AI packages, inventory, appearance).
- REFR  : Placed reference of a form in the world.
- CELL  : Interior/exterior cell definition.
- WRLD  : Worldspace (Commonwealth, Far Harbor…).
- WEAP  : Weapon form (damage, sounds, keywords, mod slots).
- ARMO  : Armour/clothing item.
- MGEF  : Magic effect (perks, chems, radiation effects).
- PERK  : Perk definition (condition + entry point pairs).
- QUST  : Quest stages, objectives, conditions.
- DIAL  / INFO: Dialogue topics and responses.
- SCEN  : Scene controlling NPC conversations.
- TXST  : Texture Set (diffuse, normal, specular paths).
- STAT  : Static mesh object.
- FLOR  : Activatable plant/flora object.
- MISC  : Miscellaneous item (junk, component source).

Viewing Conflicts:
- Run FO4Edit, select all plugins, let it load.
- Conflicting records shown in red/orange in left panel.
- Right column = winning override (bottom of load order).
        """,
        "tags": ["fo4edit", "record-types", "modding-tools", "technical"],
        "confidence": 0.90,
    },
    {
        "topic": "NIF Mesh Editing with NifSkope",
        "content": """
NIF (NetImmerse File) is the 3D mesh format used by Fallout 4.

NifSkope Basics:
- Open .nif file; tree on left = node hierarchy.
- BSGeometry / NiTriShape = mesh geometry node.
- BSLightingShaderProperty = material (links to texture set).
- NiAlphaProperty = transparency settings.

Common Edits:
1. Swap texture: Expand BSLightingShaderProperty > BSShaderTextureSet,
   right-click texture path > Edit String, paste new path.
2. Change material flag: BSLightingShaderProperty > Shader Flags 1/2.
3. Adjust collision: bhkNiTriStripsShape defines physics collision mesh.
4. Remove/hide parts: Select node > right-click > Block > Remove.

Blender Workflow for Full Edits:
1. Export NIF via Blender NIF Plugin (GitHub: niftools/blender-niftools-addon).
2. Edit mesh in Blender.
3. Re-export back to NIF.
4. Optimise with CAO (Cathedral Assets Optimizer) after export.

Always back up originals in a separate folder before editing.
        """,
        "tags": ["nif", "meshes", "nifskope", "3d-modeling", "blender"],
        "confidence": 0.86,
    },
    {
        "topic": "BA2 Archive Format",
        "content": """
BA2 (Bethesda Archive 2) is Fallout 4's packed asset container.

Types:
- GNRL (General): meshes, scripts, sounds, misc data.
- DX10 (Texture): compressed DDS textures with mip chains.

Why Use Archives:
- Loose files override BA2 archives (use loose files for testing).
- Archives load faster; bundle mods into BA2 for release.
- Required for console modding (loose files blocked on consoles).

Working with BA2:
- Unpack: Use BAE (Bethesda Archive Extractor) or Archive2.exe (CK tool).
- Repack: Archive2.exe via command line or BAE GUI.
- Inspect: BAE shows contents without extracting.

Fallout 4 NG (Next Gen Update):
- Uses zstd compression in GNRL archives (older BA2 tools may break).
- Use baka file tool (GitHub: nikita-gst/baka-file-tool) for NG-compatible BA2.
- Texture archives unchanged — DX10 format same as before.

Plugin Registration:
The plugin (.esp/.esm) must register its archive in the Archive field (FO4Edit
> File Header > Archive). Alternatively, add the archive name to the
[Archive] sResourceDataDirsFinal= line in Fallout4.ini.
        """,
        "tags": ["ba2", "archives", "file-formats", "packaging"],
        "confidence": 0.88,
    },
    {
        "topic": "F4SE Plugin Architecture",
        "content": """
F4SE (Fallout 4 Script Extender) enables C++ DLL plugins that hook into the
game engine for capabilities impossible in Papyrus alone.

How F4SE Works:
- f4se_loader.exe launches Fallout4.exe and injects f4se_1_10_xxx.dll.
- Plugin DLLs placed in Data/F4SE/Plugins/ are loaded automatically.
- Plugins register with F4SE using F4SEPlugin_Load() export.

Writing an F4SE Plugin:
1. Set up Visual Studio project with CommonLibF4 (OpenSource F4SE SDK).
2. Implement F4SEPlugin_Load(const F4SE::LoadInterface*).
3. Register for messaging (PostLoad, PostLoadGame) if needed.
4. Hook engine functions with REL::Relocation or trampoline patches.
5. Compile as x64 Release DLL.

Common F4SE Plugin Features:
- New Papyrus native functions (registered in messaging callback).
- INI-based configuration files (read via GetRuntimeDirectory).
- MCM (Mod Configuration Menu) integration via F4SE MCM framework.
- Save/load callback for storing extra data in cosave files.

Requirements:
- Exact F4SE version must match game version (check f4se.silverlock.org).
- Update announcements on Nexus when game patches break F4SE.
        """,
        "tags": ["f4se", "plugins", "c++", "advanced", "engine-hooks"],
        "confidence": 0.89,
    },
    {
        "topic": "LOOT Metadata & Masterlist Rules",
        "content": """
LOOT (Load Order Optimisation Tool) uses a masterlist of YAML rules to sort
plugins automatically.

How LOOT Sorts:
1. Reads plugin masters (hard dependencies always load first).
2. Applies masterlist group rules (Vanilla → Default → Late Loaders…).
3. Applies user metadata rules (higher priority than masterlist).
4. Runs a topological sort; warns about conflicts.

Writing Metadata:
```yaml
  - name: 'MyPatch.esp'
    after:
      - 'ModA.esp'
      - 'ModB.esp'
    req:
      - name: 'ModA.esp'
        display: 'Mod A (required by MyPatch)'
    msg:
      - type: warn
        content: 'Load after Mod A and Mod B.'
```

Common LOOT Warnings:
- Dirty edits (ITMs/UDRs): Clean with FO4Edit QuickAutoClean.
- Missing masters: Plugin references an ESM/ESP that isn't installed.
- Incompatible: Two mods known to break each other.

User Rules override masterlist — useful for mods LOOT doesn't know about.
        """,
        "tags": ["loot", "load-order", "masterlist", "sorting"],
        "confidence": 0.87,
    },
    {
        "topic": "MO2 (Mod Organizer 2) Setup & Best Practices",
        "content": """
MO2 is the gold-standard mod manager for Fallout 4 on PC.

Key Features:
- Virtual File System (VFS): mods never touch the real game folder.
- Profile system: Multiple mod configurations per game installation.
- Conflict highlighting: Shows which mod wins each file.
- INI management: Separate INIs per profile.

Setup:
1. Install MO2 outside the game folder (e.g., D:\\MO2).
2. Create a new instance for Fallout 4.
3. Set game path to Fallout4.exe location.
4. Set download path to a fast drive (SSD preferred).

Best Practices:
- Always launch game through MO2 (or a shortcut that goes through MO2).
- Separate plugins into categories: DLC / Overhauls / Gameplay / Patches.
- Use Separator mods (Nexus Separator) to visually group mods in the list.
- Back up profiles folder before making major changes.
- Never install mods directly into the game Data folder when using MO2.

Conflict Resolution in MO2:
- Left panel order = file priority (bottom wins).
- Right panel (plugins) order = load order.
- Click the orange lightning bolt on a mod to see file conflicts.
        """,
        "tags": ["mo2", "mod-manager", "vortex", "setup", "workflow"],
        "confidence": 0.94,
    },
    {
        "topic": "Cleaning Master Files with FO4Edit",
        "content": """
Bethesda's official master files contain dirty edits (ITMs and UDRs) that
can cause bugs.  Cleaning them is strongly recommended.

Dirty Edit Types:
- ITM (Identical To Master): Record present in plugin with no changes.
  Wastes space and causes false conflicts.
- UDR (Undeleted and Disabled Reference): Deleted REFR replaced with a
  disabled reference — can cause script errors and navmesh issues.

Cleaning Procedure (FO4Edit QuickAutoClean):
1. Right-click FO4Edit.exe > Create shortcut.
2. Add -quickautoclean to shortcut target after the exe path.
3. Double-click shortcut; select only ONE master file to clean.
4. Wait for it to finish; it auto-saves a cleaned copy.
5. Repeat for each DLC/master file separately.

Files to clean (vanilla FO4):
- Fallout4.esm (minimal dirty edits)
- DLCRobot.esm, DLCworkshop01/02/03.esm
- DLCCoast.esm, DLCNukaWorld.esm

DO NOT clean:
- Update.esm (intentional overrides)
- Third-party ESMs unless the mod author explicitly says to.
        """,
        "tags": ["fo4edit", "cleaning", "itm", "udr", "master-files"],
        "confidence": 0.92,
    },
    {
        "topic": "xEdit Patching Patterns",
        "content": """
Common patching patterns using FO4Edit (xEdit):

Pattern 1 — Forwarding a value from a later mod into a patch:
1. Select the record in the patch plugin column.
2. Drag-and-drop the winning value from the source mod's column into the patch.
3. The patch now carries that value regardless of load order.

Pattern 2 — Merging two NPC appearance edits:
1. Copy the NPC record as override into a new patch plugin.
2. From Mod A's column, copy face-related subrecords (TPLT, DEST, etc.).
3. From Mod B's column, copy stat/inventory subrecords.
4. Result: Patch carries best of both mods.

Pattern 3 — Injecting a new keyword into an item:
1. Open the WEAP or ARMO record.
2. Right-click Keywords array > Add.
3. Select the keyword form ID from its source plugin.
4. Save patch with source plugin as a master.

Pattern 4 — Conditional levelled list patching:
1. Open LVLI (Levelled Item List) shared by multiple mods.
2. In the patch, manually add all entries from all conflicting mods.
3. Adjust Level/Count/ChanceNone as needed.
4. Load patch last.
        """,
        "tags": ["fo4edit", "patching", "records", "advanced"],
        "confidence": 0.88,
    },
    {
        "topic": "Papyrus Scripting Patterns",
        "content": """
Proven Papyrus script patterns for mod authors:

Pattern: Safe Delayed Execution
```papyrus
Event OnInit()
    RegisterForSingleUpdate(2.0)  ; Wait 2s for all mods to initialise
EndEvent
Event OnUpdate()
    ; Your actual startup code here
EndEvent
```

Pattern: Actor location detection (no polling)
```papyrus
Event OnLocationChange(Location akOldLoc, Location akNewLoc)
    If akNewLoc == MyTargetLocation
        DoSomething()
    EndIf
EndEvent
```

Pattern: Thread-safe quest alias fill
```papyrus
Function FillAliases() Global
    Quest q = Game.GetFormFromFile(0x000AAA, "MyMod.esp") as Quest
    If q
        q.Start()
    EndIf
EndFunction
```

Pattern: Persistent reference handle (avoid None refs)
```papyrus
ObjectReference Property MyRef Auto
Event OnInit()
    If MyRef == None
        Debug.Notification("ERROR: MyRef property not set!")
        Return
    EndIf
EndEvent
```

Anti-patterns to avoid:
- While True / Utility.Wait loops: use RegisterForUpdate instead.
- Calling expensive native functions every frame.
- Storing Actor references directly (use ActorBase or FormID instead).
        """,
        "tags": ["papyrus", "scripting", "patterns", "best-practices"],
        "confidence": 0.90,
    },
    {
        "topic": "Fallout 4 INI Configuration",
        "content": """
Fallout 4 reads three INI files in order (later overrides earlier):
1. Fallout4.ini    (base config, in My Games\\Fallout4)
2. Fallout4Prefs.ini (graphics prefs, written by launcher)
3. Fallout4Custom.ini (user overrides — create this if missing)

NEVER edit Fallout4.ini or Fallout4Prefs.ini directly — put all custom
settings in Fallout4Custom.ini.

Essential Custom Settings:
```ini
[Archive]
bInvalidateOlderFiles=1
sResourceDataDirsFinal=

[Display]
bBorderless=1
bFullScreen=0

[Papyrus]
bEnableLogging=1
bEnableTrace=1
bLoadDebugInformation=1

[Controls]
fMouseHeadingSensitivity=0.0400
```

With MO2: Each profile has its own INI files in
Mod Organizer 2\\profiles\\<ProfileName>\\  — always edit those, not the
My Games ones, when MO2 is managing INIs.
        """,
        "tags": ["ini", "configuration", "fallout4custom", "settings"],
        "confidence": 0.93,
    },
    {
        "topic": "Settlement Building Mod Compatibility",
        "content": """
Settlement mods frequently conflict because they all edit workshop cells.

Common Culprits:
- Sim Settlements 2 (heavily scripts workshops).
- Scrap Everything (modifies cell references).
- Workshop Framework (overrides workshop scripts).
- Place Everywhere (client-side, usually safe).

Compatibility Rules:
1. Scrap Everything must load AFTER Sim Settlements 2 to avoid missing object crashes.
2. Workshop Framework should load before gameplay mods that depend on it.
3. Settlement mods that add build items via crafting keywords are generally safe together.
4. Avoid combining Scrap Everything + Spring Cleaning — they duplicate functionality.

Troubleshooting Settlement Crashes:
- Crash on entering settlement → navmesh conflict (check with FO4Edit).
- Missing NPCs → alias conflict in WorkshopParent quest.
- Workbench not responding → Workshop script conflict; check papyrus.log.
        """,
        "tags": ["settlements", "workshop", "compatibility", "sim-settlements"],
        "confidence": 0.85,
    },
    {
        "topic": "Companion Mod Conflicts",
        "content": """
Companion mods (Heather Casdin, Ellen The Cartographer, etc.) follow similar
patterns and have common conflict points.

Architecture:
- Custom follower quest with alias pointing to the companion NPC.
- Uses AFT (Amazing Follower Tweaks) or EFF framework for commands — load
  framework mod BEFORE companion mods.
- Often conflict with other mods that modify the same vanilla companion quest
  (CompanionDogmeat, CompanionPiper, etc.).

Common Issues:
- Companion disappears: Check alias fill conditions in FO4Edit.
- No dialogue: Dialogue form IDs may conflict with another mod's DIAL records.
- Stuck AI: Companion package stack conflict; check AI Package list in NPC_.

Safe Practices:
- Install only ONE companion framework (AFT or EFF, not both).
- Load companion mods AFTER their framework.
- Use FO4Edit to check that the companion's quest aliases don't overlap with
  vanilla companion quests.
        """,
        "tags": ["companions", "followers", "npc", "compatibility"],
        "confidence": 0.83,
    },
    {
        "topic": "Weapon Mod Conflicts (AWKCR / Standalone Weapons)",
        "content": """
Weapon mods conflict when multiple mods edit the same base weapon records
or keyword arrays.

AWKCR (Armor and Weapon Keywords Community Resource):
- Provides shared keywords for crafting conditions.
- Must load before all mods that depend on it.
- Conflicts with Standalone weapons that define their own keyword lists.
- Alternative: Keyword Item Distributor (KID) — inject keywords without
  requiring all mods to share a master.

Common Weapon Conflict Patterns:
1. Levelled list conflicts (LVLI): Two mods both add weapons to the same
   vendor/enemy levelled list → patch with combined entries.
2. Crafting recipe conflicts (COBJ): Two mods add recipes for the same workbench
   condition → safe to keep both if condition keywords differ.
3. Sound descriptor conflicts: Two mods change WPN_xxx sounds → load whichever
   you prefer last (no patch needed unless both changes matter).

Standalone Weapon Best Practice:
- Use a unique keyword on standalone weapons.
- Avoid editing vanilla weapons unless that's the mod's explicit purpose.
- Include a bash/smash patch note in the mod description.
        """,
        "tags": ["weapons", "awkcr", "keywords", "levelled-lists"],
        "confidence": 0.84,
    },
    {
        "topic": "Performance Mods & Tweaks",
        "content": """
Recommended performance mods and config tweaks for Fallout 4:

Mods:
- Buffout 4 (Crash Logger + engine bug fixes — ESSENTIAL).
- Boston FPS Fix (patches precombines in Boston to eliminate the biggest
  FPS killer in the game).
- Previs Repair Pack (alternative/complementary to Boston FPS Fix).
- FAR — Faraway Area Reform (reduces object LOD draw distance intelligently).
- Insignificant Object Remover (removes tiny ground clutter).
- PRP — Previsibines Repair Pack.

Config Tweaks (Fallout4Custom.ini):
```ini
[General]
uExterior Cell Buffer=64
[Display]
fShadowBiasScale=0.5000
iShadowMapResolutionPrimary=2048
iShadowMapResolutionSecondary=2048
fDecalLifetime=10.0000
```

GPU Driver Settings (NVIDIA):
- Power Management: Prefer Maximum Performance.
- Shader Cache: Enable.
- Threaded Optimization: Auto.
- Anisotropic Filtering: 16x (override in driver, disable in game).

NEVER use: Texture Optimization Project if already using high-res texture packs
(they conflict and produce seams).
        """,
        "tags": ["performance", "fps", "optimization", "buffout4", "boston"],
        "confidence": 0.91,
    },
    {
        "topic": "Precombines & Previs — What They Are and Why They Matter",
        "content": """
Precombines and previs are Bethesda's baked static mesh and visibility data.

Precombines:
- Static objects in a cell are baked into combined meshes at build time.
- Result: 10–60x fewer draw calls → massive FPS improvement in cities.
- ANY mod that adds/moves/removes a static object in a cell breaks the
  precombined mesh for that cell, forcing individual draws → FPS drop.

Previs (Precomputed Visibility):
- Which cells are visible from which other cells; baked at build time.
- Broken previs = extra cells rendered = more GPU work.

Mods That Break Precombines:
- Scrap Everything (scraps precombined objects).
- Any mod that moves/adds clutter to exterior cells.
- Workshop mods that modify cell references.

Solutions:
1. Boston FPS Fix — patches the worst Boston cells.
2. Previs Repair Pack (PRP) — broad repair of precombines across the map.
3. Build your own previs/precombines using the Creation Kit console commands
   (CreateCombinedObjects + GeneratePrevisibines) — takes hours but is exact.
4. Use mods that respect precombines (add objects in a new cell layer).
        """,
        "tags": ["precombines", "previs", "fps", "boston", "performance"],
        "confidence": 0.89,
    },
    {
        "topic": "Buffout 4 Crash Logger — Reading Crash Logs",
        "content": """
Buffout 4 generates detailed crash logs in Documents\\My Games\\Fallout4\\F4SE\\.

Log Structure:
1. Unhandled exception line — contains the exception code and call address.
2. CALL STACK — most relevant; top frame is usually where it crashed.
3. REGISTERS — CPU register state at crash; often contains the offending pointer.
4. STACK — raw stack dump.
5. MODULES — list of all loaded DLLs with base addresses.

Common Exception Codes:
- 0xC0000005 (Access Violation): Bad pointer — often a None object reference.
- 0xC000001D (Illegal Instruction): DLL compiled for wrong instruction set.
- 0x40000015 (Heap Corruption): Memory corruption — usually a mod DLL bug.

Reading the Call Stack:
- Find the highest Fallout4.exe frame — that's the engine function that crashed.
- Look for F4SE plugin DLL frames above it — that DLL is likely the culprit.
- Cross-reference addresses with Buffout4's address library database.

Common Fixes:
- Access violation in WorkshopScript: Precombine conflict or missing mod.
- Crash loading save: Missing master (check in FO4Edit).
- Random crash in Boston: Install Boston FPS Fix + PRP.
- Crash on cell transition: Navmesh conflict.
        """,
        "tags": ["buffout4", "crash-log", "debugging", "troubleshooting"],
        "confidence": 0.91,
    },
    {
        "topic": "Levelled List Patching (LVLI)",
        "content": """
Levelled Lists (LVLI) control what items/NPCs spawn at what level.
Multiple mods editing the same LVLI cause only the last mod's entries to appear.

Conflict Pattern:
- Mod A adds a new weapon to VendorChemsMed (levelled list).
- Mod B also adds a new chem to VendorChemsMed.
- Without a patch, only the last-loaded mod's addition appears.

Solutions:

1. Wrye Bash Bashed Patch (automatic):
   - Install Wrye Bash, check plugins in Bash, click Rebuild Patch.
   - Bash automatically merges LVLI entries from all mods.
   - Fastest solution; works for most cases.

2. Manual FO4Edit Patch:
   - Create a new plugin; copy LVLI record as override.
   - Add ALL entries from ALL conflicting mods to the single patch record.
   - Set patch as last in load order.

3. Keyword Item Distributor (KID):
   - Inject items into levelled lists via INI config — no plugin conflict.
   - Requires KID.dll (F4SE plugin) to be installed.
   - Best for new mods to use going forward.
        """,
        "tags": ["levelled-lists", "lvli", "wrye-bash", "patching"],
        "confidence": 0.90,
    },
    {
        "topic": "Sim Settlements 2 Setup Guide",
        "content": """
Sim Settlements 2 (SS2) is the most complex quest + settlement mod for FO4.

Load Order Requirements:
1. Workshop Framework (hard requirement — load before SS2).
2. Sim Settlements 2 — Chapter 1 core.
3. Sim Settlements 2 — Chapter 2 (requires Ch.1).
4. SS2 Extended (optional).
5. City Plans and Addon packs after core SS2.
6. Scrap Everything — load AFTER SS2 if used.

Common SS2 Issues:
- Jake not appearing: Verify Workshop Framework is installed and active;
  restart the quest via MCM if Jake vanishes.
- Low FPS in settlements: SS2 scripts are heavy; reduce settler count.
- City plan not building: Check that plot markers are enabled in MCM.
- Aborting city plan: NPCs may be sleeping; wait 24 in-game hours.

Compatibility Notes:
- SS2 is incompatible with mods that replace WorkshopParent quest script.
- Most companion mods are fine if their quests don't edit WorkshopParent.
- Heather Casdin and Ellen are both compatible.
        """,
        "tags": ["sim-settlements-2", "ss2", "quest-mods", "settlements"],
        "confidence": 0.86,
    },
    {
        "topic": "DLC Load Order Placement",
        "content": """
Official DLC ESMs must always load in a specific order relative to each other
and to mod plugins.

Correct DLC Load Order:
1. Fallout4.esm
2. DLCRobot.esm (Automatron)
3. DLCworkshop01.esm (Wasteland Workshop)
4. DLCCoast.esm (Far Harbor)
5. DLCworkshop02.esm (Contraptions Workshop)
6. DLCworkshop03.esm (Vault-Tec Workshop)
7. DLCNukaWorld.esm (Nuka-World)
8. [Your mods start here]

Why This Order Matters:
- DLCworkshop*.esm mods have DLCRobot.esm as a master.
- DLCCoast and DLCNukaWorld reference base game + earlier DLC records.
- Incorrect order → missing master error on game launch.

LOOT handles DLC ordering automatically.  If loading manually, follow the
list above exactly.
        """,
        "tags": ["dlc", "load-order", "masters", "esm"],
        "confidence": 0.95,
    },
    {
        "topic": "Armor Replacers & BodySlide Setup",
        "content": """
BodySlide allows armor and body mods to be reshaped for different body types.

Requirements:
- CBBE or BHUNP body mod (choose ONE body framework).
- BodySlide and Outfit Studio (Nexus tool).
- Armor mods that ship BodySlide files (.osp, .xml in CalienteTools\\).

Workflow:
1. Install body framework (e.g., CBBE).
2. Install BodySlide tool.
3. Install armor mods with BodySlide support.
4. Open BodySlide; select an Outfit/Body preset.
5. Click "Batch Build" → builds meshes for all installed outfits.
6. Tick "Build Morphs" if the mod uses morphs.

Common Issues:
- Invisible body parts: BodySlide outputs not built; run Batch Build.
- Seams at neck/hands: Mismatch between body and head/hand meshes.
  Fix: Use race menu overlays or ensure hands/head are from same body mod.
- Clipping: In Outfit Studio, move outfit sliders to match body shape.

Note: CBBE and BHUNP are not compatible — pick one and stick to it.
        """,
        "tags": ["bodyslide", "cbbe", "armor", "body-mods", "outfits"],
        "confidence": 0.84,
    },
    {
        "topic": "Voice Acting & New NPC Dialogue",
        "content": """
Adding voiced dialogue to a custom NPC requires audio files + lip sync data.

Workflow:
1. Write dialogue lines in the Creation Kit (DIAL/INFO records).
2. Export lip sync: CK > Character > Export Dialogue (generates .lip files).
3. Record audio or use AI TTS (xVASynth, ElevenLabs) to generate WAV files.
4. Convert WAV to XWM (Fallout's audio format):
   - Use xWMAEncode.exe (ships with DirectX SDK) or
   - Use Creation Kit's batch exporter.
5. Place audio files in Sound\\Voice\\MyMod.esp\\<VoiceType>\\
6. Rename to match the INFO record editor ID (e.g., 000A1B2C_1.xwm).
7. Test in game with the CK preview or by loading the save.

xVASynth Integration:
- xVASynth is an AI voice synthesis tool trained on Fallout 4 actor voices.
- Select voice model (e.g., Codsworth, Piper) and synthesise lines.
- Exports WAV + lip file automatically.
- Free to use; requires local GPU or CPU inference.
        """,
        "tags": ["dialogue", "voice-acting", "xvasynth", "npc", "audio"],
        "confidence": 0.83,
    },
    {
        "topic": "Fallout 4 Next Gen Update (NG) Compatibility",
        "content": """
The April 2024 Next Gen Update (version 1.10.984.0) added new content and
broke many F4SE-dependent mods.

Key Changes in NG:
- New engine version: requires matching F4SE version (f4se 0.7.x for NG).
- New BA2 archive format with zstd compression for GNRL archives.
- New textures in DLC cells (some mods that edited those cells now conflict).
- Address Library for F4SE updated to v2 format.

NG Compatibility Status (general):
- Most Papyrus mods: Compatible if F4SE and its plugins are updated.
- F4SE plugins (.dll): MUST be updated by their authors for NG.
  Check mod pages for "(NG)" tags or "Updated for NG" in changelogs.
- Buffout 4 NG version available (separate Nexus page).
- MCM (Mod Configuration Menu) has an NG-compatible release.

Downgrade Option:
Some users downgrade to pre-NG (1.10.163.0) for maximum mod compatibility:
- Use "Fallout 4 Downgrader" tool on Nexus.
- Only needed if a critical mod author won't update for NG.

Check xSE Plugin Preloader page for current NG-compatible plugin list.
        """,
        "tags": ["ng-update", "next-gen", "compatibility", "f4se", "version"],
        "confidence": 0.88,
    },
]

# ---------------------------------------------------------------------------
# SECTION 2 — General PC / Hardware Knowledge
# ---------------------------------------------------------------------------
PC_KNOWLEDGE: List[dict] = [
    {
        "topic": "GPU Driver Troubleshooting (NVIDIA)",
        "content": """
Common NVIDIA GPU driver issues and solutions:

Clean Install (DDU):
1. Download Display Driver Uninstaller (DDU) from Guru3D.
2. Boot into Safe Mode.
3. Run DDU > Clean and Restart.
4. Install fresh driver from nvidia.com.
Clean installs fix: black screens, game crashes after driver update, stuttering.

Common Issues:
- Error 43 in Device Manager: GPU not properly seated or power connector loose.
  Fix: Reseat GPU in PCIe slot; reconnect 8-pin/16-pin power cables.
- Driver crash during gameplay: Likely VRAM overflow or overclocked VRAM.
  Fix: Lower overclock, reduce texture quality settings.
- Low GPU utilisation: CPU bottleneck or game not configured for high GPU.
  Fix: Set power mode to High Performance; disable NVIDIA battery saver.

NVIDIA Control Panel Settings for Gaming:
- Image Sharpening: Off (use in-game AA instead).
- Ambient Occlusion: Off (use in-game AO).
- Anisotropic Filtering: 16x (application-controlled games handle this).
- Power Management Mode: Prefer Maximum Performance.
- Texture Filtering Quality: High Performance.

Monitoring:
- Use GPU-Z, HWiNFO64, or NVTOP to monitor VRAM usage, temperature, clock.
- Target temps: <83°C for gaming; >90°C indicates cooling issue.
        """,
        "tags": ["gpu", "nvidia", "driver", "ddu", "troubleshooting", "hardware"],
        "confidence": 0.90,
    },
    {
        "topic": "CUDA Installation & Version Management",
        "content": """
Multiple CUDA versions can coexist on one machine.

Installation:
1. Download from developer.nvidia.com/cuda-downloads.
2. Select "Custom" install; deselect Visual Studio Integration if not needed.
3. Default path: C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v12.x

Environment Variables (set via System Properties > Environment Variables):
- CUDA_PATH = C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v12.x
- CUDA_PATH_V12_x = same path (version-specific)
- PATH includes: %CUDA_PATH%\\bin and %CUDA_PATH%\\libnvvp

Multiple CUDA Versions:
- Install each version to its own folder.
- Switch active version by changing CUDA_PATH.
- PyTorch and TensorFlow pin to specific CUDA versions — check their docs.

Verification:
```
nvcc --version          # CUDA compiler version
nvidia-smi              # Driver + CUDA runtime version
python -c "import torch; print(torch.version.cuda)"  # PyTorch CUDA
```

Common Errors:
- "CUDA driver version insufficient for runtime version": Update GPU driver.
- "no kernel image is available": GPU compute capability too old for CUDA version.
- Import error in Python: CUDA DLLs not in PATH; check environment variables.
        """,
        "tags": ["cuda", "nvidia", "gpu", "python", "installation"],
        "confidence": 0.91,
    },
    {
        "topic": "VRAM Management for AI Workloads",
        "content": """
Managing VRAM when running multiple AI models simultaneously:

VRAM Usage by Model Size (fp16):
- 7B  parameter model:  ~14 GB fp16 / ~7 GB 4-bit quantised (GPTQ/AWQ).
- 13B parameter model:  ~26 GB fp16 / ~13 GB 4-bit.
- 27B parameter model:  ~54 GB fp16 / ~27 GB 4-bit.
- 70B parameter model:  Requires multiple GPUs or CPU offload.

Reducing VRAM Usage:
- Load in 4-bit (bitsandbytes): reduces 4× but adds slight quality loss.
- Unsloth 4-bit: 60% less VRAM vs standard transformers + faster.
- Flash Attention 2: Reduces attention VRAM from O(n²) to O(n); install
  separately: pip install flash-attn --no-build-isolation

Multi-GPU (tensor parallelism):
- Use device_map="auto" in transformers for automatic layer distribution.
- Or use accelerate + deepspeed for explicit tensor parallel.

Monitoring VRAM:
```python
import torch
print(torch.cuda.memory_allocated() / 1e9, "GB used")
print(torch.cuda.get_device_properties(0).total_memory / 1e9, "GB total")
```
Or use nvidia-smi on the command line.
        """,
        "tags": ["vram", "gpu", "ai", "llm", "memory-management"],
        "confidence": 0.89,
    },
    {
        "topic": "Windows Performance Tuning for Gaming & AI",
        "content": """
Key Windows settings to maximise performance:

Power Plan:
- Set to "Ultimate Performance" (may need to enable via PowerShell:
  powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61).
- Never use "Balanced" or "Power Saver" for gaming or AI workloads.

Background Processes:
- Disable Xbox Game Bar (Settings > Gaming > Xbox Game Bar > Off).
- Disable Windows Game Mode if causing stutters (also in Gaming settings).
- Stop unnecessary services: SysMain (Superfetch), Windows Search indexing
  (if SSD; useful on HDD).
- Use Task Manager or Process Lasso to set game process priority to "High".

Storage:
- Enable SSD AHCI mode in BIOS (not IDE mode).
- Disable defragmentation for SSDs (Windows does this automatically).
- Keep at least 10–15% of SSD free for wear levelling.
- Use Samsung Magician or CrystalDiskInfo to check SSD health.

Memory (RAM):
- Enable XMP/EXPO in BIOS for DDR4/DDR5 to run at rated speed.
- Dual-channel: install RAM in the correct slots (usually A2+B2 on most boards).

Virtual Memory:
- For 32 GB+ RAM machines: set page file to system-managed on the fastest drive.
- Do not disable page file — some apps require it regardless of RAM.
        """,
        "tags": ["windows", "performance", "gaming", "power-plan", "optimization"],
        "confidence": 0.88,
    },
    {
        "topic": "SSD vs HDD for Modding & AI",
        "content": """
Storage choice has a major impact on mod loading and AI model inference.

Recommendations:
- Game install: NVMe SSD (PCIe 4.0 preferred); dramatically reduces load times.
- Mod downloads/staging: Any SSD (SATA or NVMe).
- AI model weights: NVMe SSD for fastest model load; SATA SSD is acceptable.
- Backup/archive: HDD is fine for infrequently accessed mod backups.

Fallout 4 Specifics:
- Install game on NVMe; modded FO4 can have 20–50 GB of assets.
- MO2 mod staging folder should also be on the same fast drive as the game.
- Putting MO2 downloads folder on HDD saves SSD space without hurting performance.

AI Model Loading:
- Gemma 4 9B 4-bit: ~5 GB model file; loads in 10–30s from NVMe, 60–120s from HDD.
- Keep models on the fastest drive available.
- D:\\Mossy-AI is the configured location for all model weights.
        """,
        "tags": ["ssd", "hdd", "storage", "nvme", "performance", "ai"],
        "confidence": 0.87,
    },
]

# ---------------------------------------------------------------------------
# SECTION 3 — Mossy's Own Architecture (Self-Knowledge)
# ---------------------------------------------------------------------------
MOSSY_ARCHITECTURE_KNOWLEDGE: List[dict] = [
    {
        "topic": "Mossy AI Architecture Overview",
        "content": """
Mossy is a multi-service AI desktop assistant specialised for Fallout 4 modding.

Services & Ports:
- 8000: Gemma Brain Service (gemma_service_enhanced.py) — main LLM inference,
        RAG, chains, planning, episodic memory, fine-tuning.
- 8001: PyTorch Service (pytorch_service.py) — custom model loading & inference.
- 8002: Whisper Service (whisper_service.py) — speech-to-text transcription.
- 8003: Chroma Service (chroma_service.py) — standalone vector DB operations.
- 8004: Agent Collaboration Service (agent_collaboration_service.py) — multi-
        agent coordination, shared knowledge base, feedback loop, training data.
- 8005: OpenCV/Vision Service (opencv_service.py) — game screen analysis.
- 8011: Mossy Manager (future) — MO2 integration, load order management.
- 8188: ComfyUI (auto-detected, external process) — image generation.
- 21337: AI-Helper / Desktop Tutor Bridge — hardware context, screen capture.
- 8787:  Desktop Tutor Chat Backend — Groq llama-3.3-70b via Express.js.

Key Files:
- electron/main.cjs — Electron main process; spawns Python services, all IPC.
- components/ChatInterface.tsx — Main chat UI.
- components/AgentCollaboration.tsx — Multi-agent monitor, feedback UI.
- components/Gemma4FineTuner.tsx — Fine-tuning UI with auto-dataset loader.
- python/bootstrap_fallout4_knowledge.py — Seeds knowledge base with 50+ topics.

Data is stored in D:\\Mossy-AI\\ on Windows (~/Mossy-AI on Linux/Mac):
- models/     — downloaded LLM weights.
- data/chroma_db/ — vector knowledge base.
- data/episodes.db — episodic conversation memory.
- memory/long_term.json — key-value long-term facts.
        """,
        "tags": ["mossy", "architecture", "ports", "self-knowledge", "services"],
        "confidence": 0.97,
    },
    {
        "topic": "Mossy Knowledge Base & RAG System",
        "content": """
Mossy uses a hybrid retrieval system combining semantic search and BM25.

Components:
1. Chroma vector DB (all-MiniLM-L6-v2 embeddings, 384 dims).
   - Collection: 'mossy_rag' in D:\\Mossy-AI\\data\\chroma_db\\
   - Semantic similarity search (cosine distance).

2. BM25 keyword index (llama_index BM25Retriever).
   - Fast exact-term matching for mod names, error codes, version strings.
   - Stored in memory; rebuilt from Chroma documents on startup.

3. Hybrid fusion (RelativeScoreFusion).
   - Merges BM25 + semantic results with configurable weights.
   - Default: 0.6 semantic + 0.4 BM25 (adjustable via retriever).

4. Episodic memory (SQLite episodes table).
   - After each conversation, Gemma summarises session into 1–3 sentences.
   - Stored with timestamp, topics, outcome, quality rating.
   - Searched alongside RAG results to inject relevant past context.

Adding Knowledge:
- Run python/bootstrap_fallout4_knowledge.py to seed 50+ expert topics.
- IPC call: agent:knowledge-add (adds to shared Chroma collection).
- POST /add-documents on port 8000 (adds to mossy_rag collection).
- POST /knowledge/add on port 8004 (adds to fallout4_knowledge collection).
        """,
        "tags": ["rag", "bm25", "chroma", "episodic-memory", "knowledge-base"],
        "confidence": 0.94,
    },
    {
        "topic": "Mossy Agent Collaboration Protocol",
        "content": """
Mossy's multi-agent system (port 8004) coordinates three AI agents:

Agents:
- desktop-ai (port 8000): Gemma 4 local LLM — main tutor and synthesiser.
- ai-helper (port 21337): Hardware/system context from Desktop Tutor bridge.
- desktop-tutor (port 8787): Groq llama-3.3-70b — fast cloud LLM for peer answers.
- mossy-manager (port 8011): Future — MO2 load order expert.

Protocol Flow:
1. User asks a question.
2. desktop-ai retrieves from hybrid RAG + episodic memory.
3. desktop-ai optionally queries ai-helper for hardware context.
4. desktop-ai optionally queries desktop-tutor for a second opinion.
5. Consensus score computed (average confidence from responding agents).
6. If consensus < 70%, improvement cycle triggered automatically.
7. Self-critique loop runs if confidence < 85% (two-pass answer refinement).
8. Final answer returned; session recorded as episode.

Learning Loop:
- User thumbs-up: increase knowledge entry confidence, save as training sample.
- User thumbs-down: lower confidence, trigger immediate improvement cycle,
  save as negative training sample.
- Collected samples exported via POST /training-data/export for LoRA fine-tuning.
        """,
        "tags": ["agents", "collaboration", "protocol", "learning", "mossy"],
        "confidence": 0.93,
    },
    {
        "topic": "Mossy Electron IPC Handler Reference",
        "content": """
All Mossy services communicate through Electron IPC handlers in electron/main.cjs.

Gemma Brain (port 8000):
  gemma:health-check, gemma:load-model, gemma:run-inference, gemma:chain,
  gemma:rag-query, gemma:add-documents, gemma:plan, gemma:reflect,
  gemma:chain-of-thought, gemma:graph-query, gemma:episodes-add,
  gemma:episodes-search, gemma:memory-add, gemma:memory-get,
  gemma:web-search, gemma:start-fine-tune, gemma:fine-tune-status,
  gemma:list-models, gemma:training-data-list

Agent Collab (port 8004):
  agent:discover, agent:query, agent:knowledge-search, agent:knowledge-add,
  agent:validate-answer, agent:get-stats, agent:trigger-improvement,
  agent:get-learning-history, agent:feedback, agent:export-training-data

Desktop Tutor (ports 21337 / 8787):
  tutor:status, tutor:chat, tutor:get-hardware, tutor:get-screen,
  tutor:share-knowledge

Speech / Vision:
  whisper:health-check, whisper:transcribe, whisper:set-model
  chroma:health-check, chroma:add-document, chroma:search
  pytorch:health-check, pytorch:load-model, pytorch:infer
  comfyui:health-check, comfyui:generate-image
  system:detect-tools
        """,
        "tags": ["ipc", "electron", "handlers", "api-reference", "mossy"],
        "confidence": 0.92,
    },
    {
        "topic": "Mossy Fine-Tuning Pipeline",
        "content": """
Mossy can fine-tune Gemma 4 on its own collected knowledge using Unsloth LoRA.

Auto-Dataset Collection:
- Every answer with consensus > 0.85 is saved as a training sample.
- User thumbs-up marks a sample as high quality (priority weight × 2).
- Stored in data/training_samples table in shared_knowledge.db.
- Export via POST /training-data/export (returns JSONL with prompt+completion).

Fine-Tuning via UI (Gemma4FineTuner.tsx):
1. Click "Load from Brain" to import auto-collected samples.
2. Review / edit samples; delete bad ones.
3. Set LoRA config (rank 16, alpha 32, epochs 3 — defaults are good).
4. Click "Tune Mossy's Brain" → starts background fine-tune job.
5. Monitor progress bar; job saves adapter to D:\\Mossy-AI\\models\\mossy-lora.
6. Load the adapter: gemma:load-model with model path = mossy-lora.

Fine-Tuning Config Defaults (optimised for 16 GB VRAM):
- Base model: google/gemma-4-9b or google/gemma-3-12b-it
- Rank: 16 (good balance of quality vs VRAM)
- Alpha: 32
- Dropout: 0.05
- Epochs: 3
- Batch size: 2 (with gradient accumulation 4 = effective batch 8)
- Max sequence length: 8192 (full context for complex queries)
        """,
        "tags": ["fine-tuning", "lora", "unsloth", "training-data", "auto-dataset"],
        "confidence": 0.90,
    },
]

# ---------------------------------------------------------------------------
# SECTION 4 — User Profile (placeholder entries; Mossy updates these at runtime)
# ---------------------------------------------------------------------------
USER_PROFILE_KNOWLEDGE: List[dict] = [
    {
        "topic": "User Hardware Profile",
        "content": """
This entry is updated automatically as Mossy learns about the user's system.
Detected from Desktop Tutor hardware API and user conversations.

Known Hardware (placeholder — updated at runtime):
- GPU: NVIDIA RTX (detected via Desktop Tutor /hardware endpoint)
- CUDA: Multiple versions (12.8–13.2) installed
- RAM: Detected at runtime
- OS: Windows (detected via Desktop Tutor)
- Fallout 4 Install Path: Detected via MO2 service or user input

Mossy uses this profile to:
- Recommend appropriate texture resolutions for the installed GPU.
- Advise on appropriate AI model sizes (9B vs 27B based on VRAM).
- Calibrate performance expectations.
        """,
        "tags": ["user-profile", "hardware", "personalisation"],
        "confidence": 0.70,
    },
    {
        "topic": "User Mod Preferences",
        "content": """
This entry tracks the user's established mod preferences and choices.
Updated via conversation and MO2 integration.

Current Known Preferences (placeholder — updated at runtime):
- Body Framework: Not yet determined (CBBE or BHUNP).
- ENB Preference: Not yet determined.
- Performance vs Quality trade-off: Not yet determined.
- Favourite Mod Categories: Not yet determined.
- Installed Mod Manager: MO2 (inferred from architecture).

Mossy uses this profile to:
- Give personalised mod recommendations.
- Skip generic advice the user already knows.
- Remember which mods are already installed (avoid recommending duplicates).
        """,
        "tags": ["user-profile", "preferences", "personalisation", "mods"],
        "confidence": 0.65,
    },
]

# ---------------------------------------------------------------------------
# Combined list (all sections)
# ---------------------------------------------------------------------------
ALL_KNOWLEDGE = (
    FALLOUT4_KNOWLEDGE
    + PC_KNOWLEDGE
    + MOSSY_ARCHITECTURE_KNOWLEDGE
    + USER_PROFILE_KNOWLEDGE
)

def initialize_knowledge(knowledge_list: List[dict], section_name: str, agent: str = "desktop-ai") -> int:
    """Add a list of knowledge entries to the shared knowledge base.  Returns success count."""
    success = 0
    total = len(knowledge_list)
    print(f"\n[BOOTSTRAP] {section_name} ({total} topics)")
    for i, entry in enumerate(knowledge_list, 1):
        try:
            response = requests.post(
                f"{AGENT_COLLAB_SERVICE}/knowledge/add",
                json={
                    "topic": entry["topic"],
                    "content": entry["content"],
                    "agent": agent,
                    "tags": entry.get("tags", []),
                    "confidence": entry.get("confidence", 0.85),
                },
                timeout=10,
            )
            if response.status_code == 200:
                data = response.json()
                print(f"  [{i:2d}/{total}] ✓ {entry['topic']} (ID: {data['id'][:8]}...)")
                success += 1
            else:
                print(f"  [{i:2d}/{total}] ✗ {entry['topic']} — HTTP {response.status_code}")
        except Exception as e:
            print(f"  [{i:2d}/{total}] ✗ {entry['topic']} — {str(e)}")
    return success


def initialize_all_knowledge():
    """Bootstrap ALL knowledge sections into the shared knowledge base."""
    print("[MOSSY BOOTSTRAP] Starting full knowledge base initialisation…")

    sections = [
        (FALLOUT4_KNOWLEDGE,          "Fallout 4 Modding",          "desktop-ai"),
        (PC_KNOWLEDGE,                "PC Hardware & OS",            "ai-helper"),
        (MOSSY_ARCHITECTURE_KNOWLEDGE,"Mossy Self-Knowledge",        "desktop-ai"),
        (USER_PROFILE_KNOWLEDGE,      "User Profile (placeholders)", "desktop-ai"),
    ]

    grand_total = 0
    grand_success = 0
    for knowledge_list, section_name, agent in sections:
        ok = initialize_knowledge(knowledge_list, section_name, agent)
        grand_success += ok
        grand_total += len(knowledge_list)

    print(f"\n[MOSSY BOOTSTRAP] Complete! {grand_success}/{grand_total} topics added.")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("MOSSY MULTI-AGENT KNOWLEDGE BASE BOOTSTRAP")
    print("=" * 70)
    print(f"\nTarget Service: {AGENT_COLLAB_SERVICE}")
    print(f"Total Topics:   {len(ALL_KNOWLEDGE)}")
    print("  Fallout 4 Modding:      ", len(FALLOUT4_KNOWLEDGE))
    print("  PC Hardware & OS:       ", len(PC_KNOWLEDGE))
    print("  Mossy Architecture:     ", len(MOSSY_ARCHITECTURE_KNOWLEDGE))
    print("  User Profile:           ", len(USER_PROFILE_KNOWLEDGE))
    print("\nStarting initialisation…\n")

    initialize_all_knowledge()

    print("\n" + "=" * 70)
    print("✓ Knowledge base ready for agent collaboration!")
    print("=" * 70 + "\n")
