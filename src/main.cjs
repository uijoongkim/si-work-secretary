const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage, safeStorage, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { collectSummary } = require('./services/summary.cjs');

const APP_ID = 'kr.siwork.secretary';
let win;
let tray;
let scheduleTimer;
let quitting = false;
const defaults = {
  schedule: ['08:30', '12:30', '18:00'],
  historyDays: 7,
  jira: { enabled: false, baseUrl: '', username: '', authType: 'basic', additionalJql: '' },
  confluence: { enabled: false, baseUrl: '', username: '', authType: 'basic' },
  bitbucket: { enabled: false, baseUrl: '', username: '', authType: 'basic' },
  synology: { enabled: false, baseUrl: '', botToken: '', channels: '', names: '' }
};

function userFile(name) { return path.join(app.getPath('userData'), name); }
function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(userFile(name), 'utf8')); } catch { return fallback; }
}
function writeJson(name, value) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(userFile(name), JSON.stringify(value, null, 2), { mode: 0o600 });
}
function getConfig() {
  const stored = readJson('config.json', {});
  const secrets = readJson('secrets.json', {});
  for (const key of ['jira', 'confluence', 'bitbucket', 'synology']) {
    const secret = secrets[key];
    if (secret && safeStorage.isEncryptionAvailable()) {
      try { stored[key] = { ...stored[key], ...JSON.parse(safeStorage.decryptString(Buffer.from(secret, 'base64'))) }; } catch {}
    }
  }
  return { ...defaults, ...stored, schedule: stored.schedule || defaults.schedule };
}
function saveConfig(input) {
  const safe = {};
  const secrets = readJson('secrets.json', {});
  for (const key of ['jira', 'confluence', 'bitbucket', 'synology']) {
    safe[key] = { ...(input[key] || {}) };
    const secretKeys = key === 'synology' ? ['botToken'] : ['password', 'token'];
    const secretValues = {};
    for (const secretKey of secretKeys) {
      if (safe[key][secretKey]) secretValues[secretKey] = safe[key][secretKey];
      delete safe[key][secretKey];
    }
    if (Object.keys(secretValues).length && !safeStorage.isEncryptionAvailable()) {
      throw new Error('이 운영체제에서 보호 저장소를 사용할 수 없어 비밀번호나 토큰을 저장하지 않았습니다. Windows에서 다시 저장해 주세요.');
    }
    if (Object.keys(secretValues).length && safeStorage.isEncryptionAvailable()) {
      secrets[key] = safeStorage.encryptString(JSON.stringify(secretValues)).toString('base64');
    }
  }
  safe.schedule = input.schedule || defaults.schedule;
  safe.historyDays = Math.min(90, Math.max(1, Number.parseInt(input.historyDays, 10) || defaults.historyDays));
  writeJson('config.json', safe);
  writeJson('secrets.json', secrets);
  return getConfig();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1040, height: 760, minWidth: 900, minHeight: 660,
    show: false, title: 'SI Work Secretary', backgroundColor: '#f5f7fb',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  win.on('close', event => { if (!quitting) { event.preventDefault(); win.hide(); } });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try { if (['http:', 'https:'].includes(new URL(url).protocol)) shell.openExternal(url); } catch {}
    return { action: 'deny' };
  });
}
function makeTray() {
  const image = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png'));
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('SI Work Secretary');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '요약 열기', click: () => showWindow() },
    { label: '지금 동기화', click: async () => { await runSummary(true); } },
    { type: 'separator' },
    { label: '종료', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}
function showWindow() { if (!win) createWindow(); win.show(); win.focus(); }
function nextScheduleDelay(schedule) {
  const now = new Date();
  const next = (schedule || defaults.schedule).map(value => {
    const [h, m] = value.split(':').map(Number);
    const date = new Date(now); date.setHours(h, m, 0, 0);
    if (date <= now) date.setDate(date.getDate() + 1);
    return date;
  }).sort((a,b) => a - b)[0];
  return Math.max(1000, next.getTime() - now.getTime());
}
function armSchedule() {
  clearTimeout(scheduleTimer);
  scheduleTimer = setTimeout(async () => {
    await runSummary(true);
    armSchedule();
  }, nextScheduleDelay(getConfig().schedule));
}
async function runSummary(notify = false) {
  const config = getConfig();
  const state = readJson('state.json', { completed: {}, summary: null });
  const result = await collectSummary(config, state.completed || {});
  writeJson('state.json', { ...state, summary: result, updatedAt: new Date().toISOString() });
  if (notify && Notification.isSupported() && (!result.demo || process.argv.includes('--preview-notification'))) {
    const count = result.items.filter(item => !item.done).length;
    new Notification({ title: count ? `확인할 항목 ${count}개` : '오늘 확인할 항목이 없습니다', body: result.headline, silent: false }).show();
  }
  win?.webContents.send('summary:updated', result);
  tray?.setToolTip(`SI Work Secretary · ${result.items.filter(item => !item.done).length}개 확인 필요`);
  return result;
}

app.setAppUserModelId(APP_ID);
app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: ['--hidden'] });
  makeTray(); createWindow(); armSchedule();
});
app.on('before-quit', () => { quitting = true; clearTimeout(scheduleTimer); });
app.on('activate', showWindow);

ipcMain.handle('config:get', () => {
  const c = getConfig();
  for (const key of ['jira','confluence','bitbucket','synology']) { if (c[key]) { c[key].password = ''; c[key].token = ''; c[key].botToken = ''; } }
  return c;
});
ipcMain.handle('config:save', (_e, config) => { const saved = saveConfig(config); armSchedule(); return Object.fromEntries(Object.entries(saved).map(([k,v]) => [k, ['jira','confluence','bitbucket','synology'].includes(k) ? { ...v, password: '', token: '', botToken: '' } : v])); });
ipcMain.handle('summary:get', async () => {
  const state = readJson('state.json', {});
  return state.summary || runSummary(false);
});
ipcMain.handle('summary:refresh', () => runSummary(false));
ipcMain.handle('item:toggle', async (_e, id, done) => {
  const state = readJson('state.json', { completed: {}, summary: null });
  state.completed = { ...(state.completed || {}), [id]: Boolean(done) };
  writeJson('state.json', state);
  if (state.summary) state.summary.items = state.summary.items.map(i => i.id === id ? { ...i, done: Boolean(done) } : i);
  writeJson('state.json', state);
  win?.webContents.send('summary:updated', state.summary);
  return state.summary;
});
ipcMain.handle('summary:notify-now', async () => {
  const result = await runSummary(false);
  if (Notification.isSupported()) new Notification({ title: '미리보기 알림 · Work Secretary', body: result.headline }).show();
  return result;
});
