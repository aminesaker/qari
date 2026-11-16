import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1B1B18',
    textSecondary: '#6B6A63',
    background: '#FAF7F0',
    card: '#FFFFFF',
    border: '#E7E1D3',
    accent: '#0F6B4F',
    accentSoft: '#DCEFE6',
    correct: '#11865F',
    wrong: '#C8352E',
    skipped: '#C77A00',
    current: '#F1E6C4',
    hidden: '#E7E1D3',
  },
  dark: {
    text: '#F2EFE6',
    textSecondary: '#A6A398',
    background: '#121411',
    card: '#1C1F1B',
    border: '#2C302A',
    accent: '#3DBB8A',
    accentSoft: '#1D3A2F',
    correct: '#4CCB95',
    wrong: '#FF6B61',
    skipped: '#F2A93B',
    current: '#3A3524',
    hidden: '#2C302A',
  },
} as const;

export type Palette = { [K in keyof typeof Colors.light]: string };

/** Police coranique (Amiri Quran, licence OFL), intégrée au build par expo-font. */
export const QuranFont = Platform.select({ ios: 'Amiri Quran', default: 'AmiriQuran-Regular' });

export const Spacing = { one: 4, two: 8, three: 16, four: 24, five: 32 } as const;
