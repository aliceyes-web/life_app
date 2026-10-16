import { store } from './store.js';
import { applyTheme } from './theme.js';
import { icon } from './util.js';
import { currentPath } from './router.js';
import * as home from './pages/home.js';
import * as weather from './pages/weather.js';
import * as calendar from './pages/calendar.js';
import * as notes from './pages/notes.js';
import * as bus from './pages/bus.js';
import * as carrier from './pages/carrier.js';
import * as settings from './pages/settings.js';

const TABS = [
  { path: '/', label: '首頁', icon: 'home' },
  { path: '/weather', label: '天氣', icon: 'sun' },
  { path: '/calendar', label: '行事曆', icon: 'calendar' },
  { path: '/bus', label: '公車', icon: 'bus' },
  { path: '/notes', label: '記事', icon: 'note' },
];

function resolve(path) {
  const m = path.match(/^\/notes\/([\w-]+)$/);
  if (m) return { page: { render: () => notes.renderEditor(m[1]), mount: (r) => notes.mountEditor(r, m[1]) }, tab: false, title: '記事' };
  const b = path.match(/^\/bus\/([\w-]+)$/);
  if (b) return { page: { render: () => bus.renderRoute(b[1]), mount: (r, re) => bus.mountRoute(r, b[1], re) }, tab: true, title: '路線動態' };
  const map = {
    '/': [home, '首頁'], '/weather': [weather, '天氣'], '/calendar': [calendar, '行事曆'],
    '/bus': [bus, '公車'], '/notes': [notes, '記事本'],
    '/carrier': [carrier, '載具條碼', false], '/settings': [settings, '設定', false],
  };
  const hit = map[path] || map['/'];
  return { page: hit[0], title: hit[1], tab: hit[2] !== false };
}

const app = document.getElementById('app');
const tabbar = document.getElementById('tabbar');
let lastPath = null;

function render() {
  const path = currentPath();
  if (lastPath && lastPath.startsWith('/notes/') && path !== lastPath) notes.pruneEmpty();
  if (lastPath === '/carrier' && path !== '/carrier') carrier.releaseWake();
  if (lastPath === '/bus' && path !== '/bus') bus.stop();
  if (lastPath && lastPath.startsWith('/bus/') && path !== lastPath) bus.stopRoute();
  const changed = path !== lastPath;
  const { page, title, tab } = resolve(path);
  const scroll = changed ? 0 : window.scrollY;
  app.innerHTML = page.render();
  page.mount?.(app, render);
  document.title = `${title}・生活小幫手`;

  tabbar.hidden = !tab;
  const active = '/' + (path.split('/')[1] || '');
  tabbar.querySelectorAll('a').forEach((a) => {
    if (a.dataset.path === active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, scroll);
  lastPath = path;
}

tabbar.innerHTML = `<nav aria-label="主要頁面">${TABS.map((t) => `<a href="#${t.path}" data-path="${t.path}">${icon(t.icon)}${t.label}</a>`).join('')}</nav>`;

applyTheme();
store.subscribe(() => { applyTheme(); if (!currentPath().startsWith('/notes/')) render(); });
window.addEventListener('hashchange', render);
render();

// Refresh "today" when the app comes back after midnight.
let day = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && new Date().toDateString() !== day) { day = new Date().toDateString(); render(); }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
