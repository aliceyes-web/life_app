import { store } from './store.js';
import { cachedMonth } from './gcal.js';

export const EVENT_TAGS = [
  { id: 'work', name: '工作' },
  { id: 'personal', name: '個人' },
  { id: 'remind', name: '提醒' },
];
export const tagName = (id) => (EVENT_TAGS.find((t) => t.id === id) || { name: '' }).name;

/** Local + cached Google events on a date key, sorted (all-day first). */
export function eventsOn(key) {
  const [y, m] = key.split('-').map(Number);
  const local = store.get().events.filter((e) => e.date === key).map((e) => ({ ...e, source: 'local' }));
  const google = cachedMonth(y, m - 1).filter((e) => e.date === key);
  return [...local, ...google].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return (a.start || '').localeCompare(b.start || '');
  });
}

/** Set of date keys in a month that have any event. */
export function eventDays(y, m) {
  const pre = `${y}-${String(m + 1).padStart(2, '0')}-`;
  const s = new Set();
  for (const e of store.get().events) if (e.date.startsWith(pre)) s.add(e.date);
  for (const e of cachedMonth(y, m)) s.add(e.date);
  return s;
}
