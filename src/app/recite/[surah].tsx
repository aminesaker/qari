import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuranFont, Spacing, type Palette } from '@/constants/theme';
import { useRecitation } from '@/hooks/use-recitation';
import { useTheme } from '@/hooks/use-theme';
import type { WordStatus } from '@/lib/matcher';
import { arabicNumber, BASMALA, flatten, type QWord } from '@/lib/quran';
import { LAST_KEY } from '@/lib/storage';

export default function ReciteScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ surah: string; ayah?: string }>();
  const flat = useMemo(() => flatten(Number(params.surah) || 1), [params.surah]);
  const { surah, words, ayahStart, ayahOf } = flat;

  const initialAyah = Math.min(Math.max(Number(params.ayah) || 1, 1), surah.ayahs.length);
  const [startAyah, setStartAyah] = useState(initialAyah);
  const start = ayahStart[startAyah - 1];
  const [hidden, setHidden] = useState(false);
  const [hint, setHint] = useState<number | null>(null);

  const rec = useRecitation(flat, start);
  const { statuses, cursor, mistakes } = rec.result;
  const listening = rec.state === 'listening';
  const finished = cursor >= words.length;
  const currentAyah = finished ? surah.ayahs.length : ayahOf[cursor];

  // Défilement automatique vers le verset en cours + sauvegarde de la position.
  const list = useRef<FlatList<QWord[]>>(null);
  useEffect(() => {
    if (!rec.hasStarted) return;
    list.current?.scrollToIndex({ index: currentAyah - 1, viewPosition: 0.25, animated: true });
    AsyncStorage.setItem(LAST_KEY, JSON.stringify({ surah: surah.n, ayah: currentAyah })).catch(() => {});
  }, [currentAyah, rec.hasStarted, surah.n]);

  const { stop } = rec;
  useEffect(() => {
    if (finished && listening) void stop();
  }, [finished, listening, stop]);

  const correctCount = useMemo(() => statuses.filter((s) => s === 'correct').length, [statuses]);

  const pickAyah = (ayah: number) => {
    if (listening) return;
    setStartAyah(ayah);
    rec.reset();
  };

  const showHint = () => {
    setHint(cursor);
    setTimeout(() => setHint(null), 2500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          title: surah.tname,
          headerRight: () => (
            <Pressable onPress={() => setHidden((h) => !h)} hitSlop={12}>
              <Text style={{ color: c.accent, fontSize: 16 }}>{hidden ? 'Afficher' : 'Masquer'}</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        ref={list}
        data={surah.ayahs}
        keyExtractor={(_, i) => String(i)}
        extraData={statuses}
        contentContainerStyle={{ padding: Spacing.three, paddingBottom: 220 + insets.bottom }}
        onScrollToIndexFailed={({ index, averageItemLength }) =>
          list.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.surahName, { color: c.text }]}>{surah.name}</Text>
            {surah.n !== 1 && surah.n !== 9 ? (
              <Text style={[styles.basmala, { color: c.textSecondary }]}>{BASMALA}</Text>
            ) : null}
            {!rec.hasStarted ? (
              <Text style={[styles.tip, { color: c.textSecondary }]}>
                Touche un verset pour commencer à partir de celui-ci, puis appuie sur le micro.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const from = ayahStart[index];
          const sig = item
            .map((_, w) => {
              const g = from + w;
              return (statuses[g] ?? '-')[0] + (g === cursor ? 'C' : '') + (g === hint ? 'H' : '');
            })
            .join('');
          return (
            <Ayah
              words={item}
              from={from}
              number={index + 1}
              sig={sig + (hidden ? 'h' : '') + (index + 1 === startAyah ? 's' : '') + (from + item.length <= cursor ? 'd' : '') + (listening ? 'L' : '') + (rec.hasStarted ? 'S' : '') + start}
              statuses={statuses}
              cursor={cursor}
              start={start}
              hidden={hidden}
              hint={hint}
              isStart={index + 1 === startAyah && !rec.hasStarted}
              onPress={() => pickAyah(index + 1)}
              c={c}
            />
          );
        }}
      />

      <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.border, paddingBottom: insets.bottom + Spacing.three }]}>
        {finished && rec.hasStarted ? (
          <Text style={[styles.done, { color: c.correct }]}>
            Sourate terminée · {mistakes.size === 0 ? 'aucune faute 🎉' : `${mistakes.size} mot(s) à revoir`}
          </Text>
        ) : (
          <Text style={[styles.status, { color: rec.error ? c.wrong : c.textSecondary }]} numberOfLines={2}>
            {rec.error
              ? rec.error
              : rec.state === 'loading'
                ? 'Préparation…'
                : listening
                  ? rec.speaking
                    ? 'Je t’écoute…'
                    : 'Récite quand tu es prêt'
                  : rec.hasStarted
                    ? 'En pause'
                    : `Départ : verset ${startAyah}`}
          </Text>
        )}

        <View style={styles.controls}>
          <View style={styles.side}>
            <Stat label="justes" value={correctCount} color={c.correct} />
            <Stat label="à revoir" value={mistakes.size} color={c.wrong} />
          </View>

          <Pressable
            onPress={() => (listening ? rec.stop() : rec.begin())}
            disabled={rec.state === 'loading'}
            accessibilityLabel={listening ? 'Arrêter' : 'Commencer à réciter'}
            style={({ pressed }) => [
              styles.mic,
              { backgroundColor: listening ? c.wrong : c.accent, transform: [{ scale: pressed ? 0.95 : rec.speaking ? 1.06 : 1 }] },
            ]}>
            {rec.state === 'loading' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.micIcon}>{listening ? '■' : '🎙'}</Text>
            )}
          </Pressable>

          <View style={[styles.side, { alignItems: 'flex-end' }]}>
            {hidden && !finished ? <SmallButton label="Indice" onPress={showHint} c={c} /> : null}
            {rec.hasStarted && !listening ? <SmallButton label="Recommencer" onPress={rec.reset} c={c} /> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

interface AyahProps {
  words: QWord[];
  from: number;
  number: number;
  sig: string;
  statuses: (WordStatus | undefined)[];
  cursor: number;
  start: number;
  hidden: boolean;
  hint: number | null;
  isStart: boolean;
  onPress: () => void;
  c: Palette;
}

const Ayah = memo(
  function Ayah({ words, from, number, statuses, cursor, start, hidden, hint, isStart, onPress, c }: AyahProps) {
    return (
      <Pressable onPress={onPress} style={[styles.ayah, isStart && { backgroundColor: c.accentSoft }]}>
        <Text style={[styles.ayahText, { color: c.text }]}>
          {words.map((w, i) => {
            const g = from + i;
            const st = statuses[g];
            const isCurrent = g === cursor;
            const masked = hidden && g >= start && g >= cursor && st === undefined && g !== hint;
            const color = masked ? 'transparent' : st ? c[st] : c.text;
            return (
              <Text key={i}>
                <Text
                  style={[
                    { color },
                    masked && { backgroundColor: c.hidden },
                    isCurrent && !masked && { backgroundColor: c.current },
                    st === 'skipped' && styles.skipped,
                  ]}>
                  {w.t}
                </Text>
                {w.m ? <Text style={{ color: c.accent }}> {w.m}</Text> : null}{' '}
              </Text>
            );
          })}
          <Text style={{ color: c.accent }}>{`﴿${arabicNumber(number)}﴾`}</Text>
        </Text>
      </Pressable>
    );
  },
  (a, b) => a.sig === b.sig && a.c === b.c,
);

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View>
      <Text style={{ color, fontSize: 20, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color, fontSize: 12, opacity: 0.8 }}>{label}</Text>
    </View>
  );
}

function SmallButton({ label, onPress, c }: { label: string; onPress: () => void; c: Palette }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.small, { borderColor: c.border }]}>
      <Text style={{ color: c.accent, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.three },
  surahName: { fontFamily: QuranFont, fontSize: 36 },
  basmala: { fontFamily: QuranFont, fontSize: 24 },
  tip: { fontSize: 14, textAlign: 'center', marginTop: Spacing.two },
  ayah: { borderRadius: 12, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  ayahText: { fontFamily: QuranFont, fontSize: 28, lineHeight: 60, textAlign: 'right', writingDirection: 'rtl' },
  skipped: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  status: { textAlign: 'center', fontSize: 15 },
  done: { textAlign: 'center', fontSize: 16, fontWeight: '700' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { flex: 1, flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  mic: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  micIcon: { fontSize: 30, color: '#fff' },
  small: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
});
