/**
 * @deprecated Use connectionManager from #modules/connectionManager.js instead.
 *
 * This class is kept as a backward-compatibility layer. All methods now delegate
 * to the ConnectionManager singleton. Migrate direct callers to connectionManager
 * when convenient.
 */
import { connectionManager } from '#modules/connectionManager.js';

class WhatsAppService {
  /**
   * @deprecated ConnectionManager owns its own socket. No-op.
   */
  setSocket(_socket: any) {
    // no-op — ConnectionManager owns the socket lifecycle
  }

  /**
   * @deprecated Use connectionManager.getSocket() directly.
   */
  getSocket() {
    return connectionManager.getSocket();
  }

  /**
   * @deprecated ConnectionManager manages its own state. No-op.
   */
  setConnectionState(_state: any) {
    // no-op — ConnectionManager manages its own state
  }

  /**
   * @deprecated Use connectionManager.isConnected() directly.
   */
  isConnected(): boolean {
    return connectionManager.isConnected();
  }

  /**
   * @deprecated Use connectionManager.getState() directly.
   */
  getConnectionState() {
    const state = connectionManager.getState();
    // Map internal states to legacy API surface
    const map: Record<string, string> = {
      disconnected: 'closed',
      connecting: 'connecting',
      connected: 'open',
    };
    return map[state] || state;
  }

  /**
   * @deprecated Use connectionManager.waitUntilConnected() directly.
   */
  async waitForConnection(timeoutMs: number = 15000): Promise<void> {
    return connectionManager.waitUntilConnected(timeoutMs);
  }

  /**
   * @deprecated Use connectionManager.sendMessage() directly.
   */
  async sendMessage(phoneNumber: string, text: string): Promise<void> {
    const result = await connectionManager.sendMessage(phoneNumber, text);
    if (!result.sent && !result.queued) {
      throw new Error('Failed to send message — not connected and queue failed');
    }
    // Legacy API throws on connection issues, but ConnectionManager queues instead.
    // We keep the old contract by not throwing when queued.
  }
}

export const whatsAppService = new WhatsAppService();