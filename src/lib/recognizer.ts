/**
 * Reconnaissance vocale 100 % sur le téléphone (pas de serveur, gratuit, hors ligne).
 * Modèle : tarteel-ai/whisper-base-ar-quran (Apache-2.0) converti pour whisper.cpp.
 * Le micro est découpé en tranches par la détection de voix (Silero VAD) ; chaque
 * tranche est transcrite et renvoyée, avec des résultats partiels pendant qu'on parle.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import { initWhisper, initWhisperVad, type WhisperContext, type WhisperVadContext } from 'whisper.rn';
import { RealtimeTranscriber, RingBufferVad } from 'whisper.rn/realtime-transcription/index';
import { AudioPcmStreamAdapter } from 'whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter';

let whisper: WhisperContext | null = null;
let vad: WhisperVadContext | null = null;
let loading: Promise<void> | null = null;

/** Charge les modèles une seule fois (quelques secondes au premier lancement). */
export function loadModels(): Promise<void> {
  if (whisper && vad) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      whisper = await initWhisper({
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        filePath: require('../../assets/models/ggml-quran-base-q5_0.bin'),
        useGpu: true,
      });
      vad = await initWhisperVad({
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        filePath: require('../../assets/models/ggml-silero-v6.2.0.bin'),
        useGpu: true,
        nThreads: 2,
      });
    })().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

export async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS affiche la demande au premier enregistrement
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone',
    message: "Le micro sert à écouter ta récitation. Tout reste sur ton téléphone, rien n'est envoyé.",
    buttonPositive: 'Autoriser',
  });
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export interface SessionCallbacks {
  /** Toutes les transcriptions de la session, dans l'ordre (la dernière peut être partielle). */
  onChunks: (chunks: string[]) => void;
  onListening?: (speaking: boolean) => void;
  onError?: (message: string) => void;
}

export interface Session {
  stop: () => Promise<void>;
}

export async function startSession(cb: SessionCallbacks): Promise<Session> {
  await loadModels();
  if (!whisper || !vad) throw new Error('Modèles non chargés');

  const slices = new Map<number, string>();
  const emit = () => {
    const ordered = [...slices.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t);
    cb.onChunks(ordered);
  };

  const transcriber = new RealtimeTranscriber(
    {
      whisperContext: whisper,
      vadContext: new RingBufferVad(vad, { vadPreset: 'continuous' }),
      audioStream: new AudioPcmStreamAdapter(),
    },
    {
      audioSliceSec: 20,
      audioMinSec: 0.6,
      maxSlicesInMemory: 2,
      // Pas de texte attendu dans le prompt : on ne veut pas que le modèle « entende »
      // le bon verset alors que la personne s'est trompée.
      promptPreviousSlices: false,
      transcribeOptions: { language: 'ar', maxThreads: 4, temperature: 0 },
    },
    {
      onTranscribe: (event) => {
        const text = event.data?.result?.trim();
        if (event.type === 'transcribe' && text) {
          slices.set(event.sliceIndex, text);
          emit();
        }
      },
      onVad: (event) => {
        if (event.type === 'speech_start') cb.onListening?.(true);
        if (event.type === 'speech_end' || event.type === 'silence') cb.onListening?.(false);
      },
      onError: (e) => cb.onError?.(e),
    },
  );

  await transcriber.start();
  return {
    stop: async () => {
      await transcriber.stop();
      transcriber.release();
    },
  };
}
