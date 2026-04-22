-- =====================================================
-- AUTOMATIC AUDIT LOG CLEANUP SYSTEM
-- =====================================================
-- This script creates a MySQL Event that automatically
-- deletes audit logs older than 1 month to optimize
-- database performance and storage
-- =====================================================

USE ivmscom_Inventra2;

-- Enable MySQL Event Scheduler (required for events to run)
SET GLOBAL event_scheduler = ON;

-- Drop existing event if it exists
DROP EVENT IF EXISTS cleanup_old_audit_logs;

-- Create the automated cleanup event
DELIMITER $$

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
  
  -- Log the cleanup action (creates a system log entry)
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
END$$

DELIMITER ;

-- Verify the event was created
SELECT 
  EVENT_NAME,
  INTERVAL_VALUE,
  INTERVAL_FIELD,
  STARTS,
  STATUS,
  EVENT_COMMENT
FROM information_schema.EVENTS 
WHERE EVENT_SCHEMA = DATABASE() 
AND EVENT_NAME = 'cleanup_old_audit_logs';

-- Show current event scheduler status
SHOW VARIABLES LIKE 'event_scheduler';

SELECT '✅ Audit log auto-cleanup configured successfully!' AS Status;
SELECT 'Logs older than 1 month will be automatically deleted daily' AS Info;

-- =====================================================
-- MANUAL CLEANUP (if needed)
-- =====================================================
-- To manually trigger cleanup immediately, uncomment and run:
-- DELETE FROM HISTORY_LOG WHERE Timestamp < DATE_SUB(NOW(), INTERVAL 1 MONTH);

-- To disable the event:
-- ALTER EVENT cleanup_old_audit_logs DISABLE;

-- To enable the event:
-- ALTER EVENT cleanup_old_audit_logs ENABLE;

-- To change retention period (e.g., 2 months):
-- DROP EVENT cleanup_old_audit_logs;
-- Then recreate with different INTERVAL (change "1 MONTH" to "2 MONTH")

-- To check when event will run next:
-- SELECT EVENT_NAME, LAST_EXECUTED, STARTS, STATUS 
-- FROM information_schema.EVENTS 
-- WHERE EVENT_NAME = 'cleanup_old_audit_logs';
