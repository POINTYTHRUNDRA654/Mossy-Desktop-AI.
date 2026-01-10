import React, { useEffect } from 'react';

const SystemBus: React.FC = () => {
    useEffect(() => {
        const handleLog = (source: string, event: string, status: 'ok' | 'warn' | 'err' | 'success') => {
            const newLog = {
                id: Date.now().toString() + Math.random(),
                timestamp: new Date().toLocaleTimeString(),
                source,
                event,
                status
            };
            
            try {
                const existing = JSON.parse(localStorage.getItem('mossy_bridge_logs') || '[]');
                const updated = [...existing.slice(-49), newLog]; // Keep last 50
                localStorage.setItem('mossy_bridge_logs', JSON.stringify(updated));
                // Dispatch storage event for other tabs/components
                window.dispatchEvent(new Event('storage'));
            } catch (e) { console.error(e); }
        };

        const handleBlenderCmd = (e: CustomEvent) => {
            handleLog('Blender', `Remote CMD: ${e.detail.description}`, 'warn');
            // Simulate execution time
            setTimeout(() => handleLog('Blender', 'Script executed. Scene Updated.', 'success'), 1000);
        };

        const handleShortcut = (e: CustomEvent) => {
            handleLog('Blender', `Keystroke: [ ${e.detail.keys} ] - ${e.detail.description}`, 'warn');
        };

        // Standard Control Event Handler
        const handleControl = (e: CustomEvent) => {
            if (e.detail.action === 'execute_script') {
                handleLog('System', `Executed internal script: ${e.detail.payload}`, 'ok');
            }
        };

        window.addEventListener('mossy-blender-command', handleBlenderCmd as EventListener);
        window.addEventListener('mossy-blender-shortcut', handleShortcut as EventListener);
        window.addEventListener('mossy-control', handleControl as EventListener);

        return () => {
            window.removeEventListener('mossy-blender-command', handleBlenderCmd as EventListener);
            window.removeEventListener('mossy-blender-shortcut', handleShortcut as EventListener);
            window.removeEventListener('mossy-control', handleControl as EventListener);
        };
    }, []);

    return null;
};

export default SystemBus;