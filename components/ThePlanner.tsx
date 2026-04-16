import React, { useState, useEffect } from 'react';
import { ListTodo, Brain, Lightbulb, RefreshCw, ChevronRight, CheckCircle2, AlertCircle, Loader2, Zap, MessageSquare } from 'lucide-react';
import type { ElectronAPI } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlanResult {
    goal: string;
    steps: string[];
    summary: string;
    raw_plan: string;
    success: boolean;
}

interface ReflectResult {
    question: string;
    original_answer: string;
    critique: string;
    improved_answer: string;
    success: boolean;
}

interface CoTResult {
    problem: string;
    steps: string[];
    final_answer: string;
    full_reasoning: string;
    success: boolean;
}

interface ServiceHealth {
    status: string;
    model_loaded: boolean;
    current_model: string;
    cuda_available: boolean;
    gpu_name: string;
    gpu_vram_used_gb: number;
    gpu_vram_total_gb: number;
    unsloth_enabled: boolean;
    features: Record<string, boolean>;
}

type ActiveTab = 'plan' | 'reflect' | 'cot';

// ── Component ────────────────────────────────────────────────────────────────

const ThePlanner: React.FC = () => {
    const [activeTab, setActiveTab]         = useState<ActiveTab>('plan');
    const [health, setHealth]               = useState<ServiceHealth | null>(null);
    const [healthLoading, setHealthLoading] = useState(false);

    // Plan state
    const [goal, setGoal]                   = useState('');
    const [planContext, setPlanContext]      = useState('');
    const [maxSteps, setMaxSteps]           = useState(8);
    const [planResult, setPlanResult]       = useState<PlanResult | null>(null);
    const [planLoading, setPlanLoading]     = useState(false);
    const [planError, setPlanError]         = useState('');

    // Reflect state
    const [refQuestion, setRefQuestion]     = useState('');
    const [refAnswer, setRefAnswer]         = useState('');
    const [refContext, setRefContext]        = useState('');
    const [reflectResult, setReflectResult] = useState<ReflectResult | null>(null);
    const [reflectLoading, setReflectLoading] = useState(false);
    const [reflectError, setReflectError]   = useState('');

    // Chain-of-thought state
    const [cotProblem, setCotProblem]       = useState('');
    const [cotContext, setCotContext]        = useState('');
    const [cotResult, setCotResult]         = useState<CoTResult | null>(null);
    const [cotLoading, setCotLoading]       = useState(false);
    const [cotError, setCotError]           = useState('');

    useEffect(() => { fetchHealth(); }, []);

    // ── Health ──────────────────────────────────────────────────────────────

    const fetchHealth = async () => {
        setHealthLoading(true);
        try {
            const result = await window.electronAPI?.ipcInvoke('gemma:health-check');
            setHealth(result ?? null);
        } catch {
            setHealth(null);
        } finally {
            setHealthLoading(false);
        }
    };

    // ── Plan ────────────────────────────────────────────────────────────────

    const runPlan = async () => {
        if (!goal.trim()) { setPlanError('Please enter a goal.'); return; }
        setPlanLoading(true); setPlanError(''); setPlanResult(null);
        try {
            const result: PlanResult = await window.electronAPI?.ipcInvoke('gemma:plan', {
                goal: goal.trim(),
                context: planContext.trim() || undefined,
                max_steps: maxSteps,
            });
            if (result?.success) setPlanResult(result);
            else setPlanError(result?.raw_plan ?? 'Planning failed.');
        } catch (e) {
            setPlanError(String(e));
        } finally {
            setPlanLoading(false);
        }
    };

    // ── Reflect ─────────────────────────────────────────────────────────────

    const runReflect = async () => {
        if (!refQuestion.trim() || !refAnswer.trim()) {
            setReflectError('Please enter both a question and an answer to critique.');
            return;
        }
        setReflectLoading(true); setReflectError(''); setReflectResult(null);
        try {
            const result: ReflectResult = await window.electronAPI?.ipcInvoke('gemma:reflect', {
                question: refQuestion.trim(),
                answer: refAnswer.trim(),
                context: refContext.trim() || undefined,
            });
            if (result?.success) setReflectResult(result);
            else setReflectError('Reflection failed.');
        } catch (e) {
            setReflectError(String(e));
        } finally {
            setReflectLoading(false);
        }
    };

    // ── Chain-of-Thought ────────────────────────────────────────────────────

    const runCoT = async () => {
        if (!cotProblem.trim()) { setCotError('Please enter a problem.'); return; }
        setCotLoading(true); setCotError(''); setCotResult(null);
        try {
            const result: CoTResult = await window.electronAPI?.ipcInvoke('gemma:chain-of-thought', {
                problem: cotProblem.trim(),
                context: cotContext.trim() || undefined,
            });
            if (result?.success) setCotResult(result);
            else setCotError('Chain-of-thought failed.');
        } catch (e) {
            setCotError(String(e));
        } finally {
            setCotLoading(false);
        }
    };

    // ── Render ──────────────────────────────────────────────────────────────

    const tabClass = (t: ActiveTab) =>
        `px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
            activeTab === t
                ? 'border-emerald-500 text-emerald-300 bg-emerald-950/30'
                : 'border-transparent text-slate-500 hover:text-slate-300'
        }`;

    return (
        <div className="h-full flex flex-col bg-[#050910] text-slate-200 overflow-hidden">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <ListTodo className="w-5 h-5 text-emerald-400" />
                    <div>
                        <h1 className="text-base font-bold text-white">The Planner</h1>
                        <p className="text-[10px] text-slate-500">Goal decomposition · Self-reflection · Chain-of-thought</p>
                    </div>
                </div>
                {/* GPU status badge */}
                {health && (
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold border ${
                        health.model_loaded
                            ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400'
                            : 'border-amber-500/40 bg-amber-950/30 text-amber-400'
                    }`}>
                        <Zap className="w-3 h-3" />
                        {health.model_loaded
                            ? `${health.unsloth_enabled ? 'Unsloth · ' : ''}${health.gpu_name || 'CPU'}`
                            : 'Model not loaded'}
                    </div>
                )}
                <button onClick={fetchHealth} disabled={healthLoading}
                    className="p-1.5 rounded text-slate-500 hover:text-emerald-400 transition-colors">
                    <RefreshCw className={`w-4 h-4 ${healthLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* ── GPU info strip ── */}
            {health?.cuda_available && (
                <div className="px-6 py-2 bg-slate-900/50 border-b border-slate-800 flex items-center gap-6 text-[10px] text-slate-500">
                    <span>🖥 <span className="text-slate-400">{health.gpu_name}</span></span>
                    <span>VRAM: <span className="text-emerald-400">{health.gpu_vram_used_gb} / {health.gpu_vram_total_gb} GB</span></span>
                    <span>Model: <span className="text-slate-400">{health.current_model || '—'}</span></span>
                    {health.unsloth_enabled && <span className="text-emerald-500 font-bold">⚡ Unsloth 4-bit</span>}
                </div>
            )}

            {/* ── Tabs ── */}
            <div className="flex border-b border-slate-800 px-4 pt-2 bg-slate-900/30">
                <button className={tabClass('plan')} onClick={() => setActiveTab('plan')}>
                    <span className="flex items-center gap-1.5"><ListTodo className="w-3 h-3" /> Goal Planner</span>
                </button>
                <button className={tabClass('cot')} onClick={() => setActiveTab('cot')}>
                    <span className="flex items-center gap-1.5"><Brain className="w-3 h-3" /> Chain-of-Thought</span>
                </button>
                <button className={tabClass('reflect')} onClick={() => setActiveTab('reflect')}>
                    <span className="flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> Self-Reflect</span>
                </button>
            </div>

            {/* ── Tab content ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">

                {/* ── PLAN tab ── */}
                {activeTab === 'plan' && (
                    <>
                        <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-5 space-y-4">
                            <h2 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                                <ListTodo className="w-4 h-4" /> Goal Decomposition
                            </h2>
                            <p className="text-xs text-slate-500">
                                Give Mossy a high-level goal and she will break it down into a concrete,
                                ordered action plan using her full reasoning capability.
                            </p>
                            <div className="space-y-3">
                                <label className="block text-xs font-medium text-slate-400">Goal</label>
                                <textarea
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    placeholder="e.g. Build a self-improving AI assistant that can write and execute code..."
                                    rows={3}
                                    className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
                                />
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Context (optional)</label>
                                        <textarea
                                            value={planContext}
                                            onChange={(e) => setPlanContext(e.target.value)}
                                            placeholder="Additional context or constraints..."
                                            rows={2}
                                            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
                                        />
                                    </div>
                                    <div className="w-28">
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Max steps</label>
                                        <input
                                            type="number" min={2} max={20}
                                            value={maxSteps}
                                            onChange={(e) => setMaxSteps(Number(e.target.value))}
                                            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>
                                {planError && (
                                    <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded p-3">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        {planError}
                                    </div>
                                )}
                                <button onClick={runPlan} disabled={planLoading || !goal.trim()}
                                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors">
                                    {planLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    {planLoading ? 'Planning...' : 'Generate Plan'}
                                </button>
                            </div>
                        </div>

                        {planResult && (
                            <div className="rounded-lg bg-emerald-950/20 border border-emerald-800/40 p-5 space-y-4">
                                <h3 className="text-sm font-semibold text-emerald-300">Action Plan</h3>
                                {planResult.summary && (
                                    <p className="text-xs text-slate-400 italic">"{planResult.summary}"</p>
                                )}
                                <ol className="space-y-3">
                                    {planResult.steps.map((step, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-800/60 border border-emerald-600/50 flex items-center justify-center text-[10px] font-bold text-emerald-300">
                                                {i + 1}
                                            </span>
                                            <span className="text-sm text-slate-200 leading-relaxed pt-0.5">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                                <button onClick={() => {
                                    setRefQuestion(goal);
                                    setRefAnswer(planResult.raw_plan);
                                    setActiveTab('reflect');
                                }} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                                    <ChevronRight className="w-3 h-3" /> Send to Self-Reflect for critique
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* ── CHAIN-OF-THOUGHT tab ── */}
                {activeTab === 'cot' && (
                    <>
                        <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-5 space-y-4">
                            <h2 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                                <Brain className="w-4 h-4" /> Chain-of-Thought Reasoning
                            </h2>
                            <p className="text-xs text-slate-500">
                                Mossy solves your problem step-by-step, showing her full reasoning process
                                before giving a final answer. Ideal for complex logic, math, or multi-part questions.
                            </p>
                            <div className="space-y-3">
                                <label className="block text-xs font-medium text-slate-400">Problem</label>
                                <textarea
                                    value={cotProblem}
                                    onChange={(e) => setCotProblem(e.target.value)}
                                    placeholder="Describe the problem you want Mossy to reason through..."
                                    rows={4}
                                    className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
                                />
                                <label className="block text-xs font-medium text-slate-400">Context (optional)</label>
                                <textarea
                                    value={cotContext}
                                    onChange={(e) => setCotContext(e.target.value)}
                                    placeholder="Additional facts or background..."
                                    rows={2}
                                    className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
                                />
                                {cotError && (
                                    <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded p-3">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        {cotError}
                                    </div>
                                )}
                                <button onClick={runCoT} disabled={cotLoading || !cotProblem.trim()}
                                    className="flex items-center gap-2 px-5 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors">
                                    {cotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                                    {cotLoading ? 'Reasoning...' : 'Think Step-by-Step'}
                                </button>
                            </div>
                        </div>

                        {cotResult && (
                            <div className="rounded-lg bg-purple-950/20 border border-purple-800/40 p-5 space-y-4">
                                <h3 className="text-sm font-semibold text-purple-300">Reasoning Steps</h3>
                                <div className="space-y-2">
                                    {cotResult.steps.map((step, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                            <ChevronRight className="w-3 h-3 text-purple-500 shrink-0 mt-0.5" />
                                            <span className="leading-relaxed">{step}</span>
                                        </div>
                                    ))}
                                </div>
                                {cotResult.final_answer && (
                                    <div className="mt-4 p-4 rounded bg-purple-900/30 border border-purple-700/40">
                                        <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Final Answer
                                        </div>
                                        <p className="text-sm text-slate-100 leading-relaxed">{cotResult.final_answer}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ── REFLECT tab ── */}
                {activeTab === 'reflect' && (
                    <>
                        <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-5 space-y-4">
                            <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" /> Self-Reflection & Critique
                            </h2>
                            <p className="text-xs text-slate-500">
                                Mossy critiques an existing answer, identifies what's wrong or missing,
                                then produces an improved version — a "think-twice" loop for better accuracy.
                            </p>
                            <div className="space-y-3">
                                <label className="block text-xs font-medium text-slate-400">Original Question</label>
                                <textarea
                                    value={refQuestion}
                                    onChange={(e) => setRefQuestion(e.target.value)}
                                    placeholder="What was the question asked?"
                                    rows={2}
                                    className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                                />
                                <label className="block text-xs font-medium text-slate-400">Previous Answer to Critique</label>
                                <textarea
                                    value={refAnswer}
                                    onChange={(e) => setRefAnswer(e.target.value)}
                                    placeholder="Paste the answer you want Mossy to evaluate and improve..."
                                    rows={4}
                                    className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                                />
                                <label className="block text-xs font-medium text-slate-400">Context (optional)</label>
                                <textarea
                                    value={refContext}
                                    onChange={(e) => setRefContext(e.target.value)}
                                    placeholder="Any additional context..."
                                    rows={2}
                                    className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                                />
                                {reflectError && (
                                    <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded p-3">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        {reflectError}
                                    </div>
                                )}
                                <button onClick={runReflect}
                                    disabled={reflectLoading || !refQuestion.trim() || !refAnswer.trim()}
                                    className="flex items-center gap-2 px-5 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors">
                                    {reflectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                                    {reflectLoading ? 'Reflecting...' : 'Critique & Improve'}
                                </button>
                            </div>
                        </div>

                        {reflectResult && (
                            <div className="space-y-4">
                                <div className="rounded-lg bg-red-950/20 border border-red-800/30 p-5">
                                    <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Critique
                                    </h3>
                                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                        {reflectResult.critique}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-emerald-950/20 border border-emerald-800/30 p-5">
                                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Improved Answer
                                    </h3>
                                    <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">
                                        {reflectResult.improved_answer}
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ThePlanner;
