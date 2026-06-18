import { WASocket, sendTextMessage as waSendTextMessage } from '#modules/whatsapp.js';

type ConnectionState = 'connecting' | 'open' | 'closing' | 'closed';

class WhatsAppService {
  private socket: WASocket | null = null;
  private _connectionState: ConnectionState = 'closed';

  setSocket(socket: WASocket) {
    this.socket = socket;
  }

  getSocket(): WASocket | null {
    return this.socket;
  }

  /**
   * Update the tracked connection state.
   * Called by the connection.update handler in whatsappRunner.
   */
  setConnectionState(state: ConnectionState) {
    this._connectionState = state;
  }

  /**
   * Returns true only if the socket exists AND the underlying WebSocket is open.
   */
  isConnected(): boolean {
    return this.socket !== null && this._connectionState === 'open';
  }

  /**
   * Get the raw internal connection state.
   */
  getConnectionState(): ConnectionState {
    return this._connectionState;
  }

  /**
   * Wait until the WhatsApp connection is open, with a timeout.
   * Polls every 500ms. Throws if timeout is reached.
   */
  async waitForConnection(timeoutMs: number = 15000): Promise<void> {
    if (this.isConnected()) return;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (this.isConnected()) return;
    }

    throw new Error(`WhatsApp connection not ready after ${timeoutMs}ms (state: ${this._connectionState})`);
  }

  async sendMessage(phoneNumber: string, text: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp socket not initialized');
    }
    if (this._connectionState !== 'open') {
      throw new Error(`Cannot send message — connection state is "${this._connectionState}" (not "open")`);
    }
    await waSendTextMessage(this.socket, phoneNumber, text);
  }
}

export const whatsAppService = new WhatsAppService();
