// This file should define model specific setup
import { Model, Type, Tool } from "@mariozechner/pi-ai"

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
};
export default model

