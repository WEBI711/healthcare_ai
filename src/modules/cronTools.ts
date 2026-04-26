import { createCronJob, listCronJobs, deleteCronJob, updateCronJob } from '#modules/cronService.js';

// Tool definitions for the AI agent
export const cronToolDefinitions = [
  {
    name: 'schedule_reminder',
    description: `Schedule a WhatsApp message/reminder for the user. 
The user can describe the schedule in natural language like "every day at 9am", "every Monday and Wednesday at 2pm", or "tomorrow at 3pm".
You should convert their natural language description into a valid cron expression.
For recurring schedules, use cron expression format: "minute hour day-of-month month day-of-week"
For one-off schedules, use a specific date/time like "at 2024-01-15 15:00:00".
Determine the type (recurring vs one-off) based on the user's natural language.`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'A unique name for this scheduled task (e.g., "morning medicine", "weekly summary")'
        },
        naturalSchedule: {
          type: 'string',
          description: 'The schedule description exactly as the user said it (e.g., "every day at 9am")'
        },
        cronExpression: {
          type: 'string',
          description: 'The cron expression you generated from naturalSchedule (e.g., "0 9 * * *" for 9am daily, or "at 2024-01-15 15:00:00" for one-off)'
        },
        timezone: {
          type: 'string',
          description: 'The user\'s timezone (e.g., "America/New_York", "Europe/London", "UTC"). Ask if unsure.'
        },
        message: {
          type: 'string',
          description: 'The message to send when the schedule fires'
        },
        isOneOff: {
          type: 'boolean',
          description: 'True if this is a one-time reminder, false if it is recurring'
        }
      },
      required: ['name', 'naturalSchedule', 'cronExpression', 'timezone', 'message', 'isOneOff']
    }
  },
  {
    name: 'list_cron_jobs',
    description: 'List all scheduled reminders for the current user',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'delete_cron_job',
    description: 'Delete a scheduled reminder by name',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the reminder to delete'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'update_cron_job',
    description: `Update an existing scheduled reminder. 
You can change the schedule, timezone, message, or enable/disable the reminder.
If the user wants to change timing, provide both the new naturalSchedule and cronExpression.`,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the reminder to update'
        },
        naturalSchedule: {
          type: 'string',
          description: 'New schedule description (optional)'
        },
        cronExpression: {
          type: 'string',
          description: 'New cron expression (required if naturalSchedule is provided)'
        },
        timezone: {
          type: 'string',
          description: 'New timezone (optional)'
        },
        message: {
          type: 'string',
          description: 'New message (optional)'
        },
        enabled: {
          type: 'boolean',
          description: 'Enable or disable the reminder (optional)'
        }
      },
      required: ['name']
    }
  }
];

// Tool execution handlers
export async function executeCronTool(
  toolName: string, 
  args: any, 
  userId: string,
  phoneNumber: string
): Promise<string> {
  switch (toolName) {
    case 'schedule_reminder': {
      try {
        await createCronJob({
          userId,
          phoneNumber,
          name: args.name,
          naturalSchedule: args.naturalSchedule,
          cronExpression: args.cronExpression,
          timezone: args.timezone,
          message: args.message,
          isOneOff: args.isOneOff || false,
        });
        
        return `✅ Scheduled "${args.name}" successfully! I'll send you "${args.message}" ${args.naturalSchedule}.`;
      } catch (error: any) {
        return `❌ Failed to schedule: ${error.message}`;
      }
    }
    
    case 'list_cron_jobs': {
      const jobs = await listCronJobs(userId);
      if (jobs.length === 0) {
        return "You don't have any scheduled reminders.";
      }
      
      const jobList = jobs.map((job: any) => {
        const status = job.enabled ? '✅' : '⏸️';
        return `${status} **${job.name}**: "${job.message}" — ${job.naturalSchedule} (${job.timezone})`;
      }).join('\n');
      
      return `Here are your scheduled reminders:\n${jobList}`;
    }
    
    case 'delete_cron_job': {
      const deleted = await deleteCronJob(userId, args.name);
      if (deleted) {
        return `✅ Deleted "${args.name}" successfully.`;
      } else {
        return `❌ Couldn't find a reminder named "${args.name}".`;
      }
    }
    
    case 'update_cron_job': {
      const updates: any = {};
      if (args.naturalSchedule) updates.naturalSchedule = args.naturalSchedule;
      if (args.cronExpression) updates.cronExpression = args.cronExpression;
      if (args.timezone) updates.timezone = args.timezone;
      if (args.message) updates.message = args.message;
      if (typeof args.enabled === 'boolean') updates.enabled = args.enabled;
      
      const updated = await updateCronJob(userId, args.name, updates);
      if (updated) {
        let response = `✅ Updated "${args.name}"`;
        if (args.naturalSchedule) response += ` to run ${args.naturalSchedule}`;
        if (args.message) response += ` with new message`;
        if (typeof args.enabled === 'boolean') response += args.enabled ? ' (enabled)' : ' (disabled)';
        return response + '.';
      } else {
        return `❌ Couldn't find a reminder named "${args.name}".`;
      }
    }
    
    default:
      return `Unknown tool: ${toolName}`;
  }
}
