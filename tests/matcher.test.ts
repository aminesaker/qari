import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate } from '../src/lib/matcher.ts';
import { tokenize } from '../src/lib/arabic.ts';

const data = JSON.parse(readFileSync(new URL('../assets/quran.json', import.meta.url), 'utf8'));
const surahWords = (n: number) => data.surahs[n - 1].ayahs.flat();
const fatiha = surahWords(1); // 29 mots

test('récitation parfaite (orthographe moderne, avec voyelles)', () => {
  const r = evaluate(fatiha, 0, [
    'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ الرحمن الرحيم مالك يوم الدين',
    'إياك نعبد وإياك نستعين اهدنا الصراط المستقيم',
    'صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين',
  ]);
  assert.equal(r.cursor, fatiha.length);
  assert.equal(r.mistakes.size, 0);
  assert.ok(r.statuses.every((s) => s === 'correct'));
});

test('mot oublié', () => {
  const r = evaluate(fatiha, 4, ['الحمد لله العالمين الرحمن الرحيم']);
  assert.equal(r.statuses[6], 'skipped'); // رَبِّ
  assert.equal(r.statuses[7], 'correct');
  assert.equal(r.cursor, 10);
});

test('mot faux puis correction en relisant', () => {
  const r1 = evaluate(fatiha, 4, ['الحمد لله رب العالمين مالك يوم الحساب']);
  // الرحمن الرحيم oubliés, الدين remplacé par الحساب
  assert.equal(r1.statuses[8], 'skipped');
  // le dernier mot faux reste « en attente » tant que la suite n'est pas entendue
  assert.notEqual(r1.statuses[12], 'correct');
  const r1b = evaluate(fatiha, 4, ['الحمد لله رب العالمين مالك يوم الحساب إياك نعبد']);
  assert.equal(r1b.statuses[12], 'wrong');
  const r2 = evaluate(fatiha, 4, ['الحمد لله رب العالمين مالك يوم الحساب إياك نعبد', 'مالك يوم الدين']);
  assert.equal(r2.statuses[12], 'correct');
  assert.ok(r2.mistakes.has(12));
});

test('répétition non comptée comme faute', () => {
  const r = evaluate(fatiha, 4, ['الحمد لله رب', 'رب العالمين الرحمن']);
  assert.equal(r.mistakes.size, 0);
  assert.equal(r.cursor, 9);
});

test('variante uthmani / moderne : يا أيها en deux mots', () => {
  const baqara = surahWords(2);
  let start = 0;
  for (let a = 0; a < 20; a++) start += data.surahs[1].ayahs[a].length;
  const r = evaluate(baqara, start, ['يا أيها الناس اعبدوا ربكم الذي خلقكم']);
  assert.equal(r.mistakes.size, 0);
  assert.equal(r.cursor, start + 6);
});

test('lettres isolées prononcées : alif lam mim', () => {
  const r = evaluate(surahWords(2), 0, ['ألف لام ميم ذلك الكتاب لا ريب فيه']);
  assert.equal(r.mistakes.size, 0);
  assert.equal(r.cursor, 6);
});

test('bruit sans rapport : la position ne bouge pas', () => {
  const r = evaluate(fatiha, 4, ['شكرا جزيلا']);
  assert.equal(r.cursor, 4);
  assert.equal(r.mistakes.size, 0);
});

test('tokenize retire voyelles et ponctuation', () => {
  assert.deepEqual(tokenize('ٱلْحَمْدُ لِلَّهِ، رَبِّ'), ['الحمد', 'لله', 'رب']);
});
