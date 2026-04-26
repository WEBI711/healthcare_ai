import { CronJobModel, ICronJob } from '#database/index.js';
import { getAgenda, cancelJob } from '#modules/agenda.js';

/**
 * Check if a cron expression represents a one-off schedule.
 * One-off expressions start with 'at ' (ISO date format for Agenda.schedule)
 */
function isOneOffExpression(expression: string): boolean {
  return expression.startsWith('at ');
}

export interface CreateCronJobInput {
  userId: string;
  phoneNumber: string;
  name: string;
  naturalSchedule: string;
  cronExpression: string;
  timezone: string;
  message: string;
  isOneOff?: boolean;
}

export interface UpdateCronJobInput {
  naturalSchedule?: string;
  cronExpression?: string;
  timezone?: string;
  message?: string;
  enabled?: boolean;
}

/**
 * Create a new cron job — overwrites if same userId + name already exists (Decision A).
 */
export async function createCronJob(input: CreateCronJobInput): Promise<ICronJob> {
  const { userId, name, naturalSchedule, cronExpression, timezone, message } = input;

  const agenda = getAgenda();

  // Check for existing job with same name — overwrite (Decision A: same user, same name → update)
  const existing = await CronJobModel.findOne({ userId, name });
  if (existing) {
    // Cancel existing Agenda job
    await cancelJob(userId, name);
    // Delete existing DB record (we'll recreate it below)
    await CronJobModel.deleteOne({ userId, name });
  }

  // Determine if this is a recurring or one-off job
  if (isOneOffExpression(cronExpression)) {
    // One-off: schedule at a specific time (remove 'at ' prefix for Agenda)
    const scheduleTime = cronExpression.replace('at ', '');
    await agenda.schedule(scheduleTime, 'send-whatsapp-message', {
      userId,
      message,
      jobName: name,
      timezone,
    });
  } else {
    // Recurring: use agenda.every with the cron expression
    await agenda.every(
      cronExpression,
      'send-whatsapp-message',
      {
        userId,
        message,
        jobName: name,
        timezone,
      },
      { timezone: timezone || 'UTC' }
    );
  }

  // Store in database
  const cronJob = await CronJobModel.create({
    userId,
    name,
    naturalSchedule,
    cronExpression: isOneOffExpression(cronExpression) ? `once:${cronExpression}` : cronExpression,
    timezone,
    message,
    enabled: true,
  });

  console.log(`[Agenda] Created job "${name}" for user ${userId}: ${naturalSchedule}`);

  return cronJob;
}

export async function listCronJobs(userId: string): Promise<ICronJob[]> {
  return await CronJobModel.find({ userId }).sort({ createdAt: -1 });
}

export async function deleteCronJob(userId: string, name: string): Promise<boolean> {
  const job = await CronJobModel.findOne({ userId, name });
  if (!job) {
    return false;
  }

  // Cancel the Agenda job
  await cancelJob(userId, name);

  // Remove from database
  await CronJobModel.deleteOne({ userId, name });

  console.log(`[Agenda] Deleted job "${name}" for user ${userId}`);
  return true;
}

export async function updateCronJob(
  userId: string,
  name: string,
  updates: UpdateCronJobInput
): Promise<ICronJob | null> {
  const job = await CronJobModel.findOne({ userId, name });
  if (!job) {
    return null;
  }

  // Build update object
  const updateData: Partial<ICronJob> = {};

  if (updates.naturalSchedule !== undefined) {
    updateData.naturalSchedule = updates.naturalSchedule;
  }
  if (updates.cronExpression !== undefined) {
    updateData.cronExpression = updates.cronExpression;
  }
  if (updates.timezone !== undefined) {
    updateData.timezone = updates.timezone;
  }
  if (updates.message !== undefined) {
    updateData.message = updates.message;
  }
  if (updates.enabled !== undefined) {
    updateData.enabled = updates.enabled;
  }

  const agenda = getAgenda();

  // Always cancel the old job and re-create if changes affect scheduling
  if (updates.cronExpression !== undefined || updates.message !== undefined || updates.timezone !== undefined || updates.enabled !== undefined) {
    await cancelJob(userId, name);

    // If disabling or the job was disabled, don't recreate
    if (updates.enabled === false || (updates.enabled === undefined && updateData.enabled !== true)) {
      // Just update DB without re-scheduling
      const updated = await CronJobModel.findOneAndUpdate(
        { userId, name },
        updateData,
        { new: true }
      );
      console.log(`[Agenda] Disabled job "${name}" for user ${userId}`);
      return updated;
    }

    // Re-schedule with updated settings
    const newCronExpr = updates.cronExpression || job.cronExpression;
    const newMessage = updates.message || job.message;
    const newTimezone = updates.timezone || job.timezone;

    if (isOneOffExpression(newCronExpr)) {
      const scheduleTime = newCronExpr.replace('at ', '');
      await agenda.schedule(scheduleTime, 'send-whatsapp-message', {
        userId,
        message: newMessage,
        jobName: name,
        timezone: newTimezone,
      });
    } else {
      await agenda.every(
        newCronExpr,
        'send-whatsapp-message',
        {
          userId,
          message: newMessage,
          jobName: name,
          timezone: newTimezone,
        },
        { timezone: newTimezone || 'UTC' }
      );
    }
  }

  // Update in database
  const updated = await CronJobModel.findOneAndUpdate(
    { userId, name },
    updateData,
    { new: true }
  );

  console.log(`[Agenda] Updated job "${name}" for user ${userId}`);
  return updated;
}


