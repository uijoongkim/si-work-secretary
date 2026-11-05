const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('secretary', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: config => ipcRenderer.invoke('config:save', config),
  getSummary: () => ipcRenderer.invoke('summary:get'),
  refresh: () => ipcRenderer.invoke('summary:refresh'),
  notifyNow: () => ipcRenderer.invoke('summary:notify-now'),
  toggleItem: (id, done) => ipcRenderer.invoke('item:toggle', id, done),
  onSummaryUpdated: callback => ipcRenderer.on('summary:updated', (_event, summary) => callback(summary))
});
