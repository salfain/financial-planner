export const lightColors = {
  background: '#f3f6f4',
  surface: '#ffffff',
  surfaceAlt: '#eaf0ec',
  text: '#15201b',
  textMuted: '#617169',
  primary: '#126b59',
  primaryPressed: '#0d594a',
  primarySoft: '#ddefe8',
  positive: '#16876f',
  negative: '#d65b67',
  warning: '#b87316',
  info: '#4e79c7',
  border: '#d6e1da',
  disabled: '#9aaba2',
  skeleton: '#e2e9e5',
  overlay: 'rgba(14, 21, 18, 0.46)',
  tabBar: '#ffffff',
} as const;

export const darkColors = {
  background: '#0e1512',
  surface: '#151f1b',
  surfaceAlt: '#1b2923',
  text: '#ecf4ef',
  textMuted: '#a8b9b0',
  primary: '#43b997',
  primaryPressed: '#62c9ac',
  primarySoft: '#173c31',
  positive: '#56c9a8',
  negative: '#ff7c88',
  warning: '#f0b75d',
  info: '#7ea6f3',
  border: '#293a33',
  disabled: '#73847b',
  skeleton: '#22322b',
  overlay: 'rgba(0, 0, 0, 0.62)',
  tabBar: '#151f1b',
} as const;

export type AppColors = { [Key in keyof typeof lightColors]: string };

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const shadows = {
  card: {
    shadowColor: '#0b3b30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  fab: {
    shadowColor: '#071d17',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

export const categoryColors = {
  food: '#16876f',
  housing: '#d4685c',
  bills: '#da9a3a',
  transport: '#4e79c7',
  entertainment: '#aa67a6',
  investment: '#5574b8',
  health: '#d26b7a',
} as const;
