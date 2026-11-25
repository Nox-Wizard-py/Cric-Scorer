import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { AppHeader } from '../components/AppHeader';
import { APP_FONT_FAMILY } from '../constants/colors';
import { useTheme } from '../constants/theme';
import { db } from '../database/db';
import { Tournament } from '../database/types';

export default function TournamentsScreen() {
    const { theme } = useTheme();
    const navigation = useNavigation<any>();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);

    useFocusEffect(
        useCallback(() => {
            try {
                const rows = db.getAllSync('SELECT * FROM Tournaments ORDER BY id DESC') as Tournament[];
                setTournaments(rows);
            } catch (e) {
                console.log('Failed loading tournaments', e);
            }
        }, [])
    );

    return (
        <ScreenWrapper noPadding>
            <AppHeader title="Tournaments" subtitle="Structured competition records" />

            <ScrollView contentContainerStyle={styles.contentContainer}>
                {tournaments.length === 0 ? (
                    <View
                        style={[
                            styles.emptyCard,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <View style={[styles.iconBox, { backgroundColor: theme.primaryContainer }]}>
                            <MaterialCommunityIcons name="trophy" size={28} color={theme.primary} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                            No tournaments created yet
                        </Text>
                        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                            Score quick fixtures right away from New Match. Local SQLite tournament brackets will appear here once configured.
                        </Text>
                        <TouchableOpacity
                            style={[styles.ctaButton, { backgroundColor: theme.primary }]}
                            onPress={() => navigation.navigate('Home')}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.ctaText, { color: theme.onPrimary }]}>START A QUICK MATCH</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    tournaments.map((t) => (
                        <View
                            key={t.id}
                            style={[
                                styles.rowCard,
                                { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}
                        >
                            <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>{t.name}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: theme.primaryContainer }]}>
                                <Text style={[styles.statusText, { color: theme.onPrimaryContainer }]}>
                                    {t.status.toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    contentContainer: {
        padding: 16,
        gap: 12,
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
    rowCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowTitle: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 16,
        fontWeight: '700',
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
    },
});
