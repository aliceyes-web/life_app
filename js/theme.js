import { store } from './store.js';

export const THEMES = [
  { id: 'sage', name: '鼠尾草', color: '#4A7C6A', dark: '#8FC1AB' },
  { id: 'milktea', name: '奶茶', color: '#8A6440', dark: '#D2AE85' },
  { id: 'mist', name: '霧藍', color: '#4A6F8A', dark: '#93B7D3' },
  { id: 'rose', name: '玫瑰', color: '#A0525E', dark: '#E39CA7' },
  { id: 'lavender', name: '薰衣草', color: '#6E5E94', dark: '#B6A8DE' },
];
export const MODES = [
  { id: 'warm', name: '暖米白', bg: '#F7F4EE' },
  { id: 'clean', name: '清爽白', bg: '#F4F5F6' },
  { id: 'dark', name: '深色', bg: '#1C1B19' },
];

const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function effectiveMode() {
  const s = store.settings();
  if (s.autoDark && mq && mq.matches) return 'dark';
  return s.mode;
}

export function applyTheme() {
  const s = store.settings();
  const mode = effectiveMode();
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.mode = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', (MODES.find((m) => m.id === mode) || MODES[0]).bg);
}

if (mq) mq.addEventListener?.('change', applyTheme);
