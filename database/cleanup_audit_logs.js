const db = require('../backend/config/database');

async function cleanupOldAuditLogs(retentionDays = 90) {
  const connection = await db.pool.getConnection();
  
  try {
    console.log('🧹 Starting audit log cleanup...\n');
    console.log(`📅 Retention Period: ${retentionDays} days`);
    console.log(`🗑️  Deleting logs older than: ${new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}\n`);
    
    // Start transaction
    await connection.beginTransaction();
    
    // Step 1: Count records to be deleted
    console.log('1️⃣  Counting records to delete...');
    const [countResult] = await connection.query(`
      SELECT 
        COUNT(DISTINCT hl.Log_ID) as log_count,
        COUNT(hlc.Change_ID) as change_count
      FROM HISTORY_LOG hl
      LEFT JOIN HISTORY_LOG_CHANGES hlc ON hl.Log_ID = hlc.Log_ID
      WHERE hl.Timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [retentionDays]);
    
    const { log_count, change_count } = countResult[0];
    console.log(`   📊 Found ${log_count} log entries and ${change_count} change records to delete\n`);
    
    if (log_count === 0) {
      console.log('✅ No old records to clean up. Database is already optimized!\n');
      await connection.rollback();
      return { deleted_logs: 0, deleted_changes: 0 };
    }
    
    // Step 2: Delete HISTORY_LOG_CHANGES first (child records)
    console.log('2️⃣  Deleting change records...');
    const [changesResult] = await connection.query(`
      DELETE FROM HISTORY_LOG_CHANGES 
      WHERE Log_ID IN (
        SELECT Log_ID FROM HISTORY_LOG 
        WHERE Timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
      )
    `, [retentionDays]);
    
    console.log(`   ✅ Deleted ${changesResult.affectedRows} change records\n`);
    
    // Step 3: Delete HISTORY_LOG entries (parent records)
    console.log('3️⃣  Deleting log entries...');
    const [logsResult] = await connection.query(`
      DELETE FROM HISTORY_LOG 
      WHERE Timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [retentionDays]);
    
    console.log(`   ✅ Deleted ${logsResult.affectedRows} log entries\n`);
    
    // Step 4: Optimize tables
    console.log('4️⃣  Optimizing tables...');
    await connection.query('OPTIMIZE TABLE HISTORY_LOG');
    await connection.query('OPTIMIZE TABLE HISTORY_LOG_CHANGES');
    console.log(`   ✅ Tables optimized\n`);
    
    // Commit transaction
    await connection.commit();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CLEANUP COMPLETED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Summary:`);
    console.log(`   • Log Entries Deleted: ${logsResult.affectedRows}`);
    console.log(`   • Change Records Deleted: ${changesResult.affectedRows}`);
    console.log(`   • Retention Period: ${retentionDays} days`);
    console.log(`   • Database: Optimized`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return {
      deleted_logs: logsResult.affectedRows,
      deleted_changes: changesResult.affectedRows
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Check if called directly or imported
if (require.main === module) {
  // Called directly - run cleanup
  const retentionDays = process.argv[2] ? parseInt(process.argv[2]) : 30;
  
  console.log('🚀 Audit Log Cleanup Utility\n');
  
  cleanupOldAuditLogs(retentionDays)
    .then(() => {
      console.log('💡 Tip: Schedule this script to run daily for automatic cleanup');
      console.log('   Example (Windows Task Scheduler): node cleanup_audit_logs.js 30\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Cleanup failed:', error);
      process.exit(1);
    });
} else {
  // Imported as module - export function
  module.exports = cleanupOldAuditLogs;
}
