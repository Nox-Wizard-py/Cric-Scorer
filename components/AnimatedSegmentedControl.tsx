import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    LayoutChangeEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { APP_FONT_FAMILY } from '../constants/colors';
import { useTheme } from '../constants/theme';

interface Option {
    label: string;
    icon?: (isActive: boolean) => React.ReactNode;
}

interface AnimatedSegmentedControlProps {
    options: Option[];
    selectedIndex: number;
    onChange: (index: number) => void;
}

export const AnimatedSegmentedControl: React.FC<AnimatedSegmentedControlProps> = ({
    options,
    selectedIndex,
    onChange,
}) => {
    const { theme } = useTheme();
    const [containerWidth, setContainerWidth] = useState(0);
    const gap = 10;

    const optionWidth =
        containerWidth > 0 ? (containerWidth - gap * (options.length - 1)) / options.length : 0;

    const translateX = useRef(new Animated.Value(0)).current;
    const isInitialRender = useRef(true);

    useEffect(() => {
        if (optionWidth > 0 && selectedIndex >= 0) {
            const destination = selectedIndex * (optionWidth + gap);

            if (isInitialRender.current) {
                translateX.setValue(destination);
                isInitialRender.current = false;
                return;
            }

            Animated.timing(translateX, {
                toValue: destination,
                duration: 180,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
        }
    }, [selectedIndex, optionWidth]);

    const handleLayout = (e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width;
        setContainerWidth(w);
        if (selectedIndex >= 0) {
            const initWidth = (w - gap * (options.length - 1)) / options.length;
            translateX.setValue(selectedIndex * (initWidth + gap));
        }
    };

    return (
        <View style={[styles.container, { gap }]} onLayout={handleLayout}>
            {options.map((option, index) => (
                <View
                    key={`base-${index}`}
                    style={[
                        styles.baseButton,
                        {
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                        },
                    ]}
                >
                    <View style={styles.invisibleContent}>
                        {option.icon && option.icon(false)}
                        <Text style={styles.text}>{option.label}</Text>
                    </View>
                </View>
            ))}

            {containerWidth > 0 && selectedIndex >= 0 && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.animatedPill,
                        {
                            width: optionWidth,
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                            transform: [{ translateX }],
                        },
                    ]}
                />
            )}

            <View style={[StyleSheet.absoluteFill, styles.foregroundContainer, { gap }]}>
                {options.map((option, index) => {
                    const isActive = selectedIndex === index;
                    return (
                        <TouchableOpacity
                            key={`fg-${index}`}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isActive }}
                            style={styles.touchableArea}
                            onPress={() => onChange(index)}
                        >
                            <View style={styles.contentRow}>
                                {option.icon && option.icon(isActive)}
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.text,
                                        { color: isActive ? theme.onPrimary : theme.textPrimary },
                                        isActive && styles.textActive,
                                    ]}
                                >
                                    {option.label}
                                </Text>
                            </View>
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
        minHeight: 48,
        paddingVertical: 13,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
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
        borderRadius: 10,
        borderWidth: 1,
        zIndex: 1,
    },
    foregroundContainer: {
        flexDirection: 'row',
        zIndex: 2,
    },
    touchableArea: {
        flex: 1,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 15,
        fontWeight: '600',
    },
    textActive: {
        fontWeight: '700',
    },
});
