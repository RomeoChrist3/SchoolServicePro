const mysql = require('mysql2/promise');
require('dotenv').config();

const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'schoolservice_db';
const rawHost = process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || 'localhost';
const password = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || 'root';
const user = process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || 'root';
const port = parseInt(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306', 10);

let pool;

async function tryConnectHost(host) {
    console.log(`📡 [DB] Test connexion vers ${host}:${port} base: ${dbName} (user: ${user})`);
    const conn = await mysql.createConnection({
        host: host,
        user: user,
        password: password,
        port: port,
        connectTimeout: 5000
    });
    try {
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    } catch(e) {}
    await conn.end();

    const newPool = mysql.createPool({
        host: host,
        user: user,
        password: password,
        port: port,
        database: dbName,
        connectTimeout: 10000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    await newPool.query('SELECT 1');
    return newPool;
}

async function connectDB() {
    if (pool) return pool;

    const candidateHosts = [
        rawHost,
        rawHost.toLowerCase(),
        'mysql-database-principale',
        '172.17.0.1',
        'host.docker.internal',
        '51.255.42.223',
        'localhost',
        '127.0.0.1'
    ];

    // Dédupliquer la liste des hôtes
    const uniqueHosts = Array.from(new Set(candidateHosts.filter(Boolean)));

    for (const h of uniqueHosts) {
        try {
            pool = await tryConnectHost(h);
            console.log(`✅ [DB] Connecté avec succès via l'hôte : ${h}`);
            return pool;
        } catch (err) {
            console.warn(`⚠️ [DB] Échec sur l'hôte ${h} : ${err.message}`);
        }
    }

    throw new Error(`Impossible de joindre MySQL sur les hôtes testés (${uniqueHosts.join(', ')})`);
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
