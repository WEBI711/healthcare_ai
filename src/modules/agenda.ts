import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

/**
 * Check if a cron expression represents a one-off schedule.
 *
 * One-off expressions can be:
 * - Fresh from the AI: starts with 'at ' (e.g., "at 2026-06-18 15:00:00")
 * - Stored in DB: starts with 'once:' (e.g., "once:2026-06-18 15:00:00")
 */
export function isOneOffExpression(expression: string): boolean {
  return expression.startsWith('at ') || expression.startsWith('once:');
}

/**
 * Normalize a stored cron expression to the format Agenda expects.
 *
 * - DB stores one-off jobs as "once:YYYY-MM-DD HH:mm:ss"
 * - The AI generates "at YYYY-MM-DD HH:mm:ss"
 * - Agenda expects just the date/time string (for schedule()) or a raw cron expression (for every())
 *
 * Returns the expression ready to pass to agenda.schedule() or isOneOffExpression().
 */
export function normalizeCronExpression(expression: string): string {
  // Strip the DB storage prefix for one-off jobs
  if (expression.startsWith('once:')) {
    return expression.replace('once:', '');
  }
  // Strip the AI-generated prefix for one-off jobs
  if (expression.startsWith('at ')) {
    return expression.replace('at ', '');
  }
  // Recurring cron expression — return as-is
  return expression;
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_assistant';

// Singleton Agenda instance
let agendaInstance: Agenda | null = null;

/**
 * Initialize or retrieve the Agenda singleton.
 * Uses its own MongoDB connection via MongoBackend.
 */
export function getAgenda(): Agenda {
  if (!agendaInstance) {
    const backend = new MongoBackend({
      address: MONGODB_URI,
      collection: 'agendaJobs',
    });

    agendaInstance = new Agenda({
      backend,
      processEvery: '2 minutes',
      defaultConcurrency: 50,
      defaultLockLimit: 1,
      defaultLockLifetime: 5 * 60 * 1000, // 5 minutes
      removeOnComplete: false, // Keep jobs for audit/inspection
    });
  }

  return agendaInstance;
}

/**
 * Stop Agenda processing gracefully.
 */
export async function stopAgenda(): Promise<void> {
  if (agendaInstance) {
    console.log('[Agenda] Stopping all jobs gracefully...');
    await agendaInstance.stop();
    agendaInstance = null;
    console.log('[Agenda] All jobs stopped.');
  }
}

/**
 * Restore Agenda jobs from the CronJob collection.
 * Called at startup to ensure all enabled jobs are scheduled in Agenda.
 */
export async function restoreAgendaJobs(): Promise<void> {
  const { CronJobModel } = await import('#models/CronJob.js');

  console.log('[Agenda] Restoring jobs from database...');

  const jobs = await CronJobModel.find({ enabled: true });
  let restored = 0;
  let skipped = 0;

  for (const job of jobs) {
    const agenda = getAgenda();

    try {
      // Clear any existing Agenda job with same userId + name
      await cancelJob(job.userId, job.name);

      // Use the normalization helper to handle both 'once:' and 'at ' prefixes
      const effectiveExpr = normalizeCronExpression(job.cronExpression);
      const isOneOff = isOneOffExpression(job.cronExpression);

      if (isOneOff) {
        // One-off job: re-schedule if not already run
        console.log(`[Agenda] Restoring one-off job "${job.name}" scheduled for: ${effectiveExpr}`);

        if (!job.lastRunAt) {
          await agenda.schedule(effectiveExpr, 'send-whatsapp-message', {
            userId: job.userId,
            message: job.message,
            jobName: job.name,
            timezone: job.timezone,
          });
          restored++;
        } else {
          skipped++;
        }
      } else {
        // Recurring job
        await agenda.every(
          effectiveExpr,
          'send-whatsapp-message',
          {
            userId: job.userId,
            message: job.message,
            jobName: job.name,
            timezone: job.timezone,
          },
          { timezone: job.timezone || 'UTC' }
        );
        restored++;
      }
    } catch (error) {
      console.error(`[Agenda] Failed to restore job "${job.name}":`, error);
      skipped++;
    }
  }

  console.log(`[Agenda] Restored ${restored} jobs, skipped ${skipped}`);
}

/**
 * Cancel all Agenda jobs matching userId and name.
 */
export async function cancelJob(userId: string, name: string): Promise<number> {
  const agenda = getAgenda();
  console.log(`[Agenda] Canceling job for user ${userId}, name: ${name}`);

  const result = await agenda.cancel({
    name: 'send-whatsapp-message',
    // Agenda v6 uses data for matching — pass partial data object
    data: {
      userId,
      jobName: name,
    },
  });

  console.log(`[Agenda] Canceled ${result} jobs`);
  return result;
}
