-- =====================================================
-- AUDIT LOGGING TRIGGERS - CORRECTED VERSION
-- =====================================================
-- This script creates database triggers to automatically log
-- all INSERT, UPDATE, and DELETE operations to the HISTORY_LOG table
-- =====================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_project_insert;
DROP TRIGGER IF EXISTS trg_project_update;
DROP TRIGGER IF EXISTS trg_project_delete;
DROP TRIGGER IF EXISTS trg_asset_insert;
DROP TRIGGER IF EXISTS trg_asset_update;
DROP TRIGGER IF EXISTS trg_asset_delete;
DROP TRIGGER IF EXISTS trg_pmaintenance_insert;
DROP TRIGGER IF EXISTS trg_pmaintenance_delete;
DROP TRIGGER IF EXISTS trg_solution_principal_insert;
DROP TRIGGER IF EXISTS trg_solution_principal_delete;
DROP TRIGGER IF EXISTS trg_user_insert;
DROP TRIGGER IF EXISTS trg_user_update;
DROP TRIGGER IF EXISTS trg_user_delete;

-- =====================================================
-- PROJECT TABLE TRIGGERS
-- =====================================================

DELIMITER $$

CREATE TRIGGER trg_project_insert
AFTER INSERT ON PROJECT
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'PROJECT',
    NEW.Project_ID,
    'INSERT',
    CONCAT('Created project: ', NEW.Project_Title),
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@log_id, 'Project_Ref_Number', '', NEW.Project_Ref_Number),
    (@log_id, 'Project_Title', '', NEW.Project_Title),
    (@log_id, 'file_path_logo', '', COALESCE(NEW.file_path_logo, '')),
    (@log_id, 'Warranty', '', COALESCE(NEW.Warranty, '')),
    (@log_id, 'Preventive_Maintenance', '', COALESCE(NEW.Preventive_Maintenance, '')),
    (@log_id, 'Start_Date', '', COALESCE(NEW.Start_Date, '')),
    (@log_id, 'End_Date', '', COALESCE(NEW.End_Date, '')),
    (@log_id, 'Antivirus', '', COALESCE(NEW.Antivirus, '')),
    (@log_id, 'PM_Frequency', '', COALESCE(NEW.PM_Frequency, ''));
END$$

CREATE TRIGGER trg_project_update
AFTER UPDATE ON PROJECT
FOR EACH ROW
BEGIN
  DECLARE change_desc TEXT;
  DECLARE changes_count INT DEFAULT 0;
  
  SET change_desc = CONCAT('Updated project: ', NEW.Project_Title);
  
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'PROJECT',
    NEW.Project_ID,
    'UPDATE',
    change_desc,
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  IF OLD.Project_Ref_Number != NEW.Project_Ref_Number THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Project_Ref_Number', OLD.Project_Ref_Number, NEW.Project_Ref_Number);
    SET changes_count = changes_count + 1;
  END IF;
  
  IF OLD.Project_Title != NEW.Project_Title THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Project_Title', OLD.Project_Title, NEW.Project_Title);
    SET changes_count = changes_count + 1;
  END IF;
  
  IF COALESCE(OLD.file_path_logo, '') != COALESCE(NEW.file_path_logo, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'file_path_logo', COALESCE(OLD.file_path_logo, ''), COALESCE(NEW.file_path_logo, ''));
    SET changes_count = changes_count + 1;
  END IF;
  
  IF COALESCE(OLD.Warranty, '') != COALESCE(NEW.Warranty, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Warranty', COALESCE(OLD.Warranty, ''), COALESCE(NEW.Warranty, ''));
    SET changes_count = changes_count + 1;
  END IF;
  
  IF COALESCE(OLD.Preventive_Maintenance, '') != COALESCE(NEW.Preventive_Maintenance, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Preventive_Maintenance', COALESCE(OLD.Preventive_Maintenance, ''), COALESCE(NEW.Preventive_Maintenance, ''));
    SET changes_count = changes_count + 1;
  END IF;
  
  IF COALESCE(OLD.Start_Date, '') != COALESCE(NEW.Start_Date, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Start_Date', COALESCE(OLD.Start_Date, ''), COALESCE(NEW.Start_Date, ''));
    SET changes_count = changes_count + 1;
  END IF;
  
  IF COALESCE(OLD.End_Date, '') != COALESCE(NEW.End_Date, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'End_Date', COALESCE(OLD.End_Date, ''), COALESCE(NEW.End_Date, ''));
    SET changes_count = changes_count + 1;
  END IF;
  
  IF COALESCE(OLD.Antivirus, '') != COALESCE(NEW.Antivirus, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Antivirus', COALESCE(OLD.Antivirus, ''), COALESCE(NEW.Antivirus, ''));
    SET changes_count = changes_count + 1;
  END IF;
  
  IF COALESCE(OLD.PM_Frequency, '') != COALESCE(NEW.PM_Frequency, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'PM_Frequency', COALESCE(OLD.PM_Frequency, ''), COALESCE(NEW.PM_Frequency, ''));
    SET changes_count = changes_count + 1;
  END IF;
END$$

CREATE TRIGGER trg_project_delete
BEFORE DELETE ON PROJECT
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'PROJECT',
    OLD.Project_ID,
    'DELETE',
    CONCAT('Deleted project: ', OLD.Project_Title),
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@log_id, 'Project_Ref_Number', OLD.Project_Ref_Number, ''),
    (@log_id, 'Project_Title', OLD.Project_Title, ''),
    (@log_id, 'file_path_logo', COALESCE(OLD.file_path_logo, ''), ''),
    (@log_id, 'Warranty', COALESCE(OLD.Warranty, ''), ''),
    (@log_id, 'Preventive_Maintenance', COALESCE(OLD.Preventive_Maintenance, ''), ''),
    (@log_id, 'Start_Date', COALESCE(OLD.Start_Date, ''), ''),
    (@log_id, 'End_Date', COALESCE(OLD.End_Date, ''), ''),
    (@log_id, 'Antivirus', COALESCE(OLD.Antivirus, ''), ''),
    (@log_id, 'PM_Frequency', COALESCE(OLD.PM_Frequency, ''), '');
END$$

-- =====================================================
-- ASSET TABLE TRIGGERS
-- =====================================================

CREATE TRIGGER trg_asset_insert
AFTER INSERT ON ASSET
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'ASSET',
    NEW.Asset_ID,
    'INSERT',
    CONCAT('Created asset: ', COALESCE(NEW.Asset_Tag_ID, NEW.Asset_Serial_Number)),
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@log_id, 'Asset_Serial_Number', '', COALESCE(NEW.Asset_Serial_Number, '')),
    (@log_id, 'Asset_Tag_ID', '', COALESCE(NEW.Asset_Tag_ID, '')),
    (@log_id, 'Item_Name', '', COALESCE(NEW.Item_Name, '')),
    (@log_id, 'Status', '', COALESCE(NEW.Status, ''));
END$$

CREATE TRIGGER trg_asset_update
AFTER UPDATE ON ASSET
FOR EACH ROW
BEGIN
  DECLARE change_desc TEXT;
  DECLARE has_changes BOOLEAN DEFAULT FALSE;
  
  -- Check if any field actually changed
  IF COALESCE(OLD.Asset_Serial_Number, '') != COALESCE(NEW.Asset_Serial_Number, '') OR
     COALESCE(OLD.Asset_Tag_ID, '') != COALESCE(NEW.Asset_Tag_ID, '') OR
     COALESCE(OLD.Item_Name, '') != COALESCE(NEW.Item_Name, '') OR
     COALESCE(OLD.Status, '') != COALESCE(NEW.Status, '') OR
     COALESCE(OLD.Is_Flagged, 0) != COALESCE(NEW.Is_Flagged, 0) OR
     COALESCE(OLD.Flag_Remarks, '') != COALESCE(NEW.Flag_Remarks, '') OR
     COALESCE(OLD.Flag_Date, '') != COALESCE(NEW.Flag_Date, '') OR
     COALESCE(OLD.Flagged_By, 0) != COALESCE(NEW.Flagged_By, 0) OR
     COALESCE(OLD.Windows, '') != COALESCE(NEW.Windows, '') OR
     COALESCE(OLD.Microsoft_Office, '') != COALESCE(NEW.Microsoft_Office, '') OR
     COALESCE(OLD.Monthly_Prices, 0) != COALESCE(NEW.Monthly_Prices, 0) THEN
    
    SET has_changes = TRUE;
  END IF;
  
  -- Only create log entry if there are actual changes
  IF has_changes THEN
    SET change_desc = CONCAT('Updated asset: ', COALESCE(NEW.Asset_Tag_ID, NEW.Asset_Serial_Number));
    
    INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
    VALUES (
      COALESCE(@current_user_id, 1),
      'ASSET',
      NEW.Asset_ID,
      'UPDATE',
      change_desc,
      NOW()
    );
    
    SET @log_id = LAST_INSERT_ID();
    
    -- Log individual field changes
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
  END IF;
END$$

CREATE TRIGGER trg_asset_delete
BEFORE DELETE ON ASSET
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'ASSET',
    OLD.Asset_ID,
    'DELETE',
    CONCAT('Deleted asset: ', COALESCE(OLD.Asset_Tag_ID, OLD.Asset_Serial_Number)),
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@log_id, 'Asset_Serial_Number', COALESCE(OLD.Asset_Serial_Number, ''), ''),
    (@log_id, 'Asset_Tag_ID', COALESCE(OLD.Asset_Tag_ID, ''), ''),
    (@log_id, 'Item_Name', COALESCE(OLD.Item_Name, ''), ''),
    (@log_id, 'Status', COALESCE(OLD.Status, ''), '');
END$$

-- =====================================================
-- PMAINTENANCE TABLE TRIGGERS
-- =====================================================

CREATE TRIGGER trg_pmaintenance_insert
AFTER INSERT ON PMAINTENANCE
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, NEW.Created_By, 1),
    'PMAINTENANCE',
    NEW.PM_ID,
    'INSERT',
    CONCAT('Created PM record for asset ID: ', NEW.Asset_ID, ' on ', DATE_FORMAT(NEW.PM_Date, '%Y-%m-%d')),
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@log_id, 'Asset_ID', '', NEW.Asset_ID),
    (@log_id, 'PM_Date', '', NEW.PM_Date),
    (@log_id, 'Status', '', COALESCE(NEW.Status, '')),
    (@log_id, 'Remarks', '', COALESCE(NEW.Remarks, ''));
END$$

CREATE TRIGGER trg_pmaintenance_delete
BEFORE DELETE ON PMAINTENANCE
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'PMAINTENANCE',
    OLD.PM_ID,
    'DELETE',
    CONCAT('Deleted PM record for asset ID: ', OLD.Asset_ID, ' dated ', DATE_FORMAT(OLD.PM_Date, '%Y-%m-%d')),
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@log_id, 'Asset_ID', OLD.Asset_ID, ''),
    (@log_id, 'PM_Date', OLD.PM_Date, ''),
    (@log_id, 'Status', COALESCE(OLD.Status, ''), ''),
    (@log_id, 'Remarks', COALESCE(OLD.Remarks, ''), '');
END$$

-- =====================================================
-- SOLUTION_PRINCIPAL TABLE TRIGGERS
-- =====================================================

CREATE TRIGGER trg_solution_principal_insert
AFTER INSERT ON SOLUTION_PRINCIPAL
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'SOLUTION_PRINCIPAL',
    NEW.SP_ID,
    'INSERT',
    CONCAT('Created solution principal: ', NEW.SP_Name),
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@log_id, 'SP_Name', '', NEW.SP_Name);
END$$

CREATE TRIGGER trg_solution_principal_delete
BEFORE DELETE ON SOLUTION_PRINCIPAL
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'SOLUTION_PRINCIPAL',
    OLD.SP_ID,
    'DELETE',
    CONCAT('Deleted solution principal: ', OLD.SP_Name),
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@log_id, 'SP_Name', OLD.SP_Name, '');
END$$

-- =====================================================
-- USER TABLE TRIGGERS
-- =====================================================

CREATE TRIGGER trg_user_insert
AFTER INSERT ON USER
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'USER',
    NEW.User_ID,
    'INSERT',
    CONCAT('Created user: ', NEW.username),
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@log_id, 'username', '', NEW.username),
    (@log_id, 'User_Email', '', NEW.User_Email),
    (@log_id, 'User_Role', '', NEW.User_Role),
    (@log_id, 'First_Name', '', COALESCE(NEW.First_Name, '')),
    (@log_id, 'Last_Name', '', COALESCE(NEW.Last_Name, ''));
END$$

CREATE TRIGGER trg_user_update
AFTER UPDATE ON USER
FOR EACH ROW
BEGIN
  DECLARE change_desc TEXT;
  
  SET change_desc = CONCAT('Updated user: ', NEW.username);
  
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'USER',
    NEW.User_ID,
    'UPDATE',
    change_desc,
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  IF OLD.username != NEW.username THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'username', OLD.username, NEW.username);
  END IF;
  
  IF OLD.User_Email != NEW.User_Email THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'User_Email', OLD.User_Email, NEW.User_Email);
  END IF;
  
  IF OLD.User_Role != NEW.User_Role THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'User_Role', OLD.User_Role, NEW.User_Role);
  END IF;
  
  IF COALESCE(OLD.First_Name, '') != COALESCE(NEW.First_Name, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'First_Name', COALESCE(OLD.First_Name, ''), COALESCE(NEW.First_Name, ''));
  END IF;
  
  IF COALESCE(OLD.Last_Name, '') != COALESCE(NEW.Last_Name, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@log_id, 'Last_Name', COALESCE(OLD.Last_Name, ''), COALESCE(NEW.Last_Name, ''));
  END IF;
END$$

CREATE TRIGGER trg_user_delete
BEFORE DELETE ON USER
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'USER',
    OLD.User_ID,
    'DELETE',
    CONCAT('Deleted user: ', OLD.username),
    NOW()
  );
  
  SET @log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@log_id, 'username', OLD.username, ''),
    (@log_id, 'User_Email', OLD.User_Email, ''),
    (@log_id, 'User_Role', OLD.User_Role, ''),
    (@log_id, 'First_Name', COALESCE(OLD.First_Name, ''), ''),
    (@log_id, 'Last_Name', COALESCE(OLD.Last_Name, ''), '');
END$$

DELIMITER ;

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Check and create indexes only if they don't exist
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
               WHERE table_schema = DATABASE() 
               AND table_name = 'HISTORY_LOG' 
               AND index_name = 'idx_history_log_user_id');
SET @sqlstmt := IF(@exist = 0, 'CREATE INDEX idx_history_log_user_id ON HISTORY_LOG(User_ID)', 'SELECT ''Index already exists''');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
               WHERE table_schema = DATABASE() 
               AND table_name = 'HISTORY_LOG' 
               AND index_name = 'idx_history_log_table_record');
SET @sqlstmt := IF(@exist = 0, 'CREATE INDEX idx_history_log_table_record ON HISTORY_LOG(Table_Name, Record_ID)', 'SELECT ''Index already exists''');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
               WHERE table_schema = DATABASE() 
               AND table_name = 'HISTORY_LOG' 
               AND index_name = 'idx_history_log_timestamp');
SET @sqlstmt := IF(@exist = 0, 'CREATE INDEX idx_history_log_timestamp ON HISTORY_LOG(Timestamp)', 'SELECT ''Index already exists''');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.statistics 
               WHERE table_schema = DATABASE() 
               AND table_name = 'HISTORY_LOG_CHANGES' 
               AND index_name = 'idx_history_log_changes_log_id');
SET @sqlstmt := IF(@exist = 0, 'CREATE INDEX idx_history_log_changes_log_id ON HISTORY_LOG_CHANGES(Log_ID)', 'SELECT ''Index already exists''');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- AUDIT TRIGGERS SETUP COMPLETE
-- =====================================================
