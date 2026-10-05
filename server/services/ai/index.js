import { config } from '../../config.js';
import { mockProvider } from './mock.js';

const providers = { mock: mockProvider };

// To add a real provider, implement the interface documented in mock.js, register it here,
// and set AI_PROVIDER. Callers (routes/ai) never touch provider specifics.
export function getProvider() {
  const p = providers[config.aiProvider];
  if (!p) throw new Error(`Unknown AI_PROVIDER "${config.aiProvider}". Available: ${Object.keys(providers).join(', ')}`);
  return p;
}
