import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (query: string, params: any[]) => ipcRenderer.invoke('db:query', { query, params }),
  dbBackup: () => ipcRenderer.invoke('db:backup'),
  dbRestore: () => ipcRenderer.invoke('db:restore'),
  dbConfigGet: () => ipcRenderer.invoke('db:config:get'),
  dbConfigSave: (config: any) => ipcRenderer.invoke('db:config:save', config),
  
  // Fonctions de Licence
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  checkLicense: () => ipcRenderer.invoke('check-license'),
  activateApp: (data: { machineId: string, key: string }) => ipcRenderer.invoke('activate-app', data),

  // Gestion des Médias
  mediaSave: (data: { fileName: string, base64Data: string }) => ipcRenderer.invoke('media:save', data),
  mediaGetBase64: (fileName: string) => ipcRenderer.invoke('media:get-base64', fileName),
  mediaGetBaseUrl: () => ipcRenderer.invoke('media:get-base-url'),
  
  // NOUVEAU : Impression Bulletin Fiable
  printBulletin: (html: string) => ipcRenderer.invoke('print-bulletin', { htmlContent: html }),

  // Notifications
  notificationSend: (data: any) => ipcRenderer.invoke('notification:send', data),
  notificationTestSmtp: (config: any) => ipcRenderer.invoke('notification:test-smtp', config)
});
