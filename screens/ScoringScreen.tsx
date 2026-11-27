import React, { useEffect, useRef, useState } from 'react';
import {
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../database/db';
import { getOrCreatePlayer, normalizePlayerName } from '../database/playerIdentity';
import { Delivery, Match, Player, Team } from '../database/types';
import {
    DISMISSAL_TYPES,
    MAX_PLAYERS_PER_TEAM,
    MAX_WICKETS,
    MatchDerivedState,
    OverBallBadge,
    computeMatchResult,
    deriveMatchState,
    dismissalRequiresFielder,
} from '../engine/scoringEngine';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { AppHeader } from '../components/AppHeader';
import { PartnershipBottomSheet } from '../components/PartnershipBottomSheet';
import { APP_FONT_FAMILY } from '../constants/colors';
import { useTheme } from '../constants/theme';

const EXTRA_KEYS: Array<{ key: 'wide' | 'noBall' | 'byes' | 'legByes' | 'wicket'; label: string }> = [
    { key: 'wide', label: 'WD' },
    { key: 'noBall', label: 'NB' },
    { key: 'byes', label: 'B' },
    { key: 'legByes', label: 'LB' },
    { key: 'wicket', label: 'OUT' },
];

export default function ScoringScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const { matchId } = route.params || {};

    const [matchState, setMatchState] = useState<MatchDerivedState | null>(null);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [manualStrikeSwapped, setManualStrikeSwapped] = useState(false);
    const [pendingBowlerId, setPendingBowlerId] = useState<number | null>(null);

    const [extras, setExtras] = useState({
        wide: false,
        noBall: false,
        byes: false,
        legByes: false,
        wicket: false,
    });

    const [showBowlerModal, setShowBowlerModal] = useState(false);
    const [newBowlerName, setNewBowlerName] = useState('');

    const [showWicketModal, setShowWicketModal] = useState(false);
    const [wicketDetails, setWicketDetails] = useState({
        type: 'Caught',
        whoOut: 0,
        newBatsmanName: '',
        fielderName: '',
    });

    const [showInningBreakModal, setShowInningBreakModal] = useState(false);
    const [showInningStartModal, setShowInningStartModal] = useState(false);
    const [newInningPlayers, setNewInningPlayers] = useState({ striker: '', nonStriker: '', bowler: '' });
    const [inningStartError, setInningStartError] = useState<string | null>(null);

    const [showCompleteInningsModal, setShowCompleteInningsModal] = useState(false);
    const [infoSheet, setInfoSheet] = useState<'partnership' | 'extras' | null>(null);
    const [snackbar, setSnackbar] = useState<string | null>(null);
    const snackbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showNotice = (message: string) => {
        setSnackbar(message);
        if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
        snackbarTimer.current = setTimeout(() => setSnackbar(null), 2600);
    };

    useEffect(() => {
        return () => {
            if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
        };
    }, []);

    const loadMatchFromDb = (): { derived: MatchDerivedState; players: Player[] } | null => {
        if (!matchId) return null;
        const match = db.getFirstSync('SELECT * FROM Matches WHERE id = ?', matchId) as Match | null;
        if (!match) return null;

        const homeTeam = db.getFirstSync('SELECT * FROM Teams WHERE id = ?', match.home_team_id) as Team;
        const awayTeam = db.getFirstSync('SELECT * FROM Teams WHERE id = ?', match.away_team_id) as Team;
        const players = db.getAllSync(
            'SELECT * FROM Players WHERE team_id IN (?, ?) ORDER BY id ASC',
            homeTeam.id,
            awayTeam.id
        ) as Player[];
        const deliveries = db.getAllSync(
            'SELECT * FROM Deliveries WHERE match_id = ? ORDER BY inning ASC, id ASC',
            matchId
        ) as Delivery[];

        const derived = deriveMatchState({ match, homeTeam, awayTeam, players, deliveries });
        setMatchState(derived);
        setAllPlayers(players);
        return { derived, players };
    };

    const syncTransitions = (derived: MatchDerivedState, fromLoad: boolean = false) => {
        if (derived.isMatchComplete && derived.result) {
            try {
                db.runSync('UPDATE Matches SET is_completed = 1 WHERE id = ?', matchId);
            } catch (e) {}
            navigation.navigate('MatchResult', {
                winner: derived.result.winner,
                margin: derived.result.margin,
            });
            return;
        }

        if (derived.needsSecondInningsSetup) {
            try {
                db.runSync('UPDATE Matches SET inning1_completed = 1 WHERE id = ?', matchId);
            } catch (e) {}
            if (fromLoad) {
                setShowInningStartModal(true);
            } else {
                setShowInningBreakModal(true);
            }
            return;
        }

        if (derived.activeState.needsBowlerChange && pendingBowlerId === null) {
            setNewBowlerName('');
            setShowBowlerModal(true);
        }
    };

    useEffect(() => {
        const loaded = loadMatchFromDb();
        if (loaded) {
            syncTransitions(loaded.derived, true);
        }
    }, [matchId]);

    const activeState = matchState?.activeState ?? null;
    const displayStrikerId = activeState
        ? manualStrikeSwapped
            ? activeState.nonStrikerId
            : activeState.strikerId
        : 0;
    const displayNonStrikerId = activeState
        ? manualStrikeSwapped
            ? activeState.strikerId
            : activeState.nonStrikerId
        : 0;
    const displayBowlerId = activeState
        ? pendingBowlerId ?? activeState.currentBowlerId
        : 0;

    const strikerStat = activeState?.batterStats[displayStrikerId];
    const nonStrikerStat = activeState?.batterStats[displayNonStrikerId];
    const bowlerStat = activeState?.bowlerStats[displayBowlerId];
    const displayBowlerName =
        bowlerStat?.name || allPlayers.find((p) => p.id === displayBowlerId)?.name || 'Bowler';

    // --- Validation Helpers ---
    const isTeamAtCap = (teamId: number, rawName: string): boolean => {
        const norm = normalizePlayerName(rawName);
        if (!norm) return false;
        const teamRoster = allPlayers.filter((p) => p.team_id === teamId);
        const alreadyExists = teamRoster.some((p) => normalizePlayerName(p.name) === norm);
        return !alreadyExists && teamRoster.length >= MAX_PLAYERS_PER_TEAM;
    };

    const getWicketBatsmanError = (): string | null => {
        if (!activeState) return null;
        if (activeState.wickets >= MAX_WICKETS - 1) return null; // 10th wicket -> All Out, no new batter
        const raw = wicketDetails.newBatsmanName.trim();
        if (!raw) return null;

        const norm = normalizePlayerName(raw);
        const battedNames = new Set(
            activeState.battedPlayerIds.map((id) =>
                normalizePlayerName(allPlayers.find((p) => p.id === id)?.name || '')
            )
        );
        if (battedNames.has(norm)) {
            return 'This player has already batted in this innings';
        }
        if (isTeamAtCap(activeState.battingTeam.id, raw)) {
            return 'Maximum 11 players allowed per team';
        }
        return null;
    };

    const getFielderError = (): string | null => {
        if (!activeState || !dismissalRequiresFielder(wicketDetails.type)) return null;
        const raw = wicketDetails.fielderName.trim();
        if (!raw) return null;
        if (isTeamAtCap(activeState.bowlingTeam.id, raw)) {
            return 'Maximum 11 players allowed per team';
        }
        return null;
    };

    const getBowlerInputError = (): string | null => {
        if (!activeState) return null;
        const raw = newBowlerName.trim();
        if (!raw) return null;
        const norm = normalizePlayerName(raw);
        if (activeState.previousOverBowlerId) {
            const prevName = allPlayers.find((p) => p.id === activeState.previousOverBowlerId)?.name || '';
            if (normalizePlayerName(prevName) === norm) {
                return 'A bowler cannot bowl consecutive overs';
            }
        }
        if (isTeamAtCap(activeState.bowlingTeam.id, raw)) {
            return 'Maximum 11 players allowed per team';
        }
        return null;
    };

    const wicketBatsmanError = getWicketBatsmanError();
    const fielderError = getFielderError();
    const bowlerInputError = getBowlerInputError();
    const isTenthWicket = (activeState?.wickets ?? 0) >= MAX_WICKETS - 1;
    const needsFielderInput = dismissalRequiresFielder(wicketDetails.type);

    // --- Delivery Recording ---
    const handleScoreClick = (runs: number) => {
        if (!matchState || !activeState) return;
        if (activeState.isInningsComplete) {
            syncTransitions(matchState);
            return;
        }
        if (activeState.needsBowlerChange && pendingBowlerId === null) {
            setShowBowlerModal(true);
            return;
        }

        if (extras.wicket) {
            setWicketDetails({
                type: extras.noBall ? 'Run Out' : 'Caught',
                whoOut: displayStrikerId,
                newBatsmanName: '',
                fielderName: '',
            });
            setShowWicketModal(true);
            return;
        }

        recordDelivery(runs);
    };

    const recordDelivery = (
        runs: number,
        wicketPayload?: {
            type: string;
            whoOut: number;
            fielderId: number | null;
            nextBatsmanId: number | null;
        }
    ) => {
        if (!matchState || !activeState) return;

        let runsScored = runs;
        let extraType: 'WD' | 'NB' | 'B' | 'LB' | null = null;
        let extraRuns = 0;

        if (extras.wide) {
            extraType = 'WD';
            extraRuns = 1 + runs;
            runsScored = 0;
        } else if (extras.noBall) {
            extraType = 'NB';
            if (extras.byes || extras.legByes) {
                extraRuns = 1 + runs;
                runsScored = 0;
            } else {
                extraRuns = 1;
                runsScored = runs;
            }
        } else if (extras.byes) {
            extraType = 'B';
            extraRuns = runs;
            runsScored = 0;
        } else if (extras.legByes) {
            extraType = 'LB';
            extraRuns = runs;
            runsScored = 0;
        }

        try {
            db.runSync(
                `INSERT INTO Deliveries (
          match_id, inning, over_number, ball_number, batsman_id, non_striker_id, bowler_id,
          runs, extras_type, extras_runs, is_wicket, wicket_type, player_out_id, fielder_id, next_batsman_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                matchId,
                activeState.inning,
                activeState.oversCompleted,
                activeState.ballsInOver + 1,
                displayStrikerId,
                displayNonStrikerId,
                displayBowlerId,
                runsScored,
                extraType,
                extraRuns,
                wicketPayload ? 1 : 0,
                wicketPayload ? wicketPayload.type : null,
                wicketPayload ? wicketPayload.whoOut : null,
                wicketPayload ? wicketPayload.fielderId : null,
                wicketPayload ? wicketPayload.nextBatsmanId : null
            );
        } catch (e) {
            console.error(e);
            showNotice('Failed to record delivery.');
            return;
        }

        setExtras({ wide: false, noBall: false, byes: false, legByes: false, wicket: false });
        setManualStrikeSwapped(false);
        setPendingBowlerId(null);

        const loaded = loadMatchFromDb();
        if (loaded) {
            syncTransitions(loaded.derived);
        }
    };

    const confirmWicket = () => {
        if (!activeState) return;
        if (wicketBatsmanError || fielderError) return;
        if (needsFielderInput && !wicketDetails.fielderName.trim()) {
            showNotice('Enter fielder name.');
            return;
        }
        if (!isTenthWicket && !wicketDetails.newBatsmanName.trim()) {
            showNotice('Enter incoming batsman name.');
            return;
        }

        let fielderId: number | null = null;
        if (needsFielderInput) {
            fielderId = getOrCreatePlayer(activeState.bowlingTeam.id, wicketDetails.fielderName).id;
        }

        let nextBatsmanId: number | null = null;
        if (!isTenthWicket) {
            nextBatsmanId = getOrCreatePlayer(activeState.battingTeam.id, wicketDetails.newBatsmanName).id;
        }

        setShowWicketModal(false);
        recordDelivery(0, {
            type: wicketDetails.type,
            whoOut: wicketDetails.whoOut || displayStrikerId,
            fielderId,
            nextBatsmanId,
        });
    };

    const confirmNewBowler = (player?: Player) => {
        if (!activeState) return;
        if (!player && bowlerInputError) return;

        let selected: Player | null = player ?? null;
        if (!selected && newBowlerName.trim()) {
            selected = getOrCreatePlayer(activeState.bowlingTeam.id, newBowlerName);
        }
        if (!selected) {
            showNotice('Select or enter a bowler.');
            return;
        }
        if (selected.id === activeState.previousOverBowlerId) {
            showNotice('A bowler cannot bowl consecutive overs');
            return;
        }

        setPendingBowlerId(selected.id);
        setNewBowlerName('');
        setShowBowlerModal(false);
        loadMatchFromDb();
    };

    const confirmSecondInningsPlayers = () => {
        if (!matchState) return;
        const { striker, nonStriker, bowler } = newInningPlayers;
        if (!striker.trim() || !nonStriker.trim() || !bowler.trim()) {
            setInningStartError('Enter striker, non-striker, and opening bowler.');
            return;
        }
        if (normalizePlayerName(striker) === normalizePlayerName(nonStriker)) {
            setInningStartError('Striker and Non-Striker must be different players.');
            return;
        }

        const batTeamId = matchState.firstBowlTeam.id;
        const bowlTeamId = matchState.firstBatTeam.id;

        if (
            isTeamAtCap(batTeamId, striker) ||
            isTeamAtCap(batTeamId, nonStriker) ||
            isTeamAtCap(bowlTeamId, bowler)
        ) {
            setInningStartError('Maximum 11 players allowed per team.');
            return;
        }

        const p1 = getOrCreatePlayer(batTeamId, striker);
        const p2 = getOrCreatePlayer(batTeamId, nonStriker);
        const p3 = getOrCreatePlayer(bowlTeamId, bowler);

        db.runSync(
            `UPDATE Matches SET inning1_completed = 1, inning2_striker_id = ?, inning2_non_striker_id = ?, inning2_bowler_id = ? WHERE id = ?`,
            p1.id,
            p2.id,
            p3.id,
            matchId
        );

        setInningStartError(null);
        setShowInningStartModal(false);
        setManualStrikeSwapped(false);
        setPendingBowlerId(null);
        loadMatchFromDb();
    };

    const handleCompleteInningsConfirm = () => {
        if (!matchState) return;
        setShowCompleteInningsModal(false);

        if (matchState.activeInning === 1) {
            db.runSync('UPDATE Matches SET inning1_completed = 1 WHERE id = ?', matchId);
            setManualStrikeSwapped(false);
            setPendingBowlerId(null);
            setInningStartError(null);
            setNewInningPlayers({ striker: '', nonStriker: '', bowler: '' });
            loadMatchFromDb();
            setShowInningStartModal(true);
            return;
        }

        const inn2Total = matchState.inning2?.totalRuns ?? 0;
        const inn2Wickets = matchState.inning2?.wickets ?? 0;
        const res = computeMatchResult(
            matchState.inning1.totalRuns,
            inn2Total,
            inn2Wickets,
            matchState.firstBatTeam.name,
            matchState.firstBowlTeam.name
        );
        db.runSync('UPDATE Matches SET is_completed = 1 WHERE id = ?', matchId);
        navigation.navigate('MatchResult', { winner: res.winner, margin: res.margin });
    };

    const handleUndo = () => {
        if (!matchState) return;
        try {
            const lastDelivery = db.getFirstSync(
                'SELECT * FROM Deliveries WHERE match_id = ? ORDER BY inning DESC, id DESC LIMIT 1',
                matchId
            ) as Delivery | null;

            const hasInn2Openers = Boolean(
                matchState.match.inning2_striker_id &&
                    matchState.match.inning2_non_striker_id &&
                    matchState.match.inning2_bowler_id
            );

            // Reversing 2nd-innings transition before any 2nd-innings delivery
            if (matchState.activeInning === 2 && (!lastDelivery || lastDelivery.inning === 1)) {
                if (hasInn2Openers) {
                    db.runSync(
                        'UPDATE Matches SET inning1_completed = 0, inning2_striker_id = NULL, inning2_non_striker_id = NULL, inning2_bowler_id = NULL, is_completed = 0 WHERE id = ?',
                        matchId
                    );
                    if (lastDelivery && (matchState.inning1.isAllOut || matchState.inning1.isOversComplete)) {
                        db.runSync('DELETE FROM Deliveries WHERE id = ?', lastDelivery.id);
                    }
                    setPendingBowlerId(null);
                    setManualStrikeSwapped(false);
                    setShowInningStartModal(false);
                    setShowInningBreakModal(false);
                    loadMatchFromDb();
                    showNotice('Reverted to 1st innings.');
                    return;
                }
            }

            if (matchState.needsSecondInningsSetup) {
                db.runSync('UPDATE Matches SET inning1_completed = 0, is_completed = 0 WHERE id = ?', matchId);
                if (lastDelivery && (matchState.inning1.isAllOut || matchState.inning1.isOversComplete)) {
                    db.runSync('DELETE FROM Deliveries WHERE id = ?', lastDelivery.id);
                }
                setShowInningBreakModal(false);
                setShowInningStartModal(false);
                setPendingBowlerId(null);
                setManualStrikeSwapped(false);
                loadMatchFromDb();
                showNotice('Undid innings completion.');
                return;
            }

            if (!lastDelivery) {
                showNotice('Nothing to undo in this match.');
                return;
            }

            db.runSync('DELETE FROM Deliveries WHERE id = ?', lastDelivery.id);
            db.runSync('UPDATE Matches SET is_completed = 0 WHERE id = ?', matchId);

            setExtras({ wide: false, noBall: false, byes: false, legByes: false, wicket: false });
            setPendingBowlerId(null);
            setManualStrikeSwapped(false);
            setShowBowlerModal(false);
            loadMatchFromDb();
            showNotice('Undid last delivery.');
        } catch (e) {
            console.error(e);
            showNotice('Could not undo last delivery.');
        }
    };

    const handleRetire = () => {
        if (!activeState) return;
        setWicketDetails({
            type: 'Retired',
            whoOut: displayStrikerId,
            newBatsmanName: '',
            fielderName: '',
        });
        setShowWicketModal(true);
    };

    const toggleExtra = (key: keyof typeof extras) =>
        setExtras((prev) => ({ ...prev, [key]: !prev[key] }));

    const getBallPillStyle = (badge: OverBallBadge) => {
        if (badge.kind === 'wicket') {
            return { bg: theme.danger, border: theme.danger, text: theme.onDanger };
        }
        if (badge.kind === 'boundary') {
            return { bg: theme.primary, border: theme.primary, text: theme.onPrimary };
        }
        if (badge.kind === 'extra') {
            return { bg: theme.warning, border: theme.warning, text: theme.onWarning };
        }
        return { bg: theme.surface, border: theme.border, text: theme.textPrimary };
    };

    const allowedDismissals = extras.noBall ? (['Run Out'] as const) : DISMISSAL_TYPES;
    const bowlerModalSuggestions =
        matchState?.activeInning === 2
            ? matchState.inning2BowlerSuggestions
            : matchState?.inning1BowlerSuggestions ?? [];

    const getSecondInningsChipTarget = (name: string) => {
        if (!newInningPlayers.striker.trim()) {
            setNewInningPlayers((prev) => ({ ...prev, striker: name }));
        } else if (
            !newInningPlayers.nonStriker.trim() &&
            normalizePlayerName(newInningPlayers.striker) !== normalizePlayerName(name)
        ) {
            setNewInningPlayers((prev) => ({ ...prev, nonStriker: name }));
        }
    };

    return (
        <ScreenWrapper noPadding edges={['top']}>
            <AppHeader
                compact
                title="Live Scoring"
                badge={activeState?.inning === 2 ? '2ND INNINGS' : '1ST INNINGS'}
                onBack={() => navigation.goBack()}
            />

            {/* Enamel Scorebox Block */}
            <View
                style={[
                    styles.scorebox,
                    { backgroundColor: theme.scoreboxBg, borderBottomColor: theme.primary },
                ]}
            >
                <View style={styles.matchRow}>
                    <Text style={[styles.teamName, { color: theme.scoreboxText }]} numberOfLines={1}>
                        {activeState?.battingTeam.name || 'Batting'}
                    </Text>
                    <Text style={[styles.vsText, { color: theme.scoreboxMuted }]} numberOfLines={1}>
                        vs {activeState?.bowlingTeam.name || 'Bowling'} · {matchState?.match.overs || 16} OV
                    </Text>
                </View>

                <View style={styles.mainScoreRow}>
                    <View>
                        <Text style={[styles.mainScore, styles.tabularNum, { color: theme.scoreboxText }]}>
                            {activeState?.totalRuns ?? 0}
                            <Text style={{ color: theme.scoreAccent }}>/{activeState?.wickets ?? 0}</Text>
                        </Text>
                        {activeState?.target !== null && activeState?.target !== undefined && (
                            <View style={[styles.targetPill, { backgroundColor: theme.warning }]}>
                                <Text style={[styles.targetPillText, styles.tabularNum, { color: theme.onWarning }]}>
                                    TARGET {activeState.target} · NEED {activeState.runsNeeded} OFF{' '}
                                    {activeState.ballsRemaining}B
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.ratesBox}>
                        <Text style={[styles.oversText, styles.tabularNum, { color: theme.scoreboxText }]}>
                            {activeState?.oversDisplay ?? '0.0'}
                        </Text>
                        <Text style={[styles.rateText, styles.tabularNum, { color: theme.scoreboxMuted }]}>
                            CRR {activeState?.crr ?? '0.00'}
                            {activeState?.rrr ? ` · RRR ${activeState.rrr}` : ''}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Over Ribbon Band */}
            <View
                style={[
                    styles.overStrip,
                    { backgroundColor: theme.surfaceAlt, borderBottomColor: theme.border },
                ]}
            >
                <Text style={[styles.overLabel, styles.tabularNum, { color: theme.textSecondary }]}>
                    OVER {(activeState?.oversCompleted ?? 0) + 1}
                </Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.ballList}
                >
                    {!activeState || activeState.currentOverBalls.length === 0 ? (
                        <Text style={[styles.overEmptyText, { color: theme.textSecondary }]}>
                            Ready for ball 1
                        </Text>
                    ) : (
                        activeState.currentOverBalls.map((badge) => {
                            const pill = getBallPillStyle(badge);
                            return (
                                <View
                                    key={badge.id}
                                    style={[
                                        styles.ballPill,
                                        { backgroundColor: pill.bg, borderColor: pill.border },
                                    ]}
                                >
                                    <Text style={[styles.ballText, styles.tabularNum, { color: pill.text }]}>
                                        {badge.label}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            </View>

            {/* Scrollable Scorecard Area */}
            <ScrollView
                style={[styles.scrollArea, { backgroundColor: theme.background }]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View
                    style={[
                        styles.tableCard,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                >
                    <View
                        style={[
                            styles.tableRow,
                            styles.tableHeader,
                            { backgroundColor: theme.surfaceSubtle, borderBottomColor: theme.border },
                        ]}
                    >
                        <Text style={[styles.cellName, styles.headerText, { color: theme.textSecondary }]}>
                            BATTER
                        </Text>
                        <Text style={[styles.cell, styles.headerText, { color: theme.textSecondary }]}>R</Text>
                        <Text style={[styles.cell, styles.headerText, { color: theme.textSecondary }]}>B</Text>
                        <Text style={[styles.cell, styles.headerText, { color: theme.textSecondary }]}>4s</Text>
                        <Text style={[styles.cell, styles.headerText, { color: theme.textSecondary }]}>6s</Text>
                    </View>
                    <View style={[styles.tableRow, { borderBottomColor: theme.borderSubtle }]}>
                        <Text style={[styles.cellName, { color: theme.textPrimary }]} numberOfLines={1}>
                            {strikerStat?.name || 'Striker'} <Text style={{ color: theme.primary }}>●</Text>
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textPrimary }]}>
                            {strikerStat?.runs ?? 0}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {strikerStat?.balls ?? 0}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {strikerStat?.fours ?? 0}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {strikerStat?.sixes ?? 0}
                        </Text>
                    </View>
                    <View style={[styles.tableRow, styles.tableRowLast]}>
                        <Text style={[styles.cellName, { color: theme.textPrimary }]} numberOfLines={1}>
                            {nonStrikerStat?.name || 'Non-Striker'}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textPrimary }]}>
                            {nonStrikerStat?.runs ?? 0}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {nonStrikerStat?.balls ?? 0}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {nonStrikerStat?.fours ?? 0}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {nonStrikerStat?.sixes ?? 0}
                        </Text>
                    </View>
                </View>

                <View
                    style={[
                        styles.tableCard,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                >
                    <View
                        style={[
                            styles.tableRow,
                            styles.tableHeader,
                            { backgroundColor: theme.surfaceSubtle, borderBottomColor: theme.border },
                        ]}
                    >
                        <Text style={[styles.cellName, styles.headerText, { color: theme.textSecondary }]}>
                            BOWLER
                        </Text>
                        <Text style={[styles.cell, styles.headerText, { color: theme.textSecondary }]}>O</Text>
                        <Text style={[styles.cell, styles.headerText, { color: theme.textSecondary }]}>M</Text>
                        <Text style={[styles.cell, styles.headerText, { color: theme.textSecondary }]}>R</Text>
                        <Text style={[styles.cell, styles.headerText, { color: theme.textSecondary }]}>W</Text>
                    </View>
                    <View style={[styles.tableRow, styles.tableRowLast]}>
                        <Text style={[styles.cellName, { color: theme.textPrimary }]} numberOfLines={1}>
                            {displayBowlerName}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textPrimary }]}>
                            {bowlerStat?.oversDisplay ?? '0.0'}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {bowlerStat?.maidens ?? 0}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textPrimary }]}>
                            {bowlerStat?.runsConceded ?? 0}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textPrimary }]}>
                            {bowlerStat?.wickets ?? 0}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {snackbar && (
                <View style={[styles.snackbar, { backgroundColor: theme.headerBg, borderColor: theme.primary }]}>
                    <Text style={[styles.snackbarText, { color: theme.headerText }]}>{snackbar}</Text>
                </View>
            )}

            {/* Non-Overlapping Docked Control Keypad */}
            <View
                style={[
                    styles.controlPad,
                    {
                        backgroundColor: theme.surface,
                        borderTopColor: theme.border,
                        paddingBottom: Math.max(insets.bottom, 12),
                    },
                ]}
            >
                <View style={styles.extrasRow}>
                    {EXTRA_KEYS.map(({ key, label }) => {
                        const isActive = extras[key];
                        const isWicketKey = key === 'wicket';
                        const bg = isWicketKey
                            ? isActive
                                ? theme.danger
                                : theme.dangerContainer
                            : isActive
                            ? theme.primary
                            : theme.surfaceSubtle;
                        const border = isWicketKey
                            ? theme.danger
                            : isActive
                            ? theme.primary
                            : theme.border;
                        const txt = isWicketKey
                            ? isActive
                                ? theme.onDanger
                                : theme.onDangerContainer
                            : isActive
                            ? theme.onPrimary
                            : theme.textPrimary;

                        return (
                            <TouchableOpacity
                                key={key}
                                style={[styles.extraChip, { backgroundColor: bg, borderColor: border }]}
                                onPress={() => toggleExtra(key)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.extraChipText, { color: txt }]}>{label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: theme.keypadActionBg }]}
                        onPress={handleRetire}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.actionText, { color: theme.keypadActionText }]}>Retire Batter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: theme.keypadActionBg }]}
                        onPress={() => setManualStrikeSwapped((v) => !v)}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.actionText, { color: theme.keypadActionText }]}>Swap Strike</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.keypadContainer}>
                    <View style={styles.keypadLeft}>
                        <TouchableOpacity
                            style={[
                                styles.rectButton,
                                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                            ]}
                            onPress={handleUndo}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.rectButtonText, { color: theme.textPrimary }]}>Undo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.rectButton,
                                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                            ]}
                            onPress={() => setInfoSheet('partnership')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.rectButtonText, { color: theme.textPrimary }]}>Partn.</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.rectButton,
                                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                            ]}
                            onPress={() => setInfoSheet('extras')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.rectButtonText, { color: theme.textPrimary }]}>Extras</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.keypadRight}>
                        <View style={styles.keypadGridRow}>
                            {[0, 1, 2, 3].map((n) => (
                                <TouchableOpacity
                                    key={n}
                                    style={[
                                        styles.runButton,
                                        { backgroundColor: theme.keypadKeyBg, borderColor: theme.keypadKeyBorder },
                                    ]}
                                    onPress={() => handleScoreClick(n)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.runButtonText, styles.tabularNum, { color: theme.textPrimary }]}>
                                        {n}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.keypadGridRow}>
                            {[4, 5, 6].map((n) => {
                                const isBoundary = n === 4 || n === 6;
                                return (
                                    <TouchableOpacity
                                        key={n}
                                        style={[
                                            styles.runButton,
                                            {
                                                backgroundColor: isBoundary ? theme.primary : theme.keypadKeyBg,
                                                borderColor: isBoundary ? theme.primary : theme.keypadKeyBorder,
                                            },
                                        ]}
                                        onPress={() => handleScoreClick(n)}
                                        activeOpacity={0.8}
                                    >
                                        <Text
                                            style={[
                                                styles.runButtonText,
                                                styles.tabularNum,
                                                { color: isBoundary ? theme.onPrimary : theme.textPrimary },
                                            ]}
                                        >
                                            {n}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity
                                style={[
                                    styles.runButton,
                                    { backgroundColor: theme.keypadKeyBg, borderColor: theme.keypadKeyBorder },
                                ]}
                                onPress={() => setShowCompleteInningsModal(true)}
                                activeOpacity={0.8}
                                accessibilityLabel="Complete innings"
                            >
                                <Text style={[styles.runButtonText, { color: theme.textPrimary }]}>.</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>

            {/* Partnerships Bottom Sheet */}
            <PartnershipBottomSheet
                visible={infoSheet === 'partnership'}
                partnerships={activeState?.partnerships ?? []}
                onClose={() => setInfoSheet(null)}
            />

            {/* Extras Breakdown Modal */}
            <Modal
                visible={infoSheet === 'extras'}
                animationType="fade"
                transparent
                onRequestClose={() => setInfoSheet(null)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
                    <View
                        style={[
                            styles.modalContent,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                            Extras Breakdown
                        </Text>

                        <View style={styles.statGrid}>
                            {[
                                { k: 'WD', v: activeState?.extras.wide ?? 0 },
                                { k: 'NB', v: activeState?.extras.noBall ?? 0 },
                                { k: 'B', v: activeState?.extras.byes ?? 0 },
                                { k: 'LB', v: activeState?.extras.legByes ?? 0 },
                                { k: 'TOTAL', v: activeState?.extras.total ?? 0 },
                            ].map((item) => (
                                <View
                                    key={item.k}
                                    style={[
                                        styles.statCell,
                                        { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                                    ]}
                                >
                                    <Text style={[styles.label, { color: theme.textSecondary }]}>{item.k}</Text>
                                    <Text style={[styles.statBig, styles.tabularNum, { color: theme.textPrimary }]}>
                                        {item.v}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.primary }]}
                            onPress={() => setInfoSheet(null)}
                        >
                            <Text style={[styles.saveButtonText, { color: theme.onPrimary }]}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Manual Complete Innings Dialog ("." Button) */}
            <Modal
                visible={showCompleteInningsModal}
                animationType="fade"
                transparent
                onRequestClose={() => setShowCompleteInningsModal(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
                    <View
                        style={[
                            styles.modalContent,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                            Complete {matchState?.activeInning === 2 ? '2nd' : '1st'} Innings?
                        </Text>
                        <Text style={[styles.breakBody, styles.tabularNum, { color: theme.textSecondary }]}>
                            {matchState?.activeInning === 1
                                ? `Lock ${activeState?.battingTeam.name} at ${activeState?.totalRuns ?? 0}/${activeState?.wickets ?? 0} (${activeState?.oversDisplay ?? '0.0'} ov) and begin the 2nd innings chase (Target ${(activeState?.totalRuns ?? 0) + 1}).`
                                : `Finalize match at ${activeState?.totalRuns ?? 0}/${activeState?.wickets ?? 0} (${activeState?.oversDisplay ?? '0.0'} ov) against ${matchState?.inning1.totalRuns ?? 0} and declare the result.`}
                        </Text>
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.primary }]}
                            onPress={handleCompleteInningsConfirm}
                        >
                            <Text style={[styles.saveButtonText, { color: theme.onPrimary }]}>
                                Complete Innings
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setShowCompleteInningsModal(false)}
                        >
                            <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Innings Break Modal */}
            <Modal
                visible={showInningBreakModal}
                animationType="fade"
                transparent
                onRequestClose={() => {}}
            >
                <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
                    <View
                        style={[
                            styles.modalContent,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>1st Innings Complete</Text>
                        <View style={[styles.targetModalBadge, { backgroundColor: theme.warning }]}>
                            <Text style={[styles.targetModalText, styles.tabularNum, { color: theme.onWarning }]}>
                                TARGET: {(matchState?.inning1.totalRuns ?? 0) + 1} RUNS
                            </Text>
                        </View>
                        <Text style={[styles.breakBody, styles.tabularNum, { color: theme.textSecondary }]}>
                            Requires {(matchState?.inning1.totalRuns ?? 0) + 1} runs in{' '}
                            {(matchState?.match.overs || 16) * 6} balls (RRR{' '}
                            {(((matchState?.inning1.totalRuns ?? 0) + 1) / (matchState?.match.overs || 16)).toFixed(2)}).
                        </Text>
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.primary }]}
                            onPress={() => {
                                setShowInningBreakModal(false);
                                setInningStartError(null);
                                setNewInningPlayers({ striker: '', nonStriker: '', bowler: '' });
                                setShowInningStartModal(true);
                            }}
                        >
                            <Text style={[styles.saveButtonText, { color: theme.onPrimary }]}>
                                Start 2nd Innings
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Bowler Modal */}
            <Modal
                visible={showBowlerModal}
                animationType="fade"
                transparent
                onRequestClose={() => setShowBowlerModal(false)}
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
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                            End of Over · Select Bowler
                        </Text>

                        <Text style={[styles.label, { color: theme.textSecondary }]}>NEW BOWLER NAME</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: theme.surfaceSubtle,
                                    borderColor: bowlerInputError ? theme.danger : theme.border,
                                    color: theme.textPrimary,
                                },
                            ]}
                            placeholder="Enter bowler name"
                            placeholderTextColor={theme.textPlaceholder}
                            value={newBowlerName}
                            onChangeText={setNewBowlerName}
                        />
                        {bowlerInputError && (
                            <Text style={[styles.errorText, { color: theme.danger }]}>{bowlerInputError}</Text>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.saveButton,
                                { backgroundColor: bowlerInputError ? theme.surfaceSubtle : theme.primary },
                            ]}
                            disabled={Boolean(bowlerInputError)}
                            onPress={() => confirmNewBowler(undefined)}
                        >
                            <Text
                                style={[
                                    styles.saveButtonText,
                                    { color: bowlerInputError ? theme.textSecondary : theme.onPrimary },
                                ]}
                            >
                                Add & Select Bowler
                            </Text>
                        </TouchableOpacity>

                        {bowlerModalSuggestions.length > 0 && (
                            <>
                                <Text style={[styles.label, { color: theme.textSecondary, marginTop: 16 }]}>
                                    {matchState?.activeInning === 2 ? 'FIELDING ROSTER & BOWLERS' : 'EXISTING BOWLERS'}
                                </Text>
                                <ScrollView style={{ maxHeight: 170 }}>
                                    <View style={styles.chipWrap}>
                                        {bowlerModalSuggestions.map((p) => {
                                            const isPrevOver = p.id === activeState?.previousOverBowlerId;
                                            return (
                                                <TouchableOpacity
                                                    key={p.id}
                                                    disabled={isPrevOver}
                                                    style={[
                                                        styles.chip,
                                                        {
                                                            backgroundColor: theme.surfaceSubtle,
                                                            borderColor: theme.border,
                                                            opacity: isPrevOver ? 0.45 : 1,
                                                        },
                                                    ]}
                                                    onPress={() => confirmNewBowler(p)}
                                                >
                                                    <Text style={[styles.chipText, { color: theme.textPrimary }]}>
                                                        {p.name}
                                                        {isPrevOver ? ' (Prev Over)' : ''}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            </>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Wicket Modal */}
            <Modal
                visible={showWicketModal}
                animationType="fade"
                transparent
                onRequestClose={() => setShowWicketModal(false)}
            >
                <KeyboardAvoidingView
                    style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <ScrollView contentContainerStyle={styles.modalScrollCenter} keyboardShouldPersistTaps="handled">
                        <View
                            style={[
                                styles.modalContent,
                                { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}
                        >
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Wicket Details</Text>

                            <Text style={[styles.label, { color: theme.textSecondary }]}>HOW OUT</Text>
                            <View style={styles.chipWrap}>
                                {allowedDismissals.map((t) => {
                                    const selected = wicketDetails.type === t;
                                    return (
                                        <TouchableOpacity
                                            key={t}
                                            style={[
                                                styles.chip,
                                                {
                                                    backgroundColor: selected ? theme.danger : theme.surfaceSubtle,
                                                    borderColor: selected ? theme.danger : theme.border,
                                                },
                                            ]}
                                            onPress={() =>
                                                setWicketDetails((prev) => ({
                                                    ...prev,
                                                    type: t,
                                                    fielderName: dismissalRequiresFielder(t) ? prev.fielderName : '',
                                                }))
                                            }
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    { color: selected ? theme.onDanger : theme.textPrimary },
                                                ]}
                                            >
                                                {t}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.label, { color: theme.textSecondary }]}>WHO OUT?</Text>
                            <View style={styles.chipWrap}>
                                <TouchableOpacity
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor:
                                                wicketDetails.whoOut === displayStrikerId
                                                    ? theme.primary
                                                    : theme.surfaceSubtle,
                                            borderColor:
                                                wicketDetails.whoOut === displayStrikerId
                                                    ? theme.primary
                                                    : theme.border,
                                        },
                                    ]}
                                    onPress={() =>
                                        setWicketDetails((prev) => ({ ...prev, whoOut: displayStrikerId }))
                                    }
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            {
                                                color:
                                                    wicketDetails.whoOut === displayStrikerId
                                                        ? theme.onPrimary
                                                        : theme.textPrimary,
                                            },
                                        ]}
                                    >
                                        {strikerStat?.name || 'Striker'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor:
                                                wicketDetails.whoOut === displayNonStrikerId
                                                    ? theme.primary
                                                    : theme.surfaceSubtle,
                                            borderColor:
                                                wicketDetails.whoOut === displayNonStrikerId
                                                    ? theme.primary
                                                    : theme.border,
                                        },
                                    ]}
                                    onPress={() =>
                                        setWicketDetails((prev) => ({ ...prev, whoOut: displayNonStrikerId }))
                                    }
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            {
                                                color:
                                                    wicketDetails.whoOut === displayNonStrikerId
                                                        ? theme.onPrimary
                                                        : theme.textPrimary,
                                            },
                                        ]}
                                    >
                                        {nonStrikerStat?.name || 'Non-Striker'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {needsFielderInput && (
                                <>
                                    <Text style={[styles.label, { color: theme.textSecondary }]}>
                                        WHO CAUGHT / ASSISTED?
                                    </Text>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: theme.surfaceSubtle,
                                                borderColor: fielderError ? theme.danger : theme.border,
                                                color: theme.textPrimary,
                                            },
                                        ]}
                                        placeholder="Enter fielder name"
                                        placeholderTextColor={theme.textPlaceholder}
                                        value={wicketDetails.fielderName}
                                        onChangeText={(t) =>
                                            setWicketDetails((prev) => ({ ...prev, fielderName: t }))
                                        }
                                    />
                                    {fielderError && (
                                        <Text style={[styles.errorText, { color: theme.danger }]}>{fielderError}</Text>
                                    )}
                                    {(matchState?.activeFieldingSuggestions.length ?? 0) > 0 && (
                                        <View style={styles.chipWrap}>
                                            {matchState!.activeFieldingSuggestions.map((p) => (
                                                <TouchableOpacity
                                                    key={p.id}
                                                    style={[
                                                        styles.chip,
                                                        {
                                                            backgroundColor: theme.surfaceSubtle,
                                                            borderColor: theme.border,
                                                        },
                                                    ]}
                                                    onPress={() =>
                                                        setWicketDetails((prev) => ({ ...prev, fielderName: p.name }))
                                                    }
                                                >
                                                    <Text style={[styles.chipText, { color: theme.textPrimary }]}>
                                                        {p.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </>
                            )}

                            {!isTenthWicket && (
                                <>
                                    <Text style={[styles.label, { color: theme.textSecondary }]}>NEW BATSMAN</Text>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: theme.surfaceSubtle,
                                                borderColor: wicketBatsmanError ? theme.danger : theme.border,
                                                color: theme.textPrimary,
                                            },
                                        ]}
                                        placeholder="Enter incoming batsman"
                                        placeholderTextColor={theme.textPlaceholder}
                                        value={wicketDetails.newBatsmanName}
                                        onChangeText={(t) =>
                                            setWicketDetails((prev) => ({ ...prev, newBatsmanName: t }))
                                        }
                                    />
                                    {wicketBatsmanError && (
                                        <Text style={[styles.errorText, { color: theme.danger }]}>
                                            {wicketBatsmanError}
                                        </Text>
                                    )}
                                    {matchState?.activeInning === 2 &&
                                        matchState.inning2BatterSuggestions.length > 0 && (
                                            <View style={styles.chipWrap}>
                                                {matchState.inning2BatterSuggestions.map((p) => (
                                                    <TouchableOpacity
                                                        key={p.id}
                                                        style={[
                                                            styles.chip,
                                                            {
                                                                backgroundColor: theme.surfaceSubtle,
                                                                borderColor: theme.border,
                                                            },
                                                        ]}
                                                        onPress={() =>
                                                            setWicketDetails((prev) => ({
                                                                ...prev,
                                                                newBatsmanName: p.name,
                                                            }))
                                                        }
                                                    >
                                                        <Text style={[styles.chipText, { color: theme.textPrimary }]}>
                                                            {p.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                </>
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.saveButton,
                                    {
                                        backgroundColor:
                                            wicketBatsmanError || fielderError ? theme.surfaceSubtle : theme.danger,
                                    },
                                ]}
                                disabled={Boolean(wicketBatsmanError || fielderError)}
                                onPress={confirmWicket}
                            >
                                <Text
                                    style={[
                                        styles.saveButtonText,
                                        {
                                            color:
                                                wicketBatsmanError || fielderError
                                                    ? theme.textSecondary
                                                    : theme.onDanger,
                                        },
                                    ]}
                                >
                                    {isTenthWicket ? 'Confirm All Out' : 'Confirm Wicket'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowWicketModal(false)}>
                                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

            {/* 2nd Innings Start Modal */}
            <Modal
                visible={showInningStartModal}
                animationType="fade"
                transparent
                onRequestClose={() => {}}
            >
                <KeyboardAvoidingView
                    style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <ScrollView contentContainerStyle={styles.modalScrollCenter} keyboardShouldPersistTaps="handled">
                        <View
                            style={[
                                styles.modalContent,
                                { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}
                        >
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Start 2nd Innings</Text>
                            <View style={[styles.targetModalBadge, { backgroundColor: theme.warning }]}>
                                <Text style={[styles.targetModalText, styles.tabularNum, { color: theme.onWarning }]}>
                                    TARGET: {(matchState?.inning1.totalRuns ?? 0) + 1}
                                </Text>
                            </View>

                            {inningStartError && (
                                <Text style={[styles.errorText, { color: theme.danger }]}>{inningStartError}</Text>
                            )}

                            <Text style={[styles.label, { color: theme.textSecondary }]}>STRIKER</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: theme.surfaceSubtle,
                                        borderColor: theme.border,
                                        color: theme.textPrimary,
                                    },
                                ]}
                                placeholder="Striker name"
                                placeholderTextColor={theme.textPlaceholder}
                                value={newInningPlayers.striker}
                                onChangeText={(t) => {
                                    setInningStartError(null);
                                    setNewInningPlayers((prev) => ({ ...prev, striker: t }));
                                }}
                            />

                            <Text style={[styles.label, { color: theme.textSecondary }]}>NON-STRIKER</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: theme.surfaceSubtle,
                                        borderColor: theme.border,
                                        color: theme.textPrimary,
                                    },
                                ]}
                                placeholder="Non-striker name"
                                placeholderTextColor={theme.textPlaceholder}
                                value={newInningPlayers.nonStriker}
                                onChangeText={(t) => {
                                    setInningStartError(null);
                                    setNewInningPlayers((prev) => ({ ...prev, nonStriker: t }));
                                }}
                            />

                            {(matchState?.inning2BatterSuggestions.length ?? 0) > 0 && (
                                <View style={styles.chipWrap}>
                                    {matchState!.inning2BatterSuggestions.map((p) => {
                                        const picked =
                                            normalizePlayerName(newInningPlayers.striker) ===
                                                normalizePlayerName(p.name) ||
                                            normalizePlayerName(newInningPlayers.nonStriker) ===
                                                normalizePlayerName(p.name);
                                        return (
                                            <TouchableOpacity
                                                key={p.id}
                                                disabled={picked}
                                                style={[
                                                    styles.chip,
                                                    {
                                                        backgroundColor: theme.surfaceSubtle,
                                                        borderColor: theme.border,
                                                        opacity: picked ? 0.45 : 1,
                                                    },
                                                ]}
                                                onPress={() => getSecondInningsChipTarget(p.name)}
                                            >
                                                <Text style={[styles.chipText, { color: theme.textPrimary }]}>
                                                    {p.name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}

                            <Text style={[styles.label, { color: theme.textSecondary }]}>OPENING BOWLER</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: theme.surfaceSubtle,
                                        borderColor: theme.border,
                                        color: theme.textPrimary,
                                    },
                                ]}
                                placeholder="Bowler name"
                                placeholderTextColor={theme.textPlaceholder}
                                value={newInningPlayers.bowler}
                                onChangeText={(t) => {
                                    setInningStartError(null);
                                    setNewInningPlayers((prev) => ({ ...prev, bowler: t }));
                                }}
                            />

                            {(matchState?.inning2BowlerSuggestions.length ?? 0) > 0 && (
                                <View style={styles.chipWrap}>
                                    {matchState!.inning2BowlerSuggestions.map((p) => (
                                        <TouchableOpacity
                                            key={p.id}
                                            style={[
                                                styles.chip,
                                                {
                                                    backgroundColor: theme.surfaceSubtle,
                                                    borderColor: theme.border,
                                                },
                                            ]}
                                            onPress={() =>
                                                setNewInningPlayers((prev) => ({ ...prev, bowler: p.name }))
                                            }
                                        >
                                            <Text style={[styles.chipText, { color: theme.textPrimary }]}>
                                                {p.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                                onPress={confirmSecondInningsPlayers}
                            >
                                <Text style={[styles.saveButtonText, { color: theme.onPrimary }]}>
                                    Start 2nd Innings
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    tabularNum: {
        fontVariant: ['tabular-nums'],
    },
    scorebox: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 14,
        borderBottomWidth: 4,
    },
    matchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
        gap: 8,
    },
    teamName: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 18,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        flex: 1,
    },
    vsText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '700',
    },
    mainScoreRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    mainScore: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 44,
        fontWeight: '900',
        lineHeight: 48,
    },
    targetPill: {
        alignSelf: 'flex-start',
        marginTop: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 5,
    },
    targetPillText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    ratesBox: {
        alignItems: 'flex-end',
    },
    oversText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 22,
        fontWeight: '800',
    },
    rateText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '700',
        marginTop: 2,
    },
    overStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        minHeight: 50,
        paddingVertical: 9,
        borderBottomWidth: 1,
        gap: 10,
    },
    overLabel: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    ballList: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    overEmptyText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '600',
    },
    ballPill: {
        minWidth: 30,
        height: 30,
        paddingHorizontal: 8,
        borderRadius: 15,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ballText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '800',
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        padding: 12,
        gap: 10,
        paddingBottom: 16,
    },
    tableCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    tableHeader: {
        borderBottomWidth: 1,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    tableRowLast: {
        borderBottomWidth: 0,
    },
    cellName: {
        fontFamily: APP_FONT_FAMILY,
        flex: 3,
        fontSize: 13,
        fontWeight: '700',
    },
    cell: {
        fontFamily: APP_FONT_FAMILY,
        flex: 1,
        fontSize: 13,
        textAlign: 'center',
        fontWeight: '700',
    },
    headerText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    snackbar: {
        marginHorizontal: 12,
        marginBottom: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    snackbarText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 13,
        fontWeight: '700',
    },
    controlPad: {
        borderTopWidth: 2,
        paddingHorizontal: 12,
        paddingTop: 10,
        gap: 8,
    },
    extrasRow: {
        flexDirection: 'row',
        gap: 8,
    },
    extraChip: {
        flex: 1,
        minHeight: 48,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    extraChipText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        minHeight: 48,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        fontFamily: APP_FONT_FAMILY,
        fontWeight: '700',
        fontSize: 13,
    },
    keypadContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    keypadLeft: {
        width: '23%',
        gap: 8,
    },
    rectButton: {
        minHeight: 48,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rectButtonText: {
        fontFamily: APP_FONT_FAMILY,
        fontWeight: '800',
        fontSize: 12,
    },
    keypadRight: {
        flex: 1,
        gap: 8,
    },
    keypadGridRow: {
        flexDirection: 'row',
        gap: 8,
    },
    runButton: {
        flex: 1,
        height: 76,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    runButtonText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 22,
        fontWeight: '800',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    modalScrollCenter: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    modalContent: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
    },
    modalTitle: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 19,
        fontWeight: '800',
        marginBottom: 14,
    },
    targetModalBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        marginBottom: 12,
    },
    targetModalText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '800',
    },
    breakBody: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 16,
        lineHeight: 20,
    },
    statGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14,
    },
    statCell: {
        minWidth: '30%',
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
    },
    statBig: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 22,
        fontWeight: '900',
    },
    label: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    input: {
        fontFamily: APP_FONT_FAMILY,
        borderRadius: 10,
        paddingHorizontal: 14,
        minHeight: 48,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        borderWidth: 1,
    },
    errorText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 10,
    },
    saveButton: {
        borderRadius: 12,
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    saveButtonText: {
        fontFamily: APP_FONT_FAMILY,
        fontWeight: '800',
        fontSize: 15,
    },
    modalItem: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        minHeight: 48,
        justifyContent: 'center',
    },
    modalItemText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 15,
        fontWeight: '600',
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14,
    },
    chip: {
        paddingHorizontal: 14,
        minHeight: 48,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipText: {
        fontFamily: APP_FONT_FAMILY,
        fontWeight: '700',
        fontSize: 13,
    },
    cancelButton: {
        marginTop: 8,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 15,
        fontWeight: '700',
    },
});
