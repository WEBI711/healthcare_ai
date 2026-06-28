import { connectionManager, WhatsAppMessage, WASocket } from '#modules/connectionManager.js';
import { handleUserMessage } from '#src/conversation.js';
import { check_if_allowed } from '#modules/allowlist_manager.js';
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

  // Start WhatsApp via ConnectionManager — this runs asynchronously and
  // handles all reconnection internally.
  await connectionManager.start(async (message: WhatsAppMessage, _sock: WASocket) => {
    console.log(`📨 Message from ${message.from_alt}: ${message.text}`);

    const isAllowed = await check_if_allowed(message.from_alt);
    if (!isAllowed) {
      console.log(`Number ${message.from_alt} not in allowlist. Will not reply.`);
      return;
    }

    // Show typing indicator (best-effort)
    connectionManager.sendTypingIndicator(message.from).catch(() => {});

    await handleUserMessage(message.from_alt, message.text, async (response) => {
      // Stop typing indicator
      connectionManager.stopTypingIndicator(message.from).catch(() => {});

      // Send the response (auto-queues if disconnected)
      const result = await connectionManager.sendMessage(message.from, response);
      if (result.sent) {
        console.log(`📤 Reply sent to ${message.from}`);
      } else if (result.queued) {
        console.log(`📤 Reply queued for ${message.from} (will send on reconnect)`);
      }
    });
  });

  console.log('[WhatsApp] ConnectionManager started');
}

export { stopAgenda };