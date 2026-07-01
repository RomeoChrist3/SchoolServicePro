const { executeQuery } = require('./db');

async function initDatabase() {
  console.log('--- Initialisation de la base de données (SCHOOLSERVICE PRO) ---');

  const tables = [
    {
      name: 'users',
      sql: `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        full_name VARCHAR(100),
        last_login DATETIME
      )`
    },
    {
      name: 'classes',
      sql: `CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        nom VARCHAR(100) NOT NULL,
        niveau VARCHAR(50),
        frais_inscription DECIMAL(15,2) DEFAULT 0,
        frais_scolarite DECIMAL(15,2) DEFAULT 0
      )`
    },
    {
      name: 'etudiants',
      sql: `CREATE TABLE IF NOT EXISTS etudiants (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        matricule VARCHAR(50) UNIQUE,
        nom VARCHAR(100) NOT NULL,
        prenom VARCHAR(100) NOT NULL,
        sexe VARCHAR(10),
        date_naissance DATE,
        adresse TEXT,
        telephone VARCHAR(50),
        email VARCHAR(100),
        id_classe INTEGER,
        date_inscription DATE,
        photo LONGBLOB,
        image_path TEXT,
        statut VARCHAR(20) DEFAULT 'actif'
      )`
    },
    {
      name: 'professeurs',
      sql: `CREATE TABLE IF NOT EXISTS professeurs (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        nom VARCHAR(100) NOT NULL,
        prenom VARCHAR(100) NOT NULL,
        sexe VARCHAR(10),
        specialite VARCHAR(100),
        telephone VARCHAR(50),
        email VARCHAR(100),
        image_path TEXT
      )`
    },
    {
      name: 'matieres',
      sql: `CREATE TABLE IF NOT EXISTS matieres (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        nom VARCHAR(100) NOT NULL,
        coefficient INTEGER DEFAULT 1,
        id_professeur INTEGER,
        id_classe INTEGER
      )`
    },
    {
      name: 'notes',
      sql: `CREATE TABLE IF NOT EXISTS notes (
        id INT NOT NULL AUTO_INCREMENT,
        id_etudiant INT NOT NULL,
        id_matiere INT NOT NULL,
        note DECIMAL(5,2),
        periode VARCHAR(50),
        annee_scolaire VARCHAR(50) DEFAULT '2025-2026',
        date_saisie DATETIME,
        PRIMARY KEY (id)
      )`
    },
    {
      name: 'echeances',
      sql: `CREATE TABLE IF NOT EXISTS echeances (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        id_classe INTEGER NOT NULL,
        libelle VARCHAR(100),
        montant DECIMAL(15,2),
        date_limite DATE
      )`
    },
    {
      name: 'paiements',
      sql: `CREATE TABLE IF NOT EXISTS paiements (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        id_etudiant INTEGER NOT NULL,
        montant DECIMAL(15,2),
        date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        mode_paiement VARCHAR(50),
        numero_recu VARCHAR(50),
        motif VARCHAR(255),
        annee_scolaire VARCHAR(50) DEFAULT '2025-2026'
      )`
    },
    {
      name: 'settings',
      sql: `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        company_name VARCHAR(255) DEFAULT 'MON ÉTABLISSEMENT',
        activity VARCHAR(255) DEFAULT 'Enseignement Général',
        address TEXT,
        phone VARCHAR(100),
        email VARCHAR(100),
        niu VARCHAR(100),
        rccm VARCHAR(100),
        logo_path TEXT,
        entete_facture TEXT,
        invoice_footer VARCHAR(255) DEFAULT 'Excellence Académique',
        primary_color VARCHAR(20) DEFAULT '#198754',
        region VARCHAR(100) DEFAULT 'CENTRE',
        departement VARCHAR(100) DEFAULT 'MFOUNDI',
        arrondissement VARCHAR(100) DEFAULT 'YAOUNDE 1',
        ville VARCHAR(100) DEFAULT 'YAOUNDE',
        quartier VARCHAR(100),
        chef_etablissement VARCHAR(100) DEFAULT 'LE DIRECTEUR',
        smtp_host VARCHAR(255),
        smtp_port INTEGER,
        smtp_user VARCHAR(255),
        smtp_pass VARCHAR(255),
        sms_api_key VARCHAR(255),
        sms_url VARCHAR(255)
      )`
    },
    {
      name: 'setting',
      sql: `CREATE TABLE IF NOT EXISTS setting (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        company_name VARCHAR(255) DEFAULT 'MON ÉTABLISSEMENT',
        activity VARCHAR(255) DEFAULT 'Enseignement Général',
        address TEXT,
        phone VARCHAR(100),
        email VARCHAR(100),
        niu VARCHAR(100),
        rccm VARCHAR(100),
        logo_path TEXT,
        entete_facture TEXT,
        invoice_footer VARCHAR(255) DEFAULT 'Excellence Académique',
        primary_color VARCHAR(20) DEFAULT '#198754',
        region VARCHAR(100) DEFAULT 'CENTRE',
        departement VARCHAR(100) DEFAULT 'MFOUNDI',
        arrondissement VARCHAR(100) DEFAULT 'YAOUNDE 1',
        ville VARCHAR(100) DEFAULT 'YAOUNDE',
        quartier VARCHAR(100),
        chef_etablissement VARCHAR(100) DEFAULT 'LE DIRECTEUR',
        smtp_host VARCHAR(255),
        smtp_port INTEGER,
        smtp_user VARCHAR(255),
        smtp_pass VARCHAR(255),
        sms_api_key VARCHAR(255),
        sms_url VARCHAR(255)
      )`
    },
    {
      name: 'moratoires',
      sql: `CREATE TABLE IF NOT EXISTS moratoires (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        id_etudiant INTEGER NOT NULL,
        montant DECIMAL(15,2),
        date_echeance DATE,
        motif VARCHAR(255),
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        statut VARCHAR(20) DEFAULT 'en_attente',
        annee_scolaire VARCHAR(50) DEFAULT '2025-2026'
      )`
    },
    {
      name: 'absences',
      sql: `CREATE TABLE IF NOT EXISTS absences (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        id_etudiant INTEGER NOT NULL,
        date_absence DATE NOT NULL,
        heures INTEGER DEFAULT 1,
        type_absence VARCHAR(20) DEFAULT 'ABSENCE',
        justifie TINYINT(1) DEFAULT 0,
        motif TEXT,
        periode VARCHAR(50),
        annee_scolaire VARCHAR(50) DEFAULT '2025-2026',
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'sanctions',
      sql: `CREATE TABLE IF NOT EXISTS sanctions (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        id_etudiant INTEGER NOT NULL,
        type_sanction VARCHAR(50) NOT NULL,
        date_sanction DATE NOT NULL,
        date_fin DATE,
        motif TEXT,
        punition TEXT,
        statut VARCHAR(20) DEFAULT 'EN_COURS',
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'clotures',
      sql: `CREATE TABLE IF NOT EXISTS clotures (
        id INT NOT NULL AUTO_INCREMENT,
        annee_scolaire VARCHAR(50) NOT NULL,
        periode VARCHAR(50) NOT NULL,
        is_closed TINYINT(1) DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY unique_cloture (annee_scolaire, periode)
      )`
    }
  ];

  for (const table of tables) {
    try {
      await executeQuery(table.sql);
      console.log(`Table '${table.name}' vérifiée/créée.`);
    } catch (err) {
      console.error(`Erreur sur la table '${table.name}':`, err.message);
    }
  }

  // MIGRATIONS
  try {
    const tableInfoEtudiants = await executeQuery('DESCRIBE etudiants').catch(() => null);
    if (tableInfoEtudiants) {
        const hasSexe = tableInfoEtudiants.some(col => col.Field === 'sexe');
        if (!hasSexe) {
            await executeQuery('ALTER TABLE etudiants ADD COLUMN sexe VARCHAR(10) AFTER prenom');
            console.log("Migration: Colonne 'sexe' ajoutée à la table etudiants.");
        }
        const hasMatricule = tableInfoEtudiants.some(col => col.Field === 'matricule');
        if (!hasMatricule) {
            await executeQuery('ALTER TABLE etudiants ADD COLUMN matricule VARCHAR(50) AFTER id');
            await executeQuery('UPDATE etudiants SET matricule = CONCAT("MAT-", LPAD(id, 4, "0")) WHERE matricule IS NULL');
            console.log("Migration: Colonne 'matricule' ajoutée à la table etudiants.");
        }
    }

    const tableInfoProfesseurs = await executeQuery('DESCRIBE professeurs').catch(() => null);
    if (tableInfoProfesseurs) {
        const hasSexe = tableInfoProfesseurs.some(col => col.Field === 'sexe');
        if (!hasSexe) {
            await executeQuery('ALTER TABLE professeurs ADD COLUMN sexe VARCHAR(10) AFTER prenom');
            console.log("Migration: Colonne 'sexe' ajoutée à la table professeurs.");
        }
    }

    const tableInfoSettings = await executeQuery('DESCRIBE settings').catch(() => null);
    if (tableInfoSettings) {
        const colsToAdd = [
            { name: 'smtp_host', type: 'VARCHAR(255)' },
            { name: 'smtp_port', type: 'INTEGER' },
            { name: 'smtp_user', type: 'VARCHAR(255)' },
            { name: 'smtp_pass', type: 'VARCHAR(255)' },
            { name: 'sms_api_key', type: 'VARCHAR(255)' },
            { name: 'sms_url', type: 'VARCHAR(255)' }
        ];
        for (const col of colsToAdd) {
            if (!tableInfoSettings.some(c => c.Field === col.name)) {
                await executeQuery(`ALTER TABLE settings ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Migration: Colonne '${col.name}' ajoutée à la table settings.`);
            }
        }
    }

    const tableInfoNotes = await executeQuery('DESCRIBE notes').catch(() => null);
    if (tableInfoNotes && !tableInfoNotes.some(col => col.Field === 'annee_scolaire')) {
        await executeQuery("ALTER TABLE notes ADD COLUMN annee_scolaire VARCHAR(50) DEFAULT '2025-2026' AFTER periode");
        console.log("Migration: Colonne 'annee_scolaire' ajoutée à la table notes.");
    }

    const tableInfoAbsences = await executeQuery('DESCRIBE absences').catch(() => null);
    if (tableInfoAbsences && !tableInfoAbsences.some(col => col.Field === 'annee_scolaire')) {
        await executeQuery("ALTER TABLE absences ADD COLUMN annee_scolaire VARCHAR(50) DEFAULT '2025-2026' AFTER periode");
        console.log("Migration: Colonne 'annee_scolaire' ajoutée à la table absences.");
    }

    const tableInfoPaiements = await executeQuery('DESCRIBE paiements').catch(() => null);
    if (tableInfoPaiements && !tableInfoPaiements.some(col => col.Field === 'annee_scolaire')) {
        await executeQuery("ALTER TABLE paiements ADD COLUMN annee_scolaire VARCHAR(50) DEFAULT '2025-2026' AFTER motif");
        console.log("Migration: Colonne 'annee_scolaire' ajoutée à la table paiements.");
    }

    const tableInfoMoratoires = await executeQuery('DESCRIBE moratoires').catch(() => null);
    if (tableInfoMoratoires && !tableInfoMoratoires.some(col => col.Field === 'annee_scolaire')) {
        await executeQuery("ALTER TABLE moratoires ADD COLUMN annee_scolaire VARCHAR(50) DEFAULT '2025-2026' AFTER statut");
        console.log("Migration: Colonne 'annee_scolaire' ajoutée à la table moratoires.");
    }
  } catch (err) {
    console.error('Erreur lors des migrations:', err.message);
  }

  // Données par défaut
  try {
    const settings = await executeQuery('SELECT * FROM settings LIMIT 1');
    if (!settings || settings.length === 0) {
      await executeQuery('INSERT INTO settings (company_name) VALUES (?)', ['MON ÉTABLISSEMENT']);
    }

    const users = await executeQuery('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!users || users.length === 0) {
      await executeQuery(
        'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)',
        ['admin', 'admin123', 'admin', 'Administrateur']
      );
    }
    console.log('Base de données synchronisée avec succès.');
  } catch (err) {
    console.error('Erreur lors de l\'insertion des données par défaut:', err.message);
  }
}

module.exports = { initDatabase };
