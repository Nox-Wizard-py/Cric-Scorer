import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassButtonProps {
    onPress: () => void;
    title: string;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    variant?: 'primary' | 'secondary' | 'glass';
}

export const GlassButton = ({ onPress, title, style, textStyle, variant = 'primary' }: GlassButtonProps) => {

    if (variant === 'glass') {
        return (
            <TouchableOpacity style={[styles.glassBtn, style]} onPress={onPress}>
                <Text style={[styles.text, textStyle]}>{title}</Text>
            </TouchableOpacity>
        );
    }

    // Primary uses a vibrant gradient
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.container, style]}>
            <LinearGradient
                colors={['#15A3C7', '#0E8CA8']} // Cyan Blue Gradient
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                <Text style={[styles.textPrimary, textStyle]}>{title}</Text>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 50,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#15A3C7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        borderWidth: 1, // Match glass button border
        borderColor: 'transparent', // Invisible but takes space
    },
    gradient: {
        width: '100%', // Fill parent
        height: '100%', // Fill parent
        alignItems: 'center',
        justifyContent: 'center',
    },
    glassBtn: {
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center', // Added to ensure vertical centering
    },
    text: {
        color: '#fff',
        fontSize: 14, // Unified size
        fontWeight: 'bold',
    },
    textPrimary: {
        color: '#FFFFFF',
        fontSize: 14, // Unified size
        fontWeight: 'bold',
    }
});
