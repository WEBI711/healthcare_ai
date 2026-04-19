import "dotenv/config";
import { stream, Context, complete } from "@mariozechner/pi-ai"
import model from './modules/model.js';
import contextManager from './modules/contextManager.js';
import converse from './modules/converse.js';

async function main(): Promise<void> {

  let context = contextManager.createNewContext("test")
  let response = converse(context, model);
}

main();
