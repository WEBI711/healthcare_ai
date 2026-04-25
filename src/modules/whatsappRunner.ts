import { startWhatsApp, sendTextMessage, sendTypingIndicator, stopTypingIndicator, WhatsAppMessage, WASocket } from './whatsapp.js';
import { handleUserMessage } from '../conversation.js';

export async function startWhatsAppMode(): Promise<void> {
  console.log('📱 WhatsApp Mode - Starting...\n');

  await startWhatsApp(async (message: WhatsAppMessage, sock: WASocket) => {
    console.log(`📨 Message from ${message.from}: ${message.text}`);

    // Show typing indicator
    await sendTypingIndicator(sock, message.from);

    await handleUserMessage(message.from, message.text, async (response) => {
      // Stop typing and send response
      await stopTypingIndicator(sock, message.from);
      await sendTextMessage(sock, message.from, response);
      console.log(`📤 Reply sent to ${message.from}`);
    });
  });
}
