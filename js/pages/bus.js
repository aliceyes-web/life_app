import { store } from '../store.js';
import { esc, icon, uid, hhmm, toast } from '../util.js';
import { BUS_CITIES, cityName, hasKeys, searchRoutes, stopsOfRoute, stopsOfRouteCached, fetchRouteLive, fetchEtas, etaText } from '../bus.js';
import { openSheet } from '../sheet.js';

let etas = new Map();
let updatedAt = null;
let lastError = '';
let editing = false;
let timer = null;
let loading = false;

const REFRESH_MS = 30000;

export function favCard(f, e, { removable = false } = {}) {
  const t = etaText(e);
  const tag = removable ? 'div' : 'a';
  return `
    <${tag} class="bus-row"${removable ? '' : ` href="#/bus/${f.id}" aria-label="${esc(f.routeName)} ${esc(f.stopName)}，查看整條路線"`}>
      <div class="bus-route">${esc(f.routeName)}</div>
      <div class="grow" style="min-width:0">
        <div class="ellipsis" style="font-weight:700">${esc(f.stopName)}</div>
        <div class="tiny muted ellipsis">往 ${esc(f.dest)} · ${cityName(f.city)}</div>
      </div>
      ${removable
        ? `<button class="btn danger" data-remove="${f.id}" style="height:40px;padding:0 12px" aria-label="移除 ${esc(f.routeName)} ${esc(f.stopName)}">移除</button>`
        : `<div class="bus-eta ${t.tone}"><b>${esc(t.big)}</b>${t.unit ? `<span>${t.unit}</span>` : ''}${t.small ? `<div class="tiny">${esc(t.small)}</div>` : ''}</div>`}
    </${tag}>`;
}

export function render() {
  const favs = store.get().busFavs;
  let body;
  if (!hasKeys()) {
    body = `
      <section class="card">
        <div class="card-title">先設定 TDX 金鑰</div>
        <div class="small muted" style="line-height:1.7">公車到站資料來自交通部 TDX 平臺，需要免費註冊會員取得 Client Id 與 Client Secret，再填到 APP 的設定裡。</div>
        <a class="btn primary" href="#/settings">前往設定</a>
      </section>`;
  } else if (!favs.length) {
    body = `
      <section class="card" style="align-items:center;text-align:center;padding:28px 18px">
        ${icon('bus', 40, 1.6)}
        <div class="card-title">還沒有常用站牌</div>
        <div class="small muted">搜尋路線、選擇站牌，就能在這裡看到還有幾分鐘到站。</div>
        <button class="btn primary" id="add-fav">${icon('plus', 18, 2)}新增常用站牌</button>
      </section>`;
  } else {
    body = `
      ${lastError ? `<div class="banner" style="background:var(--red-soft);color:var(--red-text)">${esc(lastError)}</div>` : ''}
      <div class="list">${favs.map((f) => favCard(f, etas.has(f.id) ? etas.get(f.id) : undefined, { removable: editing })).join('')}</div>
      <div class="row" style="justify-content:space-between">
        <span class="tiny muted">${updatedAt ? `更新於 ${hhmm(updatedAt)}:${String(updatedAt.getSeconds()).padStart(2, '0')} · 每 30 秒自動更新` : loading ? '載入中…' : ''}</span>
        <button class="link-btn" id="edit">${editing ? '完成' : '編輯'}</button>
      </div>
      <p class="notice">資料來源：交通部 TDX 運輸資料流通服務平臺。到站時間為系統預估，實際以現場為準。</p>`;
  }
  return `
  <div class="page">
    <header class="topbar">
      <h1 class="page-title">公車</h1>
      ${hasKeys() && favs.length ? `<div class="row">
        <button class="icon-btn" id="refresh" aria-label="重新整理">${icon('refresh', 18, 2)}</button>
        <button class="icon-btn" id="add-fav" aria-label="新增常用站牌">${icon('plus', 20, 2)}</button>
      </div>` : ''}
    </header>
    ${body}
  </div>`;
}

export function mount(root, rerender) {
  root.querySelectorAll('#add-fav').forEach((b) => b.addEventListener('click', () => addFav(rerender)));
  root.querySelector('#refresh')?.addEventListener('click', () => refresh(rerender, true));
  root.querySelector('#edit')?.addEventListener('click', () => { editing = !editing; rerender(); });
  root.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.remove;
    if (store.get().busFavs.length <= 1) editing = false;
    store.update((s) => { s.busFavs = s.busFavs.filter((f) => f.id !== id); });
  }));
  // auto refresh while this page is shown
  clearInterval(timer);
  if (hasKeys() && store.get().busFavs.length) {
    if (!updatedAt || Date.now() - updatedAt > REFRESH_MS) refresh(rerender);
    timer = setInterval(() => {
      if (!root.isConnected || !location.hash.startsWith('#/bus')) { clearInterval(timer); return; }
      if (document.visibilityState === 'visible') refresh(rerender);
    }, REFRESH_MS);
  }
}

export function stop() { clearInterval(timer); }

async function refresh(rerender, manual = false) {
  if (loading) return;
  const favs = store.get().busFavs;
  if (!favs.length) return;
  loading = true;
  try {
    etas = await fetchEtas(favs);
    updatedAt = new Date();
    lastError = '';
  } catch (e) {
    lastError = e.message;
    if (manual) toast(e.message);
  } finally {
    loading = false;
    if (location.hash.startsWith('#/bus')) rerender();
  }
}

/** Shared by the home card */
export async function loadEtas() {
  const favs = store.get().busFavs;
  if (!hasKeys() || !favs.length) return null;
  if (updatedAt && Date.now() - updatedAt < 20000) return etas;
  etas = await fetchEtas(favs);
  updatedAt = new Date();
  return etas;
}

// ---------- add favourite (3 steps in one sheet) ----------
function addFav(rerender) {
  let city = store.getCache('busCity') || 'Taipei';
  let route = null;
  let dirs = [];
  let dirIdx = 0;

  const sheet = openSheet({
    title: '新增常用站牌',
    body: '<div id="bus-step" style="display:flex;flex-direction:column;gap:12px"></div>',
    actions: [],
    onOpen(form) {
      const box = form.querySelector('#bus-step');
      const step1 = (results = null, kw = '', msg = '') => {
        box.innerHTML = `
          <div class="seg" role="group" aria-label="縣市">${BUS_CITIES.map((c) => `<button type="button" data-city="${c.id}" aria-pressed="${c.id === city}">${c.name}</button>`).join('')}</div>
          <div class="row">
            <label class="sr-only" for="kw">路線名稱</label>
            <input class="input" id="kw" placeholder="輸入路線，例如 307、紅33" value="${esc(kw)}" enterkeyhint="search" autocomplete="off" style="flex:1">
            <button type="button" class="pill-btn" id="go" style="height:48px;border-radius:14px">搜尋</button>
          </div>
          ${msg ? `<div class="small ${msg.startsWith('!') ? 'error-text' : 'muted'}">${esc(msg.replace(/^!/, ''))}</div>` : ''}
          ${results ? (results.length ? `<div class="list" style="max-height:52vh;overflow:auto">${results.map((r, i) => `
            <button type="button" class="list-row" data-route="${i}" style="border-left:none;border-right:none;border-top:none;background:none;width:100%;text-align:left;cursor:pointer;color:var(--text)">
              <span class="bus-route">${esc(r.name)}</span>
              <span class="grow small muted ellipsis">${esc(r.from)} — ${esc(r.to)}</span>${icon('next', 16, 2)}
            </button>`).join('')}</div>` : '<div class="empty">找不到這條路線，試試其他縣市</div>') : ''}`;
        const kwInput = box.querySelector('#kw');
        box.querySelectorAll('[data-city]').forEach((b) => b.addEventListener('click', () => {
          city = b.dataset.city; store.setCache('busCity', city);
          if (kwInput.value.trim()) search(kwInput.value.trim()); else step1(null, '');
        }));
        const search = async (k) => {
          step1(null, k, '搜尋中…');
          try { const res = await searchRoutes(city, k); step1(res, k); }
          catch (e) { step1(null, k, '!' + e.message); }
        };
        box.querySelector('#go').addEventListener('click', () => kwInput.value.trim() && search(kwInput.value.trim()));
        kwInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); if (kwInput.value.trim()) search(kwInput.value.trim()); } });
        box.querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => pickRoute(results[Number(b.dataset.route)], kw)));
        if (!results) kwInput.focus();
      };

      const pickRoute = async (r, kw) => {
        route = r;
        box.innerHTML = '<div class="empty">載入站牌中…</div>';
        try { dirs = await stopsOfRoute(city, r.uid); }
        catch (e) { step1(null, kw, '!' + e.message); return; }
        if (!dirs.length) { step1(null, kw, '!這條路線沒有站牌資料'); return; }
        dirIdx = 0;
        step2(kw);
      };

      const destOf = (d) => (d.stops.length ? d.stops[d.stops.length - 1].name : '');
      const step2 = (kw) => {
        const d = dirs[dirIdx];
        box.innerHTML = `
          <div class="row"><button type="button" class="icon-btn" id="back" aria-label="回到搜尋">${icon('back', 18, 2)}</button>
            <span class="bus-route">${esc(route.name)}</span><span class="small muted">${cityName(city)}</span></div>
          ${dirs.length > 1 ? `<div class="seg" role="group" aria-label="方向">${dirs.map((x, i) => `<button type="button" data-dir="${i}" aria-pressed="${i === dirIdx}" class="ellipsis">往 ${esc(destOf(x))}</button>`).join('')}</div>` : `<div class="small muted">往 ${esc(destOf(d))}</div>`}
          <div class="small muted">選擇你要上車的站牌</div>
          <div class="list" style="max-height:50vh;overflow:auto">${d.stops.map((s, i) => `
            <button type="button" class="list-row" data-stop="${i}" style="border-left:none;border-right:none;border-top:none;background:none;width:100%;text-align:left;cursor:pointer;color:var(--text);min-height:48px">
              <span class="tiny muted" style="width:22px;text-align:right">${i + 1}</span><span class="grow">${esc(s.name)}</span>${icon('plus', 16, 2)}
            </button>`).join('')}</div>`;
        box.querySelector('#back').addEventListener('click', () => step1(null, kw));
        box.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => { dirIdx = Number(b.dataset.dir); step2(kw); }));
        box.querySelectorAll('[data-stop]').forEach((b) => b.addEventListener('click', () => {
          const s = d.stops[Number(b.dataset.stop)];
          const dup = store.get().busFavs.some((f) => f.routeUID === route.uid && f.stopUID === s.uid);
          if (dup) { toast('這個站牌已經在常用清單裡'); return; }
          updatedAt = null;
          store.update((st) => st.busFavs.push({
            id: uid(), city, routeUID: route.uid, routeName: route.name, direction: d.direction,
            dest: destOf(d), stopUID: s.uid, stopName: s.name,
          }));
          toast(`已加入：${route.name} ${s.name}`);
          sheet.close();
        }));
      };

      step1();
    },
  });
}

// ---------- 整條路線即時動態 ----------
let rv = { favId: null, dirIdx: 0, dirs: null, live: null, at: null, err: '', loading: false };
let rTimer = null;
const ROUTE_REFRESH_MS = 20000;

export function renderRoute(favId) {
  const f = store.get().busFavs.find((x) => x.id === favId);
  if (!f) return '<div class="page"><a class="icon-btn" href="#/bus" aria-label="返回">‹</a><div class="card empty">找不到這個站牌</div></div>';
  if (rv.favId !== favId) rv = { favId, dirIdx: -1, dirs: null, live: null, at: null, err: '', loading: false };
  const dirs = rv.dirs;
  const d = dirs ? dirs[rv.dirIdx] : null;
  const destOf = (x) => (x.stops.length ? x.stops[x.stops.length - 1].name : '');
  let list = '<div class="card empty">載入路線中…</div>';
  if (rv.err && !d) list = `<div class="card"><div class="error-text">${esc(rv.err)}</div><button class="btn" id="r-retry">重試</button></div>`;
  if (d) {
    list = `<ol class="route-line">${d.stops.map((s) => {
      const e = rv.live ? (rv.live.eta.get(s.uid) ?? null) : undefined;
      const t = etaText(e);
      const buses = rv.live?.buses.get(s.uid) || [];
      const mine = s.uid === f.stopUID;
      return `<li class="rl-stop ${mine ? 'mine' : ''} ${buses.length ? 'has-bus' : ''}" ${mine ? 'id="my-stop"' : ''}>
        <span class="rl-eta ${t.tone}">${esc(t.big)}${t.unit || ''}</span>
        <span class="rl-dot" aria-hidden="true"></span>
        <span class="rl-name">${esc(s.name)}${mine ? ' <span class="chip main" style="font-size:11px;padding:1px 8px">常用</span>' : ''}</span>
        ${buses.length ? `<span class="rl-bus">${icon('bus', 14, 2)}${esc(buses.map((b) => b.plate).join('、'))}</span>` : ''}
      </li>`;
    }).join('')}</ol>`;
  }
  return `
  <div class="page">
    <header class="topbar">
      <div class="row" style="min-width:0">
        <a class="icon-btn" href="#/bus" aria-label="返回公車">${icon('back', 18, 2)}</a>
        <span class="bus-route">${esc(f.routeName)}</span>
        <span class="small muted ellipsis">${cityName(f.city)}</span>
      </div>
      <button class="icon-btn" id="r-refresh" aria-label="重新整理">${icon('refresh', 18, 2)}</button>
    </header>
    ${dirs && dirs.length > 1 ? `<div class="seg" role="group" aria-label="方向">${dirs.map((x, i) => `<button data-rdir="${i}" aria-pressed="${i === rv.dirIdx}" class="ellipsis">往 ${esc(destOf(x))}</button>`).join('')}</div>` : d ? `<div class="small muted">往 ${esc(destOf(d))}</div>` : ''}
    ${rv.err && d ? `<div class="banner" style="background:var(--red-soft);color:var(--red-text)">${esc(rv.err)}</div>` : ''}
    ${list}
    ${d ? `<div class="tiny muted">${rv.at ? `更新於 ${hhmm(rv.at)}:${String(rv.at.getSeconds()).padStart(2, '0')} · 每 20 秒自動更新` : '更新中…'}</div>` : ''}
  </div>`;
}

export function mountRoute(root, favId, rerender) {
  const f = store.get().busFavs.find((x) => x.id === favId);
  if (!f) return;
  const scrollToMine = () => root.querySelector('#my-stop')?.scrollIntoView({ block: 'center' });
  const loadLive = async (manual) => {
    if (rv.loading || !rv.dirs) return;
    rv.loading = true;
    const d = rv.dirs[rv.dirIdx];
    try { rv.live = await fetchRouteLive(f.city, f.routeUID, d.direction); rv.at = new Date(); rv.err = ''; }
    catch (e) { rv.err = e.message; if (manual) toast(e.message); }
    finally { rv.loading = false; if (location.hash === `#/bus/${favId}`) rerender(); }
  };
  const init = async () => {
    try {
      rv.dirs = await stopsOfRouteCached(f.city, f.routeUID);
      const i = rv.dirs.findIndex((x) => x.direction === f.direction);
      rv.dirIdx = i >= 0 ? i : 0;
      rv.err = '';
    } catch (e) { rv.err = e.message; }
    if (location.hash !== `#/bus/${favId}`) return;
    rerender();
    requestAnimationFrame(scrollToMine);
    loadLive();
  };
  if (!rv.dirs) init();
  root.querySelector('#r-retry')?.addEventListener('click', () => { rv.err = ''; rerender(); init(); });
  root.querySelector('#r-refresh')?.addEventListener('click', () => loadLive(true));
  root.querySelectorAll('[data-rdir]').forEach((b) => b.addEventListener('click', () => {
    rv.dirIdx = Number(b.dataset.rdir); rv.live = null; rv.at = null; rerender(); loadLive(true);
  }));
  clearInterval(rTimer);
  rTimer = setInterval(() => {
    if (location.hash !== `#/bus/${favId}`) { clearInterval(rTimer); return; }
    if (document.visibilityState === 'visible') loadLive();
  }, ROUTE_REFRESH_MS);
}

export function stopRoute() { clearInterval(rTimer); rv.favId = null; }
