import { startWhatsApp, sendTextMessage, sendTypingIndicator, stopTypingIndicator, WhatsAppMessage, WASocket } from '#modules/whatsapp.js';
import { handleUserMessage } from '#src/conversation.js';
import { check_if_allowed } from '#modules/allowlist_manager.js'
import { whatsAppService } from '#modules/whatsappService.js';
import { getAgenda, restoreAgendaJobs, stopAgenda } from '#modules/agenda.js';
import { defineAgendaJobs } from '#modules/agendaJobDefinitions.js';

export async function startWhatsAppMode(): Promise<void> {
  console.log('📱 WhatsApp Mode - Starting...\n');

  // Initialize Agenda
  const agenda = getAgenda();

  // Define job handlers
  await defineAgendaJobs();

  // Start Agenda processing
  await agenda.start();
  console.log('[Agenda] Agenda started');

  // Restore jobs from database
  await restoreAgendaJobs();

  await startWhatsApp(async (message: WhatsAppMessage, sock: WASocket) => {
    // Set the socket for the service (used by cron jobs)
    whatsAppService.setSocket(sock);

    console.log(`📨 Message from ${message.from_alt}: ${message.text}`);
    let is_allowed = await check_if_allowed(message.from_alt);
    if (!is_allowed) {
      console.log(`number ${message.from_alt} not in allowlist. Will not reply to message.`)
      return
    }

    // Show typing indicator
    await sendTypingIndicator(sock, message.from);

    await handleUserMessage(message.from_alt, message.text, async (response) => {
      // Stop typing and send response
      await stopTypingIndicator(sock, message.from);
      await sendTextMessage(sock, message.from, response);
      console.log(`📤 Reply sent to ${message.from}`);
    });
  });
}

export { stopAgenda };
