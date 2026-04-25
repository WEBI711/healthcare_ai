# Code Context

## Files Retrieved
1. `src/index.ts` (lines 1-63) - Main entry point; sets up CLI chat loop with readline
2. `src/modules/model.ts` (lines 1-15) - Model configuration using Kimi K2.5 via OpenAI-compatible API
3. `src/modules/converse.ts` (lines 1-89) - Core streaming conversation handler with tool support
4. `src/modules/contextManager.ts` (lines 1-69) - MongoDB persistence for chat contexts
5. `src/modules/agent.ts` - Agent/tools definition (referenced but couldn't read full file)
6. `src/database/connection.ts` (lines 1-24) - MongoDB connection handling
7. `src/database/models/Context.ts` (lines 1-18) - Mongoose schema for chat context storage
8. `src/database/index.ts` (lines 1-3) - Database exports
9. `package.json` - Project dependencies and scripts
10. `tsconfig.json` - TypeScript configuration

## Key Code

### Model Configuration (`src/modules/model.ts`)
```typescript
const model: Model<'openai-completions'> = {
  id: 'kimi-k2.5',
  name: 'kimi-k2.5',
  api: 'openai-completions',
  provider: 'kimi-coding',
  baseUrl: 'https://api.moonshot.ai/v1',
  reasoning: true,
  contextWindow: 256000,
  maxTokens: 8192,
};
```

### Conversation Flow (`src/modules/converse.ts`)
- Uses `stream()` from `@mariozechner/pi-ai` for streaming responses
- Handles events: text_start/delta/end, thinking_start/delta/end, toolcall_start/delta/end
- Currently implements one tool: `get_time` with timezone support
- After tool calls, uses `complete()` for follow-up response

### Context Persistence (`src/modules/contextManager.ts`)
```typescript
interface ContextManager {
  getContext: (userId: string) => Promise<Context | undefined>;
  createNewContext: (userId: string) => Promise<Context>;
  saveContext: (userId: string, context: Context) => Promise<void>;
  deleteContext: (userId: string) => Promise<void>;
}
```

### Database Schema (`src/database/models/Context.ts`)
```typescript
interface IContext extends Document {
  userId: string;
  messages: any[];
  createdAt: Date;
  updatedAt: Date;
}
```

## Architecture

```
src/index.ts (CLI loop)
    ├── contextManager.getContext() / createNewContext()
    ├── run_conversation() loop
    │   └── converse(context, model)
    │       ├── stream(model, context)  ← AI response
    │       ├── s.result()              ← Final message
    │       └── complete(model, context) ← Tool follow-up
    └── contextManager.saveContext()

database/
    ├── connection.ts → MongoDB via Mongoose
    └── models/Context.ts → userId (unique), messages[]
```

### Dependencies
- `@mariozechner/pi-ai`: AI/chat framework
- `mongoose`: MongoDB ODM
- `dotenv`: Environment config

### Environment
- `MONGODB_URI`: MongoDB connection string (default: localhost)

## Start Here
`src/index.ts` - This is the main entry point that orchestrates the CLI chat interface, database connection, and conversation loop. It shows how all modules connect together.

## Notes & Risks
- Only one tool (`get_time`) is currently implemented in `converse.ts`
- The `agent.ts` file likely contains tool definitions but needs inspection
- Context messages are stored as `any[]` - no strict typing on message structure
- Hardcoded `userId = 'test-user-123'` in main (not multi-user ready)
- No input validation/sanitization on user input
