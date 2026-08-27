const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const os = require('os');

const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'schoolservicepro');
const configPath = path.join(userDataPath, 'db_config_school.json');

let config = {
    driver: 'mysql',
    host: 'localhost',
    port: 3308,
    user: 'root',
    password: 'root',
    database: 'schoolservice_db'
};

if (fs.existsSync(configPath)) {
    try {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        config = { ...config, ...fileConfig };
    } catch (e) {}
}

async function run() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: config.host,
            port: Number(config.port),
            user: config.user,
            password: config.password,
            database: config.database
        });
        console.log("Successfully connected to database:", config.database);

        // Check paiements table columns
        const [paiementsCols] = await connection.query("DESCRIBE paiements");
        const hasPaiementsYear = paiementsCols.some(col => col.Field === 'annee_scolaire');
        if (!hasPaiementsYear) {
            console.log("Column 'annee_scolaire' missing in paiements table. Adding it...");
            await connection.query("ALTER TABLE paiements ADD COLUMN annee_scolaire VARCHAR(50) DEFAULT '2025-2026' AFTER motif");
            console.log("Column 'annee_scolaire' added to paiements table!");
        } else {
            console.log("Column 'annee_scolaire' already exists in paiements table.");
        }

        // Check moratoires table columns
        const [moratoiresCols] = await connection.query("DESCRIBE moratoires");
        const hasMoratoiresYear = moratoiresCols.some(col => col.Field === 'annee_scolaire');
        if (!hasMoratoiresYear) {
            console.log("Column 'annee_scolaire' missing in moratoires table. Adding it...");
            await connection.query("ALTER TABLE moratoires ADD COLUMN annee_scolaire VARCHAR(50) DEFAULT '2025-2026' AFTER statut");
            console.log("Column 'annee_scolaire' added to moratoires table!");
        } else {
            console.log("Column 'annee_scolaire' already exists in moratoires table.");
        }

        console.log("Database migrations successfully executed.");
    } catch (err) {
        console.error("Database connection/query error:", err.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

run();
