import { store } from '../store.js';
import { esc, icon, uid, shortTime, toast } from '../util.js';
import { navigate } from '../router.js';

export const NOTE_TAGS = [
  { id: 'work', name: '工作' },
  { id: 'life', name: '生活' },
  { id: 'trip', name: '旅行' },
  { id: 'idea', name: '靈感' },
];
const CLASS = { work: 't-work', life: 't-life', trip: 't-trip', idea: 't-idea' };
export const noteTagClass = (tag) => CLASS[tag] || 't-none';
const tagName = (id) => (NOTE_TAGS.find((t) => t.id === id) || { name: '未分類' }).name;

let filter = 'all';
let query = '';

function filtered() {
  const q = query.trim().toLowerCase();
  return [...store.get().notes]
    .filter((n) => filter === 'all' || n.tag === filter)
    .filter((n) => !q || (n.title + '\n' + n.body).toLowerCase().includes(q))
    .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
}

const card = (n) => `
  <a class="note ${noteTagClass(n.tag)}" href="#/notes/${n.id}">
    ${n.pinned ? '<div class="tiny" style="font-weight:700;color:var(--warm-text)">置頂</div>' : ''}
    <div style="font-weight:700">${esc(n.title || '未命名')}</div>
    ${n.body ? `<div class="body">${esc(n.body)}</div>` : ''}
    <div class="row tiny muted" style="justify-content:space-between"><span>${tagName(n.tag)}</span><span>${shortTime(n.updatedAt)}</span></div>
  </a>`;

function listHtml() {
  const list = filtered();
  if (!list.length) return `<div class="card empty">${store.get().notes.length ? '找不到符合的記事' : '還沒有記事，點右下角開始寫第一則'}</div>`;
  const L = list.filter((_, i) => i % 2 === 0);
  const R = list.filter((_, i) => i % 2 === 1);
  return `<div class="masonry"><div>${L.map(card).join('')}</div><div>${R.map(card).join('')}</div></div>`;
}

export function render() {
  const total = store.get().notes.length;
  return `
  <div class="page">
    <header class="topbar"><h1 class="page-title">記事本</h1><span class="muted small">${total} 則記事</span></header>
    <label class="search">${icon('search', 18, 2)}<span class="sr-only">搜尋記事</span>
      <input type="search" id="q" placeholder="搜尋記事…" value="${esc(query)}"></label>
    <div class="chips" role="group" aria-label="分類">
      ${[{ id: 'all', name: '全部' }, ...NOTE_TAGS].map((t) => `<button class="filter" data-filter="${t.id}" aria-pressed="${filter === t.id}">${t.name}</button>`).join('')}
    </div>
    <div id="note-list">${listHtml()}</div>
  </div>
  <button class="fab" id="new-note" aria-label="新增記事">${icon('pen', 24, 2)}</button>`;
}

export function mount(root) {
  const q = root.querySelector('#q');
  q.addEventListener('input', () => { query = q.value; root.querySelector('#note-list').innerHTML = listHtml(); });
  root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    root.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    root.querySelector('#note-list').innerHTML = listHtml();
  }));
  root.querySelector('#new-note').addEventListener('click', () => {
    const id = uid();
    store.update((s) => s.notes.push({ id, title: '', body: '', tag: filter === 'all' ? '' : filter, pinned: false, updatedAt: Date.now() }), { silent: true });
    navigate(`/notes/${id}`);
  });
}

// ---------- editor ----------
export function renderEditor(id) {
  const n = store.get().notes.find((x) => x.id === id);
  if (!n) return '<div class="page no-nav"><a class="icon-btn" href="#/notes" aria-label="返回">‹</a><div class="card empty">找不到這則記事</div></div>';
  return `
  <div class="page no-nav">
    <header class="topbar">
      <a class="icon-btn" href="#/notes" aria-label="返回記事本">${icon('back', 18, 2)}</a>
      <div class="row">
        <button class="icon-btn" id="pin" aria-pressed="${n.pinned}" aria-label="${n.pinned ? '取消置頂' : '置頂'}" style="${n.pinned ? 'color:var(--warm-text);border-color:var(--warm)' : ''}">${icon('star', 18, 2)}</button>
        <button class="icon-btn" id="del" aria-label="刪除記事">${icon('trash', 18, 2)}</button>
      </div>
    </header>
    <div class="chips" role="group" aria-label="分類">
      ${[{ id: '', name: '未分類' }, ...NOTE_TAGS].map((t) => `<button class="filter" data-tag="${t.id}" aria-pressed="${(n.tag || '') === t.id}">${t.name}</button>`).join('')}
    </div>
    <label class="sr-only" for="ed-title">標題</label>
    <input class="editor-title" id="ed-title" placeholder="標題" value="${esc(n.title)}">
    <div class="muted tiny" id="ed-time">${n.updatedAt ? '最後編輯 ' + shortTime(n.updatedAt) : ''}</div>
    <label class="sr-only" for="ed-body">內容</label>
    <textarea class="editor-body" id="ed-body" placeholder="開始寫點什麼…">${esc(n.body)}</textarea>
  </div>`;
}

export function mountEditor(root, id) {
  const title = root.querySelector('#ed-title');
  const body = root.querySelector('#ed-body');
  if (!title) return;
  const saveText = () => store.update((s) => {
    const n = s.notes.find((x) => x.id === id);
    if (n) { n.title = title.value; n.body = body.value; n.updatedAt = Date.now(); }
  }, { silent: true });
  title.addEventListener('input', saveText);
  body.addEventListener('input', saveText);
  if (!title.value && !body.value) title.focus();
  root.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => {
    store.update((s) => { const n = s.notes.find((x) => x.id === id); if (n) n.tag = b.dataset.tag; }, { silent: true });
    root.querySelectorAll('[data-tag]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  }));
  root.querySelector('#pin').addEventListener('click', () => {
    store.update((s) => { const n = s.notes.find((x) => x.id === id); if (n) n.pinned = !n.pinned; });
  });
  root.querySelector('#del').addEventListener('click', () => {
    if (!confirm('確定要刪除這則記事嗎？')) return;
    store.update((s) => { s.notes = s.notes.filter((x) => x.id !== id); }, { silent: true });
    toast('已刪除記事');
    navigate('/notes');
  });
}

/** Drop notes left completely empty (called when leaving the editor). */
export function pruneEmpty() {
  const empty = store.get().notes.some((n) => !n.title.trim() && !n.body.trim());
  if (empty) store.update((s) => { s.notes = s.notes.filter((n) => n.title.trim() || n.body.trim()); }, { silent: true });
}
