import { startWhatsApp, sendTextMessage, sendTypingIndicator, stopTypingIndicator, WhatsAppMessage, WASocket } from '#modules/whatsapp.js';
import { handleUserMessage } from '#src/conversation.js';
import { check_if_allowed } from '#modules/allowlist_manager.js'
import { whatsAppService } from '#modules/whatsappService.js';

export async function startWhatsAppMode(): Promise<void> {
  console.log('📱 WhatsApp Mode - Starting...\n');

  await startWhatsApp(async (message: WhatsAppMessage, sock: WASocket) => {
    console.log(`📨 Message from ${message.from_alt}: ${message.text}`);
    let is_allowed = await check_if_allowed(message.from_alt);
    if (!is_allowed) {
      console.log(`number ${message.from_alt} not in allowlist. Will not reply to message.`)
      return
    }

    // Show typing indicator
    await sendTypingIndicator(sock, message.from);

    await handleUserMessage(message.from, message.text, async (response) => {
      // Stop typing and send response
      await stopTypingIndicator(sock, message.from);
      await sendTextMessage(sock, message.from, response);
      console.log(`📤 Reply sent to ${message.from}`);
    }, message.from);
  });
}
