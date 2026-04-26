import { WASocket, sendTextMessage as waSendTextMessage } from '#modules/whatsapp.js';

class WhatsAppService {
  private socket: WASocket | null = null;

  setSocket(socket: WASocket) {
    this.socket = socket;
  }

  getSocket(): WASocket | null {
    return this.socket;
  }

  async sendMessage(phoneNumber: string, text: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp socket not initialized');
    }
    await waSendTextMessage(this.socket, phoneNumber, text);
  }

  isConnected(): boolean {
    return this.socket !== null;
  }
}

export const whatsAppService = new WhatsAppService();
