import { store } from '../store.js';
import { esc, icon, hhmm, toast, WEEK } from '../util.js';
import { getWeather, summarize, wxIcon, uvLabel, aqiLabel, CITIES } from '../weather.js';
import { openSheet } from '../sheet.js';

export function render() {
  const city = store.settings().city;
  return `
  <div class="page">
    <header class="topbar">
      <button class="btn" id="city" style="height:44px;border-radius:22px">${icon('pin', 16, 2)}${esc(city.name)}${icon('down', 14, 2)}</button>
      <button class="icon-btn" id="refresh" aria-label="重新整理">${icon('refresh', 18, 2)}</button>
    </header>
    <div id="wx"><div class="card empty">天氣載入中…</div></div>
  </div>`;
}

function body(w) {
  const MIN = Math.min(...w.days.map((d) => d.lo)) - 1;
  const MAX = Math.max(...w.days.map((d) => d.hi)) + 1;
  const span = Math.max(1, MAX - MIN);
  const dayName = (d, i) => (i === 0 ? '今天' : '週' + WEEK[new Date(d.date + 'T00:00:00').getDay()]);
  return `
    <div class="muted small" style="text-align:right;margin-top:-8px">更新於 ${hhmm(w.updated)} · Open-Meteo</div>
    <section class="wx-hero" style="color:var(--muted)">
      ${wxIcon(w.kind, 92)}
      <div class="big" style="color:var(--text)">${w.temp}°</div>
      <div style="font-size:17px;font-weight:500;color:var(--text)">${esc(w.text)}</div>
      <div class="small">高 ${w.today.hi}° · 低 ${w.today.lo}° · 體感 ${w.feels}°</div>
    </section>
    ${w.tip ? `<div class="banner row" style="gap:12px">${icon('umbrella', 26)}<span>${esc(w.tip)}</span></div>` : ''}
    <section class="card" style="padding:16px 12px">
      <div class="muted small" style="padding:0 6px">逐時預報</div>
      <div class="hours">${w.hours.map((h, i) => `
        <div class="hour ${i === 0 ? 'now' : ''}" style="${i === 0 ? '' : 'color:var(--text)'}">
          <div class="tiny">${h.label}</div>
          <div style="color:${i === 0 ? 'inherit' : 'var(--muted)'}">${wxIcon(h.kind, 22)}</div>
          <div style="font-weight:700">${h.temp}°</div>
          <div class="rain">${h.rain}%</div>
        </div>`).join('')}</div>
    </section>
    <section class="card" style="gap:0">
      <div class="muted small" style="margin-bottom:4px">未來一週</div>
      ${w.days.map((d, i) => `
        <div class="day-row">
          <div style="width:40px;font-weight:500">${dayName(d, i)}</div>
          <div style="width:30px;color:var(--muted)">${wxIcon(d.kind, 22)}</div>
          <div class="tiny" style="width:36px;color:var(--main)">${d.rain}%</div>
          <div class="muted small" style="width:28px;text-align:right">${d.lo}°</div>
          <div class="range"><i style="left:${((d.lo - MIN) / span) * 100}%;width:${((d.hi - d.lo) / span) * 100}%"></i></div>
          <div style="width:30px;font-weight:700;font-size:14px">${d.hi}°</div>
        </div>`).join('')}
    </section>
    <div class="grid2">
      <div class="stat"><span class="tiny muted">濕度</span><b>${w.humidity}%</b><span class="tiny muted">體感 ${w.feels}°</span></div>
      <div class="stat"><span class="tiny muted">紫外線</span><b>${w.today.uv != null ? Math.round(w.today.uv) : '—'}</b><span class="tiny" style="color:var(--warm-text)">${uvLabel(w.today.uv)}</span></div>
      <div class="stat"><span class="tiny muted">空氣品質 AQI</span><b>${w.aqi ?? '—'}</b><span class="tiny" style="color:var(--main)">${aqiLabel(w.aqi)}</span></div>
      <div class="stat"><span class="tiny muted">日出 / 日落</span><b style="font-size:19px">${w.today.sunrise || '—'} / ${w.today.sunset || '—'}</b><span class="tiny muted">降雨機率 ${w.today.rain}%</span></div>
    </div>
    <p class="notice">預報資料來自 Open-Meteo 國際氣象模式，可能和中央氣象署官方預報略有差異；颱風、豪雨等警特報請以氣象署為準。</p>`;
}

export function mount(root) {
  const box = root.querySelector('#wx');
  const load = (force) => getWeather({ force }).then((d) => { if (box.isConnected) box.innerHTML = body(summarize(d)); }).catch((e) => {
    const c = store.getCache('weather');
    if (c && box.isConnected) { box.innerHTML = body(summarize(c)); toast('離線中，顯示上次的天氣'); }
    else if (box.isConnected) box.innerHTML = `<div class="card"><div class="error-text">無法取得天氣：${esc(e.message)}</div><button class="btn" id="retry">重試</button></div>`;
    box.querySelector('#retry')?.addEventListener('click', () => load(true));
  });
  box.style.display = 'flex'; box.style.flexDirection = 'column'; box.style.gap = '16px';
  load(false);
  root.querySelector('#refresh').addEventListener('click', () => { box.innerHTML = '<div class="card empty">更新中…</div>'; load(true); });
  root.querySelector('#city').addEventListener('click', pickCity);
}

function pickCity() {
  const cur = store.settings().city.name;
  openSheet({
    title: '選擇地區',
    body: `
      <button type="button" class="btn block" id="geo">${icon('locate', 18, 2)}使用目前位置</button>
      <label class="field"><span>縣市</span>
        <select class="input" name="city">${CITIES.map((c) => `<option ${c.name === cur ? 'selected' : ''}>${c.name}</option>`).join('')}</select></label>`,
    actions: [{ id: 'ok', label: '確定', cls: 'primary', submit: true }],
    onOpen(form) {
      form.querySelector('#geo').addEventListener('click', () => {
        if (!navigator.geolocation) { toast('這個瀏覽器不支援定位'); return; }
        navigator.geolocation.getCurrentPosition((pos) => {
          store.setSettings({ city: { name: '目前位置', lat: pos.coords.latitude, lon: pos.coords.longitude } });
          form.closest('dialog').close(); form.closest('dialog').remove();
        }, () => toast('無法取得位置，請確認定位權限'), { timeout: 10000 });
      });
    },
    onAction(_, data) {
      const c = CITIES.find((x) => x.name === data.city);
      if (c) store.setSettings({ city: { ...c } });
      return true;
    },
  });
}
