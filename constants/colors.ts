import { Platform } from 'react-native';

export const APP_FONT_FAMILY = Platform.select({
    android: 'sans-serif',
    ios: 'System',
    default: 'System',
});

export interface ThemePalette {
    mode: 'light';
    background: string;
    surface: string;
    surfaceSubtle: string;
    surfaceAlt: string;
    headerBg: string;
    headerSubtle: string;
    headerText: string;
    headerMuted: string;
    scoreboxBg: string;
    scoreboxText: string;
    scoreboxMuted: string;
    scoreAccent: string;
    border: string;
    borderSubtle: string;
    textPrimary: string;
    textSecondary: string;
    textPlaceholder: string;
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    danger: string;
    onDanger: string;
    dangerContainer: string;
    onDangerContainer: string;
    warning: string;
    onWarning: string;
    tabBarBg: string;
    tabBarBorder: string;
    tabActiveBg: string;
    tabActive: string;
    tabInactive: string;
    keypadKeyBg: string;
    keypadKeyBorder: string;
    keypadActionBg: string;
    keypadActionText: string;
    modalOverlay: string;
}

export const LIGHT_PALETTE: ThemePalette = {
    mode: 'light',
    background: '#EDEFF2',
    surface: '#F7F8FA',
    surfaceSubtle: '#E6EBF0',
    surfaceAlt: '#E6ECF2',
    headerBg: '#102030',
    headerSubtle: '#1B3249',
    headerText: '#F7F8FA',
    headerMuted: '#A7C0D8',
    scoreboxBg: '#162B40',
    scoreboxText: '#F7F8FA',
    scoreboxMuted: '#A7C0D8',
    scoreAccent: '#34D399',
    border: '#CFD8E2',
    borderSubtle: '#E0E6ED',
    textPrimary: '#102030',
    textSecondary: '#4A6075',
    textPlaceholder: '#647A8F',
    primary: '#00B48A',
    onPrimary: '#F7F8FA',
    primaryContainer: '#D6F5EC',
    onPrimaryContainer: '#005C46',
    danger: '#C92A2A',
    onDanger: '#F7F8FA',
    dangerContainer: '#FDE8E8',
    onDangerContainer: '#991B1B',
    warning: '#F59E0B',
    onWarning: '#102030',
    tabBarBg: '#F7F8FA',
    tabBarBorder: '#CFD8E2',
    tabActiveBg: '#D6F5EC',
    tabActive: '#00B48A',
    tabInactive: '#3B5066',
    keypadKeyBg: '#ECEFF3',
    keypadKeyBorder: '#C7D1DC',
    keypadActionBg: '#162B40',
    keypadActionText: '#F7F8FA',
    modalOverlay: 'rgba(10, 20, 32, 0.72)',
};

export const COLORS = LIGHT_PALETTE;
