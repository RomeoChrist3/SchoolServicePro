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

// Health Check route for Railway
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Serve frontend static files
let distPath = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distPath)) {
  distPath = path.resolve(__dirname, '../dist');
}
if (!fs.existsSync(distPath)) {
  distPath = path.resolve(__dirname, 'dist');
}

console.log("📂 [Server] Tentative de service statique depuis :", distPath);
if (fs.existsSync(distPath)) {
  console.log("✅ Dossier dist trouvé.");
  app.use(express.static(distPath));
} else {
  console.error("❌ ERREUR CRITIQUE : Dossier dist introuvable à l'emplacement :", distPath);
}

// ENDPOINT UNIQUE POUR LES REQUETES (Identique à Electron)
app.post('/api/query', async (req, res) => {
  const { query, params } = req.body;
  
  if (!query) return res.status(400).json({ success: false, error: 'Pas de requête' });

  try {
    const rows = await executeQuery(query, params || []);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur SQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// SPA catch-all routing
app.get('*', (req, res) => {
  const index = path.join(distPath, 'index.html');
  if (fs.existsSync(index)) {
    res.sendFile(index);
  } else {
    res.status(404).send(`<h1>Interface absente</h1><p>Le dossier <code>dist</code> est introuvable sur le serveur.</p><p>Chemin exploré : ${distPath}</p>`);
  }
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Serveur SCHOOLSERVICE PRO en ligne sur le port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Impossible de démarrer le serveur :", err.message);
    // On réessaie après 5 secondes si la base n'est pas prête
    setTimeout(startServer, 5000);
  }
}

startServer();
