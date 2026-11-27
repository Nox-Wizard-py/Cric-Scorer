import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { db } from '../database/db';
import { Delivery, Match, Player, Team } from '../database/types';
import {
    InningsDerivedState,
    MatchDerivedState,
    OverDeliveryChip,
    deriveMatchState,
    formatStrikeRate,
} from '../engine/scoringEngine';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { AppHeader } from '../components/AppHeader';
import { exportScorecardPdf } from '../utils/scorecardPdf';
import { APP_FONT_FAMILY } from '../constants/colors';
import { useTheme } from '../constants/theme';

type TabKey = 'scoreboard' | 'overs';

export default function ScorecardScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const { matchId } = route.params || {};

    const [matchState, setMatchState] = useState<MatchDerivedState | null>(null);
    const [activeTab, setActiveTab] = useState<TabKey>('scoreboard');
    const [expandedInnings, setExpandedInnings] = useState<{ 1: boolean; 2: boolean }>({
        1: true,
        2: true,
    });
    const [oversInningTab, setOversInningTab] = useState<1 | 2>(1);
    const [exportingPdf, setExportingPdf] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if (!matchId) return;
            const match = db.getFirstSync('SELECT * FROM Matches WHERE id = ?', matchId) as Match | null;
            if (!match) return;

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
            setExpandedInnings({
                1: !derived.inning2,
                2: Boolean(derived.inning2),
            });
            setOversInningTab(derived.inning2 && derived.inning2.oversHistory.length > 0 ? 2 : 1);
        }, [matchId])
    );

    const handleDownloadPdf = async () => {
        if (!matchState || exportingPdf) return;
        setExportingPdf(true);
        try {
            await exportScorecardPdf(matchState);
        } catch (err: any) {
            Alert.alert('PDF Export Failed', err?.message || 'Unable to generate or share scorecard PDF.');
        } finally {
            setExportingPdf(false);
        }
    };

    const toggleAccordion = (inning: 1 | 2) => {
        setExpandedInnings((prev) => ({ ...prev, [inning]: !prev[inning] }));
    };

    const getChipColors = (chip: OverDeliveryChip) => {
        if (chip.kind === 'boundary') {
            return { bg: theme.primary, border: theme.primary, text: theme.onPrimary };
        }
        if (chip.kind === 'wicket') {
            return { bg: theme.danger, border: theme.danger, text: theme.onDanger };
        }
        if (chip.kind === 'extra') {
            return { bg: theme.warning, border: theme.warning, text: theme.onWarning };
        }
        return { bg: theme.surfaceSubtle, border: theme.border, text: theme.textPrimary };
    };

    const matchTitle = matchState
        ? `${matchState.firstBatTeam.name} v/s ${matchState.firstBowlTeam.name}`
        : 'Scorecard';

    const getStatusBannerText = (state: MatchDerivedState): string => {
        if (state.result) {
            return state.result.isTie
                ? 'Match Tied'
                : `${state.result.winner} won ${state.result.margin}`;
        }
        const tossWinnerName =
            state.match.toss_winner_id === state.firstBatTeam.id
                ? state.firstBatTeam.name
                : state.firstBowlTeam.name;
        return `${tossWinnerName} won the toss and opted to ${state.match.opt_to} first.`;
    };

    const renderInningsAccordion = (innings: InningsDerivedState) => {
        const isExpanded = expandedInnings[innings.inning];

        return (
            <View
                key={innings.inning}
                style={[styles.accordionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
                <TouchableOpacity
                    style={[
                        styles.accordionHeader,
                        { backgroundColor: theme.scoreboxBg, borderBottomColor: theme.primary },
                    ]}
                    onPress={() => toggleAccordion(innings.inning)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Toggle ${innings.battingTeam.name} scorecard`}
                >
                    <Text style={[styles.accordionTeam, { color: theme.scoreboxText }]} numberOfLines={1}>
                        {innings.battingTeam.name}
                    </Text>
                    <View style={styles.accordionRight}>
                        <Text style={[styles.accordionScore, styles.tabularNum, { color: theme.scoreboxText }]}>
                            {innings.totalRuns}-{innings.wickets}{' '}
                            <Text style={{ color: theme.scoreAccent }}>({innings.oversDisplay})</Text>
                        </Text>
                        <MaterialCommunityIcons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color={theme.headerMuted}
                        />
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.accordionBody}>
                        {/* Batsman Table */}
                        <View
                            style={[
                                styles.tableHead,
                                { backgroundColor: theme.surfaceSubtle, borderBottomColor: theme.border },
                            ]}
                        >
                            <Text style={[styles.colNameWide, styles.thText, { color: theme.textSecondary }]}>
                                Batsman
                            </Text>
                            <Text style={[styles.colStat, styles.thText, { color: theme.textSecondary }]}>R</Text>
                            <Text style={[styles.colStat, styles.thText, { color: theme.textSecondary }]}>B</Text>
                            <Text style={[styles.colStat, styles.thText, { color: theme.textSecondary }]}>4s</Text>
                            <Text style={[styles.colStat, styles.thText, { color: theme.textSecondary }]}>6s</Text>
                            <Text style={[styles.colStatWide, styles.thText, { color: theme.textSecondary }]}>SR</Text>
                        </View>

                        {innings.battersList.map((b) => (
                            <View
                                key={b.playerId}
                                style={[styles.tableRow, { borderBottomColor: theme.borderSubtle }]}
                            >
                                <View style={styles.colNameWide}>
                                    <Text style={[styles.playerName, { color: theme.textPrimary }]} numberOfLines={1}>
                                        {b.name}
                                    </Text>
                                    <Text style={[styles.dismissalText, { color: theme.textSecondary }]} numberOfLines={2}>
                                        {b.dismissalText}
                                    </Text>
                                </View>
                                <Text style={[styles.colStat, styles.tdStrong, styles.tabularNum, { color: theme.textPrimary }]}>
                                    {b.runs}
                                </Text>
                                <Text style={[styles.colStat, styles.tdMuted, styles.tabularNum, { color: theme.textSecondary }]}>
                                    {b.balls}
                                </Text>
                                <Text style={[styles.colStat, styles.tdMuted, styles.tabularNum, { color: theme.textSecondary }]}>
                                    {b.fours}
                                </Text>
                                <Text style={[styles.colStat, styles.tdMuted, styles.tabularNum, { color: theme.textSecondary }]}>
                                    {b.sixes}
                                </Text>
                                <Text style={[styles.colStatWide, styles.tdMuted, styles.tabularNum, { color: theme.textSecondary }]}>
                                    {formatStrikeRate(b.runs, b.balls)}
                                </Text>
                            </View>
                        ))}

                        {/* Extras Row */}
                        <View style={[styles.summaryRow, { borderBottomColor: theme.borderSubtle }]}>
                            <Text style={[styles.summaryLabel, { color: theme.textPrimary }]}>Extras</Text>
                            <Text style={[styles.summaryValue, styles.tabularNum, { color: theme.textSecondary }]}>
                                <Text style={[styles.tdStrong, { color: theme.textPrimary }]}>
                                    {innings.extras.total}
                                </Text>
                                {'   '}
                                {innings.extras.byes} B, {innings.extras.legByes} LB, {innings.extras.wide} WD,{' '}
                                {innings.extras.noBall} NB
                            </Text>
                        </View>

                        {/* Total Row */}
                        <View
                            style={[
                                styles.summaryRow,
                                { backgroundColor: theme.surfaceSubtle, borderBottomColor: theme.border },
                            ]}
                        >
                            <Text style={[styles.summaryLabel, { color: theme.textPrimary }]}>Total</Text>
                            <Text style={[styles.summaryValue, styles.tabularNum, { color: theme.textPrimary }]}>
                                <Text style={styles.tdStrong}>
                                    {innings.totalRuns}-{innings.wickets}
                                </Text>{' '}
                                ({innings.oversDisplay}) {innings.crr}
                            </Text>
                        </View>

                        {/* Bowler Table */}
                        <View
                            style={[
                                styles.tableHead,
                                styles.subSectionHead,
                                { backgroundColor: theme.surfaceSubtle, borderBottomColor: theme.border },
                            ]}
                        >
                            <Text style={[styles.colNameWide, styles.thText, { color: theme.textSecondary }]}>
                                Bowler
                            </Text>
                            <Text style={[styles.colStat, styles.thText, { color: theme.textSecondary }]}>O</Text>
                            <Text style={[styles.colStat, styles.thText, { color: theme.textSecondary }]}>M</Text>
                            <Text style={[styles.colStat, styles.thText, { color: theme.textSecondary }]}>R</Text>
                            <Text style={[styles.colStat, styles.thText, { color: theme.textSecondary }]}>W</Text>
                            <Text style={[styles.colStatWide, styles.thText, { color: theme.textSecondary }]}>ER</Text>
                        </View>

                        {innings.bowlersList.map((bw) => (
                            <View
                                key={bw.playerId}
                                style={[styles.tableRow, { borderBottomColor: theme.borderSubtle }]}
                            >
                                <Text
                                    style={[styles.colNameWide, styles.playerName, { color: theme.textPrimary }]}
                                    numberOfLines={1}
                                >
                                    {bw.name}
                                </Text>
                                <Text style={[styles.colStat, styles.tdMuted, styles.tabularNum, { color: theme.textSecondary }]}>
                                    {bw.oversDisplay}
                                </Text>
                                <Text style={[styles.colStat, styles.tdMuted, styles.tabularNum, { color: theme.textSecondary }]}>
                                    {bw.maidens}
                                </Text>
                                <Text style={[styles.colStat, styles.tdStrong, styles.tabularNum, { color: theme.textPrimary }]}>
                                    {bw.runsConceded}
                                </Text>
                                <Text style={[styles.colStat, styles.tdStrong, styles.tabularNum, { color: theme.primary }]}>
                                    {bw.wickets}
                                </Text>
                                <Text style={[styles.colStatWide, styles.tdMuted, styles.tabularNum, { color: theme.textSecondary }]}>
                                    {bw.economy}
                                </Text>
                            </View>
                        ))}

                        {/* Fall of Wickets Table */}
                        <View
                            style={[
                                styles.tableHead,
                                styles.subSectionHead,
                                { backgroundColor: theme.surfaceSubtle, borderBottomColor: theme.border },
                            ]}
                        >
                            <Text style={[styles.colFowName, styles.thText, { color: theme.textSecondary }]}>
                                Fall of wickets
                            </Text>
                            <Text style={[styles.colFowStat, styles.thText, { color: theme.textSecondary }]}>
                                Score
                            </Text>
                            <Text style={[styles.colFowStat, styles.thText, { color: theme.textSecondary }]}>
                                Over
                            </Text>
                        </View>

                        {innings.fallOfWickets.length === 0 ? (
                            <View style={styles.emptyRow}>
                                <Text style={[styles.dismissalText, { color: theme.textSecondary }]}>
                                    No wickets fallen yet
                                </Text>
                            </View>
                        ) : (
                            innings.fallOfWickets.map((f, idx) => (
                                <View
                                    key={f.wicketNumber}
                                    style={[
                                        styles.tableRow,
                                        idx === innings.fallOfWickets.length - 1 && styles.tableRowLast,
                                        { borderBottomColor: theme.borderSubtle },
                                    ]}
                                >
                                    <Text
                                        style={[styles.colFowName, styles.playerName, { color: theme.textPrimary }]}
                                        numberOfLines={1}
                                    >
                                        {f.batterName}
                                    </Text>
                                    <Text style={[styles.colFowStat, styles.tdStrong, styles.tabularNum, { color: theme.textPrimary }]}>
                                        {f.scoreDisplay}
                                    </Text>
                                    <Text style={[styles.colFowStat, styles.tdMuted, styles.tabularNum, { color: theme.textSecondary }]}>
                                        {f.overDisplay}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>
                )}
            </View>
        );
    };

    const renderOversTab = (state: MatchDerivedState) => {
        const hasInn1Overs = state.inning1.oversHistory.length > 0;
        const hasInn2Overs = Boolean(state.inning2 && state.inning2.oversHistory.length > 0);
        const showInningsToggle = hasInn1Overs && hasInn2Overs;
        const selectedInnings =
            oversInningTab === 2 && state.inning2 ? state.inning2 : state.inning1;
        const oversDesc = [...selectedInnings.oversHistory].reverse();

        return (
            <View style={styles.oversContainer}>
                {showInningsToggle ? (
                    <View
                        style={[
                            styles.inningsToggleBar,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        {([1, 2] as const).map((inn) => {
                            const selected = oversInningTab === inn;
                            const label =
                                inn === 1
                                    ? `1st Innings · ${state.inning1.battingTeam.name}`
                                    : `2nd Innings · ${state.inning2?.battingTeam.name || ''}`;
                            return (
                                <TouchableOpacity
                                    key={inn}
                                    onPress={() => setOversInningTab(inn)}
                                    style={[
                                        styles.inningsToggleBtn,
                                        {
                                            backgroundColor: selected ? theme.primary : 'transparent',
                                        },
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[
                                            styles.inningsToggleText,
                                            { color: selected ? theme.onPrimary : theme.textSecondary },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ) : (
                    <View
                        style={[
                            styles.statusBanner,
                            { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                        ]}
                    >
                        <Text style={[styles.statusText, { color: theme.textPrimary }]}>
                            {selectedInnings.inning === 2 ? '2nd Innings' : '1st Innings'} ·{' '}
                            {selectedInnings.battingTeam.name} ({selectedInnings.totalRuns}-{selectedInnings.wickets})
                        </Text>
                    </View>
                )}

                {oversDesc.length === 0 ? (
                    <View
                        style={[
                            styles.emptyOversCard,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <Text style={[styles.emptyOversText, { color: theme.textSecondary }]}>
                            No deliveries recorded in this innings yet.
                        </Text>
                    </View>
                ) : (
                    oversDesc.map((ov) => (
                        <View
                            key={ov.overNumber}
                            style={[
                                styles.overCard,
                                { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}
                        >
                            <View style={styles.overLeftCol}>
                                <Text style={[styles.overNumberText, styles.tabularNum, { color: theme.textPrimary }]}>
                                    Ov {ov.overNumber}
                                </Text>
                                <Text style={[styles.overRunsText, styles.tabularNum, { color: theme.textSecondary }]}>
                                    {ov.runs} {ov.runs === 1 ? 'Run' : 'Runs'}
                                </Text>
                            </View>

                            <View style={styles.overRightCol}>
                                <Text style={[styles.overMatchupText, { color: theme.textPrimary }]}>
                                    {ov.bowlerNames.join(' / ')} to {ov.batterNames.join(' & ')}
                                </Text>

                                <View style={styles.ballRowWrap}>
                                    {ov.deliveries.map((chip) => {
                                        const c = getChipColors(chip);
                                        return (
                                            <View key={chip.id} style={styles.ballItemWrap}>
                                                <View
                                                    style={[
                                                        styles.ballCircle,
                                                        { backgroundColor: c.bg, borderColor: c.border },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.ballCircleText,
                                                            styles.tabularNum,
                                                            { color: c.text },
                                                            chip.circleLabel.length > 2 && styles.ballCircleTextSmall,
                                                        ]}
                                                    >
                                                        {chip.circleLabel}
                                                    </Text>
                                                </View>
                                                {chip.subLabel ? (
                                                    <Text
                                                        style={[
                                                            styles.ballSubLabel,
                                                            styles.tabularNum,
                                                            {
                                                                color:
                                                                    chip.kind === 'wicket'
                                                                        ? theme.danger
                                                                        : theme.textSecondary,
                                                            },
                                                        ]}
                                                    >
                                                        {chip.subLabel}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </View>
        );
    };

    return (
        <ScreenWrapper noPadding edges={['top']}>
            <AppHeader
                title={matchTitle}
                onBack={() => navigation.goBack()}
                rightAction={
                    <TouchableOpacity
                        onPress={handleDownloadPdf}
                        disabled={exportingPdf || !matchState}
                        style={[
                            styles.pdfButton,
                            { backgroundColor: theme.primary, opacity: exportingPdf || !matchState ? 0.65 : 1 },
                        ]}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Download scorecard PDF"
                    >
                        {exportingPdf ? (
                            <ActivityIndicator size="small" color={theme.onPrimary} />
                        ) : (
                            <MaterialCommunityIcons name="download" size={16} color={theme.onPrimary} />
                        )}
                        <Text style={[styles.pdfButtonText, { color: theme.onPrimary }]}>
                            {exportingPdf ? 'Exporting' : 'Download PDF'}
                        </Text>
                    </TouchableOpacity>
                }
            />

            {/* Two-Tab Bar */}
            <View
                style={[
                    styles.tabBar,
                    { backgroundColor: theme.surface, borderBottomColor: theme.border },
                ]}
            >
                {(
                    [
                        { key: 'scoreboard', label: 'Scoreboard' },
                        { key: 'overs', label: 'Overs' },
                    ] as const
                ).map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key)}
                            style={styles.tabItem}
                            activeOpacity={0.75}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: isActive ? theme.primary : theme.textSecondary },
                                ]}
                            >
                                {tab.label}
                            </Text>
                            <View
                                style={[
                                    styles.tabIndicator,
                                    { backgroundColor: isActive ? theme.primary : 'transparent' },
                                ]}
                            />
                        </TouchableOpacity>
                    );
                })}
            </View>

            <ScrollView
                style={[styles.scrollArea, { backgroundColor: theme.background }]}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: Math.max(insets.bottom, 16) + 12 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {!matchState ? (
                    <View
                        style={[
                            styles.emptyOversCard,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <Text style={[styles.emptyOversText, { color: theme.textSecondary }]}>
                            Loading match scorecard...
                        </Text>
                    </View>
                ) : activeTab === 'scoreboard' ? (
                    <>
                        <View
                            style={[
                                styles.statusBanner,
                                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                            ]}
                        >
                            <Text style={[styles.statusText, { color: theme.textPrimary }]}>
                                {getStatusBannerText(matchState)}
                            </Text>
                        </View>
                        {matchState.inning2 && renderInningsAccordion(matchState.inning2)}
                        {renderInningsAccordion(matchState.inning1)}
                    </>
                ) : (
                    renderOversTab(matchState)
                )}
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    tabularNum: {
        fontVariant: ['tabular-nums'],
    },
    pdfButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        minHeight: 40,
        paddingHorizontal: 11,
        paddingVertical: 8,
        borderRadius: 8,
        flexShrink: 0,
    },
    pdfButtonText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tabItem: {
        flex: 1,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    tabText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 16,
        right: 16,
        height: 3,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        padding: 12,
        gap: 12,
    },
    statusBanner: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    statusText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 17,
    },
    accordionCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        minHeight: 48,
        paddingVertical: 11,
        borderBottomWidth: 3,
        gap: 10,
    },
    accordionTeam: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 15,
        fontWeight: '800',
        flex: 1,
    },
    accordionRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    accordionScore: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 14,
        fontWeight: '800',
    },
    accordionBody: {},
    tableHead: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    subSectionHead: {
        marginTop: 6,
    },
    thText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4,
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
    colNameWide: {
        flex: 3.1,
        paddingRight: 6,
    },
    colStat: {
        flex: 0.9,
        textAlign: 'right',
    },
    colStatWide: {
        flex: 1.45,
        textAlign: 'right',
    },
    colFowName: {
        flex: 2.8,
        paddingRight: 6,
    },
    colFowStat: {
        flex: 1.1,
        textAlign: 'right',
    },
    playerName: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 13,
        fontWeight: '700',
    },
    dismissalText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    tdStrong: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 13,
        fontWeight: '800',
    },
    tdMuted: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '600',
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        gap: 8,
    },
    summaryLabel: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 13,
        fontWeight: '800',
    },
    summaryValue: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'right',
        flex: 1,
    },
    emptyRow: {
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    oversContainer: {
        gap: 10,
    },
    inningsToggleBar: {
        flexDirection: 'row',
        borderRadius: 10,
        borderWidth: 1,
        padding: 4,
        gap: 6,
    },
    inningsToggleBtn: {
        flex: 1,
        minHeight: 48,
        borderRadius: 7,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inningsToggleText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '800',
    },
    emptyOversCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 18,
        alignItems: 'center',
    },
    emptyOversText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 13,
        fontWeight: '600',
    },
    overCard: {
        flexDirection: 'row',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 12,
    },
    overLeftCol: {
        width: 64,
        justifyContent: 'flex-start',
        paddingTop: 2,
    },
    overNumberText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 14,
        fontWeight: '800',
    },
    overRunsText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    overRightCol: {
        flex: 1,
    },
    overMatchupText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 18,
    },
    ballRowWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    ballItemWrap: {
        alignItems: 'center',
    },
    ballCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ballCircleText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 13,
        fontWeight: '800',
    },
    ballCircleTextSmall: {
        fontSize: 10,
    },
    ballSubLabel: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 10,
        fontWeight: '800',
        marginTop: 3,
    },
});
