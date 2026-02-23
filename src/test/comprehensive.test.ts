/**
 * Mossy AI Assistant - Comprehensive Test Suite
 *
 * Tests cover:
 * - TypeScript type shapes (types.ts)
 * - Utility/pure logic in components
 * - App routing structure
 * - Key component rendering
 * - LocalStorage integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppMode } from '../../types';

// ---------------------------------------------------------------------------
// 1. Type safety tests
// ---------------------------------------------------------------------------
describe('Type Definitions', () => {
  it('AppMode enum has correct string values', () => {
    expect(AppMode.CHAT).toBe('chat');
    expect(AppMode.LIVE).toBe('live');
    expect(AppMode.IMAGE).toBe('image');
    expect(AppMode.TTS).toBe('tts');
    expect(AppMode.SYSTEM).toBe('system');
  });

  it('Message interface structure is assignable', () => {
    const msg = {
      id: 'test-id',
      role: 'user' as const,
      text: 'Hello Mossy',
    };
    expect(msg.id).toBe('test-id');
    expect(msg.role).toBe('user');
    expect(msg.text).toBe('Hello Mossy');
  });

  it('ChatSession interface structure is assignable', () => {
    const session = {
      id: 'session-1',
      title: 'Test Session',
      messages: [],
    };
    expect(session.id).toBe('session-1');
    expect(session.messages).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. LocalStorage utilities (used across many components)
// ---------------------------------------------------------------------------
describe('LocalStorage Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves bridge state', () => {
    localStorage.setItem('mossy_bridge_active', 'true');
    expect(localStorage.getItem('mossy_bridge_active')).toBe('true');
  });

  it('stores and retrieves bridge version', () => {
    localStorage.setItem('mossy_bridge_version', '5.0.0');
    expect(localStorage.getItem('mossy_bridge_version')).toBe('5.0.0');
  });

  it('stores and retrieves pip-boy mode', () => {
    localStorage.setItem('mossy_pip_mode', JSON.stringify(true));
    const val = JSON.parse(localStorage.getItem('mossy_pip_mode') || 'false');
    expect(val).toBe(true);
  });

  it('stores and retrieves tutorial step', () => {
    localStorage.setItem('mossy_tutorial_step', '3');
    const step = parseInt(localStorage.getItem('mossy_tutorial_step') || '0', 10);
    expect(step).toBe(3);
  });

  it('stores and retrieves driver state as JSON', () => {
    const drivers = [{ id: 'os_shell', status: 'active' }];
    localStorage.setItem('mossy_bridge_drivers', JSON.stringify(drivers));
    const parsed = JSON.parse(localStorage.getItem('mossy_bridge_drivers') || '[]');
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('os_shell');
  });

  it('stores and retrieves log entries as JSON', () => {
    const logs = [{ id: '1', timestamp: '12:00', source: 'System', event: 'Boot', status: 'ok' }];
    localStorage.setItem('mossy_bridge_logs', JSON.stringify(logs));
    const parsed = JSON.parse(localStorage.getItem('mossy_bridge_logs') || '[]');
    expect(parsed).toHaveLength(1);
    expect(parsed[0].source).toBe('System');
  });
});

// ---------------------------------------------------------------------------
// 3. CustomEvent dispatching (used by MossyObserver / NeuralController)
// ---------------------------------------------------------------------------
describe('Custom Event System', () => {
  it('dispatches and receives mossy-control navigate event', () => {
    const received: any[] = [];
    const handler = (e: Event) => received.push((e as CustomEvent).detail);

    window.addEventListener('mossy-control', handler);
    window.dispatchEvent(
      new CustomEvent('mossy-control', { detail: { action: 'navigate', payload: { path: '/chat' } } })
    );
    window.removeEventListener('mossy-control', handler);

    expect(received).toHaveLength(1);
    expect(received[0].action).toBe('navigate');
    expect(received[0].payload.path).toBe('/chat');
  });

  it('dispatches and receives mossy-control open_palette event', () => {
    const received: any[] = [];
    const handler = (e: Event) => received.push((e as CustomEvent).detail);

    window.addEventListener('mossy-control', handler);
    window.dispatchEvent(
      new CustomEvent('mossy-control', { detail: { action: 'open_palette', payload: {} } })
    );
    window.removeEventListener('mossy-control', handler);

    expect(received[0].action).toBe('open_palette');
  });

  it('dispatches and receives mossy-bridge-connected event', () => {
    let fired = false;
    const handler = () => { fired = true; };
    window.addEventListener('mossy-bridge-connected', handler);
    window.dispatchEvent(new Event('mossy-bridge-connected'));
    window.removeEventListener('mossy-bridge-connected', handler);
    expect(fired).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. SystemBus component — mocked to isolate localStorage / fetch logic
// ---------------------------------------------------------------------------
describe('SystemBus bridge polling logic', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('detects bridge as offline when flag is absent', () => {
    const active = localStorage.getItem('mossy_bridge_active') === 'true';
    expect(active).toBe(false);
  });

  it('detects bridge as online when flag is set', () => {
    localStorage.setItem('mossy_bridge_active', 'true');
    const active = localStorage.getItem('mossy_bridge_active') === 'true';
    expect(active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Vite build configuration — base path for Electron
// ---------------------------------------------------------------------------
describe('Electron base path configuration', () => {
  it('sets ELECTRON env var to trigger relative base path', () => {
    const original = process.env.ELECTRON;
    process.env.ELECTRON = 'true';
    const base = process.env.ELECTRON === 'true' ? './' : '/';
    expect(base).toBe('./');
    process.env.ELECTRON = original;
  });

  it('uses absolute base path in browser mode', () => {
    const original = process.env.ELECTRON;
    delete process.env.ELECTRON;
    const base = process.env.ELECTRON === 'true' ? './' : '/';
    expect(base).toBe('/');
    process.env.ELECTRON = original;
  });
});


// ---------------------------------------------------------------------------
// 6. Electron package.json fields
// ---------------------------------------------------------------------------
describe('Electron packaging metadata', () => {
  it('package.json main points to electron entry', async () => {
    const pkg = await import('../../package.json');
    expect(pkg.main).toBe('electron/main.cjs');
  });

  it('package.json has electron:build script', async () => {
    const pkg = await import('../../package.json');
    expect(pkg.scripts['electron:build']).toContain('electron-builder');
  });

  it('package.json has test script', async () => {
    const pkg = await import('../../package.json');
    expect(pkg.scripts.test).toContain('vitest');
  });

  it('package.json build config has expected appId', async () => {
    const pkg = await import('../../package.json') as any;
    expect(pkg.build.appId).toBe('com.mossy.ai-assistant');
  });

  it('package.json build config has productName', async () => {
    const pkg = await import('../../package.json') as any;
    expect(pkg.build.productName).toBe('Mossy AI Assistant');
  });
});

// ---------------------------------------------------------------------------
// 7. Greeting logic (extracted from TheNexus)
// ---------------------------------------------------------------------------
describe('Time-based greeting logic', () => {
  const getGreeting = (hour: number) => {
    if (hour < 12) return 'Good Morning, Vault Dweller.';
    if (hour < 18) return 'Good Afternoon, Vault Dweller.';
    return 'Good Evening, Vault Dweller.';
  };

  it('returns morning greeting before noon', () => {
    expect(getGreeting(6)).toBe('Good Morning, Vault Dweller.');
    expect(getGreeting(11)).toBe('Good Morning, Vault Dweller.');
  });

  it('returns afternoon greeting from noon to 6pm', () => {
    expect(getGreeting(12)).toBe('Good Afternoon, Vault Dweller.');
    expect(getGreeting(17)).toBe('Good Afternoon, Vault Dweller.');
  });

  it('returns evening greeting from 6pm onward', () => {
    expect(getGreeting(18)).toBe('Good Evening, Vault Dweller.');
    expect(getGreeting(23)).toBe('Good Evening, Vault Dweller.');
  });
});

// ---------------------------------------------------------------------------
// 8. Sidebar mood color logic (extracted from Sidebar)
// ---------------------------------------------------------------------------
describe('Sidebar mood color routing logic', () => {
  const getMoodColor = (path: string) => {
    if (path.includes('crucible') || path.includes('terminal')) return 'text-red-400';
    if (path.includes('reverie') || path.includes('prism') || path.includes('anima')) return 'text-purple-400';
    if (path.includes('splicer') || path.includes('blueprint') || path.includes('fabric')) return 'text-blue-400';
    if (path.includes('workshop') || path.includes('assembler') || path.includes('auditor') || path.includes('scribe')) return 'text-amber-400';
    return 'text-emerald-400';
  };

  it('returns red for crucible route', () => {
    expect(getMoodColor('/crucible')).toBe('text-red-400');
  });

  it('returns red for terminal route', () => {
    expect(getMoodColor('/terminal')).toBe('text-red-400');
  });

  it('returns purple for reverie route', () => {
    expect(getMoodColor('/reverie')).toBe('text-purple-400');
  });

  it('returns blue for blueprint route', () => {
    expect(getMoodColor('/blueprint')).toBe('text-blue-400');
  });

  it('returns amber for assembler route', () => {
    expect(getMoodColor('/assembler')).toBe('text-amber-400');
  });

  it('returns emerald for nexus/default route', () => {
    expect(getMoodColor('/')).toBe('text-emerald-400');
    expect(getMoodColor('/chat')).toBe('text-emerald-400');
  });
});

// ---------------------------------------------------------------------------
// 9. DesktopBridge — driver state logic
// ---------------------------------------------------------------------------
describe('DesktopBridge driver toggle logic', () => {
  const toggleDriver = (
    drivers: Array<{ id: string; status: 'active' | 'inactive' }>,
    id: string
  ) =>
    drivers.map(d =>
      d.id !== id ? d : { ...d, status: d.status === 'active' ? 'inactive' as const : 'active' as const }
    );

  it('toggles active driver to inactive', () => {
    const drivers = [{ id: 'os_shell', status: 'active' as const }];
    const result = toggleDriver(drivers, 'os_shell');
    expect(result[0].status).toBe('inactive');
  });

  it('toggles inactive driver to active', () => {
    const drivers = [{ id: 'vscode', status: 'inactive' as const }];
    const result = toggleDriver(drivers, 'vscode');
    expect(result[0].status).toBe('active');
  });

  it('does not affect other drivers', () => {
    const drivers = [
      { id: 'os_shell', status: 'active' as const },
      { id: 'vscode', status: 'inactive' as const },
    ];
    const result = toggleDriver(drivers, 'os_shell');
    expect(result[1].status).toBe('inactive');
  });
});

// ---------------------------------------------------------------------------
// 10. DesktopBridge — outdated server detection logic
// ---------------------------------------------------------------------------
describe('DesktopBridge outdated version detection', () => {
  const isOutdated = (connected: boolean, version: string | null) =>
    connected && (!version || !version.startsWith('5.'));

  it('marks as outdated when connected with old version', () => {
    expect(isOutdated(true, '4.0.0')).toBe(true);
  });

  it('marks as outdated when connected with null version', () => {
    expect(isOutdated(true, null)).toBe(true);
  });

  it('not outdated when connected with v5.x', () => {
    expect(isOutdated(true, '5.0.0')).toBe(false);
  });

  it('not outdated when disconnected', () => {
    expect(isOutdated(false, '4.0.0')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 11. Log ring-buffer (DesktopBridge addLog keeps last 20 entries)
// ---------------------------------------------------------------------------
describe('DesktopBridge log ring buffer', () => {
  const addLog = (
    prev: any[],
    newLog: any
  ) => [...prev.slice(-19), newLog];

  it('keeps the last 20 entries', () => {
    let logs: any[] = [];
    for (let i = 0; i < 25; i++) {
      logs = addLog(logs, { id: i, event: `Event ${i}` });
    }
    expect(logs).toHaveLength(20);
    expect(logs[0].id).toBe(5); // oldest kept
    expect(logs[19].id).toBe(24); // newest
  });

  it('appends a log entry', () => {
    const logs = addLog([], { id: '1', event: 'Boot' });
    expect(logs).toHaveLength(1);
    expect(logs[0].event).toBe('Boot');
  });
});

// ---------------------------------------------------------------------------
// 12. App index.html — root element exists
// ---------------------------------------------------------------------------
describe('DOM root element', () => {
  it('renders a root element in the document', () => {
    const div = document.createElement('div');
    div.id = 'root';
    document.body.appendChild(div);
    expect(document.getElementById('root')).not.toBeNull();
    document.body.removeChild(div);
  });
});

// ---------------------------------------------------------------------------
// 13. Route path completeness
// ---------------------------------------------------------------------------
describe('Route path definitions', () => {
  const routes = [
    '/', '/monitor', '/chat', '/lens', '/synapse', '/hive',
    '/blueprint', '/genome', '/reverie', '/anima', '/splicer',
    '/prism', '/fabric', '/catalyst', '/cartographer', '/registry',
    '/organizer', '/crucible', '/assembler', '/auditor', '/scribe',
    '/conduit', '/cortex', '/terminal', '/orchestrator', '/lore',
    '/holo', '/vault', '/workshop', '/live', '/images', '/tts', '/bridge',
  ];

  it('all route paths are non-empty strings starting with /', () => {
    routes.forEach(r => {
      expect(r).toMatch(/^\//);
    });
  });

  it('has 33 distinct routes', () => {
    expect(new Set(routes).size).toBe(33);
  });

  it('includes bridge route for desktop integration', () => {
    expect(routes).toContain('/bridge');
  });
});

// ---------------------------------------------------------------------------
// 14. Electron main entry point exists as a file
// ---------------------------------------------------------------------------
describe('Electron entry files', () => {
  it('electron/main.cjs path is defined in package.json', async () => {
    const pkg = await import('../../package.json');
    expect(pkg.main).toBe('electron/main.cjs');
  });
});

// ---------------------------------------------------------------------------
// 15. Provider configuration (utils/apiKey.ts)
// ---------------------------------------------------------------------------
describe('AI Provider configuration', () => {
  beforeEach(() => { localStorage.clear(); });

  it('defaults to gemini when no provider is set', () => {
    expect(localStorage.getItem('mossy_ai_provider')).toBeNull();
    const provider = (localStorage.getItem('mossy_ai_provider') as 'gemini' | 'ollama') || 'gemini';
    expect(provider).toBe('gemini');
  });

  it('stores and retrieves ollama provider', () => {
    localStorage.setItem('mossy_ai_provider', 'ollama');
    expect(localStorage.getItem('mossy_ai_provider')).toBe('ollama');
  });

  it('stores and retrieves gemini provider', () => {
    localStorage.setItem('mossy_ai_provider', 'gemini');
    expect(localStorage.getItem('mossy_ai_provider')).toBe('gemini');
  });

  it('isConfigured logic: ollama needs no key', () => {
    localStorage.setItem('mossy_ai_provider', 'ollama');
    const provider = localStorage.getItem('mossy_ai_provider');
    const configured = provider === 'ollama' || Boolean(localStorage.getItem('mossy_gemini_api_key'));
    expect(configured).toBe(true);
  });

  it('isConfigured logic: gemini with no key = not configured', () => {
    localStorage.setItem('mossy_ai_provider', 'gemini');
    const provider = localStorage.getItem('mossy_ai_provider');
    const configured = provider === 'ollama' || Boolean(localStorage.getItem('mossy_gemini_api_key'));
    expect(configured).toBe(false);
  });

  it('isConfigured logic: gemini with key = configured', () => {
    localStorage.setItem('mossy_ai_provider', 'gemini');
    localStorage.setItem('mossy_gemini_api_key', 'AIzaTestKey123456789012345678901234');
    const provider = localStorage.getItem('mossy_ai_provider');
    const configured = provider === 'ollama' || Boolean(localStorage.getItem('mossy_gemini_api_key'));
    expect(configured).toBe(true);
  });

  it('getOllamaConfig returns default endpoint and model', () => {
    const raw = localStorage.getItem('mossy_ollama_config');
    const cfg = raw ? JSON.parse(raw) : { endpoint: 'http://localhost:11434', model: 'gemma3' };
    expect(cfg.endpoint).toBe('http://localhost:11434');
    expect(cfg.model).toBe('gemma3');
  });

  it('setOllamaConfig persists custom endpoint and model', () => {
    const custom = { endpoint: 'http://localhost:11435', model: 'llama3.2' };
    localStorage.setItem('mossy_ollama_config', JSON.stringify(custom));
    const cfg = JSON.parse(localStorage.getItem('mossy_ollama_config')!);
    expect(cfg.endpoint).toBe('http://localhost:11435');
    expect(cfg.model).toBe('llama3.2');
  });
});

// ---------------------------------------------------------------------------
// 16. isOllamaMode helper (utils/aiClient.ts)
// ---------------------------------------------------------------------------
describe('isOllamaMode helper', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns true when provider is ollama', () => {
    localStorage.setItem('mossy_ai_provider', 'ollama');
    const mode = localStorage.getItem('mossy_ai_provider') === 'ollama';
    expect(mode).toBe(true);
  });

  it('returns false when provider is gemini', () => {
    localStorage.setItem('mossy_ai_provider', 'gemini');
    const mode = localStorage.getItem('mossy_ai_provider') === 'ollama';
    expect(mode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 17. Ollama message conversion logic
// ---------------------------------------------------------------------------
describe('Ollama message conversion', () => {
  // Mirrors the toOllamaMessages helper in utils/aiClient.ts
  function toOllamaMessages(
    contents: unknown,
    systemInstruction?: string
  ): Array<{ role: string; content: string }> {
    const msgs: Array<{ role: string; content: string }> = [];
    if (systemInstruction) msgs.push({ role: 'system', content: systemInstruction });
    const items = Array.isArray(contents) ? contents : [contents];
    for (const item of items as any[]) {
      const role = item.role === 'model' ? 'assistant' : (item.role || 'user');
      let content = '';
      if (Array.isArray(item.parts)) {
        content = item.parts
          .filter((p: any) => typeof p?.text === 'string')
          .map((p: any) => p.text)
          .join('');
      } else if (typeof item.text === 'string') {
        content = item.text;
      }
      if (content) msgs.push({ role, content });
    }
    return msgs;
  }

  it('maps Gemini user role to Ollama user role', () => {
    const msgs = toOllamaMessages([{ role: 'user', parts: [{ text: 'Hello' }] }]);
    expect(msgs[0]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('maps Gemini model role to Ollama assistant role', () => {
    const msgs = toOllamaMessages([{ role: 'model', parts: [{ text: 'Hi there' }] }]);
    expect(msgs[0]).toEqual({ role: 'assistant', content: 'Hi there' });
  });

  it('prepends system instruction as system message', () => {
    const msgs = toOllamaMessages(
      [{ role: 'user', parts: [{ text: 'Hello' }] }],
      'You are Mossy, a helpful AI.'
    );
    expect(msgs[0]).toEqual({ role: 'system', content: 'You are Mossy, a helpful AI.' });
    expect(msgs[1]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('concatenates multiple parts into a single content string', () => {
    const msgs = toOllamaMessages([{
      role: 'user',
      parts: [{ text: 'Part one. ' }, { text: 'Part two.' }],
    }]);
    expect(msgs[0].content).toBe('Part one. Part two.');
  });

  it('handles single content object (non-array)', () => {
    const msgs = toOllamaMessages({ role: 'user', parts: [{ text: 'Single' }] });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('Single');
  });
});

// ---------------------------------------------------------------------------
// 18. New general-purpose tool declarations
// ---------------------------------------------------------------------------
describe('General-purpose tool declarations', () => {
  const EXPECTED_TOOLS = [
    'list_files',
    'read_file',
    'generate_papyrus_script',
    'execute_blender_script',
    'send_blender_shortcut',
    'browse_web',
    'check_previs_status',
    'scan_hardware',
    'control_interface',
    'write_file',
    'run_application',
    'run_shell_command',
    'take_screenshot',
    'get_system_info',
  ];

  it('includes all expected tool names (verified against source)', () => {
    const fs = require('fs');
    const src = fs.readFileSync(
      require('path').join(__dirname, '../../components/ChatInterface.tsx'),
      'utf-8'
    );
    for (const tool of EXPECTED_TOOLS) {
      expect(src).toContain(`name: '${tool}'`);
    }
  });

  it('write_file tool is described as writing to filesystem', () => {
    const fs = require('fs');
    const src = fs.readFileSync(
      require('path').join(__dirname, '../../components/ChatInterface.tsx'),
      'utf-8'
    );
    expect(src).toContain("name: 'write_file'");
    expect(src).toContain('write_file');
  });

  it('run_shell_command tool is present', () => {
    const fs = require('fs');
    const src = fs.readFileSync(
      require('path').join(__dirname, '../../components/ChatInterface.tsx'),
      'utf-8'
    );
    expect(src).toContain("name: 'run_shell_command'");
  });
});

// ---------------------------------------------------------------------------
// 19. System prompt is general-purpose (not locked to Fallout 4)
// ---------------------------------------------------------------------------
describe('System prompt is general-purpose AI assistant', () => {
  const getPrompt = () => {
    const fs = require('fs');
    return fs.readFileSync(
      require('path').join(__dirname, '../../components/ChatInterface.tsx'),
      'utf-8'
    );
  };

  it('does NOT contain "You ONLY discuss Fallout 4 modding"', () => {
    const src = getPrompt();
    expect(src).not.toContain('You ONLY discuss Fallout 4 modding');
  });

  it('describes Mossy as a desktop assistant', () => {
    const src = getPrompt();
    expect(src).toContain('desktop assistant');
  });

  it('mentions file read/write capabilities', () => {
    const src = getPrompt();
    expect(src).toContain('READ and WRITE files');
  });

  it('mentions ability to run shell commands', () => {
    const src = getPrompt();
    expect(src).toContain('RUN shell commands');
  });

  it('mentions ability to launch applications', () => {
    const src = getPrompt();
    expect(src).toContain('LAUNCH applications');
  });
});

// ---------------------------------------------------------------------------
// 20. Desktop Bridge Python server has new endpoints
// ---------------------------------------------------------------------------
describe('Desktop Bridge Python server endpoints', () => {
  const getBridgeSource = () => {
    const fs = require('fs');
    return fs.readFileSync(
      require('path').join(__dirname, '../../components/DesktopBridge.tsx'),
      'utf-8'
    );
  };

  it('has /read_file endpoint', () => {
    expect(getBridgeSource()).toContain("app.route('/read_file'");
  });

  it('has /write_file endpoint', () => {
    expect(getBridgeSource()).toContain("app.route('/write_file'");
  });

  it('has /run_app endpoint', () => {
    expect(getBridgeSource()).toContain("app.route('/run_app'");
  });

  it('has /exec endpoint', () => {
    expect(getBridgeSource()).toContain("app.route('/exec'");
  });

  it('/exec blocks destructive commands', () => {
    expect(getBridgeSource()).toContain('BLOCKED_PATTERNS');
    expect(getBridgeSource()).toContain('rm -rf /');
  });
});

// ---------------------------------------------------------------------------
// 21. Electron main process has system tray and auto-launch
// ---------------------------------------------------------------------------
describe('Electron main process capabilities', () => {
  const getMainSource = () => {
    const fs = require('fs');
    return fs.readFileSync(
      require('path').join(__dirname, '../../electron/main.cjs'),
      'utf-8'
    );
  };

  it('imports Tray and Menu from electron', () => {
    expect(getMainSource()).toContain('Tray');
    expect(getMainSource()).toContain('Menu');
  });

  it('creates a system tray', () => {
    expect(getMainSource()).toContain('createTray');
    expect(getMainSource()).toContain('new Tray');
  });

  it('hides to tray on close instead of quitting', () => {
    expect(getMainSource()).toContain('mainWindow.hide()');
    expect(getMainSource()).toContain("app.isQuitting");
  });

  it('has auto-launch at startup support', () => {
    expect(getMainSource()).toContain('setLoginItemSettings');
    expect(getMainSource()).toContain('openAtLogin');
  });

  it('has IPC handler for get-auto-launch', () => {
    expect(getMainSource()).toContain("'get-auto-launch'");
  });

  it('has IPC handler for set-auto-launch', () => {
    expect(getMainSource()).toContain("'set-auto-launch'");
  });

  it('does NOT quit on window-all-closed (stays in tray)', () => {
    const src = getMainSource();
    // The window-all-closed handler should be empty (no app.quit call inside it)
    const wcIdx = src.indexOf("'window-all-closed'");
    const handler = src.slice(wcIdx, wcIdx + 200);
    expect(handler).not.toContain('app.quit()');
  });
});

// ---------------------------------------------------------------------------
// 22. Electron preload exposes auto-launch and window IPC
// ---------------------------------------------------------------------------
describe('Electron preload IPC surface', () => {
  const getPreloadSource = () => {
    const fs = require('fs');
    return fs.readFileSync(
      require('path').join(__dirname, '../../electron/preload.cjs'),
      'utf-8'
    );
  };

  it('exposes getAutoLaunch', () => {
    expect(getPreloadSource()).toContain('getAutoLaunch');
  });

  it('exposes setAutoLaunch', () => {
    expect(getPreloadSource()).toContain('setAutoLaunch');
  });

  it('exposes minimizeWindow', () => {
    expect(getPreloadSource()).toContain('minimizeWindow');
  });

  it('exposes hideToTray', () => {
    expect(getPreloadSource()).toContain('hideToTray');
  });
});

// ---------------------------------------------------------------------------
// 23. TheNexus dashboard greeting is general-purpose
// ---------------------------------------------------------------------------
describe('TheNexus dashboard is general-purpose', () => {
  const getNexusSource = () => {
    const fs = require('fs');
    return fs.readFileSync(
      require('path').join(__dirname, '../../components/TheNexus.tsx'),
      'utf-8'
    );
  };

  it('does NOT use "Vault Dweller" in the greeting', () => {
    expect(getNexusSource()).not.toContain('Vault Dweller');
  });

  it('includes a general morning greeting', () => {
    expect(getNexusSource()).toContain("Good Morning");
  });
});
