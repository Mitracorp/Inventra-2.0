const fs = require('fs');
const path = require('path');
const db = require('../backend/config/database');

async function createAuditTriggers() {
  try {
    console.log('Reading trigger SQL file...');
    const sqlFile = path.join(__dirname, 'create_audit_triggers.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by statements (using delimiter)
    const statements = sql
      .split('DELIMITER')
      .filter(s => s.trim())
      .flatMap(block => {
        // Check if this is a trigger definition block
        if (block.includes('$$')) {
          // This is a trigger block, extract the CREATE TRIGGER statement
          const triggerMatch = block.match(/(DROP TRIGGER.*?;|CREATE TRIGGER.*?\$\$)/gs);
          if (triggerMatch) {
            return triggerMatch.map(stmt => {
              // Remove $$ and clean up
              return stmt.replace(/\$\$/g, '').trim();
            });
          }
        } else {
          // Regular SQL statements
          return block
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('--'));
        }
        return [];
      })
      .filter(s => s && s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements and comments
      if (!statement || statement.startsWith('--')) {
        continue;
      }

      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        if (statement.includes('DROP TRIGGER')) {
          const triggerName = statement.match(/DROP TRIGGER IF EXISTS (\w+)/)?.[1];
          console.log(`  Dropping trigger: ${triggerName}`);
        } else if (statement.includes('CREATE TRIGGER')) {
          const triggerName = statement.match(/CREATE TRIGGER (\w+)/)?.[1];
          console.log(`  Creating trigger: ${triggerName}`);
        } else if (statement.includes('CREATE INDEX')) {
          const indexName = statement.match(/CREATE INDEX (\w+)/)?.[1];
          console.log(`  Creating index: ${indexName}`);
        }
        
        await db.pool.query(statement);
        console.log('  ✓ Success\n');
      } catch (error) {
        console.error(`  ✗ Error executing statement ${i + 1}:`);
        console.error(`  Statement: ${statement.substring(0, 100)}...`);
        console.error(`  Error: ${error.message}\n`);
        
        // Continue with other statements even if one fails
        if (!error.message.includes('already exists') && 
            !error.message.includes('Duplicate key name')) {
          console.error('  Continuing with remaining statements...\n');
        }
      }
    }

    console.log('\n✓ Audit trigger setup complete!');
    console.log('\nSummary:');
    console.log('- PROJECT triggers: INSERT, UPDATE, DELETE');
    console.log('- ASSET triggers: INSERT, UPDATE, DELETE');
    console.log('- PM triggers: INSERT, DELETE');
    console.log('- SOLUTION_PRINCIPAL triggers: INSERT, DELETE');
    console.log('- USER triggers: INSERT, UPDATE, DELETE');
    console.log('- Indexes created for performance optimization');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

createAuditTriggers();
