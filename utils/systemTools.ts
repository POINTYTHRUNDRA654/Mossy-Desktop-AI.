/**
 * System Tools Discovery & Registry
 * Automatically detects installed AI tools, CUDA, GPU, and development environments
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

// ─── Types ───────────────────────────────────────────────────────────────

export interface SystemTools {
    gpu: GPUInfo;
    cuda: CUDAInfo;
    frameworks: FrameworkInfo[];
    dockerAvailable: boolean;
    pythonVersions: PythonInfo[];
    gitAvailable: boolean;
}

export interface GPUInfo {
    available: boolean;
    driver: string;
    computeCapability: string;
    deviceName: string;
}

export interface CUDAInfo {
    versions: string[];
    toolkitPath?: string;
    cuDNNVersion?: string;
}

export interface FrameworkInfo {
    name: string;
    path: string;
    type: 'pytorch' | 'tensorflow' | 'comfyui' | 'ollama' | 'custom';
    version?: string;
}

export interface PythonInfo {
    path: string;
    version: string;
    isVenv: boolean;
}

// ─── Helper Functions ───────────────────────────────────────────────────

function tryExecSync(cmd: string): string {
    try {
        return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
        return '';
    }
}

function tryExec(cmd: string): boolean {
    try {
        execSync(cmd, { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

function pathExists(p: string): boolean {
    try {
        return existsSync(p);
    } catch {
        return false;
    }
}

// ─── GPU Detection ───────────────────────────────────────────────────────

function detectGPU(): GPUInfo {
    const info: GPUInfo = {
        available: false,
        driver: '',
        computeCapability: '',
        deviceName: '',
    };

    const output = tryExecSync('nvidia-smi --query-gpu=driver_version,compute_cap,name --format=csv,noheader');
    if (output) {
        const parts = output.split(',').map(s => s.trim());
        info.available = true;
        info.driver = parts[0] || '';
        info.computeCapability = parts[1] || '';
        info.deviceName = parts[2] || '';
    }

    return info;
}

// ─── CUDA Detection ──────────────────────────────────────────────────────

function detectCUDA(): CUDAInfo {
    const info: CUDAInfo = {
        versions: [],
        toolkitPath: undefined,
        cuDNNVersion: undefined,
    };

    // Check registry for CUDA installations
    const possiblePaths = [
        'C:\\Program Files\\NVIDIA GPU Computing Toolkit',
        'C:\\Program Files (x86)\\NVIDIA GPU Computing Toolkit',
        process.env['CUDA_PATH'],
    ].filter(Boolean) as string[];

    for (const basePath of possiblePaths) {
        if (!pathExists(basePath)) continue;

        const cudaDirs = tryExec(`Get-ChildItem "${basePath}" -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name`) ?
            readdirSync(basePath).filter(d => d.startsWith('v')) : [];

        for (const dir of cudaDirs) {
            const match = dir.match(/v(\d+\.\d+)/);
            if (match) {
                info.versions.push(match[1]);
                if (!info.toolkitPath) info.toolkitPath = join(basePath, dir);
            }
        }
    }

    // Check for cuDNN
    const cuDNNregex = tryExecSync('Get-ItemProperty HKLM:\\Software\\*\\* -Name DisplayName -ErrorAction SilentlyContinue | Where-Object {$_.DisplayName -match "cuDNN"} | Select-Object -ExpandProperty DisplayName');
    if (cuDNNregex) {
        const match = cuDNNregex.match(/cuDNN[^\d]*(\d+)/);
        info.cuDNNVersion = match ? match[1] : undefined;
    }

    return info;
}

// ─── Framework Detection ───────────────────────────────────────────────

function detectFrameworks(): FrameworkInfo[] {
    const frameworks: FrameworkInfo[] = [];

    const checkPaths: Array<[string, 'pytorch' | 'tensorflow' | 'comfyui' | 'ollama' | 'custom']> = [
        ['D:\\PyTorch', 'pytorch'],
        ['D:\\TensorFlow', 'tensorflow'],
        [process.env['USERPROFILE'] + '\\AppData\\Roaming\\ComfyUI', 'comfyui'],
        [process.env['USERPROFILE'] + '\\AppData\\Local\\Ollama', 'ollama'],
    ];

    for (const [path, type] of checkPaths) {
        if (pathExists(path)) {
            frameworks.push({
                name: type === 'pytorch' ? 'PyTorch' :
                    type === 'tensorflow' ? 'TensorFlow' :
                        type === 'comfyui' ? 'ComfyUI' :
                            type === 'ollama' ? 'Ollama' : type,
                path,
                type,
            });
        }
    }

    return frameworks;
}

// ─── Python Detection ────────────────────────────────────────────────

function detectPythonVersions(): PythonInfo[] {
    const versions: PythonInfo[] = [];

    const pythonExes = ['python', 'python3', 'python3.11', 'python3.12', 'python3.13'];
    const checked = new Set<string>();

    for (const exe of pythonExes) {
        const path = tryExecSync(`where ${exe}`).split('\n')[0].trim();
        if (path && !checked.has(path)) {
            const version = tryExecSync(`"${path}" --version`);
            const isVenv = path.includes('\\venv\\') || path.includes('\\env\\');
            versions.push({ path, version, isVenv });
            checked.add(path);
        }
    }

    return versions;
}

// ─── Tools Detection ─────────────────────────────────────────────────

function detectTools(): { dockerAvailable: boolean; gitAvailable: boolean } {
    return {
        dockerAvailable: tryExec('docker --version'),
        gitAvailable: tryExec('git --version'),
    };
}

// ─── Main Detection Function ────────────────────────────────────────────

export function detectSystemTools(): SystemTools {
    return {
        gpu: detectGPU(),
        cuda: detectCUDA(),
        frameworks: detectFrameworks(),
        pythonVersions: detectPythonVersions(),
        ...detectTools(),
    };
}

// ─── Human-Readable Report ──────────────────────────────────────────────

export function generateToolsReport(tools: SystemTools): string {
    let report = '╔════════════════════════════════════════════════════╗\n';
    report += '║           MOSSY SYSTEM TOOLS INVENTORY               ║\n';
    report += '╚════════════════════════════════════════════════════╝\n\n';

    report += '🎮 GPU:\n';
    if (tools.gpu.available) {
        report += `  ✓ ${tools.gpu.deviceName}\n`;
        report += `  ✓ Driver: ${tools.gpu.driver}\n`;
        report += `  ✓ Compute Capability: ${tools.gpu.computeCapability}\n`;
    } else {
        report += '  ✗ No NVIDIA GPU detected\n';
    }

    report += '\n📦 CUDA:\n';
    if (tools.cuda.versions.length > 0) {
        report += `  ✓ Versions: ${tools.cuda.versions.join(', ')}\n`;
        if (tools.cuda.cuDNNVersion) report += `  ✓ cuDNN: ${tools.cuda.cuDNNVersion}\n`;
    } else {
        report += '  ✗ CUDA not detected\n';
    }

    report += '\n🧠 AI Frameworks:\n';
    if (tools.frameworks.length > 0) {
        tools.frameworks.forEach(f => {
            report += `  ✓ ${f.name}: ${f.path}\n`;
        });
    } else {
        report += '  ✗ No frameworks detected\n';
    }

    report += '\n🐍 Python:\n';
    if (tools.pythonVersions.length > 0) {
        tools.pythonVersions.forEach(p => {
            report += `  ✓ ${p.path}\n    ${p.version}\n`;
        });
    } else {
        report += '  ✗ No Python installations found\n';
    }

    report += '\n🛠️ Development Tools:\n';
    if (tools.dockerAvailable) report += '  ✓ Docker\n';
    if (tools.gitAvailable) report += '  ✓ Git\n';

    return report;
}
