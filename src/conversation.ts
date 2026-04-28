import { getContext, createNewContext, saveContext } from '#modules/contextManager.js';
import converse from '#modules/converse.js';
import model from '#modules/model.js';
import { cronToolDefinitions } from '#modules/cronTools.js';
import { patientToolDefinitions } from '#modules/patientTools.js';
import { getPatientContext } from '#modules/patientContext.js';
import { Type, Tool } from '@mariozechner/pi-ai';

export type ResponseCallback = (response: string) => Promise<void>;

export async function handleUserMessage(
  userId: string,
  text: string,
  responseCallback: ResponseCallback,
  phoneNumber?: string
): Promise<void> {
  // Check patient registration and build enriched context
  const patientCtx = await getPatientContext(userId);
  if (!patientCtx) {
    await responseCallback("Hi! It looks like you're not registered in our system. Please contact your clinic or healthcare provider to get set up.");
    return;
  }

  // Get or create conversation context for this user
  const chatContext = await getContext(userId) ?? await createNewContext(userId);
  // Set the system prompt from patient context (not stored in DB, set fresh each time)
  chatContext.systemPrompt = patientCtx.context.systemPrompt;

  // Assemble tools
  chatContext.tools = [
    ...cronToolDefinitions,
    ...patientToolDefinitions,
    {
      name: 'get_time',
      description: 'Get the current time in a specific timezone',
      parameters: Type.Object({
        timezone: Type.String({ description: 'Timezone (e.g., "America/New_York", "Europe/London", "UTC")' })
      })
    },
  ]

  // Add user message to context
  chatContext.messages.push({ role: 'user', content: text, timestamp: Date.now() });

  // Run conversation with user context
  await converse(chatContext, model, {
    userId,
    phoneNumber: phoneNumber || userId
  });

  // Get the AI's response (last message in context)
  const lastMessage = chatContext.messages[chatContext.messages.length - 1];
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
  await saveContext(userId, chatContext);
}
