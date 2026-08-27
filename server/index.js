const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { connectDB, executeQuery, reconfigureDB, getDbConfig } = require('./db');
const { initDatabase } = require('./init_db');

const app = express();
app.use(cors());
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Détermination du dossier statique dist
let distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  distPath = path.join(process.cwd(), 'dist');
}
if (!fs.existsSync(distPath)) {
  distPath = path.resolve(__dirname, '../dist');
}

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Endpoint pour récupérer la config DB actuelle
app.get('/api/db-config', (req, res) => {
  try {
    const config = getDbConfig ? getDbConfig() : {};
    res.json({ success: true, data: config });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Endpoint pour reconfigurer et tester la base de données en direct depuis l'interface
app.post('/api/db-config', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  try {
    if (reconfigureDB) {
      const result = await reconfigureDB({ host, port, user, password, database });
      await initDatabase();
      res.json({ success: true, message: 'Base de données connectée et initialisée avec succès !', data: result });
    } else {
      res.status(500).json({ success: false, error: 'Reconfiguration non disponible' });
    }
  } catch (err) {
    console.error('Erreur reconfiguration DB:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Endpoint unique pour les requêtes SQL (compatible Electron et Web Bridge)
app.post('/api/query', async (req, res) => {
  const { query, params } = req.body;
  if (!query) return res.status(400).json({ success: false, error: 'Requête manquante' });

  try {
    const rows = await executeQuery(query, params || []);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur SQL:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  const indexFile = path.join(distPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(200).send(`<h1>SCHOOLSERVICE PRO</h1><p>Serveur en ligne.</p>`);
  }
});

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur SCHOOLSERVICE PRO en ligne sur http://0.0.0.0:${PORT}`);
});

async function initDbAsync() {
  try {
    await connectDB();
    await initDatabase();
    console.log('✅ Base de données initialisée et prête.');
  } catch (e) {
    console.warn('⚠️ Connexion DB initiale en attente :', e.message);
  }
}

initDbAsync();

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
