const mysql = require('mysql2/promise');
require('dotenv').config();

const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'schoolservice_db';
const dbConfig = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || 'localhost',
    user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || 'root',
    port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306', 10),
    connectTimeout: 20000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

async function connectDB() {
    try {
        console.log(`📡 [DB] Connexion vers ${dbConfig.host}:${dbConfig.port} base: ${dbName}`);
        try {
            const tempConn = await mysql.createConnection({
                host: dbConfig.host,
                user: dbConfig.user,
                password: dbConfig.password,
                port: dbConfig.port
            });
            await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
            await tempConn.end();
        } catch (dbCreateErr) {
            // Ignorer si l'utilisateur n'a pas les droits de création globale
        }

        pool = mysql.createPool({ ...dbConfig, database: dbName });
        await pool.query('SELECT 1');
        console.log("✅ [DB] Pool de connexions MySQL établi avec succès.");
        return pool;
    } catch (e) {
        console.error("❌ [DB] ERREUR CONNEXION :", e.message);
        throw e;
    }
}

async function executeQuery(query, params = []) {
    if (!pool) {
        await connectDB();
    }
    const [rows] = await pool.execute(query, params);
    return rows;
}

module.exports = {
    connectDB,
    getPool: () => pool,
    executeQuery,
    dbName
};
