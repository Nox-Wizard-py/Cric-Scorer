import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
    Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { db } from '../database/db';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { AnimatedSegmentedControl } from '../components/AnimatedSegmentedControl';

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const [hostTeam, setHostTeam] = useState('');
    const [visitorTeam, setVisitorTeam] = useState('');
    const [tossWinner, setTossWinner] = useState<'Host' | 'Visitor' | null>(null);
    const [optTo, setOptTo] = useState<'Bat' | 'Bowl' | null>(null);
    const [overs, setOvers] = useState('16');

    // Player Names State
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [strikerName, setStrikerName] = useState('');
    const [nonStrikerName, setNonStrikerName] = useState('');
    const [bowlerName, setBowlerName] = useState('');

    const handleInitialStart = () => {
        if (!hostTeam || !visitorTeam || !tossWinner || !optTo || !overs) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }
        setShowPlayerModal(true);
    };

    const confirmStartMatch = async () => {
        if (!strikerName || !nonStrikerName || !bowlerName) {
            Alert.alert('Error', 'Please enter all three player names');
            return;
        }

        setShowPlayerModal(false);

        try {
            // 1. Insert Teams
            const insertTeam = (name: string) => {
                const result = db.runSync('INSERT INTO Teams (name, logo_color) VALUES (?, ?)', name, '#000000');
                return result.lastInsertRowId;
            };

            const homeTeamId = insertTeam(hostTeam);
            const awayTeamId = insertTeam(visitorTeam);

            const tossWinnerId = tossWinner === 'Host' ? homeTeamId : awayTeamId;

            // 2. Insert Match
            const result = db.runSync(
                `INSERT INTO Matches (
          tournament_id, home_team_id, away_team_id, toss_winner_id, opt_to, overs, is_completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                null,
                homeTeamId,
                awayTeamId,
                tossWinnerId,
                optTo,
                parseInt(overs),
                0
            );

            const matchId = result.lastInsertRowId;

            // 3. Insert Specific Players
            let batTeamId: number, bowlTeamId: number;
            if (optTo === 'Bat') {
                batTeamId = tossWinner === 'Host' ? homeTeamId : awayTeamId;
                bowlTeamId = tossWinner === 'Host' ? awayTeamId : homeTeamId;
            } else {
                batTeamId = tossWinner === 'Host' ? awayTeamId : homeTeamId;
                bowlTeamId = tossWinner === 'Host' ? homeTeamId : awayTeamId;
            }

            const sRes = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', strikerName, batTeamId);
            const nsRes = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', nonStrikerName, batTeamId);
            const bRes = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', bowlerName, bowlTeamId);

            navigation.navigate('Scoring', { matchId });

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to start match');
        }
    };

    return (
        <ScreenWrapper>
            {/* Header */}
            <Text style={styles.headerTitle}>New Match</Text>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

                {/* Teams Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>TEAMS</Text>
                    <View style={styles.surfaceCard}>
                        <TextInput
                            style={styles.solidInput}
                            placeholder="Host Team Name"
                            placeholderTextColor="#888"
                            value={hostTeam}
                            onChangeText={setHostTeam}
                        />
                        <View style={styles.solidSeparator} />
                        <TextInput
                            style={styles.solidInput}
                            placeholder="Visitor Team Name"
                            placeholderTextColor="#888"
                            value={visitorTeam}
                            onChangeText={setVisitorTeam}
                        />
                    </View>
                </View>

                {/* Toss Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>TOSS WON BY</Text>
                    <AnimatedSegmentedControl
                        options={[
                            { label: hostTeam || 'Host' },
                            { label: visitorTeam || 'Visitor' }
                        ]}
                        selectedIndex={tossWinner === 'Host' ? 0 : tossWinner === 'Visitor' ? 1 : -1}
                        onChange={(index) => setTossWinner(index === 0 ? 'Host' : 'Visitor')}
                    />
                </View>

                {/* Decision Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>OPTED TO</Text>
                    <AnimatedSegmentedControl
                        options={[
                            { 
                                label: 'Bat',
                                icon: (isActive) => <MaterialIcons name="sports-cricket" size={18} color={isActive ? '#FFFFFF' : '#9EABB8'} style={{ marginRight: 6 }} />
                            },
                            { 
                                label: 'Bowl',
                                icon: (isActive) => <MaterialCommunityIcons name="tennis-ball" size={18} color={isActive ? '#FFFFFF' : '#9EABB8'} style={{ marginRight: 6 }} />
                            }
                        ]}
                        selectedIndex={optTo === 'Bat' ? 0 : optTo === 'Bowl' ? 1 : -1}
                        onChange={(index) => setOptTo(index === 0 ? 'Bat' : 'Bowl')}
                    />
                </View>

                {/* Overs Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>OVERS</Text>
                    <TextInput
                        style={styles.solidInputSingle}
                        placeholder="16"
                        keyboardType="numeric"
                        placeholderTextColor="#888"
                        value={overs}
                        onChangeText={setOvers}
                    />
                </View>

                {/* Initial Start Button */}
                <TouchableOpacity style={styles.primaryCta} onPress={handleInitialStart} activeOpacity={0.8}>
                    <Text style={styles.primaryCtaText}>START MATCH</Text>
                </TouchableOpacity>

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* Player Selection Modal */}
            <Modal visible={showPlayerModal} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Enter Opening Players</Text>

                        <Text style={styles.modalLabel}>Striker Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={strikerName}
                            onChangeText={setStrikerName}
                            placeholder="Striker Name"
                            placeholderTextColor="#888"
                        />

                        <Text style={styles.modalLabel}>Non-Striker Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={nonStrikerName}
                            onChangeText={setNonStrikerName}
                            placeholder="Non-Striker Name"
                            placeholderTextColor="#888"
                        />

                        <Text style={styles.modalLabel}>Bowler Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={bowlerName}
                            onChangeText={setBowlerName}
                            placeholder="Bowler Name"
                            placeholderTextColor="#888"
                        />

                        <TouchableOpacity
                            style={[styles.primaryCta, { marginTop: 10, borderRadius: 12 }]}
                            onPress={confirmStartMatch}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.primaryCtaText}>BEGIN SCORING</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPlayerModal(false)}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
}

const CYAN_ACCENT = '#15A3C7';
const SURFACE_DARK = '#1E252B';
const BORDER_COLOR = '#2C353D';

const styles = StyleSheet.create({
    contentContainer: {
        paddingBottom: 120,
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 24,
    },
    sectionContainer: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 12,
        color: '#9EABB8',
        marginBottom: 8,
        fontWeight: 'bold',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    surfaceCard: {
        backgroundColor: SURFACE_DARK,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        overflow: 'hidden',
    },
    solidInput: {
        fontSize: 18,
        color: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    solidSeparator: {
        height: 1,
        backgroundColor: BORDER_COLOR,
    },
    solidInputSingle: {
        backgroundColor: SURFACE_DARK,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        fontSize: 18,
        color: '#fff',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },

    primaryCta: {
        backgroundColor: CYAN_ACCENT,
        borderRadius: 30,
        height: 56,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        elevation: 4,
        shadowColor: CYAN_ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    primaryCtaText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: SURFACE_DARK,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        elevation: 24,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#fff'
    },
    modalLabel: {
        fontSize: 14,
        color: '#9EABB8',
        marginBottom: 6,
        fontWeight: '600'
    },
    modalInput: {
        backgroundColor: '#161B22',
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        fontSize: 16,
        color: '#fff',
    },
    modalCancel: {
        marginTop: 16,
        alignItems: 'center',
        paddingVertical: 8,
    },
    modalCancelText: {
        color: '#9EABB8',
        fontSize: 16,
        fontWeight: '600'
    }
});
