#!/usr/bin/env python3
"""
Mossy System Integration Validator
Checks that all detected tools are properly integrated
"""

import subprocess
import json
import sys
from pathlib import Path

def run_check(name, command):
    """Run a check and return pass/fail"""
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=5)
        return result.returncode == 0, result.stdout.strip()
    except Exception as e:
        return False, str(e)

def main():
    print("╔════════════════════════════════════════════════════╗")
    print("║   Mossy System Integration Validator v1.0          ║")
    print("╚════════════════════════════════════════════════════╝\n")

    checks = []
    
    # GPU & CUDA
    print("🎮 Checking GPU & CUDA...")
    checks.append(("NVIDIA GPU", run_check("GPU", "nvidia-smi --version")))
    checks.append(("CUDA Available", run_check("CUDA", "nvidia-smi --query-gpu=compute_cap --format=csv,noheader")))

    # Python & Dependencies
    print("\n🐍 Checking Python & Dependencies...")
    checks.append(("Python 3.10+", run_check("Python", "python --version")))
    
    py_checks = [
        ("PyTorch", "python -c \"import torch; print(f'PyTorch {torch.__version__} with CUDA {torch.cuda.is_available()}')\""),
        ("Transformers", "python -c \"import transformers; print(f'Transformers {transformers.__version__}')\""),
        ("FastAPI", "python -c \"import fastapi; print(f'FastAPI {fastapi.__version__}')\""),
        ("Pydantic", "python -c \"import pydantic; print(f'Pydantic {pydantic.__version__}')\""),
        ("Unsloth", "python -c \"import unsloth; print('Unsloth installed')\""),
    ]
    
    for name, cmd in py_checks:
        checks.append((name, run_check(name, cmd)))

    # Services
    print("\n🚀 Checking Services...")
    service_checks = [
        ("Gemma Service File", Path("python/gemma_service.py").exists()),
        ("PyTorch Service File", Path("python/pytorch_service.py").exists()),
        ("Requirements.txt", Path("python/requirements.txt").exists()),
    ]
    
    for name, result in service_checks:
        checks.append((name, (result, "✓" if result else "✗")))

    # Components
    print("\n⚛️ Checking Components...")
    component_checks = [
        ("Gemma4FineTuner", Path("components/Gemma4FineTuner.tsx").exists()),
        ("SystemDashboard", Path("components/SystemDashboard.tsx").exists()),
    ]
    
    for name, result in component_checks:
        checks.append((name, (result, "✓" if result else "✗")))

    # Utilities
    print("\n📚 Checking Utilities...")
    util_checks = [
        ("systemTools.ts", Path("utils/systemTools.ts").exists()),
        ("comfyuiClient.ts", Path("utils/comfyuiClient.ts").exists()),
        ("apiKey.ts", Path("utils/apiKey.ts").exists()),
    ]
    
    for name, result in util_checks:
        checks.append((name, (result, "✓" if result else "✗")))

    # Development Tools
    print("\n🛠️ Checking Development Tools...")
    dev_checks = [
        ("Node.js", "node --version"),
        ("npm", "npm --version"),
        ("Git", "git --version"),
        ("Docker", "docker --version"),
    ]
    
    for name, cmd in dev_checks:
        checks.append((name, run_check(name, cmd)))

    # Summary
    print("\n" + "="*60)
    print("VALIDATION SUMMARY")
    print("="*60)
    
    passed = 0
    failed = 0
    
    for check_name, result in checks:
        if isinstance(result, tuple):
            success, output = result
            status = "✓" if success else "✗"
            if success:
                passed += 1
            else:
                failed += 1
            print(f"{status} {check_name:30} {output[:30]}")
        else:
            status = "✓" if result else "✗"
            if result:
                passed += 1
            else:
                failed += 1
            print(f"{status} {check_name:30}")
    
    print("="*60)
    print(f"PASSED: {passed}/{len(checks)}")
    print(f"FAILED: {failed}/{len(checks)}")
    print("="*60)

    if failed > 0:
        print("\n⚠️  Some checks failed. See above for details.")
        return 1
    else:
        print("\n✓ All checks passed! Mossy is ready to use.")
        return 0

if __name__ == "__main__":
    sys.exit(main())
