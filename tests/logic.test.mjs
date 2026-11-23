import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultKit, loadOptions, maxLoad, stepWeight, describeSetup } from '../js/plates.js';
import { generatePlan, suggest, prescription, isAvailable } from '../js/program.js';
import { EXERCISES, EX } from '../js/exercises.js';

const kit20 = defaultKit('20');
const kit15 = defaultKit('15');

test('kit 20: cargas possíveis', () => {
  // par: cada halter recebe 1 anilha de cada tipo por lado
  assert.deepEqual(loadOptions(kit20, 'pair').map((o) => o.kg), [0.35, 2.85, 3.35, 4.35, 5.85, 6.85, 7.35, 9.85]);
  // barra longa usa todas as anilhas: 2×(4+3+2,5) + 1 kg de barra
  assert.equal(maxLoad(kit20, 'bar'), 20);
  assert.equal(maxLoad(kit20, 'single'), 19.35);
  assert.equal(maxLoad(kit15, 'bar'), 15);
  assert.equal(maxLoad(kit15, 'pair'), 7.35);
});

test('montagem e passos de carga', () => {
  assert.equal(describeSetup(kit20, 'pair', 5.85), 'Cada halter: 1,5 + 1,25 kg de cada lado');
  assert.equal(stepWeight(kit20, 'pair', 5.85, 1).kg, 6.85);
  assert.equal(stepWeight(kit20, 'pair', 9.85, 1).kg, 9.85);
});

test('plano respeita dias, tempo e equipamento', () => {
  for (const days of [2, 3, 4, 5, 6]) for (const minutes of [30, 45, 60, 75]) for (const level of [1, 2, 3]) {
    const profile = { goal: 'hipertrofia', level, days, minutes, home: [] };
    const plan = generatePlan(profile);
    assert.equal(plan.workouts.length, days);
    for (const w of plan.workouts) {
      assert.ok(w.items.length >= 3, `${days}d ${minutes}m: ${w.name} tem ${w.items.length}`);
      const ids = w.items.map((i) => i.exId);
      assert.equal(new Set(ids).size, ids.length, 'sem repetidos');
      for (const id of ids) assert.ok(isAvailable(EX[id], profile), `${id} indisponível`);
    }
  }
});

test('todos os exercícios têm dados válidos', () => {
  for (const e of EXERCISES) {
    assert.ok(e.cues.length, e.id);
    assert.ok(e.groups.length, e.id);
    if (e.mode !== 'body' && e.metric === 'reps') assert.ok(e.start, e.id + ' sem carga inicial');
    if (e.harder) assert.ok(EX[e.harder], e.id + ' harder inválido');
  }
});

test('progressão dupla', () => {
  const profile = { goal: 'hipertrofia', level: 1, days: 3, minutes: 45, home: ['banco'] };
  const p = prescription(EX.supino_halteres, profile);
  const s0 = suggest('supino_halteres', [], profile, kit20);
  assert.equal(s0.kg, 4.35); // 5 kg sugerido → maior carga possível ≤ 5

  const mk = (kg, reps) => [{ start: 1, exercises: [{ exId: 'supino_halteres', sets: reps.map((r) => ({ kg, reps: r, done: true })) }] }];
  assert.equal(suggest('supino_halteres', mk(4.35, [p.repMax, p.repMax, p.repMax]), profile, kit20).kg, 5.85);
  const mid = suggest('supino_halteres', mk(4.35, [10, 9, 9]), profile, kit20);
  assert.equal(mid.kg, 4.35); assert.equal(mid.reps, 10);
  const maxed = suggest('supino_halteres', mk(9.85, [12, 12, 12]), profile, kit20);
  assert.ok(maxed.maxed);
});
