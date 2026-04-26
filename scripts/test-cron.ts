import { executeCronTool } from '../src/modules/cronTools.js';
import { listCronJobs, deleteCronJob } from '../src/modules/cronService.js';
import { getAgenda } from '../src/modules/agenda.js';
import { CronJobModel } from '../src/database/models/CronJob.js';
import { connectDatabase, closeDatabase } from '../src/database/connection.js';

const TEST_USER = 'test-user-123';
const TEST_PHONE = '+1234567890';

async function testRecurringJob() {
  console.log('\n--- Testing Recurring Job ---');

  const result = await executeCronTool('schedule_reminder', {
    name: 'test-daily-reminder',
    naturalSchedule: 'every day at 9am',
    cronExpression: '0 9 * * *',
    timezone: 'UTC',
    message: 'Test daily reminder message',
    isOneOff: false
  }, TEST_USER, TEST_PHONE);

  console.log('Result:', result);

  // Verify DB record
  const dbJob = await CronJobModel.findOne({ userId: TEST_USER, name: 'test-daily-reminder' });
  console.log('DB Record:', dbJob ? {
    name: dbJob.name,
    cronExpression: dbJob.cronExpression,
    enabled: dbJob.enabled
  } : 'NOT FOUND');

  // Verify Agenda job
  const agenda = getAgenda();
  const agendaJobs = await agenda.jobs({
    name: 'send-whatsapp-message',
    'data.userId': TEST_USER,
    'data.jobName': 'test-daily-reminder'
  });
  console.log('Agenda jobs found:', agendaJobs.length);
  if (agendaJobs[0]) {
    console.log('Agenda nextRunAt:', agendaJobs[0].attrs.nextRunAt);
    console.log('Agenda repeatInterval:', agendaJobs[0].attrs.repeatInterval);
  }

  return dbJob !== null && agendaJobs.length === 1;
}

async function testOneOffJob() {
  console.log('\n--- Testing One-Off Job ---');

  const result = await executeCronTool('schedule_reminder', {
    name: 'test-oneoff-reminder',
    naturalSchedule: 'tomorrow at 3pm',
    cronExpression: 'at 2099-12-31 15:00:00',  // Far future so it doesn't actually run
    timezone: 'UTC',
    message: 'Test one-off reminder message',
    isOneOff: true
  }, TEST_USER, TEST_PHONE);

  console.log('Result:', result);

  // Verify DB record
  const dbJob = await CronJobModel.findOne({ userId: TEST_USER, name: 'test-oneoff-reminder' });
  console.log('DB Record:', dbJob ? {
    name: dbJob.name,
    cronExpression: dbJob.cronExpression,  // Should be "once:2099-12-31 15:00:00" (no "at ")
    enabled: dbJob.enabled
  } : 'NOT FOUND');

  // Verify the stored expression doesn't have 'at ' in it
  if (dbJob && dbJob.cronExpression.includes('at ')) {
    console.error('❌ ERROR: cronExpression still contains "at " prefix:', dbJob.cronExpression);
  }

  // Verify Agenda job
  const agenda = getAgenda();
  const agendaJobs = await agenda.jobs({
    name: 'send-whatsapp-message',
    'data.userId': TEST_USER,
    'data.jobName': 'test-oneoff-reminder'
  });
  console.log('Agenda jobs found:', agendaJobs.length);
  if (agendaJobs[0]) {
    console.log('Agenda nextRunAt:', agendaJobs[0].attrs.nextRunAt);
  }

  return dbJob !== null && agendaJobs.length === 1;
}

async function testListJobs() {
  console.log('\n--- Testing List Jobs ---');

  const result = await executeCronTool('list_cron_jobs', {}, TEST_USER, TEST_PHONE);
  console.log('Result:', result);

  return result.includes('test-daily-reminder') && result.includes('test-oneoff-reminder');
}

async function testDeleteJob() {
  console.log('\n--- Testing Delete Job ---');

  const result = await executeCronTool('delete_cron_job', {
    name: 'test-daily-reminder'
  }, TEST_USER, TEST_PHONE);

  console.log('Result:', result);

  // Verify deletion
  const dbJob = await CronJobModel.findOne({ userId: TEST_USER, name: 'test-daily-reminder' });
  console.log('DB Record after delete:', dbJob || 'NOT FOUND (good)');

  const agenda = getAgenda();
  const agendaJobs = await agenda.jobs({
    name: 'send-whatsapp-message',
    'data.userId': TEST_USER,
    'data.jobName': 'test-daily-reminder'
  });
  console.log('Agenda jobs after delete:', agendaJobs.length, '(should be 0)');

  return dbJob === null && agendaJobs.length === 0;
}

async function cleanup() {
  console.log('\n--- Cleanup ---');
  try {
    await deleteCronJob(TEST_USER, 'test-daily-reminder');
    console.log('Deleted test-daily-reminder');
  } catch (e) {
    // Ignore if not found
  }
  try {
    await deleteCronJob(TEST_USER, 'test-oneoff-reminder');
    console.log('Deleted test-oneoff-reminder');
  } catch (e) {
    // Ignore if not found
  }
  console.log('Cleanup complete');
}

async function main() {
  console.log('Connecting to database...');
  await connectDatabase();
  console.log('Connected!');

  // Ensure agenda is initialized
  getAgenda();

  try {
    await cleanup();  // Clean any previous test runs

    const results = {
      recurring: await testRecurringJob(),
      oneOff: await testOneOffJob(),
      list: await testListJobs(),
      delete: await testDeleteJob(),
    };

    console.log('\n========================================');
    console.log('Test Results:');
    console.log('  Recurring job:', results.recurring ? '✅ PASS' : '❌ FAIL');
    console.log('  One-off job:', results.oneOff ? '✅ PASS' : '❌ FAIL');
    console.log('  List jobs:', results.list ? '✅ PASS' : '❌ FAIL');
    console.log('  Delete job:', results.delete ? '✅ PASS' : '❌ FAIL');
    console.log('========================================');

    const allPassed = Object.values(results).every(r => r);
    console.log(allPassed ? '\n✅ All tests passed!' : '\n❌ Some tests failed!');

    await cleanup();
    await closeDatabase();

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    await cleanup();
    await closeDatabase();
    process.exit(1);
  }
}

main();
