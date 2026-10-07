import { store } from '../store.js';
import { esc, icon, toast } from '../util.js';
import { code39Svg, isValidCarrier } from '../barcode.js';
import { openSheet } from '../sheet.js';

let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } }
  catch { /* not allowed — ignore */ }
}
export function releaseWake() { try { wakeLock?.release(); } catch { /* ignore */ } wakeLock = null; }

export function render() {
  const code = store.settings().carrier;
  return `
  <div class="page no-nav">
    <header class="topbar" style="justify-content:flex-start">
      <a class="icon-btn" href="#/" aria-label="返回首頁">${icon('back', 18, 2)}</a>
      <h1 class="page-title" style="font-size:24px;margin-left:4px">手機條碼載具</h1>
    </header>
    ${code ? `
    <section class="card" style="align-items:center;padding:24px 16px;gap:16px">
      <div class="muted small">結帳時出示給店員掃描</div>
      <div class="barcode-box">${code39Svg(code)}</div>
      <div class="carrier-code">${esc(code)}</div>
      <div class="chip" style="background:var(--gold-soft);color:var(--gold)">${icon('sun', 14, 2)}掃描前請把螢幕亮度調高</div>
    </section>
    <div class="grid2">
      <button class="btn" id="copy">${icon('copy', 18)}複製號碼</button>
      <button class="btn primary" id="full">${icon('expand', 18)}全螢幕顯示</button>
    </div>
    <div class="list">
      <button class="list-row" id="edit" style="border:none;background:none;width:100%;text-align:left;cursor:pointer;color:var(--text)"><span class="grow">修改載具號碼</span>${icon('next', 16, 2)}</button>
    </div>` : `
    <section class="card" style="gap:14px">
      <div class="card-title">設定你的手機條碼</div>
      <div class="muted small">輸入財政部電子發票平台申請的手機條碼，格式為「/」加 7 碼英數字，例如 /ABC1234。</div>
      <button class="btn primary" id="edit">${icon('plus', 18, 2)}輸入載具號碼</button>
    </section>`}
    <p class="notice">載具號碼只存在這支手機的瀏覽器裡，不會上傳。條碼格式為 Code 39。</p>
  </div>`;
}

export function mount(root) {
  if (store.settings().carrier) keepAwake();
  root.querySelector('#edit')?.addEventListener('click', editCarrier);
  root.querySelector('#copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(store.settings().carrier); toast('已複製載具號碼'); }
    catch { toast('無法複製，請手動選取'); }
  });
  root.querySelector('#full')?.addEventListener('click', () => {
    const code = store.settings().carrier;
    const el = document.createElement('button');
    el.className = 'fullscreen-code';
    el.setAttribute('aria-label', '點一下關閉全螢幕條碼');
    el.innerHTML = `${code39Svg(code, { narrow: 3 })}<div class="carrier-code" style="color:#111">${esc(code)}</div><div style="font-size:14px;color:#555">點一下關閉</div>`;
    el.addEventListener('click', () => { el.remove(); document.exitFullscreen?.().catch(() => {}); });
    document.body.appendChild(el);
    el.requestFullscreen?.().catch(() => {});
    keepAwake();
  });
}

export function editCarrier() {
  openSheet({
    title: '載具號碼',
    body: `
      <label class="field"><span>手機條碼（/ 開頭共 8 碼）</span>
        <input class="input" name="code" value="${esc(store.settings().carrier)}" placeholder="/ABC1234" maxlength="8" autocapitalize="characters" autocomplete="off" spellcheck="false" style="letter-spacing:3px;font-weight:700"></label>
      <div class="error-text" id="err" role="alert"></div>`,
    actions: [
      ...(store.settings().carrier ? [{ id: 'clear', label: '移除', cls: 'danger' }] : []),
      { id: 'save', label: '儲存', cls: 'primary', submit: true },
    ],
    onOpen(form) { form.code.focus(); form.code.addEventListener('input', () => { form.code.value = form.code.value.toUpperCase(); }); },
    onAction(action, d, form) {
      if (action === 'clear') { store.setSettings({ carrier: '' }); return true; }
      const v = d.code.trim().toUpperCase();
      if (!isValidCarrier(v)) { form.querySelector('#err').textContent = '格式不正確：需為「/」開頭，後面 7 碼為數字、大寫英文或 . - +'; return false; }
      store.setSettings({ carrier: v });
      toast('已儲存載具號碼');
      return true;
    },
  });
}
