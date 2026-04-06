const { app, BrowserWindow, ipcMain, shell, protocol, dialog, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const { scanSkillTrees, normalizeHome } = require('./scanner.cjs');
const { DEFAULT_CONFIG, readConfig, writeConfig } = require('./config.cjs');

app.setName('Skill-Management');

let mainWindow = null;
const APP_ICON_PATH = path.join(__dirname, '..', 'assets', 'icons', 'app-icon-1024.png');
const appStartTime = Date.now();
const pendingStartupLogs = [];

function emitStartupLog(message, level = 'info') {
  const elapsed = `+${((Date.now() - appStartTime) / 1000).toFixed(2)}s`;
  const log = { message, level, elapsed };
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('startup:log', log);
  } else {
    pendingStartupLogs.push(log);
  }
}

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
  emitStartupLog('主进程：正在读取应用配置...');
  cachedConfig = await readConfig(app);
  emitStartupLog('主进程：配置读取完成');

  emitStartupLog('主进程：正在注册自定义协议...');
  await registerCustomProtocol();
  emitStartupLog('主进程：自定义协议注册完成');

  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(APP_ICON_PATH);
      emitStartupLog('主进程：Dock 图标设置完成');
    } catch {
      emitStartupLog('主进程：Dock 图标设置失败（已忽略）', 'warn');
    }
  }

  emitStartupLog('主进程：正在创建应用窗口...');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: 'SKILL Management',
    icon: APP_ICON_PATH,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    emitStartupLog('主进程：窗口已显示');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    emitStartupLog('主进程：页面加载完成，渲染进程就绪');
    // 发送窗口创建前积压的日志
    for (const log of pendingStartupLogs) {
      mainWindow.webContents.send('startup:log', log);
    }
    pendingStartupLogs.length = 0;
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    const errorHtml = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1e1e1e;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 16px;
    }
    .icon { font-size: 48px; }
    .title { font-size: 20px; font-weight: 600; color: #ef4444; }
    .message { font-size: 14px; color: #9ca3af; text-align: center; max-width: 480px; line-height: 1.6; }
    .code { font-size: 12px; color: #6b7280; font-family: monospace; background: #2d2d2d; padding: 8px 16px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="icon">⚠️</div>
  <div class="title">启动失败</div>
  <div class="message">应用程序页面加载失败，请检查应用是否完整安装。</div>
  <div class="code">错误码 ${errorCode}：${errorDescription}</div>
</body>
</html>`;
    mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    mainWindow.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    emitStartupLog(`主进程：正在加载开发服务器 ${devServerUrl}...`);
    await mainWindow.loadURL(devServerUrl);
  } else {
    emitStartupLog('主进程：正在加载应用界面...');
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

ipcMain.handle('system:openExternal', async (_event, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    throw new Error('Invalid URL');
  }
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('skill:promoteToComputer', async (_event, sourcePath) => {
  const resolvedSource = path.resolve(sourcePath);

  if (!isWithinAuthorizedPath(resolvedSource)) {
    throw new Error('Path is not in authorized scope.');
  }

  const stat = await fs.stat(resolvedSource);
  if (!stat.isDirectory()) {
    throw new Error('Source must be a directory.');
  }

  // ── Step 1: 检查当前��统是否支持软连接 ──────────────────────────────
  const tempDir = app.getPath('temp');
  const testSrc = path.join(tempDir, `_sk_symtest_src_${Date.now()}`);
  const testDst = path.join(tempDir, `_sk_symtest_dst_${Date.now()}`);
  try {
    await fs.writeFile(testSrc, '');
    await fs.symlink(testSrc, testDst);
    await fs.unlink(testDst);
    await fs.unlink(testSrc);
  } catch (e) {
    try { await fs.unlink(testSrc); } catch {}
    try { await fs.unlink(testDst); } catch {}
    return { success: false, reason: 'symlink_unsupported', error: e.message };
  }

  const homeDir = app.getPath('home');
  const dirName = path.basename(resolvedSource);
  const allSkillsDir = path.join(homeDir, '.allskills');
  const backupPath = resolvedSource + '_backup';
  const destPath = path.join(allSkillsDir, dirName);

  // ── Step 2: 重命名为 _backup ─────────────────────────────────────────
  await fs.rename(resolvedSource, backupPath);

  try {
    // ── Step 3: 确保 ~/.allskills 存在 ──────────────────────────────────
    await fs.mkdir(allSkillsDir, { recursive: true });

    // ── Step 4: 复制到 ~/.allskills/dirName ─────────────────────────────
    await fs.cp(backupPath, destPath, { recursive: true, errorOnExist: true, force: false });

    // ── Step 5: 去掉目标目录名中的 _backup（目标本身已是正确名字 dirName）
    //   destPath 已经是正确名字，无需再重命名。

    // ── Step 6: 在原位置创建软连接 ──────────────────────────────────────
    await fs.symlink(destPath, resolvedSource);

    // ── Step 7: 验证软连接可用（模拟 cd / cd .. / pwd）────────────────
    const linkStat = await fs.stat(resolvedSource); // 跟随软连接
    if (!linkStat.isDirectory()) {
      throw new Error('验证失败：软连接目标不是目录');
    }
    const realpath = await fs.realpath(resolvedSource);
    if (path.resolve(realpath) !== path.resolve(destPath)) {
      throw new Error(`验证失败：软连接解析路径 ${realpath} 与目标 ${destPath} 不一致`);
    }

    // ── Step 8: 将 _backup 文件夹移入垃圾桶 ─────────────────────────────
    await shell.trashItem(backupPath);

    return { success: true, destPath };
  } catch (e) {
    // 出错时尽量回滚：删除软连接、删除不完整的目标副本、还原 _backup
    try { await fs.unlink(resolvedSource); } catch {}
    try { await fs.rm(destPath, { recursive: true, force: true }); } catch {}
    try { await fs.rename(backupPath, resolvedSource); } catch {}
    throw e;
  }
});
