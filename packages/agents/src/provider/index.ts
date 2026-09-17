import { AnthropicProvider } from './anthropic.js';
import { DeterministicProvider } from './deterministic.js';
import type { AIProvider } from './types.js';

export * from './types.js';
export { DeterministicProvider } from './deterministic.js';
export { AnthropicProvider, buildPrompt, extractJson } from './anthropic.js';

/**
 * Provider selection. With no credentials the platform still works: it runs on
 * the deterministic corpus provider and says so on every run, rather than
 * showing a dead button.
 */
export function resolveProvider(env: NodeJS.ProcessEnv = process.env): AIProvider {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (env.AI_PROVIDER === 'deterministic' || !apiKey) return new DeterministicProvider();
  return new AnthropicProvider({
    apiKey,
    ...(env.ANTHROPIC_MODEL ? { model: env.ANTHROPIC_MODEL } : {}),
  });
}
