// 農曆日期、節氣與台灣放假日。
// 農曆與節氣由 vendor/lunar.js（6tail/lunar-javascript, MIT）計算。
import { ymd, addDays, daysBetween, md, WEEK } from './util.js';

const S2T = { '腊': '臘', '闰': '閏', '冬': '冬' };
const toTrad = (s) => s.replace(/[腊闰]/g, (c) => S2T[c] || c);

// 24 節氣 簡→繁
const TERMS = {
  '小寒': '小寒', '大寒': '大寒', '立春': '立春', '雨水': '雨水', '惊蛰': '驚蟄', '春分': '春分',
  '清明': '清明', '谷雨': '穀雨', '立夏': '立夏', '小满': '小滿', '芒种': '芒種', '夏至': '夏至',
  '小暑': '小暑', '大暑': '大暑', '立秋': '立秋', '处暑': '處暑', '白露': '白露', '秋分': '秋分',
  '寒露': '寒露', '霜降': '霜降', '立冬': '立冬', '小雪': '小雪', '大雪': '大雪', '冬至': '冬至',
  // lunar.js also reports these aliases at the year boundary
  'DONG_ZHI': '冬至', 'XIAO_HAN': '小寒', 'DA_HAN': '大寒', 'LI_CHUN': '立春', 'YU_SHUI': '雨水', 'JING_ZHE': '驚蟄',
};

function lunarOf(date) {
  // eslint-disable-next-line no-undef
  return Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
}

/** e.g. { text: '八月廿七', month: '八月', day: '廿七', yearGZ: '丙午', zodiac: '馬' } */
export function lunarDate(date = new Date()) {
  const l = lunarOf(date);
  const month = toTrad(l.getMonthInChinese()) + '月';
  const day = l.getDayInChinese();
  const zodiac = { '鼠': '鼠', '牛': '牛', '虎': '虎', '兔': '兔', '龙': '龍', '蛇': '蛇', '马': '馬', '羊': '羊', '猴': '猴', '鸡': '雞', '狗': '狗', '猪': '豬' }[l.getYearShengXiao()] || l.getYearShengXiao();
  return { text: month + day, month, day, yearGZ: l.getYearInGanZhi(), zodiac };
}

/** Solar term that falls on this date, or ''. */
export function termOn(date) {
  const t = lunarOf(date).getJieQi();
  return t ? (TERMS[t] || t) : '';
}

/** Today's term or the next one within 20 days: { name, date, days }. */
export function nextTerm(from = new Date()) {
  for (let i = 0; i <= 20; i++) {
    const d = addDays(from, i);
    const t = termOn(d);
    if (t) return { name: t, date: d, days: i };
  }
  return null;
}

export function termLabel(t) {
  if (!t) return '';
  if (t.days === 0) return `節氣：今天${t.name}`;
  if (t.days === 1) return `節氣：明天${t.name}（${md(t.date)}）`;
  return `下個節氣：${t.name}（${md(t.date)}，${t.days} 天後）`;
}

// ---- 台灣行政機關放假日 ----
// 資料來源：行政院人事行政總處 115 年、116 年辦公日曆表（新聞報導整理）。
// 每年 6 月左右公布隔年資料，屆時在這裡新增。
const HOLIDAYS = {
  // 2026（民國 115 年）— 全年無補班日
  '2026-01-01': '開國紀念日',
  '2026-02-16': '除夕', '2026-02-17': '春節', '2026-02-18': '春節', '2026-02-19': '春節', '2026-02-20': '春節補假',
  '2026-02-27': '和平紀念日補假', '2026-02-28': '和平紀念日',
  '2026-04-03': '兒童節補假', '2026-04-04': '兒童節・清明節', '2026-04-06': '清明節補假',
  '2026-05-01': '勞動節',
  '2026-06-19': '端午節',
  '2026-09-25': '中秋節', '2026-09-28': '教師節',
  '2026-10-09': '國慶日補假', '2026-10-10': '國慶日',
  '2026-10-25': '臺灣光復節', '2026-10-26': '光復節補假',
  '2026-12-25': '行憲紀念日',
  // 2027（民國 116 年）— 全年無補班日
  '2027-01-01': '開國紀念日',
  '2027-02-04': '小年夜', '2027-02-05': '除夕', '2027-02-06': '春節', '2027-02-07': '春節', '2027-02-08': '春節',
  '2027-02-09': '春節補假', '2027-02-10': '春節補假',
  '2027-02-28': '和平紀念日', '2027-03-01': '和平紀念日補假',
  '2027-04-04': '兒童節', '2027-04-05': '清明節', '2027-04-06': '兒童節補假',
  '2027-04-30': '勞動節補假', '2027-05-01': '勞動節',
  '2027-06-09': '端午節',
  '2027-09-15': '中秋節', '2027-09-28': '教師節',
  '2027-10-10': '國慶日', '2027-10-11': '國慶日補假',
  '2027-10-25': '臺灣光復暨金門古寧頭大捷紀念日',
  '2027-12-24': '行憲紀念日補假', '2027-12-25': '行憲紀念日',
  '2027-12-31': '開國紀念日補假',
};
const MAKEUP_WORKDAYS = {}; // 'YYYY-MM-DD': '補班'

export const holidayName = (date) => HOLIDAYS[ymd(date)] || '';

/** 'holiday' | 'weekend' | 'makeup' | 'work' */
export function dayType(date) {
  const k = ymd(date);
  if (HOLIDAYS[k]) return 'holiday';
  if (MAKEUP_WORKDAYS[k]) return 'makeup';
  const w = date.getDay();
  return w === 0 || w === 6 ? 'weekend' : 'work';
}

/** Next government holiday on a weekday after today (skip ones that are just weekends). */
export function nextHoliday(from = new Date()) {
  const today = ymd(from);
  const keys = Object.keys(HOLIDAYS).filter((k) => k > today).sort();
  for (const k of keys) {
    const [y, m, d] = k.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    return { name: HOLIDAYS[k], date, days: daysBetween(from, date) };
  }
  return null;
}

export const hasHolidayData = (year) => Object.keys(HOLIDAYS).some((k) => k.startsWith(String(year)));

export const weekName = (d) => '星期' + WEEK[d.getDay()];
