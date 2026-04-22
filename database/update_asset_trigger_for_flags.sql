-- =====================================================
-- UPDATE ASSET TRIGGER TO TRACK FLAG CHANGES
-- Run this in phpMyAdmin or your database management tool
-- =====================================================

USE ivmscom_Inventra2;

-- Drop existing trigger
DROP TRIGGER IF EXISTS trg_asset_update;

-- Create updated trigger with flag tracking
DELIMITER $$

CREATE TRIGGER trg_asset_update
AFTER UPDATE ON ASSET
FOR EACH ROW
BEGIN
  DECLARE change_desc TEXT;
  
  SET change_desc = CONCAT('Updated asset: ', COALESCE(NEW.Asset_Tag_ID, NEW.Asset_Serial_Number));
  
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    @current_user_id,
    'ASSET',
    NEW.Asset_ID,
    'UPDATE',
    change_desc,
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  -- Track basic asset fields
  IF COALESCE(OLD.Asset_Serial_Number, '') != COALESCE(NEW.Asset_Serial_Number, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Asset_Serial_Number', COALESCE(OLD.Asset_Serial_Number, ''), COALESCE(NEW.Asset_Serial_Number, ''));
  END IF;
  
  IF COALESCE(OLD.Asset_Tag_ID, '') != COALESCE(NEW.Asset_Tag_ID, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Asset_Tag_ID', COALESCE(OLD.Asset_Tag_ID, ''), COALESCE(NEW.Asset_Tag_ID, ''));
  END IF;
  
  IF COALESCE(OLD.Item_Name, '') != COALESCE(NEW.Item_Name, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Item_Name', COALESCE(OLD.Item_Name, ''), COALESCE(NEW.Item_Name, ''));
  END IF;
  
  IF COALESCE(OLD.Status, '') != COALESCE(NEW.Status, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Status', COALESCE(OLD.Status, ''), COALESCE(NEW.Status, ''));
  END IF;
  
  -- Track flag-related changes
  IF COALESCE(OLD.Is_Flagged, 0) != COALESCE(NEW.Is_Flagged, 0) THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Is_Flagged', IF(OLD.Is_Flagged = 1, 'Yes', 'No'), IF(NEW.Is_Flagged = 1, 'Yes', 'No'));
  END IF;
  
  IF COALESCE(OLD.Flag_Remarks, '') != COALESCE(NEW.Flag_Remarks, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Flag_Remarks', COALESCE(OLD.Flag_Remarks, ''), COALESCE(NEW.Flag_Remarks, ''));
  END IF;
  
  IF COALESCE(OLD.Flag_Date, '') != COALESCE(NEW.Flag_Date, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Flag_Date', COALESCE(OLD.Flag_Date, ''), COALESCE(NEW.Flag_Date, ''));
  END IF;
  
  IF COALESCE(OLD.Flagged_By, 0) != COALESCE(NEW.Flagged_By, 0) THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Flagged_By', COALESCE(OLD.Flagged_By, ''), COALESCE(NEW.Flagged_By, ''));
  END IF;
  
  -- Track Windows and Office changes
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
END$$

DELIMITER ;

-- Verify the trigger was created
SHOW TRIGGERS WHERE `Trigger` = 'trg_asset_update';

SELECT 'Asset update trigger has been updated to track flag changes!' AS Status;
