const cron = require('node-cron');
const cleanupAuditLogs = require('../../database/cleanup_audit_logs');

// Configuration
const CLEANUP_SCHEDULE = '0 2 * * *'; // Run daily at 2:00 AM
const RETENTION_DAYS = 90; // Keep logs for 3 months (90 days)

console.log('🕐 Audit Log Cleanup Scheduler Started');
console.log(`📅 Schedule: ${CLEANUP_SCHEDULE} (Daily at 2:00 AM)`);
console.log(`🗂️  Retention: ${RETENTION_DAYS} days\n`);

// Schedule the cleanup task
const task = cron.schedule(CLEANUP_SCHEDULE, async () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🕐 Scheduled cleanup started at: ${new Date().toLocaleString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const result = await cleanupAuditLogs(RETENTION_DAYS);
    
    console.log('\n✅ Scheduled cleanup completed successfully');
    console.log(`📊 Deleted: ${result.deleted_logs} logs, ${result.deleted_changes} changes\n`);
    
  } catch (error) {
    console.error('\n❌ Scheduled cleanup failed:', error.message);
    console.error('Stack:', error.stack);
    console.log('');
  }
}, {
  scheduled: true,
  timezone: "Asia/Kuala_Lumpur" // Adjust to your timezone
});

// Run cleanup immediately on startup (optional - comment out if not needed)
console.log('🚀 Running initial cleanup on startup...\n');
cleanupAuditLogs(RETENTION_DAYS)
  .then((result) => {
    console.log('✅ Initial cleanup completed');
    console.log(`📊 Deleted: ${result.deleted_logs} logs, ${result.deleted_changes} changes\n`);
    console.log('⏰ Next scheduled cleanup will run at 2:00 AM daily');
  })
  .catch((error) => {
    console.error('❌ Initial cleanup failed:', error.message);
    console.log('⏰ Next scheduled cleanup will run at 2:00 AM daily');
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping audit log cleanup scheduler...');
  task.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Stopping audit log cleanup scheduler...');
  task.stop();
  process.exit(0);
});

module.exports = task;
