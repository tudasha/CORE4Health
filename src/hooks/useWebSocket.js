import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

export function useWebSocket() {
  const ws = useRef(null);
  const [healthUpdate, setHealthUpdate] = useState(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    try {
      ws.current = new WebSocket(WS_URL);
      ws.current.onopen = () => setConnected(true);
      ws.current.onclose = () => { setConnected(false); setTimeout(connect, 4000); };
      ws.current.onerror = () => ws.current?.close();
      ws.current.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'HEALTH_UPDATE') setHealthUpdate(msg);
        } catch {}
      };
    } catch { setTimeout(connect, 4000); }
  }, []);

  useEffect(() => { connect(); return () => ws.current?.close(); }, [connect]);

  return { healthUpdate, connected };
}
