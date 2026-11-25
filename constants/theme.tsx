import React, { createContext, useContext } from 'react';
import { LIGHT_PALETTE, ThemePalette } from './colors';

interface ThemeContextValue {
    theme: ThemePalette;
    isDark: false;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: LIGHT_PALETTE,
    isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeContext.Provider value={{ theme: LIGHT_PALETTE, isDark: false }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
