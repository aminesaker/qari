import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { QuranFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { skeleton } from '@/lib/arabic';
import { LAST_KEY } from '@/lib/storage';
import { getSurah, revelationLabel, SURAHS, type Surah } from '@/lib/quran';

export default function SurahList() {
  const c = useTheme();
  const [query, setQuery] = useState('');
  const [last, setLast] = useState<{ surah: number; ayah: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(LAST_KEY)
        .then((v) => setLast(v ? JSON.parse(v) : null))
        .catch(() => {});
    }, []),
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SURAHS;
    const qAr = skeleton(q);
    return SURAHS.filter(
      (s) =>
        String(s.n) === q ||
        s.tname.toLowerCase().replace(/[^a-z]/g, '').includes(q.replace(/[^a-z]/g, '') || '\u0000') ||
        (qAr.length > 0 && skeleton(s.name).includes(qAr)),
    );
  }, [query]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/about" asChild>
              <Pressable hitSlop={12}>
                <Text style={{ color: c.accent, fontSize: 16 }}>À propos</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <FlatList
        style={{ backgroundColor: c.background }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={list}
        keyExtractor={(s) => String(s.n)}
        ListHeaderComponent={
          <View style={{ gap: Spacing.three, paddingBottom: Spacing.two }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher (nom ou numéro)"
              placeholderTextColor={c.textSecondary}
              style={[styles.search, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {last && !query ? (
              <Link href={{ pathname: '/recite/[surah]', params: { surah: last.surah, ayah: last.ayah } }} asChild>
                <Pressable style={[styles.resume, { backgroundColor: c.accent }]}>
                  <Text style={styles.resumeLabel}>Reprendre</Text>
                  <Text style={styles.resumeText}>
                    {getSurah(last.surah).tname} · verset {last.ayah}
                  </Text>
                </Pressable>
              </Link>
            ) : null}
          </View>
        }
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
        renderItem={({ item }) => <SurahRow surah={item} />}
      />
    </>
  );
}

function SurahRow({ surah }: { surah: Surah }) {
  const c = useTheme();
  return (
    <Link href={{ pathname: '/recite/[surah]', params: { surah: surah.n } }} asChild>
      <Pressable style={({ pressed }) => [styles.row, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
        <View style={[styles.badge, { backgroundColor: c.accentSoft }]}>
          <Text style={{ color: c.accent, fontWeight: '700' }}>{surah.n}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tname, { color: c.text }]}>{surah.tname}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>
            {revelationLabel(surah.type)} · {surah.ayahs.length} versets
          </Text>
        </View>
        <Text style={[styles.arabic, { color: c.text }]}>{surah.name}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  resume: { borderRadius: 14, padding: Spacing.three },
  resumeLabel: { color: '#fff', opacity: 0.85, fontSize: 13, fontWeight: '600' },
  resumeText: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: 14, padding: 14 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tname: { fontSize: 17, fontWeight: '600' },
  arabic: { fontFamily: QuranFont, fontSize: 24 },
});

