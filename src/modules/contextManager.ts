// this file will be used to serve contexts for a given patient from database
// Should have a function that takes a patient identifier (phone number or id) and return their context in full
import { Context } from "@mariozechner/pi-ai";
interface contextManagerClass {
  getContext: (identifier: string) => Context | undefined;
  createNewContext: (identifier: string) => Context;
}
let cm: contextManagerClass | null = null;

class contextManager implements contextManagerClass {
  contexts: Map<string, Context>;

  constructor() {
    this.contexts = new Map();
  }

  // identifier can be changed to match anything we might need in the future...phone numbers etc.
  getContext(identifier: string) {
    return this.contexts.get(identifier);
  }

  createNewContext(identifier: string) {
    let context: Context = {
      messages: [
        { role: 'user', content: 'Hello, how are you?', timestamp: Date.now() }
      ],
    }
    this.contexts.set(identifier, context);
    if (!this.contexts.get(identifier))
      throw new Error("Context creation failed");
    return context;
  }
}

function get_cm() {
  if (!cm) {
    cm = new contextManager();
    return cm;
  }
  return cm
}



export default get_cm();
