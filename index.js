const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuration de la DB
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'schoolservice_db',
  port: process.env.DB_PORT || 3308
};

let pool;
try {
  pool = mysql.createPool(dbConfig);
  console.log('✅ Pool de connexion MySQL créé (SCHOOLSERVICE PRO)');
} catch (e) {
  console.error('❌ Erreur de connexion DB:', e);
}

// ENDPOINT UNIQUE POUR LES REQUETES (Identique à Electron)
app.post('/api/query', async (req, res) => {
  const { query, params } = req.body;
  
  if (!query) return res.status(400).json({ success: false, error: 'Pas de requête' });

  try {
    const [rows] = await pool.execute(query, params || []);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erreur SQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur SCHOOLSERVICE PRO en ligne sur le port ${PORT}`);
});
