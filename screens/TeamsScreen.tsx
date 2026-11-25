import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { AppHeader } from '../components/AppHeader';
import { APP_FONT_FAMILY } from '../constants/colors';
import { useTheme } from '../constants/theme';
import { db } from '../database/db';

interface TeamSummary {
    id: number;
    name: string;
    playerCount: number;
}

export default function TeamsScreen() {
    const { theme } = useTheme();
    const navigation = useNavigation<any>();
    const [teams, setTeams] = useState<TeamSummary[]>([]);

    useFocusEffect(
        useCallback(() => {
            try {
                const rows = db.getAllSync(`
                    SELECT t.id, t.name, COUNT(p.id) as playerCount
                    FROM Teams t
                    LEFT JOIN Players p ON p.team_id = t.id
                    GROUP BY t.id
                    ORDER BY t.id DESC
                `) as TeamSummary[];
                setTeams(rows);
            } catch (e) {
                console.log('Failed loading teams', e);
            }
        }, [])
    );

    return (
        <ScreenWrapper noPadding>
            <AppHeader title="Teams" subtitle="Saved squads on this device" />

            <ScrollView contentContainerStyle={styles.contentContainer}>
                {teams.length === 0 ? (
                    <View
                        style={[
                            styles.emptyCard,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <View style={[styles.iconBox, { backgroundColor: theme.primaryContainer }]}>
                            <MaterialCommunityIcons name="account-group" size={28} color={theme.primary} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                            No teams saved yet
                        </Text>
                        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                            Teams and players created during match setup are stored locally in SQLite and listed here automatically.
                        </Text>
                        <TouchableOpacity
                            style={[styles.ctaButton, { backgroundColor: theme.primary }]}
                            onPress={() => navigation.navigate('Home')}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.ctaText, { color: theme.onPrimary }]}>CREATE FIRST FIXTURE</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View
                        style={[
                            styles.listCard,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <View
                            style={[
                                styles.listHeader,
                                { backgroundColor: theme.surfaceSubtle, borderBottomColor: theme.border },
                            ]}
                        >
                            <Text style={[styles.headerText, { color: theme.textSecondary }]}>TEAM</Text>
                            <Text style={[styles.headerText, { color: theme.textSecondary }]}>PLAYERS</Text>
                        </View>
                        {teams.map((team, idx) => (
                            <View
                                key={team.id}
                                style={[
                                    styles.listRow,
                                    { borderBottomColor: theme.borderSubtle },
                                    idx === teams.length - 1 && styles.listRowLast,
                                ]}
                            >
                                <Text style={[styles.teamName, { color: theme.textPrimary }]}>{team.name}</Text>
                                <Text style={[styles.playerCount, { color: theme.textSecondary }]}>
                                    {team.playerCount}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    contentContainer: {
        padding: 16,
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
    listCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    headerText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    listRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        minHeight: 50,
        borderBottomWidth: 1,
    },
    listRowLast: {
        borderBottomWidth: 0,
    },
    teamName: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 15,
        fontWeight: '700',
    },
    playerCount: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 14,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
});
