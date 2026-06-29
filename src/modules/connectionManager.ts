import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  WASocket as _WASocket,
  Browsers,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import readline from 'readline';

// ── Re-exports (so consumers don't need to import from whatsapp.ts) ────────

export type WASocket = _WASocket;

export interface WhatsAppMessage {
  id: string;
  from: string;
  from_alt: string;
  text: string;
  isGroup: boolean;
  timestamp: number;
}

export type MessageHandler = (message: WhatsAppMessage, socket: WASocket) => Promise<void>;

// ── Types ──────────────────────────────────────────────────────────────────

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface PendingMessage {
  to: string;
  text: string;
  queuedAt: number;
}

export interface SendResult {
  sent: boolean;
  queued: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const AUTH_DIR = './auth_info_baileys';
const MAX_QUEUE_SIZE = 500;
const INITIAL_RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 300_000; // 5 minutes
const RECONNECT_JITTER_MS = 5_000;

// ── Helpers ────────────────────────────────────────────────────────────────

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}


/** Compute exponential backoff delay with jitter. */
function backoffDelay(attempt: number): number {
  const base = Math.min(INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt), MAX_RECONNECT_DELAY_MS);
  const jitter = Math.random() * RECONNECT_JITTER_MS;
  return Math.round(base + jitter);
}

// ── ConnectionManager ──────────────────────────────────────────────────────

class ConnectionManager {
  private socket: WASocket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private pendingMessages: PendingMessage[] = [];

  /** Resolvers waiting for the connection to become 'connected'. */
  private connectedWaiters: Array<() => void> = [];

  /** The application-level message handler. */
  private onMessage: MessageHandler | null = null;

  /** Credential save callback from baileys. */
  private saveCreds: (() => Promise<void>) | null = null;

  /** Prevent duplicate pairing-code prompts. */
  private pairingCodeRequested = false;

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Start the WhatsApp bot. Call once at startup.
   * Returns immediately — the connection proceeds asynchronously.
   */
  async start(handler: MessageHandler): Promise<void> {
    this.onMessage = handler;
    await this.createSocket();
  }

  /**
   * Send a WhatsApp text message.
   *
   * - Sends immediately if connected.
   * - Queues if disconnected/connecting, flushed automatically on reconnect.
   * - Returns a result indicating whether it was sent or queued.
   */
  async sendMessage(to: string, text: string): Promise<SendResult> {
    if (this.state === 'connected' && this.socket) {
      try {
        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        await this.socket.sendMessage(jid, { text });
        return { sent: true, queued: false };
      } catch (err: any) {
        // Socket died mid-send — mark disconnected, queue, and reconnect
        console.warn('[ConnectionManager] Send failed (socket closed mid-send):', err.message);
        this.setState('disconnected');
        this.queueMessage(to, text);
        this.scheduleReconnect();
        return { sent: false, queued: true };
      }
    }

    // Not connected — queue for later
    this.queueMessage(to, text);
    return { sent: false, queued: true };
  }

  /**
   * Send a typing indicator. Best-effort — silently skipped if not connected.
   */
  async sendTypingIndicator(to: string): Promise<void> {
    if (this.state !== 'connected' || !this.socket) return;
    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      await this.socket.sendPresenceUpdate('composing', jid);
    } catch {
      // Best-effort — ignore failures
    }
  }

  /**
   * Stop typing indicator. Best-effort — silently skipped if not connected.
   */
  async stopTypingIndicator(to: string): Promise<void> {
    if (this.state !== 'connected' || !this.socket) return;
    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      await this.socket.sendPresenceUpdate('paused', jid);
    } catch {
      // Best-effort — ignore failures
    }
  }

  /**
   * Returns true if the socket is currently connected and usable.
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.socket !== null;
  }

  /**
   * Returns the current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Block until the connection becomes 'connected', or throw after timeoutMs.
   */
  async waitUntilConnected(timeoutMs: number = 30_000): Promise<void> {
    if (this.isConnected()) return;

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove this waiter from the array
        const idx = this.connectedWaiters.indexOf(onConnected);
        if (idx >= 0) this.connectedWaiters.splice(idx, 1);
        reject(new Error(`WhatsApp connection not ready after ${timeoutMs}ms (state: ${this.state})`));
      }, timeoutMs);

      const onConnected = () => {
        clearTimeout(timer);
        resolve();
      };

      this.connectedWaiters.push(onConnected);
    });
  }

  /**
   * Get the raw socket reference. Use sparingly — prefer sendMessage().
   */
  getSocket(): WASocket | null {
    return this.socket;
  }

  /**
   * Graceful shutdown.
   */
  async stop(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.setState('disconnected');
    console.log('[ConnectionManager] Stopped');
  }

  // ── Internal: Socket Lifecycle ───────────────────────────────────────────

  /**
   * Create a fresh baileys socket and wire up all event handlers.
   * This is called on initial start AND on every reconnection.
   */
  private async createSocket(): Promise<void> {
    this.setState('connecting');

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    this.saveCreds = saveCreds;

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[ConnectionManager] WhatsApp version: ${version.join('.')}, Latest: ${isLatest}`);

    const sock = makeWASocket({
      auth: authState,
      version,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      keepAliveIntervalMs: 30_000,
      connectTimeoutMs: 60_000,
    });

    this.socket = sock;

    // ── Event: credential updates ──────────────────────
    sock.ev.on('creds.update', async () => {
      if (this.saveCreds) await this.saveCreds();
    });

    // ── Event: connection state changes ────────────────
    sock.ev.on('connection.update', (update) => {
      this.handleConnectionUpdate(update, sock);
    });

    // ── Event: incoming messages ───────────────────────
    sock.ev.on('messages.upsert', async (m) => {
      await this.handleMessagesUpsert(m, sock);
    });
  }

  /**
   * Handle connection.update events from baileys.
   */
  private handleConnectionUpdate(update: any, sock: WASocket): void {
    const { connection, lastDisconnect, qr } = update;

    // ── QR code ──────────────────────────────────────────
    if (qr) {
      console.log('\n📱 Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      console.log('\nOr use pairing code method below...\n');
    }

    // ── Pairing code ─────────────────────────────────────
    if (qr && !sock.authState.creds.registered && !this.pairingCodeRequested) {
      this.pairingCodeRequested = true;
      this.requestPairingCode(sock);
    }

    // ── Open ─────────────────────────────────────────────
    if (connection === 'open') {
      console.log('✅ [ConnectionManager] WhatsApp connected!');
      this.pairingCodeRequested = false;
      this.reconnectAttempt = 0;
      this.setState('connected');
      this.flushPendingMessages();
    }

    // ── Close ────────────────────────────────────────────
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      console.log(`[ConnectionManager] Connection closed. Status: ${statusCode}, Logged out: ${isLoggedOut}`);

      this.socket = null;
      this.setState('disconnected');

      if (statusCode === 405) {
        console.log('\n⚠️  WhatsApp authentication blocked (405)');
        console.log('Solutions:');
        console.log('1. Wait 5-10 minutes and try again');
        console.log('2. Clear auth: rm -rf auth_info_baileys');
        console.log('3. Try a different WhatsApp account\n');
      }

      if (!isLoggedOut) {
        this.pairingCodeRequested = false;
        this.scheduleReconnect();
      } else {
        console.log('[ConnectionManager] Logged out — will not auto-reconnect. Re-auth required.');
      }
    }
  }

  /**
   * Prompt for a pairing code via stdin.
   */
  private async requestPairingCode(sock: WASocket): Promise<void> {
    try {
      const phoneNumber = await askQuestion(
        'Enter phone number for pairing code (with country code, e.g., 12345678901), or just press Enter to use QR: '
      );
      if (phoneNumber && phoneNumber.trim()) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
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

  /**
   * Handle incoming WhatsApp messages.
   */
  private async handleMessagesUpsert(m: any, sock: WASocket): Promise<void> {
    if (!this.onMessage) return;

    for (const msg of m.messages) {
      if (msg.key.fromMe) continue;

      const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      if (!messageText) continue;

      const isGroup = msg.key.remoteJid?.endsWith('@g.us') || false;
      if (isGroup) continue;

      const from = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || 'unknown';
      const from_alt = msg.key.remoteJidAlt?.replace('@s.whatsapp.net', '') || 'unknown';

      const whatsAppMessage: WhatsAppMessage = {
        id: msg.key.id || 'unknown',
        from,
        from_alt,
        text: messageText,
        isGroup,
        timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now(),
      };

      await this.onMessage(whatsAppMessage, sock);
    }
  }

  // ── Internal: Reconnection ───────────────────────────────────────────────

  /**
   * Schedule a reconnection attempt with exponential backoff.
   * Cancels any existing timer (deduplication).
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const delay = backoffDelay(this.reconnectAttempt);
    console.log(`[ConnectionManager] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempt + 1})...`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.reconnectAttempt++;
      try {
        await this.createSocket();
      } catch (err) {
        console.error('[ConnectionManager] Reconnection attempt failed:', err);
        // createSocket sets state to 'disconnected' on close, which will trigger
        // another scheduleReconnect via the connection.update handler.
      }
    }, delay);
  }

  // ── Internal: Message Queue ──────────────────────────────────────────────

  /**
   * Add a message to the pending queue. Drops oldest if queue is full.
   */
  private queueMessage(to: string, text: string): void {
    if (this.pendingMessages.length >= MAX_QUEUE_SIZE) {
      const dropped = this.pendingMessages.shift();
      console.warn(`[ConnectionManager] Queue full — dropped oldest message to: ${dropped?.to}`);
    }
    this.pendingMessages.push({ to, text, queuedAt: Date.now() });
    console.log(`[ConnectionManager] Message queued for ${to} (queue size: ${this.pendingMessages.length})`);
  }

  /**
   * Drain the pending message queue. Called when connection becomes 'connected'.
   * Deduplicates messages to the same recipient with the same text within 5s.
   */
  private async flushPendingMessages(): Promise<void> {
    if (this.pendingMessages.length === 0) return;

    console.log(`[ConnectionManager] Flushing ${this.pendingMessages.length} queued messages...`);

    // Deduplicate: same to + same text within 5-second window → keep only the latest
    const deduped: PendingMessage[] = [];
    const seen = new Map<string, number>(); // key = `${to}::${text}`, value = index

    for (let i = this.pendingMessages.length - 1; i >= 0; i--) {
      const msg = this.pendingMessages[i];
      const key = `${msg.to}::${msg.text}`;
      const existingIdx = seen.get(key);

      if (existingIdx !== undefined) {
        // Check if within 5-second window
        if (msg.queuedAt - deduped[existingIdx].queuedAt < 5_000) {
          continue; // skip duplicate
        }
      }

      seen.set(key, deduped.length);
      deduped.push(msg);
    }

    // Reverse back to FIFO order
    deduped.reverse();

    const failed: PendingMessage[] = [];

    for (const msg of deduped) {
      try {
        const jid = msg.to.includes('@') ? msg.to : `${msg.to}@s.whatsapp.net`;
        await this.socket!.sendMessage(jid, { text: msg.text });
        console.log(`[ConnectionManager] Flushed queued message to ${msg.to}`);
      } catch (err: any) {
        console.warn(`[ConnectionManager] Failed to flush message to ${msg.to}:`, err.message);
        failed.push(msg);

        // Socket died during flush — re-queue remaining and reconnect
        this.setState('disconnected');
        const remaining = failed.concat(deduped.slice(deduped.indexOf(msg) + 1));
        this.pendingMessages = [...remaining, ...this.pendingMessages];
        this.scheduleReconnect();
        return;
      }
    }

    // Re-queue any that failed for non-connection reasons
    this.pendingMessages = failed;
    if (failed.length > 0) {
      console.warn(`[ConnectionManager] ${failed.length} messages failed to flush, kept in queue`);
    }
  }

  // ── Internal: State Transitions ──────────────────────────────────────────

  private setState(newState: ConnectionState): void {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== 'connected' && newState === 'connected') {
      // Resolve all waiters
      const waiters = this.connectedWaiters;
      this.connectedWaiters = [];
      for (const resolve of waiters) {
        try { resolve(); } catch { /* ignore */ }
      }
    }

    if (oldState === 'connected' && newState !== 'connected') {
      // Connection lost — reject any pending waiters so they don't hang forever
      const waiters = this.connectedWaiters;
      this.connectedWaiters = [];
      for (const _ of waiters) {
        // waiters will time out via their own setTimeout, so we don't reject them here.
        // Instead we just clear them — new callers to waitUntilConnected will wait
        // for the NEXT connection.
      }
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

export const connectionManager = new ConnectionManager();