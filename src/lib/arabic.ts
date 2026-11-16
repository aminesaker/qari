/**
 * Normalisation de l'arabe pour comparer la récitation au texte.
 * On garde seulement le "squelette" des lettres : sans voyelles, sans signes
 * coraniques, avec les variantes d'alif / hamza / ya / ta marbuta unifiées.
 * Doit rester identique à skeleton() dans scripts/build-quran-data.py.
 */

const DIACRITICS = /[ؐ-ًؚ-ٟۖ-ۭـ]/g;
const NON_LETTERS = /[^ء-ي]/g;

export function skeleton(word: string): string {
  return word
    .replace(/ٰ/g, 'ا')
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(NON_LETTERS, '')
    .replace(/اا+/g, 'ا');
}

/** Découpe une transcription en mots normalisés (mots vides retirés). */
export function tokenize(text: string): string[] {
  return text
    .split(/[\s،؛؟.,!?:;()"'«»-]+/)
    .map(skeleton)
    .filter((w) => w.length > 0);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/** Meilleure ressemblance entre un mot entendu et les variantes acceptées d'un mot attendu. */
export function bestSimilarity(heard: string, variants: readonly string[]): number {
  let best = 0;
  for (const v of variants) {
    const s = similarity(heard, v);
    if (s > best) best = s;
    if (best === 1) break;
  }
  return best;
}
