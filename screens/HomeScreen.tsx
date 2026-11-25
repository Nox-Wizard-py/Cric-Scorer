import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { db } from '../database/db';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { AppHeader } from '../components/AppHeader';
import { AnimatedSegmentedControl } from '../components/AnimatedSegmentedControl';
import { APP_FONT_FAMILY } from '../constants/colors';
import { useTheme } from '../constants/theme';

const OVERS_PRESETS = ['6', '10', '12', '16', '20'];

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const { theme } = useTheme();

    const [hostTeam, setHostTeam] = useState('');
    const [visitorTeam, setVisitorTeam] = useState('');
    const [tossWinner, setTossWinner] = useState<'Host' | 'Visitor' | null>(null);
    const [optTo, setOptTo] = useState<'Bat' | 'Bowl' | null>(null);
    const [overs, setOvers] = useState('16');

    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [strikerName, setStrikerName] = useState('');
    const [nonStrikerName, setNonStrikerName] = useState('');
    const [bowlerName, setBowlerName] = useState('');

    const handleInitialStart = () => {
        const parsedOvers = parseInt(overs, 10);
        if (!hostTeam.trim() || !visitorTeam.trim() || !tossWinner || !optTo || !overs || Number.isNaN(parsedOvers) || parsedOvers <= 0) {
            Alert.alert('Missing Details', 'Enter both team names, toss winner, decision, and valid overs.');
            return;
        }
        setShowPlayerModal(true);
    };

    const confirmStartMatch = async () => {
        if (!strikerName.trim() || !nonStrikerName.trim() || !bowlerName.trim()) {
            Alert.alert('Missing Players', 'Please enter all three opening player names.');
            return;
        }

        setShowPlayerModal(false);

        try {
            const insertTeam = (name: string) => {
                const result = db.runSync('INSERT INTO Teams (name, logo_color) VALUES (?, ?)', name.trim(), theme.scoreboxBg);
                return result.lastInsertRowId;
            };

            const homeTeamId = insertTeam(hostTeam);
            const awayTeamId = insertTeam(visitorTeam);
            const tossWinnerId = tossWinner === 'Host' ? homeTeamId : awayTeamId;

            const result = db.runSync(
                `INSERT INTO Matches (
          tournament_id, home_team_id, away_team_id, toss_winner_id, opt_to, overs, is_completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                null,
                homeTeamId,
                awayTeamId,
                tossWinnerId,
                optTo,
                parseInt(overs, 10),
                0
            );

            const matchId = result.lastInsertRowId;

            let batTeamId: number, bowlTeamId: number;
            if (optTo === 'Bat') {
                batTeamId = tossWinner === 'Host' ? homeTeamId : awayTeamId;
                bowlTeamId = tossWinner === 'Host' ? awayTeamId : homeTeamId;
            } else {
                batTeamId = tossWinner === 'Host' ? awayTeamId : homeTeamId;
                bowlTeamId = tossWinner === 'Host' ? homeTeamId : awayTeamId;
            }

            db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', strikerName.trim(), batTeamId);
            db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', nonStrikerName.trim(), batTeamId);
            db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', bowlerName.trim(), bowlTeamId);

            navigation.navigate('Scoring', { matchId });
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to start match');
        }
    };

    return (
        <ScreenWrapper noPadding>
            <AppHeader title="New Match" subtitle="Quick fixture · Offline SQLite" />

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Teams Block */}
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>TEAMS</Text>
                        <View
                            style={[
                                styles.surfaceCard,
                                { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}
                        >
                            <View style={styles.inputRow}>
                                <Text style={[styles.inputTag, { color: theme.textSecondary }]}>HOST</Text>
                                <TextInput
                                    style={[styles.solidInput, { color: theme.textPrimary }]}
                                    placeholder="Host team name"
                                    placeholderTextColor={theme.textPlaceholder}
                                    value={hostTeam}
                                    onChangeText={setHostTeam}
                                />
                            </View>
                            <View style={[styles.solidSeparator, { backgroundColor: theme.borderSubtle }]} />
                            <View style={styles.inputRow}>
                                <Text style={[styles.inputTag, { color: theme.textSecondary }]}>VISITOR</Text>
                                <TextInput
                                    style={[styles.solidInput, { color: theme.textPrimary }]}
                                    placeholder="Visitor team name"
                                    placeholderTextColor={theme.textPlaceholder}
                                    value={visitorTeam}
                                    onChangeText={setVisitorTeam}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Toss Winner Block */}
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>TOSS WON BY</Text>
                        <AnimatedSegmentedControl
                            options={[
                                { label: hostTeam.trim() || 'Host' },
                                { label: visitorTeam.trim() || 'Visitor' },
                            ]}
                            selectedIndex={tossWinner === 'Host' ? 0 : tossWinner === 'Visitor' ? 1 : -1}
                            onChange={(index) => setTossWinner(index === 0 ? 'Host' : 'Visitor')}
                        />
                    </View>

                    {/* Opted To Block */}
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>OPTED TO</Text>
                        <AnimatedSegmentedControl
                            options={[
                                {
                                    label: 'Bat',
                                    icon: (isActive) => (
                                        <MaterialIcons
                                            name="sports-cricket"
                                            size={18}
                                            color={isActive ? theme.onPrimary : theme.textSecondary}
                                            style={{ marginRight: 6 }}
                                        />
                                    ),
                                },
                                {
                                    label: 'Bowl',
                                    icon: (isActive) => (
                                        <MaterialCommunityIcons
                                            name="tennis-ball"
                                            size={18}
                                            color={isActive ? theme.onPrimary : theme.textSecondary}
                                            style={{ marginRight: 6 }}
                                        />
                                    ),
                                },
                            ]}
                            selectedIndex={optTo === 'Bat' ? 0 : optTo === 'Bowl' ? 1 : -1}
                            onChange={(index) => setOptTo(index === 0 ? 'Bat' : 'Bowl')}
                        />
                    </View>

                    {/* Overs Block */}
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>OVERS</Text>
                        <View style={styles.presetRow}>
                            {OVERS_PRESETS.map((preset) => {
                                const selected = overs === preset;
                                return (
                                    <TouchableOpacity
                                        key={preset}
                                        onPress={() => setOvers(preset)}
                                        activeOpacity={0.8}
                                        style={[
                                            styles.presetChip,
                                            {
                                                backgroundColor: selected ? theme.primary : theme.surface,
                                                borderColor: selected ? theme.primary : theme.border,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.presetText,
                                                { color: selected ? theme.onPrimary : theme.textPrimary },
                                            ]}
                                        >
                                            {preset}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <View
                            style={[
                                styles.oversInputWrap,
                                { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}
                        >
                            <Text style={[styles.inputTag, { color: theme.textSecondary }]}>CUSTOM</Text>
                            <TextInput
                                style={[styles.solidInput, styles.tabularNum, { color: theme.textPrimary }]}
                                placeholder="16"
                                keyboardType="numeric"
                                placeholderTextColor={theme.textPlaceholder}
                                value={overs}
                                onChangeText={setOvers}
                            />
                            <Text style={[styles.oversUnit, { color: theme.textSecondary }]}>overs</Text>
                        </View>
                    </View>

                    {/* Primary CTA */}
                    <TouchableOpacity
                        style={[styles.primaryCta, { backgroundColor: theme.primary }]}
                        onPress={handleInitialStart}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.primaryCtaText, { color: theme.onPrimary }]}>START MATCH</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Opening Players Modal */}
            <Modal
                visible={showPlayerModal}
                animationType="fade"
                transparent
                onRequestClose={() => setShowPlayerModal(false)}
            >
                <KeyboardAvoidingView
                    style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View
                        style={[
                            styles.modalContent,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Opening Players</Text>

                        <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>STRIKER</Text>
                        <TextInput
                            style={[
                                styles.modalInput,
                                {
                                    backgroundColor: theme.surfaceSubtle,
                                    borderColor: theme.border,
                                    color: theme.textPrimary,
                                },
                            ]}
                            value={strikerName}
                            onChangeText={setStrikerName}
                            placeholder="Enter striker name"
                            placeholderTextColor={theme.textPlaceholder}
                        />

                        <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>NON-STRIKER</Text>
                        <TextInput
                            style={[
                                styles.modalInput,
                                {
                                    backgroundColor: theme.surfaceSubtle,
                                    borderColor: theme.border,
                                    color: theme.textPrimary,
                                },
                            ]}
                            value={nonStrikerName}
                            onChangeText={setNonStrikerName}
                            placeholder="Enter non-striker name"
                            placeholderTextColor={theme.textPlaceholder}
                        />

                        <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>OPENING BOWLER</Text>
                        <TextInput
                            style={[
                                styles.modalInput,
                                {
                                    backgroundColor: theme.surfaceSubtle,
                                    borderColor: theme.border,
                                    color: theme.textPrimary,
                                },
                            ]}
                            value={bowlerName}
                            onChangeText={setBowlerName}
                            placeholder="Enter bowler name"
                            placeholderTextColor={theme.textPlaceholder}
                        />

                        <TouchableOpacity
                            style={[styles.primaryCta, { backgroundColor: theme.primary, marginTop: 8 }]}
                            onPress={confirmStartMatch}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.primaryCtaText, { color: theme.onPrimary }]}>BEGIN SCORING</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalCancel}
                            onPress={() => setShowPlayerModal(false)}
                        >
                            <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 112,
    },
    sectionContainer: {
        marginBottom: 20,
    },
    sectionLabel: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        marginBottom: 8,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    surfaceCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        minHeight: 52,
    },
    inputTag: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
        width: 66,
    },
    solidInput: {
        fontFamily: APP_FONT_FAMILY,
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        paddingVertical: 14,
    },
    solidSeparator: {
        height: 1,
    },
    presetRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    presetChip: {
        flex: 1,
        minHeight: 48,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    presetText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 15,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    oversInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        minHeight: 50,
    },
    oversUnit: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 13,
        fontWeight: '700',
    },
    tabularNum: {
        fontVariant: ['tabular-nums'],
    },
    primaryCta: {
        borderRadius: 12,
        minHeight: 54,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    primaryCtaText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
    },
    modalTitle: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 16,
    },
    modalLabel: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        marginBottom: 6,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    modalInput: {
        fontFamily: APP_FONT_FAMILY,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        minHeight: 48,
        marginBottom: 14,
        fontSize: 16,
        fontWeight: '600',
    },
    modalCancel: {
        marginTop: 10,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 15,
        fontWeight: '700',
    },
});
