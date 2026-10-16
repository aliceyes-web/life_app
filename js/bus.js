// 公車到站時間：交通部 TDX 運輸資料流通服務平臺 https://tdx.transportdata.tw/
import { store } from './store.js';

export const BUS_CITIES = [
  { id: 'Taipei', name: '台北市' },
  { id: 'NewTaipei', name: '新北市' },
  { id: 'Keelung', name: '基隆市' },
];
export const cityName = (id) => (BUS_CITIES.find((c) => c.id === id) || { name: id }).name;

const TOKEN_URL = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
const API = 'https://tdx.transportdata.tw/api/basic/v2/Bus';

export const hasKeys = () => {
  const s = store.settings();
  return !!(s.tdxId && s.tdxSecret);
};

async function getToken(force = false) {
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

/** 搜尋路線（名稱包含關鍵字） */
export async function searchRoutes(city, keyword) {
  const list = await api(`/Route/City/${city}`, {
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
  const list = await api(`/StopOfRoute/City/${city}`, { $filter: `RouteUID eq '${q(routeUID)}'` });
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
    const rows = await api(`/EstimatedTimeOfArrival/City/${city}`, {
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
