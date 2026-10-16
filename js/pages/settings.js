import { store } from '../store.js';
import { esc, icon, toast, ymd } from '../util.js';
import { THEMES, MODES, effectiveMode } from '../theme.js';
import * as gcal from '../gcal.js';
import { editCarrier } from './carrier.js';
import { openSheet } from '../sheet.js';

export function render() {
  const s = store.settings();
  const mode = effectiveMode();
  return `
  <div class="page no-nav">
    <header class="topbar" style="justify-content:flex-start">
      <a class="icon-btn" href="#/" aria-label="返回首頁">${icon('back', 18, 2)}</a>
      <h1 class="page-title" style="font-size:24px;margin-left:4px">設定</h1>
    </header>

    <section class="card">
      <div class="muted small">預覽</div>
      <div class="date-main" style="gap:18px">
        <div class="date-num" style="font-size:60px">${new Date().getDate()}</div>
        <div><div class="date-week" style="font-size:20px">外觀預覽</div><div class="muted small">主題色會套用到整個 APP</div></div>
      </div>
      <div class="banner small">今天的事都完成了，辛苦了！</div>
      <div class="row"><span class="pill-btn" style="height:40px">主要按鈕</span><span class="chip main">標籤</span></div>
    </section>

    <section style="display:flex;flex-direction:column;gap:10px">
      <h2 style="font-size:16px">主題色</h2>
      <div class="swatches" role="group" aria-label="主題色">
        ${THEMES.map((t) => `<button class="swatch" data-theme-id="${t.id}" aria-pressed="${s.theme === t.id}" style="--sw:${mode === 'dark' ? t.dark : t.color}">
          <span style="background:${mode === 'dark' ? t.dark : t.color}">${s.theme === t.id ? icon('check', 18, 3) : ''}</span>${t.name}</button>`).join('')}
      </div>
    </section>

    <section style="display:flex;flex-direction:column;gap:10px">
      <h2 style="font-size:16px">背景色調</h2>
      <div class="seg" role="group" aria-label="背景色調">
        ${MODES.map((m) => `<button data-mode-id="${m.id}" aria-pressed="${s.mode === m.id}">${m.name}</button>`).join('')}
      </div>
      <div class="list">
        <div class="list-row"><span class="grow">跟隨系統深色模式</span>
          <button class="switch" id="auto" aria-pressed="${s.autoDark}" aria-label="跟隨系統深色模式"></button></div>
      </div>
      ${s.autoDark && mode === 'dark' && s.mode !== 'dark' ? '<div class="notice">手機目前是深色模式，所以先顯示深色；關掉上面的開關就會使用你選的色調。</div>' : ''}
    </section>

    <section style="display:flex;flex-direction:column;gap:10px">
      <h2 style="font-size:16px">個人</h2>
      <div class="list">
        <label class="list-row"><span style="width:90px">稱呼</span><input class="grow" id="name" value="${esc(s.name)}" placeholder="例如：Alice" style="border:none;outline:none;background:transparent;text-align:right;font-size:15px;color:var(--text)"></label>
        <button class="list-row" id="carrier" style="border:none;background:none;width:100%;text-align:left;cursor:pointer;color:var(--text)"><span class="grow">載具號碼</span><span class="muted small">${esc(s.carrier || '未設定')}</span>${icon('next', 16, 2)}</button>
      </div>
    </section>

    <section style="display:flex;flex-direction:column;gap:10px">
      <h2 style="font-size:16px">Google 日曆</h2>
      <div class="list">
        <button class="list-row" id="gclient" style="border:none;background:none;width:100%;text-align:left;cursor:pointer;color:var(--text)"><span class="grow">OAuth 用戶端 ID</span><span class="muted small ellipsis" style="max-width:150px">${s.gClientId ? '已設定' : '未設定'}</span>${icon('next', 16, 2)}</button>
        ${s.gClientId ? `<div class="list-row"><span class="grow">${gcal.isLinked() ? '已連結（唯讀）' : '尚未連結'}</span>
          <button class="btn" id="glink" style="height:40px">${gcal.isLinked() ? '中斷連結' : '連結'}</button></div>` : ''}
      </div>
      <div class="notice">APP 只會讀取你的主要日曆，不會修改 Google 上的行程。</div>
    </section>

    <section style="display:flex;flex-direction:column;gap:10px">
      <h2 style="font-size:16px">公車（TDX）</h2>
      <div class="list">
        <button class="list-row" id="tdx" style="border:none;background:none;width:100%;text-align:left;cursor:pointer;color:var(--text)"><span class="grow">TDX 金鑰</span><span class="muted small">${s.tdxId && s.tdxSecret ? '已設定' : '未設定'}</span>${icon('next', 16, 2)}</button>
      </div>
      <div class="notice">到站時間來自交通部 TDX 平臺，金鑰只存在這支手機。</div>
    </section>

    <section style="display:flex;flex-direction:column;gap:10px">
      <h2 style="font-size:16px">資料備份</h2>
      <div class="grid2">
        <button class="btn" id="export">匯出備份</button>
        <label class="btn" style="cursor:pointer">匯入備份<input type="file" id="import" accept="application/json,.json" class="sr-only"></label>
      </div>
      <div class="notice">記事、行程、設定都存在這支手機的瀏覽器裡。換手機或清除瀏覽器資料前，請先匯出備份。</div>
    </section>

    <p class="notice" style="text-align:center">生活小幫手 v1.0 · 天氣資料 Open-Meteo · 農曆計算 lunar-javascript</p>
  </div>`;
}

export function mount(root) {
  root.querySelectorAll('[data-theme-id]').forEach((b) => b.addEventListener('click', () => store.setSettings({ theme: b.dataset.themeId })));
  root.querySelectorAll('[data-mode-id]').forEach((b) => b.addEventListener('click', () => store.setSettings({ mode: b.dataset.modeId })));
  root.querySelector('#auto').addEventListener('click', () => store.setSettings({ autoDark: !store.settings().autoDark }));
  const name = root.querySelector('#name');
  name.addEventListener('change', () => store.setSettings({ name: name.value.trim() }));
  root.querySelector('#carrier').addEventListener('click', editCarrier);
  root.querySelector('#gclient').addEventListener('click', editClientId);
  root.querySelector('#tdx').addEventListener('click', editTdx);
  root.querySelector('#glink')?.addEventListener('click', async () => {
    if (gcal.isLinked()) { gcal.disconnect(); store.setSettings({}); toast('已中斷 Google 日曆連結'); return; }
    try { await gcal.connect(); store.setSettings({}); toast('已連結 Google 日曆'); }
    catch (e) { toast(e.message); }
  });
  root.querySelector('#export').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `生活小幫手備份-${ymd()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  root.querySelector('#import').addEventListener('change', async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    if (!confirm('匯入會取代目前手機上的所有資料，確定嗎？')) { ev.target.value = ''; return; }
    try { store.importJSON(await f.text()); toast('已匯入備份'); }
    catch (e) { toast('匯入失敗：' + e.message); }
  });
}

function editClientId() {
  openSheet({
    title: 'Google OAuth 用戶端 ID',
    body: `
      <div class="small muted" style="line-height:1.7">到 Google Cloud Console 建立「網頁應用程式」類型的 OAuth 用戶端，把這個 APP 的網址（${esc(location.origin)}）加進「已授權的 JavaScript 來源」，並啟用 Google Calendar API，再把用戶端 ID 貼在這裡。</div>
      <label class="field"><span>用戶端 ID</span><input class="input" name="cid" value="${esc(store.settings().gClientId)}" placeholder="xxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false"></label>`,
    actions: [{ id: 'save', label: '儲存', cls: 'primary', submit: true }],
    onAction(_, d) {
      const v = d.cid.trim();
      if (v && !/\.apps\.googleusercontent\.com$/.test(v)) { toast('用戶端 ID 應以 .apps.googleusercontent.com 結尾'); return false; }
      if (v !== store.settings().gClientId) gcal.disconnect();
      store.setSettings({ gClientId: v });
      return true;
    },
  });
}

function editTdx() {
  const s = store.settings();
  openSheet({
    title: 'TDX 金鑰',
    body: `
      <div class="small muted" style="line-height:1.7">到 <a href="https://tdx.transportdata.tw/" target="_blank" rel="noopener">tdx.transportdata.tw</a> 免費註冊會員，登入後在「會員中心 › 資料服務 › API 金鑰」可以看到 Client Id 與 Client Secret，複製貼到下面。</div>
      <label class="field"><span>Client Id</span><input class="input" name="id" value="${esc(s.tdxId)}" autocomplete="off" spellcheck="false" autocapitalize="off"></label>
      <label class="field"><span>Client Secret</span><input class="input" name="secret" type="password" value="${esc(s.tdxSecret)}" autocomplete="off" spellcheck="false" autocapitalize="off"></label>`,
    actions: [
      ...(s.tdxId ? [{ id: 'clear', label: '清除', cls: 'danger' }] : []),
      { id: 'save', label: '儲存', cls: 'primary', submit: true },
    ],
    onAction(action, d) {
      store.setCache('tdxToken', null);
      if (action === 'clear') { store.setSettings({ tdxId: '', tdxSecret: '' }); return true; }
      const id = d.id.trim(); const secret = d.secret.trim();
      if (!id || !secret) { toast('請填寫 Client Id 與 Client Secret'); return false; }
      store.setSettings({ tdxId: id, tdxSecret: secret });
      toast('已儲存 TDX 金鑰');
      return true;
    },
  });
}
