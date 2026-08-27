/**
 * SERVICE DE DONNÉES UNIVERSEL
 * Ce service permet à l'application de fonctionner :
 * 1. En mode Electron (Local/Desktop)
 * 2. En mode Web (Internet/Navigateur)
 */

export const dbQuery = async (query: string, params: any[] = []) => {
  // CAS 1 : MODE DESKTOP (ELECTRON)
  if ((window as any).electronAPI) {
    return await (window as any).electronAPI.dbQuery(query, params);
  } 
  
  // CAS 2 : MODE WEB (INTERNET)
  else {
    try {
      // On récupère l'URL de l'API depuis le localStorage ou on utilise une valeur par défaut
      const api_url = localStorage.getItem('api_url') || 'http://localhost:3000';
      
      const response = await fetch(`${api_url}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Sécurité
        },
        body: JSON.stringify({ query, params })
      });

      if (!response.ok) throw new Error('Erreur réseau ou accès refusé');
      return await response.json();
    } catch (err) {
      console.error("Erreur Web API:", err);
      return { success: false, error: "Impossible de contacter le serveur distant." };
    }
  }
};

/**
 * Gère l'URL du serveur pour la version Web
 */
export const setApiUrl = (url: string) => {
  localStorage.setItem('api_url', url);
};
