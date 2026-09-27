import { type AIProvider, type ProviderId } from '../types';

import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { mockProvider } from './mock';
import { openaiProvider } from './openai';

export type ProviderMeta = {
  id: Exclude<ProviderId, 'mock'>;
  label: string;
  /** Default model; the user can change it in Settings → AI. */
  defaultModel: string;
  keyHelp: string;
};

/** Defaults documented here, never in the UI (step 31). */
export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-3.8-flash',
    keyHelp: 'Create a key in Google AI Studio (aistudio.google.com → Get API key).',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-6-astra',
    keyHelp: 'Create a key at platform.openai.com → API keys.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    defaultModel: 'claude-opus-5',
    keyHelp: 'Create a key at platform.claude.com → API keys.',
  },
];

export const providerMeta = (id: ProviderId) => PROVIDERS.find((p) => p.id === id);

export function createProvider(id: ProviderId, apiKey: string, model: string): AIProvider {
  switch (id) {
    case 'gemini':
      return geminiProvider(apiKey, model);
    case 'openai':
      return openaiProvider(apiKey, model);
    case 'anthropic':
      return anthropicProvider(apiKey, model);
    default:
      return mockProvider(model);
  }
}
