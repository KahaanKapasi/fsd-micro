import { config } from '../../config.js';
import { LANGUAGES } from './languages.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clip = (s, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Deterministic offline provider. Same interface a real provider (Gemini/OpenAI) must implement:
//   translate({text, targetLang}) -> string
//   transcribe({buffer, mimeType}) -> string
//   summarize({messages}) -> {keyPoints, decisions, openQuestions}
export const mockProvider = {
  name: 'mock',

  async translate({ text, targetLang }) {
    await sleep(config.mockAiLatencyMs);
    return `[${LANGUAGES[targetLang] || targetLang}] ${text}`;
  },

  async transcribe({ buffer, mimeType }) {
    await sleep(config.mockAiLatencyMs);
    return `(mock transcript of ${buffer.length} bytes of ${mimeType} audio)`;
  },

  async summarize({ messages }) {
    await sleep(config.mockAiLatencyMs);
    const lines = messages.filter((m) => m.text.trim());
    const decisionRe = /\b(decid\w*|agree\w*|let(?:'?s| us) go with|we(?:'| wi)ll|approv\w*|final\w*|go(?:ing)? with|settled)\b/i;
    const decisions = lines.filter((m) => decisionRe.test(m.text)).map((m) => `${m.author}: ${clip(m.text)}`);
    const openQuestions = lines.filter((m) => m.text.trim().endsWith('?')).map((m) => `${m.author}: ${clip(m.text)}`);
    const rest = lines.filter((m) => !decisions.some((d) => d.endsWith(clip(m.text))));
    // spread key points across the window rather than only taking the tail
    const step = Math.max(1, Math.ceil(rest.length / 5));
    const keyPoints = rest.filter((_, i) => i % step === 0).slice(0, 5).map((m) => `${m.author}: ${clip(m.text)}`);
    return { keyPoints, decisions: decisions.slice(0, 5), openQuestions: openQuestions.slice(0, 5) };
  },
};
