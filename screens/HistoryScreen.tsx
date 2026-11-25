import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { AppHeader } from '../components/AppHeader';
import { APP_FONT_FAMILY } from '../constants/colors';
import { useTheme } from '../constants/theme';
import { db } from '../database/db';

interface MatchRow {
    id: number;
    homeName: string;
    awayName: string;
    overs: number;
    is_completed: number;
}

export default function HistoryScreen() {
    const { theme } = useTheme();
    const navigation = useNavigation<any>();
    const [matches, setMatches] = useState<MatchRow[]>([]);

    useFocusEffect(
        useCallback(() => {
            try {
                const rows = db.getAllSync(`
                    SELECT m.id, h.name as homeName, a.name as awayName, m.overs, m.is_completed
                    FROM Matches m
                    JOIN Teams h ON h.id = m.home_team_id
                    JOIN Teams a ON a.id = m.away_team_id
                    ORDER BY m.id DESC
                `) as MatchRow[];
                setMatches(rows);
            } catch (e) {
                console.log('Failed loading match history', e);
            }
        }, [])
    );

    return (
        <ScreenWrapper noPadding>
            <AppHeader title="History" subtitle="Local match ledger" />

            <ScrollView contentContainerStyle={styles.contentContainer}>
                {matches.length === 0 ? (
                    <View
                        style={[
                            styles.emptyCard,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <View style={[styles.iconBox, { backgroundColor: theme.primaryContainer }]}>
                            <MaterialCommunityIcons name="history" size={28} color={theme.primary} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                            No matches recorded yet
                        </Text>
                        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                            Every fixture you start on-device is saved to SQLite and shows up here with its match status and overs.
                        </Text>
                        <TouchableOpacity
                            style={[styles.ctaButton, { backgroundColor: theme.primary }]}
                            onPress={() => navigation.navigate('Home')}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.ctaText, { color: theme.onPrimary }]}>START NEW MATCH</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    matches.map((m) => {
                        const completed = m.is_completed === 1;
                        return (
                            <TouchableOpacity
                                key={m.id}
                                style={[
                                    styles.matchCard,
                                    { backgroundColor: theme.surface, borderColor: theme.border },
                                ]}
                                onPress={() => navigation.navigate('Scoring', { matchId: m.id })}
                                activeOpacity={0.8}
                            >
                                <View style={styles.matchLeft}>
                                    <Text style={[styles.matchTeams, { color: theme.textPrimary }]}>
                                        {m.homeName} vs {m.awayName}
                                    </Text>
                                    <Text style={[styles.matchMeta, { color: theme.textSecondary }]}>
                                        {m.overs} overs · Match #{m.id}
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.statusBadge,
                                        {
                                            backgroundColor: completed
                                                ? theme.primaryContainer
                                                : theme.surfaceSubtle,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusText,
                                            {
                                                color: completed
                                                    ? theme.onPrimaryContainer
                                                    : theme.textSecondary,
                                            },
                                        ]}
                                    >
                                        {completed ? 'FINAL' : 'IN PROGRESS'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    contentContainer: {
        padding: 16,
        gap: 10,
        paddingBottom: 112,
    },
    emptyCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 20,
        alignItems: 'flex-start',
        gap: 12,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 18,
        fontWeight: '800',
    },
    emptyBody: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
    },
    ctaButton: {
        marginTop: 4,
        minHeight: 48,
        paddingHorizontal: 18,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    matchCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        minHeight: 68,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    matchLeft: {
        flex: 1,
    },
    matchTeams: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 16,
        fontWeight: '800',
    },
    matchMeta: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 3,
        fontVariant: ['tabular-nums'],
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    statusText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
});
