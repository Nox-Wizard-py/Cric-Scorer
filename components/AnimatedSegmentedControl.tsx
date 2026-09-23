import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';

const CYAN_ACCENT = '#15A3C7';
const SURFACE_DARK = '#1E252B';
const BORDER_COLOR = '#2C353D';

interface Option {
    label: string;
    icon?: (isActive: boolean) => React.ReactNode;
}

interface AnimatedSegmentedControlProps {
    options: Option[];
    selectedIndex: number;
    onChange: (index: number) => void;
}

export const AnimatedSegmentedControl: React.FC<AnimatedSegmentedControlProps> = ({ options, selectedIndex, onChange }) => {
    const [containerWidth, setContainerWidth] = useState(0);
    const gap = 10;
    
    const optionWidth = containerWidth > 0 ? (containerWidth - (gap * (options.length - 1))) / options.length : 0;
    
    const translateX = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const isInitialRender = useRef(true);

    useEffect(() => {
        if (optionWidth > 0) {
            const destination = selectedIndex * (optionWidth + gap);

            if (isInitialRender.current) {
                translateX.setValue(destination);
                isInitialRender.current = false;
                return;
            }

            Animated.sequence([
                // 1. Compress
                Animated.timing(scale, {
                    toValue: 0.94,
                    duration: 70,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
                // 2. Slide and expand
                Animated.parallel([
                    Animated.timing(translateX, {
                        toValue: destination,
                        duration: 160,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(scale, {
                        toValue: 1.02,
                        duration: 160,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    })
                ]),
                // 3. Settle
                Animated.timing(scale, {
                    toValue: 1,
                    duration: 80,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [selectedIndex, optionWidth]);

    const handleLayout = (e: LayoutChangeEvent) => {
        setContainerWidth(e.nativeEvent.layout.width);
        const initWidth = (e.nativeEvent.layout.width - (gap * (options.length - 1))) / options.length;
        translateX.setValue(selectedIndex * (initWidth + gap));
    };

    return (
        <View style={[styles.container, { gap }]} onLayout={handleLayout}>
            {/* Layer 1: Base Buttons (Dark Surface) */}
            {options.map((option, index) => (
                <View key={`base-${index}`} style={styles.baseButton}>
                    {/* Render invisible content to dictate container height */}
                    <View style={styles.invisibleContent}>
                        {option.icon && option.icon(false)}
                        <Text style={[styles.text, { opacity: 0 }]}>{option.label}</Text>
                    </View>
                </View>
            ))}

            {/* Layer 2: Animated Pill */}
            {containerWidth > 0 && selectedIndex >= 0 && (
                <Animated.View
                    style={[
                        styles.animatedPill,
                        {
                            width: optionWidth,
                            transform: [{ translateX }, { scale }]
                        }
                    ]}
                />
            )}

            {/* Layer 3: Interactive Foreground */}
            <View style={[StyleSheet.absoluteFill, styles.foregroundContainer, { gap }]}>
                {options.map((option, index) => {
                    const isActive = selectedIndex === index;
                    return (
                        <TouchableOpacity
                            key={`fg-${index}`}
                            activeOpacity={1}
                            style={styles.touchableArea}
                            onPress={() => onChange(index)}
                        >
                            <Animated.View style={styles.contentRow}>
                                {option.icon && option.icon(isActive)}
                                <Text style={[styles.text, isActive && styles.textActive]}>
                                    {option.label}
                                </Text>
                            </Animated.View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        position: 'relative',
    },
    baseButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: SURFACE_DARK,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    invisibleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0,
    },
    animatedPill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        backgroundColor: CYAN_ACCENT,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: CYAN_ACCENT,
        zIndex: 1,
    },
    foregroundContainer: {
        flexDirection: 'row',
        zIndex: 2,
        elevation: 2,
    },
    touchableArea: {
        flex: 1,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 16,
        fontWeight: '600',
        color: '#9EABB8',
    },
    textActive: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    }
});
