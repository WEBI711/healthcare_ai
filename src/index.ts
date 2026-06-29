import "dotenv/config";
import { connectDB } from '#database/index.js';
import { startCLI } from '#modules/cliRunner.js';
import { startWhatsAppMode } from '#modules/whatsappRunner.js';
import { stopAgenda } from '#modules/agenda.js';
import { connectionManager } from '#modules/connectionManager.js';
import app from './server.js';

const USE_WHATSAPP = process.env.USE_WHATSAPP === 'true';
const PORT = process.env.SERVERPORT || 3000;

async function main(): Promise<void> {
  await connectDB();

  // Start Express server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    if (USE_WHATSAPP) {
      await connectionManager.stop();
      await stopAgenda();
    }
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    if (USE_WHATSAPP) {
      await connectionManager.stop();
      await stopAgenda();
    }
    process.exit(0);
  });

  await startWhatsAppMode();
  //if (USE_WHATSAPP) {
  //  await startWhatsAppMode();
  //} else {
  //  await startCLI();
  //}
}

main().catch(console.error);
