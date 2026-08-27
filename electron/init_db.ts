import { executeQuery } from './db';

export async function initDatabase() {
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
    },
    {
      name: 'absences_professeurs',
      sql: `CREATE TABLE IF NOT EXISTS absences_professeurs (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        id_professeur INTEGER NOT NULL,
        date_absence DATE NOT NULL,
        heures_absentes INTEGER DEFAULT 1,
        justifie TINYINT(1) DEFAULT 0,
        motif TEXT,
        annee_scolaire VARCHAR(50) DEFAULT '2025-2026'
      )`
    },
    {
      name: 'fiches_paie',
      sql: `CREATE TABLE IF NOT EXISTS fiches_paie (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        id_professeur INTEGER NOT NULL,
        mois VARCHAR(50) NOT NULL,
        heures_prevues INTEGER DEFAULT 0,
        heures_absentes_non_justifiees INTEGER DEFAULT 0,
        taux_horaire DECIMAL(15,2) DEFAULT 0,
        primes DECIMAL(15,2) DEFAULT 0,
        avances DECIMAL(15,2) DEFAULT 0,
        cnps DECIMAL(15,2) DEFAULT 0,
        retenues DECIMAL(15,2) DEFAULT 0,
        salaire_net DECIMAL(15,2) DEFAULT 0,
        date_paiement DATE,
        statut VARCHAR(20) DEFAULT 'en_attente',
        annee_scolaire VARCHAR(50) DEFAULT '2025-2026',
        UNIQUE KEY unique_paie (id_professeur, mois, annee_scolaire)
      )`
    },
    {
      name: 'points_caisse',
      sql: `CREATE TABLE IF NOT EXISTS points_caisse (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code_caisse VARCHAR(50) NOT NULL,
        nom_caisse VARCHAR(100) NOT NULL,
        responsable VARCHAR(100) NULL,
        emplacement VARCHAR(100) NULL,
        telephone VARCHAR(50) NULL,
        solde_initial DECIMAL(15,2) DEFAULT 0,
        statut VARCHAR(20) DEFAULT 'ACTIVE',
        is_default TINYINT(1) DEFAULT 0,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_code_caisse (code_caisse)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8`
    },
    {
      name: 'caisse',
      sql: `CREATE TABLE IF NOT EXISTS caisse (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_caisse INT NULL,
        code_caisse VARCHAR(50) NULL,
        type_mouvement VARCHAR(20) NOT NULL,
        montant DECIMAL(15,2) NOT NULL,
        motif TEXT NOT NULL,
        beneficiaire VARCHAR(255) NULL,
        categorie VARCHAR(100) NULL,
        mode_reglement VARCHAR(50) DEFAULT 'Espèces',
        reference_piece VARCHAR(100) NULL,
        annee_scolaire VARCHAR(50) NULL,
        id_paiement INT NULL,
        date_operation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        id_utilisateur INT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8`
    },
    {
      name: 'caisse_categories',
      sql: `CREATE TABLE IF NOT EXISTS caisse_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8`
    }
  ];

  for (const table of tables) {
    try {
      await executeQuery(table.sql);
      console.log(`Table '${table.name}' vérifiée/créée.`);
    } catch (err: any) {
      console.error(`Erreur sur la table '${table.name}':`, err.message);
    }
  }

  // MIGRATIONS : Ajout des colonnes manquantes
  try {
    const tableInfoEtudiants: any = await executeQuery('DESCRIBE etudiants');
    if (tableInfoEtudiants) {
        if (!tableInfoEtudiants.some((col: any) => col.Field === 'sexe')) {
            await executeQuery('ALTER TABLE etudiants ADD COLUMN sexe VARCHAR(10) AFTER prenom');
            console.log("Migration: Colonne 'sexe' ajoutée à la table etudiants.");
        }
        if (!tableInfoEtudiants.some((col: any) => col.Field === 'matricule')) {
            await executeQuery('ALTER TABLE etudiants ADD COLUMN matricule VARCHAR(50) AFTER id');
            await executeQuery('UPDATE etudiants SET matricule = CONCAT("MAT-", LPAD(id, 4, "0")) WHERE matricule IS NULL');
            console.log("Migration: Colonne 'matricule' ajoutée à la table etudiants.");
        }
    }

    const tableInfoProfesseurs: any = await executeQuery('DESCRIBE professeurs');
    if (tableInfoProfesseurs) {
        if (!tableInfoProfesseurs.some((col: any) => col.Field === 'sexe')) {
            await executeQuery('ALTER TABLE professeurs ADD COLUMN sexe VARCHAR(10) AFTER prenom');
            console.log("Migration: Colonne 'sexe' ajoutée à la table professeurs.");
        }
        if (!tableInfoProfesseurs.some((col: any) => col.Field === 'taux_horaire')) {
            await executeQuery('ALTER TABLE professeurs ADD COLUMN taux_horaire DECIMAL(15,2) DEFAULT 0 AFTER email');
            console.log("Migration: Colonne 'taux_horaire' ajoutée à la table professeurs.");
        }
        if (!tableInfoProfesseurs.some((col: any) => col.Field === 'heures_mensuelles_prevues')) {
            await executeQuery('ALTER TABLE professeurs ADD COLUMN heures_mensuelles_prevues INTEGER DEFAULT 0 AFTER taux_horaire');
            console.log("Migration: Colonne 'heures_mensuelles_prevues' ajoutée à la table professeurs.");
        }
    }

    // MIGRATION SETTINGS (Notifications)
    const tableInfoSettings: any = await executeQuery('DESCRIBE settings');
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
            if (!tableInfoSettings.some((c: any) => c.Field === col.name)) {
                await executeQuery(`ALTER TABLE settings ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Migration: Colonne '${col.name}' ajoutée à la table settings.`);
            }
        }
    }

    const tableInfoNotes: any = await executeQuery('DESCRIBE notes');
    if (tableInfoNotes && !tableInfoNotes.some((col: any) => col.Field === 'annee_scolaire')) {
        await executeQuery("ALTER TABLE notes ADD COLUMN annee_scolaire VARCHAR(50) DEFAULT '2025-2026' AFTER periode");
        console.log("Migration: Colonne 'annee_scolaire' ajoutée à la table notes.");
    }

    const tableInfoAbsences: any = await executeQuery('DESCRIBE absences');
    if (tableInfoAbsences && !tableInfoAbsences.some((col: any) => col.Field === 'annee_scolaire')) {
        await executeQuery("ALTER TABLE absences ADD COLUMN annee_scolaire VARCHAR(50) DEFAULT '2025-2026' AFTER periode");
        console.log("Migration: Colonne 'annee_scolaire' ajoutée à la table absences.");
    }

    const tableInfoPaiements: any = await executeQuery('DESCRIBE paiements');
    if (tableInfoPaiements && !tableInfoPaiements.some((col: any) => col.Field === 'annee_scolaire')) {
        await executeQuery("ALTER TABLE paiements ADD COLUMN annee_scolaire VARCHAR(50) DEFAULT '2025-2026' AFTER motif");
        console.log("Migration: Colonne 'annee_scolaire' ajoutée à la table paiements.");
    }

    const tableInfoMoratoires: any = await executeQuery('DESCRIBE moratoires');
    if (tableInfoMoratoires && !tableInfoMoratoires.some((col: any) => col.Field === 'annee_scolaire')) {
        await executeQuery("ALTER TABLE moratoires ADD COLUMN annee_scolaire VARCHAR(50) DEFAULT '2025-2026' AFTER statut");
        console.log("Migration: Colonne 'annee_scolaire' ajoutée à la table moratoires.");
    }

    const tableInfoPointsCaisse: any = await executeQuery('DESCRIBE points_caisse');
    if (tableInfoPointsCaisse && !tableInfoPointsCaisse.some((col: any) => col.Field === 'is_default')) {
        await executeQuery("ALTER TABLE points_caisse ADD COLUMN is_default TINYINT(1) DEFAULT 0 AFTER statut");
        console.log("Migration: Colonne 'is_default' ajoutée à la table points_caisse.");
    }

    const tableInfoCaisse: any = await executeQuery('DESCRIBE caisse');
    if (tableInfoCaisse) {
        if (!tableInfoCaisse.some((col: any) => col.Field === 'id_caisse')) {
            await executeQuery("ALTER TABLE caisse ADD COLUMN id_caisse INT NULL AFTER id");
        }
        if (!tableInfoCaisse.some((col: any) => col.Field === 'code_caisse')) {
            await executeQuery("ALTER TABLE caisse ADD COLUMN code_caisse VARCHAR(50) NULL AFTER id_caisse");
        }
        if (!tableInfoCaisse.some((col: any) => col.Field === 'id_paiement')) {
            await executeQuery("ALTER TABLE caisse ADD COLUMN id_paiement INT NULL AFTER annee_scolaire");
        }
    }
  } catch (err: any) {
    console.error('Erreur lors des migrations:', err.message);
  }

  try {
    const settings: any = await executeQuery('SELECT * FROM settings LIMIT 1');
    if (!settings || settings.length === 0) {
      await executeQuery('INSERT INTO settings (company_name) VALUES (?)', ['MON ÉTABLISSEMENT']);
    }
  } catch (err: any) {
    console.error('Erreur init settings:', err.message);
  }

  try {
    const defaultPoints: any = await executeQuery('SELECT COUNT(*) as count FROM points_caisse');
    if (defaultPoints && defaultPoints[0]?.count === 0) {
      await executeQuery("INSERT INTO points_caisse (code_caisse, nom_caisse, responsable, emplacement, solde_initial, statut, is_default) VALUES ('CP', 'CAISSE PRINCIPALE', 'Intendant / Économe', 'Bâtiment Administratif', 0, 'ACTIVE', 1)");
      await executeQuery("INSERT INTO points_caisse (code_caisse, nom_caisse, responsable, emplacement, solde_initial, statut, is_default) VALUES ('CAISSE-SCOL', 'Caisse Scolarité & Inscriptions', 'Secrétariat', 'Guichet 1', 0, 'ACTIVE', 0)");
      await executeQuery("INSERT INTO points_caisse (code_caisse, nom_caisse, responsable, emplacement, solde_initial, statut, is_default) VALUES ('CAISSE-CANT', 'Caisse Cantine & Activités', 'Gestionnaire', 'Réfectoire', 0, 'ACTIVE', 0)");
    }
  } catch (err: any) {
    console.error('Erreur init points_caisse:', err.message);
  }

  console.log('--- Base de données initialisée avec succès ---');
}
