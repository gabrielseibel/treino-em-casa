import { EXERCISES, EX, HOME_ITEMS, GROUPS, PATTERNS, WARMUP } from './exercises.js';
import { KIT_PRESETS, defaultKit, loadOptions, describeSetup, fmtKg, maxLoad, baseWeight } from './plates.js';
import {
  GOALS, LEVELS, SPLIT_NAMES, generatePlan, prescription, suggest, candidates, isAvailable,
  sessionVolume, est1RM, nextWorkoutIndex, lastPerformance,
} from './program.js';
import * as store from './store.js';

// ───────────────────────── estado ─────────────────────────
let state = null;
let ui = { calMonth: null, calDay: null, openLog: null, progEx: null, rest: null, timed: null };
let draft = null; // assistente inicial
let wakeLock = null;

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const dlg = document.getElementById('dlg');

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const persist = () => store.save(state);

// ───────────────────────── datas ─────────────────────────
const DAY = 86400000;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const fmtDate = (ts) => cap(new Date(ts).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''));
const fmtDateLong = (ts) => cap(new Date(ts).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDur = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};
const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
};
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const startOfWeek = (ts) => { const d = new Date(startOfDay(ts)); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.getTime(); };
const toLocalInput = (ts) => { const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const daysAgo = (ts) => {
  const n = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
  return n === 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`;
};

// ───────────────────────── util UI ─────────────────────────
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function openDialog(html) {
  dlg.innerHTML = `<div class="dlg">${html}</div>`;
  if (!dlg.open) dlg.showModal();
}
const closeDialog = () => dlg.open && dlg.close();
dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(); });

function confirmDialog(title, text, okLabel = 'Confirmar', danger = false) {
  return new Promise((resolve) => {
    openDialog(`
      <h2>${esc(title)}</h2>
      <p class="muted">${text}</p>
      <div class="row" style="margin-top:18px">
        <button class="btn grow" data-r="0">Cancelar</button>
        <button class="btn grow ${danger ? 'danger' : 'primary'}" data-r="1">${esc(okLabel)}</button>
      </div>`);
    const h = (e) => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      dlg.removeEventListener('click', h);
      closeDialog();
      resolve(b.dataset.r === '1');
    };
    dlg.addEventListener('click', h);
    dlg.addEventListener('close', () => { dlg.removeEventListener('click', h); resolve(false); }, { once: true });
  });
}

let audioCtx;
function beep(times = 3) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = i === times - 1 ? 1100 : 880;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + i * 0.25);
      g.gain.exponentialRampToValueAtTime(0.35, audioCtx.currentTime + i * 0.25 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + i * 0.25 + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + i * 0.25); o.stop(audioCtx.currentTime + i * 0.25 + 0.2);
    }
  } catch { /* sem áudio */ }
  navigator.vibrate?.([200, 100, 200]);
}

async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* ignorado */ }
}

// ───────────────────────── derivados ─────────────────────────
const sortedSessions = () => [...state.sessions].sort((a, b) => a.start - b.start);

function rxText(ex, p) {
  const per = ex.uni ? ' por lado' : '';
  if (p.secs) return `${p.sets} × ${p.secs} s${per}`;
  return `${p.sets} × ${p.repMin}–${p.repMax}${per}`;
}

function weekStats() {
  const ws = startOfWeek(Date.now());
  const inWeek = state.sessions.filter((s) => s.start >= ws).length;
  // semanas seguidas batendo a meta (semana atual só conta se já bateu)
  let streak = 0;
  for (let w = ws, first = true; ; w -= 7 * DAY, first = false) {
    const n = state.sessions.filter((s) => s.start >= w && s.start < w + 7 * DAY).length;
    if (n >= state.profile.days) streak++;
    else if (!first) break;
    if (streak > 520) break;
  }
  return { inWeek, streak };
}

function bestOf(exId, list = sortedSessions()) {
  let best = null;
  for (const s of list) for (const e of s.exercises) if (e.exId === exId)
    for (const st of e.sets) if (st.done) {
      const v = est1RM(st.kg, st.reps) || (st.kg ? 0 : st.reps || st.secs || 0);
      if (!best || v > best.v) best = { v, st, start: s.start };
    }
  return best;
}

// ───────────────────────── roteamento ─────────────────────────
const route = () => (location.hash.replace(/^#\/?/, '') || 'hoje').split('/');

function render() {
  const y = window.scrollY;
  const [view, arg] = route();
  if (store.isLocked()) return renderLock();
  if (!state || !state.profile) return renderWizard();
  nav.classList.remove('hidden');
  app.classList.remove('no-nav');
  nav.querySelectorAll('a').forEach((a) => a.toggleAttribute('aria-current', false));
  const tab = nav.querySelector(`[data-tab="${view}"]`);
  if (tab) tab.setAttribute('aria-current', 'page');

  const views = { hoje: viewToday, plano: viewPlan, historico: viewHistory, progresso: viewProgress, ajustes: viewSettings, treino: viewSession };
  let html = (views[view] || viewToday)(arg);
  if (state.active && view !== 'treino') {
    html += `<a class="live-banner" href="#/treino">● Treino em andamento · <span data-elapsed>${clock(Date.now() - state.active.start)}</span></a>`;
  }
  app.innerHTML = html;
  if (view === 'treino') nav.classList.add('hidden');
  renderRest();
  window.scrollTo(0, y);
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// ───────────────────────── bloqueio ─────────────────────────
function renderLock() {
  nav.classList.add('hidden');
  app.classList.add('no-nav');
  app.innerHTML = `
    <div class="lock"><form class="stack-lg" id="lockForm" style="width:100%">
      <div><div class="brand">Treino em casa</div><h1 style="margin-top:10px">Bloqueado</h1>
      <p class="muted">Digite seu PIN para abrir seus treinos.</p></div>
      <input type="password" inputmode="numeric" autocomplete="current-password" id="pin" maxlength="12" aria-label="PIN" autofocus>
      <p class="small accent" id="lockMsg" role="alert"></p>
      <button class="btn primary big" type="submit">Entrar</button>
      <button class="btn ghost sm" type="button" data-act="forgotPin">Esqueci o PIN</button>
    </form></div>`;
  $('#pin').focus();
}

async function doUnlock(pin) {
  const data = await store.unlock(pin);
  if (!data) {
    $('#lockMsg').textContent = 'PIN incorreto.';
    const f = $('#lockForm'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
    $('#pin').value = '';
    return;
  }
  state = migrate(data);
  render();
}

function migrate(s) {
  s.sessions ||= []; s.activities ||= []; s.weights ||= [];
  s.kit ||= defaultKit('20');
  return s;
}

// ───────────────────────── assistente inicial ─────────────────────────
function renderWizard() {
  nav.classList.add('hidden');
  app.classList.add('no-nav');
  draft ||= { step: 0, name: '', goal: 'hipertrofia', level: 1, days: 3, minutes: 45, kit: '20', home: ['banco', 'colchonete'], pin: '', pin2: '' };
  const d = draft;
  const steps = 5;
  const prog = `<div class="wizard-progress">${Array.from({ length: steps }, (_, i) => `<i class="${i <= d.step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (d.step === 0) {
    body = `
      <div><div class="brand">Treino em casa</div><h1 style="margin-top:10px">Vamos montar seu treino</h1>
      <p class="muted">Leva 1 minuto. Tudo fica salvo só neste aparelho.</p></div>
      <label class="field"><span>Como quer ser chamado?</span><input type="text" data-d="name" value="${esc(d.name)}" placeholder="Seu nome" autocomplete="given-name"></label>
      <div><div class="eyebrow" style="margin-bottom:8px">Objetivo principal</div><div class="choice-list">
        ${Object.entries(GOALS).map(([k, v]) => `<button class="choice" data-act="wz" data-k="goal" data-v="${k}" aria-pressed="${d.goal === k}"><span class="tick">✓</span><b>${v}</b></button>`).join('')}
      </div></div>
      <div><div class="eyebrow" style="margin-bottom:8px">Experiência com musculação</div><div class="choice-list">
        ${[[1, 'Iniciante', 'Nunca treinei ou parei há muito tempo'], [2, 'Intermediário', 'Treino há alguns meses com regularidade'], [3, 'Avançado', 'Treino há mais de 1-2 anos']]
          .map(([k, t, h]) => `<button class="choice" data-act="wz" data-k="level" data-v="${k}" aria-pressed="${d.level == k}"><span class="tick">✓</span><span><b>${t}</b><span class="muted">${h}</span></span></button>`).join('')}
      </div></div>`;
  } else if (d.step === 1) {
    body = `
      <div><h1>Sua rotina</h1><p class="muted">Seja realista: constância vale mais que volume.</p></div>
      <div><div class="eyebrow" style="margin-bottom:8px">Dias de treino por semana</div><div class="chips">
        ${[2, 3, 4, 5, 6].map((n) => `<button class="chip" data-act="wz" data-k="days" data-v="${n}" aria-pressed="${d.days == n}">${n} dias</button>`).join('')}
      </div><p class="small muted" style="margin-top:8px">Divisão: ${SPLIT_NAMES[d.days]}</p></div>
      <div><div class="eyebrow" style="margin-bottom:8px">Tempo por treino</div><div class="chips">
        ${[30, 45, 60, 75].map((n) => `<button class="chip" data-act="wz" data-k="minutes" data-v="${n}" aria-pressed="${d.minutes == n}">${n} min</button>`).join('')}
      </div></div>`;
  } else if (d.step === 2) {
    body = `
      <div><h1>Seu kit</h1><p class="muted">Halteres ajustáveis com barra longa e presilhas. Qual versão você comprou?</p></div>
      <div class="choice-list">
        ${Object.entries(KIT_PRESETS).map(([k, p]) => `<button class="choice" data-act="wz" data-k="kit" data-v="${k}" aria-pressed="${d.kit === k}"><span class="tick">✓</span><span><b>${p.label}</b>
          <span class="muted">${p.plates.map((x) => `${x.count}× ${fmtKg(x.kg)} kg`).join(' · ')} + 2 barras de halter (35 cm) + conector (40 cm) + 4 presilhas</span></span></button>`).join('')}
      </div>
      <p class="small muted">Dá para ajustar quantidades e o peso das barras depois, em Ajustes (ex.: se comprar mais anilhas).</p>`;
  } else if (d.step === 3) {
    body = `
      <div><h1>O que tem em casa?</h1><p class="muted">Usamos isso para escolher exercícios que você consegue fazer.</p></div>
      <div class="choice-list">
        ${HOME_ITEMS.map((it) => `<button class="choice" data-act="wzHome" data-v="${it.id}" aria-pressed="${d.home.includes(it.id)}"><span class="tick">✓</span><span><b>${it.label}</b><span class="muted">${it.hint}</span></span></button>`).join('')}
      </div>`;
  } else {
    body = `
      <div><h1>Privacidade</h1><p class="muted">Seus treinos ficam salvos só neste aparelho, nunca vão para nenhum servidor. Com um PIN, os dados também ficam <b>criptografados</b> e ninguém que pegar seu celular/PC consegue ver.</p></div>
      ${store.cryptoAvailable() ? `
      <label class="field"><span>PIN (4 a 12 dígitos) — opcional</span><input type="password" inputmode="numeric" data-d="pin" value="${esc(d.pin)}" autocomplete="new-password" maxlength="12"></label>
      <label class="field"><span>Repita o PIN</span><input type="password" inputmode="numeric" data-d="pin2" value="${esc(d.pin2)}" autocomplete="new-password" maxlength="12"></label>
      <p class="small muted">⚠ Se esquecer o PIN não há como recuperar os dados. Faça backups em Ajustes.</p>` : '<p class="muted">Criptografia indisponível neste navegador.</p>'}
      <p class="small accent" id="wzMsg" role="alert"></p>`;
  }
  app.innerHTML = `${prog}<div class="stack-lg">${body}
    <div class="row">
      ${d.step > 0 ? '<button class="btn grow" data-act="wzBack">Voltar</button>' : ''}
      <button class="btn primary grow" data-act="wzNext" style="flex:2">${d.step === steps - 1 ? 'Criar meu plano' : 'Continuar'}</button>
    </div></div>`;
}

async function finishWizard() {
  const d = draft;
  if (d.pin || d.pin2) {
    if (!/^\d{4,12}$/.test(d.pin)) return ($('#wzMsg').textContent = 'O PIN deve ter de 4 a 12 números.');
    if (d.pin !== d.pin2) return ($('#wzMsg').textContent = 'Os PINs não conferem.');
  }
  const profile = { name: d.name.trim(), goal: d.goal, level: +d.level, days: +d.days, minutes: +d.minutes, home: d.home };
  state = migrate({ version: 1, profile, kit: defaultKit(d.kit), sessions: [], activities: [], weights: [], active: null });
  state.plan = generatePlan(profile);
  if (d.pin) await store.setPin(d.pin, state); else await store.setPin('', state);
  draft = null;
  location.hash = '#/hoje';
  render();
  toast('Plano criado! Bora treinar 💪');
}

// ───────────────────────── HOJE ─────────────────────────
function workoutPreview(w) {
  const sorted = sortedSessions();
  return `<ul class="ex-list">${w.items.map((it) => {
    const ex = EX[it.exId]; if (!ex) return '';
    const p = prescription(ex, state.profile);
    const sg = suggest(ex.id, sorted, state.profile, state.kit);
    return `<li><span class="nm">${esc(ex.name)}</span><span class="rx">${rxText(ex, p)}${sg.kg ? `<br><b class="accent">${fmtKg(sg.kg)} kg</b>` : ''}</span></li>`;
  }).join('')}</ul>`;
}

const estMinutes = (w) => Math.round(5 + w.items.reduce((t, it) => {
  const ex = EX[it.exId]; const p = prescription(ex, state.profile);
  return t + p.sets * ((p.secs || 40) * (ex.uni ? 2 : 1) + p.rest) / 60;
}, 0));

function viewToday() {
  const { profile, plan } = state;
  const now = Date.now();
  const hour = new Date().getHours();
  const hi = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const ws = startOfWeek(now);
  const trainedDays = new Set(state.sessions.map((s) => dayKey(s.start)));
  const actDays = new Set(state.activities.map((a) => dayKey(a.start)));
  const letters = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const week = letters.map((l, i) => {
    const t = ws + i * DAY; const k = dayKey(t);
    const cls = [trainedDays.has(k) && 'done', actDays.has(k) && 'act', k === dayKey(now) && 'today'].filter(Boolean).join(' ');
    return `<div class="${cls}"><div class="d">${l}</div><div class="dot">${new Date(t).getDate()}</div></div>`;
  }).join('');
  const { inWeek, streak } = weekStats();
  const idx = nextWorkoutIndex(plan, sortedSessions());
  const w = plan.workouts[idx];
  const last = sortedSessions().at(-1);
  const doneToday = last && dayKey(last.start) === dayKey(now);

  return `
  <div class="topbar"><div><div class="brand">Treino em casa</div><h1 style="margin-top:8px">${hi}${profile.name ? ', ' + esc(profile.name) : ''}</h1></div></div>
  <div class="stack-lg">
    <div class="card stack">
      <div class="spread"><span class="eyebrow">Esta semana</span><b>${inWeek} de ${profile.days} treinos</b></div>
      <div class="week">${week}</div>
    </div>

    ${state.active ? `
      <a class="btn primary big" href="#/treino">Continuar treino em andamento</a>` : `
    <div class="card hero stack">
      <div class="spread"><span class="eyebrow">${doneToday ? 'Próximo treino' : 'Treino de hoje'}</span><span class="badge">~${estMinutes(w)} min</span></div>
      <h2>${esc(w.name)}</h2>
      ${doneToday ? '<p class="small accent">Você já treinou hoje. Descanso também faz parte! ✔</p>' : ''}
      ${workoutPreview(w)}
      <button class="btn primary big" data-act="start" data-w="${idx}">Começar treino</button>
      <div class="chips">${plan.workouts.map((x, i) => i === idx ? '' : `<button class="chip" data-act="start" data-w="${i}">${esc(x.name)}</button>`).join('')}</div>
    </div>`}

    <div class="stats">
      <div class="stat"><b>${state.sessions.length}</b><span>treinos no total</span></div>
      <div class="stat"><b>${streak}</b><span>semanas seguidas na meta</span></div>
      <div class="stat"><b>${last ? daysAgo(last.start).replace('há ', '') : '–'}</b><span>último treino</span></div>
    </div>

    <div class="row">
      <button class="btn grow" data-act="logActivity">+ Outra atividade</button>
      <button class="btn grow" data-act="logWeight">+ Peso corporal</button>
    </div>
  </div>`;
}

// ───────────────────────── SESSÃO ─────────────────────────
function makeEntry(exId) {
  const ex = EX[exId];
  const p = prescription(ex, state.profile);
  const sg = suggest(exId, sortedSessions(), state.profile, state.kit);
  const sets = Array.from({ length: p.sets }, () => ({ kg: sg.kg, reps: p.secs ? null : sg.reps, secs: p.secs ? sg.secs : null, done: false }));
  return { exId, target: { ...p, secs: sg.secs || p.secs }, note: sg.note, maxed: !!sg.maxed, sets };
}

function startWorkout(i) {
  if (state.active) { location.hash = '#/treino'; return; }
  const w = state.plan.workouts[i];
  state.active = {
    id: uid(), workoutKey: w.key, workoutName: w.name, planCreatedAt: state.plan.createdAt,
    start: Date.now(), exercises: w.items.filter((it) => EX[it.exId]).map((it) => makeEntry(it.exId)), warmup: [],
  };
  persist();
  location.hash = '#/treino';
  keepAwake(true);
}

function kgSelect(ex, kg, i, s) {
  const opts = loadOptions(state.kit, ex.mode);
  const cur = kg == null ? opts[0]?.kg : kg;
  const has = opts.some((o) => Math.abs(o.kg - cur) < 0.001);
  return `<select data-field="kg" data-i="${i}" data-s="${s}" aria-label="Carga série ${s + 1}">
    ${has ? '' : `<option value="${cur}" selected>${fmtKg(cur)}</option>`}
    ${opts.map((o) => `<option value="${o.kg}" ${Math.abs(o.kg - cur) < 0.001 ? 'selected' : ''}>${fmtKg(o.kg)}</option>`).join('')}
  </select>`;
}

function viewSession() {
  const a = state.active;
  if (!a) {
    return `<div class="stack-lg"><h1>Nenhum treino em andamento</h1><a class="btn primary big" href="#/hoje">Ir para hoje</a></div>`;
  }
  const cards = a.exercises.map((e, i) => {
    const ex = EX[e.exId];
    const p = e.target;
    const last = lastPerformance(ex.id, sortedSessions());
    const lastTxt = last ? `Última vez (${fmtDate(last.session.start)}): ${last.entry.sets.filter((s) => s.done).map((s) => (s.kg ? fmtKg(s.kg) + '×' : '') + (s.secs ? s.secs + 's' : s.reps)).join(', ')}` : '';
    const kgNow = e.sets.find((s) => !s.done)?.kg ?? e.sets[0]?.kg;
    const complete = e.sets.length && e.sets.every((s) => s.done);
    const head = `<div class="set-row head"><span>#</span><span>${ex.mode === 'body' ? '' : 'kg'}</span><span>${p.secs ? 'segundos' : 'reps'}</span><span></span></div>`;
    const rows = e.sets.map((st, s) => `
      <div class="set-row ${st.done ? 'done' : ''}">
        <span class="n">${s + 1}</span>
        ${ex.mode === 'body' ? '<span class="bw">peso corporal</span>' : kgSelect(ex, st.kg, i, s)}
        ${p.secs
          ? `<span class="timecell"><input type="number" inputmode="numeric" data-field="secs" data-i="${i}" data-s="${s}" value="${st.secs ?? ''}" aria-label="Segundos"><button data-act="timeSet" data-i="${i}" data-s="${s}" aria-label="Cronometrar">▶</button></span>`
          : `<input type="number" inputmode="numeric" data-field="reps" data-i="${i}" data-s="${s}" value="${st.reps ?? ''}" aria-label="Repetições série ${s + 1}">`}
        <button class="check" data-act="toggleSet" data-i="${i}" data-s="${s}" aria-label="Concluir série ${s + 1}" aria-pressed="${st.done}">✓</button>
      </div>`).join('');
    return `
    <section class="ex-card ${complete ? 'complete' : ''}" id="ex-${i}">
      <header><div>
        <h3><button data-act="info" data-ex="${ex.id}">${esc(ex.name)}</button></h3>
        <div class="rx-line">${rxText(ex, p)} · descanso ${p.rest} s${p.repMax ? '' : ''}</div>
      </div><span class="badge">${i + 1}/${a.exercises.length}</span></header>
      ${e.note ? `<div class="note ${e.maxed ? 'max' : ''}">💡 ${esc(e.note)}</div>` : ''}
      ${ex.mode !== 'body' && kgNow != null ? `<div class="setup" data-setup="${i}">${describeSetup(state.kit, ex.mode, kgNow)}</div>` : ''}
      ${lastTxt ? `<div class="small muted" style="margin-top:6px">${esc(lastTxt)}</div>` : ''}
      <div class="sets">${head}${rows}</div>
      <div class="ex-actions">
        <button class="btn sm" data-act="addSet" data-i="${i}">+ Série</button>
        <button class="btn sm" data-act="delSet" data-i="${i}" ${e.sets.length <= 1 ? 'disabled' : ''}>− Série</button>
        <button class="btn sm" data-act="swap" data-i="${i}">Trocar</button>
        <button class="btn sm ghost" data-act="removeEx" data-i="${i}">Remover</button>
      </div>
    </section>`;
  }).join('');

  const doneSets = a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalSets = a.exercises.reduce((n, e) => n + e.sets.length, 0);

  return `
  <div class="session-head spread">
    <div><div class="eyebrow">${esc(a.workoutName)}</div><div class="clock" data-elapsed>${clock(Date.now() - a.start)}</div></div>
    <div class="row"><span class="small muted">${doneSets}/${totalSets} séries</span><button class="btn primary sm" data-act="finish">Finalizar</button></div>
  </div>
  <div class="stack">
    <details class="card warmup"><summary>Aquecimento (5 min)</summary><ul>${WARMUP.map((w) => `<li>${w}</li>`).join('')}</ul></details>
    ${cards}
    <button class="btn block" data-act="addEx">+ Adicionar exercício</button>
    <button class="btn primary big" data-act="finish">Finalizar treino</button>
    <button class="btn ghost block small" data-act="discard">Descartar este treino</button>
  </div>`;
}

function startRest(secs) {
  ui.rest = { end: Date.now() + secs * 1000, total: secs, beeped: false };
  renderRest();
}

function renderRest() {
  let el = document.getElementById('rest');
  if (!ui.rest || !state?.active || route()[0] !== 'treino') { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'rest'; el.className = 'rest';
    el.innerHTML = `<div class="rest-inner">
      <div class="grow"><div class="eyebrow">Descanso</div><div class="time" data-rest>0:00</div><div class="bar"><i data-restbar></i></div></div>
      <button class="btn sm" data-act="restAdd" data-v="-15">−15</button>
      <button class="btn sm" data-act="restAdd" data-v="15">+15</button>
      <button class="btn sm primary" data-act="restSkip">Pular</button></div>`;
    document.body.appendChild(el);
  }
  tickRest();
}

function tickRest() {
  const el = document.getElementById('rest');
  if (!el || !ui.rest) return;
  const left = ui.rest.end - Date.now();
  el.classList.toggle('over', left <= 0);
  $('[data-rest]', el).textContent = left > 0 ? clock(left + 999) : '+' + clock(-left);
  $('[data-restbar]', el).style.width = Math.max(0, Math.min(100, (left / (ui.rest.total * 1000)) * 100)) + '%';
  if (left <= 0 && !ui.rest.beeped) { ui.rest.beeped = true; beep(); }
  if (left < -60000) { ui.rest = null; el.remove(); }
}

function startTimed(i, s) {
  const e = state.active.exercises[i];
  const target = e.sets[s].secs || e.target.secs || 30;
  ui.timed = { i, s, end: Date.now() + target * 1000 + 3000, target, prep: true };
  openDialog(`<div style="text-align:center" class="stack-lg">
    <div class="eyebrow">${esc(EX[e.exId].name)} · série ${s + 1}</div>
    <div class="clock" style="font-size:96px" data-timed>3</div>
    <div class="muted" data-timedlbl>Prepare-se…</div>
    <button class="btn primary big" data-act="timedStop">Parar</button></div>`);
}

function tickTimed() {
  if (!ui.timed) return;
  const t = ui.timed;
  const left = t.end - Date.now();
  const el = $('[data-timed]', dlg);
  if (!el) { ui.timed = null; return; }
  if (left > t.target * 1000) {
    el.textContent = Math.ceil((left - t.target * 1000) / 1000);
  } else {
    if (t.prep) { t.prep = false; beep(1); $('[data-timedlbl]', dlg).textContent = 'Valendo!'; }
    el.textContent = Math.ceil(Math.max(0, left) / 1000);
    if (left <= 0) finishTimed(t.target);
  }
}

function finishTimed(secs) {
  const t = ui.timed; ui.timed = null;
  closeDialog();
  if (!t) return;
  const e = state.active.exercises[t.i];
  e.sets[t.s].secs = secs; e.sets[t.s].done = true;
  persist(); beep(2);
  startRest(e.target.rest);
  render();
}

function exercisePicker(title, list, act, extra = '') {
  const groups = {};
  for (const ex of list) (groups[ex.pattern] ||= []).push(ex);
  openDialog(`
    <div class="dlg-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="close" aria-label="Fechar">✕</button></div>
    ${extra}
    <div class="stack">${Object.entries(groups).map(([p, xs]) => `
      <div><div class="eyebrow" style="margin-bottom:6px">${PATTERNS[p]}</div><div class="pick-list">
      ${xs.map((ex) => `<button data-act="${act}" data-ex="${ex.id}"><b>${esc(ex.name)}</b><small>${modeLabel(ex)} · ${ex.groups.map((g) => GROUPS[g]).join(', ')}</small></button>`).join('')}
      </div></div>`).join('')}</div>`);
}

const modeLabel = (ex) => ({ pair: '2 halteres', single: '1 halter', bar: 'Barra longa', body: 'Peso corporal' }[ex.mode]) + (ex.req.length ? ' + ' + ex.req.map((r) => HOME_ITEMS.find((h) => h.id === r)?.label.split(',')[0].toLowerCase()).join(', ') : '');

function showFinish() {
  const a = state.active;
  const done = a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const tmp = { ...a, end: Date.now() };
  const prior = sortedSessions();
  const prs = a.exercises.filter((e) => {
    const sets = e.sets.filter((s) => s.done && s.kg && s.reps);
    if (!sets.length) return false;
    const best = bestOf(e.exId, prior);
    const now = Math.max(...sets.map((s) => est1RM(s.kg, s.reps)));
    return best && now > best.v + 0.01;
  }).map((e) => EX[e.exId].name);
  ui.feel = a.feel || 0;
  openDialog(`
    <div class="dlg-head"><h2>Finalizar treino</h2><button class="icon-btn" data-act="close" aria-label="Fechar">✕</button></div>
    <div class="stack">
      <div class="stats">
        <div class="stat"><b>${fmtDur(tmp.end - a.start)}</b><span>duração</span></div>
        <div class="stat"><b>${done}</b><span>séries feitas</span></div>
        <div class="stat"><b>${sessionVolume(tmp)}</b><span>kg levantados</span></div>
      </div>
      ${prs.length ? `<div class="note max">🏆 Recorde em: <b>${prs.map(esc).join(', ')}</b></div>` : ''}
      ${done === 0 ? '<div class="note">Nenhuma série marcada como feita ainda.</div>' : ''}
      <div><div class="eyebrow" style="margin-bottom:8px">Como foi?</div>
        <div class="feel">${['😫', '😕', '🙂', '😀', '🔥'].map((f, k) => `<button data-act="feel" data-v="${k + 1}" aria-pressed="${ui.feel === k + 1}">${f}</button>`).join('')}</div></div>
      <label class="field"><span>Observações</span><textarea id="finNotes" placeholder="Dor, energia, o que mudar…">${esc(a.notes || '')}</textarea></label>
      <div class="row">
        <label class="field grow"><span>Início</span><input type="datetime-local" id="finStart" value="${toLocalInput(a.start)}"></label>
        <label class="field" style="width:110px"><span>Minutos</span><input type="number" inputmode="numeric" id="finMin" value="${Math.max(1, Math.round((tmp.end - a.start) / 60000))}"></label>
      </div>
      <button class="btn primary big" data-act="saveSession" ${done === 0 ? 'disabled' : ''}>Salvar treino</button>
    </div>`);
}

function saveSession() {
  const a = state.active;
  const start = new Date($('#finStart').value).getTime() || a.start;
  const mins = Math.max(1, +$('#finMin').value || 1);
  const s = {
    id: a.id, workoutKey: a.workoutKey, workoutName: a.workoutName, planCreatedAt: a.planCreatedAt,
    start, end: start + mins * 60000, feel: ui.feel || null, notes: $('#finNotes').value.trim(),
    exercises: a.exercises
      .map((e) => ({ exId: e.exId, target: e.target, sets: e.sets.filter((x) => x.done).map(({ kg, reps, secs }) => ({ kg, reps, secs, done: true })) }))
      .filter((e) => e.sets.length),
  };
  state.sessions.push(s);
  state.sessions.sort((x, y) => x.start - y.start);
  state.active = null; ui.rest = null;
  persist(); store.flush();
  keepAwake(false);
  closeDialog();
  location.hash = '#/historico';
  ui.openLog = s.id;
  render();
  toast('Treino salvo! ✔');
}

// ───────────────────────── PLANO ─────────────────────────
function viewPlan() {
  const { plan, profile } = state;
  return `
  <div class="topbar"><div><div class="eyebrow">Seu plano</div><h1 style="margin-top:6px">${SPLIT_NAMES[plan.days]}</h1>
  <p class="muted small" style="margin-top:6px">${GOALS[profile.goal]} · ${LEVELS[profile.level]} · ${profile.days}×/semana · ${profile.minutes} min</p></div></div>
  <div class="stack-lg">
    ${plan.workouts.map((w, wi) => `
      <div class="card stack">
        <div class="spread"><h2>${esc(w.name)}</h2><span class="badge">~${estMinutes(w)} min</span></div>
        <ul class="ex-list">${w.items.map((it, ii) => {
          const ex = EX[it.exId]; if (!ex) return '';
          return `<li><span><button class="icon-btn" style="padding:0;min-height:0;min-width:0;color:var(--text);font-weight:600;text-align:left" data-act="info" data-ex="${ex.id}">${esc(ex.name)}</button>
            <br><span class="small muted">${rxText(ex, prescription(ex, profile))} · ${modeLabel(ex)}</span></span>
            <span class="row" style="gap:2px">
              <button class="icon-btn" data-act="planMove" data-w="${wi}" data-x="${ii}" data-d="-1" aria-label="Subir" ${ii === 0 ? 'disabled' : ''}>↑</button>
              <button class="icon-btn" data-act="planSwap" data-w="${wi}" data-x="${ii}" aria-label="Trocar">⇄</button>
              <button class="icon-btn" data-act="planDel" data-w="${wi}" data-x="${ii}" aria-label="Remover">✕</button>
            </span></li>`;
        }).join('')}</ul>
        <div class="row"><button class="btn sm" data-act="planAdd" data-w="${wi}">+ Exercício</button><span class="grow"></span>
        <button class="btn sm primary" data-act="start" data-w="${wi}">Começar</button></div>
      </div>`).join('')}
    <div class="card stack">
      <h3>Como evoluir</h3>
      <p class="small muted">O app usa <b>progressão dupla</b>: quando você faz o número máximo de repetições em todas as séries, ele sugere subir para a próxima carga possível com suas anilhas. Ao chegar no peso máximo do kit, ele sugere descidas mais lentas, pausas ou uma variação mais difícil.</p>
      <p class="small muted">Treine perto da falha: termine cada série sentindo que faria só mais 1–3 repetições com boa técnica.</p>
    </div>
    <button class="btn block danger" data-act="regenPlan">Refazer plano do zero</button>
  </div>`;
}

// ───────────────────────── HISTÓRICO ─────────────────────────
function logItem(s) {
  const open = ui.openLog === s.id;
  const sum = s.exercises.map((e) => EX[e.exId]?.name).filter(Boolean);
  return `
  <div class="card log-item" data-act="toggleLog" data-id="${s.id}">
    <div class="spread"><div class="when">${fmtDate(s.start)} · ${fmtTime(s.start)} · ${fmtDur(s.end - s.start)}</div>
      ${s.feel ? `<span>${['😫', '😕', '🙂', '😀', '🔥'][s.feel - 1]}</span>` : ''}</div>
    <h3 style="margin-top:6px">${esc(s.workoutName)}</h3>
    <div class="small muted" style="margin-top:4px">${s.exercises.reduce((n, e) => n + e.sets.length, 0)} séries · ${sessionVolume(s)} kg · ${sum.length} exercícios</div>
    ${open ? `
      <table class="detail-table">${s.exercises.map((e) => {
        const ex = EX[e.exId];
        return `<tr><td>${esc(ex?.name || e.exId)}</td><td>${e.sets.map((st) => (st.kg && ex?.mode !== 'body' ? fmtKg(st.kg) + '×' : '') + (st.secs ? st.secs + 's' : st.reps)).join(' · ')}</td></tr>`;
      }).join('')}</table>
      ${s.notes ? `<p class="small" style="margin-top:10px">📝 ${esc(s.notes)}</p>` : ''}
      <div class="row" style="margin-top:12px"><button class="btn sm danger" data-act="delSession" data-id="${s.id}">Apagar</button></div>` : `<div class="small muted" style="margin-top:4px">${esc(sum.slice(0, 4).join(', '))}${sum.length > 4 ? '…' : ''}</div>`}
  </div>`;
}

function actItem(a) {
  return `<div class="card"><div class="spread"><div class="when small muted">${fmtDate(a.start)} · ${fmtTime(a.start)} · ${a.minutes} min</div><span class="badge blue">atividade</span></div>
    <h3 style="margin-top:6px">${esc(a.type)}</h3>${a.notes ? `<p class="small muted" style="margin:4px 0 0">${esc(a.notes)}</p>` : ''}
    <div class="row" style="margin-top:10px"><button class="btn sm danger" data-act="delActivity" data-id="${a.id}">Apagar</button></div></div>`;
}

function viewHistory() {
  const now = new Date();
  ui.calMonth ||= new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const m = new Date(ui.calMonth);
  const first = (m.getDay() + 6) % 7;
  const daysIn = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const wDays = new Set(state.sessions.map((s) => dayKey(s.start)));
  const aDays = new Set(state.activities.map((a) => dayKey(a.start)));
  const cells = [];
  for (let i = 0; i < first; i++) cells.push('<button class="out" tabindex="-1" aria-hidden="true"></button>');
  for (let d = 1; d <= daysIn; d++) {
    const k = dayKey(new Date(m.getFullYear(), m.getMonth(), d));
    const cls = [wDays.has(k) && 'w', aDays.has(k) && 'a', k === dayKey(Date.now()) && 'today', ui.calDay === k && 'sel'].filter(Boolean).join(' ');
    cells.push(`<button class="${cls}" data-act="calDay" data-k="${k}">${d}</button>`);
  }
  const monthSessions = state.sessions.filter((s) => { const d = new Date(s.start); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); });
  const monthMins = monthSessions.reduce((t, s) => t + (s.end - s.start) / 60000, 0);

  const items = [
    ...state.sessions.map((s) => ({ t: s.start, html: () => logItem(s), k: dayKey(s.start) })),
    ...state.activities.map((a) => ({ t: a.start, html: () => actItem(a), k: dayKey(a.start) })),
  ].filter((x) => !ui.calDay || x.k === ui.calDay).sort((a, b) => b.t - a.t);

  return `
  <div class="topbar"><div><div class="eyebrow">O que, quando e quanto</div><h1 style="margin-top:6px">Histórico</h1></div>
    <button class="btn sm" data-act="logActivity">+ Atividade</button></div>
  <div class="stack-lg">
    <div class="card stack">
      <div class="spread">
        <button class="icon-btn" data-act="calNav" data-d="-1" aria-label="Mês anterior">‹</button>
        <b>${cap(m.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</b>
        <button class="icon-btn" data-act="calNav" data-d="1" aria-label="Próximo mês">›</button>
      </div>
      <div class="cal">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((x) => `<div class="h">${x}</div>`).join('')}${cells.join('')}</div>
      <div class="small muted spread"><span><span class="badge pr">■</span> treino &nbsp; <span class="accent" style="color:var(--blue)">●</span> atividade</span>
        <span>${monthSessions.length} treinos · ${Math.round(monthMins)} min no mês</span></div>
    </div>
    ${ui.calDay ? `<div class="spread"><b>${fmtDateLong(new Date(ui.calDay + 'T12:00').getTime())}</b><button class="btn sm" data-act="calDay" data-k="">Ver tudo</button></div>` : ''}
    <div class="stack">${items.length ? items.map((x) => x.html()).join('') : `<p class="muted">${ui.calDay ? 'Nada registrado neste dia.' : 'Nenhum treino ainda. Seu primeiro registro vai aparecer aqui.'}</p>`}</div>
  </div>`;
}

// ───────────────────────── PROGRESSO ─────────────────────────
function lineChart(points, fmtY = (v) => v) {
  if (points.length < 2) return '<p class="small muted">Faça pelo menos 2 treinos com este exercício para ver o gráfico.</p>';
  const W = 320, H = 150, L = 50, R = 8, T = 10, B = 22;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 1) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.1; y0 = Math.max(0, y0 - pad); y1 += pad;
  const X = (v) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const ticks = [y0, (y0 + y1) / 2, y1];
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de evolução">
    ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${L - 4}" y="${Y(t) + 3}" text-anchor="end">${fmtY(Math.round(t * 10) / 10)}</text>`).join('')}
    <text x="${L}" y="${H - 4}">${new Date(x0).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</text>
    <text x="${W - R}" y="${H - 4}" text-anchor="end">${new Date(x1).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</text>
    <path class="ln" d="${path}"/>
    ${points.map((p) => `<circle class="pt" cx="${X(p.x)}" cy="${Y(p.y)}" r="3"><title>${fmtY(p.y)}</title></circle>`).join('')}
  </svg>`;
}

function weeksChart() {
  const ws = startOfWeek(Date.now());
  const weeks = Array.from({ length: 12 }, (_, i) => ws - (11 - i) * 7 * DAY);
  const counts = weeks.map((w) => state.sessions.filter((s) => s.start >= w && s.start < w + 7 * DAY).length);
  const max = Math.max(state.profile.days, ...counts);
  const W = 320, H = 132, B = 18, T = 14, bw = W / 12;
  const goalY = T + (H - B - T) * (1 - state.profile.days / max);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Treinos por semana">
    <line class="grid" x1="0" x2="${W}" y1="${goalY}" y2="${goalY}" stroke-dasharray="4 4"/>
    <text x="${W - 2}" y="${goalY - 4}" text-anchor="end">meta ${state.profile.days}</text>
    ${counts.map((c, i) => {
      const h = (H - B - T) * (c / max);
      return `<rect class="bar ${c >= state.profile.days ? '' : 'dim'}" x="${i * bw + 4}" y="${H - B - h}" width="${bw - 8}" height="${Math.max(h, c ? 2 : 0)}" rx="3"><title>${c} treino(s)</title></rect>
      ${i % 3 === 2 || i === 11 ? `<text x="${i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${new Date(weeks[i]).toLocaleDateString('pt-BR', { day: 'numeric', month: 'numeric' })}</text>` : ''}`;
    }).join('')}
  </svg>`;
}

function viewProgress() {
  const sorted = sortedSessions();
  const done = [...new Set(sorted.flatMap((s) => s.exercises.map((e) => e.exId)))].filter((id) => EX[id]);
  if (!ui.progEx || !done.includes(ui.progEx)) ui.progEx = done[0] || null;

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthCount = state.sessions.filter((s) => s.start >= monthStart).length;
  const weekAgo = Date.now() - 7 * DAY;
  const weekSessions = state.sessions.filter((s) => s.start >= weekAgo);
  const groupSets = {};
  for (const s of weekSessions) for (const e of s.exercises) {
    const ex = EX[e.exId]; if (!ex) continue;
    for (const g of ex.groups.slice(0, 2)) groupSets[g] = (groupSets[g] || 0) + e.sets.length;
  }
  const gMax = Math.max(1, ...Object.values(groupSets));

  let exBlock = '<p class="muted">Seus gráficos aparecem depois do primeiro treino.</p>';
  if (ui.progEx) {
    const ex = EX[ui.progEx];
    const pts = [];
    const rows = [];
    for (const s of sorted) {
      const e = s.exercises.find((x) => x.exId === ex.id); if (!e) continue;
      let y;
      if (ex.metric === 'time') y = Math.max(...e.sets.map((st) => st.secs || 0));
      else if (ex.mode === 'body') y = Math.max(...e.sets.map((st) => st.reps || 0));
      else y = Math.max(...e.sets.map((st) => st.kg || 0));
      pts.push({ x: s.start, y });
      rows.push(`<tr><td>${fmtDate(s.start)}</td><td>${e.sets.map((st) => (st.kg && ex.mode !== 'body' ? fmtKg(st.kg) + '×' : '') + (st.secs ? st.secs + 's' : st.reps)).join(' · ')}</td></tr>`);
    }
    const unit = ex.metric === 'time' ? 's' : ex.mode === 'body' ? ' reps' : ' kg';
    const best = bestOf(ex.id, sorted);
    exBlock = `
      <select data-act-change="progEx" aria-label="Exercício">${done.map((id) => `<option value="${id}" ${id === ui.progEx ? 'selected' : ''}>${esc(EX[id].name)}</option>`).join('')}</select>
      <div class="small muted">${ex.metric === 'time' ? 'Maior tempo' : ex.mode === 'body' ? 'Mais repetições em uma série' : 'Maior carga'} por treino${ex.mode === 'pair' ? ' (por halter)' : ''}</div>
      ${lineChart(pts, (v) => String(v).replace('.', ',') + unit)}
      ${best && best.st.kg ? `<div class="note">🏆 Melhor série: <b>${fmtKg(best.st.kg)} kg × ${best.st.reps}</b> em ${fmtDate(best.start)} · força estimada (1RM) ${fmtKg(Math.round(best.v * 10) / 10)} kg</div>` : ''}
      <table class="detail-table">${rows.reverse().slice(0, 8).join('')}</table>`;
  }

  const ws = [...state.weights].sort((a, b) => a.date - b.date);
  return `
  <div class="topbar"><div><div class="eyebrow">Sua evolução</div><h1 style="margin-top:6px">Progresso</h1></div></div>
  <div class="stack-lg">
    <div class="stats">
      <div class="stat"><b>${monthCount}</b><span>treinos no mês</span></div>
      <div class="stat"><b>${Math.round(state.sessions.reduce((t, s) => t + (s.end - s.start), 0) / 3600000)}h</b><span>de treino no total</span></div>
      <div class="stat"><b>${(state.sessions.reduce((t, s) => t + sessionVolume(s), 0) / 1000).toFixed(1).replace('.', ',')}t</b><span>levantadas no total</span></div>
    </div>
    <div class="card stack"><h3>Treinos por semana</h3>${weeksChart()}</div>
    <div class="card stack"><h3>Por exercício</h3>${exBlock}</div>
    <div class="card stack"><h3>Séries por músculo · 7 dias</h3>
      ${Object.keys(groupSets).length ? Object.entries(groupSets).sort((a, b) => b[1] - a[1]).map(([g, n]) => `<div class="hbar"><span>${GROUPS[g]}</span><i style="width:${(n / gMax) * 100}%"></i><b>${n}</b></div>`).join('') : '<p class="small muted">Nenhum treino nos últimos 7 dias.</p>'}
      <p class="small muted">Referência para hipertrofia: ~10–20 séries por músculo por semana.</p>
    </div>
    <div class="card stack"><div class="spread"><h3>Peso corporal</h3><button class="btn sm" data-act="logWeight">+ Registrar</button></div>
      ${ws.length ? lineChart(ws.map((w) => ({ x: w.date, y: w.kg })), (v) => String(v).replace('.', ',') + ' kg') + `<div class="small muted">Último: <b>${fmtKg(ws.at(-1).kg)} kg</b> em ${fmtDate(ws.at(-1).date)}${ws.length > 1 ? ` · variação ${(ws.at(-1).kg - ws[0].kg > 0 ? '+' : '') + fmtKg(Math.round((ws.at(-1).kg - ws[0].kg) * 10) / 10)} kg` : ''}</div>` : '<p class="small muted">Registre seu peso de vez em quando (mesmo horário, em jejum) para acompanhar.</p>'}
    </div>
  </div>`;
}

// ───────────────────────── AJUSTES ─────────────────────────
function viewSettings() {
  const { profile: p, kit } = state;
  const wl = (mode) => loadOptions(kit, mode).map((o) => fmtKg(o.kg)).join(' · ');
  return `
  <div class="topbar"><div><div class="eyebrow">Configurações</div><h1 style="margin-top:6px">Ajustes</h1></div></div>
  <div class="stack-lg">
    <div class="card stack">
      <h3>Perfil</h3>
      <label class="field"><span>Nome</span><input type="text" data-p="name" value="${esc(p.name)}"></label>
      <label class="field"><span>Objetivo</span><select data-p="goal">${Object.entries(GOALS).map(([k, v]) => `<option value="${k}" ${p.goal === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>Nível</span><select data-p="level">${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}" ${p.level == k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <div class="row">
        <label class="field grow"><span>Dias/semana</span><select data-p="days">${[2, 3, 4, 5, 6].map((n) => `<option ${p.days == n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field grow"><span>Minutos/treino</span><select data-p="minutes">${[30, 45, 60, 75].map((n) => `<option ${p.minutes == n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      </div>
      <p class="small muted">Mudou objetivo, dias ou tempo? Refaça o plano em Plano → "Refazer plano". Seu histórico é mantido.</p>
    </div>

    <div class="card stack">
      <h3>Seu kit</h3>
      <div class="chips">${Object.entries(KIT_PRESETS).map(([k, v]) => `<button class="chip" data-act="kitPreset" data-v="${k}" aria-pressed="${kit.preset === k}">${v.label}</button>`).join('')}</div>
      ${kit.plates.map((pl, i) => `<div class="row"><span class="grow">Anilhas de <b>${fmtKg(pl.kg)} kg</b></span><input type="number" inputmode="numeric" style="width:90px" data-plate="${i}" value="${pl.count}" min="0" aria-label="Quantidade de anilhas de ${fmtKg(pl.kg)} kg"><span class="muted small">un.</span></div>`).join('')}
      <div class="row"><label class="field grow"><span>Nova anilha (kg)</span><input type="number" inputmode="decimal" step="0.25" id="newPlate" placeholder="ex.: 2,5"></label><button class="btn" data-act="addPlate" style="align-self:flex-end">Adicionar</button></div>
      <div class="row">
        <label class="field grow"><span>Peso de cada barra de halter (kg)</span><input type="number" inputmode="decimal" step="0.05" data-kit="handle" value="${kit.handle}"></label>
        <label class="field grow"><span>Peso do conector (kg)</span><input type="number" inputmode="decimal" step="0.05" data-kit="connector" value="${kit.connector}"></label>
      </div>
      <div class="weights-line"><b>Par de halteres (cada):</b> ${wl('pair')} kg</div>
      <div class="weights-line"><b>1 halter só:</b> ${wl('single')} kg</div>
      <div class="weights-line"><b>Barra longa:</b> ${wl('bar')} kg (barra vazia ${fmtKg(Math.round(baseWeight(kit, 'bar') * 100) / 100)} kg)</div>
      <p class="small muted">⚠ Sempre aperte bem as presilhas com rosca antes de cada série.</p>
    </div>

    <div class="card stack">
      <h3>O que tem em casa</h3>
      <div class="choice-list">${HOME_ITEMS.map((it) => `<button class="choice" data-act="toggleHome" data-v="${it.id}" aria-pressed="${p.home.includes(it.id)}"><span class="tick">✓</span><span><b>${it.label}</b><span class="muted">${it.hint}</span></span></button>`).join('')}</div>
    </div>

    <div class="card stack">
      <h3>Privacidade</h3>
      <p class="small muted">Os dados ficam só neste navegador/aparelho. ${store.hasPin() ? '🔒 Protegidos e criptografados com PIN.' : '🔓 Sem PIN: qualquer pessoa com acesso a este aparelho pode abrir.'}</p>
      <div class="row wrap">
        <button class="btn" data-act="setPin">${store.hasPin() ? 'Trocar PIN' : 'Criar PIN'}</button>
        ${store.hasPin() ? '<button class="btn" data-act="lockNow">Bloquear agora</button><button class="btn ghost" data-act="removePin">Remover PIN</button>' : ''}
      </div>
    </div>

    <div class="card stack">
      <h3>Backup</h3>
      <p class="small muted">Como os dados ficam só aqui, exporte um backup de vez em quando (ou para passar para outro aparelho).</p>
      <div class="row wrap"><button class="btn" data-act="export">Exportar backup</button>
      <label class="btn">Importar backup<input type="file" accept="application/json,.json" id="importFile" hidden></label></div>
    </div>

    <button class="btn block danger" data-act="wipe">Apagar todos os dados deste aparelho</button>
    <p class="small muted" style="text-align:center">Treino em casa · as orientações não substituem um profissional de educação física. Sentiu dor? Pare.</p>
  </div>`;
}

// ───────────────────────── diálogos diversos ─────────────────────────
function showInfo(exId) {
  const ex = EX[exId];
  const alts = candidates(ex.pattern, state.profile).filter((x) => x.id !== ex.id);
  const q = encodeURIComponent(ex.name + ' execução correta');
  openDialog(`
    <div class="dlg-head"><div><div class="eyebrow">${PATTERNS[ex.pattern]} · ${modeLabel(ex)}</div><h2 style="margin-top:6px">${esc(ex.name)}</h2></div>
      <button class="icon-btn" data-act="close" aria-label="Fechar">✕</button></div>
    <div class="stack">
      <div class="chips">${ex.groups.map((g) => `<span class="badge">${GROUPS[g]}</span>`).join('')}${ex.uni ? '<span class="badge">um lado por vez</span>' : ''}</div>
      <ol class="cues">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
      ${ex.mode !== 'body' ? `<p class="small muted">Cargas possíveis: ${loadOptions(state.kit, ex.mode).map((o) => fmtKg(o.kg)).join(' · ')} kg (máx. ${fmtKg(maxLoad(state.kit, ex.mode))} kg).</p>` : ''}
      <a class="btn block" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener noreferrer">▶ Ver vídeos no YouTube</a>
      ${alts.length ? `<div class="small muted">Alternativas: ${alts.map((a) => esc(a.name)).join(', ')}</div>` : ''}
    </div>`);
}

function showActivityForm() {
  openDialog(`
    <div class="dlg-head"><h2>Outra atividade</h2><button class="icon-btn" data-act="close" aria-label="Fechar">✕</button></div>
    <form class="stack" id="actForm">
      <label class="field"><span>O que fez</span><select id="actType">${['Caminhada', 'Corrida', 'Bicicleta', 'Alongamento / Yoga', 'Futebol / esporte', 'Natação', 'Dança', 'Outro'].map((t) => `<option>${t}</option>`).join('')}</select></label>
      <div class="row">
        <label class="field grow"><span>Quando</span><input type="datetime-local" id="actStart" value="${toLocalInput(Date.now())}"></label>
        <label class="field" style="width:110px"><span>Minutos</span><input type="number" inputmode="numeric" id="actMin" value="30" min="1"></label>
      </div>
      <label class="field"><span>Observações</span><input type="text" id="actNotes" placeholder="ex.: 5 km, ritmo leve"></label>
      <button class="btn primary big" type="submit">Salvar</button>
    </form>`);
}

function showWeightForm() {
  const last = [...state.weights].sort((a, b) => b.date - a.date)[0];
  openDialog(`
    <div class="dlg-head"><h2>Peso corporal</h2><button class="icon-btn" data-act="close" aria-label="Fechar">✕</button></div>
    <form class="stack" id="wForm">
      <div class="row">
        <label class="field grow"><span>Peso (kg)</span><input type="number" inputmode="decimal" step="0.1" id="wKg" value="${last ? last.kg : ''}" required></label>
        <label class="field grow"><span>Data</span><input type="date" id="wDate" value="${dayKey(Date.now())}"></label>
      </div>
      ${state.weights.length ? `<table class="detail-table">${[...state.weights].sort((a, b) => b.date - a.date).slice(0, 6).map((w) => `<tr><td>${fmtDate(w.date)}</td><td>${fmtKg(w.kg)} kg <button class="icon-btn" type="button" data-act="delWeight" data-id="${w.id}" aria-label="Apagar">✕</button></td></tr>`).join('')}</table>` : ''}
      <button class="btn primary big" type="submit">Salvar</button>
    </form>`);
}

function showPinForm() {
  openDialog(`
    <div class="dlg-head"><h2>${store.hasPin() ? 'Trocar PIN' : 'Criar PIN'}</h2><button class="icon-btn" data-act="close" aria-label="Fechar">✕</button></div>
    <form class="stack" id="pinForm">
      <p class="small muted">Com PIN, seus dados ficam criptografados neste aparelho. Se esquecer, não há recuperação — guarde um backup.</p>
      <label class="field"><span>Novo PIN (4 a 12 números)</span><input type="password" inputmode="numeric" id="pinA" maxlength="12" autocomplete="new-password"></label>
      <label class="field"><span>Repita</span><input type="password" inputmode="numeric" id="pinB" maxlength="12" autocomplete="new-password"></label>
      <p class="small accent" id="pinMsg" role="alert"></p>
      <button class="btn primary big" type="submit">Salvar PIN</button>
    </form>`);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'treino-em-casa', exportedAt: new Date().toISOString(), data: state }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `treino-backup-${dayKey(Date.now())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Backup exportado');
}

async function importBackup(file) {
  try {
    const json = JSON.parse(await file.text());
    const data = json.data || json;
    if (!data.profile || !Array.isArray(data.sessions)) throw new Error('formato');
    if (!(await confirmDialog('Importar backup?', `Isso substitui os dados atuais por ${data.sessions.length} treino(s) do backup.`, 'Importar'))) return;
    state = migrate(data);
    persist(); await store.flush();
    render(); toast('Backup importado');
  } catch {
    toast('Arquivo de backup inválido');
  }
}

// ───────────────────────── eventos ─────────────────────────
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const act = t.dataset.act;
  const i = +t.dataset.i, s = +t.dataset.s;
  const a = state?.active;

  switch (act) {
    case 'close': closeDialog(); break;

    // assistente
    case 'wz': draft[t.dataset.k] = isNaN(+t.dataset.v) ? t.dataset.v : +t.dataset.v; renderWizard(); break;
    case 'wzHome': {
      const v = t.dataset.v; draft.home = draft.home.includes(v) ? draft.home.filter((x) => x !== v) : [...draft.home, v]; renderWizard(); break;
    }
    case 'wzBack': draft.step--; renderWizard(); window.scrollTo(0, 0); break;
    case 'wzNext': if (draft.step < 4) { draft.step++; renderWizard(); window.scrollTo(0, 0); } else finishWizard(); break;

    case 'forgotPin':
      if (await confirmDialog('Esqueceu o PIN?', 'Os dados estão criptografados e não podem ser recuperados sem o PIN. Você pode apagar tudo e começar de novo (e depois importar um backup, se tiver).', 'Apagar e recomeçar', true)) {
        store.wipe(); state = null; render();
      }
      break;

    // hoje / plano
    case 'start': startWorkout(+t.dataset.w); break;
    case 'info': showInfo(t.dataset.ex); break;
    case 'logActivity': showActivityForm(); break;
    case 'logWeight': showWeightForm(); break;
    case 'delWeight': state.weights = state.weights.filter((w) => w.id !== t.dataset.id); persist(); showWeightForm(); render(); break;

    // sessão
    case 'toggleSet': {
      const st = a.exercises[i].sets[s];
      st.done = !st.done;
      if (st.done) {
        // propaga carga para as próximas séries não feitas
        a.exercises[i].sets.slice(s + 1).forEach((n) => { if (!n.done) n.kg = st.kg; });
        const last = a.exercises.every((x) => x.sets.every((y) => y.done));
        if (!last) startRest(a.exercises[i].target.rest);
      }
      persist(); render(); break;
    }
    case 'addSet': { const ss = a.exercises[i].sets; const l = ss.at(-1) || {}; ss.push({ kg: l.kg ?? null, reps: l.reps ?? null, secs: l.secs ?? null, done: false }); persist(); render(); break; }
    case 'delSet': { const ss = a.exercises[i].sets; if (ss.length > 1) ss.pop(); persist(); render(); break; }
    case 'removeEx':
      if (await confirmDialog('Remover exercício?', `Tirar <b>${esc(EX[a.exercises[i].exId].name)}</b> do treino de hoje?`, 'Remover', true)) { a.exercises.splice(i, 1); persist(); render(); }
      break;
    case 'swap': {
      ui.swapIdx = i;
      const cur = EX[a.exercises[i].exId];
      const same = candidates(cur.pattern, state.profile).filter((x) => x.id !== cur.id);
      exercisePicker('Trocar exercício', same.length ? same : EXERCISES.filter((x) => isAvailable(x, state.profile)), 'doSwap',
        `<label class="row small" style="margin-bottom:12px"><input type="checkbox" id="swapPlan" checked> Salvar a troca no plano</label>`);
      break;
    }
    case 'doSwap': {
      const keep = $('#swapPlan')?.checked;
      const old = a.exercises[ui.swapIdx].exId;
      a.exercises[ui.swapIdx] = makeEntry(t.dataset.ex);
      if (keep) {
        const w = state.plan.workouts.find((x) => x.key === a.workoutKey);
        const it = w?.items.find((x) => x.exId === old);
        if (it) it.exId = t.dataset.ex;
      }
      persist(); closeDialog(); render(); break;
    }
    case 'addEx': exercisePicker('Adicionar exercício', EXERCISES.filter((x) => isAvailable(x, state.profile)), 'doAddEx'); break;
    case 'doAddEx': a.exercises.push(makeEntry(t.dataset.ex)); persist(); closeDialog(); render(); setTimeout(() => document.getElementById('ex-' + (a.exercises.length - 1))?.scrollIntoView({ behavior: 'smooth' }), 50); break;
    case 'timeSet': startTimed(i, s); break;
    case 'timedStop': {
      const tm = ui.timed; if (!tm) { closeDialog(); break; }
      const el = Math.round(Math.max(0, tm.target * 1000 - Math.max(0, tm.end - Date.now())) / 1000);
      if (tm.prep) { ui.timed = null; closeDialog(); } else finishTimed(el);
      break;
    }
    case 'restAdd': if (ui.rest) { ui.rest.end += +t.dataset.v * 1000; ui.rest.total = Math.max(ui.rest.total, (ui.rest.end - Date.now()) / 1000); ui.rest.beeped = false; tickRest(); } break;
    case 'restSkip': ui.rest = null; renderRest(); break;
    case 'finish': showFinish(); break;
    case 'feel': ui.feel = +t.dataset.v; dlg.querySelectorAll('[data-act="feel"]').forEach((b) => b.setAttribute('aria-pressed', b === t)); break;
    case 'saveSession': saveSession(); break;
    case 'discard':
      if (await confirmDialog('Descartar treino?', 'As séries deste treino não serão salvas.', 'Descartar', true)) {
        state.active = null; ui.rest = null; persist(); keepAwake(false); location.hash = '#/hoje'; render();
      }
      break;

    // plano
    case 'planSwap': {
      ui.planSel = { w: +t.dataset.w, x: +t.dataset.x };
      const cur = EX[state.plan.workouts[ui.planSel.w].items[ui.planSel.x].exId];
      const same = candidates(cur.pattern, state.profile).filter((x) => x.id !== cur.id);
      exercisePicker('Trocar exercício', [...same, ...EXERCISES.filter((x) => x.pattern !== cur.pattern && isAvailable(x, state.profile))], 'doPlanSwap');
      break;
    }
    case 'doPlanSwap': { const it = state.plan.workouts[ui.planSel.w].items[ui.planSel.x]; it.exId = t.dataset.ex; it.pattern = EX[t.dataset.ex].pattern; persist(); closeDialog(); render(); break; }
    case 'planDel': state.plan.workouts[+t.dataset.w].items.splice(+t.dataset.x, 1); persist(); render(); break;
    case 'planMove': {
      const items = state.plan.workouts[+t.dataset.w].items; const x = +t.dataset.x; const d = +t.dataset.d;
      if (items[x + d]) [items[x], items[x + d]] = [items[x + d], items[x]];
      persist(); render(); break;
    }
    case 'planAdd': ui.planAddW = +t.dataset.w; exercisePicker('Adicionar ao treino', EXERCISES.filter((x) => isAvailable(x, state.profile)), 'doPlanAdd'); break;
    case 'doPlanAdd': state.plan.workouts[ui.planAddW].items.push({ exId: t.dataset.ex, pattern: EX[t.dataset.ex].pattern }); persist(); closeDialog(); render(); break;
    case 'regenPlan':
      if (await confirmDialog('Refazer o plano?', 'O plano será gerado de novo com seu perfil e equipamentos atuais. Trocas manuais serão perdidas; o histórico continua.', 'Refazer')) {
        state.plan = generatePlan(state.profile); persist(); render(); toast('Plano refeito');
      }
      break;

    // histórico
    case 'toggleLog': if (!e.target.closest('button')) { ui.openLog = ui.openLog === t.dataset.id ? null : t.dataset.id; render(); } break;
    case 'delSession':
      if (await confirmDialog('Apagar treino?', 'Esse registro será removido do histórico.', 'Apagar', true)) { state.sessions = state.sessions.filter((x) => x.id !== t.dataset.id); persist(); render(); }
      break;
    case 'delActivity':
      if (await confirmDialog('Apagar atividade?', 'Esse registro será removido do histórico.', 'Apagar', true)) { state.activities = state.activities.filter((x) => x.id !== t.dataset.id); persist(); render(); }
      break;
    case 'calNav': { const m = new Date(ui.calMonth); m.setMonth(m.getMonth() + +t.dataset.d); ui.calMonth = m.getTime(); ui.calDay = null; render(); break; }
    case 'calDay': ui.calDay = ui.calDay === t.dataset.k ? null : (t.dataset.k || null); render(); break;

    // ajustes
    case 'kitPreset': {
      const k = defaultKit(t.dataset.v); state.kit = { ...k, handle: state.kit.handle, connector: state.kit.connector }; persist(); render(); break;
    }
    case 'addPlate': {
      const kg = parseFloat(String($('#newPlate').value).replace(',', '.'));
      if (kg > 0) { const ex = state.kit.plates.find((p) => p.kg === kg); if (ex) ex.count += 2; else state.kit.plates.push({ kg, count: 2 }); state.kit.plates.sort((x, y) => y.kg - x.kg); state.kit.preset = 'custom'; persist(); render(); }
      break;
    }
    case 'toggleHome': {
      const v = t.dataset.v; const h = state.profile.home;
      state.profile.home = h.includes(v) ? h.filter((x) => x !== v) : [...h, v];
      persist(); render(); toast('Salvo. Refaça o plano para usar os novos itens.'); break;
    }
    case 'setPin': showPinForm(); break;
    case 'removePin':
      if (await confirmDialog('Remover PIN?', 'Os dados deixam de ser criptografados neste aparelho.', 'Remover', true)) { await store.setPin('', state); render(); toast('PIN removido'); }
      break;
    case 'lockNow': await store.flush(); store.lockNow(); state = null; render(); break;
    case 'export': exportBackup(); break;
    case 'wipe':
      if (await confirmDialog('Apagar tudo?', 'Todos os treinos, plano e configurações deste aparelho serão apagados permanentemente. Exporte um backup antes se quiser guardar.', 'Apagar tudo', true)) {
        store.wipe(); state = null; location.hash = '#/hoje'; render();
      }
      break;
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.d && draft) { draft[t.dataset.d] = t.value; return; }
  if (!state) return;
  if (t.dataset.field && state.active) {
    const st = state.active.exercises[+t.dataset.i].sets[+t.dataset.s];
    const v = t.value === '' ? null : parseFloat(t.value);
    st[t.dataset.field] = v;
    if (t.dataset.field === 'kg') {
      const ex = EX[state.active.exercises[+t.dataset.i].exId];
      const el = document.querySelector(`[data-setup="${t.dataset.i}"]`);
      if (el) el.textContent = describeSetup(state.kit, ex.mode, v);
    }
    persist();
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (!state) return;
  if (t.dataset.p) {
    const k = t.dataset.p;
    state.profile[k] = ['level', 'days', 'minutes'].includes(k) ? +t.value : t.value;
    persist(); toast('Salvo');
  } else if (t.dataset.plate) {
    state.kit.plates[+t.dataset.plate].count = Math.max(0, parseInt(t.value) || 0);
    state.kit.preset = 'custom'; persist(); render();
  } else if (t.dataset.kit) {
    state.kit[t.dataset.kit] = Math.max(0, parseFloat(String(t.value).replace(',', '.')) || 0); persist(); render();
  } else if (t.dataset.actChange === 'progEx') {
    ui.progEx = t.value; render();
  } else if (t.id === 'importFile' && t.files[0]) {
    importBackup(t.files[0]); t.value = '';
  }
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'lockForm') return doUnlock($('#pin').value);
  if (f.id === 'actForm') {
    state.activities.push({ id: uid(), type: $('#actType').value, start: new Date($('#actStart').value).getTime() || Date.now(), minutes: Math.max(1, +$('#actMin').value || 1), notes: $('#actNotes').value.trim() });
    persist(); closeDialog(); render(); toast('Atividade registrada');
  }
  if (f.id === 'wForm') {
    const kg = parseFloat(String($('#wKg').value).replace(',', '.'));
    if (!(kg > 0)) return;
    const date = new Date($('#wDate').value + 'T12:00').getTime() || Date.now();
    state.weights = state.weights.filter((w) => dayKey(w.date) !== dayKey(date));
    state.weights.push({ id: uid(), date, kg });
    persist(); closeDialog(); render(); toast('Peso registrado');
  }
  if (f.id === 'pinForm') {
    const a = $('#pinA').value, b = $('#pinB').value;
    if (!/^\d{4,12}$/.test(a)) return ($('#pinMsg').textContent = 'Use de 4 a 12 números.');
    if (a !== b) return ($('#pinMsg').textContent = 'Os PINs não conferem.');
    await store.setPin(a, state); closeDialog(); render(); toast('PIN salvo 🔒');
  }
});

// relógio
setInterval(() => {
  if (state?.active) document.querySelectorAll('[data-elapsed]').forEach((el) => { el.textContent = clock(Date.now() - state.active.start); });
  tickRest();
}, 500);
setInterval(tickTimed, 200);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.flush();
  else if (state?.active) keepAwake(true);
});
window.addEventListener('pagehide', () => store.flush());

// ───────────────────────── início ─────────────────────────
state = store.isLocked() ? null : (store.loadPlain() ? migrate(store.loadPlain()) : null);
render();
if (state?.active) keepAwake(true);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// gancho de teste
window.__treino = { get state() { return state; }, render };
