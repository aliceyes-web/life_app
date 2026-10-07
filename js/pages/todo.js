import { store } from '../store.js';
import { esc, icon, uid, ymd, addDays, relDay, toast } from '../util.js';
import { openSheet } from '../sheet.js';

/** Todos that belong to "today": due today, overdue, or completed today. */
function isToday(t, today) {
  if (!t.due) return false;
  if (t.due === today) return true;
  // overdue items stay in "today" until done; once done they stay for the rest of that day
  return t.due < today && (!t.done || ymd(new Date(t.doneAt || 0)) === today);
}

export function todayTodos() {
  const today = ymd();
  return store.get().todos
    .filter((t) => isToday(t, today))
    .map((t) => ({ ...t, overdue: !t.done && t.due < today }));
}

function groups() {
  const today = ymd();
  const tomorrow = ymd(addDays(new Date(), 1));
  const all = store.get().todos;
  const by = (fn) => all.filter(fn).sort((a, b) => (a.done - b.done) || (a.due || '').localeCompare(b.due || '') || a.createdAt - b.createdAt);
  return [
    { id: 'today', name: '今天', items: by((t) => isToday(t, today)) },
    { id: 'tomorrow', name: '明天', items: by((t) => t.due === tomorrow) },
    { id: 'later', name: '之後', items: by((t) => t.due && t.due > tomorrow) },
    { id: 'none', name: '未排日期', items: by((t) => !t.due) },
  ];
}

export function render() {
  const g = groups();
  const today = g[0].items;
  const done = today.filter((t) => t.done).length;
  const pct = today.length ? Math.round((done / today.length) * 100) : 0;
  const anyDone = store.get().todos.some((t) => t.done);
  const todayKey = ymd();

  const row = (t) => `
    <div class="list-row">
      <button class="check ${t.done ? 'on' : ''}" data-toggle="${t.id}" aria-label="${t.done ? '取消完成' : '標記完成'}：${esc(t.title)}" aria-pressed="${t.done}"><span>${t.done ? icon('check', 14, 3) : ''}</span></button>
      <button class="grow" data-edit="${t.id}" style="border:none;background:none;text-align:left;padding:8px 0;cursor:pointer">
        <div class="${t.done ? 'done-text' : ''}" style="${t.done ? '' : 'font-weight:500'}">${esc(t.title)}</div>
        ${t.note ? `<div class="muted tiny">${esc(t.note)}</div>` : ''}
      </button>
      ${!t.done && t.due && t.due < todayKey ? `<span class="chip warm" style="font-size:12px">逾期 ${relDay(t.due)}</span>`
        : !t.done && t.due && t.due > ymd(addDays(new Date(), 1)) ? `<span class="tiny muted">${relDay(t.due)}</span>` : ''}
    </div>`;

  return `
  <div class="page" style="padding-bottom:calc(var(--safe-bottom) + 180px)">
    <header class="topbar"><h1 class="page-title">待辦清單</h1>
      ${anyDone ? '<button class="link-btn" id="clear-done">清除已完成</button>' : ''}</header>

    <section class="banner" style="display:flex;flex-direction:column;gap:10px;padding:18px 20px">
      <div class="card-head"><span>今天進度</span><span>${done} / ${today.length} 完成</span></div>
      <div style="font-size:30px;font-weight:700;color:var(--main)">${pct}%</div>
      <div class="progress"><i style="width:${pct}%"></i></div>
    </section>

    ${g.filter((x) => x.items.length).map((x) => `
      <section style="display:flex;flex-direction:column;gap:8px">
        <div class="card-head" style="padding:0 4px"><h2 style="font-size:16px">${x.name}</h2>
          <span class="tiny muted">${x.items.filter((t) => t.done).length} / ${x.items.length}</span></div>
        <div class="list">${x.items.map(row).join('')}</div>
      </section>`).join('') || '<div class="card empty">還沒有待辦事項，在下方輸入第一件吧</div>'}
  </div>
  <form class="add-bar" id="add-form" autocomplete="off">
    <label class="sr-only" for="new-todo">新增待辦</label>
    <input class="input" id="new-todo" placeholder="新增今天的待辦…" enterkeyhint="done">
    <button class="pill-btn" aria-label="加入">${icon('plus', 22, 2.2)}</button>
  </form>`;
}

export function mount(root) {
  root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.toggle;
    store.update((s) => { const t = s.todos.find((x) => x.id === id); if (t) { t.done = !t.done; t.doneAt = t.done ? Date.now() : null; } });
  }));
  root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editTodo(b.dataset.edit)));
  root.querySelector('#clear-done')?.addEventListener('click', () => {
    const n = store.get().todos.filter((t) => t.done).length;
    if (!confirm(`要清除 ${n} 件已完成的待辦嗎？`)) return;
    store.update((s) => { s.todos = s.todos.filter((t) => !t.done); });
  });
  root.querySelector('#add-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = root.querySelector('#new-todo');
    const title = input.value.trim();
    if (!title) return;
    store.update((s) => s.todos.push({ id: uid(), title, note: '', due: ymd(), done: false, createdAt: Date.now() }));
    toast('已加入今天的待辦');
    requestAnimationFrame(() => document.querySelector('#new-todo')?.focus());
  });
}

function editTodo(id) {
  const t = store.get().todos.find((x) => x.id === id);
  if (!t) return;
  openSheet({
    title: '編輯待辦',
    body: `
      <label class="field"><span>內容</span><input class="input" name="title" value="${esc(t.title)}" required></label>
      <label class="field"><span>備註</span><input class="input" name="note" value="${esc(t.note || '')}"></label>
      <label class="field"><span>日期（可留空）</span><input class="input" type="date" name="due" value="${esc(t.due || '')}"></label>`,
    actions: [{ id: 'delete', label: '刪除', cls: 'danger' }, { id: 'save', label: '儲存', cls: 'primary', submit: true }],
    onAction(action, data) {
      if (action === 'delete') {
        store.update((s) => { s.todos = s.todos.filter((x) => x.id !== id); });
        toast('已刪除');
        return true;
      }
      if (!data.title.trim()) return false;
      store.update((s) => { const x = s.todos.find((y) => y.id === id); Object.assign(x, { title: data.title.trim(), note: data.note.trim(), due: data.due || null }); });
      return true;
    },
  });
}
