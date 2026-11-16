/**
 * Moteur de correction : aligne ce que la reconnaissance vocale a entendu
 * avec les mots attendus, à partir de la position courante du récitant.
 *
 * Principe : programmation dynamique (type distance d'édition) entre les mots
 * entendus et une fenêtre de mots attendus. Chaque mot attendu reçoit un statut :
 *  - correct : récité (ressemblance suffisante avec une des variantes acceptées)
 *  - wrong   : un autre mot a été dit à la place
 *  - skipped : oublié (le récitant est passé au mot suivant)
 * Les répétitions (revenir quelques mots en arrière) ne sont pas des fautes,
 * et relire correctement un mot faux le corrige.
 */
import { bestSimilarity, tokenize } from './arabic';

export type WordStatus = 'correct' | 'wrong' | 'skipped';

export interface ExpectedWord {
  /** Variantes normalisées acceptées pour ce mot. */
  k: readonly string[];
}

export interface EvalResult {
  statuses: (WordStatus | undefined)[];
  /** Index du prochain mot attendu. */
  cursor: number;
  /** Mots qui ont été faux ou oubliés au moins une fois (même corrigés ensuite). */
  mistakes: Set<number>;
}

const OK = 0.75; // ressemblance minimale pour accepter un mot
const OK_JOIN = 0.9; // plus strict quand on recolle des mots
const COST_MATCH = -0.6; // récompense : un mot reconnu fait avancer
const COST_WRONG = 1;
const COST_EXTRA = 0.5; // mot entendu en trop (répétition, bruit)
const COST_SKIP = 0.8; // mot attendu oublié
const COST_REREAD_GAP = 0.2; // sauter un mot déjà lu en revenant en arrière
const MAX_JOIN_HEARD = 5; // ex. lettres isolées : « kaf ha ya ain sad » = كهيعص
const BACKTRACK = 8;

type Op =
  | { kind: 'match'; i: number; j: number; ok: boolean }
  | { kind: 'joinHeard'; i: number; j: number; len: number }
  | { kind: 'join2expected'; i: number; j: number }
  | { kind: 'extra'; i: number }
  | { kind: 'skip'; j: number };

function pairVariants(a: ExpectedWord, b: ExpectedWord): string[] {
  const out: string[] = [];
  for (const x of a.k) for (const y of b.k) out.push(x + y);
  return out;
}

/** Aligne un morceau de transcription à partir de `cursor`. Modifie `statuses`/`mistakes`. */
export function alignChunk(
  words: readonly ExpectedWord[],
  cursor: number,
  heard: readonly string[],
  statuses: (WordStatus | undefined)[],
  mistakes: Set<number>,
): number {
  const n = heard.length;
  if (n === 0) return cursor;
  const base = Math.max(0, cursor - BACKTRACK);
  const end = Math.min(words.length, cursor + n * 2 + 6);
  const m = end - base;
  const startMax = cursor - base;

  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  const back: (Op & { pi: number; pj: number })[][] = Array.from({ length: n + 1 }, () => new Array(m + 1));
  for (let j = 0; j <= startMax; j++) cost[0][j] = 0;

  const relax = (i: number, j: number, v: number, op: Op, pi: number, pj: number) => {
    if (v < cost[i][j] - 1e-9) {
      cost[i][j] = v;
      back[i][j] = { ...op, pi, pj };
    }
  };

  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      const c = cost[i][j];
      if (c === Infinity) continue;
      const g = base + j; // index global du mot attendu j
      if (i < n && j < m) {
        const s = bestSimilarity(heard[i], words[g].k);
        const ok = s >= OK;
        relax(i + 1, j + 1, c + (ok ? COST_MATCH : COST_WRONG), { kind: 'match', i, j, ok }, i, j);
      }
      if (j < m) {
        let joined = heard[i] ?? '';
        for (let len = 2; len <= MAX_JOIN_HEARD && i + len <= n; len++) {
          joined += heard[i + len - 1];
          if (bestSimilarity(joined, words[g].k) >= OK_JOIN) {
            relax(i + len, j + 1, c + COST_MATCH, { kind: 'joinHeard', i, j, len }, i, j);
          }
        }
      }
      if (i < n && j + 1 < m) {
        const s = bestSimilarity(heard[i], pairVariants(words[g], words[g + 1]));
        if (s >= OK_JOIN) relax(i + 1, j + 2, c + 2 * COST_MATCH, { kind: 'join2expected', i, j }, i, j);
      }
      if (i < n) relax(i + 1, j, c + COST_EXTRA, { kind: 'extra', i }, i, j);
      if (j < m) relax(i, j + 1, c + (g < cursor ? COST_REREAD_GAP : COST_SKIP), { kind: 'skip', j }, i, j);
    }
  }

  // Fin libre : on choisit la meilleure position d'arrivée (la plus avancée à coût égal).
  let bestJ = -1;
  let bestC = Infinity;
  for (let j = 0; j <= m; j++) {
    if (cost[n][j] <= bestC + 1e-9) {
      bestC = cost[n][j];
      bestJ = j;
    }
  }

  const ops: Op[] = [];
  let i = n;
  let j = bestJ;
  while (back[i]?.[j]) {
    const b = back[i][j];
    ops.push(b);
    i = b.pi;
    j = b.pj;
  }
  ops.reverse();

  const set = (g: number, st: WordStatus) => {
    statuses[g] = st;
    if (st !== 'correct') mistakes.add(g);
  };
  for (const op of ops) {
    if (op.kind === 'match') set(base + op.j, op.ok ? 'correct' : 'wrong');
    else if (op.kind === 'joinHeard') set(base + op.j, 'correct');
    else if (op.kind === 'join2expected') {
      set(base + op.j, 'correct');
      set(base + op.j + 1, 'correct');
    } else if (op.kind === 'skip') {
      const g = base + op.j;
      if (g >= cursor && statuses[g] === undefined) set(g, 'skipped');
    }
  }
  return Math.max(cursor, base + bestJ);
}

/** Recalcule tout l'état à partir des transcriptions successives (une par tranche audio). */
export function evaluate(words: readonly ExpectedWord[], start: number, chunks: readonly string[]): EvalResult {
  const statuses: (WordStatus | undefined)[] = new Array(words.length);
  const mistakes = new Set<number>();
  let cursor = start;
  for (const chunk of chunks) {
    cursor = alignChunk(words, cursor, tokenize(chunk), statuses, mistakes);
  }
  return { statuses, cursor, mistakes };
}
