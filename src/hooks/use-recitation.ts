import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { evaluate } from '@/lib/matcher';
import type { FlatSurah } from '@/lib/quran';
import { loadModels, requestMicPermission, startSession, type Session } from '@/lib/recognizer';

export type RecitationState = 'idle' | 'loading' | 'listening' | 'error';

export function useRecitation(flat: FlatSurah, start: number) {
  const [state, setState] = useState<RecitationState>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chunks, setChunks] = useState<string[]>([]);
  const session = useRef<Session | null>(null);
  const chunksRef = useRef<string[]>([]);
  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  // Précharge le modèle dès l'ouverture de l'écran.
  useEffect(() => {
    loadModels().catch(() => {});
  }, []);

  const result = useMemo(() => evaluate(flat.words, start, chunks), [flat, start, chunks]);

  const stop = useCallback(async () => {
    const s = session.current;
    session.current = null;
    setSpeaking(false);
    setState('idle');
    deactivateKeepAwake();
    await s?.stop().catch(() => {});
  }, []);

  const begin = useCallback(async () => {
    setError(null);
    setState('loading');
    try {
      if (!(await requestMicPermission())) {
        throw new Error("Autorise le micro dans les réglages pour qu'on puisse t'écouter.");
      }
      // Après une pause, on continue là où on s'était arrêté.
      const previous = chunksRef.current;
      session.current = await startSession({
        onChunks: (c) => setChunks([...previous, ...c]),
        onListening: setSpeaking,
        onError: (m) => setError(m),
      });
      await activateKeepAwakeAsync();
      setState('listening');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }, []);

  const reset = useCallback(() => setChunks([]), []);

  useEffect(() => () => void session.current?.stop(), []);

  return { state, speaking, error, result, begin, stop, reset, hasStarted: chunks.length > 0 };
}
