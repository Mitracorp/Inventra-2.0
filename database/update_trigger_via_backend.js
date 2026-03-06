const db = require('../backend/config/database');

async function updateAssetTrigger() {
  const connection = await db.pool.getConnection();
  
  try {
    console.log('🗑️  Dropping old trigger...');
    await connection.query('DROP TRIGGER IF EXISTS trg_asset_update');
    console.log('✅ Old trigger dropped');
    
    console.log('🔧 Creating updated trigger...');
    const createTriggerSQL = `
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
      @current_user_id,
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
END
`;

    await connection.query(createTriggerSQL);
    console.log('✅ Asset update trigger created successfully');
    
    // Verify trigger was created
    const [triggers] = await connection.query("SHOW TRIGGERS WHERE `Trigger` = 'trg_asset_update'");
    console.log('\n📊 Trigger verification:');
    console.table(triggers);
    
    console.log('\n✅ SUCCESS! Trigger now tracks these fields:');
    console.log('   ✓ Asset_Serial_Number');
    console.log('   ✓ Asset_Tag_ID');
    console.log('   ✓ Item_Name');
    console.log('   ✓ Status');
    console.log('   ✓ Is_Flagged (Yes/No)');
    console.log('   ✓ Flag_Remarks');
    console.log('   ✓ Flag_Date');
    console.log('   ✓ Flagged_By');
    console.log('   ✓ Windows');
    console.log('   ✓ Microsoft_Office');
    console.log('   ✓ Monthly_Prices');
    
  } catch (error) {
    console.error('❌ Error updating trigger:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the update
updateAssetTrigger()
  .then(() => {
    console.log('\n🎉 Trigger update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to update trigger:', error);
    process.exit(1);
  });
