// Bottom-sheet dialog built on <dialog>.
import { esc } from './util.js';

/**
 * openSheet({ title, body, actions:[{id,label,cls,submit}], onAction(id, formData) => bool|Promise<bool> })
 * onAction returning true closes the sheet.
 */
export function openSheet({ title, body, actions = [], onAction, onOpen }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet';
  dlg.innerHTML = `
    <form method="dialog" class="sheet-inner" novalidate>
      <div class="card-head"><h2 class="card-title" style="font-size:19px">${esc(title)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="關閉"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      ${body}
      <div class="row" style="gap:10px;margin-top:4px">
        ${actions.map((a) => `<button type="${a.submit ? 'submit' : 'button'}" class="btn ${a.cls || ''}" data-action="${a.id}" style="flex:1">${esc(a.label)}</button>`).join('')}
      </div>
    </form>`;
  document.body.appendChild(dlg);
  const form = dlg.querySelector('form');
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.querySelector('[data-close]').addEventListener('click', close);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  const run = async (id) => {
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type=checkbox]').forEach((c) => { data[c.name] = c.checked; });
    const ok = await onAction?.(id, data, form);
    if (ok) close();
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); const a = actions.find((x) => x.submit); if (a) run(a.id); });
  dlg.querySelectorAll('[data-action]').forEach((b) => {
    if (b.type !== 'submit') b.addEventListener('click', () => run(b.dataset.action));
  });
  dlg.showModal();
  onOpen?.(form);
  return { close, form };
}
