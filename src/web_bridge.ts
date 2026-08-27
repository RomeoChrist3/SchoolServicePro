// --- BRIDGE DE COMPATIBILITÉ WEB POUR SCHOOLSERVICE PRO ---

const PRODUCTION_API_URL = typeof window !== 'undefined' && window.location.origin !== 'null' && window.location.origin !== 'file://' 
  ? window.location.origin 
  : ''; 

const getCleanServerUrl = () => {
  let url = localStorage.getItem('school_server_url') || PRODUCTION_API_URL;
  if (url && url.endsWith('/')) url = url.slice(0, -1);
  return url || 'http://localhost:3000';
};

if (typeof window !== 'undefined' && !(window as any).electronAPI) {
  console.log("🌐 SCHOOLSERVICE PRO : Mode Web/Navigateur activé.");
  
  (window as any).electronAPI = {
    // Requetes DB via Express API
    dbQuery: async (query: string, params: any[]) => {
      try {
        const baseUrl = getCleanServerUrl();
        const response = await fetch(`${baseUrl}/api/query`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query, params })
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: `Erreur HTTP ${response.status}` }));
            return { success: false, error: errData.error || `Erreur serveur : ${response.status}` };
        }
        
        return await response.json();
      } catch (err: any) {
        console.error("Erreur API Web:", err);
        return { 
          success: false, 
          error: "Impossible de joindre le serveur. Vérifiez votre connexion internet." 
        };
      }
    },

    dbBackup: async () => {
      alert("Sauvegarde disponible en mode Desktop ou manuellement via le serveur MySQL.");
      return { success: false, error: "Non supporté en mode Web" };
    },

    dbRestore: async () => {
      alert("Restauration disponible uniquement en mode Desktop ou manuellement via le serveur MySQL.");
      return { success: false, error: "Non supporté en mode Web" };
    },

    dbConfigSave: async (config: any) => {
      if (config.host) {
        let url = config.host.trim();
        // S'assurer qu'il commence par http si ce n'est pas localhost ou une IP brute
        if (!url.startsWith('http') && !url.includes('localhost') && url.includes('.')) {
          url = 'https://' + url;
        }
        localStorage.setItem('school_server_url', url);
        localStorage.setItem('school_db_name', config.database || '');
        return { success: true };
      }
      return { success: false };
    },

    dbConfigGet: async () => {
      return { 
        driver: 'mysql',
        host: localStorage.getItem('school_server_url') || PRODUCTION_API_URL || 'localhost', 
        database: localStorage.getItem('school_db_name') || 'schoolservice_db', 
        port: 3308,
        user: 'root',
        password: ''
      };
    },

    // Licence simulée (activée automatiquement sur le Web)
    getMachineId: async () => "WEB-" + window.location.hostname.toUpperCase(),
    checkLicense: async () => ({ active: true }), 
    activateApp: async () => ({ success: true }),

    // Gestion des Médias en LocalStorage
    mediaSave: async (data: { fileName: string, base64Data: string }) => {
      try {
        localStorage.setItem('school_media_' + data.fileName, data.base64Data);
        return { success: true, fileName: data.fileName };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    mediaGetBase64: async (fileName: string) => {
      try {
        const stored = localStorage.getItem('school_media_' + fileName);
        if (stored) {
          const ext = fileName.split('.').pop() || 'png';
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext;
          return { success: true, base64: `data:image/${mime};base64,${stored}` };
        }

        // Fallback: Tentative de récupération des fichiers statiques locaux (par ex: logo.png)
        const response = await fetch(`./${fileName}`);
        if (response.ok) {
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          return { success: true, base64 };
        }
        
        return { success: false, error: 'Fichier non trouvé' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    mediaGetBaseUrl: async () => '',

    // Impression Bulletin compatible Web (ouvre une nouvelle fenêtre et lance l'impression)
    printBulletin: async (html: string) => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        
        // Laisser 1 seconde de répit pour le rendu des images
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 1000);
        return { success: true };
      }
      alert("Bloqueur de fenêtres bloqué. Veuillez autoriser les popups pour l'impression des bulletins.");
      return { success: false, error: "Popup bloqué" };
    },

    // Notifications (Simulées sur le Web)
    notificationSend: async (data: any) => {
      console.log("📨 Envoi notification (Mode Web simulation) :", data);
      return { success: true };
    },

    notificationTestSmtp: async (config: any) => {
      console.log("📡 Test SMTP (Mode Web simulation) :", config);
      return { success: true };
    }
  };
}
