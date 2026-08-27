const mysql = require('mysql2/promise');
require('dotenv').config();

const dbHost = process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || 'mysql-database-principale';
const dbUser = process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || 'vak6bcXxttUiA5yFaeD65LEAs6AKkt2vQv6kOm4AqG9njm7Ae0LINb82TJnX98vK';
const dbPort = parseInt(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306', 10);
const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'school_db';

let pool;

async function connectDB() {
  if (pool) return pool;

  console.log(`📡 [DB] Connexion vers ${dbHost}:${dbPort} base: ${dbName} (user: ${dbUser})`);

  // 1. Essai direct avec la configuration principale
  try {
    const directPool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      port: dbPort,
      database: dbName,
      connectTimeout: 4000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    await directPool.query('SELECT 1');
    console.log(`✅ [DB] Connecté avec succès à MySQL (${dbHost} / ${dbName}) !`);
    pool = directPool;
    return pool;
  } catch (err1) {
    console.warn(`⚠️ [DB] Échec direct (${dbHost}): ${err1.message}. Test des hôtes de secours...`);
  }

  // 2. Essais rapides des hôtes alternatifs en cas de nom d'hôte Coolify personnalisé
  const fallbackHosts = [
    'mysql-database-principale',
    'mysql',
    'localhost',
    '127.0.0.1',
    '172.17.0.1'
  ].filter(h => h !== dbHost);

  for (const h of fallbackHosts) {
    try {
      const fallbackPool = mysql.createPool({
        host: h,
        user: dbUser,
        password: dbPassword,
        port: dbPort,
        database: dbName,
        connectTimeout: 1500,
        enableKeepAlive: true,
        connectionLimit: 5
      });
      await fallbackPool.query('SELECT 1');
      console.log(`✅ [DB] Connecté avec succès via l'hôte de secours : ${h}`);
      pool = fallbackPool;
      return pool;
    } catch (e) {}
  }

  throw new Error(`Impossible de joindre la base MySQL sur ${dbHost}:${dbPort} (Base: ${dbName}, User: ${dbUser}). Vérifiez les variables d'environnement dans Coolify.`);
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
