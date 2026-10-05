import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

const BARS = 24;
const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// Records with MediaRecorder (for the waveform and the backend fallback) and, when the browser
// supports it, runs Web Speech API in parallel for instant text. stop() resolves with the transcript:
// browser speech if we got any, otherwise the audio is sent to POST /ai/transcribe.
export function useVoiceToText() {
  const [status, setStatus] = useState('idle'); // idle | recording | transcribing
  const [levels, setLevels] = useState(() => Array(BARS).fill(0));
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const ref = useRef({});

  const cleanup = useCallback(() => {
    const r = ref.current;
    cancelAnimationFrame(r.raf);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.audioCtx?.close().catch(() => {});
    try {
      r.recognition?.stop();
    } catch {
      /* already stopped */
    }
    ref.current = {};
    setLevels(Array(BARS).fill(0));
    setInterim('');
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.start();

      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevels(Array.from({ length: BARS }, (_, i) => data[i % data.length] / 255));
        ref.current.raf = requestAnimationFrame(tick);
      };

      let finalText = '';
      let recognition = null;
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (e) => {
          let live = '';
          for (let i = e.resultIndex; i < e.results.length; i += 1) {
            const res = e.results[i];
            if (res.isFinal) finalText += `${res[0].transcript} `;
            else live += res[0].transcript;
          }
          setInterim((finalText + live).trim());
        };
        recognition.onerror = () => {}; // fall back to the backend transcript
        try {
          recognition.start();
        } catch {
          recognition = null;
        }
      }

      ref.current = { stream, recorder, chunks, audioCtx, recognition, getFinal: () => finalText.trim(), mime: recorder.mimeType || 'audio/webm' };
      ref.current.raf = requestAnimationFrame(tick);
      setStatus('recording');
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop()); // don't leave the mic open if setup failed
      setError(e.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Could not start recording');
      cleanup();
      setStatus('idle');
    }
  }, [cleanup]);

  const stop = useCallback(async () => {
    const { recorder, chunks, getFinal, mime } = ref.current;
    if (!recorder) return '';
    setStatus('transcribing');
    await new Promise((resolve) => {
      recorder.onstop = resolve;
      recorder.stop();
    });
    const browserText = getFinal();
    cleanup();
    try {
      if (browserText) return browserText;
      const form = new FormData();
      form.append('audio', new Blob(chunks, { type: mime.split(';')[0] }), 'voice.webm');
      const { text } = await api.post('/ai/transcribe', form);
      return text;
    } catch (e) {
      setError(e.message);
      return '';
    } finally {
      setStatus('idle');
    }
  }, [cleanup]);

  const cancel = useCallback(() => {
    try {
      ref.current.recorder?.stop();
    } catch {
      /* not recording */
    }
    cleanup();
    setStatus('idle');
  }, [cleanup]);

  return { status, levels, interim, error, start, stop, cancel, supported: !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined' };
}
