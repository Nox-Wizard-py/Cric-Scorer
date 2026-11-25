import React, { ReactNode } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

interface ScreenWrapperProps {
    children: ReactNode;
    style?: ViewStyle;
    noPadding?: boolean;
}

export const ScreenWrapper = ({ children, style, noPadding = false }: ScreenWrapperProps) => {
    const { colors } = useTheme();
    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }, style, noPadding && { padding: 0 }]}>
            {children}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        padding: 16, // Default padding
    },
});
