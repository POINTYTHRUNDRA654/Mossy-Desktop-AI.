/**
 * ClipboardBanner — Watches for clipboard changes (via Electron IPC) and
 * surfaces a one-tap AI action: summarise, debug, diagnose, etc.
 *
 * Rendered globally in App.tsx.  Only shows when content ≥ 20 chars and is
 * not a Mossy internal command.  Auto-dismisses after 12 seconds.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Clipboard, X, MessageSquare, Code, ExternalLink, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type ClipType = 'code' | 'url' | 'error' | 'text';

function detectType(text: string): ClipType {
  if (/^https?:\/\/\S+/.test(text.trim())) return 'url';
  if (/exception|EXCEPTION|crash|stack.?trace|error at 0x/i.test(text)) return 'error';
  // Rough heuristics: Python, JS, Papyrus, shell
  if (/\bfunction\b|\bimport\b|\bScriptName\b|\bdef \w+\(|\bclass \w+|\bif\s*\(|\bnpm\b/.test(text)) return 'code';
  return 'text';
}

const ICON_MAP: Record<ClipType, React.ElementType> = {
  code: Code,
  url: ExternalLink,
  error: FileText,
  text: Clipboard,
};

const LABEL_MAP: Record<ClipType, string> = {
  code: 'Code',
  url: 'URL',
  error: 'Crash log',
  text: 'Text',
};

const COLOR_MAP: Record<ClipType, string> = {
  code: 'text-blue-400',
  url: 'text-emerald-400',
  error: 'text-red-400',
  text: 'text-slate-400',
};

function actionsFor(type: ClipType, content: string) {
  switch (type) {
    case 'url':
      return [
        { label: 'Summarise', prompt: `Summarise the content at this URL:\n${content}` },
      ];
    case 'error':
      return [
        { label: 'Diagnose', prompt: `Analyse this crash log and identify the root cause:\n\n${content}` },
      ];
    case 'code':
      return [
        { label: 'Debug',   prompt: `Debug this code, identify any issues, and suggest fixes:\n\n\`\`\`\n${content}\n\`\`\`` },
        { label: 'Explain', prompt: `Explain what this code does in plain English:\n\n\`\`\`\n${content}\n\`\`\`` },
      ];
    default:
      return [
        { label: 'Summarise', prompt: `Summarise this text concisely:\n\n${content}` },
      ];
  }
}

const ClipboardBanner: React.FC = () => {
  const [clipText, setClipText] = useState<string | null>(null);
  const [type, setType] = useState<ClipType>('text');
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onClipboardChange) return; // web mode — skip

    const unsub: (() => void) | undefined = api.onClipboardChange((text: string) => {
      // Ignore very short clips or Mossy's own writes
      if (!text || text.length < 20 || text.startsWith('MOSSY_CMD:')) return;

      setClipText(text.slice(0, 2000));
      setType(detectType(text));
      setVisible(true);

      if (dismissRef.current) clearTimeout(dismissRef.current);
      dismissRef.current = setTimeout(() => setVisible(false), 12000);
    });

    return () => {
      unsub?.();
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, []);

  // Listen for clipboard action injection (from ClipboardBanner itself re-mounting)
  useEffect(() => {
    const pending = localStorage.getItem('mossy_clipboard_inject');
    if (pending) {
      localStorage.removeItem('mossy_clipboard_inject');
      window.dispatchEvent(new CustomEvent('mossy-clipboard-action', { detail: { prompt: pending } }));
    }
  }, []);

  if (!visible || !clipText) return null;

  const preview = clipText.length > 90 ? clipText.slice(0, 90) + '…' : clipText;
  const Icon = ICON_MAP[type];
  const actions = actionsFor(type, clipText);

  const handleAction = (prompt: string) => {
    localStorage.setItem('mossy_clipboard_inject', prompt);
    setVisible(false);
    navigate('/chat');
  };

  return (
    <div className="fixed bottom-8 left-72 z-40 max-w-sm animate-slide-up pointer-events-auto">
      <div className="bg-slate-900/95 backdrop-blur border border-slate-700 rounded-2xl p-4 shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${COLOR_MAP[type]}`} />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {LABEL_MAP[type]} in clipboard
            </span>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="text-slate-600 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Preview */}
        <p className="text-[11px] text-slate-500 font-mono bg-black/30 rounded-lg px-3 py-2 mb-3 truncate leading-relaxed">
          {preview}
        </p>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {actions.map(a => (
            <button
              key={a.label}
              onClick={() => handleAction(a.prompt)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              {a.label}
            </button>
          ))}
          <button
            onClick={() => setVisible(false)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold rounded-lg transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClipboardBanner;
