const mysql = require('mysql2/promise');
(async () => {
    try {
        const c = await mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'ivmscom_intern',
            password: 'Mitracorp!23Intern',
            database: 'ivmscom_Inventra'
        });
        console.log('localhost ok');
        await c.end();
    } catch (e) {
        console.log('localhost fail', { code: e.code, errno: e.errno, sqlState: e.sqlState, message: e.message });
    }
    
    try {
        const c = await mysql.createConnection({
            host: 'ivms2006.com',
            port: 3306,
            user: 'ivmscom_intern',
            password: 'Mitracorp!23Intern',
            database: 'ivmscom_Inventra',
            connectTimeout: 10000
        });
        console.log('remote ok');
        await c.end();
    } catch (e) {
        console.log('remote fail', { code: e.code, errno: e.errno, sqlState: e.sqlState, message: e.message });
    }
})();
