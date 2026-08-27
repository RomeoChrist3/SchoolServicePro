const mysql = require('mysql2/promise');
require('dotenv').config();

const configuredDbName = process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE;
const configuredHost = process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST;
const configuredPassword = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD;
const configuredUser = process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER;
const configuredPort = parseInt(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306', 10);

let pool;
let activeDbName = configuredDbName || 'school_db';

const knownPasswords = [
  configuredPassword,
  'vak6bcXxttUiA5yFaeD65LEAs6AKkt2vQv6kOm4AqG9njm7Ae0LINb82TJnX98vK',
  'yMRkrpYwXnK58KiDH5f823Klu4SAEyCUjLOcEqfFsFakMnf5MZFMFn1iZTPBvBtT',
  'pajGLgWOdlkIWOXzTnxEeopuxiSersnn',
  'root',
  ''
].filter(p => p !== undefined && p !== null);

const candidateHosts = [
  configuredHost,
  configuredHost ? configuredHost.toLowerCase() : null,
  'mysql',
  'mysql-database-principale',
  'mariadb',
  'database',
  '81d1370de447',
  '172.17.0.1',
  '172.18.0.1',
  '172.19.0.1',
  '172.20.0.1',
  'host.docker.internal',
  '51.255.42.223',
  'localhost',
  '127.0.0.1'
].filter(Boolean);

const candidateDbs = [
  configuredDbName,
  'school_db',
  'schoolservice_db',
  'railway',
  'default'
].filter(Boolean);

async function tryConnection(host, pwd, db) {
  const conn = await mysql.createConnection({
    host: host,
    user: configuredUser || 'root',
    password: pwd,
    port: configuredPort,
    connectTimeout: 3000
  });

  try {
    const [rows] = await conn.query('SHOW DATABASES');
    const existingDbs = rows.map(r => Object.values(r)[0]);
    
    // Trouver la base existante
    let targetDb = existingDbs.includes(db) ? db : (existingDbs.includes('school_db') ? 'school_db' : (existingDbs.includes('schoolservice_db') ? 'schoolservice_db' : db));
    
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\``);
    await conn.end();

    const newPool = mysql.createPool({
      host: host,
      user: configuredUser || 'root',
      password: pwd,
      port: configuredPort,
      database: targetDb,
      connectTimeout: 5000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    await newPool.query('SELECT 1');
    activeDbName = targetDb;
    return newPool;
  } catch (e) {
    try { await conn.end(); } catch(err) {}
    throw e;
  }
}

async function connectDB() {
  if (pool) return pool;

  const uniqueHosts = Array.from(new Set(candidateHosts));
  const uniquePwds = Array.from(new Set(knownPasswords));
  const uniqueDbs = Array.from(new Set(candidateDbs));

  for (const h of uniqueHosts) {
    for (const pwd of uniquePwds) {
      for (const db of uniqueDbs) {
        try {
          console.log(`📡 [DB] Test connexion : host=${h}, db=${db}`);
          pool = await tryConnection(h, pwd, db);
          console.log(`✅ [DB] SUCCÈS ! Connecté à MySQL sur ${h} (Base: ${activeDbName})`);
          return pool;
        } catch (err) {
          // Continuer le scan
        }
      }
    }
  }

  throw new Error(`Impossible d'établir la connexion MySQL après avoir testé les hôtes (${uniqueHosts.join(', ')})`);
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
  get dbName() { return activeDbName; }
};
