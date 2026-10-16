import { store } from '../store.js';
import { esc, icon, ymd, md, shortTime } from '../util.js';
import { lunarDate, nextTerm, termLabel, dayType, holidayName, nextHoliday, weekName } from '../almanac.js';
import { getWeather, summarize, wxIcon } from '../weather.js';
import { eventsOn } from '../events.js';
import { noteTagClass } from './notes.js';

function greeting(name) {
  const h = new Date().getHours();
  const hi = h < 5 ? '夜深了' : h < 11 ? '早安' : h < 14 ? '午安' : h < 18 ? '午安' : '晚安';
  return name ? `${hi}，${esc(name)}` : hi;
}

export function render() {
  const s = store.settings();
  const now = new Date();
  const key = ymd(now);
  const lunar = lunarDate(now);
  const term = nextTerm(now);
  const type = dayType(now);
  const hol = holidayName(now);
  const next = nextHoliday(now);
  const events = eventsOn(key);
  const notes = [...store.get().notes].sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt)).slice(0, 2);

  const bannerText = `${greeting(s.name)}！` + (events.length ? `今天有 ${events.length} 個行程。` : '今天沒有安排，好好過一天。');

  const typeChip = hol
    ? `<span class="chip red">${esc(hol)}</span>`
    : type === 'weekend' ? '<span class="chip main">休息日</span>'
    : type === 'makeup' ? '<span class="chip warm">補班日</span>'
    : '<span class="chip warm">上班日</span>';
  const nextChip = next && next.days <= 60
    ? `<span class="chip red">假日：${md(next.date)} ${esc(next.name)}（${next.days === 1 ? '明天' : `${next.days} 天後`}）</span>` : '';

  return `
  <div class="page">
    <header class="topbar">
      <div class="brand">${icon('leaf', 26)}<h1 style="font-size:inherit">生活小幫手</h1></div>
      <div class="row">
        <a class="pill-btn" href="#/carrier" aria-label="載具條碼">${icon('barcode', 18)}載具</a>
        <a class="icon-btn" href="#/settings" aria-label="設定">${icon('gear', 20)}</a>
      </div>
    </header>

    <div class="banner">${bannerText}</div>

    <section class="card" aria-label="今天">
      <div class="card-head"><span class="card-title" style="font-size:16px">今天</span><span class="muted small">${now.getFullYear()} / ${now.getMonth() + 1}</span></div>
      <div class="date-main">
        <div class="date-num">${now.getDate()}</div>
        <div style="display:flex;flex-direction:column;gap:3px">
          <div class="date-week">${weekName(now)}</div>
          <div class="muted">農曆 ${esc(lunar.text)}</div>
          ${term ? `<div class="term">${icon('drop', 14, 2)}${esc(termLabel(term))}</div>` : ''}
        </div>
      </div>
      <div class="chips">${typeChip}${nextChip}</div>
    </section>

    <a class="card wx-card" href="#/weather" id="home-wx" aria-label="天氣">
      <div class="muted small">天氣載入中…</div>
    </a>

    <section class="card">
      <div class="card-head"><h2 class="card-title">今日行程</h2><a class="link-btn" href="#/calendar">查看全部</a></div>
      ${events.length ? `<div>${events.slice(0, 4).map((e) => `
        <div class="event-row">
          <div class="event-time">${e.allDay ? '全天' : esc(e.start)}</div>
          <div class="grow" style="flex:1;min-width:0">
            <div class="ellipsis" style="font-weight:500">${esc(e.title)}</div>
            ${e.place || e.end ? `<div class="muted tiny ellipsis">${esc([e.place, e.end && `到 ${e.end}`].filter(Boolean).join(' · '))}</div>` : ''}
          </div>
          <span class="dot ${e.tag === 'personal' ? 'warm' : e.source === 'google' ? 'gray' : ''}"></span>
        </div>`).join('')}${events.length > 4 ? `<div class="muted small" style="padding-top:8px">還有 ${events.length - 4} 個行程</div>` : ''}</div>`
        : '<div class="empty">今天沒有行程</div>'}
    </section>


    <section style="display:flex;flex-direction:column;gap:10px">
      <div class="card-head"><h2 class="card-title">最近記事</h2><a class="link-btn" href="#/notes">全部記事</a></div>
      ${notes.length ? `<div class="grid2">${notes.map((n) => `
        <a class="note ${noteTagClass(n.tag)}" href="#/notes/${n.id}">
          <div style="font-weight:700" class="ellipsis">${esc(n.title || '未命名')}</div>
          <div class="body" style="-webkit-line-clamp:3">${esc(n.body)}</div>
          <div class="tiny muted">${shortTime(n.updatedAt)}</div>
        </a>`).join('')}</div>` : '<div class="card empty">還沒有記事</div>'}
    </section>
  </div>`;
}

export function mount(root) {
  const box = root.querySelector('#home-wx');
  const paint = (w) => {
    box.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="muted small row" style="gap:4px">${icon('pin', 14, 2)}${esc(w.city)}</div>
        <div class="wx-temp">${w.temp}°</div>
        <div class="muted small">${esc(w.text)} · 高 ${w.today.hi}° 低 ${w.today.lo}°</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;color:var(--muted)">
        ${wxIcon(w.kind, 64)}
        <span class="chip main">降雨機率 ${w.today.rain}%</span>
      </div>`;
  };
  getWeather().then((d) => box.isConnected && paint(summarize(d))).catch(() => {
    const c = store.getCache('weather');
    if (c && box.isConnected) paint(summarize(c));
    else if (box.isConnected) box.innerHTML = '<div class="muted small">目前無法取得天氣，點此重試</div>';
  });
}
