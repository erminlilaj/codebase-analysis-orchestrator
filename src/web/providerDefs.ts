export type ProviderDef = {
  id: string;
  name: string;
  envVar: string;
  models: string[];
};

export const PROVIDER_DEFS: ProviderDef[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    models: [
      'anthropic/claude-opus-4-5',
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-haiku-4-5',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    models: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/o3'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    models: ['deepseek/deepseek-chat', 'deepseek/deepseek-r1'],
  },
  {
    id: 'google',
    name: 'Google',
    envVar: 'GOOGLE_API_KEY',
    models: ['google/gemini-2.0-flash', 'google/gemini-2.5-pro'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    models: [
      'meta-llama/llama-3.3-70b-instruct',
      'mistralai/mistral-large',
      'qwen/qwen-2.5-72b-instruct',
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    envVar: 'GROQ_API_KEY',
    models: ['groq/llama-3.3-70b-versatile', 'groq/mixtral-8x7b-32768'],
  },
];
