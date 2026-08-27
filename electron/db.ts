import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'db_config_school.json');

const getDefaultConfig = () => ({
    driver: 'mysql',
    host: 'localhost',
    port: 3308,
    user: 'root',
    password: 'root',
    database: 'schoolservice_db'
});

export function getDbConfig() {
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            // On force le driver à mysql même si un ancien fichier contient 'sqlite'
            return { ...getDefaultConfig(), ...config, driver: 'mysql' };
        } catch (e) {
            return getDefaultConfig();
        }
    }
    return getDefaultConfig();
}

export function saveDbConfig(newConfig: any) {
    // On s'assure que le driver enregistré est toujours mysql
    const filteredConfig = { ...newConfig, driver: 'mysql' };
    fs.writeFileSync(configPath, JSON.stringify(filteredConfig, null, 2));
}

export async function executeQuery(query: string, params: any[] = []) {
    const config = getDbConfig();
    
    let connection;
    try {
        const connectionConfig = {
            host: config.host,
            port: Number(config.port),
            user: config.user,
            password: config.password,
            charset: 'utf8mb4'
        };

        try {
            // Tentative de connexion directe à la base
            connection = await mysql.createConnection({ ...connectionConfig, database: config.database });
        } catch (dbErr: any) {
            // Si la base n'existe pas, on la crée
            connection = await mysql.createConnection(connectionConfig);
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
            await connection.query(`USE \`${config.database}\``);
        }

        const [rows] = await connection.query(query, params);
        
        // Forcer le COMMIT pour les modifications
        const upperQuery = query.trim().toUpperCase();
        if (upperQuery.startsWith('INSERT') || upperQuery.startsWith('UPDATE') || upperQuery.startsWith('DELETE') || upperQuery.startsWith('CREATE') || upperQuery.startsWith('DROP')) {
            await connection.query('COMMIT');
        }

        return JSON.parse(JSON.stringify(rows));
    } catch (err: any) {
        console.error(`DATABASE ERROR [${query.substring(0, 50)}...]:`, err.message);
        throw new Error(err.message); 
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}
