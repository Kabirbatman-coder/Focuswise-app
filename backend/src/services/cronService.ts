import cron from 'node-cron';
import { generateSchedule, getOptimalDaySummary } from './schedulerService';

// Store active users for scheduling (in production, this would come from a database)
const activeUsers: Set<string> = new Set();

// Register a user for daily scheduling
export function registerUserForDailySchedule(userId: string) {
  activeUsers.add(userId);
  console.log(`[Cron] Registered user ${userId} for daily scheduling`);
}

// Unregister a user from daily scheduling
export function unregisterUserFromDailySchedule(userId: string) {
  activeUsers.delete(userId);
  console.log(`[Cron] Unregistered user ${userId} from daily scheduling`);
}

// Get all registered users
export function getRegisteredUsers(): string[] {
  return Array.from(activeUsers);
}

// Daily schedule generation job - runs at 5 AM
async function runDailyScheduleJob() {
  console.log('[Cron] ═══════════════════════════════════════════════');
  console.log('[Cron] Running daily schedule job at 5 AM');
  console.log(`[Cron] Processing ${activeUsers.size} user(s)`);
  
  for (const userId of activeUsers) {
    try {
      console.log(`[Cron] Generating schedule for user: ${userId}`);
      const schedule = await generateSchedule(userId);
      console.log(`[Cron] ✅ Generated schedule with ${schedule.scheduledTasks.length} tasks for ${userId}`);
      
      // Here you would send a push notification with the summary
      const summary = await getOptimalDaySummary(userId);
      console.log(`[Cron] Summary: ${summary.substring(0, 100)}...`);
      
      // TODO: Send push notification
      // await sendPushNotification(userId, 'Daily Schedule Ready!', summary);
      
    } catch (error) {
      console.error(`[Cron] ❌ Error generating schedule for ${userId}:`, error);
    }
  }
  
  console.log('[Cron] Daily schedule job completed');
  console.log('[Cron] ═══════════════════════════════════════════════');
}

// Initialize cron jobs
export function initializeCronJobs() {
  console.log('[Cron] Initializing cron jobs...');
  
  // Schedule daily job at 5:00 AM
  // Cron format: minute hour day-of-month month day-of-week
  cron.schedule('0 5 * * *', () => {
    runDailyScheduleJob();
  });
  
  console.log('[Cron] ✅ Daily schedule job scheduled for 5:00 AM');
  
  // Optional: Energy reminder job - runs at 10 AM, 2 PM, and 6 PM
  cron.schedule('0 10,14,18 * * *', () => {
    console.log('[Cron] Energy check-in reminder time!');
    // TODO: Send push notification reminding users to log energy
    for (const userId of activeUsers) {
      console.log(`[Cron] Would send energy reminder to: ${userId}`);
      // await sendPushNotification(userId, 'Energy Check-in', 'How is your energy right now? Take a moment to log it.');
    }
  });
  
  console.log('[Cron] ✅ Energy reminder jobs scheduled for 10 AM, 2 PM, and 6 PM');
}

// Manually trigger schedule generation (for testing or manual refresh)
export async function triggerScheduleGeneration(userId: string): Promise<void> {
  console.log(`[Cron] Manually triggering schedule generation for: ${userId}`);
  await generateSchedule(userId);
}

