import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../constants/theme';

interface ScreenWrapperProps {
    children: ReactNode;
    style?: ViewStyle;
    noPadding?: boolean;
    edges?: Edge[];
    headerBackground?: string;
}

export const ScreenWrapper = ({
    children,
    style,
    noPadding = false,
    edges = ['top'],
    headerBackground,
}: ScreenWrapperProps) => {
    const { theme } = useTheme();
    const topColor = headerBackground ?? theme.headerBg;

    return (
        <View style={[styles.root, { backgroundColor: theme.background }]}>
            <StatusBar style="light" />
            <SafeAreaView
                edges={edges}
                style={[styles.safeArea, { backgroundColor: topColor }]}
            >
                <View
                    style={[
                        styles.body,
                        { backgroundColor: theme.background },
                        !noPadding && styles.padded,
                        style,
                    ]}
                >
                    {children}
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    body: {
        flex: 1,
    },
    padded: {
        padding: 16,
    },
});
