import { CronJobModel, ICronJob } from '#database/index.js';
import { getAgenda, cancelJob, isOneOffExpression, normalizeCronExpression } from '#modules/agenda.js';



export interface CreateCronJobInput {
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
  const { phoneNumber, name, naturalSchedule, cronExpression, timezone, message } = input;

  console.log(`[CronService] Creating job:`, { name, cronExpression, isOneOff: isOneOffExpression(cronExpression) });

  const agenda = getAgenda();

  // Check for existing job with same name — overwrite (Decision A: same user, same name → update)
  const existing = await CronJobModel.findOne({ userId: phoneNumber, name });
  if (existing) {
    // Cancel existing Agenda job
    await cancelJob(phoneNumber, name);
    // Delete existing DB record (we'll recreate it below)
    await CronJobModel.deleteOne({ userId: phoneNumber, name });
  }

  // Determine if this is a recurring or one-off job
  if (isOneOffExpression(cronExpression)) {
    // One-off: schedule at a specific time
    const scheduleTime = normalizeCronExpression(cronExpression);
    await agenda.schedule(scheduleTime, 'send-whatsapp-message', {
      userId: phoneNumber,
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
        userId: phoneNumber,
        message,
        jobName: name,
        timezone,
      },
      { timezone: timezone || 'UTC' }
    );
  }

  // Store in database
  // For one-off jobs, remove the 'at ' prefix before storing to avoid double prefix issues
  const storedCronExpression = isOneOffExpression(cronExpression)
    ? `once:${cronExpression.replace('at ', '')}`
    : cronExpression;

  const cronJob = await CronJobModel.create({
    userId: phoneNumber,
    name,
    naturalSchedule,
    cronExpression: storedCronExpression,
    timezone,
    message,
    enabled: true,
  });

  console.log(`[CronService] Stored job in DB with cronExpression: ${storedCronExpression}`);

  console.log(`[Agenda] Created job "${name}" for user ${phoneNumber}: ${naturalSchedule}`);

  return cronJob;
}

export async function listCronJobs(phoneNumber: string): Promise<ICronJob[]> {
  return await CronJobModel.find({ userId: phoneNumber }).sort({ createdAt: -1 });
}

export async function deleteCronJob(phoneNumber: string, name: string): Promise<boolean> {
  const job = await CronJobModel.findOne({ userId: phoneNumber, name });
  if (!job) {
    return false;
  }

  // Cancel the Agenda job
  await cancelJob(phoneNumber, name);

  // Remove from database
  await CronJobModel.deleteOne({ userId: phoneNumber, name });

  console.log(`[Agenda] Deleted job "${name}" for user ${phoneNumber}`);
  return true;
}

export async function updateCronJob(
  phoneNumber: string,
  name: string,
  updates: UpdateCronJobInput
): Promise<ICronJob | null> {
  const job = await CronJobModel.findOne({ userId: phoneNumber, name });
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
    await cancelJob(phoneNumber, name);

    // If explicitly disabling, just update DB without re-scheduling
    if (updates.enabled === false) {
      const updated = await CronJobModel.findOneAndUpdate(
        { userId: phoneNumber, name },
        updateData,
        { new: true }
      );
      console.log(`[Agenda] Disabled job "${name}" for user ${phoneNumber}`);
      return updated;
    }

    // Re-schedule with updated settings
    // Normalize: convert DB-stored 'once:' prefix to 'at ' for isOneOffExpression check
    const rawCronExpr = updates.cronExpression || job.cronExpression;
    const normalizedForCheck = rawCronExpr.startsWith('once:')
      ? `at ${normalizeCronExpression(rawCronExpr)}`
      : rawCronExpr;
    const isOneOff = isOneOffExpression(normalizedForCheck);
    const effectiveCronExpr = normalizeCronExpression(rawCronExpr);
    const newMessage = updates.message || job.message;
    const newTimezone = updates.timezone || job.timezone;

    if (isOneOff) {
      await agenda.schedule(effectiveCronExpr, 'send-whatsapp-message', {
        userId: phoneNumber,
        message: newMessage,
        jobName: name,
        timezone: newTimezone,
      });
    } else {
      await agenda.every(
        effectiveCronExpr,
        'send-whatsapp-message',
        {
          userId: phoneNumber,
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
    { userId: phoneNumber, name },
    updateData,
    { new: true }
  );

  console.log(`[Agenda] Updated job "${name}" for user ${phoneNumber}`);
  return updated;
}


