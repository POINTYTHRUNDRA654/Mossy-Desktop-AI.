/**
 * MossyContextBus — Shared context store for all modules.
 *
 * Any module can push an item (plan, note, code, research finding) onto the
 * bus.  Any other module can read it.  Items are persisted to localStorage so
 * they survive page navigation.  The bus holds the last 20 items.
 *
 * Usage:
 *   const { pushContext, items } = useMossyContext();
 *   pushContext({ source: 'ThePlanner', type: 'plan', title: 'Combat Overhaul', content: '...' });
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export interface ContextItem {
  id: string;
  source: string;
  type: 'plan' | 'note' | 'research' | 'code' | 'task' | 'finding';
  title: string;
  content: string;
  timestamp: string;
}

interface ContextBusState {
  items: ContextItem[];
  pushContext: (item: Omit<ContextItem, 'id' | 'timestamp'>) => void;
  removeContext: (id: string) => void;
  clearContext: () => void;
  getBySource: (source: string) => ContextItem[];
  getLatest: () => ContextItem | null;
}

const ContextBusContext = createContext<ContextBusState>({
  items: [],
  pushContext: () => {},
  removeContext: () => {},
  clearContext: () => {},
  getBySource: () => [],
  getLatest: () => null,
});

const STORAGE_KEY = 'mossy_context_bus';
const MAX_ITEMS = 20;

export const MossyContextBusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ContextItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage on change and broadcast to other components
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch {}
      window.dispatchEvent(new CustomEvent('mossy-context-update', { detail: items }));
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [items]);

  const pushContext = useCallback((item: Omit<ContextItem, 'id' | 'timestamp'>) => {
    const newItem: ContextItem = {
      ...item,
      id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    setItems(prev => [...prev.slice(-(MAX_ITEMS - 1)), newItem]);
  }, []);

  const removeContext = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const clearContext = useCallback(() => setItems([]), []);

  const getBySource = useCallback((source: string) => {
    return items.filter(i => i.source === source);
  }, [items]);

  const getLatest = useCallback((): ContextItem | null => {
    return items.length > 0 ? items[items.length - 1] : null;
  }, [items]);

  return (
    <ContextBusContext.Provider value={{ items, pushContext, removeContext, clearContext, getBySource, getLatest }}>
      {children}
    </ContextBusContext.Provider>
  );
};

export const useMossyContext = () => useContext(ContextBusContext);

export default ContextBusContext;
