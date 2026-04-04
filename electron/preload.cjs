const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (configPatch) => ipcRenderer.invoke('config:update', configPatch),

  scanSkills: (params) => ipcRenderer.invoke('scan:skills', params),
  getCachedSkills: (params) => ipcRenderer.invoke('scan:cached', params),
  onScanProgress: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('scan:progress', handler);
    return () => ipcRenderer.removeListener('scan:progress', handler);
  },

  readTextFile: (filePath) => ipcRenderer.invoke('file:readText', filePath),
  getFileUrl: (filePath) => ipcRenderer.invoke('file:getUrl', filePath),

  openPath: (targetPath) => ipcRenderer.invoke('system:openPath', targetPath),
  revealPath: (targetPath) => ipcRenderer.invoke('system:revealPath', targetPath),
  selectDirectory: () => ipcRenderer.invoke('system:selectDirectory'),
  transferPath: (payload) => ipcRenderer.invoke('file:transferPath', payload),
  deletePath: (targetPath) => ipcRenderer.invoke('file:deletePath', targetPath),
});
