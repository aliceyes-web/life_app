// 公車到站時間：交通部 TDX 運輸資料流通服務平臺 https://tdx.transportdata.tw/
import { store } from './store.js';

export const BUS_CITIES = [
  { id: 'Taipei', name: '台北市' },
  { id: 'NewTaipei', name: '新北市' },
  { id: 'Keelung', name: '基隆市' },
  { id: 'InterCity', name: '公路客運' }, // 1xxx、9xxx 等跨縣市路線
];
/** TDX path segment: 市區公車 /City/{City}；公路客運 /InterCity */
const area = (city) => (city === 'InterCity' ? '/InterCity' : `/City/${city}`);
export const cityName = (id) => (BUS_CITIES.find((c) => c.id === id) || { name: id }).name;

const TOKEN_URL = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
const API = 'https://tdx.transportdata.tw/api/basic/v2/Bus';

export const hasKeys = () => {
  const s = store.settings();
  return !!(s.tdxId && s.tdxSecret);
};

let tokenPromise = null;
function getToken(force = false) {
  // share one in-flight request when several searches start at once
  if (!tokenPromise || force) tokenPromise = fetchToken(force).finally(() => { tokenPromise = null; });
  return tokenPromise;
}

async function fetchToken(force = false) {
  const s = store.settings();
  if (!s.tdxId || !s.tdxSecret) throw Object.assign(new Error('請先在「設定 › 公車」填入 TDX 金鑰'), { code: 'NO_KEY' });
  const c = store.getCache('tdxToken');
  if (!force && c && c.id === s.tdxId && c.exp > Date.now() + 60000) return c.token;
  let r;
  try {
    r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: s.tdxId, client_secret: s.tdxSecret }),
    });
  } catch {
    throw new Error('連不到 TDX，請確認網路');
  }
  if (r.status === 400 || r.status === 401) throw Object.assign(new Error('TDX 金鑰不正確，請到設定檢查 Client Id 與 Client Secret'), { code: 'BAD_KEY' });
  if (!r.ok) throw new Error(`TDX 登入失敗（${r.status}）`);
  const j = await r.json();
  store.setCache('tdxToken', { id: s.tdxId, token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 86400) * 1000 });
  return j.access_token;
}

async function api(path, params = {}) {
  const qs = Object.entries({ ...params, $format: 'JSON' })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const url = `${API}${path}?${qs}`;
  const call = async (token) => {
    try { return await fetch(url, { headers: { authorization: `Bearer ${token}` } }); }
    catch { throw new Error('連不到 TDX，請確認網路'); }
  };
  let r = await call(await getToken());
  if (r.status === 401) r = await call(await getToken(true));
  if (r.status === 429) throw new Error('查詢太頻繁，請稍後再試');
  if (!r.ok) throw new Error(`TDX 回應錯誤（${r.status}）`);
  return r.json();
}

const q = (s) => String(s).replace(/'/g, "''"); // OData string escaping

/** 一次搜尋北北基市區公車與公路客運，回傳 [{uid,name,from,to,city}] */
export async function searchAllRoutes(keyword) {
  const results = await Promise.allSettled(BUS_CITIES.map((c) => searchRoutes(c.id, keyword).then((list) => list.map((r) => ({ ...r, city: c.id })))));
  const ok = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
  if (!ok.length) {
    const err = results.find((r) => r.status === 'rejected');
    if (err) throw err.reason;
  }
  // 雙北聯營路線會同時出現在台北市與新北市，以 RouteUID 去重
  const seen = new Set();
  const list = ok.filter((r) => (seen.has(r.uid) ? false : seen.add(r.uid)));
  const rank = (r) => (r.name === keyword ? 0 : r.name.startsWith(keyword) ? 1 : 2);
  return list.sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length || a.name.localeCompare(b.name, 'zh-Hant'));
}

/** 搜尋路線（名稱包含關鍵字） */
export async function searchRoutes(city, keyword) {
  const list = await api(`/Route${area(city)}`, {
    $filter: `contains(RouteName/Zh_tw,'${q(keyword)}')`,
    $select: 'RouteUID,RouteName,DepartureStopNameZh,DestinationStopNameZh',
    $top: '40',
  });
  return list
    .map((r) => ({ uid: r.RouteUID, name: r.RouteName?.Zh_tw || '', from: r.DepartureStopNameZh || '', to: r.DestinationStopNameZh || '' }))
    .sort((a, b) => (a.name === keyword ? -1 : b.name === keyword ? 1 : a.name.length - b.name.length || a.name.localeCompare(b.name, 'zh-Hant')));
}

/** 路線的去返程站序：[{direction, stops:[{uid,name,seq}]}] */
export async function stopsOfRoute(city, routeUID) {
  const list = await api(`/StopOfRoute${area(city)}`, { $filter: `RouteUID eq '${q(routeUID)}'` });
  const byDir = new Map();
  for (const sub of list) {
    // a route may have several sub-routes per direction; keep the longest one
    const d = sub.Direction ?? 0;
    const stops = (sub.Stops || []).map((s) => ({ uid: s.StopUID, name: s.StopName?.Zh_tw || '', seq: s.StopSequence }))
      .sort((a, b) => a.seq - b.seq);
    if (!byDir.has(d) || byDir.get(d).length < stops.length) byDir.set(d, stops);
  }
  return [...byDir.entries()].sort((a, b) => a[0] - b[0]).map(([direction, stops]) => ({ direction, stops }));
}

/** 取得收藏站牌的預估到站。回傳 Map(favId -> {sec, status, next, plate}) */
export async function fetchEtas(favs) {
  const out = new Map();
  const byCity = new Map();
  for (const f of favs) {
    if (!byCity.has(f.city)) byCity.set(f.city, []);
    byCity.get(f.city).push(f);
  }
  await Promise.all([...byCity.entries()].map(async ([city, list]) => {
    const filter = list.map((f) => `(RouteUID eq '${q(f.routeUID)}' and StopUID eq '${q(f.stopUID)}')`).join(' or ');
    const rows = await api(`/EstimatedTimeOfArrival${area(city)}`, {
      $filter: filter,
      $select: 'RouteUID,StopUID,Direction,EstimateTime,StopStatus,NextBusTime,PlateNumb',
    });
    for (const f of list) {
      const mine = rows.filter((r) => r.RouteUID === f.routeUID && r.StopUID === f.stopUID && (r.Direction == null || r.Direction === f.direction));
      if (!mine.length) { out.set(f.id, null); continue; }
      const running = mine.filter((r) => r.EstimateTime != null).sort((a, b) => a.EstimateTime - b.EstimateTime);
      const best = running[0] || mine[0];
      out.set(f.id, { sec: best.EstimateTime ?? null, status: best.StopStatus ?? 0, next: best.NextBusTime || null, plate: best.PlateNumb || '' });
    }
  }));
  return out;
}

/** 轉成顯示文字：{ big, small, tone } tone: soon | normal | off */
export function etaText(e) {
  if (e === undefined) return { big: '…', small: '', tone: 'normal' };
  if (e === null) return { big: '—', small: '暫無資料', tone: 'off' };
  if (e.sec != null) {
    if (e.sec < 60) return { big: '進站中', small: '', tone: 'soon' };
    const m = Math.floor(e.sec / 60);
    return { big: `${m}`, unit: '分', small: m <= 3 ? '即將到站' : '', tone: m <= 3 ? 'soon' : 'normal' };
  }
  const hm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  switch (e.status) {
    case 1: return { big: e.next ? hm(e.next) : '未發車', small: e.next ? '預計發車' : '尚未發車', tone: 'off' };
    case 2: return { big: '不停靠', small: '交管不停靠', tone: 'off' };
    case 3: return { big: '末班駛離', small: '今日末班已過', tone: 'off' };
    case 4: return { big: '未營運', small: '今日未營運', tone: 'off' };
    default: return { big: '—', small: '暫無資料', tone: 'off' };
  }
}

// ---------- 整條路線即時動態 ----------
const stopsMemo = new Map();
/** stopsOfRoute with a 1-day cache (stop lists rarely change) */
export async function stopsOfRouteCached(city, routeUID) {
  const key = `${city}|${routeUID}`;
  if (stopsMemo.has(key)) return stopsMemo.get(key);
  const all = store.getCache('busStops') || {};
  const c = all[key];
  if (c && Date.now() - c.at < 86400000) { stopsMemo.set(key, c.dirs); return c.dirs; }
  const dirs = await stopsOfRoute(city, routeUID);
  stopsMemo.set(key, dirs);
  // keep at most 20 routes in storage
  const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at).slice(0, 19);
  const next = {}; for (const k of keys) next[k] = all[k];
  next[key] = { at: Date.now(), dirs };
  store.setCache('busStops', next);
  return dirs;
}

/** 整條路線某方向的預估到站與公車位置 */
export async function fetchRouteLive(city, routeUID, direction) {
  const f = `RouteUID eq '${q(routeUID)}' and Direction eq ${Number(direction)}`;
  const [etaRows, nearRows] = await Promise.all([
    api(`/EstimatedTimeOfArrival${area(city)}`, { $filter: f, $select: 'StopUID,EstimateTime,StopStatus,NextBusTime,PlateNumb' }),
    api(`/RealTimeNearStop${area(city)}`, { $filter: f, $select: 'PlateNumb,StopUID,StopSequence,A2EventType' }).catch(() => []),
  ]);
  const eta = new Map();
  for (const r of etaRows) {
    const cur = eta.get(r.StopUID);
    const rec = { sec: r.EstimateTime ?? null, status: r.StopStatus ?? 0, next: r.NextBusTime || null, plate: r.PlateNumb || '' };
    if (!cur || (rec.sec != null && (cur.sec == null || rec.sec < cur.sec))) eta.set(r.StopUID, rec);
  }
  const buses = new Map(); // stopUID -> [{plate, arriving}]
  for (const b of nearRows) {
    if (!b.StopUID) continue;
    if (!buses.has(b.StopUID)) buses.set(b.StopUID, []);
    buses.get(b.StopUID).push({ plate: b.PlateNumb || '', arriving: b.A2EventType === 1 });
  }
  return { eta, buses };
}
