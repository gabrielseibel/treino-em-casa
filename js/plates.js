// Cálculo das cargas possíveis com as anilhas do kit.

export const KIT_PRESETS = {
  '15': { label: 'Kit 15 kg', plates: [{ kg: 2, count: 4 }, { kg: 1.5, count: 4 }] },
  '20': { label: 'Kit 20 kg', plates: [{ kg: 2, count: 4 }, { kg: 1.5, count: 4 }, { kg: 1.25, count: 4 }] },
};

// As barras do kit somam ~1 kg (kit "15 kg" = 14 kg de anilhas + barras).
export const defaultKit = (preset = '20') => ({
  preset,
  plates: KIT_PRESETS[preset].plates.map((p) => ({ ...p })),
  handle: 0.35,    // cada barra curta de halter (35 cm)
  connector: 0.3,  // conector de 40 cm que vira barra longa
});

const r2 = (n) => Math.round(n * 100) / 100;

export const baseWeight = (kit, mode) => (mode === 'bar' ? 2 * kit.handle + kit.connector : kit.handle);

// Quantas anilhas de cada tipo cabem em UM lado, conforme o modo de uso.
const perSideLimit = (count, mode) => Math.floor(count / (mode === 'pair' ? 4 : 2));

const cache = new Map();

// Lista ordenada de { kg, side: [pesos das anilhas em um lado] } — kg é o total de 1 halter ou da barra.
export function loadOptions(kit, mode) {
  if (mode === 'body') return [];
  const key = JSON.stringify([kit, mode]);
  if (cache.has(key)) return cache.get(key);
  const types = kit.plates.filter((p) => p.count > 0).map((p) => ({ kg: p.kg, max: perSideLimit(p.count, mode) }));
  const best = new Map();
  const walk = (i, side) => {
    if (i === types.length) {
      const kg = r2(baseWeight(kit, mode) + 2 * side.reduce((a, b) => a + b, 0));
      const prev = best.get(kg);
      if (!prev || side.length < prev.side.length) best.set(kg, { kg, side: [...side].sort((a, b) => b - a) });
      return;
    }
    for (let n = 0; n <= types[i].max; n++) walk(i + 1, [...side, ...Array(n).fill(types[i].kg)]);
  };
  walk(0, []);
  const list = [...best.values()].sort((a, b) => a.kg - b.kg);
  cache.set(key, list);
  return list;
}

export function snap(kit, mode, target) {
  const opts = loadOptions(kit, mode);
  if (!opts.length) return null;
  // carga mais próxima do alvo; em empate, a mais leve
  let pick = opts[0];
  for (const o of opts) if (Math.abs(o.kg - target) < Math.abs(pick.kg - target) - 0.001) pick = o;
  return pick;
}

export function stepWeight(kit, mode, kg, dir) {
  const opts = loadOptions(kit, mode);
  if (!opts.length) return null;
  if (dir > 0) return (opts.find((o) => o.kg > kg + 0.001) || opts[opts.length - 1]);
  return ([...opts].reverse().find((o) => o.kg < kg - 0.001) || opts[0]);
}

export const maxLoad = (kit, mode) => {
  const o = loadOptions(kit, mode);
  return o.length ? o[o.length - 1].kg : 0;
};

export function describeSetup(kit, mode, kg) {
  const opt = loadOptions(kit, mode).find((o) => Math.abs(o.kg - kg) < 0.001);
  if (!opt) return '';
  const what = mode === 'bar' ? 'Barra longa' : mode === 'pair' ? 'Cada halter' : 'Halter';
  if (!opt.side.length) return `${what}: só a barra`;
  return `${what}: ${opt.side.map(fmtKg).join(' + ')} kg de cada lado`;
}

export const fmtKg = (n) => (n == null ? '–' : String(r2(n)).replace('.', ','));
