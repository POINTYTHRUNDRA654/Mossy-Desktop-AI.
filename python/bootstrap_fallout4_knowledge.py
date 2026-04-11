"""
Fallout 4 Modding Knowledge Base Bootstrap
Initialize the shared knowledge base with expert Fallout 4 modding knowledge
"""

import requests
import json
from typing import List

# Port for multi-agent service
AGENT_COLLAB_SERVICE = "http://localhost:8004"

# Bootstrap knowledge entries for Fallout 4 modding
FALLOUT4_KNOWLEDGE = [
    {
        "topic": "Mod Load Order Basics",
        "content": """
Load order determines which mods override others. Two critical rules:
1. Masters (ESM) load first, plugins (ESP) load after
2. Last loaded file wins conflicts - put patches/compatibility mods last

Use Load Order Library or Loot for automatic sorting.
Dependencies must load BEFORE dependent mods.
        """,
        "tags": ["load-order", "basics", "critical"],
        "confidence": 0.95,
    },
    {
        "topic": "FOMOD Installation",
        "content": """
FOMOD (Fallout MOD) installers provide guided installation with options.
Installation steps:
1. Select package version (main/optional patches)
2. Choose variant (body/armor/weapon textures)
3. Optional features (mods, patches)
4. Complete installation

Always read installer screenshots - they guide complex setups.
Some mods have conflicting options - choose only one.
        """,
        "tags": ["installation", "fomod", "packaging"],
        "confidence": 0.92,
    },
    {
        "topic": "Texture Quality vs Performance",
        "content": """
Fallout 4 is VRAM-intensive. Balance quality vs frame rate:

Resolution Guidelines:
- 2K textures (2048x2048): 4K-6GB VRAM recommended
- 1K textures (1024x1024): 2-4GB VRAM, 60FPS stable
- 512px textures: Low-end systems, light mods only

Tools:
- CAO (Cathedral Assets Optimizer): Compress textures losslessly
- ScanCross: Find broken texture refs
- NifTools: Preview/edit mesh+texture combinations

Pro tip: Mix resolutions - 2K for visible objects, 1K for distant/NPCs
        """,
        "tags": ["textures", "performance", "vram", "optimization"],
        "confidence": 0.88,
    },
    {
        "topic": "Merging and Batching",
        "content": """
Reduce active ESPs (max 254) by merging/batching:

Merge Strategy:
1. Identify 'mergeable' plugins (no scripts, no master edits)
2. Check MASTERLIST.txt in Skyrim/FO4 for mergeability
3. Use zEdit or TES5Edit to merge safely
4. Save merged as ESM (extension) - doesn't count against ESP limit

Batch Files:
Some plugins reference by load order (number). Use BAT files to reorder.
Alternative: Create dummy masters to force load order.

Caution: Don't merge mods that modify scripts or have masters!
        """,
        "tags": ["advanced", "optimization", "plugin-management"],
        "confidence": 0.85,
    },
    {
        "topic": "Conflict Resolution",
        "content": """
Common Fallout 4 conflicts and solutions:

Navigation Mesh (Navmesh) Conflicts:
- Cause: Multiple mods edit same cell navmesh
- Fix: Prioritize one, remove from others, or use ReXeZ patches
- Check: Use FO4Edit > Search > Navmesh

Texture Conflicts:
- Cause: Same texture overwritten multiple times
- Fix: Use landscape/NPC texture mods in order: Base > Weather > ENB > Effects
- Tool: Check with TES5Edit > Search > Texture

Script Conflicts:
- Cause: Multiple mods modify same quest/actor
- Fix: Create patch in Creation Kit, load mods in dependency order

Master Record Conflicts:
- Cause: Different mods alter base form ID
- Fix: Create compatibility patch, test with specific race/armor combos
        """,
        "tags": ["troubleshooting", "conflicts", "resolution"],
        "confidence": 0.90,
    },
    {
        "topic": "Custom Patches & Compatibility",
        "content": """
Create compatibility patches between conflicting mods:

Creation Kit Method:
1. Load base game + both conflicting mods
2. Find conflicts in record view
3. Make compatible edits (merge values, adjust conflicts)
4. Save as new ESP (mark as dependent on all three)
5. Test thoroughly - use quicksave before testing patches

FO4Edit Method (faster):
1. Open FO4Edit with conflicting mods loaded
2. Right-click conflict > Create patch
3. In patch: adjust conflicted values intelligently
4. Overwrite conflicting records selectively
5. Save with dependency markers

Golden Rules:
- Always test patches in-game (load quicksaves, spawn NPCs)
- Patches should have conflicts marked in description
- Load patches LAST (after both mods)
        """,
        "tags": ["patches", "compatibility", "modding-tools"],
        "confidence": 0.87,
    },
    {
        "topic": "ENB & Shader Mods",
        "content": """
ENB (Enhanced Natural Beauty) overhauls lighting/post-processing.

Check ENB Compatibility:
- Version: ENB 0.466+ for Fallout 4
- Load: After weather mods, BEFORE texture mods affect lighting
- Performance: -10 to -30 FPS depending on quality

Installation:
1. Download ENB binaries + preset
2. Copy binaries to Fallout4 folder (root)
3. Install preset via MO2
4. Enable in enblocal.ini:
   - UseOriginalPostProcessing=true for modern ENBs
   - VideoMemorySizeMb=8192 (your GPU VRAM)

Common Issues:
- Black screen: Usually outdated ENB binary version
- Flickering: Conflict with FXAA shaders
- Low FPS: Reduce PrepareShadows quality

Alternatives: Reshade, NVIDIA GFXBench presets
        """,
        "tags": ["graphics", "enb", "visual-enhancement"],
        "confidence": 0.84,
    },
    {
        "topic": "Script Lag & Optimization",
        "content": """
Fallout 4 scripts can cause severe lag if not optimized.

Identify Script Lag:
- Use Console: clk (checks loaded mods), scpt (script count)
- Watch for stalls when: entering cells, using followers, complex quests
- Monitor: FPS drops consistently at specific locations

Common Causes:
1. Mods with error-prone scripts (infinite loops, bad conditions)
2. OnUpdate() events firing every frame
3. Too many persistent actors in one cell
4. Memory leak from uncleaned objects

Fixes:
- Use Script Lag Monitor to identify offending mods
- Disable heavy companion/quest mods if lag spikes
- Use Disable Processors mod to turn off idle scripts
- Update scripts: Some mod authors release fixes for lag
- Reduce actor count: Move NPCs to different cells/reduced spawn mods
        """,
        "tags": ["optimization", "scripting", "performance"],
        "confidence": 0.82,
    },
]

def initialize_fallout4_knowledge():
    """Bootstrap shared knowledge base with Fallout 4 expertise"""
    print("[FALLOUT 4 KNOWLEDGE] Initializing shared knowledge base...")
    
    for i, entry in enumerate(FALLOUT4_KNOWLEDGE, 1):
        try:
            response = requests.post(
                f"{AGENT_COLLAB_SERVICE}/knowledge/add",
                json={
                    "topic": entry["topic"],
                    "content": entry["content"],
                    "agent": "desktop-ai",  # Bootstrap from tutor
                    "tags": entry["tags"],
                    "confidence": entry["confidence"],
                },
                timeout=5,
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"[{i:2d}/{len(FALLOUT4_KNOWLEDGE)}] ✓ {entry['topic']} (ID: {data['id'][:8]}...)")
            else:
                print(f"[{i:2d}/{len(FALLOUT4_KNOWLEDGE)}] ✗ {entry['topic']} - HTTP {response.status_code}")
        except Exception as e:
            print(f"[{i:2d}/{len(FALLOUT4_KNOWLEDGE)}] ✗ {entry['topic']} - {str(e)}")
    
    print(f"[FALLOUT 4 KNOWLEDGE] Bootstrap complete! {len(FALLOUT4_KNOWLEDGE)} topics added.")

if __name__ == "__main__":
    print("\n" + "="*70)
    print("FALLOUT 4 MULTI-AGENT KNOWLEDGE BASE BOOTSTRAP")
    print("="*70)
    print(f"\nTarget Service: {AGENT_COLLAB_SERVICE}")
    print(f"Knowledge Topics: {len(FALLOUT4_KNOWLEDGE)}")
    print("\nStarting initialization...\n")
    
    initialize_fallout4_knowledge()
    
    print("\n" + "="*70)
    print("✓ Knowledge base ready for agent collaboration!")
    print("="*70 + "\n")
