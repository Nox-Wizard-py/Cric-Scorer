import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';

const { width, height } = Dimensions.get('window');

const ConfettiPiece = ({ delay, startX, color }: { delay: number, startX: number, color: string }) => {
    // Physics simulation values (keeping same as before)
    const translateY = useRef(new Animated.Value(-100)).current;
    const translateX = useRef(new Animated.Value(startX)).current;
    const rotate = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const sway = Math.random() * 40 - 20;
        Animated.loop(
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: height + 100,
                    duration: 3000 + Math.random() * 2000,
                    delay: delay,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.sequence([
                    Animated.timing(translateX, { toValue: startX + sway, duration: 2500, useNativeDriver: true }),
                    Animated.timing(translateX, { toValue: startX - sway, duration: 2500, useNativeDriver: true })
                ]),
                Animated.timing(rotate, { toValue: 1, duration: 500 + Math.random() * 500, easing: Easing.linear, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const rotateInterpolate = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const size = Math.random() * 6 + 4;

    return (
        <Animated.View
            style={[
                styles.confetti,
                {
                    backgroundColor: color, width: size, height: size, top: 0,
                    borderRadius: Math.random() > 0.5 ? size / 2 : 0,
                    transform: [{ translateY }, { translateX }, { rotate: rotateInterpolate }, { rotateX: rotateInterpolate }]
                }
            ]}
        />
    );
};

export default function MatchResultScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { winner, margin } = route.params || { winner: 'Team A', margin: 'by 10 Runs' };

    const shineAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
                Animated.timing(shineAnim, { toValue: 0, duration: 1000, useNativeDriver: true })
            ])
        ).start();
    }, []);

    const scaleShine = shineAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1] });

    // Confetti
    const confettiCount = 150;
    const colors = ['#FFD700', '#C0C0C0', '#FF4500', '#32CD32', '#00BFFF', '#FF69B4', '#FFF'];
    const confetti = Array.from({ length: confettiCount }).map((_, i) => ({
        id: i, delay: Math.random() * 3000, startX: Math.random() * width,
        color: colors[Math.floor(Math.random() * colors.length)]
    }));

    return (
        <ScreenWrapper style={styles.container}>
            {/* Confetti Container */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {confetti.map(c => <ConfettiPiece key={c.id} delay={c.delay} startX={c.startX} color={c.color} />)}
            </View>

            <GlassCard style={styles.content} intensity={30}>
                {/* Shiny Trophy */}
                <Animated.View style={{ transform: [{ scale: scaleShine }], alignItems: 'center' }}>
                    <MaterialCommunityIcons name="trophy" size={120} color="#FFD700" style={styles.trophy} />
                    <MaterialCommunityIcons name="star-four-points" size={30} color="#FFF" style={styles.sparkle1} />
                </Animated.View>

                <Text style={styles.winnerText}>CHAMPIONS</Text>
                <Text style={styles.teamName}>{winner}</Text>

                <View style={styles.marginBadge}>
                    <Text style={styles.marginText}>Won {margin}</Text>
                </View>

                <GlassButton title="RETURN HOME" onPress={() => navigation.popToTop()} style={{ width: 200 }} />
            </GlassCard>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    confetti: { position: 'absolute' },
    content: { alignItems: 'center', padding: 30, width: '90%', maxWidth: 400 },
    trophy: { marginBottom: 10, shadowColor: '#FFD700', shadowOpacity: 0.8, shadowRadius: 20, elevation: 10 },
    sparkle1: { position: 'absolute', top: 10, right: 30, opacity: 0.8 },
    winnerText: { fontSize: 16, fontWeight: '900', color: '#FFD700', marginBottom: 4, letterSpacing: 4, textTransform: 'uppercase' },
    teamName: { fontSize: 40, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 20, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 },
    marginBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    marginText: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
});
