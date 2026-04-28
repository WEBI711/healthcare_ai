// Context manager that stores chat context in MongoDB
import { ContextModel, IContext } from '#database/index.js';
import { Context } from '@mariozechner/pi-ai';

interface ContextManager {
  getContext: (phoneNumber: string) => Promise<Context | undefined>;
  createNewContext: (phoneNumber: string) => Promise<Context>;
  saveContext: (phoneNumber: string, context: Context) => Promise<void>;
  deleteContext: (phoneNumber: string) => Promise<void>;
}

export async function getContext(phoneNumber: string): Promise<Context | undefined> {
  const doc = await ContextModel.findOne({ phoneNumber });
  if (!doc) return undefined;
  return { messages: doc.messages };
}

export async function createNewContext(phoneNumber: string): Promise<Context> {
  const context: Context = {
    messages: [],
  };

  await ContextModel.create({
    phoneNumber,
    messages: context.messages,
  });

  return context;
}

export async function saveContext(phoneNumber: string, context: Context): Promise<void> {
  try {
    await ContextModel.findOneAndUpdate(
      { phoneNumber },
      {
        phoneNumber,
        messages: context.messages,
      },
      { upsert: true }
    );
  } catch (e) {
    console.log(e)
    throw new Error("Error saving context");
  }
}

export async function deleteContext(phoneNumber: string): Promise<void> {
  try {
    await ContextModel.deleteOne({ phoneNumber });
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
