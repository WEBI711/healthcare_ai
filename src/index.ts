import "dotenv/config";
import model from './modules/model.js';
import contextManager, { getContext, createNewContext, saveContext } from './modules/contextManager.js';
import converse from './modules/converse.js';
import { connectDB } from './database/index.js';

import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main(): Promise<void> {
  // Connect to MongoDB
  await connectDB();

  // Get or create context for a user
  const userId = 'test-user-123';
  let context = await getContext(userId);

  if (!context) {
    context = await createNewContext(userId);
    console.log('Created new context for user:', userId);
  } else {
    console.log('Loaded existing context for user:', userId);
  }

  let running = true;
  while (running) {
    const input = await askQuestion("\nPrompt: ");

    switch (input.trim().toLowerCase()) {
      case "hello":
        console.log("Hello, World!");
        break;
      case "quit":
      case "exit":
        console.log("Goodbye!");
        // Save context before exiting
        await saveContext(userId, context);
        console.log("Context saved to database");
        running = false;
        break;
      default:
        console.log(`You entered: "${input}"`);
        // Add user message to context
        context.messages.push({ role: 'user', content: input, timestamp: Date.now() });

        // Run conversation
        await converse(context, model);

        // Save updated context after each conversation
        await saveContext(userId, context);
        console.log("Context saved to database");
    }
  }

  rl.close();
}

main().catch(console.error);
