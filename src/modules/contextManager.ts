// Context manager that stores chat context in MongoDB
import { ContextModel, IContext } from '#database/index.js';
import { Context } from '@mariozechner/pi-ai';

interface ContextManager {
  getContext: (userId: string) => Promise<Context | undefined>;
  createNewContext: (userId: string) => Promise<Context>;
  saveContext: (userId: string, context: Context) => Promise<void>;
  deleteContext: (userId: string) => Promise<void>;
}

export async function getContext(userId: string): Promise<Context | undefined> {
  const doc = await ContextModel.findOne({ userId });
  if (!doc) return undefined;
  return { messages: doc.messages };
}

export async function createNewContext(userId: string): Promise<Context> {
  const context: Context = {
    messages: [
      { role: 'user', content: 'Hello, how are you?', timestamp: Date.now() },
    ],
  };

  await ContextModel.create({
    userId,
    messages: context.messages,
  });

  return context;
}

export async function saveContext(userId: string, context: Context): Promise<void> {
  try {
    await ContextModel.findOneAndUpdate(
      { userId },
      {
        userId,
        messages: context.messages,
      },
      { upsert: true }
    );
  } catch (e) {
    console.log(e)
    throw new Error("Error saving context");
  }
}

export async function deleteContext(userId: string): Promise<void> {
  try {
    await ContextModel.deleteOne({ userId });
  } catch (e) {
    console.log(e)
    throw new Error("Error deleting context");
  }
}

// Export as default context manager
const contextManager: ContextManager = {
  getContext,
  createNewContext,
  saveContext,
  deleteContext,
};

export default contextManager;
