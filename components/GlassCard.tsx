import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassCardProps extends ViewProps {
    children: ReactNode;
    style?: ViewStyle;
    intensity?: number;
}

export const GlassCard = ({ children, style, intensity = 20, ...props }: GlassCardProps) => {
    return (
        <BlurView intensity={intensity} tint="dark" style={[styles.container, style]} {...props}>
            <View style={styles.borderLayer} />
            {children}
        </BlurView>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        padding: 16,
    },
    borderLayer: {
        ...StyleSheet.absoluteFill,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 24,
        pointerEvents: 'none',
    },
});
