import { store } from '../store.js';
import { esc, icon, uid, ymd, parseYmd, toast, WEEK } from '../util.js';
import { dayType, holidayName, lunarDate, termOn, hasHolidayData } from '../almanac.js';
import { eventsOn, eventDays, EVENT_TAGS, tagName } from '../events.js';
import * as gcal from '../gcal.js';
import { openSheet } from '../sheet.js';

const now = new Date();
let view = { y: now.getFullYear(), m: now.getMonth() };
let sel = ymd(now);
let syncing = false;

export function render() {
  const { y, m } = view;
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const evDays = eventDays(y, m);
  const today = ymd();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push('<div></div>');
  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d);
    const key = ymd(date);
    const t = dayType(date);
    const off = t === 'holiday' || t === 'weekend';
    const cls = ['cal-day', off ? 'we' : '', key === today ? 'today' : '', key === sel ? 'sel' : ''].join(' ');
    const dot = holidayName(date) ? 'hol' : evDays.has(key) ? 'ev' : '';
    cells.push(`<button class="${cls}" data-day="${key}" aria-label="${m + 1}月${d}日${holidayName(date) ? ' ' + holidayName(date) : ''}" aria-pressed="${key === sel}"><span class="n">${d}</span><i class="${dot}"></i></button>`);
  }

  const selDate = parseYmd(sel);
  const list = eventsOn(sel);
  const hol = holidayName(selDate);
  const term = termOn(selDate);
  const linked = gcal.isLinked();

  return `
  <div class="page">
    <header class="topbar">
      <h1 class="page-title">${y}年${m + 1}月</h1>
      <div class="row">
        <button class="icon-btn" data-nav="-1" aria-label="上個月">${icon('back', 18, 2)}</button>
        <button class="icon-btn" data-nav="1" aria-label="下個月">${icon('next', 18, 2)}</button>
      </div>
    </header>

    <div class="row">
      ${y !== now.getFullYear() || m !== now.getMonth() || sel !== today ? '<button class="filter" id="go-today">回到今天</button>' : ''}
      <span class="spacer"></span>
      ${gcal.isConfigured()
        ? `<button class="filter" id="sync" ${syncing ? 'disabled' : ''}>${icon('refresh', 14, 2)} ${syncing ? '同步中…' : linked ? '同步 Google 日曆' : '連結 Google 日曆'}</button>`
        : '<a class="filter" href="#/settings" style="display:inline-flex;align-items:center">設定 Google 日曆</a>'}
    </div>

    <section class="card" style="padding:14px 10px;gap:4px">
      <div class="cal-head">${WEEK.map((w, i) => `<div class="${i === 0 || i === 6 ? 'we' : ''}">${w}</div>`).join('')}</div>
      <div class="cal-grid">${cells.join('')}</div>
      ${!hasHolidayData(y) ? `<div class="notice" style="padding:6px">尚未收錄 ${y} 年的放假日資料</div>` : ''}
    </section>

    <section style="display:flex;flex-direction:column;gap:10px">
      <div class="card-head">
        <h2 style="font-size:17px">${selDate.getMonth() + 1}月${selDate.getDate()}日 星期${WEEK[selDate.getDay()]}${sel === today ? '（今天）' : ''}</h2>
        <span class="muted small">農曆 ${esc(lunarDate(selDate).text)}</span>
      </div>
      ${hol || term ? `<div class="chips">${hol ? `<span class="chip red">${esc(hol)}</span>` : ''}${term ? `<span class="chip" style="background:var(--gold-soft);color:var(--gold)">${esc(term)}</span>` : ''}</div>` : ''}
      ${list.length ? `<div class="list">${list.map((e) => `
        <button class="list-row" data-ev="${e.source === 'local' ? e.id : ''}" style="border-left:none;border-right:none;border-top:none;background:none;text-align:left;cursor:${e.source === 'local' ? 'pointer' : 'default'};width:100%;padding:8px 0">
          <div style="width:52px;display:flex;flex-direction:column">
            <b style="font-size:14px">${e.allDay ? '全天' : esc(e.start)}</b>
            ${!e.allDay && e.end ? `<span class="tiny muted">${esc(e.end)}</span>` : ''}
          </div>
          <div class="grow"><div class="ellipsis" style="font-weight:500">${esc(e.title)}</div>${e.place ? `<div class="tiny muted ellipsis">${esc(e.place)}</div>` : ''}</div>
          ${e.source === 'google' ? '<span class="tag google">Google</span>' : e.tag ? `<span class="tag ${e.tag}">${tagName(e.tag)}</span>` : ''}
        </button>`).join('')}</div>`
        : '<div class="card empty">這天沒有行程</div>'}
    </section>
  </div>
  <button class="fab" id="add-ev" aria-label="新增行程">${icon('plus', 24, 2.2)}</button>`;
}

export function mount(root, rerender) {
  root.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => { sel = b.dataset.day; rerender(); }));
  root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    const d = new Date(view.y, view.m + Number(b.dataset.nav), 1);
    view = { y: d.getFullYear(), m: d.getMonth() };
    sel = ymd(d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() ? new Date() : d);
    rerender();
    autoSync(rerender);
  }));
  root.querySelector('#go-today')?.addEventListener('click', () => {
    const t = new Date(); view = { y: t.getFullYear(), m: t.getMonth() }; sel = ymd(t); rerender();
  });
  root.querySelector('#sync')?.addEventListener('click', () => sync(rerender, true));
  root.querySelector('#add-ev').addEventListener('click', () => editEvent(null));
  root.querySelectorAll('[data-ev]').forEach((b) => b.dataset.ev && b.addEventListener('click', () => editEvent(b.dataset.ev)));
  autoSync(rerender);
}

/** Refresh the visible month quietly when we already have a valid token. */
const autoSynced = new Map(); // month key -> time
function autoSync(rerender) {
  const k = `${view.y}-${view.m}`;
  if (!gcal.isConfigured() || !gcal.hasToken() || syncing) return;
  if (Date.now() - (autoSynced.get(k) || 0) < 5 * 60 * 1000) return;
  autoSynced.set(k, Date.now());
  sync(rerender, false);
}

async function sync(rerender, interactive) {
  syncing = true; rerender();
  try {
    if (!gcal.hasToken()) {
      if (!interactive) return;
      await gcal.connect({ silent: true });
    }
    const items = await gcal.fetchMonth(view.y, view.m);
    if (interactive) toast(`已同步 ${items.length} 個 Google 行程`);
  } catch (e) {
    if (interactive) toast(e.message);
  } finally {
    syncing = false; rerender();
  }
}

function editEvent(id) {
  const e = id ? store.get().events.find((x) => x.id === id) : { title: '', date: sel, allDay: false, start: '09:00', end: '10:00', place: '', tag: 'work' };
  if (!e) return;
  openSheet({
    title: id ? '編輯行程' : '新增行程',
    body: `
      <label class="field"><span>標題</span><input class="input" name="title" value="${esc(e.title)}" required placeholder="例如：部門週會"></label>
      <label class="field"><span>日期</span><input class="input" type="date" name="date" value="${esc(e.date)}" required></label>
      <label class="row" style="min-height:44px"><input type="checkbox" name="allDay" ${e.allDay ? 'checked' : ''} style="width:20px;height:20px"> 全天</label>
      <div class="grid2" id="times">
        <label class="field"><span>開始</span><input class="input" type="time" name="start" value="${esc(e.start)}"></label>
        <label class="field"><span>結束</span><input class="input" type="time" name="end" value="${esc(e.end)}"></label>
      </div>
      <label class="field"><span>地點</span><input class="input" name="place" value="${esc(e.place)}"></label>
      <label class="field"><span>分類</span><select class="input" name="tag">${EVENT_TAGS.map((t) => `<option value="${t.id}" ${t.id === e.tag ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>`,
    actions: id ? [{ id: 'delete', label: '刪除', cls: 'danger' }, { id: 'save', label: '儲存', cls: 'primary', submit: true }]
      : [{ id: 'save', label: '新增', cls: 'primary', submit: true }],
    onOpen(form) {
      const sync = () => { form.querySelector('#times').style.display = form.allDay.checked ? 'none' : ''; };
      form.allDay.addEventListener('change', sync); sync();
      if (!id) form.title.focus();
    },
    onAction(action, d) {
      if (action === 'delete') {
        store.update((s) => { s.events = s.events.filter((x) => x.id !== id); });
        toast('已刪除行程'); return true;
      }
      if (!d.title.trim() || !d.date) { toast('請填寫標題與日期'); return false; }
      if (!d.allDay && d.start && d.end && d.end < d.start) { toast('結束時間早於開始時間'); return false; }
      const rec = { title: d.title.trim(), date: d.date, allDay: !!d.allDay, start: d.allDay ? '' : d.start, end: d.allDay ? '' : d.end, place: d.place.trim(), tag: d.tag };
      sel = d.date;
      const dd = parseYmd(d.date); view = { y: dd.getFullYear(), m: dd.getMonth() };
      store.update((s) => {
        if (id) Object.assign(s.events.find((x) => x.id === id), rec);
        else s.events.push({ id: uid(), ...rec });
      });
      return true;
    },
  });
}
