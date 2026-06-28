/**
 * @deprecated Import from #modules/connectionManager.js instead.
 *
 * This file is kept for backward compatibility. All functionality has moved
 * to ConnectionManager in connectionManager.ts.
 */
export {
  type WASocket,
  type WhatsAppMessage,
  type MessageHandler,
} from '#modules/connectionManager.js';

// Stub exports for legacy consumers that still reference old functions.
// These are no-ops — all logic is in ConnectionManager.

/** @deprecated Use connectionManager.start() instead. */
export async function startWhatsApp(_onMessage: any): Promise<any> {
  throw new Error('startWhatsApp is deprecated. Use connectionManager.start() instead.');
}

/** @deprecated Use connectionManager.sendMessage() instead. */
export async function sendTextMessage(_sock: any, _to: string, _text: string): Promise<void> {
  throw new Error('sendTextMessage is deprecated. Use connectionManager.sendMessage() instead.');
}

/** @deprecated Use connectionManager.sendTypingIndicator() instead. */
export async function sendTypingIndicator(_sock: any, _to: string): Promise<void> {
  throw new Error('sendTypingIndicator is deprecated. Use connectionManager.sendTypingIndicator() instead.');
}

/** @deprecated Use connectionManager.stopTypingIndicator() instead. */
export async function stopTypingIndicator(_sock: any, _to: string): Promise<void> {
  throw new Error('stopTypingIndicator is deprecated. Use connectionManager.stopTypingIndicator() instead.');
}