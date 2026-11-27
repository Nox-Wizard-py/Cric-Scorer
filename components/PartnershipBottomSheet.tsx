import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PartnershipRecord } from '../engine/scoringEngine';
import { APP_FONT_FAMILY } from '../constants/colors';
import { useTheme } from '../constants/theme';

interface PartnershipBottomSheetProps {
    visible: boolean;
    partnerships: PartnershipRecord[];
    onClose: () => void;
}

const getOrdinal = (n: number): string => {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    if (n % 10 === 1) return `${n}st`;
    if (n % 10 === 2) return `${n}nd`;
    if (n % 10 === 3) return `${n}rd`;
    return `${n}th`;
};

export const PartnershipBottomSheet: React.FC<PartnershipBottomSheetProps> = ({
    visible,
    partnerships,
    onClose,
}) => {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            translateY.setValue(0);
        }
    }, [visible, translateY]);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
            onPanResponderMove: (_, gesture) => {
                if (gesture.dy > 0) {
                    translateY.setValue(gesture.dy);
                }
            },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dy > 80 || gesture.vy > 0.8) {
                    onClose();
                } else {
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    const active = partnerships.find((p) => p.status === 'ACTIVE');
    const completed = partnerships.filter((p) => p.status === 'COMPLETED');
    const ordered = active ? [active, ...completed] : completed;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={[styles.backdrop, { backgroundColor: theme.modalOverlay }]}>
                <Pressable style={styles.backdropTap} onPress={onClose} accessibilityLabel="Close partnerships" />

                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                            paddingBottom: Math.max(insets.bottom, 16),
                            transform: [{ translateY }],
                        },
                    ]}
                >
                    <View {...panResponder.panHandlers}>
                        <View style={styles.handleWrap}>
                            <View style={[styles.handlePill, { backgroundColor: theme.border }]} />
                        </View>

                        <View style={[styles.headerRow, { borderBottomColor: theme.borderSubtle }]}>
                            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Partnerships</Text>
                            <TouchableOpacity
                                onPress={onClose}
                                accessibilityLabel="Close"
                                accessibilityRole="button"
                                style={styles.closeBtn}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {ordered.length === 0 ? (
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                No partnerships recorded yet.
                            </Text>
                        ) : (
                            ordered.map((p, idx) => {
                                const isActive = p.status === 'ACTIVE';
                                const totalBatterRuns = p.batter1Runs + p.batter2Runs;
                                const leftPercent =
                                    totalBatterRuns === 0 ? 0 : (p.batter1Runs / totalBatterRuns) * 100;
                                const rightPercent =
                                    totalBatterRuns === 0 ? 0 : (p.batter2Runs / totalBatterRuns) * 100;

                                return (
                                    <View
                                        key={`${p.index}-${p.batter1Id}-${p.batter2Id}`}
                                        style={[
                                            styles.rowCard,
                                            isActive
                                                ? {
                                                      backgroundColor: theme.surfaceSubtle,
                                                      borderColor: theme.primary,
                                                      borderWidth: 1,
                                                  }
                                                : {
                                                      borderBottomColor: theme.borderSubtle,
                                                      borderBottomWidth: idx < ordered.length - 1 ? 1 : 0,
                                                  },
                                        ]}
                                    >
                                        <View style={styles.rowHeader}>
                                            <Text style={[styles.wicketLabel, { color: theme.textSecondary }]}>
                                                {getOrdinal(p.index)} WICKET
                                            </Text>
                                            {isActive ? (
                                                <View
                                                    style={[
                                                        styles.statusBadge,
                                                        { backgroundColor: theme.primaryContainer },
                                                    ]}
                                                >
                                                    <View
                                                        style={[
                                                            styles.statusDot,
                                                            { backgroundColor: theme.primary },
                                                        ]}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.statusText,
                                                            { color: theme.onPrimaryContainer },
                                                        ]}
                                                    >
                                                        CURRENT
                                                    </Text>
                                                </View>
                                            ) : (
                                                <Text style={[styles.completedText, { color: theme.textSecondary }]}>
                                                    COMPLETED
                                                </Text>
                                            )}
                                        </View>

                                        {/* 5-Column Center-Out Layout */}
                                        <View style={styles.fiveColRow}>
                                            {/* Left End: Batter 1 */}
                                            <View style={styles.batterLeft}>
                                                <Text
                                                    style={[styles.batterName, { color: theme.textPrimary }]}
                                                    numberOfLines={1}
                                                    ellipsizeMode="tail"
                                                >
                                                    {p.batter1Name}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.batterScore,
                                                        styles.tabularNum,
                                                        { color: theme.textSecondary },
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {p.batter1Runs}({p.batter1Balls})
                                                </Text>
                                            </View>

                                            {/* Left Bar: grows center -> left */}
                                            <View
                                                style={[
                                                    styles.barTrack,
                                                    styles.barTrackLeft,
                                                    {
                                                        backgroundColor: isActive
                                                            ? theme.surface
                                                            : theme.surfaceSubtle,
                                                    },
                                                ]}
                                            >
                                                <View
                                                    style={[
                                                        styles.barFillLeft,
                                                        {
                                                            width: `${leftPercent}%`,
                                                            backgroundColor: theme.primary,
                                                        },
                                                    ]}
                                                />
                                            </View>

                                            {/* Center Total */}
                                            <View style={styles.centerTotal}>
                                                <Text
                                                    style={[
                                                        styles.totalRuns,
                                                        styles.tabularNum,
                                                        { color: theme.textPrimary },
                                                    ]}
                                                >
                                                    {p.runs}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.totalBalls,
                                                        styles.tabularNum,
                                                        { color: theme.textSecondary },
                                                    ]}
                                                >
                                                    ({p.balls})
                                                </Text>
                                                {p.extras > 0 && (
                                                    <Text
                                                        style={[
                                                            styles.extrasCaption,
                                                            styles.tabularNum,
                                                            { color: theme.textSecondary },
                                                        ]}
                                                    >
                                                        Extras: {p.extras}
                                                    </Text>
                                                )}
                                            </View>

                                            {/* Right Bar: grows center -> right */}
                                            <View
                                                style={[
                                                    styles.barTrack,
                                                    styles.barTrackRight,
                                                    {
                                                        backgroundColor: isActive
                                                            ? theme.surface
                                                            : theme.surfaceSubtle,
                                                    },
                                                ]}
                                            >
                                                <View
                                                    style={[
                                                        styles.barFillRight,
                                                        {
                                                            width: `${rightPercent}%`,
                                                            backgroundColor: theme.primary,
                                                        },
                                                    ]}
                                                />
                                            </View>

                                            {/* Right End: Batter 2 */}
                                            <View style={styles.batterRight}>
                                                <Text
                                                    style={[
                                                        styles.batterName,
                                                        styles.textRight,
                                                        { color: theme.textPrimary },
                                                    ]}
                                                    numberOfLines={1}
                                                    ellipsizeMode="tail"
                                                >
                                                    {p.batter2Name}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.batterScore,
                                                        styles.tabularNum,
                                                        styles.textRight,
                                                        { color: theme.textSecondary },
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {p.batter2Runs}({p.batter2Balls})
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdropTap: {
        flex: 1,
    },
    sheet: {
        maxHeight: '72%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        overflow: 'hidden',
    },
    handleWrap: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 4,
    },
    handlePill: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 18,
        fontWeight: '800',
    },
    closeBtn: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: -10,
    },
    scroll: {
        flexGrow: 0,
    },
    scrollContent: {
        padding: 16,
        gap: 10,
    },
    emptyText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        paddingVertical: 20,
    },
    rowCard: {
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    wicketLabel: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    completedText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    fiveColRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    batterLeft: {
        flex: 1,
        minWidth: 0,
        alignItems: 'flex-start',
    },
    batterRight: {
        flex: 1,
        minWidth: 0,
        alignItems: 'flex-end',
    },
    batterName: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 13,
        fontWeight: '700',
    },
    batterScore: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
    textRight: {
        textAlign: 'right',
    },
    barTrack: {
        width: 52,
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
    },
    barTrackLeft: {
        alignItems: 'flex-end',
    },
    barTrackRight: {
        alignItems: 'flex-start',
    },
    barFillLeft: {
        height: '100%',
        borderTopLeftRadius: 5,
        borderBottomLeftRadius: 5,
    },
    barFillRight: {
        height: '100%',
        borderTopRightRadius: 5,
        borderBottomRightRadius: 5,
    },
    centerTotal: {
        width: 58,
        alignItems: 'center',
        justifyContent: 'center',
    },
    totalRuns: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 18,
        fontWeight: '900',
        lineHeight: 20,
    },
    totalBalls: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 1,
    },
    extrasCaption: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },
    tabularNum: {
        fontVariant: ['tabular-nums'],
    },
});
