import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import path from 'path';
import url from 'url';
import fs from 'fs';
import { exec } from 'child_process';
import nodemailer from 'nodemailer';
import { executeQuery, getDbConfig, saveDbConfig } from './db';
import { initDatabase } from './init_db';

const isDev = process.env.NODE_ENV === 'development';

// Dossier pour les médias
const mediaDir = path.join(app.getPath('userData'), 'media');
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  const iconPath = isDev 
    ? path.join(process.cwd(), 'APP.png') 
    : path.join(__dirname, '../dist/logo.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'SCHOOLSERVICE PRO',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, '../dist/index.html'),
        protocol: 'file:',
        slashes: true,
    }));
  }
}

// ... rest of file
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

// Protocole personnalisé pour lire les images locales
app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    const filePath = path.join(mediaDir, decodeURIComponent(request.url.replace('media://', '')));
    return net.fetch(url.pathToFileURL(filePath).toString());
  });
});

ipcMain.handle('db:config:get', () => getDbConfig());
ipcMain.handle('db:config:save', (_event, config) => {
  saveDbConfig(config);
  return { success: true };
});

ipcMain.handle('db:query', async (_event, { query, params }) => {
  try {
    const results = await executeQuery(query, params);
    return { success: true, data: results };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// SAUVEGARDE INTELLIGENTE
ipcMain.handle('db:backup', async () => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.getHours().toString().padStart(2, '0') + '-' + 
                  now.getMinutes().toString().padStart(2, '0') + '-' + 
                  now.getSeconds().toString().padStart(2, '0');
  
  const { filePath } = await dialog.showSaveDialog({
    title: 'Enregistrer la sauvegarde SQL',
    defaultPath: `backup_schoolpro_${dateStr}_${timeStr}.sql`,
    filters: [{ name: 'SQL Files', extensions: ['sql'] }]
  });

  if (!filePath) return { success: false, error: 'Annulé' };

  const db = getDbConfig().database || 'schoolservice_db';

  const possiblePaths = [
    'mysqldump',
    '"C:\\wamp64\\bin\\mariadb\\mariadb10.6.5\\bin\\mysqldump.exe"',
    '"C:\\wamp64\\bin\\mysql\\mysql8.0.27\\bin\\mysqldump.exe"',
    '"C:\\wamp\\bin\\mariadb\\mariadb10.5.8\\bin\\mysqldump.exe"',
    '"C:\\Program Files\\MariaDB 10.11\\bin\\mysqldump.exe"',
    '"C:\\Program Files\\MariaDB 11.0\\bin\\mysqldump.exe"',
    '"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe"',
    '"C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysqldump.exe"',
    '"C:\\xampp\\mysql\\bin\\mysqldump.exe"',
    '"C:\\mysql\\bin\\mysqldump.exe"'
  ];

  return new Promise((resolve) => {
    const tryBackup = (i: number) => {
      if (i >= possiblePaths.length) return resolve({ success: false, error: 'Outil mysqldump introuvable.' });
      const cmd = `${possiblePaths[i]} -h localhost -P 3308 -u root -proot --routines --triggers --single-transaction --quick --add-drop-table ${db} > "${filePath}"`;
      exec(cmd, (err) => {
        if (err) tryBackup(i + 1);
        else resolve({ success: true, path: filePath });
      });
    };
    tryBackup(0);
  });
});

// RESTAURATION INTELLIGENTE
ipcMain.handle('db:restore', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Choisir le fichier SQL pour la restauration',
    filters: [{ name: 'SQL Files', extensions: ['sql'] }],
    properties: ['openFile']
  });

  if (!filePaths || filePaths.length === 0) return { success: false, error: 'Annulé' };
  const filePath = filePaths[0];
  const db = getDbConfig().database || 'schoolservice_db';

  const possiblePaths = [
    'mysql',
    '"C:\\wamp64\\bin\\mariadb\\mariadb10.6.5\\bin\\mysql.exe"',
    '"C:\\wamp64\\bin\\mysql\\mysql8.0.27\\bin\\mysql.exe"',
    '"C:\\Program Files\\MariaDB 10.11\\bin\\mysql.exe"',
    '"C:\\xampp\\mysql\\bin\\mysql.exe"'
  ];

  return new Promise((resolve) => {
    const tryRestore = (i: number) => {
      if (i >= possiblePaths.length) return resolve({ success: false, error: 'Outil mysql introuvable.' });
      const cmd = `${possiblePaths[i]} -h localhost -P 3308 -u root -proot --default-character-set=utf8mb4 ${db} < "${filePath}"`;
      exec(cmd, async (err) => {
        if (err) tryRestore(i + 1);
        else {
          try {
            await initDatabase();
            resolve({ success: true });
          } catch (e) { resolve({ success: true }); }
        }
      });
    };
    tryRestore(0);
  });
});

ipcMain.handle('media:save', async (_event, { fileName, base64Data }) => {
  try {
    const filePath = path.join(mediaDir, fileName);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true, fileName };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('media:get-base64', async (_event, fileName) => {
  try {
    let filePath = path.join(mediaDir, fileName);
    
    // Si le fichier n'existe pas dans mediaDir, on tente dans le dossier de l'application (public ou root)
    if (!fs.existsSync(filePath)) {
      const appPath = app.getAppPath();
      // On enlève d'éventuels prefix comme ../public/ ou public/
      const cleanName = fileName.replace(/^(\.\.\/)*public\//, '').replace(/^public\//, '');
      
      const possiblePaths = [
        path.join(appPath, 'public', cleanName),
        path.join(appPath, cleanName),
        path.join(appPath, 'dist', cleanName), // Pour la prod
        path.join(__dirname, '..', 'public', cleanName),
        path.join(__dirname, '..', cleanName)
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          filePath = p;
          break;
        }
      }
    }

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      const ext = path.extname(fileName).toLowerCase().replace('.', '');
      // Correction pour jpg/jpeg
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext;
      return { success: true, base64: `data:image/${mime};base64,${data.toString('base64')}` };
    }
    return { success: false, error: 'Fichier non trouvé : ' + fileName };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notification:test-smtp', async (_event, config) => {
  try {
    // FAILSAFE: Vérification de l'existence des colonnes avant toute opération
    try {
        const cols: any = await executeQuery('SHOW COLUMNS FROM settings');
        if (cols && !cols.some((c: any) => c.Field === 'smtp_host')) {
            await executeQuery('ALTER TABLE settings ADD COLUMN smtp_host VARCHAR(255), ADD COLUMN smtp_port INTEGER, ADD COLUMN smtp_user VARCHAR(255), ADD COLUMN smtp_pass VARCHAR(255), ADD COLUMN sms_api_key VARCHAR(255), ADD COLUMN sms_url VARCHAR(255)');
        }
    } catch (e) {}

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: Number(config.smtp_port) || 587,
      secure: Number(config.smtp_port) === 465,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass
      },
      connectTimeout: 10000 // 10 secondes de timeout
    });

    await transporter.verify();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('media:get-base-url', () => 'media://');

ipcMain.handle('notification:send', async (_event, { type, to, subject, message }) => {
  try {
    // FAILSAFE: Vérification de l'existence des colonnes avant la requête
    try {
        const cols: any = await executeQuery('SHOW COLUMNS FROM settings');
        if (cols && !cols.some((c: any) => c.Field === 'smtp_host')) {
            await executeQuery('ALTER TABLE settings ADD COLUMN smtp_host VARCHAR(255), ADD COLUMN smtp_port INTEGER, ADD COLUMN smtp_user VARCHAR(255), ADD COLUMN smtp_pass VARCHAR(255), ADD COLUMN sms_api_key VARCHAR(255), ADD COLUMN sms_url VARCHAR(255)');
        }
    } catch (e) {}

    const resSettings: any = await executeQuery('SELECT * FROM settings LIMIT 1');
    const settings = (resSettings && resSettings.length > 0) ? resSettings[0] : {};

    if (type === 'email') {
      if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
        return { success: false, error: 'Configuration SMTP manquante dans les paramètres.' };
      }

      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: settings.smtp_port || 587,
        secure: settings.smtp_port === 465,
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_pass
        }
      });

      await transporter.sendMail({
        from: `"${settings.company_name}" <${settings.smtp_user}>`,
        to,
        subject,
        text: message,
        html: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
                <h2 style="color: #198754; border-bottom: 2px solid #198754; padding-bottom: 10px;">${settings.company_name}</h2>
                <p style="font-size: 16px; color: #333; line-height: 1.5;">${message.replace(/\n/g, '<br>')}</p>
                <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
                    Ceci est un message automatique envoyé par le système SCHOOLSERVICE PRO. Merci de ne pas y répondre directement.
                </div>
               </div>`
      });

      return { success: true };
    } else if (type === 'sms') {
      if (!settings.sms_api_key) return { success: false, error: 'Clé API SMS manquante dans les paramètres.' };
      console.log(`Simulation envoi SMS à ${to}: ${message}`);
      return { success: true, message: 'SMS envoyé (Simulation)' };
    }
    return { success: false, error: 'Type de notification inconnu.' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  try {
    console.log('Initialisation de la base de données au démarrage...');
    await initDatabase(); 

    // MIGRATION FORCÉE (SÉCURITÉ)
    console.log('Vérification des colonnes critiques...');
    try {
        // Table Etudiants
        const colsEtud: any = await executeQuery('SHOW COLUMNS FROM etudiants');
        if (colsEtud && !colsEtud.some((c: any) => c.Field === 'matricule')) {
            await executeQuery('ALTER TABLE etudiants ADD COLUMN matricule VARCHAR(50) AFTER id');
            await executeQuery('UPDATE etudiants SET matricule = CONCAT("MAT-", LPAD(id, 4, "0")) WHERE matricule IS NULL');
            await executeQuery('ALTER TABLE etudiants ADD UNIQUE (matricule)');
            console.log('Migration forcée: matricule ajouté.');
        }
        if (colsEtud && !colsEtud.some((c: any) => c.Field === 'sexe')) {
            await executeQuery('ALTER TABLE etudiants ADD COLUMN sexe VARCHAR(10) AFTER prenom');
            console.log('Migration forcée: sexe ajouté aux étudiants.');
        }

        // Table Professeurs
        const colsProf: any = await executeQuery('SHOW COLUMNS FROM professeurs');
        if (colsProf && !colsProf.some((c: any) => c.Field === 'sexe')) {
            await executeQuery('ALTER TABLE professeurs ADD COLUMN sexe VARCHAR(10) AFTER prenom');
            console.log('Migration forcée: sexe ajouté aux professeurs.');
        }

        // Migration Settings (Notifications)
        const colsSet: any = await executeQuery('SHOW COLUMNS FROM settings');
        const setColsToAdd = [
            { name: 'smtp_host', type: 'VARCHAR(255)' },
            { name: 'smtp_port', type: 'INTEGER' },
            { name: 'smtp_user', type: 'VARCHAR(255)' },
            { name: 'smtp_pass', type: 'VARCHAR(255)' },
            { name: 'sms_api_key', type: 'VARCHAR(255)' },
            { name: 'sms_url', type: 'VARCHAR(255)' }
        ];
        for (const col of setColsToAdd) {
            if (colsSet && !colsSet.some((c: any) => c.Field === col.name)) {
                await executeQuery(`ALTER TABLE settings ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Migration forcée: ${col.name} ajouté aux paramètres.`);
            }
        }
    } catch (migErr: any) {
        console.error('Erreur lors de la migration forcée:', migErr.message);
    }
  } catch (err: any) {
    console.error('Erreur DB au démarrage:', err.message);
  }
  createWindow();
});

function getLicensePath() {
  const userData = app.getPath('userData');
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true });
  return path.join(userData, 'license_school.json');
}

ipcMain.handle('print-bulletin', async (_event, { htmlContent }) => {
  const win = new BrowserWindow({ 
    show: true, // On le montre brièvement pour forcer le rendu GPU
    width: 800,
    height: 900,
    title: 'Génération du bulletin...',
    webPreferences: { 
      nodeIntegration: true,
      contextIsolation: false
    } 
  });
  
  // Centrer la fenêtre
  win.center();

  const tempPath = path.join(app.getPath('temp'), `bulletin_${Date.now()}.html`);
  fs.writeFileSync(tempPath, htmlContent);
  win.loadFile(tempPath);
  
  win.webContents.on('did-finish-load', () => {
    // Augmenter le délai à 2 secondes pour être absolument certain du rendu
    setTimeout(() => {
      win.webContents.print({ 
        silent: false, 
        printBackground: true,
        margins: { marginType: 'default' }
      }, (success, failureReason) => {
        console.log('Impression terminée:', success, failureReason);
        try { fs.unlinkSync(tempPath); } catch (e) {}
        win.close();
      });
    }, 2000); 
  });
  return { success: true };
});

ipcMain.handle('get-machine-id', async () => {
  return new Promise((resolve) => {
    exec('wmic cpu get processorid', (error, stdout) => {
      if (error) resolve('SS-ID-' + process.arch);
      const id = stdout.replace(/ProcessorId/gi, '').replace(/[^a-zA-Z0-9]/g, '').trim();
      resolve(id || 'SS-GENERIC-ID');
    });
  });
});

ipcMain.handle('check-license', async () => {
  try {
    const lPath = getLicensePath();
    if (fs.existsSync(lPath)) {
      const data = JSON.parse(fs.readFileSync(lPath, 'utf8'));
      if (data.status === 'ACTIVE') return { active: true, key: data.activation_key };
    }
    return { active: false };
  } catch (e) { return { active: false }; }
});

ipcMain.handle('activate-app', async (event, { machineId, key }) => {
  try {
    const mid = machineId.replace(/[^a-zA-Z0-9]/g, '').trim();
    const expectedKey = "SS-" + mid.split('').reverse().join('').substring(0, 8).toUpperCase() + "-PRO";
    if (key.trim() === expectedKey) {
      const licenseData = { machine_id: mid, activation_key: key.trim(), status: 'ACTIVE', date: new Date().toISOString() };
      fs.writeFileSync(getLicensePath(), JSON.stringify(licenseData, null, 2));
      return { success: true };
    }
    return { success: false, message: `Clé invalide.` };
  } catch (e: any) {
    return { success: false, message: "Erreur système : " + e.message };
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
