import { 
  makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  WASocket as _WASocket, 
  Browsers,
  fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

export type WASocket = _WASocket;
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import readline from 'readline';

const AUTH_DIR = './auth_info_baileys';
let pairingCodeRequested = false;

export interface WhatsAppMessage {
  id: string;
  from: string;
  text: string;
  isGroup: boolean;
  timestamp: number;
}

export type MessageHandler = (message: WhatsAppMessage, socket: WASocket) => Promise<void>;

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export async function startWhatsApp(onMessage: MessageHandler): Promise<WASocket> {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  
  // Fetch latest WhatsApp version to avoid 405 errors
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WhatsApp version: ${version.join('.')}, Latest: ${isLatest}`);

  const sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Handle QR code display
    if (qr) {
      console.log('\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      console.log('\nOr use pairing code method below...\n');
    }

    // Request pairing code when not registered and QR is available
    if (qr && !sock.authState.creds.registered && !pairingCodeRequested) {
      pairingCodeRequested = true;
      
      try {
        const phoneNumber = await askQuestion('Enter phone number for pairing code (with country code, e.g., 12345678901), or just press Enter to use QR: ');
        
        if (phoneNumber && phoneNumber.trim()) {
          // Wait a moment for socket to be ready
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const code = await sock.requestPairingCode(phoneNumber.trim());
          console.log(`\n🔢 Your pairing code: ${code}`);
          console.log('Open WhatsApp > Settings > Linked Devices > Link with phone number');
          console.log(`Enter: ${code}\n`);
        }
      } catch (err: any) {
        console.log('\n⚠️  Pairing code failed, please use QR code instead');
        console.log('Error:', err.message || err);
      }
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log('Connection closed. Status:', statusCode, 'Reconnecting:', shouldReconnect);
      
      if (statusCode === 405) {
        console.log('\n⚠️  WhatsApp authentication blocked (405)');
        console.log('Solutions:');
        console.log('1. Wait 5-10 minutes and try again');
        console.log('2. Clear auth: rm -rf auth_info_baileys');
        console.log('3. Try a different WhatsApp account\n');
      }
      
      if (shouldReconnect) {
        pairingCodeRequested = false;
        // Exponential backoff for reconnection
        const delay = Math.min(30000, 5000 + Math.random() * 5000);
        console.log(`Reconnecting in ${Math.round(delay/1000)}s...`);
        setTimeout(() => startWhatsApp(onMessage), delay);
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp connected successfully!');
      pairingCodeRequested = false;
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    for (const msg of m.messages) {
      if (msg.key.fromMe) continue;

      const messageText = msg.message?.conversation 
        || msg.message?.extendedTextMessage?.text;
      
      if (!messageText) continue;

      const isGroup = msg.key.remoteJid?.endsWith('@g.us') || false;
      if (isGroup) continue;

      const from = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || 'unknown';

      const whatsAppMessage: WhatsAppMessage = {
        id: msg.key.id || 'unknown',
        from,
        text: messageText,
        isGroup,
        timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now(),
      };

      await onMessage(whatsAppMessage, sock);
    }
  });

  return sock;
}

export async function sendTextMessage(sock: WASocket, to: string, text: string): Promise<void> {
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

export async function sendTypingIndicator(sock: WASocket, to: string): Promise<void> {
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  await sock.sendPresenceUpdate('composing', jid);
}

export async function stopTypingIndicator(sock: WASocket, to: string): Promise<void> {
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  await sock.sendPresenceUpdate('paused', jid);
}
