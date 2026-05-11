const mysql = require('mysql2/promise');
const fs = require('fs');

const pool = mysql.createPool({
  host: 'ivms2006.com',
  port: 3306,
  user: 'ivmscom_intern',
  password: 'N7cJ[0q6DkVE',
  database: 'ivmscom_Inventra2',
  multipleStatements: true
});

async function applyTrigger() {
  try {
    console.log('📝 Reading updated trigger SQL...');
    
    // Drop and recreate the asset update trigger
    const dropSql = 'DROP TRIGGER IF EXISTS trg_asset_update';
    
    const createSql = `
CREATE TRIGGER trg_asset_update
AFTER UPDATE ON ASSET
FOR EACH ROW
BEGIN
  DECLARE change_desc TEXT;
  
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
END
`;

    console.log('🗑️  Dropping old trigger...');
    await pool.query(dropSql);
    console.log('✅ Old trigger dropped');
    
    console.log('🔧 Creating updated trigger...');
    await pool.query(createSql);
    console.log('✅ Asset update trigger created successfully');
    console.log('');
    console.log('📊 Trigger now tracks these fields:');
    console.log('   - Asset_Serial_Number');
    console.log('   - Asset_Tag_ID');
    console.log('   - Item_Name');
    console.log('   - Status');
    console.log('   - Is_Flagged (Yes/No)');
    console.log('   - Flag_Remarks');
    console.log('   - Flag_Date');
    console.log('   - Flagged_By');
    console.log('   - Windows');
    console.log('   - Microsoft_Office');
    console.log('   - Monthly_Prices');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

applyTrigger();
