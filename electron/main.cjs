const { app, BrowserWindow, ipcMain, shell, protocol, dialog, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const { scanSkillTrees, normalizeHome } = require('./scanner.cjs');
const { DEFAULT_CONFIG, readConfig, writeConfig } = require('./config.cjs');

app.setName('Skill-Management');

let mainWindow = null;
const APP_ICON_PATH = path.join(__dirname, '..', 'assets', 'icons', 'app-icon-1024.png');

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

let cachedConfig = DEFAULT_CONFIG;

function getScanCacheFilePath() {
  return path.join(app.getPath('userData'), 'scan-cache.json');
}

function isSameScanSettings(a, b) {
  if (!a || !b) return false;
  if (a.scanDepth !== b.scanDepth) return false;
  if (!Array.isArray(a.authorizedPaths) || !Array.isArray(b.authorizedPaths)) return false;
  if (a.authorizedPaths.length !== b.authorizedPaths.length) return false;
  for (let i = 0; i < a.authorizedPaths.length; i += 1) {
    if (a.authorizedPaths[i] !== b.authorizedPaths[i]) {
      return false;
    }
  }
  return true;
}

async function readScanCache(expectedSettings) {
  try {
    const raw = await fs.readFile(getScanCacheFilePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (!isSameScanSettings(parsed?.settings, expectedSettings)) {
      return null;
    }
    return Array.isArray(parsed.skills) ? parsed.skills : null;
  } catch {
    return null;
  }
}

async function writeScanCache(settings, skills) {
  const payload = {
    settings,
    generatedAt: new Date().toISOString(),
    skills,
  };
  await fs.writeFile(getScanCacheFilePath(), JSON.stringify(payload), 'utf-8');
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function isWithinAuthorizedPath(targetPath) {
  const homeDir = app.getPath('home');
  const authorized = (cachedConfig.settings?.authorizedPaths || [])
    .map((p) => normalizeHome(p, homeDir))
    .map((p) => path.resolve(p));

  const resolvedTarget = path.resolve(targetPath);
  return authorized.some((root) => resolvedTarget === root || resolvedTarget.startsWith(`${root}${path.sep}`));
}

function createSkillsFileUrl(filePath) {
  return `skillsfile://local?path=${encodeURIComponent(filePath)}`;
}

async function transferPath({ sourcePath, targetDirectoryPath, mode }) {
  const sourceResolved = path.resolve(sourcePath);
  const targetDirResolved = path.resolve(targetDirectoryPath);

  if (!isWithinAuthorizedPath(sourceResolved) || !isWithinAuthorizedPath(targetDirResolved)) {
    throw new Error('Path is not in authorized scope.');
  }

  const targetDirStat = await fs.stat(targetDirResolved);
  if (!targetDirStat.isDirectory()) {
    throw new Error('Target must be a directory.');
  }

  if (sourceResolved === targetDirResolved || targetDirResolved.startsWith(`${sourceResolved}${path.sep}`)) {
    throw new Error('Invalid destination directory.');
  }

  const destinationPath = path.join(targetDirResolved, path.basename(sourceResolved));
  try {
    await fs.access(destinationPath);
    throw new Error('Target already contains an item with the same name.');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  if (mode === 'copy') {
    await fs.cp(sourceResolved, destinationPath, { recursive: true, errorOnExist: true, force: false });
    return { destinationPath };
  }

  try {
    await fs.rename(sourceResolved, destinationPath);
  } catch (error) {
    if (error.code !== 'EXDEV') {
      throw error;
    }
    await fs.cp(sourceResolved, destinationPath, { recursive: true, errorOnExist: true, force: false });
    await fs.rm(sourceResolved, { recursive: true, force: false });
  }

  return { destinationPath };
}

async function deletePath(targetPath) {
  const resolvedTarget = path.resolve(targetPath);
  if (!isWithinAuthorizedPath(resolvedTarget)) {
    throw new Error('Path is not in authorized scope.');
  }

  const stat = await fs.stat(resolvedTarget);
  if (stat.isDirectory()) {
    await fs.rm(resolvedTarget, { recursive: true, force: false });
  } else {
    await fs.unlink(resolvedTarget);
  }
  return true;
}

async function registerCustomProtocol() {
  const handled = await protocol.isProtocolHandled('skillsfile');
  if (handled) return;

  protocol.handle('skillsfile', async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const requestedPath = requestUrl.searchParams.get('path');
      if (!requestedPath) {
        return new Response('Missing path', { status: 400 });
      }

      const decodedPath = decodeURIComponent(requestedPath);
      if (!isWithinAuthorizedPath(decodedPath)) {
        return new Response('Forbidden', { status: 403 });
      }

      const data = await fs.readFile(decodedPath);
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'content-type': getMimeType(decodedPath),
          'cache-control': 'no-store',
        },
      });
    } catch (error) {
      return new Response(`Read failed: ${error.message}`, { status: 500 });
    }
  });
}

async function createWindow() {
  cachedConfig = await readConfig(app);

  await registerCustomProtocol();

  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(APP_ICON_PATH);
    } catch {
      // ignore icon setup failures
    }
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: 'SKILL Management',
    icon: APP_ICON_PATH,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function setupApplicationMenu() {
  const appLabel = 'Skill-Management';
  if (process.platform === 'darwin') {
    const template = [
      {
        label: appLabel,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'File',
        submenu: [{ role: 'close' }],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }],
      },
      {
        label: 'Window',
        submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    return;
  }

  Menu.setApplicationMenu(null);
}

app.whenReady().then(async () => {
  setupApplicationMenu();
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('config:get', async () => {
  cachedConfig = await readConfig(app);
  return cachedConfig;
});

ipcMain.handle('config:update', async (_event, configPatch) => {
  const current = await readConfig(app);
  const next = {
    settings: {
      ...current.settings,
      ...(configPatch.settings || {}),
    },
    onboardingDone: typeof configPatch.onboardingDone === 'boolean' ? configPatch.onboardingDone : current.onboardingDone,
  };

  cachedConfig = await writeConfig(app, next);
  return cachedConfig;
});

ipcMain.handle('scan:skills', async (event, args) => {
  cachedConfig = await readConfig(app);

  const settings = {
    authorizedPaths: args?.authorizedPaths || cachedConfig.settings.authorizedPaths,
    scanDepth: args?.scanDepth || cachedConfig.settings.scanDepth,
  };

  const skills = await scanSkillTrees({
    ...settings,
    homeDir: app.getPath('home'),
    onProgress(progressEvent) {
      event.sender.send('scan:progress', progressEvent);
    },
  });

  await writeScanCache(settings, skills);

  return skills;
});

ipcMain.handle('scan:cached', async (_event, args) => {
  cachedConfig = await readConfig(app);
  const settings = {
    authorizedPaths: args?.authorizedPaths || cachedConfig.settings.authorizedPaths,
    scanDepth: args?.scanDepth || cachedConfig.settings.scanDepth,
  };
  return readScanCache(settings);
});

ipcMain.handle('file:readText', async (_event, filePath) => {
  if (!isWithinAuthorizedPath(filePath)) {
    throw new Error('Path is not in authorized scope.');
  }
  return fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('file:getUrl', async (_event, filePath) => {
  if (!isWithinAuthorizedPath(filePath)) {
    throw new Error('Path is not in authorized scope.');
  }
  return createSkillsFileUrl(filePath);
});

ipcMain.handle('system:openPath', async (_event, targetPath) => {
  if (!isWithinAuthorizedPath(targetPath)) {
    throw new Error('Path is not in authorized scope.');
  }
  return shell.openPath(targetPath);
});

ipcMain.handle('system:revealPath', async (_event, targetPath) => {
  if (!isWithinAuthorizedPath(targetPath)) {
    throw new Error('Path is not in authorized scope.');
  }
  shell.showItemInFolder(targetPath);
  return true;
});

ipcMain.handle('system:selectDirectory', async () => {
  const focusedWindow = BrowserWindow.getFocusedWindow() || mainWindow;
  const result = await dialog.showOpenDialog(focusedWindow, {
    title: 'Select Directory',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('file:transferPath', async (_event, payload) => {
  return transferPath(payload);
});

ipcMain.handle('file:deletePath', async (_event, targetPath) => {
  return deletePath(targetPath);
});
