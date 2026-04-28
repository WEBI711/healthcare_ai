import { stream, Context, complete } from "@mariozechner/pi-ai"
import _model from '#modules/model.js';
import { executeCronTool } from '#modules/cronTools.js';
import { executePatientTool } from '#modules/patientTools.js';

export interface ConverseOptions {
  phoneNumber: string;
}

export default async function (context: Context, model: typeof _model, options: ConverseOptions) {
  const { phoneNumber } = options;

  console.log("conversing...");
  const s = stream(model, context, {
    temperature: 1,
    maxTokens: 4096,
  });
  for await (const event of s) {
    switch (event.type) {
      case 'start':
        console.log(`Starting with ${event.partial.model}`);
        break;
      case 'text_start':
        console.log('\n[Text started]');
        break;
      case 'text_delta':
        process.stdout.write(event.delta);
        break;
      case 'text_end':
        console.log('\n[Text ended]');
        break;
      case 'thinking_start':
        console.log('[Model is thinking...]');
        break;
      case 'thinking_delta':
        process.stdout.write(event.delta);
        break;
      case 'thinking_end':
        console.log('[Thinking complete]');
        break;
      case 'toolcall_start':
        console.log(`\n[Tool call started: index ${event.contentIndex}]`);
        break;
      case 'toolcall_delta':
        // Partial tool arguments are being streamed
        const partialCall = event.partial.content[event.contentIndex];
        if (partialCall.type === 'toolCall') {
          console.log(`[Streaming args for ${partialCall.name}]`);
        }
        break;
      case 'toolcall_end':
        console.log(`\nTool called: ${event.toolCall.name}`);
        console.log(`Arguments: ${JSON.stringify(event.toolCall.arguments)}`);
        break;
      case 'done':
        console.log(`\nFinished: ${event.reason}`);
        break;
      case 'error':
        console.error(`Error: ${event.error.errorMessage}`);
        break;
    }
  }

  // Get the final message after streaming, add it to the context
  const finalMessage = await s.result();
  context.messages.push(finalMessage);

  // Handle tool calls if any
  const toolCalls = finalMessage.content.filter(b => b.type === 'toolCall');
  for (const call of toolCalls) {
    let result: string;

    // Execute the appropriate tool
    if (call.name === 'get_time') {
      result = new Date().toLocaleString('en-US', {
        timeZone: call.arguments.timezone || 'UTC',
        dateStyle: 'full',
        timeStyle: 'long'
      });
    } else if (['schedule_reminder', 'list_cron_jobs', 'delete_cron_job', 'update_cron_job'].includes(call.name)) {
      // Execute cron-related tools
      result = await executeCronTool(call.name, call.arguments, phoneNumber);
    } else if (call.name === 'update_patient_info') {
      // Execute patient-related tools
      result = await executePatientTool(call.name, call.arguments, phoneNumber);
    } else {
      result = 'Unknown tool';
    }

    // Add tool result to context (supports text and images)
    context.messages.push({
      role: 'toolResult',
      toolCallId: call.id,
      toolName: call.name,
      content: [{ type: 'text', text: result }],
      isError: false,
      timestamp: Date.now()
    });
  }

  // Continue if there were tool calls
  if (toolCalls.length > 0) {
    const continuation = await complete(model, context);
    context.messages.push(continuation);
    console.log('After tool execution:', continuation.content);
  }

  return [finalMessage, context];
}
