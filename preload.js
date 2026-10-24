// preload.js — безопасный мост между страницей (paxmax.ru) и нативными возможностями
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('MFNative', {
  isDesktop: true,
  platform: process.platform,         // 'darwin' | 'win32'
  listFonts: () => ipcRenderer.invoke('fonts:list'),      // -> [family, ...]
  getFontBase64: (family) => ipcRenderer.invoke('fonts:data', family), // -> data:font/...;base64,...
  version: () => ipcRenderer.invoke('app:version')
});
