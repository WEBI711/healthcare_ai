import "dotenv/config";
import model from './modules/model.js';
import contextManager from './modules/contextManager.js';
import converse from './modules/converse.js';

import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main(): Promise<void> {
  let context = contextManager.createNewContext("test")
  //let response = converse(context, model);
  let running = true;
  while (running) {
    const input = await askQuestion("Prompt: ");

    switch (input.trim().toLowerCase()) {
      case "hello":
        console.log("Hello, World!");
        break;
      case "quit":
      case "exit":
        console.log("Goodbye!");
        running = false;
        break;
      default:
        // code to enter here.
        console.log(`You entered: "${input}"`);
        context.messages.push({ role: 'user', content: input, timestamp: Date.now() })
        await converse(context, model);
    }
  }
}

main();
