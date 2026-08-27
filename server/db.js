const mysql = require('mysql2/promise');
require('dotenv').config();

let currentConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || '172.17.0.1',
  user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || 'vak6bcXxttUiA5yFaeD65LEAs6AKkt2vQv6kOm4AqG9njm7Ae0LINb82TJnX98vK',
  port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306', 10),
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'school_db'
};

let pool;

async function tryConnectHost(cfg) {
  const host = cfg.host;
  const user = cfg.user;
  const password = cfg.password;
  const port = parseInt(cfg.port, 10) || 3306;
  const database = cfg.database || 'school_db';

  console.log(`📡 [DB] Test connexion vers ${host}:${port} base: ${database} (user: ${user})`);
  const conn = await mysql.createConnection({
    host,
    user,
    password,
    port,
    connectTimeout: 4000
  });

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  } catch (e) {}
  await conn.end();

  const newPool = mysql.createPool({
    host,
    user,
    password,
    port,
    database,
    connectTimeout: 5000,
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

  // 1. Essai avec la configuration courante
  try {
    pool = await tryConnectHost(currentConfig);
    console.log(`✅ [DB] Connecté avec succès via ${currentConfig.host} (Base: ${currentConfig.database})`);
    return pool;
  } catch (err1) {
    console.warn(`⚠️ [DB] Échec direct (${currentConfig.host}): ${err1.message}`);
  }

  // 2. Essais automatiques des hôtes de secours
  const fallbackHosts = [
    '172.17.0.1',
    '172.18.0.1',
    'mysql-database-principale',
    'mysql',
    'host.docker.internal',
    '51.255.42.223',
    'localhost',
    '127.0.0.1'
  ].filter(h => h !== currentConfig.host);

  for (const h of fallbackHosts) {
    try {
      const fallbackCfg = { ...currentConfig, host: h };
      const fallbackPool = await tryConnectHost(fallbackCfg);
      console.log(`✅ [DB] Connecté avec succès via l'hôte de secours : ${h}`);
      currentConfig.host = h;
      pool = fallbackPool;
      return pool;
    } catch (e) {}
  }

  throw new Error(`Impossible de joindre MySQL sur ${currentConfig.host}:${currentConfig.port} (User: ${currentConfig.user}, Base: ${currentConfig.database})`);
}

async function reconfigureDB(newConfig) {
  const cfg = {
    host: newConfig.host || currentConfig.host,
    port: parseInt(newConfig.port, 10) || currentConfig.port,
    user: newConfig.user || currentConfig.user,
    password: newConfig.password !== undefined ? newConfig.password : currentConfig.password,
    database: newConfig.database || currentConfig.database
  };

  const testPool = await tryConnectHost(cfg);
  if (pool) {
    try { await pool.end(); } catch (e) {}
  }
  pool = testPool;
  currentConfig = cfg;
  console.log(`✅ [DB] Reconfiguration réussie vers ${cfg.host}:${cfg.port} (Base: ${cfg.database})`);
  return { host: cfg.host, port: cfg.port, user: cfg.user, database: cfg.database };
}

async function executeQuery(query, params = []) {
  if (!pool) {
    await connectDB();
  }
  const [rows] = await pool.execute(query, params);
  return rows;
}

function getDbConfig() {
  return {
    host: currentConfig.host,
    port: currentConfig.port,
    user: currentConfig.user,
    database: currentConfig.database
  };
}

module.exports = {
  connectDB,
  reconfigureDB,
  getDbConfig,
  getPool: () => pool,
  executeQuery,
  get dbName() { return currentConfig.database; }
};
