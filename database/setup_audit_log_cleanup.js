const db = require('../backend/config/database');

async function setupAuditLogCleanup() {
  const connection = await db.pool.getConnection();
  
  try {
    console.log('🔧 Setting up automatic audit log cleanup...\n');
    
    // Step 1: Enable MySQL Event Scheduler
    console.log('1️⃣  Enabling MySQL Event Scheduler...');
    await connection.query('SET GLOBAL event_scheduler = ON');
    console.log('   ✅ Event Scheduler enabled\n');
    
    // Step 2: Drop existing event if it exists
    console.log('2️⃣  Removing old cleanup event if exists...');
    await connection.query('DROP EVENT IF EXISTS cleanup_old_audit_logs');
    console.log('   ✅ Old event removed\n');
    
    // Step 3: Create the cleanup event
    console.log('3️⃣  Creating automated cleanup event...');
    const createEventSQL = `
CREATE EVENT cleanup_old_audit_logs
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 1 HOUR
COMMENT 'Automatically delete audit logs older than 1 month'
DO
BEGIN
  DECLARE deleted_changes INT DEFAULT 0;
  DECLARE deleted_logs INT DEFAULT 0;
  
  -- Delete old HISTORY_LOG_CHANGES first (child records)
  DELETE FROM HISTORY_LOG_CHANGES 
  WHERE Log_ID IN (
    SELECT HL_ID FROM HISTORY_LOG 
    WHERE Timestamp < DATE_SUB(NOW(), INTERVAL 1 MONTH)
  );
  
  SET deleted_changes = ROW_COUNT();
  
  -- Then delete old HISTORY_LOG entries (parent records)
  DELETE FROM HISTORY_LOG 
  WHERE Timestamp < DATE_SUB(NOW(), INTERVAL 1 MONTH);
  
  SET deleted_logs = ROW_COUNT();
  
  -- Log the cleanup action (optional - creates a new log entry for the cleanup itself)
  IF deleted_logs > 0 THEN
    INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
    VALUES (
      NULL,
      'SYSTEM',
      0,
      'CLEANUP',
      CONCAT('Auto-cleanup: Removed ', deleted_logs, ' log entries and ', deleted_changes, ' change records older than 1 month'),
      NOW()
    );
  END IF;
END
`;
    
    await connection.query(createEventSQL);
    console.log('   ✅ Cleanup event created successfully\n');
    
    // Step 4: Verify the event was created
    console.log('4️⃣  Verifying event setup...');
    const [events] = await connection.query(`
      SELECT 
        EVENT_NAME,
        INTERVAL_VALUE,
        INTERVAL_FIELD,
        STARTS,
        STATUS,
        EVENT_COMMENT
      FROM information_schema.EVENTS 
      WHERE EVENT_SCHEMA = DATABASE() 
      AND EVENT_NAME = 'cleanup_old_audit_logs'
    `);
    
    if (events.length > 0) {
      console.log('   ✅ Event verified:\n');
      console.table(events);
    }
    
    console.log('\n📊 Summary:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   ✓ Event Name: cleanup_old_audit_logs');
    console.log('   ✓ Schedule: Runs every 1 day');
    console.log('   ✓ Action: Deletes logs older than 1 month');
    console.log('   ✓ Status: Active');
    console.log('   ✓ Next Run: Within 1 hour from now');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('💡 Additional Info:');
    console.log('   • Old audit logs (>30 days) will be automatically deleted daily');
    console.log('   • This keeps the database optimized and performant');
    console.log('   • A cleanup log entry is created each time records are removed\n');
    
    console.log('📌 Manual Cleanup (if needed):');
    console.log('   To manually trigger cleanup now, run:');
    console.log('   DELETE FROM HISTORY_LOG WHERE Timestamp < DATE_SUB(NOW(), INTERVAL 1 MONTH);\n');
    
  } catch (error) {
    console.error('❌ Error setting up cleanup:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the setup
setupAuditLogCleanup()
  .then(() => {
    console.log('✅ Audit log auto-cleanup configured successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to setup auto-cleanup:', error);
    process.exit(1);
  });
