import React, { ReactNode } from 'react';
import { StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenWrapperProps {
    children: ReactNode;
    style?: ViewStyle;
    noPadding?: boolean;
}

export const ScreenWrapper = ({ children, style, noPadding = false }: ScreenWrapperProps) => {
    return (
        <LinearGradient
            // Deep rich gradient: Dark Blue/Grey -> Teal/Grey
            colors={['#0f2027', '#203a43', '#2c5364']}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={[styles.safeArea, style, noPadding && { padding: 0 }]}>
                {children}
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        padding: 16, // Default padding
    },
});
