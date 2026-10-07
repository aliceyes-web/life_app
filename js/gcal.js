// Google 日曆（唯讀）— 使用 Google Identity Services 取得存取權杖，直接在瀏覽器呼叫 Calendar API。
// 需要在 Google Cloud Console 建立「網頁應用程式」OAuth 用戶端 ID，並把 APP 網址加到「已授權的 JavaScript 來源」。
import { store } from './store.js';

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_KEY = 'lifehelper.gtoken';
let gisLoaded = null;
let tokenClient = null;

function loadGis() {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisLoaded = null; reject(new Error('無法載入 Google 登入元件，請確認網路')); };
    document.head.appendChild(s);
  });
  return gisLoaded;
}

function readToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    if (t && t.exp > Date.now() + 60000) return t.token;
  } catch { /* ignore */ }
  return null;
}
function writeToken(token, expiresIn) {
  try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + expiresIn * 1000 })); } catch { /* ignore */ }
}

export const isConfigured = () => !!store.settings().gClientId;
export const isLinked = () => !!store.getCache('gLinked');
export const hasToken = () => !!readToken();

/** Ask Google for a token. Must be called from a user tap. */
export async function connect({ silent = false } = {}) {
  const clientId = store.settings().gClientId;
  if (!clientId) throw new Error('請先在「設定」填入 Google OAuth 用戶端 ID');
  await loadGis();
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-undef
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) { reject(new Error(resp.error_description || resp.error)); return; }
        writeToken(resp.access_token, Number(resp.expires_in) || 3600);
        store.setCache('gLinked', true);
        resolve(resp.access_token);
      },
      error_callback: (err) => reject(new Error(err?.message || '已取消 Google 登入')),
    });
    tokenClient.requestAccessToken({ prompt: silent && isLinked() ? '' : 'consent' });
  });
}

export function disconnect() {
  const t = readToken();
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  store.setCache('gLinked', false);
  store.setCache('gEvents', {});
  // eslint-disable-next-line no-undef
  if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t, () => {});
}

const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;

/** Cached Google events for a month, as [{id,title,date,allDay,start,end,place,source:'google'}] */
export function cachedMonth(y, m) {
  const all = store.getCache('gEvents') || {};
  return all[monthKey(y, m)]?.items || [];
}

/** Fetch a month from Google (needs a valid token). Returns items or throws. */
export async function fetchMonth(y, m) {
  const token = readToken();
  if (!token) throw Object.assign(new Error('需要重新連結 Google'), { code: 'NO_TOKEN' });
  const timeMin = new Date(y, m, 1).toISOString();
  const timeMax = new Date(y, m + 1, 1).toISOString();
  const p = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 401) { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } throw Object.assign(new Error('Google 授權已過期，請重新連結'), { code: 'NO_TOKEN' }); }
  if (!r.ok) throw new Error(`Google 日曆回應 ${r.status}`);
  const data = await r.json();
  const items = [];
  for (const ev of data.items || []) {
    if (ev.status === 'cancelled') continue;
    const title = ev.summary || '（無標題）';
    if (ev.start?.date) {
      // all-day: may span several days; end date is exclusive
      const s = new Date(ev.start.date + 'T00:00:00');
      const e = new Date(ev.end.date + 'T00:00:00');
      for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() !== m) continue;
        items.push({ id: `${ev.id}-${d.getDate()}`, title, date: localKey(d), allDay: true, start: '', end: '', place: ev.location || '', source: 'google' });
      }
    } else if (ev.start?.dateTime) {
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      items.push({ id: ev.id, title, date: localKey(s), allDay: false, start: hm(s), end: hm(e), place: ev.location || '', source: 'google' });
    }
  }
  const all = store.getCache('gEvents') || {};
  all[monthKey(y, m)] = { at: Date.now(), items };
  store.setCache('gEvents', all);
  return items;
}

const p2 = (n) => String(n).padStart(2, '0');
const localKey = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const hm = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
