import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Database, Zap, Github, Docker, AlertCircle, CheckCircle } from 'lucide-react';

interface SystemStatus {
    gpu: {
        available: boolean;
        driver: string;
        computeCapability: string;
        deviceName: string;
    };
    services: {
        gemma: boolean;
        pytorch: boolean;
        comfyui: boolean;
    };
    frameworks: string[];
    tools: {
        docker: boolean;
        git: boolean;
    };
}

/**
 * System Dashboard - Display all detected tools and services
 */
export const SystemDashboard: React.FC = () => {
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkSystemStatus();
        const interval = setInterval(checkSystemStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const checkSystemStatus = async () => {
        try {
            // Detect system tools
            const systemTools = await (window as any).electronAPI?.detectTools?.();

            // Check service health
            const gemmaHealth = await (window as any).electronAPI?.gemmaHealthCheck?.();
            const pytorchHealth = await (window as any).electronAPI?.pytorchHealthCheck?.();
            const comfyuiHealth = await (window as any).electronAPI?.comfyuiHealthCheck?.('http://127.0.0.1:8188');

            setStatus({
                gpu: systemTools?.gpu || { available: false, driver: '', computeCapability: '', deviceName: '' },
                services: {
                    gemma: gemmaHealth?.status === 'healthy' || gemmaHealth?.cuda_available,
                    pytorch: pytorchHealth?.status === 'healthy' || pytorchHealth?.pytorch_version,
                    comfyui: comfyuiHealth?.status === 'healthy',
                },
                frameworks: systemTools?.frameworks?.map((f: any) => f.name) || [],
                tools: {
                    docker: systemTools?.dockerAvailable || false,
                    git: systemTools?.gitAvailable || false,
                },
            });
        } catch (err) {
            console.error('Failed to check system status:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full p-6 bg-slate-900 rounded-lg border border-slate-700">
                <p className="text-slate-400">Loading system information...</p>
            </div>
        );
    }

    if (!status) {
        return (
            <div className="w-full p-6 bg-slate-900 rounded-lg border border-slate-700">
                <p className="text-red-400">Failed to load system information</p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg border border-slate-700">
                <h1 className="text-2xl font-bold text-white mb-2">System Dashboard</h1>
                <p className="text-slate-400">All tools and services detected on your system</p>
            </div>

            {/* GPU Status */}
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                    <Zap className={`w-5 h-5 ${status.gpu.available ? 'text-green-500' : 'text-red-500'}`} />
                    <h2 className="text-lg font-semibold text-white">GPU</h2>
                </div>
                {status.gpu.available ? (
                    <div className="space-y-2 text-sm">
                        <p><span className="text-slate-400">Device:</span> <span className="text-white font-mono">{status.gpu.deviceName}</span></p>
                        <p><span className="text-slate-400">Driver:</span> <span className="text-white font-mono">{status.gpu.driver}</span></p>
                        <p><span className="text-slate-400">Compute Capability:</span> <span className="text-white font-mono">{status.gpu.computeCapability}</span></p>
                        <p className="text-green-400 mt-2">✓ GPU acceleration enabled</p>
                    </div>
                ) : (
                    <p className="text-red-400">✗ No NVIDIA GPU detected</p>
                )}
            </div>

            {/* Services */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ServiceCard
                    name="Gemma 4"
                    icon={<Cpu className="w-5 h-5" />}
                    active={status.services.gemma}
                    description="Fine-tuning & Inference"
                    port="8000"
                />
                <ServiceCard
                    name="PyTorch"
                    icon={<Database className="w-5 h-5" />}
                    active={status.services.pytorch}
                    description="Custom Models"
                    port="8001"
                />
                <ServiceCard
                    name="ComfyUI"
                    icon={<Activity className="w-5 h-5" />}
                    active={status.services.comfyui}
                    description="Image Generation"
                    port="8188"
                />
            </div>

            {/* Frameworks */}
            {status.frameworks.length > 0 && (
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                    <h2 className="text-lg font-semibold text-white mb-3">AI Frameworks</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {status.frameworks.map((framework) => (
                            <div key={framework} className="px-3 py-2 bg-slate-900 rounded border border-slate-600 text-sm">
                                <CheckCircle className="w-4 h-4 text-green-500 inline mr-2" />
                                <span className="text-white">{framework}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Development Tools */}
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-3">Development Tools</h2>
                <div className="space-y-2">
                    <ToolStatus
                        name="Docker"
                        icon={<Docker className="w-4 h-4" />}
                        available={status.tools.docker}
                    />
                    <ToolStatus
                        name="Git"
                        icon={<Github className="w-4 h-4" />}
                        available={status.tools.git}
                    />
                </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                <div className="flex gap-2 items-start">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-blue-300 mb-1">Ready to Use</h3>
                        <p className="text-sm text-blue-200">
                            All major AI frameworks and tools are detected. Visit the respective UI components to start using them.
                        </p>
                    </div>
                </div>
            </div>

            {/* Refresh Button */}
            <button
                onClick={checkSystemStatus}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded transition"
            >
                Refresh Status
            </button>
        </div>
    );
};

interface ServiceCardProps {
    name: string;
    icon: React.ReactNode;
    active: boolean;
    description: string;
    port: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ name, icon, active, description, port }) => {
    return (
        <div className={`p-4 rounded-lg border ${active ? 'bg-slate-800 border-green-600' : 'bg-slate-800/50 border-slate-700'}`}>
            <div className="flex items-center gap-2 mb-2">
                <div className={`${active ? 'text-green-500' : 'text-slate-600'}`}>{icon}</div>
                <h3 className="font-semibold text-white">{name}</h3>
                {active && <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">Online</span>}
            </div>
            <p className="text-sm text-slate-400 mb-2">{description}</p>
            <p className="text-xs text-slate-500">Port: {port}</p>
        </div>
    );
};

interface ToolStatusProps {
    name: string;
    icon: React.ReactNode;
    available: boolean;
}

const ToolStatus: React.FC<ToolStatusProps> = ({ name, icon, available }) => {
    return (
        <div className="flex items-center gap-3 text-sm">
            <div className={`${available ? 'text-green-500' : 'text-slate-600'}`}>{icon}</div>
            <span className={available ? 'text-white' : 'text-slate-500'}>{name}</span>
            {available && <span className="text-xs text-green-400 ml-auto">Installed</span>}
        </div>
    );
};

export default SystemDashboard;
