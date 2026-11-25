import React, { useEffect, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    Animated,
    Dimensions,
    Easing,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { AppHeader } from '../components/AppHeader';
import { APP_FONT_FAMILY } from '../constants/colors';
import { useTheme } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const ConfettiPiece = ({ delay, startX, color }: { delay: number; startX: number; color: string }) => {
    const translateY = useRef(new Animated.Value(-80)).current;
    const translateX = useRef(new Animated.Value(startX)).current;
    const rotate = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const sway = Math.random() * 36 - 18;
        const loopAnim = Animated.loop(
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: height + 80,
                    duration: 3200 + Math.random() * 1800,
                    delay,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.sequence([
                    Animated.timing(translateX, { toValue: startX + sway, duration: 2400, useNativeDriver: true }),
                    Animated.timing(translateX, { toValue: startX - sway, duration: 2400, useNativeDriver: true }),
                ]),
                Animated.timing(rotate, {
                    toValue: 1,
                    duration: 700 + Math.random() * 400,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
            ])
        );
        loopAnim.start();
        return () => loopAnim.stop();
    }, []);

    const rotateInterpolate = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const size = Math.random() * 6 + 5;

    return (
        <Animated.View
            style={[
                styles.confetti,
                {
                    backgroundColor: color,
                    width: size,
                    height: size,
                    borderRadius: Math.random() > 0.5 ? size / 2 : 2,
                    transform: [{ translateY }, { translateX }, { rotate: rotateInterpolate }],
                },
            ]}
        />
    );
};

export default function MatchResultScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { theme } = useTheme();
    const { winner, margin } = route.params || { winner: 'Match Complete', margin: '' };
    const [reduceMotion, setReduceMotion] = useState(false);

    useEffect(() => {
        AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => sub.remove();
    }, []);

    const confettiColors = [theme.primary, theme.warning, theme.danger, '#34D399', '#2563EB'];
    const confetti = reduceMotion
        ? []
        : Array.from({ length: 48 }).map((_, i) => ({
              id: i,
              delay: Math.random() * 2400,
              startX: Math.random() * width,
              color: confettiColors[i % confettiColors.length],
          }));

    return (
        <ScreenWrapper noPadding>
            <AppHeader title="Match Result" badge="FINAL" />

            <View style={[styles.container, { backgroundColor: theme.background }]}>
                {!reduceMotion && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        {confetti.map((c) => (
                            <ConfettiPiece key={c.id} delay={c.delay} startX={c.startX} color={c.color} />
                        ))}
                    </View>
                )}

                <View
                    style={[
                        styles.resultCard,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                >
                    <View
                        style={[
                            styles.trophyBanner,
                            { backgroundColor: theme.scoreboxBg, borderBottomColor: theme.primary },
                        ]}
                    >
                        <MaterialCommunityIcons name="trophy" size={72} color={theme.warning} />
                    </View>

                    <View style={styles.cardBody}>
                        <Text style={[styles.teamName, { color: theme.textPrimary }]}>{winner}</Text>

                        {margin ? (
                            <View style={[styles.marginBadge, { backgroundColor: theme.primaryContainer }]}>
                                <Text style={[styles.marginText, { color: theme.onPrimaryContainer }]}>
                                    Won {margin}
                                </Text>
                            </View>
                        ) : (
                            <View style={[styles.marginBadge, { backgroundColor: theme.surfaceSubtle }]}>
                                <Text style={[styles.marginText, { color: theme.textSecondary }]}>
                                    Result Recorded
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.primaryCta, { backgroundColor: theme.primary }]}
                            onPress={() => navigation.popToTop()}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.primaryCtaText, { color: theme.onPrimary }]}>RETURN HOME</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    confetti: {
        position: 'absolute',
        top: 0,
    },
    resultCard: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    trophyBanner: {
        paddingVertical: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 4,
    },
    cardBody: {
        padding: 24,
        alignItems: 'center',
    },
    teamName: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 30,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 12,
    },
    marginBadge: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 28,
    },
    marginText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 15,
        fontWeight: '800',
    },
    primaryCta: {
        width: '100%',
        minHeight: 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryCtaText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
});
