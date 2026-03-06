-- Create Audit Triggers for Automatic Change Tracking
-- This file creates triggers for all tables that need audit logging

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_project_insert;
DROP TRIGGER IF EXISTS trg_project_update;
DROP TRIGGER IF EXISTS trg_project_delete;

DROP TRIGGER IF EXISTS trg_asset_insert;
DROP TRIGGER IF EXISTS trg_asset_update;
DROP TRIGGER IF EXISTS trg_asset_delete;

DROP TRIGGER IF EXISTS trg_pm_insert;
DROP TRIGGER IF EXISTS trg_pm_delete;

DROP TRIGGER IF EXISTS trg_solution_principal_insert;
DROP TRIGGER IF EXISTS trg_solution_principal_delete;

DROP TRIGGER IF EXISTS trg_user_insert;
DROP TRIGGER IF EXISTS trg_user_update;
DROP TRIGGER IF EXISTS trg_user_delete;

-- ====================
-- PROJECT TRIGGERS
-- ====================

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
  
  SET @last_log_id = LAST_INSERT_ID();
  
  -- Log all fields as new values
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@last_log_id, 'Project_Title', '', NEW.Project_Title),
    (@last_log_id, 'Customer_ID', '', IFNULL(NEW.Customer_ID, '')),
    (@last_log_id, 'Project_Ref_Number', '', IFNULL(NEW.Project_Ref_Number, '')),
    (@last_log_id, 'Start_Date', '', IFNULL(NEW.Start_Date, '')),
    (@last_log_id, 'End_Date', '', IFNULL(NEW.End_Date, '')),
    (@last_log_id, 'Warranty', '', IFNULL(NEW.Warranty, '')),
    (@last_log_id, 'Preventive_Maintenance', '', IFNULL(NEW.Preventive_Maintenance, '')),
    (@last_log_id, 'Antivirus', '', IFNULL(NEW.Antivirus, ''));
END$$

CREATE TRIGGER trg_project_update
AFTER UPDATE ON PROJECT
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'PROJECT',
    NEW.Project_ID,
    'UPDATE',
    CONCAT('Updated project: ', NEW.Project_Title),
    NOW()
  );
  
  SET @last_log_id = LAST_INSERT_ID();
  
  -- Log changed fields only
  IF OLD.Project_Title != NEW.Project_Title THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Project_Title', OLD.Project_Title, NEW.Project_Title);
  END IF;
  
  IF IFNULL(OLD.Project_Ref_Number, '') != IFNULL(NEW.Project_Ref_Number, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Project_Ref_Number', IFNULL(OLD.Project_Ref_Number, ''), IFNULL(NEW.Project_Ref_Number, ''));
  END IF;
  
  IF IFNULL(OLD.Start_Date, '') != IFNULL(NEW.Start_Date, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Start_Date', IFNULL(OLD.Start_Date, ''), IFNULL(NEW.Start_Date, ''));
  END IF;
  
  IF IFNULL(OLD.End_Date, '') != IFNULL(NEW.End_Date, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'End_Date', IFNULL(OLD.End_Date, ''), IFNULL(NEW.End_Date, ''));
  END IF;
  
  IF IFNULL(OLD.Warranty, '') != IFNULL(NEW.Warranty, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Warranty', IFNULL(OLD.Warranty, ''), IFNULL(NEW.Warranty, ''));
  END IF;
  
  IF IFNULL(OLD.Preventive_Maintenance, '') != IFNULL(NEW.Preventive_Maintenance, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Preventive_Maintenance', IFNULL(OLD.Preventive_Maintenance, ''), IFNULL(NEW.Preventive_Maintenance, ''));
  END IF;
  
  IF IFNULL(OLD.Antivirus, '') != IFNULL(NEW.Antivirus, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Antivirus', IFNULL(OLD.Antivirus, ''), IFNULL(NEW.Antivirus, ''));
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
END$$

-- ====================
-- ASSET TRIGGERS
-- ====================

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
    CONCAT('Created asset: ', IFNULL(NEW.Asset_Serial_Number, NEW.Asset_Tag_ID)),
    NOW()
  );
  
  SET @last_log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@last_log_id, 'Asset_Serial_Number', '', IFNULL(NEW.Asset_Serial_Number, '')),
    (@last_log_id, 'Asset_Tag_ID', '', IFNULL(NEW.Asset_Tag_ID, '')),
    (@last_log_id, 'Item_Name', '', IFNULL(NEW.Item_Name, '')),
    (@last_log_id, 'Status', '', IFNULL(NEW.Status, ''));
END$$

CREATE TRIGGER trg_asset_update
AFTER UPDATE ON ASSET
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'ASSET',
    NEW.Asset_ID,
    'UPDATE',
    CONCAT('Updated asset: ', IFNULL(NEW.Asset_Serial_Number, NEW.Asset_Tag_ID)),
    NOW()
  );
  
  SET @last_log_id = LAST_INSERT_ID();
  
  IF IFNULL(OLD.Asset_Serial_Number, '') != IFNULL(NEW.Asset_Serial_Number, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Asset_Serial_Number', IFNULL(OLD.Asset_Serial_Number, ''), IFNULL(NEW.Asset_Serial_Number, ''));
  END IF;
  
  IF IFNULL(OLD.Asset_Tag_ID, '') != IFNULL(NEW.Asset_Tag_ID, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Asset_Tag_ID', IFNULL(OLD.Asset_Tag_ID, ''), IFNULL(NEW.Asset_Tag_ID, ''));
  END IF;
  
  IF IFNULL(OLD.Status, '') != IFNULL(NEW.Status, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Status', IFNULL(OLD.Status, ''), IFNULL(NEW.Status, ''));
  END IF;
  
  IF IFNULL(OLD.Item_Name, '') != IFNULL(NEW.Item_Name, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Item_Name', IFNULL(OLD.Item_Name, ''), IFNULL(NEW.Item_Name, ''));
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
    CONCAT('Deleted asset: ', IFNULL(OLD.Asset_Serial_Number, OLD.Asset_Tag_ID)),
    NOW()
  );
END$$

-- ====================
-- PM (PREVENTIVE MAINTENANCE) TRIGGERS
-- ====================

CREATE TRIGGER trg_pm_insert
AFTER INSERT ON PM
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'PM',
    NEW.PM_ID,
    'INSERT',
    CONCAT('Created PM record for PM_ID: ', NEW.PM_ID),
    NOW()
  );
  
  SET @last_log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@last_log_id, 'PM_Date', '', IFNULL(NEW.PM_Date, '')),
    (@last_log_id, 'PM_Status', '', IFNULL(NEW.PM_Status, '')),
    (@last_log_id, 'Project_ID', '', IFNULL(NEW.Project_ID, ''));
END$$

CREATE TRIGGER trg_pm_delete
BEFORE DELETE ON PM
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'PM',
    OLD.PM_ID,
    'DELETE',
    CONCAT('Deleted PM record: PM_ID ', OLD.PM_ID),
    NOW()
  );
END$$

-- ====================
-- SOLUTION PRINCIPAL TRIGGERS
-- ====================

CREATE TRIGGER trg_solution_principal_insert
AFTER INSERT ON SOLUTION_PRINCIPAL
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'SOLUTION_PRINCIPAL',
    NEW.SolPrinc_ID,
    'INSERT',
    CONCAT('Created solution principal: ', NEW.SolPrinc_Name),
    NOW()
  );
  
  SET @last_log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@last_log_id, 'SolPrinc_Name', '', NEW.SolPrinc_Name),
    (@last_log_id, 'SolPrinc_Address', '', IFNULL(NEW.SolPrinc_Address, '')),
    (@last_log_id, 'SolPrinc_Email', '', IFNULL(NEW.SolPrinc_Email, '')),
    (@last_log_id, 'SolPrinc_PhoneNumber', '', IFNULL(NEW.SolPrinc_PhoneNumber, ''));
END$$

CREATE TRIGGER trg_solution_principal_delete
BEFORE DELETE ON SOLUTION_PRINCIPAL
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, 1),
    'SOLUTION_PRINCIPAL',
    OLD.SolPrinc_ID,
    'DELETE',
    CONCAT('Deleted solution principal: ', OLD.SolPrinc_Name),
    NOW()
  );
END$$

-- ====================
-- USER TRIGGERS
-- ====================

CREATE TRIGGER trg_user_insert
AFTER INSERT ON USER
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, NEW.User_ID),
    'USER',
    NEW.User_ID,
    'INSERT',
    CONCAT('Created user: ', NEW.Username),
    NOW()
  );
  
  SET @last_log_id = LAST_INSERT_ID();
  
  INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value) VALUES
    (@last_log_id, 'Username', '', NEW.Username),
    (@last_log_id, 'Email', '', NEW.Email),
    (@last_log_id, 'Role', '', NEW.Role);
END$$

CREATE TRIGGER trg_user_update
AFTER UPDATE ON USER
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, NEW.User_ID),
    'USER',
    NEW.User_ID,
    'UPDATE',
    CONCAT('Updated user: ', NEW.Username),
    NOW()
  );
  
  SET @last_log_id = LAST_INSERT_ID();
  
  IF OLD.Username != NEW.Username THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Username', OLD.Username, NEW.Username);
  END IF;
  
  IF OLD.Email != NEW.Email THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Email', OLD.Email, NEW.Email);
  END IF;
  
  IF OLD.Role != NEW.Role THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Role', OLD.Role, NEW.Role);
  END IF;
  
  IF IFNULL(OLD.First_Name, '') != IFNULL(NEW.First_Name, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'First_Name', IFNULL(OLD.First_Name, ''), IFNULL(NEW.First_Name, ''));
  END IF;
  
  IF IFNULL(OLD.Last_Name, '') != IFNULL(NEW.Last_Name, '') THEN
    INSERT INTO HISTORY_LOG_CHANGES (Log_ID, Field_Name, Old_Value, New_Value)
    VALUES (@last_log_id, 'Last_Name', IFNULL(OLD.Last_Name, ''), IFNULL(NEW.Last_Name, ''));
  END IF;
END$$

CREATE TRIGGER trg_user_delete
BEFORE DELETE ON USER
FOR EACH ROW
BEGIN
  INSERT INTO HISTORY_LOG (User_ID, Table_Name, Record_ID, Action_Type, Action_Desc, Timestamp)
  VALUES (
    COALESCE(@current_user_id, OLD.User_ID),
    'USER',
    OLD.User_ID,
    'DELETE',
    CONCAT('Deleted user: ', OLD.Username),
    NOW()
  );
END$$

DELIMITER ;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_history_log_user_id ON HISTORY_LOG(User_ID);
CREATE INDEX IF NOT EXISTS idx_history_log_table_record ON HISTORY_LOG(Table_Name, Record_ID);
CREATE INDEX IF NOT EXISTS idx_history_log_timestamp ON HISTORY_LOG(Timestamp);
CREATE INDEX IF NOT EXISTS idx_history_log_changes_log_id ON HISTORY_LOG_CHANGES(Log_ID);

SELECT 'Audit triggers created successfully!' as Status;
