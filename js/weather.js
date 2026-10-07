// 天氣資料：Open-Meteo（免費、免金鑰）。https://open-meteo.com/
import { store } from './store.js';

export const CITIES = [
  { name: '台北市', lat: 25.0375, lon: 121.5637 },
  { name: '新北市', lat: 25.0120, lon: 121.4657 },
  { name: '基隆市', lat: 25.1283, lon: 121.7419 },
  { name: '桃園市', lat: 24.9937, lon: 121.3010 },
  { name: '新竹市', lat: 24.8039, lon: 120.9647 },
  { name: '苗栗縣', lat: 24.5602, lon: 120.8214 },
  { name: '台中市', lat: 24.1477, lon: 120.6736 },
  { name: '彰化縣', lat: 24.0809, lon: 120.5385 },
  { name: '南投縣', lat: 23.9096, lon: 120.6847 },
  { name: '雲林縣', lat: 23.7092, lon: 120.4313 },
  { name: '嘉義市', lat: 23.4801, lon: 120.4491 },
  { name: '台南市', lat: 22.9999, lon: 120.2270 },
  { name: '高雄市', lat: 22.6273, lon: 120.3014 },
  { name: '屏東縣', lat: 22.6690, lon: 120.4862 },
  { name: '宜蘭縣', lat: 24.7570, lon: 121.7533 },
  { name: '花蓮縣', lat: 23.9911, lon: 121.6114 },
  { name: '台東縣', lat: 22.7583, lon: 121.1444 },
  { name: '澎湖縣', lat: 23.5655, lon: 119.5793 },
  { name: '金門縣', lat: 24.4320, lon: 118.3171 },
  { name: '連江縣', lat: 26.1608, lon: 119.9497 },
];

// WMO weather codes → 中文 + icon kind
export function describe(code, isDay = 1) {
  const c = Number(code);
  if (c === 0) return { text: isDay ? '晴' : '晴朗', kind: isDay ? 'sun' : 'moon' };
  if (c === 1) return { text: '晴時多雲', kind: isDay ? 'partly' : 'moon' };
  if (c === 2) return { text: '多雲', kind: 'partly' };
  if (c === 3) return { text: '陰', kind: 'cloud' };
  if (c === 45 || c === 48) return { text: '有霧', kind: 'fog' };
  if (c >= 51 && c <= 57) return { text: '毛毛雨', kind: 'rain' };
  if (c >= 61 && c <= 67) return { text: c >= 65 ? '大雨' : '雨', kind: 'rain' };
  if (c >= 71 && c <= 77) return { text: '下雪', kind: 'snow' };
  if (c >= 80 && c <= 82) return { text: '陣雨', kind: 'rain' };
  if (c >= 85 && c <= 86) return { text: '陣雪', kind: 'snow' };
  if (c >= 95) return { text: '雷雨', kind: 'storm' };
  return { text: '—', kind: 'cloud' };
}

const SUN = '#D08A3A';
export function wxIcon(kind, size = 64) {
  const cloud = (fill) => `<path d="M8 20h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.3A2.9 2.9 0 0 0 8 20z" stroke="currentColor" stroke-width="1.5" fill="${fill}"/>`;
  const body = {
    sun: `<circle cx="12" cy="12" r="4.2" stroke="${SUN}" stroke-width="1.6"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" stroke="${SUN}" stroke-width="1.6"/>`,
    moon: `<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" stroke="${SUN}" stroke-width="1.6"/>`,
    partly: `<circle cx="9" cy="8" r="3.2" stroke="${SUN}" stroke-width="1.5"/><path d="M9 2.5v1M3.5 8h1M5.1 4.1l.7.7M12.9 4.1l-.7.7" stroke="${SUN}" stroke-width="1.5"/>${cloud('var(--card)')}`,
    cloud: cloud('var(--card)'),
    fog: `${cloud('var(--card)')}<path d="M4 22h12" stroke="currentColor" stroke-width="1.5"/>`,
    rain: `<path d="M7 16h10a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.3A2.9 2.9 0 0 0 7 16z" stroke="currentColor" stroke-width="1.5" fill="var(--card)"/><path d="M9 18.5l-1 2.5M13 18.5l-1 2.5M17 18.5l-1 2.5" stroke="#4A7FB0" stroke-width="1.6"/>`,
    storm: `<path d="M7 15h10a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.3A2.9 2.9 0 0 0 7 15z" stroke="currentColor" stroke-width="1.5" fill="var(--card)"/><path d="M12.5 15.5 10.5 19h3l-2 3.5" stroke="${SUN}" stroke-width="1.6"/>`,
    snow: `${cloud('var(--card)')}<path d="M9 22v.1M13 22v.1" stroke="currentColor" stroke-width="2"/>`,
  }[kind] || cloud('var(--card)');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

const TTL = 30 * 60 * 1000;

export async function getWeather({ force = false } = {}) {
  const city = store.settings().city;
  const key = `${city.lat.toFixed(3)},${city.lon.toFixed(3)}`;
  const cached = store.getCache('weather');
  if (!force && cached && cached.key === key && Date.now() - cached.at < TTL) return cached;

  const p = new URLSearchParams({
    latitude: city.lat, longitude: city.lon, timezone: 'Asia/Taipei', forecast_days: '7',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,precipitation',
    hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset',
  });
  const aq = new URLSearchParams({ latitude: city.lat, longitude: city.lon, timezone: 'Asia/Taipei', current: 'us_aqi,pm2_5' });
  const [fr, ar] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${p}`),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${aq}`).catch(() => null),
  ]);
  if (!fr.ok) throw new Error(`天氣服務回應 ${fr.status}`);
  const f = await fr.json();
  let air = null;
  if (ar && ar.ok) { try { air = (await ar.json()).current; } catch { air = null; } }
  const data = { key, at: Date.now(), city: city.name, f, air };
  store.setCache('weather', data);
  return data;
}

/** Helpers for the UI */
export function summarize(data) {
  const f = data.f;
  const nowIdx = Math.max(0, f.hourly.time.findIndex((t) => t >= f.current.time.slice(0, 13)));
  const hours = [];
  for (let i = nowIdx; i < Math.min(nowIdx + 24, f.hourly.time.length); i++) {
    hours.push({
      label: i === nowIdx ? '現在' : `${Number(f.hourly.time[i].slice(11, 13))}時`,
      temp: Math.round(f.hourly.temperature_2m[i]),
      rain: f.hourly.precipitation_probability[i] ?? 0,
      kind: describe(f.hourly.weather_code[i], f.hourly.is_day[i]).kind,
    });
  }
  const days = f.daily.time.map((t, i) => ({
    date: t,
    hi: Math.round(f.daily.temperature_2m_max[i]),
    lo: Math.round(f.daily.temperature_2m_min[i]),
    rain: f.daily.precipitation_probability_max[i] ?? 0,
    uv: f.daily.uv_index_max[i],
    sunrise: f.daily.sunrise[i]?.slice(11, 16),
    sunset: f.daily.sunset[i]?.slice(11, 16),
    ...describe(f.daily.weather_code[i], 1),
  }));
  const cur = describe(f.current.weather_code, f.current.is_day);
  // umbrella tip: first hour in next 12h with ≥50% rain
  let tip = '';
  const wet = hours.slice(0, 12).find((h) => h.rain >= 50);
  if (wet) tip = wet.label === '現在' ? `現在降雨機率 ${wet.rain}%，出門記得帶傘。` : `${wet.label}起降雨機率升高到 ${wet.rain}%，記得帶傘。`;
  return {
    city: data.city,
    updated: new Date(data.at),
    temp: Math.round(f.current.temperature_2m),
    feels: Math.round(f.current.apparent_temperature),
    humidity: f.current.relative_humidity_2m,
    text: cur.text, kind: cur.kind,
    today: days[0], days, hours,
    rainNow: hours[0]?.rain ?? 0,
    aqi: data.air?.us_aqi ?? null,
    tip,
  };
}

export function uvLabel(uv) {
  if (uv == null) return '';
  if (uv < 3) return '低量級';
  if (uv < 6) return '中量級';
  if (uv < 8) return '高量級，外出防曬';
  if (uv < 11) return '過量級，避免曝曬';
  return '危險級，避免外出';
}
export function aqiLabel(a) {
  if (a == null) return '';
  if (a <= 50) return '良好';
  if (a <= 100) return '普通';
  if (a <= 150) return '對敏感族群不健康';
  if (a <= 200) return '對所有族群不健康';
  return '非常不健康';
}
