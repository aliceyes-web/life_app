// Local persistence. Everything lives in this device's localStorage.
const KEY = 'lifehelper.v1';

const DEFAULTS = {
  settings: {
    name: '',
    theme: 'sage',        // sage | milktea | mist | rose | lavender
    mode: 'warm',         // warm | clean | dark
    autoDark: true,       // follow the system dark mode
    carrier: '',          // 手機條碼載具, e.g. /ABC1234
    city: { name: '台北市', lat: 25.0375, lon: 121.5637 },
    gClientId: '',        // Google OAuth client ID
  },
  todos: [],   // {id,title,note,due,done,createdAt,doneAt}
  notes: [],   // {id,title,body,tag,pinned,updatedAt}
  events: [],  // {id,title,date,allDay,start,end,place,tag}
  cache: {},   // weather / google calendar caches
};

let state = load();
const listeners = new Set();

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  const s = structuredClone(DEFAULTS);
  if (raw && typeof raw === 'object') {
    Object.assign(s.settings, raw.settings || {});
    for (const k of ['todos', 'notes', 'events']) if (Array.isArray(raw[k])) s[k] = raw[k];
    if (raw.cache && typeof raw.cache === 'object') s.cache = raw.cache;
  }
  return s;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('save failed', e); }
}

export const store = {
  get: () => state,
  settings: () => state.settings,
  setSettings(patch) { Object.assign(state.settings, patch); save(); emit(); },
  update(fn, { silent = false } = {}) { fn(state); save(); if (!silent) emit(); },
  setCache(key, value) { state.cache[key] = value; save(); },
  getCache: (key) => state.cache[key],
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  exportJSON() {
    const { cache, ...rest } = state;
    return JSON.stringify({ app: 'life-helper', version: 1, exportedAt: new Date().toISOString(), ...rest }, null, 2);
  },
  importJSON(text) {
    const data = JSON.parse(text);
    if (!data || data.app !== 'life-helper') throw new Error('不是生活小幫手的備份檔');
    state = structuredClone(DEFAULTS);
    Object.assign(state.settings, data.settings || {});
    for (const k of ['todos', 'notes', 'events']) if (Array.isArray(data[k])) state[k] = data[k];
    save(); emit();
  },
};

function emit() { for (const fn of listeners) fn(state); }
