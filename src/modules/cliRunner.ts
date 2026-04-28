import * as readline from "readline";
import { handleUserMessage } from '#src/conversation.js';

export async function startCLI(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function askQuestion(query: string): Promise<string> {
    return new Promise((resolve) => rl.question(query, resolve));
  }

  console.log('🖥️  CLI Mode - Type your messages (or "quit" to exit)\n');

  const phoneNumber = 'test-user-123';

  while (true) {
    const input = await askQuestion("\nPrompt: ");
    
    if (input.trim().toLowerCase() === 'quit' || input.trim().toLowerCase() === 'exit') {
      console.log("Goodbye!");
      rl.close();
      process.exit(0);
    }

    await handleUserMessage(phoneNumber, input, async (response) => {
      console.log('\n' + response);
    });
  }
}
