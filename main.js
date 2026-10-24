// MiniFig Desktop — обёртка над онлайн-версией (paxmax.ru/board) + нативный доступ к шрифтам
const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const fonts = require('./font-scan');

// ===== настройки =====
const APP_URL = process.env.MF_URL || 'https://paxmax.ru/board/';
const APP_NAME = 'MiniFig';

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: '#f4f5fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  win.loadURL(APP_URL);

  // внешние ссылки — в системном браузере
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  // скачивания (экспорт PNG/PDF и т.п.) — обычный системный диалог сохранения
  win.webContents.session.on('will-download', () => { /* Electron сам покажет диалог */ });
}

// ===== IPC: шрифты =====
ipcMain.handle('fonts:list', async () => {
  try { return fonts.listFamilies(); } catch (e) { return []; }
});
ipcMain.handle('fonts:data', async (_e, family) => {
  try { return fonts.getFontData(family); } catch (e) { return null; }
});
ipcMain.handle('app:version', async () => app.getVersion());

// ===== меню =====
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: APP_NAME,
      submenu: [
        { role: 'about', label: 'О программе ' + APP_NAME },
        { type: 'separator' },
        { role: 'hide', label: 'Скрыть' },
        { role: 'hideOthers', label: 'Скрыть остальные' },
        { role: 'unhide', label: 'Показать все' },
        { type: 'separator' },
        { role: 'quit', label: 'Выйти' }
      ]
    }] : []),
    {
      label: 'Файл',
      submenu: [
        { label: 'Обновить страницу', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() },
        ...(isMac ? [] : [{ role: 'quit', label: 'Выход' }])
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' }, { role: 'redo', label: 'Повторить' }, { type: 'separator' },
        { role: 'cut', label: 'Вырезать' }, { role: 'copy', label: 'Копировать' }, { role: 'paste', label: 'Вставить' }, { role: 'selectAll', label: 'Выделить всё' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'resetZoom', label: 'Масштаб 100%' }, { role: 'zoomIn', label: 'Крупнее' }, { role: 'zoomOut', label: 'Мельче' },
        { type: 'separator' }, { role: 'togglefullscreen', label: 'Во весь экран' },
        { type: 'separator' }, { role: 'toggleDevTools', label: 'Инструменты разработчика' }
      ]
    },
    {
      label: 'Шрифты',
      submenu: [
        { label: 'Пересканировать шрифты', click: () => { try { fonts.buildIndex(); dialog.showMessageBox(win, { message: 'Шрифты пересканированы.' }); } catch (e) {} } }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  try { fonts.setCacheDir(app.getPath('userData')); } catch (e) {}
  // прогреваем индекс шрифтов в фоне, чтобы первый вызов был быстрым
  setTimeout(() => { try { fonts.ensureIndex(); } catch (e) {} }, 500);
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
