import { getContext, createNewContext, saveContext } from './modules/contextManager.js';
import converse from './modules/converse.js';
import model from './modules/model.js';

export type ResponseCallback = (response: string) => Promise<void>;

export async function handleUserMessage(
  userId: string, 
  text: string, 
  responseCallback: ResponseCallback
): Promise<void> {
  // Get or create context for this user
  const context = await getContext(userId) ?? await createNewContext(userId);

  // Add user message to context
  context.messages.push({ role: 'user', content: text, timestamp: Date.now() });

  // Run conversation
  await converse(context, model);

  // Get the AI's response (last message in context)
  const lastMessage = context.messages[context.messages.length - 1];
  let responseText = '';
  
  if (lastMessage?.content && Array.isArray(lastMessage.content)) {
    // Extract text from content blocks
    for (const block of lastMessage.content) {
      if (typeof block === 'object' && 'type' in block && block.type === 'text' && 'text' in block) {
        responseText += block.text;
      }
    }
  }

  // Send response back
  await responseCallback(responseText || "I'm not sure how to respond to that.");

  // Save context
  await saveContext(userId, context);
}
