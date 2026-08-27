const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { connectDB, executeQuery } = require('./db');
const { initDatabase } = require('./init_db');

const app = express();
app.use(cors());
app.use(express.json());

// Route Health check pour Coolify / Railway
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

console.log("📂 [Server] Service statique depuis :", distPath);
if (fs.existsSync(distPath)) {
  console.log("✅ Dossier dist trouvé.");
  app.use(express.static(distPath));
} else {
  console.warn("⚠️ Dossier dist non trouvé à :", distPath);
}

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
    res.status(200).send(`<h1>SCHOOLSERVICE PRO</h1><p>Serveur en ligne. Fichiers statiques en cours de synchronisation.</p>`);
  }
});

const PORT = parseInt(process.env.PORT || '3000', 10);

// Démarrage immédiat de l'écoute sur 0.0.0.0 pour satisfaire le healthcheck Coolify
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur SCHOOLSERVICE PRO en ligne sur http://0.0.0.0:${PORT}`);
});

// Connexion et migration DB asynchrone en arrière-plan sans bloquer le serveur
async function initDbAsync() {
  try {
    await connectDB();
    await initDatabase();
    console.log('✅ Base de données initialisée et prête.');
  } catch (e) {
    console.warn('⚠️ Connexion DB en attente (nouvel essai dans 5 secondes) :', e.message);
    setTimeout(initDbAsync, 5000);
  }
}

initDbAsync();

// Gestion des erreurs globales pour éviter tout crash du conteneur
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
