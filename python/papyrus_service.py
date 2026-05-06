"""
Papyrus Script Compiler & Validator Service — port 8014
Compiles and validates Papyrus scripts for Fallout 4, Skyrim SE, and Skyrim LE.

Papyrus is the scripting language used by Bethesda games.
PapyrusCompiler.exe ships with each game's Creation Kit.

This service:
- Calls PapyrusCompiler.exe via subprocess when available
- Provides pure-Python regex-based validation as a fallback
- Generates script templates for common object types
- Maintains a library of reusable Papyrus snippets
"""
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

DATA_DIR = Path(
    os.environ.get("MOSSY_DATA_ROOT", os.path.join(os.path.expanduser("~"), "Mossy-AI"))
) / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

COMPILER_PATH_FILE = DATA_DIR / "papyrus_compiler_path.txt"

DEFAULT_COMPILER_PATHS = [
    r"C:\Program Files (x86)\Steam\steamapps\common\Fallout 4\Tools\Papyrus Compiler\PapyrusCompiler.exe",
    r"D:\SteamLibrary\steamapps\common\Fallout 4\Tools\Papyrus Compiler\PapyrusCompiler.exe",
    r"C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Papyrus Compiler\PapyrusCompiler.exe",
    r"D:\SteamLibrary\steamapps\common\Skyrim Special Edition\Papyrus Compiler\PapyrusCompiler.exe",
    r"C:\Program Files (x86)\Steam\steamapps\common\Skyrim\Papyrus Compiler\PapyrusCompiler.exe",
]

GAME_FLAGS = {
    "fo4": "Institute_Papyrus_Flags.flg",
    "sse": "TESV_Papyrus_Flags.flg",
    "le":  "TESV_Papyrus_Flags.flg",
}

COMMON_EVENTS = {
    "Actor": [
        "OnActivate(ObjectReference akActionRef)",
        "OnAttachedToCell()",
        "OnCellAttach()",
        "OnCellDetach()",
        "OnCombatStateChanged(Actor akTarget, int aiCombatState)",
        "OnDeath(Actor akKiller)",
        "OnDeathEnd(bool abShouldExplode)",
        "OnDetachedFromCell()",
        "OnEnterBleedout()",
        "OnGetUp(Furniture akFurniture)",
        "OnHit(ObjectReference akAggressor, Form akSource, Projectile akProjectile, bool abPowerAttack, bool abSneakAttack, bool abBashAttack, bool abHitBlocked)",
        "OnInit()",
        "OnItemAdded(Form akBaseItem, int aiItemCount, ObjectReference akItemReference, ObjectReference akSourceContainer)",
        "OnItemRemoved(Form akBaseItem, int aiItemCount, ObjectReference akItemReference, ObjectReference akDestContainer)",
        "OnLoad()",
        "OnLocationChange(Location akOldLoc, Location akNewLoc)",
        "OnMagicEffectApply(ObjectReference akCaster, MagicEffect akEffect)",
        "OnObjectEquipped(Form akBaseObject, ObjectReference akReference)",
        "OnObjectUnequipped(Form akBaseObject, ObjectReference akReference)",
        "OnPackageChange(Package akOldPackage)",
        "OnPackageEnd(Package akEndedPackage)",
        "OnPackageStart(Package akNewPackage)",
        "OnPlayerBowDraw()",
        "OnPlayerFastTravelEnd(float afTravelGameTimeHours)",
        "OnRaceSwitchComplete()",
        "OnSit(Furniture akFurniture)",
        "OnSleepStart(float afSleepStartTime, float afDesiredSleepEndTime)",
        "OnSleepStop(bool abInterrupted)",
        "OnSpellCast(Form akSpell)",
        "OnTranslationAlmostComplete()",
        "OnTranslationComplete()",
        "OnTranslationFailed()",
        "OnTrapHit(ObjectReference akTarget, float afXVel, float afYVel, float afZVel, float afXPos, float afYPos, float afZPos, int aeMaterial, bool abInitialHit, int aeMotionType)",
        "OnUnload()",
        "OnWordLearned(WordOfPower akWord)",
        "OnWordPlayerLearned(WordOfPower akWord)",
    ],
    "ObjectReference": [
        "OnActivate(ObjectReference akActionRef)",
        "OnCellAttach()",
        "OnCellDetach()",
        "OnContainerChanged(ObjectReference akNewContainer, ObjectReference akOldContainer)",
        "OnDestructionStageChanged(int aiOldStage, int aiNewStage)",
        "OnEquipped(Actor akActor)",
        "OnGrab()",
        "OnHit(ObjectReference akAggressor, Form akSource, Projectile akProjectile, bool abPowerAttack, bool abSneakAttack, bool abBashAttack, bool abHitBlocked)",
        "OnInit()",
        "OnLoad()",
        "OnMagicEffectApply(ObjectReference akCaster, MagicEffect akEffect)",
        "OnOpen(ObjectReference akActionRef)",
        "OnClose(ObjectReference akActionRef)",
        "OnRead()",
        "OnRelease()",
        "OnReset()",
        "OnSell(Actor akSeller)",
        "OnSpellCast(Form akSpell)",
        "OnTranslationAlmostComplete()",
        "OnTranslationComplete()",
        "OnTranslationFailed()",
        "OnTriggerEnter(ObjectReference akActionRef)",
        "OnTriggerLeave(ObjectReference akActionRef)",
        "OnUnequipped(Actor akActor)",
        "OnUnload()",
        "OnWardHit(ObjectReference akCaster, Spell akSpell, int aiStatus)",
    ],
    "Quest": [
        "OnInit()",
        "OnQuestInit()",
        "OnQuestShutdown()",
        "OnStageSet(int auiStageID, int auiItemID)",
        "OnTimer(int aiTimerID)",
        "OnTimerGameTime(int aiTimerID)",
        "OnUpdate()",
        "OnUpdateGameTime()",
    ],
    "ActiveMagicEffect": [
        "OnEffectFinish(Actor akTarget, Actor akCaster)",
        "OnEffectStart(Actor akTarget, Actor akCaster)",
        "OnHit(ObjectReference akAggressor, Form akSource, Projectile akProjectile, bool abPowerAttack, bool abSneakAttack, bool abBashAttack, bool abHitBlocked)",
        "OnMagicEffectApply(ObjectReference akCaster, MagicEffect akEffect)",
        "OnSleep(float afSleepStartTime, float afDesiredSleepEndTime)",
        "OnWake(bool abInterrupted)",
    ],
}

SNIPPET_LIBRARY = [
    {
        "name": "Add Item to Player",
        "category": "Inventory",
        "code": "Game.GetPlayer().AddItem(MyItem, 1, true)"
    },
    {
        "name": "Remove Item from Player",
        "category": "Inventory",
        "code": "Game.GetPlayer().RemoveItem(MyItem, 1, true)"
    },
    {
        "name": "Play Sound at Object",
        "category": "Audio",
        "code": "Sound.PlayAndWait(MySound, Self as ObjectReference)"
    },
    {
        "name": "Play 3D Sound",
        "category": "Audio",
        "code": "Game.GetPlayer().PlayGamebryoAnimation(\"MyAnim\", true)"
    },
    {
        "name": "Move Actor to Marker",
        "category": "Movement",
        "code": "MyActor.MoveTo(MyMarker)"
    },
    {
        "name": "Set Stage on Quest",
        "category": "Quest",
        "code": "MyQuest.SetStage(10)"
    },
    {
        "name": "Show Message Box",
        "category": "UI",
        "code": "Debug.MessageBox(\"Hello, Wasteland!\")"
    },
    {
        "name": "Notification",
        "category": "UI",
        "code": "Debug.Notification(\"Item acquired\")"
    },
    {
        "name": "Fade Out / In",
        "category": "Visual",
        "code": "Game.FadeOutGame(true, true, 0.5, 1.0)\n; ... do stuff ...\nGame.FadeOutGame(false, true, 0.5, 1.0)"
    },
    {
        "name": "Disable / Enable Actor",
        "category": "Object",
        "code": "MyActor.Disable(false)\n; ...\nMyActor.Enable(false)"
    },
    {
        "name": "Start Timer",
        "category": "Timer",
        "code": "StartTimer(5.0, 1)  ; fires OnTimer(1) after 5 seconds"
    },
    {
        "name": "Start GameTime Timer",
        "category": "Timer",
        "code": "StartTimerGameTime(24.0, 2)  ; fires OnTimerGameTime(2) after 24 game hours"
    },
    {
        "name": "Register for OnUpdate",
        "category": "Events",
        "code": "RegisterForUpdateGameTime(0.5)  ; called every 0.5 game hours"
    },
    {
        "name": "Get Actor Value",
        "category": "ActorValues",
        "code": "float fHealth = MyActor.GetActorValue(\"Health\")"
    },
    {
        "name": "Set Actor Value",
        "category": "ActorValues",
        "code": "MyActor.SetActorValue(\"Health\", 100.0)"
    },
    {
        "name": "Cast Spell on Actor",
        "category": "Magic",
        "code": "MySpell.Cast(MyCaster as ObjectReference, MyTarget as ObjectReference)"
    },
    {
        "name": "Apply Perk to Player",
        "category": "Perks",
        "code": "Game.GetPlayer().AddPerk(MyPerk)"
    },
    {
        "name": "Force Actor Into Package",
        "category": "AI",
        "code": "MyActor.EvaluatePackage()"
    },
    {
        "name": "Create Reference at Position",
        "category": "Object",
        "code": "ObjectReference kRef = MyBaseObject.PlaceAtMe(MyForm, 1, false, false)"
    },
    {
        "name": "Get Distance Between Objects",
        "category": "Math",
        "code": "float fDist = MyObjectA.GetDistance(MyObjectB)"
    },
    {
        "name": "Is Actor in Combat",
        "category": "Combat",
        "code": "bool bInCombat = MyActor.IsInCombat()"
    },
    {
        "name": "Play Animation on Actor",
        "category": "Animation",
        "code": "MyActor.PlayGamebryoAnimation(\"IdleFNVRocketLaunch\", true)"
    },
    {
        "name": "Wait Utility",
        "category": "Flow",
        "code": "Utility.Wait(1.0)  ; wait 1 real second (use in threads only)"
    },
    {
        "name": "Register for Single Update",
        "category": "Events",
        "code": "RegisterForSingleUpdate(1.0)  ; fires OnUpdate() after 1 real second"
    },
]

TEMPLATES = {
    "quest": """\
Scriptname {name} extends Quest
{{Quest script: {description}}}

; ── Properties ───────────────────────────────────────────────────────────
Actor Property PlayerRef Auto Const Mandatory

; ── Variables ────────────────────────────────────────────────────────────
bool bInitialized = false

; ── Events ───────────────────────────────────────────────────────────────

Event OnInit()
    bInitialized = true
    Debug.Notification("Quest script initialized")
EndEvent

Event OnQuestInit()
    ; Quest starts here
EndEvent

Event OnStageSet(int auiStageID, int auiItemID)
    if auiStageID == 10
        ; Stage 10 set
    elseif auiStageID == 20
        ; Stage 20 set
    endif
EndEvent

Event OnTimer(int aiTimerID)
    if aiTimerID == 1
        ; Timer 1 fired
    endif
EndEvent
""",
    "actor": """\
Scriptname {name} extends Actor
{{Actor script: {description}}}

; ── Properties ───────────────────────────────────────────────────────────
Actor Property PlayerRef Auto Const Mandatory
Sound Property MySound Auto

; ── Variables ────────────────────────────────────────────────────────────
bool bAlive = true

; ── Events ───────────────────────────────────────────────────────────────

Event OnInit()
    RegisterForUpdateGameTime(1.0)
EndEvent

Event OnDeath(Actor akKiller)
    bAlive = false
    Debug.Notification("Actor died")
EndEvent

Event OnHit(ObjectReference akAggressor, Form akSource, Projectile akProjectile, \\
            bool abPowerAttack, bool abSneakAttack, bool abBashAttack, bool abHitBlocked)
    ; Handle hit event
EndEvent

Event OnCombatStateChanged(Actor akTarget, int aiCombatState)
    if aiCombatState == 1
        ; Entered combat
    elseif aiCombatState == 0
        ; Left combat
    endif
EndEvent

Event OnUpdateGameTime()
    ; Periodic game-time update
EndEvent
""",
    "activator": """\
Scriptname {name} extends ObjectReference
{{Activator script: {description}}}

; ── Properties ───────────────────────────────────────────────────────────
Actor Property PlayerRef Auto Const Mandatory
Message Property ActivateMessage Auto
bool Property bEnabled Auto Conditional

; ── Events ───────────────────────────────────────────────────────────────

Event OnInit()
    bEnabled = true
EndEvent

Event OnActivate(ObjectReference akActionRef)
    if !bEnabled
        return
    endif
    if akActionRef == PlayerRef as ObjectReference
        ActivateMessage.Show()
    endif
EndEvent

Event OnLoad()
    ; Object loaded into cell
EndEvent

Event OnUnload()
    ; Object unloaded from cell
EndEvent
""",
    "item": """\
Scriptname {name} extends ObjectReference
{{Item/Misc Object script: {description}}}

; ── Properties ───────────────────────────────────────────────────────────
Actor Property PlayerRef Auto Const Mandatory
MiscObject Property SelfItem Auto

; ── Events ───────────────────────────────────────────────────────────────

Event OnInit()
EndEvent

Event OnContainerChanged(ObjectReference akNewContainer, ObjectReference akOldContainer)
    if akNewContainer == PlayerRef as ObjectReference
        ; Item picked up by player
        Debug.Notification("Item added to inventory")
    elseif akOldContainer == PlayerRef as ObjectReference
        ; Item removed from player
    endif
EndEvent

Event OnEquipped(Actor akActor)
    if akActor == PlayerRef
        ; Equipped by player
    endif
EndEvent

Event OnUnequipped(Actor akActor)
    ; Unequipped
EndEvent
""",
    "magic": """\
Scriptname {name} extends ActiveMagicEffect
{{Magic Effect script: {description}}}

; ── Properties ───────────────────────────────────────────────────────────
Actor Property PlayerRef Auto Const Mandatory

; ── Variables ────────────────────────────────────────────────────────────
Actor kTarget
Actor kCaster

; ── Events ───────────────────────────────────────────────────────────────

Event OnEffectStart(Actor akTarget, Actor akCaster)
    kTarget = akTarget
    kCaster = akCaster
    ; Effect applied — set up duration logic here
    RegisterForSingleUpdate(GetDuration())
EndEvent

Event OnEffectFinish(Actor akTarget, Actor akCaster)
    ; Effect ended — clean up
    UnregisterForUpdate()
EndEvent

Event OnUpdate()
    if kTarget && !kTarget.IsDead()
        ; Periodic tick
        RegisterForSingleUpdate(1.0)
    endif
EndEvent

Event OnHit(ObjectReference akAggressor, Form akSource, Projectile akProjectile, \\
            bool abPowerAttack, bool abSneakAttack, bool abBashAttack, bool abHitBlocked)
    ; Target was hit while effect active
EndEvent
""",
    "furniture": """\
Scriptname {name} extends ObjectReference
{{Furniture script: {description}}}

; ── Properties ───────────────────────────────────────────────────────────
Actor Property PlayerRef Auto Const Mandatory

; ── Events ───────────────────────────────────────────────────────────────

Event OnInit()
EndEvent

Event OnActivate(ObjectReference akActionRef)
    ; Actor activated the furniture
EndEvent

Event OnGetUp(Actor akActor)
    ; Actor got up from furniture (via Actor script link)
EndEvent
""",
    "container": """\
Scriptname {name} extends ObjectReference
{{Container script: {description}}}

; ── Properties ───────────────────────────────────────────────────────────
Actor Property PlayerRef Auto Const Mandatory

; ── Events ───────────────────────────────────────────────────────────────

Event OnInit()
EndEvent

Event OnOpen(ObjectReference akActionRef)
    if akActionRef == PlayerRef as ObjectReference
        ; Player opened container
    endif
EndEvent

Event OnClose(ObjectReference akActionRef)
    ; Container closed
EndEvent

Event OnItemAdded(Form akBaseItem, int aiItemCount, ObjectReference akItemReference, ObjectReference akSourceContainer)
    ; Item added to container
EndEvent

Event OnItemRemoved(Form akBaseItem, int aiItemCount, ObjectReference akItemReference, ObjectReference akDestContainer)
    ; Item removed from container
EndEvent
""",
}


def _find_compiler() -> Optional[str]:
    if COMPILER_PATH_FILE.exists():
        saved = COMPILER_PATH_FILE.read_text().strip()
        if os.path.exists(saved):
            return saved
    for p in DEFAULT_COMPILER_PATHS:
        if os.path.exists(p):
            return p
    return shutil.which("PapyrusCompiler") or shutil.which("PapyrusCompiler.exe")


def _validate_script(content: str, game: str) -> dict:
    """Pure-Python regex validation of a Papyrus script."""
    issues = []
    lines = content.splitlines()
    stats = {"functions": 0, "properties": 0, "events": 0, "lines": len(lines)}

    scriptname_re = re.compile(r'^\s*Scriptname\s+\w+', re.IGNORECASE)
    prop_re = re.compile(r'^\s*\w+\s+Property\s+\w+', re.IGNORECASE)
    func_re = re.compile(r'^\s*((?:\w+\s+)?Function\s+\w+)', re.IGNORECASE)
    event_re = re.compile(r'^\s*Event\s+\w+', re.IGNORECASE)
    endif_re = re.compile(r'^\s*EndIf\b', re.IGNORECASE)
    if_re = re.compile(r'^\s*if\b', re.IGNORECASE)
    endfunction_re = re.compile(r'^\s*EndFunction\b', re.IGNORECASE)
    endevent_re = re.compile(r'^\s*EndEvent\b', re.IGNORECASE)
    while_re = re.compile(r'^\s*while\b', re.IGNORECASE)
    endwhile_re = re.compile(r'^\s*EndWhile\b', re.IGNORECASE)

    has_scriptname = False
    if_depth = 0
    while_depth = 0
    open_functions = 0
    open_events = 0

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped or stripped.startswith(";"):
            continue

        if scriptname_re.match(line):
            has_scriptname = True

        if prop_re.match(line):
            stats["properties"] += 1

        if func_re.match(line) and not stripped.lower().startswith("endfunction"):
            stats["functions"] += 1
            open_functions += 1

        if event_re.match(line) and not stripped.lower().startswith("endevent"):
            stats["events"] += 1
            open_events += 1

        if endfunction_re.match(line):
            open_functions = max(0, open_functions - 1)

        if endevent_re.match(line):
            open_events = max(0, open_events - 1)

        if if_re.match(line):
            if_depth += 1
        if endif_re.match(line):
            if_depth = max(0, if_depth - 1)

        if while_re.match(line):
            while_depth += 1
        if endwhile_re.match(line):
            while_depth = max(0, while_depth - 1)

        # Check for common mistakes
        if '"' in stripped and stripped.count('"') % 2 != 0:
            issues.append({
                "line": i,
                "severity": "error",
                "message": "Unmatched quote character",
            })

        if stripped.endswith(";") and not stripped.startswith(";"):
            issues.append({
                "line": i,
                "severity": "warning",
                "message": "Line ends with semicolon — Papyrus uses semicolons for comments, not statement terminators",
            })

    if not has_scriptname:
        issues.insert(0, {
            "line": 1,
            "severity": "error",
            "message": "Missing Scriptname declaration (e.g., 'Scriptname MyScript extends Quest')",
        })

    if if_depth > 0:
        issues.append({
            "line": len(lines),
            "severity": "error",
            "message": f"Unclosed if block ({if_depth} if(s) without matching EndIf)",
        })

    if while_depth > 0:
        issues.append({
            "line": len(lines),
            "severity": "error",
            "message": f"Unclosed while block ({while_depth} while(s) without matching EndWhile)",
        })

    if open_functions > 0:
        issues.append({
            "line": len(lines),
            "severity": "error",
            "message": f"Unclosed Function block ({open_functions} without EndFunction)",
        })

    if open_events > 0:
        issues.append({
            "line": len(lines),
            "severity": "error",
            "message": f"Unclosed Event block ({open_events} without EndEvent)",
        })

    has_errors = any(i["severity"] == "error" for i in issues)
    return {
        "valid": not has_errors,
        "issues": issues,
        "stats": stats,
    }


# ── Request Models ─────────────────────────────────────────────────────────

class SetCompilerPathRequest(BaseModel):
    path: str


class CompileRequest(BaseModel):
    script_content: str
    script_name: str
    game: str = "fo4"
    import_dirs: Optional[List[str]] = None
    output_dir: Optional[str] = None


class ValidateRequest(BaseModel):
    script_content: str
    game: str = "fo4"


class GenerateTemplateRequest(BaseModel):
    extends: str
    script_type: str
    description: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    compiler = _find_compiler()
    return {
        "status": "ok",
        "service": "papyrus",
        "compiler_found": compiler is not None,
        "compiler_path": compiler,
        "games": ["fo4", "sse", "le"],
    }


@app.post("/set-compiler-path")
def set_compiler_path(req: SetCompilerPathRequest):
    p = req.path.strip()
    if not os.path.exists(p):
        return {"status": "error", "message": f"File not found: {p}"}
    COMPILER_PATH_FILE.write_text(p)
    return {"status": "ok", "message": "Compiler path saved", "path": p}


@app.post("/compile")
def compile_script(req: CompileRequest):
    compiler = _find_compiler()

    # Always validate first
    validation = _validate_script(req.script_content, req.game)

    if not compiler:
        return {
            "status": "no_compiler",
            "compiled": False,
            "output_path": None,
            "errors": ["PapyrusCompiler.exe not found. Install the Creation Kit and set the compiler path."],
            "warnings": [],
            "line_errors": [i for i in validation["issues"] if i["severity"] == "error"],
            "validation": validation,
        }

    # Write script to a temp file in the project data dir to avoid /tmp
    scripts_dir = DATA_DIR / "papyrus_temp"
    scripts_dir.mkdir(exist_ok=True)
    script_file = scripts_dir / f"{req.script_name}.psc"
    script_file.write_text(req.script_content, encoding="utf-8")

    output_dir = req.output_dir or str(scripts_dir / "output")
    os.makedirs(output_dir, exist_ok=True)

    flags = GAME_FLAGS.get(req.game, "Institute_Papyrus_Flags.flg")
    import_dirs = req.import_dirs or []

    cmd = [
        compiler,
        str(script_file),
        f"-f={flags}",
        f"-o={output_dir}",
    ]
    if import_dirs:
        cmd.append(f"-i={';'.join(import_dirs)}")

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        output = result.stdout + result.stderr
        errors = []
        warnings_out = []
        line_errors = []

        # Parse compiler output for line-level errors
        error_re = re.compile(r'\((\d+),\s*(\d+)\):\s*(.*)')
        for line in output.splitlines():
            if "error" in line.lower():
                m = error_re.search(line)
                if m:
                    line_errors.append({
                        "line": int(m.group(1)),
                        "col": int(m.group(2)),
                        "message": m.group(3).strip(),
                    })
                errors.append(line.strip())
            elif "warning" in line.lower():
                warnings_out.append(line.strip())

        compiled = result.returncode == 0
        output_path = os.path.join(output_dir, f"{req.script_name}.pex") if compiled else None

        return {
            "status": "ok",
            "compiled": compiled,
            "output_path": output_path,
            "errors": errors,
            "warnings": warnings_out,
            "line_errors": line_errors,
            "raw_output": output[:4096],
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "compiled": False, "output_path": None,
                "errors": ["Compiler timed out after 60s"], "warnings": [], "line_errors": []}
    except Exception as e:
        return {"status": "error", "compiled": False, "output_path": None,
                "errors": [str(e)], "warnings": [], "line_errors": []}


@app.post("/validate")
def validate(req: ValidateRequest):
    result = _validate_script(req.script_content, req.game)
    return {"status": "ok", **result}


@app.post("/generate-template")
def generate_template(req: GenerateTemplateRequest):
    script_type = req.script_type.lower()
    description = req.description or f"Auto-generated {req.extends} script"
    name = req.extends.replace(" ", "_")

    template = TEMPLATES.get(script_type, TEMPLATES["activator"])
    code = template.format(name=name, description=description)

    return {
        "status": "ok",
        "script_content": code,
        "script_name": name,
        "extends": req.extends,
        "script_type": script_type,
    }


@app.get("/common-events")
def common_events():
    return {"status": "ok", "events": COMMON_EVENTS}


@app.get("/snippet-library")
def snippet_library():
    categories = sorted(set(s["category"] for s in SNIPPET_LIBRARY))
    by_category = {
        cat: [s for s in SNIPPET_LIBRARY if s["category"] == cat]
        for cat in categories
    }
    return {
        "status": "ok",
        "snippets": SNIPPET_LIBRARY,
        "by_category": by_category,
        "count": len(SNIPPET_LIBRARY),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8014)
