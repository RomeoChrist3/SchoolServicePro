/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    dbQuery: (query: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  };
}
