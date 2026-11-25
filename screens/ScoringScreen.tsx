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
import { ScreenWrapper } from '../components/ScreenWrapper';
import { AppHeader } from '../components/AppHeader';
import { APP_FONT_FAMILY } from '../constants/colors';
import { useTheme } from '../constants/theme';
import { Match, Player, Team } from '../database/types';

interface ScoreState {
    totalRuns: number;
    wickets: number;
    overs: number;
    balls: number;
    currentBatsmanId: number;
    nonStrikerId: number;
    currentBowlerId: number;
    recentBalls: string[];
    inning: number;
    target: number | null;
}

interface DeliveryRow {
    id: number;
    match_id: number;
    inning: number;
    over_number: number;
    ball_number: number;
    batsman_id: number;
    non_striker_id: number;
    bowler_id: number;
    runs: number;
    extras_type: 'WD' | 'NB' | 'LB' | 'B' | null;
    extras_runs: number;
    is_wicket: number;
    wicket_type: string | null;
    player_out_id: number | null;
}

const EXTRA_KEYS: Array<{ key: 'wide' | 'noBall' | 'byes' | 'legByes' | 'wicket'; label: string }> = [
    { key: 'wide', label: 'WD' },
    { key: 'noBall', label: 'NB' },
    { key: 'byes', label: 'B' },
    { key: 'legByes', label: 'LB' },
    { key: 'wicket', label: 'OUT' },
];

const formatBallLabel = (d: Pick<DeliveryRow, 'runs' | 'extras_type' | 'extras_runs' | 'is_wicket'>) => {
    const total = d.runs + (d.extras_runs || 0);
    if (d.is_wicket === 1) return 'W';
    if (d.extras_type === 'WD') return `${total}wd`;
    if (d.extras_type === 'NB') return `${total}nb`;
    return `${total}`;
};

export default function ScoringScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const { matchId } = route.params || {};

    const [matchData, setMatchData] = useState<Match | null>(null);
    const [battingTeam, setBattingTeam] = useState<Team | null>(null);
    const [bowlingTeam, setBowlingTeam] = useState<Team | null>(null);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);

    const [score, setScore] = useState<ScoreState>({
        totalRuns: 0,
        wickets: 0,
        overs: 0,
        balls: 0,
        currentBatsmanId: 0,
        nonStrikerId: 0,
        currentBowlerId: 0,
        recentBalls: [],
        inning: 1,
        target: null,
    });

    const [extras, setExtras] = useState({
        wide: false,
        noBall: false,
        byes: false,
        legByes: false,
        wicket: false,
    });
    const [extraStats, setExtraStats] = useState({
        wide: 0,
        noBall: 0,
        byes: 0,
        legByes: 0,
        total: 0,
    });

    const [partnership, setPartnership] = useState({ runs: 0, balls: 0 });

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
    const [pendingTarget, setPendingTarget] = useState<number>(0);
    const [showInningStartModal, setShowInningStartModal] = useState(false);
    const [newInningPlayers, setNewInningPlayers] = useState({ striker: '', nonStriker: '', bowler: '' });

    const [infoSheet, setInfoSheet] = useState<'partnership' | 'extras' | null>(null);
    const [snackbar, setSnackbar] = useState<string | null>(null);
    const snackbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [batsmanStats, setBatsmanStats] = useState({
        striker: { name: 'Striker', runs: 0, balls: 0, fours: 0, sixes: 0 },
        nonStriker: { name: 'Non-Striker', runs: 0, balls: 0, fours: 0, sixes: 0 },
    });
    const [bowlerStats, setBowlerStats] = useState({
        name: 'Bowler',
        overs: 0,
        maidens: 0,
        runs: 0,
        wickets: 0,
    });

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

    useEffect(() => {
        if (matchId) {
            loadMatchDetails();
        }
    }, [matchId]);

    const computePlayersStatsFromDb = (
        p1Id: number,
        p2Id: number,
        bowlId: number,
        inningNum: number,
        playersPool: Player[]
    ) => {
        const getBatStats = (pid: number) => {
            const res = db.getFirstSync(
                `SELECT count(*) as balls, sum(runs) as runs, 
                sum(case when runs=4 then 1 else 0 end) as fours,
                sum(case when runs=6 then 1 else 0 end) as sixes
                FROM Deliveries WHERE batsman_id = ? AND match_id = ? AND inning = ? AND (extras_type IS NULL OR extras_type='NB')`,
                pid,
                matchId,
                inningNum
            ) as any;
            const name = playersPool.find((p) => p.id === pid)?.name || 'Player';
            return {
                name,
                runs: res?.runs || 0,
                balls: res?.balls || 0,
                fours: res?.fours || 0,
                sixes: res?.sixes || 0,
            };
        };

        const getBowlStats = (pid: number) => {
            const res = db.getFirstSync(
                `SELECT sum(is_wicket) as wickets FROM Deliveries WHERE bowler_id = ? AND match_id = ? AND inning = ?`,
                pid,
                matchId,
                inningNum
            ) as any;

            const runsRes = db.getFirstSync(
                `SELECT sum(runs + extras_runs) as total 
                FROM Deliveries WHERE bowler_id = ? AND match_id = ? AND inning = ? 
                AND (extras_type IS NULL OR extras_type NOT IN ('B', 'LB'))`,
                pid,
                matchId,
                inningNum
            ) as any;

            const validBalls = db.getFirstSync(
                `SELECT count(*) as cnt FROM Deliveries 
                 WHERE bowler_id = ? AND match_id = ? AND inning = ? 
                 AND (extras_type IS NULL OR (extras_type != 'WD' AND extras_type != 'NB'))`,
                pid,
                matchId,
                inningNum
            ) as any;

            const name = playersPool.find((p) => p.id === pid)?.name || 'Bowler';
            const vBalls = validBalls?.cnt || 0;
            return {
                name,
                overs: Math.floor(vBalls / 6),
                maidens: 0,
                runs: runsRes?.total || 0,
                wickets: res?.wickets || 0,
            };
        };

        setBatsmanStats({
            striker: getBatStats(p1Id),
            nonStriker: getBatStats(p2Id),
        });
        setBowlerStats(getBowlStats(bowlId));
    };

    const loadMatchDetails = () => {
        try {
            const result = db.getFirstSync('SELECT * FROM Matches WHERE id = ?', matchId) as Match | null;
            if (!result) return;
            setMatchData(result);

            const homeTeam = db.getFirstSync('SELECT * FROM Teams WHERE id = ?', result.home_team_id) as Team;
            const awayTeam = db.getFirstSync('SELECT * FROM Teams WHERE id = ?', result.away_team_id) as Team;

            let firstBatTeam: Team, firstBowlTeam: Team;
            if (result.opt_to === 'Bat') {
                firstBatTeam = result.toss_winner_id === homeTeam.id ? homeTeam : awayTeam;
                firstBowlTeam = result.toss_winner_id === homeTeam.id ? awayTeam : homeTeam;
            } else {
                firstBatTeam = result.toss_winner_id === homeTeam.id ? awayTeam : homeTeam;
                firstBowlTeam = result.toss_winner_id === homeTeam.id ? homeTeam : awayTeam;
            }

            const fetchPlayers = (teamId: number) =>
                db.getAllSync('SELECT * FROM Players WHERE team_id = ?', teamId) as Player[];
            const firstBatPlayers = fetchPlayers(firstBatTeam.id);
            const firstBowlPlayers = fetchPlayers(firstBowlTeam.id);
            const combinedPlayers = [...firstBatPlayers, ...firstBowlPlayers];
            setAllPlayers(combinedPlayers);

            const deliveries = db.getAllSync(
                'SELECT * FROM Deliveries WHERE match_id = ? ORDER BY id ASC',
                matchId
            ) as DeliveryRow[];

            const inn1Deliveries = deliveries.filter((d) => d.inning === 1);
            const inn2Deliveries = deliveries.filter((d) => d.inning === 2);

            const inn1ValidBalls = inn1Deliveries.filter(
                (d) => d.extras_type !== 'WD' && d.extras_type !== 'NB'
            ).length;
            const inn1OversCompleted = Math.floor(inn1ValidBalls / 6);
            const inn1Runs = inn1Deliveries.reduce((acc, d) => acc + d.runs + (d.extras_runs || 0), 0);

            const activeInning =
                inn2Deliveries.length > 0 || inn1OversCompleted >= (result.overs || 16) ? 2 : 1;
            const activeDeliveries = activeInning === 2 ? inn2Deliveries : inn1Deliveries;
            const targetScore = activeInning === 2 ? inn1Runs + 1 : null;

            const activeBatTeam = activeInning === 2 ? firstBowlTeam : firstBatTeam;
            const activeBowlTeam = activeInning === 2 ? firstBatTeam : firstBowlTeam;
            setBattingTeam(activeBatTeam);
            setBowlingTeam(activeBowlTeam);

            if (activeDeliveries.length === 0) {
                const batRoster = fetchPlayers(activeBatTeam.id);
                const bowlRoster = fetchPlayers(activeBowlTeam.id);

                if (activeInning === 2 && targetScore !== null) {
                    setScore({
                        totalRuns: 0,
                        wickets: 0,
                        overs: 0,
                        balls: 0,
                        currentBatsmanId: 0,
                        nonStrikerId: 0,
                        currentBowlerId: 0,
                        recentBalls: [],
                        inning: 2,
                        target: targetScore,
                    });
                    setPendingTarget(targetScore);
                    setShowInningStartModal(true);
                    return;
                }

                if (batRoster.length >= 2 && bowlRoster.length >= 1) {
                    const striker = batRoster[0];
                    const nonStriker = batRoster[1];
                    const bowler = bowlRoster[0];
                    setScore({
                        totalRuns: 0,
                        wickets: 0,
                        overs: 0,
                        balls: 0,
                        currentBatsmanId: striker.id,
                        nonStrikerId: nonStriker.id,
                        currentBowlerId: bowler.id,
                        recentBalls: [],
                        inning: 1,
                        target: null,
                    });
                    setBatsmanStats({
                        striker: { name: striker.name, runs: 0, balls: 0, fours: 0, sixes: 0 },
                        nonStriker: { name: nonStriker.name, runs: 0, balls: 0, fours: 0, sixes: 0 },
                    });
                    setBowlerStats({ name: bowler.name, overs: 0, maidens: 0, runs: 0, wickets: 0 });
                    setWicketDetails((prev) => ({ ...prev, whoOut: striker.id }));
                }
                return;
            }

            // Reconstruct active inning totals, extras, recent over, and crease players from SQLite
            let totalRuns = 0;
            let wickets = 0;
            let validCount = 0;
            const aggExtras = { wide: 0, noBall: 0, byes: 0, legByes: 0, total: 0 };

            activeDeliveries.forEach((d) => {
                totalRuns += d.runs + (d.extras_runs || 0);
                if (d.is_wicket === 1) wickets += 1;
                if (d.extras_type !== 'WD' && d.extras_type !== 'NB') validCount += 1;
                if (d.extras_type) {
                    const er = d.extras_runs || 0;
                    if (d.extras_type === 'WD') aggExtras.wide += er;
                    else if (d.extras_type === 'NB') aggExtras.noBall += er;
                    else if (d.extras_type === 'B') aggExtras.byes += er;
                    else if (d.extras_type === 'LB') aggExtras.legByes += er;
                    aggExtras.total += er;
                }
            });

            const overs = Math.floor(validCount / 6);
            const balls = validCount % 6;
            const currentOverDeliveries = activeDeliveries.filter((d) => d.over_number === overs);
            const recentBalls = currentOverDeliveries.map(formatBallLabel);

            const lastD = activeDeliveries[activeDeliveries.length - 1];
            let strikerId = lastD.batsman_id;
            let nonStrikerId = lastD.non_striker_id;
            const bowlerId = lastD.bowler_id;

            // Replay strike swaps from the last delivery
            if (lastD.is_wicket === 1) {
                const knownIds = new Set<number>();
                activeDeliveries.forEach((d) => {
                    knownIds.add(d.batsman_id);
                    knownIds.add(d.non_striker_id);
                });
                const batRoster = fetchPlayers(activeBatTeam.id);
                const latestPlayer = batRoster.find((p) => !knownIds.has(p.id) && p.id > lastD.batsman_id);
                if (latestPlayer) {
                    if (lastD.player_out_id === strikerId) strikerId = latestPlayer.id;
                    else nonStrikerId = latestPlayer.id;
                }
            } else if (lastD.runs % 2 !== 0) {
                const tmp = strikerId;
                strikerId = nonStrikerId;
                nonStrikerId = tmp;
            }
            if (balls === 0 && lastD.extras_type !== 'WD' && lastD.extras_type !== 'NB') {
                const tmp = strikerId;
                strikerId = nonStrikerId;
                nonStrikerId = tmp;
            }

            setScore({
                totalRuns,
                wickets,
                overs,
                balls,
                currentBatsmanId: strikerId,
                nonStrikerId,
                currentBowlerId: bowlerId,
                recentBalls,
                inning: activeInning,
                target: targetScore,
            });
            setExtraStats(aggExtras);
            setWicketDetails((prev) => ({ ...prev, whoOut: strikerId }));
            computePlayersStatsFromDb(strikerId, nonStrikerId, bowlerId, activeInning, combinedPlayers);
            recalcPartnershipForInning(activeInning);
        } catch (e) {
            console.log('Error loading match', e);
        }
    };

    const recalcPartnershipForInning = (inningNum: number) => {
        const lastWicket = db.getFirstSync(
            'SELECT id FROM Deliveries WHERE match_id=? AND inning=? AND is_wicket=1 ORDER BY id DESC LIMIT 1',
            matchId,
            inningNum
        ) as any;

        const lastWicketId = lastWicket ? lastWicket.id : 0;

        const res = db.getFirstSync(
            `SELECT sum(runs + extras_runs) as runs, 
            count(case when (extras_type IS NULL OR (extras_type != 'WD' AND extras_type != 'NB')) then 1 else null end) as balls
            FROM Deliveries 
            WHERE match_id=? AND inning=? AND id > ?`,
            matchId,
            inningNum,
            lastWicketId
        ) as any;

        setPartnership({ runs: res?.runs || 0, balls: res?.balls || 0 });
    };

    const handleMatchEnd = (winner: string, margin: string) => {
        try {
            if (matchId) {
                db.runSync('UPDATE Matches SET is_completed = 1 WHERE id = ?', matchId);
            }
        } catch (e) {
            console.log('Error marking match completed', e);
        }
        navigation.navigate('MatchResult', { winner, margin });
    };

    const handleScoreClick = (runs: number) => {
        if (score.inning === 2 && score.target) {
            if (score.totalRuns + runs >= score.target) {
                processDelivery(runs, undefined, true);
                return;
            }
        }

        if (extras.wicket) {
            setShowWicketModal(true);
            return;
        }
        processDelivery(runs);
    };

    const processDelivery = (runs: number, wicketInfo?: any, isWinningRun: boolean = false) => {
        let runsScored = runs;
        let isExtra = false;
        let extraType: string | null = null;
        let extraRuns = 0;
        const isWicket = !!wicketInfo;
        let validBall = true;

        if (extras.wide) {
            isExtra = true;
            extraType = 'WD';
            extraRuns = 1 + runs;
            validBall = false;
            runsScored = 0;
        } else if (extras.noBall) {
            isExtra = true;
            extraType = 'NB';
            extraRuns = 1;
            runsScored = runs;
            validBall = false;
        } else if (extras.byes) {
            isExtra = true;
            extraType = 'B';
            extraRuns = runs;
            runsScored = 0;
        } else if (extras.legByes) {
            isExtra = true;
            extraType = 'LB';
            extraRuns = runs;
            runsScored = 0;
        }

        const totalDeliveryRuns = runsScored + extraRuns;

        try {
            db.runSync(
                `INSERT INTO Deliveries (
          match_id, inning, over_number, ball_number, batsman_id, non_striker_id, bowler_id, 
          runs, extras_type, extras_runs, is_wicket, wicket_type, player_out_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                matchId,
                score.inning,
                score.overs,
                score.balls + 1,
                score.currentBatsmanId,
                score.nonStrikerId,
                score.currentBowlerId,
                runsScored,
                extraType,
                extraRuns,
                isWicket ? 1 : 0,
                wicketInfo ? wicketInfo.type : null,
                wicketInfo ? wicketInfo.whoOut : null
            );
        } catch (e) {
            console.error(e);
        }

        let newBalls = score.balls;
        let newOvers = score.overs;
        let currentOverComplete = false;
        let newRecent = [...score.recentBalls];

        if (validBall) {
            newBalls += 1;
            if (newBalls === 6) {
                newBalls = 0;
                newOvers += 1;
                currentOverComplete = true;
                newRecent = [];
            }
        }

        if (!currentOverComplete) {
            let ballLabel = `${totalDeliveryRuns}`;
            if (isWicket) ballLabel = 'W';
            else if (extras.wide) ballLabel = `${totalDeliveryRuns}wd`;
            else if (extras.noBall) ballLabel = `${totalDeliveryRuns}nb`;
            newRecent.push(ballLabel);
        }

        let inningsJustEnded = false;

        if (isWinningRun || (score.inning === 2 && score.target && score.totalRuns + totalDeliveryRuns >= score.target)) {
            const wicketsLeft = 10 - (isWicket ? score.wickets + 1 : score.wickets);
            handleMatchEnd(battingTeam?.name || 'Batting Team', `by ${wicketsLeft} wickets`);
            inningsJustEnded = true;
        } else if (matchData && newOvers >= (matchData.overs || 16)) {
            if (score.inning === 1) {
                inningsJustEnded = true;
                const target = score.totalRuns + totalDeliveryRuns + 1;
                setPendingTarget(target);
                setShowInningBreakModal(true);
            } else {
                const finalScore = score.totalRuns + totalDeliveryRuns;
                const target = score.target || 0;
                if (finalScore < target - 1) {
                    const runMargin = target - 1 - finalScore;
                    handleMatchEnd(bowlingTeam?.name || 'Bowling Team', `by ${runMargin} runs`);
                } else if (finalScore === target - 1) {
                    handleMatchEnd('Match Tied', '');
                }
            }
        }

        const newTotal = score.totalRuns + totalDeliveryRuns;
        setScore((prev) => ({
            ...prev,
            totalRuns: newTotal,
            wickets: isWicket ? prev.wickets + 1 : prev.wickets,
            balls: newBalls,
            overs: newOvers,
            recentBalls: newRecent,
        }));

        updateStats(runsScored, validBall, isExtra, extras.noBall, isWicket, extraRuns, extraType);

        if (isWicket) {
            setPartnership({ runs: 0, balls: 0 });
        } else {
            setPartnership((prev) => ({
                runs: prev.runs + totalDeliveryRuns,
                balls: validBall ? prev.balls + 1 : prev.balls,
            }));
        }

        setExtras({ wide: false, noBall: false, byes: false, legByes: false, wicket: false });

        if (isWicket) {
            handleWicketStateUpdate(wicketInfo);
        } else if (runsScored % 2 !== 0) {
            swapBatsman();
        }

        if (currentOverComplete && !inningsJustEnded && !isWinningRun) {
            swapBatsman();
            setShowBowlerModal(true);
        }
    };

    const updateStats = (
        runs: number,
        validBall: boolean,
        isExtra: boolean,
        isNoBall: boolean,
        isWicket: boolean,
        extraRuns: number,
        extraType: string | null
    ) => {
        if (!isExtra || isNoBall) {
            setBatsmanStats((prev) => ({
                ...prev,
                striker: {
                    ...prev.striker,
                    runs: prev.striker.runs + runs,
                    balls: validBall ? prev.striker.balls + 1 : prev.striker.balls,
                    fours: runs === 4 ? prev.striker.fours + 1 : prev.striker.fours,
                    sixes: runs === 6 ? prev.striker.sixes + 1 : prev.striker.sixes,
                },
            }));
        }
        setBowlerStats((prev) => ({
            ...prev,
            runs: prev.runs + (isExtra ? (isNoBall || extras.wide ? 1 + runs : runs) : runs),
            wickets: isWicket && wicketDetails.type !== 'Run Out' ? prev.wickets + 1 : prev.wickets,
            overs: validBall && score.balls + 1 === 6 ? prev.overs + 1 : prev.overs,
        }));

        if (isExtra && extraType) {
            const mappedKey =
                extraType === 'WD'
                    ? 'wide'
                    : extraType === 'NB'
                    ? 'noBall'
                    : extraType === 'B'
                    ? 'byes'
                    : 'legByes';
            setExtraStats((prev) => ({
                ...prev,
                [mappedKey]: prev[mappedKey] + extraRuns,
                total: prev.total + extraRuns,
            }));
        }
    };

    const startSecondInnings = (targetScore: number) => {
        setShowInningBreakModal(false);
        const newBat = bowlingTeam;
        const newBowl = battingTeam;
        setBattingTeam(newBat);
        setBowlingTeam(newBowl);

        setScore({
            totalRuns: 0,
            wickets: 0,
            overs: 0,
            balls: 0,
            currentBatsmanId: 0,
            nonStrikerId: 0,
            currentBowlerId: 0,
            recentBalls: [],
            inning: 2,
            target: targetScore,
        });

        setPartnership({ runs: 0, balls: 0 });
        setExtraStats({ wide: 0, noBall: 0, byes: 0, legByes: 0, total: 0 });
        setBatsmanStats({
            striker: { name: 'Striker', runs: 0, balls: 0, fours: 0, sixes: 0 },
            nonStriker: { name: 'Non-Striker', runs: 0, balls: 0, fours: 0, sixes: 0 },
        });
        setBowlerStats({ name: 'Bowler', overs: 0, maidens: 0, runs: 0, wickets: 0 });
        setNewInningPlayers({ striker: '', nonStriker: '', bowler: '' });
        setShowInningStartModal(true);
    };

    const confirmSecondInningsPlayers = () => {
        const { striker, nonStriker, bowler } = newInningPlayers;
        if (!striker.trim() || !nonStriker.trim() || !bowler.trim()) {
            showNotice('Enter striker, non-striker, and bowler names.');
            return;
        }

        const batTeamId = battingTeam?.id || 0;
        const bowlTeamId = bowlingTeam?.id || 0;

        const p1 = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', striker.trim(), batTeamId);
        const p2 = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', nonStriker.trim(), batTeamId);
        const p3 = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', bowler.trim(), bowlTeamId);

        setAllPlayers((prev) => [
            ...prev,
            { id: p1.lastInsertRowId, name: striker.trim(), team_id: batTeamId },
            { id: p2.lastInsertRowId, name: nonStriker.trim(), team_id: batTeamId },
            { id: p3.lastInsertRowId, name: bowler.trim(), team_id: bowlTeamId },
        ]);

        setScore((prev) => ({
            ...prev,
            currentBatsmanId: p1.lastInsertRowId,
            nonStrikerId: p2.lastInsertRowId,
            currentBowlerId: p3.lastInsertRowId,
        }));

        setBatsmanStats({
            striker: { name: striker.trim(), runs: 0, balls: 0, fours: 0, sixes: 0 },
            nonStriker: { name: nonStriker.trim(), runs: 0, balls: 0, fours: 0, sixes: 0 },
        });
        setBowlerStats({ name: bowler.trim(), overs: 0, maidens: 0, runs: 0, wickets: 0 });
        setWicketDetails((prev) => ({ ...prev, whoOut: p1.lastInsertRowId }));

        setShowInningStartModal(false);
    };

    const handleWicketStateUpdate = (info: any) => {
        const newPlayerName = info.newBatsmanName?.trim() || 'New Player';
        const teamId = battingTeam?.id || 0;
        let newPlayerId = 0;
        try {
            const res = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', newPlayerName, teamId);
            newPlayerId = res.lastInsertRowId;
            setAllPlayers((prev) => [...prev, { id: newPlayerId, name: newPlayerName, team_id: teamId }]);
        } catch (e) {}

        if (info.whoOut === score.currentBatsmanId) {
            setScore((prev) => ({ ...prev, currentBatsmanId: newPlayerId }));
            setBatsmanStats((prev) => ({
                ...prev,
                striker: { name: newPlayerName, runs: 0, balls: 0, fours: 0, sixes: 0 },
            }));
        } else {
            setScore((prev) => ({ ...prev, nonStrikerId: newPlayerId }));
            setBatsmanStats((prev) => ({
                ...prev,
                nonStriker: { name: newPlayerName, runs: 0, balls: 0, fours: 0, sixes: 0 },
            }));
        }
    };

    const swapBatsman = () => {
        setBatsmanStats((prev) => ({ striker: prev.nonStriker, nonStriker: prev.striker }));
        setScore((prev) => ({
            ...prev,
            currentBatsmanId: prev.nonStrikerId,
            nonStrikerId: prev.currentBatsmanId,
        }));
    };

    const confirmWicket = () => {
        if (!wicketDetails.newBatsmanName.trim()) {
            showNotice('Please enter new batsman name.');
            return;
        }
        if ((wicketDetails.type === 'Caught' || wicketDetails.type === 'Run Out') && !wicketDetails.fielderName.trim()) {
            showNotice('Please enter fielder name.');
            return;
        }
        setShowWicketModal(false);
        processDelivery(0, wicketDetails);
    };

    const confirmNewBowler = (player?: Player) => {
        let selectedPlayer = player;
        if (!selectedPlayer && newBowlerName.trim()) {
            const teamId = bowlingTeam?.id || 0;
            try {
                const res = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', newBowlerName.trim(), teamId);
                selectedPlayer = { id: res.lastInsertRowId, name: newBowlerName.trim(), team_id: teamId };
                setAllPlayers((prev) => [...prev, selectedPlayer!]);
            } catch (e) {}
        }
        if (!selectedPlayer) {
            showNotice('Select or enter a bowler name.');
            return;
        }
        if (selectedPlayer.id === score.currentBowlerId) {
            showNotice('Select a different bowler for the new over.');
            return;
        }
        setScore((prev) => ({ ...prev, currentBowlerId: selectedPlayer!.id }));
        setBowlerStats({ name: selectedPlayer.name, overs: 0, maidens: 0, runs: 0, wickets: 0 });
        setNewBowlerName('');
        setShowBowlerModal(false);
    };

    const handleUndo = () => {
        try {
            const lastDelivery = db.getFirstSync(
                'SELECT * FROM Deliveries WHERE match_id = ? AND inning = ? ORDER BY id DESC LIMIT 1',
                matchId,
                score.inning
            ) as DeliveryRow | null;

            if (!lastDelivery) {
                showNotice('Nothing to undo in this innings.');
                return;
            }

            db.runSync('DELETE FROM Deliveries WHERE id = ?', lastDelivery.id);

            const runs = lastDelivery.runs;
            const extrasRuns = lastDelivery.extras_runs || 0;
            const totalThisBall = runs + extrasRuns;
            const isWicket = lastDelivery.is_wicket === 1;
            const isValid = lastDelivery.extras_type !== 'WD' && lastDelivery.extras_type !== 'NB';

            let newBalls = score.balls;
            let newOvers = score.overs;

            if (isValid) {
                newBalls -= 1;
                if (newBalls < 0) {
                    newBalls = 5;
                    newOvers = Math.max(0, newOvers - 1);
                }
            }

            const restoredOverDeliveries = db.getAllSync(
                'SELECT runs, extras_type, extras_runs, is_wicket FROM Deliveries WHERE match_id = ? AND inning = ? AND over_number = ? ORDER BY id ASC',
                matchId,
                score.inning,
                newOvers
            ) as DeliveryRow[];
            const newRecent = restoredOverDeliveries.map(formatBallLabel);

            setScore((prev) => ({
                ...prev,
                totalRuns: Math.max(0, prev.totalRuns - totalThisBall),
                wickets: Math.max(0, prev.wickets - (isWicket ? 1 : 0)),
                overs: newOvers,
                balls: newBalls,
                currentBatsmanId: lastDelivery.batsman_id,
                nonStrikerId: lastDelivery.non_striker_id,
                currentBowlerId: lastDelivery.bowler_id,
                recentBalls: newRecent,
            }));

            computePlayersStatsFromDb(
                lastDelivery.batsman_id,
                lastDelivery.non_striker_id,
                lastDelivery.bowler_id,
                score.inning,
                allPlayers
            );

            if (lastDelivery.extras_type) {
                const eType = lastDelivery.extras_type;
                const mappedKey =
                    eType === 'WD' ? 'wide' : eType === 'NB' ? 'noBall' : eType === 'B' ? 'byes' : 'legByes';
                setExtraStats((prev) => ({
                    ...prev,
                    [mappedKey]: Math.max(0, prev[mappedKey] - extrasRuns),
                    total: Math.max(0, prev.total - extrasRuns),
                }));
            }

            recalcPartnershipForInning(score.inning);
            showNotice('Undid last delivery.');
        } catch (e) {
            console.error(e);
            showNotice('Could not undo last delivery.');
        }
    };

    const handleRetire = () => {
        setWicketDetails({ type: 'Retired', whoOut: score.currentBatsmanId, newBatsmanName: '', fielderName: '' });
        setShowWicketModal(true);
    };

    const bowlersList = allPlayers.filter((p) => p.team_id === bowlingTeam?.id);
    const toggleExtra = (key: keyof typeof extras) => setExtras((prev) => ({ ...prev, [key]: !prev[key] }));

    const totalBallsBowled = score.overs * 6 + score.balls;
    const matchTotalBalls = (matchData?.overs || 16) * 6;
    const ballsRemaining = Math.max(0, matchTotalBalls - totalBallsBowled);
    const crr = (score.totalRuns / (Math.max(1, totalBallsBowled) / 6)).toFixed(2);
    const rrr = score.target
        ? (Math.max(0, score.target - score.totalRuns) / (Math.max(1, ballsRemaining) / 6)).toFixed(2)
        : null;
    const runsNeeded = score.target ? Math.max(0, score.target - score.totalRuns) : null;

    const getBallPillStyle = (ball: string) => {
        if (ball === 'W') {
            return { bg: theme.danger, border: theme.danger, text: theme.onDanger };
        }
        if (ball === '4' || ball === '6') {
            return { bg: theme.primary, border: theme.primary, text: theme.onPrimary };
        }
        if (ball.includes('wd') || ball.includes('nb')) {
            return { bg: theme.warning, border: theme.warning, text: theme.onWarning };
        }
        return { bg: theme.surface, border: theme.border, text: theme.textPrimary };
    };

    return (
        <ScreenWrapper noPadding edges={['top']}>
            <AppHeader
                compact
                title="Live Scoring"
                badge={score.inning === 2 ? '2ND INNINGS' : '1ST INNINGS'}
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
                        {battingTeam?.name || 'Batting'}
                    </Text>
                    <Text style={[styles.vsText, { color: theme.scoreboxMuted }]} numberOfLines={1}>
                        vs {bowlingTeam?.name || 'Bowling'} · {matchData?.overs || 16} OV
                    </Text>
                </View>

                <View style={styles.mainScoreRow}>
                    <View>
                        <Text style={[styles.mainScore, styles.tabularNum, { color: theme.scoreboxText }]}>
                            {score.totalRuns}
                            <Text style={{ color: theme.scoreAccent }}>/{score.wickets}</Text>
                        </Text>
                        {score.target !== null && (
                            <View style={[styles.targetPill, { backgroundColor: theme.warning }]}>
                                <Text style={[styles.targetPillText, styles.tabularNum, { color: theme.onWarning }]}>
                                    TARGET {score.target} · NEED {runsNeeded} OFF {ballsRemaining}B
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.ratesBox}>
                        <Text style={[styles.oversText, styles.tabularNum, { color: theme.scoreboxText }]}>
                            {score.overs}.{score.balls}
                        </Text>
                        <Text style={[styles.rateText, styles.tabularNum, { color: theme.scoreboxMuted }]}>
                            CRR {crr}
                            {rrr ? ` · RRR ${rrr}` : ''}
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
                    OVER {score.overs + 1}
                </Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.ballList}
                >
                    {score.recentBalls.length === 0 ? (
                        <Text style={[styles.overEmptyText, { color: theme.textSecondary }]}>
                            Ready for ball 1
                        </Text>
                    ) : (
                        score.recentBalls.map((b, i) => {
                            const pill = getBallPillStyle(b);
                            return (
                                <View
                                    key={`${b}-${i}`}
                                    style={[
                                        styles.ballPill,
                                        { backgroundColor: pill.bg, borderColor: pill.border },
                                    ]}
                                >
                                    <Text style={[styles.ballText, styles.tabularNum, { color: pill.text }]}>
                                        {b}
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
                            {batsmanStats.striker.name} <Text style={{ color: theme.primary }}>●</Text>
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textPrimary }]}>
                            {batsmanStats.striker.runs}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {batsmanStats.striker.balls}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {batsmanStats.striker.fours}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {batsmanStats.striker.sixes}
                        </Text>
                    </View>
                    <View style={[styles.tableRow, styles.tableRowLast]}>
                        <Text style={[styles.cellName, { color: theme.textPrimary }]} numberOfLines={1}>
                            {batsmanStats.nonStriker.name}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textPrimary }]}>
                            {batsmanStats.nonStriker.runs}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {batsmanStats.nonStriker.balls}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {batsmanStats.nonStriker.fours}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {batsmanStats.nonStriker.sixes}
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
                            {bowlerStats.name}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textPrimary }]}>
                            {bowlerStats.overs}.{score.balls}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textSecondary }]}>
                            {bowlerStats.maidens}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textPrimary }]}>
                            {bowlerStats.runs}
                        </Text>
                        <Text style={[styles.cell, styles.tabularNum, { color: theme.textPrimary }]}>
                            {bowlerStats.wickets}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {snackbar && (
                <View style={[styles.snackbar, { backgroundColor: theme.headerBg, borderColor: theme.primary }]}>
                    <Text style={[styles.snackbarText, { color: theme.headerText }]}>{snackbar}</Text>
                </View>
            )}

            {/* Non-Overlapping Docked Control Keypad (48dp+ touch targets, 8dp gaps) */}
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
                        onPress={swapBatsman}
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
                                onPress={() => handleScoreClick(0)}
                                activeOpacity={0.8}
                                accessibilityLabel="Dot ball"
                            >
                                <Text style={[styles.runButtonText, { color: theme.textPrimary }]}>•</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>

            {/* Partnership / Extras Sheet Modal */}
            <Modal
                visible={infoSheet !== null}
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
                            {infoSheet === 'partnership' ? 'Current Partnership' : 'Extras Breakdown'}
                        </Text>

                        {infoSheet === 'partnership' ? (
                            <View style={styles.statGrid}>
                                <View
                                    style={[
                                        styles.statCell,
                                        { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                                    ]}
                                >
                                    <Text style={[styles.label, { color: theme.textSecondary }]}>RUNS</Text>
                                    <Text style={[styles.statBig, styles.tabularNum, { color: theme.textPrimary }]}>
                                        {partnership.runs}
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.statCell,
                                        { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                                    ]}
                                >
                                    <Text style={[styles.label, { color: theme.textSecondary }]}>BALLS</Text>
                                    <Text style={[styles.statBig, styles.tabularNum, { color: theme.textPrimary }]}>
                                        {partnership.balls}
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.statGrid}>
                                {[
                                    { k: 'WD', v: extraStats.wide },
                                    { k: 'NB', v: extraStats.noBall },
                                    { k: 'B', v: extraStats.byes },
                                    { k: 'LB', v: extraStats.legByes },
                                    { k: 'TOTAL', v: extraStats.total },
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
                        )}

                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.primary }]}
                            onPress={() => setInfoSheet(null)}
                        >
                            <Text style={[styles.saveButtonText, { color: theme.onPrimary }]}>Close</Text>
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
                                TARGET: {pendingTarget} RUNS
                            </Text>
                        </View>
                        <Text style={[styles.breakBody, styles.tabularNum, { color: theme.textSecondary }]}>
                            Requires {pendingTarget} runs in {(matchData?.overs || 16) * 6} balls (RRR{' '}
                            {(pendingTarget / (matchData?.overs || 16)).toFixed(2)}).
                        </Text>
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.primary }]}
                            onPress={() => startSecondInnings(pendingTarget)}
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
                                    borderColor: theme.border,
                                    color: theme.textPrimary,
                                },
                            ]}
                            placeholder="Enter new bowler name"
                            placeholderTextColor={theme.textPlaceholder}
                            value={newBowlerName}
                            onChangeText={setNewBowlerName}
                        />
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.primary }]}
                            onPress={() => confirmNewBowler(undefined)}
                        >
                            <Text style={[styles.saveButtonText, { color: theme.onPrimary }]}>
                                Add & Select Bowler
                            </Text>
                        </TouchableOpacity>

                        {bowlersList.length > 0 && (
                            <>
                                <Text style={[styles.label, { color: theme.textSecondary, marginTop: 16 }]}>
                                    EXISTING BOWLERS
                                </Text>
                                <ScrollView style={{ maxHeight: 160 }}>
                                    {bowlersList.map((p) => (
                                        <TouchableOpacity
                                            key={p.id}
                                            style={[styles.modalItem, { borderBottomColor: theme.borderSubtle }]}
                                            onPress={() => confirmNewBowler(p)}
                                        >
                                            <Text style={[styles.modalItemText, { color: theme.textPrimary }]}>
                                                {p.name}{' '}
                                                {p.id === score.currentBowlerId ? '(Previous Over)' : ''}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
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
                    <View
                        style={[
                            styles.modalContent,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Wicket Details</Text>

                        <Text style={[styles.label, { color: theme.textSecondary }]}>HOW OUT</Text>
                        <View style={styles.chipWrap}>
                            {['Caught', 'Bowled', 'LBW', 'Run Out', 'Retired'].map((t) => {
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
                                        onPress={() => setWicketDetails((prev) => ({ ...prev, type: t }))}
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

                        <Text style={[styles.label, { color: theme.textSecondary }]}>WHO OUT</Text>
                        <View style={styles.chipWrap}>
                            <TouchableOpacity
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor:
                                            wicketDetails.whoOut === score.currentBatsmanId
                                                ? theme.primary
                                                : theme.surfaceSubtle,
                                        borderColor:
                                            wicketDetails.whoOut === score.currentBatsmanId
                                                ? theme.primary
                                                : theme.border,
                                    },
                                ]}
                                onPress={() =>
                                    setWicketDetails((prev) => ({ ...prev, whoOut: score.currentBatsmanId }))
                                }
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        {
                                            color:
                                                wicketDetails.whoOut === score.currentBatsmanId
                                                    ? theme.onPrimary
                                                    : theme.textPrimary,
                                        },
                                    ]}
                                >
                                    {batsmanStats.striker.name}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor:
                                            wicketDetails.whoOut === score.nonStrikerId
                                                ? theme.primary
                                                : theme.surfaceSubtle,
                                        borderColor:
                                            wicketDetails.whoOut === score.nonStrikerId
                                                ? theme.primary
                                                : theme.border,
                                    },
                                ]}
                                onPress={() =>
                                    setWicketDetails((prev) => ({ ...prev, whoOut: score.nonStrikerId }))
                                }
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        {
                                            color:
                                                wicketDetails.whoOut === score.nonStrikerId
                                                    ? theme.onPrimary
                                                    : theme.textPrimary,
                                        },
                                    ]}
                                >
                                    {batsmanStats.nonStriker.name}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {(wicketDetails.type === 'Caught' || wicketDetails.type === 'Run Out') && (
                            <>
                                <Text style={[styles.label, { color: theme.textSecondary }]}>
                                    FIELDER / THROWER
                                </Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: theme.surfaceSubtle,
                                            borderColor: theme.border,
                                            color: theme.textPrimary,
                                        },
                                    ]}
                                    placeholder="Enter fielder name"
                                    placeholderTextColor={theme.textPlaceholder}
                                    value={wicketDetails.fielderName}
                                    onChangeText={(t) => setWicketDetails((prev) => ({ ...prev, fielderName: t }))}
                                />
                            </>
                        )}

                        <Text style={[styles.label, { color: theme.textSecondary }]}>NEW BATSMAN</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: theme.surfaceSubtle,
                                    borderColor: theme.border,
                                    color: theme.textPrimary,
                                },
                            ]}
                            placeholder="Enter incoming batsman"
                            placeholderTextColor={theme.textPlaceholder}
                            value={wicketDetails.newBatsmanName}
                            onChangeText={(t) => setWicketDetails((prev) => ({ ...prev, newBatsmanName: t }))}
                        />

                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.danger }]}
                            onPress={confirmWicket}
                        >
                            <Text style={[styles.saveButtonText, { color: theme.onDanger }]}>Confirm Wicket</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setShowWicketModal(false)}>
                            <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
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
                    <View
                        style={[
                            styles.modalContent,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                    >
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Start 2nd Innings</Text>
                        <View style={[styles.targetModalBadge, { backgroundColor: theme.warning }]}>
                            <Text style={[styles.targetModalText, styles.tabularNum, { color: theme.onWarning }]}>
                                TARGET: {score.target}
                            </Text>
                        </View>

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
                            onChangeText={(t) => setNewInningPlayers((prev) => ({ ...prev, striker: t }))}
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
                            onChangeText={(t) => setNewInningPlayers((prev) => ({ ...prev, nonStriker: t }))}
                        />

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
                            onChangeText={(t) => setNewInningPlayers((prev) => ({ ...prev, bowler: t }))}
                        />

                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.primary }]}
                            onPress={confirmSecondInningsPlayers}
                        >
                            <Text style={[styles.saveButtonText, { color: theme.onPrimary }]}>Start 2nd Innings</Text>
                        </TouchableOpacity>
                    </View>
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
        marginBottom: 14,
        borderWidth: 1,
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
