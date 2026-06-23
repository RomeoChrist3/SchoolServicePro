const mysql = require('mysql2/promise');
require('dotenv').config();

const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE || 'schoolservice_db';
const dbConfig = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || 'root',
    port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3308'),
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
        console.log(`📡 [DB] Vérification de l'existence de la base : ${dbName}`);
        const tempConn = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            port: dbConfig.port
        });
        await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await tempConn.end();
        console.log(`✅ [DB] Base de données \`${dbName}\` prête.`);

        pool = mysql.createPool({ ...dbConfig, database: dbName });
        await pool.query('SELECT 1');
        console.log("✅ [DB] Pool de connexions établi (SCHOOLSERVICE PRO).");
        return pool;
    } catch (e) {
        console.error("❌ [DB] ERREUR CRITIQUE CONNEXION :", e.message);
        throw e;
    }
}

async function executeQuery(query, params = []) {
    if (!pool) throw new Error("Base de données non connectée.");
    const [rows] = await pool.execute(query, params);
    return rows;
}

module.exports = {
    connectDB,
    getPool: () => pool,
    executeQuery,
    dbName
};
