-- =====================================================
-- FIX AUDIT TRIGGERS - Allow NULL User_ID temporarily
-- =====================================================
-- This fixes the foreign key constraint issue by allowing
-- NULL User_IDs in HISTORY_LOG when @current_user_id is not set
-- =====================================================

-- First, let's make User_ID nullable in HISTORY_LOG table
ALTER TABLE HISTORY_LOG 
MODIFY COLUMN User_ID INT NULL;

-- Now let's update all triggers to use NULL instead of a default user ID
-- This is safer than using a random default

DELIMITER $$

DROP TRIGGER IF EXISTS trg_asset_insert$$
CREATE TRIGGER trg_asset_insert
AFTER INSERT ON ASSET
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    @current_user_id,  -- Use NULL if not set instead of defaulting to 1
    'ASSET',
    NEW.Asset_ID,
    'INSERT',
    CONCAT('Created asset: ', COALESCE(NEW.Asset_Tag_ID, 'No Tag')),
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@log_id, 'Asset_Serial_Number', '', COALESCE(NEW.Asset_Serial_Number, '')),
    (@log_id, 'Asset_Tag_ID', '', COALESCE(NEW.Asset_Tag_ID, '')),
    (@log_id, 'Item_Name', '', COALESCE(NEW.Item_Name, '')),
    (@log_id, 'Category_ID', '', COALESCE(NEW.Category_ID, '')),
    (@log_id, 'Model_ID', '', COALESCE(NEW.Model_ID, '')),
    (@log_id, 'Status', '', COALESCE(NEW.Status, '')),
    (@log_id, 'Windows', '', COALESCE(NEW.Windows, '')),
    (@log_id, 'Microsoft_Office', '', COALESCE(NEW.Microsoft_Office, '')),
    (@log_id, 'Monthly_Prices', '', COALESCE(NEW.Monthly_Prices, ''));
END$$

DROP TRIGGER IF EXISTS trg_asset_update$$
CREATE TRIGGER trg_asset_update
AFTER UPDATE ON ASSET
FOR EACH ROW
BEGIN
  DECLARE changes TEXT DEFAULT '';
  DECLARE field_count INT DEFAULT 0;
  
  SET @log_id = NULL;
  
  IF OLD.Asset_Serial_Number != NEW.Asset_Serial_Number THEN
    SET changes = CONCAT(changes, IF(field_count > 0, ', ', ''), 'Serial Number');
    SET field_count = field_count + 1;
  END IF;
  
  IF OLD.Asset_Tag_ID != NEW.Asset_Tag_ID THEN
    SET changes = CONCAT(changes, IF(field_count > 0, ', ', ''), 'Tag ID');
    SET field_count = field_count + 1;
  END IF;
  
  IF OLD.Item_Name != NEW.Item_Name THEN
    SET changes = CONCAT(changes, IF(field_count > 0, ', ', ''), 'Item Name');
    SET field_count = field_count + 1;
  END IF;
  
  IF COALESCE(OLD.Category_ID, 0) != COALESCE(NEW.Category_ID, 0) THEN
    SET changes = CONCAT(changes, IF(field_count > 0, ', ', ''), 'Category');
    SET field_count = field_count + 1;
  END IF;
  
  IF COALESCE(OLD.Model_ID, 0) != COALESCE(NEW.Model_ID, 0) THEN
    SET changes = CONCAT(changes, IF(field_count > 0, ', ', ''), 'Model');
    SET field_count = field_count + 1;
  END IF;
  
  IF COALESCE(OLD.Status, '') != COALESCE(NEW.Status, '') THEN
    SET changes = CONCAT(changes, IF(field_count > 0, ', ', ''), 'Status');
    SET field_count = field_count + 1;
  END IF;
  
  IF COALESCE(OLD.Windows, '') != COALESCE(NEW.Windows, '') THEN
    SET changes = CONCAT(changes, IF(field_count > 0, ', ', ''), 'Windows');
    SET field_count = field_count + 1;
  END IF;
  
  IF COALESCE(OLD.Microsoft_Office, '') != COALESCE(NEW.Microsoft_Office, '') THEN
    SET changes = CONCAT(changes, IF(field_count > 0, ', ', ''), 'MS Office');
    SET field_count = field_count + 1;
  END IF;
  
  IF COALESCE(OLD.Monthly_Prices, 0) != COALESCE(NEW.Monthly_Prices, 0) THEN
    SET changes = CONCAT(changes, IF(field_count > 0, ', ', ''), 'Monthly Price');
    SET field_count = field_count + 1;
  END IF;
  
  IF field_count > 0 THEN
    INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
    VALUES (
      @current_user_id,  -- Use NULL if not set
      'ASSET',
      NEW.Asset_ID,
      'UPDATE',
      CONCAT('Updated asset ', COALESCE(NEW.Asset_Tag_ID, 'No Tag'), ': ', changes),
      NOW()
    );
    
    SET @log_id = LAST_INSERT_ID();
    
    IF OLD.Asset_Serial_Number != NEW.Asset_Serial_Number THEN
      INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
      VALUES (@log_id, 'Asset_Serial_Number', OLD.Asset_Serial_Number, NEW.Asset_Serial_Number);
    END IF;
    
    IF OLD.Asset_Tag_ID != NEW.Asset_Tag_ID THEN
      INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
      VALUES (@log_id, 'Asset_Tag_ID', OLD.Asset_Tag_ID, NEW.Asset_Tag_ID);
    END IF;
    
    IF OLD.Item_Name != NEW.Item_Name THEN
      INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
      VALUES (@log_id, 'Item_Name', OLD.Item_Name, NEW.Item_Name);
    END IF;
    
    IF COALESCE(OLD.Category_ID, 0) != COALESCE(NEW.Category_ID, 0) THEN
      INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
      VALUES (@log_id, 'Category_ID', COALESCE(OLD.Category_ID, ''), COALESCE(NEW.Category_ID, ''));
    END IF;
    
    IF COALESCE(OLD.Model_ID, 0) != COALESCE(NEW.Model_ID, 0) THEN
      INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
      VALUES (@log_id, 'Model_ID', COALESCE(OLD.Model_ID, ''), COALESCE(NEW.Model_ID, ''));
    END IF;
    
    IF COALESCE(OLD.Status, '') != COALESCE(NEW.Status, '') THEN
      INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
      VALUES (@log_id, 'Status', COALESCE(OLD.Status, ''), COALESCE(NEW.Status, ''));
    END IF;
    
    IF COALESCE(OLD.Windows, '') != COALESCE(NEW.Windows, '') THEN
      INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
      VALUES (@log_id, 'Windows', COALESCE(OLD.Windows, ''), COALESCE(NEW.Windows, ''));
    END IF;
    
    IF COALESCE(OLD.Microsoft_Office, '') != COALESCE(NEW.Microsoft_Office, '') THEN
      INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
      VALUES (@log_id, 'Microsoft_Office', COALESCE(OLD.Microsoft_Office, ''), COALESCE(NEW.Microsoft_Office, ''));
    END IF;
    
    IF COALESCE(OLD.Monthly_Prices, 0) != COALESCE(NEW.Monthly_Prices, 0) THEN
      INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
      VALUES (@log_id, 'Monthly_Prices', COALESCE(OLD.Monthly_Prices, ''), COALESCE(NEW.Monthly_Prices, ''));
    END IF;
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_asset_delete$$
CREATE TRIGGER trg_asset_delete
AFTER DELETE ON ASSET
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    @current_user_id,  -- Use NULL if not set
    'ASSET',
    OLD.Asset_ID,
    'DELETE',
    CONCAT('Deleted asset: ', COALESCE(OLD.Asset_Tag_ID, 'No Tag')),
    NOW()
  );
END$$

DELIMITER ;

SELECT 'Audit triggers updated successfully - User_ID can now be NULL' AS Status;
