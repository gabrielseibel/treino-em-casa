// Biblioteca de exercícios.
// mode: 'pair' (2 halteres), 'single' (1 halter), 'bar' (barra longa), 'body' (peso corporal)
// req: itens da casa necessários (ids de HOME_ITEMS)
// kind: 'compound' | 'iso' | 'core' | 'cardio'
// lvl: 1 iniciante, 2 intermediário, 3 avançado
// start: carga inicial sugerida p/ iniciante (kg por halter ou total da barra, incluindo a barra)
// metric: 'reps' | 'time'

export const HOME_ITEMS = [
  { id: 'banco', label: 'Banco, cadeira firme ou caixa', hint: 'Supino, búlgaro, step-up, remada apoiada' },
  { id: 'sofa', label: 'Sofá ou cama', hint: 'Apoio das costas na elevação pélvica' },
  { id: 'mesa', label: 'Mesa firme e pesada', hint: 'Remada invertida por baixo da mesa' },
  { id: 'degrau', label: 'Degrau ou escada', hint: 'Panturrilha com amplitude total' },
  { id: 'colchonete', label: 'Colchonete ou tapete', hint: 'Abdominais e exercícios no chão' },
  { id: 'mochila', label: 'Mochila resistente', hint: 'Colocar anilhas e usar como carga extra' },
  { id: 'toalha', label: 'Toalha', hint: 'Deslizamentos e alongamento' },
  { id: 'elastico', label: 'Faixa / tubo elástico', hint: 'Puxadas e remadas' },
  { id: 'barrafixa', label: 'Barra fixa (porta ou parede)', hint: 'Barra fixa e australiana' },
];

export const GROUPS = {
  peito: 'Peito', costas: 'Costas', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps',
  quadriceps: 'Quadríceps', posterior: 'Posterior / Glúteos', panturrilha: 'Panturrilha', core: 'Core', cardio: 'Cardio',
};

export const PATTERNS = {
  squat: 'Agachamento', lunge: 'Unilateral de pernas', hinge: 'Quadril / posterior', push_h: 'Empurrar (peito)',
  push_v: 'Empurrar (ombro)', pull_h: 'Puxar (remada)', pull_v: 'Puxar (vertical)', delt_lat: 'Ombro lateral',
  delt_rear: 'Ombro posterior', biceps: 'Bíceps', triceps: 'Tríceps', calf: 'Panturrilha', core: 'Core', cardio: 'Condicionamento',
};

const E = (id, name, pattern, mode, opts = {}) => ({
  id, name, pattern, mode,
  req: opts.req || [], kind: opts.kind || 'compound', lvl: opts.lvl || 1,
  start: opts.start ?? null, metric: opts.metric || 'reps', uni: !!opts.uni,
  groups: opts.groups || [], cues: opts.cues || [], harder: opts.harder || null,
});

export const EXERCISES = [
  // ── Agachamento
  E('goblet', 'Agachamento goblet', 'squat', 'single', { start: 6, groups: ['quadriceps', 'posterior'], harder: 'agach_barra',
    cues: ['Segure um halter na vertical junto ao peito.', 'Pés na largura dos ombros, pontas levemente para fora.', 'Desça entre as pernas mantendo o peito alto e os calcanhares no chão.', 'Suba empurrando o chão.'] }),
  E('agach_barra', 'Agachamento com barra nas costas', 'squat', 'bar', { lvl: 2, start: 12, groups: ['quadriceps', 'posterior'], harder: 'bulgaro',
    cues: ['Apoie a barra (parte com espuma) no trapézio, nunca no pescoço.', 'Tronco firme, desça até as coxas ficarem paralelas ao chão.', 'Joelhos acompanham a direção dos pés.', 'Coloque e tire a barra das costas com cuidado, de um lado por vez se necessário.'] }),
  E('agach_halteres', 'Agachamento com halteres', 'squat', 'pair', { start: 4, groups: ['quadriceps', 'posterior'], harder: 'bulgaro',
    cues: ['Halteres ao lado do corpo, braços estendidos.', 'Desça sentando para trás, peito alto.', 'Suba sem deixar os joelhos caírem para dentro.'] }),
  E('agach_livre', 'Agachamento livre', 'squat', 'body', { kind: 'compound', groups: ['quadriceps', 'posterior'], harder: 'goblet',
    cues: ['Braços à frente para equilíbrio.', 'Desça até onde conseguir manter a coluna neutra.', 'Controle a descida em 2 segundos.'] }),

  // ── Unilateral de pernas
  E('bulgaro', 'Agachamento búlgaro', 'lunge', 'pair', { req: ['banco'], lvl: 2, start: 3, uni: true, groups: ['quadriceps', 'posterior'],
    cues: ['Peito do pé de trás apoiado no banco/cadeira.', 'Pé da frente afastado ~2 pés do banco.', 'Desça na vertical até o joelho de trás quase tocar o chão.', 'Faça todas as reps de uma perna, depois troque.'] }),
  E('afundo_rev', 'Afundo reverso com halteres', 'lunge', 'pair', { start: 3, uni: true, groups: ['quadriceps', 'posterior'], harder: 'bulgaro',
    cues: ['Dê um passo para trás e desça até os dois joelhos formarem ~90°.', 'Volte empurrando com o calcanhar da perna da frente.', 'Alterne as pernas ou faça uma de cada vez.'] }),
  E('stepup', 'Subida no banco (step-up)', 'lunge', 'pair', { req: ['banco'], start: 3, uni: true, groups: ['quadriceps', 'posterior'],
    cues: ['Use um banco/cadeira firme e estável, encostado na parede.', 'Suba usando só a perna de cima, sem impulsionar com a de baixo.', 'Desça controlando.'] }),
  E('afundo_livre', 'Afundo (peso corporal)', 'lunge', 'body', { uni: true, groups: ['quadriceps', 'posterior'], harder: 'afundo_rev',
    cues: ['Passo à frente, desça até ~90° nos dois joelhos.', 'Tronco reto, volte à posição inicial.'] }),

  // ── Quadril / posterior
  E('stiff_barra', 'Stiff com barra', 'hinge', 'bar', { start: 12, groups: ['posterior'],
    cues: ['Joelhos levemente flexionados e fixos.', 'Empurre o quadril para trás deslizando a barra pelas coxas.', 'Coluna neutra; desça até sentir alongar a parte de trás da coxa.', 'Suba contraindo os glúteos.'] }),
  E('stiff_halteres', 'Stiff com halteres', 'hinge', 'pair', { start: 5, groups: ['posterior'],
    cues: ['Halteres na frente das coxas.', 'Quadril para trás, costas retas, joelhos quase estendidos.', 'Suba contraindo glúteos.'] }),
  E('elev_pelvica', 'Elevação pélvica com barra', 'hinge', 'bar', { req: ['sofa'], start: 12, kind: 'compound', groups: ['posterior'],
    cues: ['Parte alta das costas apoiada no sofá/cama, barra sobre o quadril (use a espuma ou uma toalha).', 'Pés firmes, joelhos a 90° no topo.', 'Suba até alinhar tronco e coxas, segure 1 s, desça controlando.'] }),
  E('stiff_uni', 'Stiff unilateral com halter', 'hinge', 'single', { lvl: 2, start: 6, uni: true, groups: ['posterior'],
    cues: ['Halter na mão oposta à perna de apoio.', 'Incline o tronco enquanto a perna livre vai para trás.', 'Quadril nivelado, volte devagar.'] }),
  E('ponte_halter', 'Ponte de glúteo com halter', 'hinge', 'single', { start: 6, groups: ['posterior'],
    cues: ['Deitado de costas, joelhos dobrados, halter sobre o quadril.', 'Suba o quadril contraindo glúteos, segure 1 s.'] }),
  E('terra_barra', 'Levantamento terra com barra', 'hinge', 'bar', { lvl: 2, start: 14, groups: ['posterior', 'costas'],
    cues: ['Barra sobre o meio dos pés, pegada fora das pernas.', 'Peito alto, costas retas, empurre o chão com as pernas.', 'As anilhas são pequenas: se precisar, apoie-as em livros para começar mais alto.'] }),
  E('ponte_livre', 'Ponte de glúteo', 'hinge', 'body', { kind: 'compound', groups: ['posterior'], harder: 'ponte_halter',
    cues: ['Deitado de costas, suba o quadril contraindo glúteos.', 'Segure 2 s no topo.'] }),

  // ── Empurrar horizontal
  E('supino_halteres', 'Supino com halteres no banco', 'push_h', 'pair', { req: ['banco'], start: 5, groups: ['peito', 'triceps'],
    cues: ['Deite em um banco firme (ou 2 cadeiras/caixa) com os pés no chão.', 'Desça os halteres até a linha do peito, cotovelos a ~45° do corpo.', 'Empurre para cima sem bater os halteres.'] }),
  E('floor_press', 'Supino no chão com halteres', 'push_h', 'pair', { start: 5, groups: ['peito', 'triceps'],
    cues: ['Deitado no chão, joelhos dobrados.', 'Desça até os cotovelos tocarem o chão de leve.', 'Empurre os halteres para cima.'] }),
  E('flexao', 'Flexão de braço', 'push_h', 'body', { groups: ['peito', 'triceps'], harder: 'flexao_decl',
    cues: ['Mãos um pouco mais largas que os ombros.', 'Corpo em linha reta da cabeça aos pés.', 'Desça até o peito quase tocar o chão. Iniciante: apoie os joelhos.'] }),
  E('floor_press_barra', 'Supino no chão com barra', 'push_h', 'bar', { start: 12, groups: ['peito', 'triceps'],
    cues: ['Deitado, barra sobre o peito, pegada um pouco mais larga que os ombros.', 'Desça até os tríceps tocarem o chão, empurre.'] }),
  E('flexao_incl', 'Flexão inclinada (mãos no banco)', 'push_h', 'body', { req: ['banco'], groups: ['peito', 'triceps'], harder: 'flexao',
    cues: ['Mãos no banco/cadeira encostado na parede.', 'Corpo reto, desça o peito até o banco.'] }),
  E('flexao_decl', 'Flexão declinada (pés no banco)', 'push_h', 'body', { req: ['banco'], lvl: 2, groups: ['peito', 'ombros', 'triceps'],
    cues: ['Pés no banco, mãos no chão.', 'Corpo firme, desça controlando.'] }),
  E('crucifixo', 'Crucifixo com halteres', 'push_h', 'pair', { kind: 'iso', start: 3, groups: ['peito'],
    cues: ['Deitado (chão ou banco), braços levemente dobrados.', 'Abra os braços em arco até sentir alongar o peito.', 'Feche como se abraçasse uma árvore.'] }),

  // ── Empurrar vertical
  E('desenv_halteres', 'Desenvolvimento com halteres', 'push_v', 'pair', { start: 4, groups: ['ombros', 'triceps'],
    cues: ['Sentado ou em pé, halteres na altura das orelhas.', 'Empurre para cima sem arquear a lombar.', 'Abdômen contraído.'] }),
  E('desenv_barra', 'Desenvolvimento militar com barra', 'push_v', 'bar', { start: 10, groups: ['ombros', 'triceps'],
    cues: ['Em pé, barra na frente dos ombros.', 'Contraia glúteos e abdômen, empurre a barra acima da cabeça.', 'Tire a cabeça do caminho e volte ao centro no topo.'] }),
  E('arnold', 'Arnold press', 'push_v', 'pair', { lvl: 2, start: 3, groups: ['ombros'],
    cues: ['Comece com palmas para você na altura do queixo.', 'Gire as palmas para frente enquanto sobe.'] }),
  E('pike', 'Flexão pike (ombro)', 'push_v', 'body', { lvl: 2, groups: ['ombros', 'triceps'],
    cues: ['Quadril alto, corpo em "V" invertido.', 'Dobre os cotovelos levando a cabeça em direção ao chão.'] }),

  // ── Puxar horizontal
  E('remada_uni', 'Remada unilateral apoiada', 'pull_h', 'single', { start: 7, uni: true, groups: ['costas', 'biceps'],
    cues: ['Mão e joelho apoiados no banco/cadeira (ou mão na coxa).', 'Puxe o halter em direção ao quadril.', 'Costas retas, sem girar o tronco.'] }),
  E('remada_barra', 'Remada curvada com barra', 'pull_h', 'bar', { start: 12, groups: ['costas', 'biceps'],
    cues: ['Tronco inclinado ~45°, costas retas, joelhos levemente dobrados.', 'Puxe a barra até o umbigo, juntando as escápulas.', 'Desça controlando.'] }),
  E('remada_halteres', 'Remada curvada com halteres', 'pull_h', 'pair', { start: 5, groups: ['costas', 'biceps'],
    cues: ['Tronco inclinado, halteres pendurados.', 'Puxe os dois halteres em direção ao quadril.'] }),
  E('remada_mesa', 'Remada invertida sob a mesa', 'pull_h', 'body', { req: ['mesa'], groups: ['costas', 'biceps'],
    cues: ['Teste antes se a mesa aguenta e não tomba!', 'Deite embaixo, segure a borda e puxe o peito até a mesa.', 'Corpo reto; joelhos dobrados facilita.'] }),
  E('remada_elastico', 'Remada com elástico', 'pull_h', 'body', { req: ['elastico'], groups: ['costas', 'biceps'],
    cues: ['Prenda o elástico nos pés ou em um ponto firme.', 'Puxe juntando as escápulas.'] }),

  // ── Puxar vertical
  E('barra_fixa', 'Barra fixa', 'pull_v', 'body', { req: ['barrafixa'], lvl: 2, groups: ['costas', 'biceps'],
    cues: ['Pegada pronada, um pouco mais larga que os ombros.', 'Puxe até o queixo passar da barra.', 'Não consegue? Faça só a descida lenta (5 s).'] }),
  E('pulldown_elastico', 'Puxada com elástico', 'pull_v', 'body', { req: ['elastico'], groups: ['costas'],
    cues: ['Elástico preso no alto (porta).', 'Puxe em direção ao peito, cotovelos para baixo.'] }),
  E('pullover', 'Pullover com halter', 'pull_v', 'single', { start: 6, groups: ['costas', 'peito'],
    cues: ['Deitado (banco ou chão), halter seguro com as duas mãos acima do peito.', 'Leve para trás da cabeça com braços quase estendidos.', 'Volte puxando com as costas.'] }),

  // ── Ombros
  E('elev_lateral', 'Elevação lateral', 'delt_lat', 'pair', { kind: 'iso', start: 2.5, groups: ['ombros'],
    cues: ['Braços levemente dobrados.', 'Eleve até a altura dos ombros, cotovelos guiando.', 'Desça devagar (2-3 s).'] }),
  E('remada_alta', 'Remada alta com barra', 'delt_lat', 'bar', { kind: 'iso', start: 8, groups: ['ombros'],
    cues: ['Pegada na largura dos ombros.', 'Puxe a barra até a linha do peito, cotovelos para os lados e acima das mãos.'] }),
  E('crucifixo_inv', 'Crucifixo inverso curvado', 'delt_rear', 'pair', { kind: 'iso', start: 2.5, groups: ['ombros', 'costas'],
    cues: ['Tronco inclinado à frente, costas retas.', 'Abra os braços para os lados juntando as escápulas.'] }),
  E('ytw', 'Y-T-W deitado', 'delt_rear', 'body', { kind: 'iso', req: ['colchonete'], groups: ['ombros', 'costas'],
    cues: ['De bruços, levante os braços formando Y, depois T, depois W.', 'Cada letra = 1 rep.'] }),

  // ── Bíceps
  E('rosca_barra', 'Rosca direta com barra', 'biceps', 'bar', { kind: 'iso', start: 8, groups: ['biceps'],
    cues: ['Cotovelos colados ao corpo.', 'Suba sem balançar o tronco, desça em 2-3 s.'] }),
  E('rosca_alt', 'Rosca alternada', 'biceps', 'pair', { kind: 'iso', start: 4, groups: ['biceps'],
    cues: ['Gire a palma para cima enquanto sobe.', 'Alterne os braços.'] }),
  E('rosca_martelo', 'Rosca martelo', 'biceps', 'pair', { kind: 'iso', start: 4, groups: ['biceps'],
    cues: ['Palmas viradas uma para a outra o tempo todo.', 'Cotovelos fixos.'] }),
  E('rosca_conc', 'Rosca concentrada', 'biceps', 'single', { kind: 'iso', start: 4, uni: true, groups: ['biceps'],
    cues: ['Sentado, cotovelo apoiado na parte interna da coxa.', 'Suba e aperte o bíceps no topo.'] }),

  // ── Tríceps
  E('triceps_frances', 'Tríceps francês com halter', 'triceps', 'single', { kind: 'iso', start: 5, groups: ['triceps'],
    cues: ['Segure um halter com as duas mãos atrás da cabeça.', 'Cotovelos apontados para cima e fixos.', 'Estenda os braços.'] }),
  E('triceps_testa', 'Tríceps testa com halteres', 'triceps', 'pair', { kind: 'iso', start: 3, groups: ['triceps'],
    cues: ['Deitado, braços estendidos acima do peito, palmas se olhando.', 'Dobre só os cotovelos levando os halteres ao lado da cabeça.'] }),
  E('mergulho_banco', 'Mergulho no banco', 'triceps', 'body', { kind: 'iso', req: ['banco'], groups: ['triceps'],
    cues: ['Mãos na borda do banco/cadeira firme, quadril próximo.', 'Desça dobrando os cotovelos até ~90°.', 'Sinta desconforto no ombro? troque de exercício.'] }),
  E('coice', 'Tríceps coice', 'triceps', 'pair', { kind: 'iso', start: 2.5, groups: ['triceps'],
    cues: ['Tronco inclinado, cotovelos colados ao corpo e altos.', 'Estenda os braços para trás.'] }),
  E('flexao_diamante', 'Flexão diamante', 'triceps', 'body', { kind: 'iso', lvl: 2, groups: ['triceps', 'peito'],
    cues: ['Mãos juntas formando um losango sob o peito.', 'Cotovelos para trás, rente ao corpo.'] }),

  // ── Panturrilha
  E('panturrilha_degrau', 'Panturrilha unilateral no degrau', 'calf', 'single', { kind: 'iso', req: ['degrau'], start: 6, uni: true, groups: ['panturrilha'],
    cues: ['Ponta do pé na borda do degrau, segure em algo para equilíbrio.', 'Desça o calcanhar até alongar, suba o máximo, segure 1 s.'] }),
  E('panturrilha_halteres', 'Panturrilha em pé com halteres', 'calf', 'pair', { kind: 'iso', start: 6, groups: ['panturrilha'],
    cues: ['Suba na ponta dos pés o máximo possível.', 'Segure 1 s no topo, desça devagar.'] }),

  // ── Core
  E('prancha', 'Prancha', 'core', 'body', { kind: 'core', metric: 'time', groups: ['core'],
    cues: ['Antebraços no chão, corpo reto.', 'Contraia glúteos e abdômen, não deixe o quadril cair.'] }),
  E('dead_bug', 'Dead bug', 'core', 'body', { kind: 'core', groups: ['core'],
    cues: ['Deitado de costas, braços para cima, joelhos a 90°.', 'Estenda braço e perna opostos sem tirar a lombar do chão.'] }),
  E('elev_pernas', 'Elevação de pernas', 'core', 'body', { kind: 'core', lvl: 2, groups: ['core'],
    cues: ['Deitado, mãos sob o quadril.', 'Suba as pernas estendidas e desça sem encostar no chão.'] }),
  E('russian_twist', 'Russian twist com halter', 'core', 'single', { kind: 'core', start: 3, groups: ['core'],
    cues: ['Sentado, tronco inclinado para trás, pés no chão (ou elevados).', 'Gire o tronco levando o halter de um lado ao outro.'] }),
  E('prancha_lateral', 'Prancha lateral', 'core', 'body', { kind: 'core', metric: 'time', uni: true, groups: ['core'],
    cues: ['Apoio no antebraço e lateral do pé.', 'Quadril alto, corpo em linha.'] }),
  E('farmer', 'Caminhada do fazendeiro', 'core', 'pair', { kind: 'core', metric: 'time', start: 8, groups: ['core', 'costas'],
    cues: ['Halteres pesados ao lado do corpo.', 'Caminhe com postura alta e ombros para trás.'] }),

  // ── Condicionamento
  E('thruster', 'Thruster com halteres', 'cardio', 'pair', { kind: 'cardio', start: 3, groups: ['cardio', 'quadriceps', 'ombros'],
    cues: ['Agache com halteres nos ombros.', 'Ao subir, empurre os halteres acima da cabeça em um movimento só.'] }),
  E('polichinelo', 'Polichinelo', 'cardio', 'body', { kind: 'cardio', metric: 'time', groups: ['cardio'], cues: ['Ritmo constante, respire.'] }),
  E('burpee', 'Burpee', 'cardio', 'body', { kind: 'cardio', lvl: 2, groups: ['cardio'],
    cues: ['Agache, mãos no chão, pés para trás, (flexão opcional), volte e salte.'] }),
  E('mountain', 'Escalador (mountain climber)', 'cardio', 'body', { kind: 'cardio', metric: 'time', groups: ['cardio', 'core'],
    cues: ['Posição de prancha alta, traga os joelhos ao peito alternando rápido.'] }),
];

export const EX = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export const WARMUP = [
  'Polichinelo ou marcha no lugar — 1 min',
  'Rotação de ombros e braços — 30 s',
  'Agachamento livre lento — 10 reps',
  'Bom-dia sem peso (quadril para trás) — 10 reps',
  'Flexão inclinada ou na parede — 8 reps',
  '1 série leve do primeiro exercício',
];
