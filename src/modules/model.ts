// This file should define model specific setup
import { Model } from "@mariozechner/pi-ai"
import { cronToolDefinitions } from '#modules/cronTools.js';

const model: Model<'openai-completions'> = {
  id: 'kimi-k2.5',
  name: 'kimi-k2.5',
  api: 'openai-completions',
  provider: 'kimi-coding',
  baseUrl: 'https://api.moonshot.ai/v1',
  reasoning: true,
  input: ['text', 'image'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 256000,
  maxTokens: 8192,
  // @ts-ignore - tools property may not be in type definition
  tools: [
    {
      name: 'get_time',
      description: 'Get the current time in a specific timezone',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Timezone (e.g., "America/New_York", "Europe/London", "UTC")'
          }
        },
        required: ['timezone']
      }
    },
    ...cronToolDefinitions
  ]
};
export default model

