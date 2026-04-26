import { Type, Tool } from '@mariozechner/pi-ai';
import { cronToolDefinitions } from '#modules/cronTools.js';

export const tools: Tool[] = [
  ...cronToolDefinitions,
  {
    name: 'get_time',
    description: 'Get the current time in a specific timezone',
    parameters: Type.Object({
      timezone: Type.String({ description: 'Timezone (e.g., "America/New_York", "Europe/London", "UTC")' })
    })
  },
]
