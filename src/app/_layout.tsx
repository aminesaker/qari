import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, background: c.background, card: c.background, text: c.text, primary: c.accent, border: c.border },
      }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: c.accent, headerTitleStyle: { color: c.text } }}>
        <Stack.Screen name="index" options={{ title: 'Sourates', headerLargeTitle: true }} />
        <Stack.Screen name="recite/[surah]" options={{ title: '' }} />
        <Stack.Screen name="about" options={{ title: 'À propos', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
