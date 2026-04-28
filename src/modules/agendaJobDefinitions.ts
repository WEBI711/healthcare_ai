import { getAgenda } from '#modules/agenda.js';
import { whatsAppService } from '#modules/whatsappService.js';
import { CronJobModel, JobAuditLogModel } from '#database/index.js';
import type { Job } from 'agenda';

const MAX_RETRIES = 3;
const BACKOFF_DELAYS_MS = [60_000, 300_000, 1_800_000]; // 1min, 5min, 30min

/**
 * Schedule job re-execution with exponential backoff.
 */
async function rescheduleWithBackoff(job: Job<any>, retryCount: number, errorMessage: string): Promise<void> {
  const delay = BACKOFF_DELAYS_MS[retryCount];
  const data = job.attrs.data as { jobName: string };
  console.log(
    `[Agenda] Retrying "${data.jobName}" in ${delay / 60000}min (attempt ${retryCount + 1}/${MAX_RETRIES})`
  );

  // Mark as failed so Agenda knows to retry
  job.fail(new Error(errorMessage));
  job.attrs.nextRunAt = new Date(Date.now() + delay);
  await job.save();
}

/**
 * Send a failure notification to the user.
 */
async function notifyUserOfFailure(phoneNumber: string, jobName: string, maxRetries: number): Promise<void> {
  try {
    await whatsAppService.sendMessage(
      phoneNumber,
      `⚠️ I couldn't send your "${jobName}" reminder after ${maxRetries} attempts. Please check your connection.`
    );
  } catch (notifyError: any) {
    console.error(`[Agenda] Failed to notify user ${phoneNumber} about missed job "${jobName}":`, notifyError.message);
  }
}

/**
 * The job processor: sends a WhatsApp message and handles retries/auditing.
 */
async function sendWhatsAppMessageHandler(job: Job<any>): Promise<void> {
  const { userId: phoneNumber, message, jobName } = job.attrs.data as {
    userId: string;
    message: string;
    jobName: string;
  };

  const runAt = job.attrs.nextRunAt || job.attrs.lastRunAt || new Date();
  const retryCount = job.attrs.failCount || 0;

  console.log(`[Agenda] Executing "${jobName}" for user ${phoneNumber} (retry: ${retryCount})`);

  try {
    // Send the WhatsApp message
    await whatsAppService.sendMessage(phoneNumber, message);

    // Log successful execution
    await JobAuditLogModel.create({
      userId: phoneNumber,
      jobId: jobName,
      jobName,
      message,
      status: 'success',
      runAt,
      deliveredAt: new Date(),
      retryCount,
    });

    // Update CronJob lastRunAt and reset retryCount
    await CronJobModel.findOneAndUpdate(
      { userId: phoneNumber, name: jobName },
      { lastRunAt: new Date(), retryCount: 0 }
    );

    console.log(`[Agenda] Job "${jobName}" sent successfully to user ${phoneNumber}`);
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';

    console.error(`[Agenda] Job "${jobName}" failed for user ${phoneNumber}:`, errorMessage);

    // Log the failure
    await JobAuditLogModel.create({
      userId: phoneNumber,
      jobId: jobName,
      jobName,
      message,
      status: 'failed',
      runAt,
      errorMessage,
      retryCount,
    });

    // Handle retries with backoff (Decision C)
    if (retryCount < MAX_RETRIES) {
      await rescheduleWithBackoff(job, retryCount, errorMessage);
    } else {
      // Max retries reached — notify user
      console.warn(`[Agenda] Job "${jobName}" failed after ${MAX_RETRIES} retries for user ${phoneNumber}`);

      // Log as missed
      await JobAuditLogModel.create({
        userId: phoneNumber,
        jobId: jobName,
        jobName,
        message,
        status: 'missed',
        runAt,
        errorMessage: `Failed after ${MAX_RETRIES} retries: ${errorMessage}`,
        retryCount,
      });

      // Send failure notification to user (Decision C)
      await notifyUserOfFailure(phoneNumber, jobName, MAX_RETRIES);

      // Reset retryCount on the CronJob
      await CronJobModel.findOneAndUpdate(
        { userId: phoneNumber, name: jobName },
        { retryCount: 0 }
      );
    }
  }
}

/**
 * Define the 'send-whatsapp-message' Agenda job.
 * Single definition for ALL users — each job instance carries userId + message in its data.
 * Concurrency: 50 (Decision C)
 */
export async function defineAgendaJobs(): Promise<void> {
  const agenda = getAgenda();

  agenda.define(
    'send-whatsapp-message',
    sendWhatsAppMessageHandler,
    {
      concurrency: 50,
      lockLimit: 50,
      lockLifetime: 5 * 60 * 1000, // 5 minutes
    }
  );

  console.log('[Agenda] Job "send-whatsapp-message" defined');
}
