// Gera o plano de treino e as sugestões de carga/reps.
import { EXERCISES, EX } from './exercises.js';
import { snap, stepWeight, maxLoad } from './plates.js';

export const GOALS = {
  hipertrofia: 'Ganhar massa muscular',
  forca: 'Ficar mais forte',
  emagrecer: 'Emagrecer / definir',
  saude: 'Saúde e disposição',
};
export const LEVELS = { 1: 'Iniciante', 2: 'Intermediário', 3: 'Avançado' };

const s = (p, v = 0) => ({ p, v });

const TEMPLATES = {
  fullA: { name: 'Corpo todo A', slots: [s('squat'), s('push_h'), s('pull_h'), s('hinge'), s('push_v'), s('core'), s('biceps'), s('triceps')] },
  fullB: { name: 'Corpo todo B', slots: [s('hinge', 1), s('push_h', 1), s('pull_v'), s('lunge'), s('delt_lat'), s('core', 1), s('calf'), s('triceps', 1)] },
  fullC: { name: 'Corpo todo C', slots: [s('lunge', 1), s('push_v', 1), s('pull_h', 1), s('hinge', 2), s('push_h', 2), s('delt_rear'), s('core', 2), s('biceps', 1)] },
  upperA: { name: 'Superior A', slots: [s('push_h'), s('pull_h'), s('push_v'), s('pull_v'), s('delt_lat'), s('biceps'), s('triceps'), s('core')] },
  lowerA: { name: 'Inferior A', slots: [s('squat'), s('hinge'), s('lunge'), s('calf'), s('core', 1), s('hinge', 4)] },
  upperB: { name: 'Superior B', slots: [s('push_v', 1), s('pull_h', 1), s('push_h', 1), s('delt_rear'), s('pull_v', 1), s('triceps', 1), s('biceps', 1), s('core', 2)] },
  lowerB: { name: 'Inferior B', slots: [s('hinge', 2), s('lunge', 1), s('squat', 1), s('calf'), s('core'), s('hinge', 1)] },
  push: { name: 'Empurrar (peito, ombro, tríceps)', slots: [s('push_h'), s('push_v'), s('push_h', 1), s('delt_lat'), s('triceps'), s('triceps', 1), s('core')] },
  pull: { name: 'Puxar (costas, bíceps)', slots: [s('pull_h'), s('pull_v'), s('pull_h', 1), s('delt_rear'), s('biceps'), s('biceps', 1), s('core', 1)] },
  legs: { name: 'Pernas', slots: [s('squat'), s('hinge'), s('lunge'), s('hinge', 2), s('calf'), s('core', 2)] },
};

const SPLITS = {
  2: [['fullA'], ['fullB']],
  3: [['fullA'], ['fullB'], ['fullC']],
  4: [['upperA'], ['lowerA'], ['upperB'], ['lowerB']],
  5: [['push'], ['pull'], ['legs'], ['upperA', 1], ['lowerA', 1]],
  6: [['push'], ['pull'], ['legs'], ['push', 1, ' 2'], ['pull', 1, ' 2'], ['legs', 1, ' 2']],
};

export const SPLIT_NAMES = { 2: 'Corpo todo A/B', 3: 'Corpo todo A/B/C', 4: 'Superior / Inferior', 5: 'Empurrar / Puxar / Pernas + Sup/Inf', 6: 'Empurrar / Puxar / Pernas ×2' };

const EX_COUNT = { 30: 4, 45: 5, 60: 7, 75: 8 };

export const isAvailable = (ex, profile) =>
  ex.req.every((r) => profile.home.includes(r)) && ex.lvl <= profile.level;

export const candidates = (pattern, profile) => EXERCISES.filter((e) => e.pattern === pattern && isAvailable(e, profile));

export function generatePlan(profile) {
  const days = Math.min(6, Math.max(2, profile.days));
  const count = EX_COUNT[profile.minutes] || 5;
  const workouts = SPLITS[days].map(([tk, offset = 0, suffix = ''], i) => {
    const t = TEMPLATES[tk];
    const used = new Set();
    const items = [];
    for (const slot of t.slots) {
      if (items.length >= count) break;
      const c = candidates(slot.p, profile);
      if (!c.length) continue;
      let pick = null;
      for (let k = 0; k < c.length && !pick; k++) {
        const ex = c[(slot.v + offset + k) % c.length];
        if (!used.has(ex.id)) pick = ex;
      }
      if (!pick) continue;
      used.add(pick.id);
      items.push({ exId: pick.id, pattern: slot.p });
    }
    if (profile.goal === 'emagrecer') {
      const fin = candidates('cardio', profile);
      if (fin.length) items.push({ exId: fin[(i + offset) % fin.length].id, pattern: 'cardio' });
    }
    return { key: `w${i}`, name: t.name + suffix, items };
  });
  return { createdAt: Date.now(), days, workouts };
}

// Séries, repetições e descanso de acordo com objetivo, nível e tipo do exercício.
export function prescription(ex, profile) {
  const { goal, level } = profile;
  if (ex.metric === 'time') {
    const secs = ex.kind === 'cardio' ? 30 : [0, 30, 45, 60][level];
    return { sets: 3, secs, rest: ex.kind === 'cardio' ? 30 : 45 };
  }
  if (ex.kind === 'cardio') return { sets: 3, repMin: 10, repMax: 15, rest: 40 };
  if (ex.kind === 'core') return { sets: 3, repMin: 10, repMax: 15, rest: 45 };
  const T = ex.kind === 'compound'
    ? { hipertrofia: [3, 8, 12, 90], forca: [4, 6, 10, 150], emagrecer: [3, 12, 15, 45], saude: [3, 10, 15, 60] }
    : { hipertrofia: [3, 10, 15, 60], forca: [3, 8, 12, 75], emagrecer: [2, 15, 20, 30], saude: [2, 12, 15, 45] };
  let [sets, repMin, repMax, rest] = T[goal] || T.hipertrofia;
  if (level === 3 && ex.kind === 'compound' && goal !== 'emagrecer') sets += 1;
  if (ex.mode === 'body' && ex.kind === 'compound') { repMin = Math.max(repMin, 8); repMax = Math.max(repMax, 15); }
  return { sets, repMin, repMax, rest };
}

const LEVEL_FACTOR = { 1: 1, 2: 1.35, 3: 1.7 };

// Última vez que o exercício foi feito (sessões em ordem cronológica).
export function lastPerformance(exId, sessions) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const e = (sessions[i].exercises || []).find((x) => x.exId === exId);
    if (e && e.sets.some((st) => st.done)) return { session: sessions[i], entry: e };
  }
  return null;
}

// Sugere carga e alvo para hoje com base no último treino (progressão dupla).
export function suggest(exId, sessions, profile, kit) {
  const ex = EX[exId];
  const p = prescription(ex, profile);
  const last = lastPerformance(exId, sessions);
  const out = { kg: null, reps: p.repMax ? p.repMin : null, secs: p.secs || null, note: '', last };

  if (!last) {
    if (ex.mode !== 'body' && ex.start) out.kg = snap(kit, ex.mode, ex.start * LEVEL_FACTOR[profile.level]).kg;
    out.note = ex.mode === 'body' ? 'Primeira vez: ache um ritmo controlado.' : 'Primeira vez: ajuste a carga se ficar fácil ou pesado demais.';
    return out;
  }

  const done = last.entry.sets.filter((st) => st.done);
  if (ex.metric === 'time') {
    const all = done.length >= p.sets && done.every((st) => (st.secs || 0) >= (last.entry.target?.secs || p.secs));
    const base = Math.max(...done.map((st) => st.secs || 0), p.secs);
    out.secs = all ? base + 5 : base;
    if (ex.mode !== 'body') out.kg = Math.max(...done.map((st) => st.kg || 0)) || null;
    out.note = all ? 'Bateu o tempo em todas: +5 s hoje.' : 'Mesmo tempo: tente completar todas as séries.';
    return out;
  }

  const kg = ex.mode === 'body' ? null : Math.max(...done.map((st) => st.kg || 0));
  const atKg = ex.mode === 'body' ? done : done.filter((st) => (st.kg || 0) === kg);
  const reps = atKg.map((st) => st.reps || 0);
  const allTop = atKg.length >= p.sets && reps.every((r) => r >= p.repMax);
  const anyLow = reps.some((r) => r < p.repMin);
  out.kg = kg;

  if (ex.mode === 'body') {
    const best = Math.max(...reps, 0);
    out.reps = Math.min(best + 1, p.repMax + 10);
    if (allTop) {
      const h = ex.harder && EX[ex.harder];
      out.note = h ? `Está fácil! Considere trocar por: ${h.name}.` : 'Está fácil: desça em 3 s ou use a mochila com anilhas.';
    } else out.note = 'Tente +1 repetição em cada série.';
    return out;
  }

  if (allTop) {
    const up = stepWeight(kit, ex.mode, kg, +1);
    if (up && up.kg > kg + 0.001) {
      out.kg = up.kg; out.reps = p.repMin;
      out.note = `Bateu ${p.repMax} reps em todas as séries: suba a carga.`;
    } else {
      out.reps = p.repMax;
      const h = ex.harder && EX[ex.harder];
      out.note = `Peso máximo do kit (${String(maxLoad(kit, ex.mode)).replace('.', ',')} kg). Desça em 3-4 s e pause 1 s embaixo` + (h ? `, ou troque por ${h.name}.` : '.');
      out.maxed = true;
    }
  } else if (anyLow) {
    out.reps = p.repMin;
    out.note = 'Mantenha a carga e busque chegar a ' + p.repMin + '+ reps em todas.';
  } else {
    out.reps = Math.min(p.repMax, Math.min(...reps) + 1);
    out.note = 'Mesma carga: tente +1 repetição.';
  }
  return out;
}

// Carga total levantada (2 halteres contam em dobro).
export const setLoad = (ex, kg) => (kg || 0) * (ex.mode === 'pair' ? 2 : 1);

export const est1RM = (kg, reps) => (kg && reps ? kg * (1 + reps / 30) : 0);

export function sessionVolume(session) {
  let v = 0;
  for (const e of session.exercises || []) {
    const ex = EX[e.exId];
    if (!ex) continue;
    for (const st of e.sets) if (st.done && st.reps) v += setLoad(ex, st.kg) * st.reps;
  }
  return Math.round(v);
}

export function nextWorkoutIndex(plan, sessions) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const idx = plan.workouts.findIndex((w) => w.key === sessions[i].workoutKey);
    if (idx >= 0 && sessions[i].planCreatedAt === plan.createdAt) return (idx + 1) % plan.workouts.length;
  }
  return 0;
}
