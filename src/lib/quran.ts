/** Accès au texte du Coran (Tanzil, Uthmani) généré par scripts/build-quran-data.py. */

export interface QWord {
  /** Texte uthmani affiché. */
  t: string;
  /** Variantes normalisées acceptées (cf. src/lib/arabic.ts). */
  k: string[];
  /** Signe(s) de pause qui suivent le mot. */
  m?: string;
}

export interface Surah {
  n: number;
  name: string;
  tname: string;
  ename: string;
  type: 'Meccan' | 'Medinan';
  ayahs: QWord[][];
}

interface QuranData {
  source: string;
  basmala: string[];
  surahs: Surah[];
}

const data = require('../../assets/quran.json') as QuranData;

export const SURAHS: readonly Surah[] = data.surahs;
export const BASMALA = data.basmala.join(' ');
export const SOURCE_NOTICE = data.source;

export function getSurah(n: number): Surah {
  return data.surahs[n - 1];
}

export interface FlatSurah {
  surah: Surah;
  words: QWord[];
  /** Index du premier mot de chaque verset dans `words`. */
  ayahStart: number[];
  /** Numéro de verset (1-based) de chaque mot. */
  ayahOf: number[];
}

const cache = new Map<number, FlatSurah>();

export function flatten(n: number): FlatSurah {
  const hit = cache.get(n);
  if (hit) return hit;
  const surah = getSurah(n);
  const words: QWord[] = [];
  const ayahStart: number[] = [];
  const ayahOf: number[] = [];
  surah.ayahs.forEach((ayah, i) => {
    ayahStart.push(words.length);
    for (const w of ayah) {
      words.push(w);
      ayahOf.push(i + 1);
    }
  });
  const flat = { surah, words, ayahStart, ayahOf };
  cache.set(n, flat);
  return flat;
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function arabicNumber(n: number): string {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}

export function revelationLabel(type: Surah['type']): string {
  return type === 'Meccan' ? 'Mecquoise' : 'Médinoise';
}
