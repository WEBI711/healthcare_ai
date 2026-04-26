import "dotenv/config";
import { connectDB } from '#database/index.js';
import { startCLI } from '#modules/cliRunner.js';
import { startWhatsAppMode } from '#modules/whatsappRunner.js';
import { stopAgenda } from '#modules/agenda.js';

const USE_WHATSAPP = process.env.USE_WHATSAPP === 'true';

async function main(): Promise<void> {
  await connectDB();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    if (USE_WHATSAPP) {
      await stopAgenda();
    }
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    if (USE_WHATSAPP) {
      await stopAgenda();
    }
    process.exit(0);
  });

  if (USE_WHATSAPP) {
    await startWhatsAppMode();
  } else {
    await startCLI();
  }
}

main().catch(console.error);
