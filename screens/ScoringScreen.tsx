import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Dimensions } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { db } from '../database/db';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
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
    inning: number; // New: Track Inning
    target: number | null; // New: Target for 2nd inning
}

export default function ScoringScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { matchId } = route.params || {};

    const [matchData, setMatchData] = useState<Match | null>(null);
    const [battingTeam, setBattingTeam] = useState<Team | null>(null);
    const [bowlingTeam, setBowlingTeam] = useState<Team | null>(null);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);

    // Scoring State
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

    // Extras Selection
    const [extras, setExtras] = useState({
        wide: false,
        noBall: false,
        byes: false,
        legByes: false,
        wicket: false,
    });
    // Track aggregated Extras
    const [extraStats, setExtraStats] = useState({
        wide: 0, noBall: 0, byes: 0, legByes: 0, total: 0
    });

    // Track Partnership
    const [partnership, setPartnership] = useState({ runs: 0, balls: 0 });

    // Modals State
    const [showBowlerModal, setShowBowlerModal] = useState(false);
    const [newBowlerName, setNewBowlerName] = useState('');
    const [showWicketModal, setShowWicketModal] = useState(false);
    const [wicketDetails, setWicketDetails] = useState({
        type: 'Caught',
        whoOut: 0,
        newBatsmanName: '',
        fielderName: '',
    });

    // New Player Selection for 2nd Innings
    const [showInningStartModal, setShowInningStartModal] = useState(false);
    const [newInningPlayers, setNewInningPlayers] = useState({ striker: '', nonStriker: '', bowler: '' });

    // Stats Display
    const [batsmanStats, setBatsmanStats] = useState({
        striker: { name: 'Striker', runs: 0, balls: 0, fours: 0, sixes: 0 },
        nonStriker: { name: 'Non-Striker', runs: 0, balls: 0, fours: 0, sixes: 0 },
    });
    const [bowlerStats, setBowlerStats] = useState({
        name: 'Bowler', overs: 0, maidens: 0, runs: 0, wickets: 0
    });

    useEffect(() => {
        if (matchId) {
            loadMatchDetails();
        }
    }, [matchId]);

    const loadMatchDetails = () => {
        try {
            const result = db.getFirstSync('SELECT * FROM Matches WHERE id = ?', matchId);
            if (result) {
                setMatchData(result as Match);

                const homeTeam = db.getFirstSync('SELECT * FROM Teams WHERE id = ?', (result as Match).home_team_id) as Team;
                const awayTeam = db.getFirstSync('SELECT * FROM Teams WHERE id = ?', (result as Match).away_team_id) as Team;

                let batTeam: Team, bowlTeam: Team;
                // Logic for 1st Inning setup - needs adjusting for reload/resume if inning 2
                // Just defaulting to 1st inning for now as per flow
                if ((result as Match).opt_to === 'Bat') {
                    batTeam = (result as Match).toss_winner_id === homeTeam.id ? homeTeam : awayTeam;
                    bowlTeam = (result as Match).toss_winner_id === homeTeam.id ? awayTeam : homeTeam;
                } else {
                    batTeam = (result as Match).toss_winner_id === homeTeam.id ? awayTeam : homeTeam;
                    bowlTeam = (result as Match).toss_winner_id === homeTeam.id ? homeTeam : awayTeam;
                }
                setBattingTeam(batTeam);
                setBowlingTeam(bowlTeam);

                const fetchPlayers = (teamId: number) => {
                    return db.getAllSync('SELECT * FROM Players WHERE team_id = ?', teamId) as Player[];
                };
                const battingPlayers = fetchPlayers(batTeam.id);
                const bowlingPlayers = fetchPlayers(bowlTeam.id);
                setAllPlayers([...battingPlayers, ...bowlingPlayers]);

                if (battingPlayers.length >= 2 && bowlingPlayers.length >= 1) {
                    const striker = battingPlayers[0];
                    const nonStriker = battingPlayers[1];
                    const bowler = bowlingPlayers[0];
                    setScore(prev => ({ ...prev, currentBatsmanId: striker.id, nonStrikerId: nonStriker.id, currentBowlerId: bowler.id }));
                    setBatsmanStats({
                        striker: { name: striker.name, runs: 0, balls: 0, fours: 0, sixes: 0 },
                        nonStriker: { name: nonStriker.name, runs: 0, balls: 0, fours: 0, sixes: 0 },
                    });
                    setBowlerStats({ name: bowler.name, overs: 0, maidens: 0, runs: 0, wickets: 0 });
                    setWicketDetails(prev => ({ ...prev, whoOut: striker.id }));
                }
            }
        } catch (e) {
            console.log('Error loading match', e);
        }
    };

    // --- LOGIC HELPERS ---
    const handleMatchEnd = (winner: string, margin: string) => {
        navigation.navigate('MatchResult', { winner, margin });
    };

    const handleScoreClick = (runs: number) => {
        // 2nd Inning Chase Win Check
        if (score.inning === 2 && score.target) {
            if (score.totalRuns + runs >= score.target) { // Winning run HIT
                const wicketsLeft = 10 - score.wickets;
                // Note: Runs are added to state visually slightly later but logic holds.
                // We should allow the processDelivery to save it, THEN trigger end? 
                // Or Trigger End immediately?
                // Better flow: processDelivery -> Update State -> useEffect check? 
                // Or simpler: pass flag to processDelivery.
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
        let extraType = null;
        let extraRuns = 0;
        let isWicket = !!wicketInfo;
        let validBall = true;

        if (extras.wide) {
            isExtra = true; extraType = 'WD'; extraRuns = 1 + runs; validBall = false; runsScored = 0;
        } else if (extras.noBall) {
            isExtra = true; extraType = 'NB'; extraRuns = 1; runsScored = runs; validBall = false;
        } else if (extras.byes) {
            isExtra = true; extraType = 'B'; extraRuns = runs; runsScored = 0;
        } else if (extras.legByes) {
            isExtra = true; extraType = 'LB'; extraRuns = runs; runsScored = 0;
        }

        const totalDeliveryRuns = runsScored + extraRuns;

        // DB Insert with Dynamic Inning
        try {
            db.runSync(
                `INSERT INTO Deliveries (
          match_id, inning, over_number, ball_number, batsman_id, non_striker_id, bowler_id, 
          runs, extras_type, extras_runs, is_wicket, wicket_type, player_out_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                matchId, score.inning, score.overs, score.balls + 1, score.currentBatsmanId, score.nonStrikerId, score.currentBowlerId,
                runsScored, extraType, extraRuns, isWicket ? 1 : 0,
                wicketInfo ? wicketInfo.type : null,
                wicketInfo ? wicketInfo.whoOut : null
            );
        } catch (e) { console.error(e); }

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

        // CHECK FOR END OF INNINGS / MATCH
        let inningsJustEnded = false;

        // 1. Chasing Win (Checked via flag or calc)
        if (isWinningRun || (score.inning === 2 && score.target && (score.totalRuns + totalDeliveryRuns >= score.target))) {
            // Batting Team Wins
            const wicketsLeft = 10 - (isWicket ? score.wickets + 1 : score.wickets);
            handleMatchEnd(battingTeam?.name || 'Batting Team', `by ${wicketsLeft} wickets`);
            // We still update local state to show final score behind modal? 
            // Returning here prevents further alerts but we want DB updated above.
            // Let execution continue to update stats, but skip other alerts.
            inningsJustEnded = true;
        }
        // 2. Overs Limit Reached
        else if (matchData && newOvers >= (matchData.overs || 16)) {
            if (score.inning === 1) {
                inningsJustEnded = true;
                const target = score.totalRuns + totalDeliveryRuns + 1;
                const ballsReq = (matchData.overs || 16) * 6;
                const rrr = (target / (matchData.overs || 16)).toFixed(2);

                Alert.alert(
                    'Innings Completed',
                    `Target: ${target}\nRequires ${target} runs in ${ballsReq} balls.\nRRR: ${rrr}`,
                    [{ text: 'Start 2nd Innings', onPress: () => startSecondInnings(target) }]
                );
            } else {
                // 2nd Inning Over - Defending Team Wins (unless tie)
                // Check score vs target
                const finalScore = score.totalRuns + totalDeliveryRuns;
                const target = score.target || 0;
                if (finalScore < target - 1) {
                    const runMargin = (target - 1) - finalScore;
                    handleMatchEnd(bowlingTeam?.name || 'Bowling Team', `by ${runMargin} runs`);
                } else if (finalScore === target - 1) {
                    handleMatchEnd('Match Tied', '');
                }
                // updates will happen below
            }
        }
        // 3. All Out Check (10 wickets)
        // ... Simplified for now as per previous logic

        // Update Scores
        const newTotal = score.totalRuns + totalDeliveryRuns;
        setScore(prev => ({
            ...prev,
            totalRuns: newTotal,
            wickets: isWicket ? prev.wickets + 1 : prev.wickets,
            balls: newBalls,
            overs: newOvers,
            recentBalls: newRecent,
        }));

        // Update Stats
        updateStats(runsScored, validBall, isExtra, extras.noBall, isWicket, extraRuns, extraType);

        // Partnership Update
        if (isWicket) {
            setPartnership({ runs: 0, balls: 0 }); // Reset on wicket
        } else {
            setPartnership(prev => ({
                runs: prev.runs + totalDeliveryRuns,
                balls: validBall ? prev.balls + 1 : prev.balls
            }));
        }

        setExtras({ wide: false, noBall: false, byes: false, legByes: false, wicket: false });

        if (isWicket) {
            handleWicketStateUpdate(wicketInfo);
        } else if (runsScored % 2 !== 0) {
            swapBatsman();
        }

        // End of Over Swap & Bowler
        if (currentOverComplete && !inningsJustEnded && !isWinningRun) {
            swapBatsman();
            setShowBowlerModal(true);
        }
    };

    const updateStats = (runs: number, validBall: boolean, isExtra: boolean, isNoBall: boolean, isWicket: boolean, extraRuns: number, extraType: string | null) => {
        if (!isExtra || isNoBall) {
            setBatsmanStats(prev => ({
                ...prev,
                striker: {
                    ...prev.striker,
                    runs: prev.striker.runs + runs,
                    balls: validBall ? prev.striker.balls + 1 : prev.striker.balls,
                    fours: runs === 4 ? prev.striker.fours + 1 : prev.striker.fours,
                    sixes: runs === 6 ? prev.striker.sixes + 1 : prev.striker.sixes,
                }
            }));
        }
        setBowlerStats(prev => ({
            ...prev,
            runs: prev.runs + (isExtra ? (isNoBall || extras.wide ? 1 + runs : runs) : runs),
            wickets: isWicket && wicketDetails.type !== 'Run Out' ? prev.wickets + 1 : prev.wickets,
            overs: validBall && (score.balls + 1) === 6 ? prev.overs + 1 : prev.overs
        }));

        // Update aggregated Extras
        if (isExtra && extraType) {
            setExtraStats(prev => ({
                ...prev,
                [extraType == 'WD' ? 'wide' : extraType == 'NB' ? 'noBall' : extraType == 'B' ? 'byes' : 'legByes']:
                    prev[extraType == 'WD' ? 'wide' : extraType == 'NB' ? 'noBall' : extraType == 'B' ? 'byes' : 'legByes' as keyof typeof prev] + extraRuns,
                total: prev.total + extraRuns
            }));
        }
    };

    const startSecondInnings = (targetScore: number) => {
        // 1. Swap Teams
        const newBat = bowlingTeam;
        const newBowl = battingTeam;
        setBattingTeam(newBat);
        setBowlingTeam(newBowl);

        // 2. Reset Score
        setScore({
            totalRuns: 0,
            wickets: 0,
            overs: 0,
            balls: 0,
            currentBatsmanId: 0, // Will be set by modal
            nonStrikerId: 0,
            currentBowlerId: 0,
            recentBalls: [],
            inning: 2,
            target: targetScore,
            // isInningsOver: false // This line was added in the instruction, but ScoreState doesn't have isInningsOver. Removing to avoid type error.
        });

        // 3. Reset Stats
        setPartnership({ runs: 0, balls: 0 });
        setExtraStats({ wide: 0, noBall: 0, byes: 0, legByes: 0, total: 0 });
        setBatsmanStats({
            striker: { name: 'Striker', runs: 0, balls: 0, fours: 0, sixes: 0 },
            nonStriker: { name: 'Non-Striker', runs: 0, balls: 0, fours: 0, sixes: 0 },
        });
        setBowlerStats({ name: 'Bowler', overs: 0, maidens: 0, runs: 0, wickets: 0 });
        setNewInningPlayers({ striker: '', nonStriker: '', bowler: '' }); // Clear inputs

        // 4. Trigger Modal
        setShowInningStartModal(true);
    };

    const confirmSecondInningsPlayers = () => {
        // Logic to Create Batsmen/Bowler for 2nd Innings specifically
        const { striker, nonStriker, bowler } = newInningPlayers;
        if (!striker || !nonStriker || !bowler) { Alert.alert('Error', 'Enter all names'); return; }

        // Insert Players
        const batTeamId = battingTeam?.id || 0;
        const bowlTeamId = bowlingTeam?.id || 0;

        const p1 = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', striker, batTeamId);
        const p2 = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', nonStriker, batTeamId);
        const p3 = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', bowler, bowlTeamId);

        setScore(prev => ({
            ...prev,
            currentBatsmanId: p1.lastInsertRowId,
            nonStrikerId: p2.lastInsertRowId,
            currentBowlerId: p3.lastInsertRowId
        }));

        setBatsmanStats({
            striker: { name: striker, runs: 0, balls: 0, fours: 0, sixes: 0 },
            nonStriker: { name: nonStriker, runs: 0, balls: 0, fours: 0, sixes: 0 }
        });
        setBowlerStats({ name: bowler, overs: 0, maidens: 0, runs: 0, wickets: 0 });
        setWicketDetails(prev => ({ ...prev, whoOut: p1.lastInsertRowId }));

        setShowInningStartModal(false);
    };

    // ... (Re-use existing Handlers: swapBatsman, handleWicketStateUpdate etc.)
    const handleWicketStateUpdate = (info: any) => {
        const newPlayerName = info.newBatsmanName || `New Player`;
        const teamId = battingTeam?.id || 0;
        let newPlayerId = 0;
        try {
            const res = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', newPlayerName, teamId);
            newPlayerId = res.lastInsertRowId;
        } catch (e) { }

        if (info.whoOut === score.currentBatsmanId) {
            setScore(prev => ({ ...prev, currentBatsmanId: newPlayerId }));
            setBatsmanStats(prev => ({ ...prev, striker: { name: newPlayerName, runs: 0, balls: 0, fours: 0, sixes: 0 } }));
        } else {
            setScore(prev => ({ ...prev, nonStrikerId: newPlayerId }));
            setBatsmanStats(prev => ({ ...prev, nonStriker: { name: newPlayerName, runs: 0, balls: 0, fours: 0, sixes: 0 } }));
        }
    };
    const swapBatsman = () => {
        setBatsmanStats(prev => ({ striker: prev.nonStriker, nonStriker: prev.striker }));
        setScore(prev => ({ ...prev, currentBatsmanId: prev.nonStrikerId, nonStrikerId: prev.currentBatsmanId }));
    };
    const confirmWicket = () => {
        if (!wicketDetails.newBatsmanName) { Alert.alert('Required', 'Please enter new batsman name'); return; }
        if ((wicketDetails.type === 'Caught' || wicketDetails.type === 'Run Out') && !wicketDetails.fielderName) { Alert.alert('Required', 'Please enter fielder name'); return; }
        setShowWicketModal(false); processDelivery(0, wicketDetails);
    };
    // (Re-use confirmNewBowler with minor edits if needed, keeping mostly same)
    const confirmNewBowler = (player?: Player) => {
        let selectedPlayer = player;
        if (!selectedPlayer && newBowlerName) {
            const teamId = bowlingTeam?.id || 0;
            try {
                const res = db.runSync('INSERT INTO Players (name, team_id) VALUES (?, ?)', newBowlerName, teamId);
                selectedPlayer = { id: res.lastInsertRowId, name: newBowlerName, team_id: teamId }; // Fixed Lint Error removed 'role'
            } catch (e) { }
        }
        if (!selectedPlayer) { Alert.alert('Required', 'Please select or enter a bowler'); return; }
        if (selectedPlayer.id === score.currentBowlerId) { Alert.alert('Rule', 'Select a different bowler'); return; }
        setScore(prev => ({ ...prev, currentBowlerId: selectedPlayer!.id }));
        setBowlerStats({ name: selectedPlayer!.name, overs: 0, maidens: 0, runs: 0, wickets: 0 });
        setNewBowlerName(''); setShowBowlerModal(false);
    };
    // Handlers
    const handleUndo = () => {
        try {
            // 1. Get Last Delivery
            const lastDelivery = db.getFirstSync(
                'SELECT * FROM Deliveries WHERE match_id = ? AND inning = ? ORDER BY id DESC LIMIT 1',
                matchId, score.inning
            ) as any;

            if (!lastDelivery) {
                Alert.alert('Undo', 'Nothing to undo!');
                return;
            }

            // 2. Delete it
            db.runSync('DELETE FROM Deliveries WHERE id = ?', lastDelivery.id);

            // 3. Revert Score State
            const runs = lastDelivery.runs;
            const extrasRuns = lastDelivery.extras_runs || 0;
            const totalThisBall = runs + extrasRuns;
            const isWicket = lastDelivery.is_wicket === 1;
            const isVald = lastDelivery.extras_type !== 'WD' && lastDelivery.extras_type !== 'NB';

            let newBalls = score.balls;
            let newOvers = score.overs;

            if (isVald) {
                newBalls -= 1;
                if (newBalls < 0) {
                    newBalls = 5;
                    newOvers -= 1;
                }
            }

            // Pop recent ball
            const newRecent = [...score.recentBalls];
            if (newRecent.length > 0) newRecent.pop();

            // Restore Players (Crucial for swaps/wickets)
            // lastDelivery stored the state *during* the ball. 
            // So setting current IDs to what's in lastDelivery restores the state *before* the next ball would have started.
            // i.e., It puts the striker back on strike.

            // EDGE CASE: If we undo the FIRST ball of a new over, we are back to the END of previous over.
            // The lastDelivery we just deleted WAS the last ball of that previous over.
            // So its bowler_id IS the bowler of that previous over. Restoring it is correct.

            setScore(prev => ({
                ...prev,
                totalRuns: prev.totalRuns - totalThisBall,
                wickets: prev.wickets - (isWicket ? 1 : 0),
                overs: newOvers < 0 ? 0 : newOvers,
                balls: newBalls,
                currentBatsmanId: lastDelivery.batsman_id,
                nonStrikerId: lastDelivery.non_striker_id,
                currentBowlerId: lastDelivery.bowler_id,
                recentBalls: newRecent
            }));

            // 4. Revert Stats (Decrementing)
            // Batsman
            // We need to fetch the names again to be safe? Or just use current if ID matches?
            // Safer: Re-fetch stats for the specific players in the undo delivery
            // But for responsiveness, let's modify the *current* view IF the IDs match.
            // Actually, since we Just set currentBatsmanId to lastDelivery.batsman_id, 
            // we should update `batsmanStats` to reflect that player's stats *minus* this ball.

            // It's cleaner to just re-calculate stats for the active players from DB to avoid drift.
            reloadStatsForPlayers(lastDelivery.batsman_id, lastDelivery.non_striker_id, lastDelivery.bowler_id);

            // 5. Revert Extras
            if (lastDelivery.extras_type) {
                const eType = lastDelivery.extras_type;
                setExtraStats(prev => ({
                    ...prev,
                    [eType == 'WD' ? 'wide' : eType == 'NB' ? 'noBall' : eType == 'B' ? 'byes' : 'legByes' as keyof typeof prev]:
                        prev[eType == 'WD' ? 'wide' : eType == 'NB' ? 'noBall' : eType == 'B' ? 'byes' : 'legByes' as keyof typeof prev] - extrasRuns,
                    total: prev.total - extrasRuns
                }));
            }

            // 6. Revert Partnership (Re-calc from DB is easiest)
            recalcPartnership();

        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Undo failed');
        }
    };

    const reloadStatsForPlayers = (p1Id: number, p2Id: number, bowlId: number) => {
        // Simple aggregate queries
        const getBatStats = (pid: number) => {
            const res = db.getFirstSync(`
                SELECT count(*) as balls, sum(runs) as runs, 
                sum(case when runs=4 then 1 else 0 end) as fours,
                sum(case when runs=6 then 1 else 0 end) as sixes
                FROM Deliveries WHERE batsman_id = ? AND match_id = ? AND inning = ? AND (extras_type IS NULL OR extras_type='NB')
             `, pid, matchId, score.inning) as any;
            const name = allPlayers.find(p => p.id === pid)?.name || 'Player';
            return {
                name,
                runs: res?.runs || 0,
                balls: res?.balls || 0,
                fours: res?.fours || 0,
                sixes: res?.sixes || 0
            };
        };

        const getBowlStats = (pid: number) => {
            const res = db.getFirstSync(`
                SELECT count(*) as balls, sum(runs) as runs, sum(is_wicket) as wickets
                FROM Deliveries WHERE bowler_id = ? AND match_id = ? AND inning = ?
             `, pid, matchId, score.inning) as any; // Note: runs needs logic for extras attribution but simplified here

            // Correct Runs for Bowler: (All runs + All extras) - (Byes + LegByes + Penalty?)
            // Simplified: Sum(runs + extras) - Sum(Byes + LB)
            const runsRes = db.getFirstSync(`
                SELECT sum(runs + extras_runs) as total 
                FROM Deliveries WHERE bowler_id = ? AND match_id = ? AND inning = ? 
                AND (extras_type IS NULL OR extras_type NOT IN ('B', 'LB'))
             `, pid, matchId, score.inning) as any;

            const validBalls = db.getFirstSync(`
                 SELECT count(*) as cnt FROM Deliveries 
                 WHERE bowler_id = ? AND match_id = ? AND inning = ? 
                 AND (extras_type IS NULL OR (extras_type != 'WD' AND extras_type != 'NB'))
             `, pid, matchId, score.inning) as any;

            const name = allPlayers.find(p => p.id === pid)?.name || 'Bowler';
            const vBalls = validBalls?.cnt || 0;
            return {
                name,
                overs: Math.floor(vBalls / 6), // simplifying .balls part
                maidens: 0, // TODO
                runs: runsRes?.total || 0,
                wickets: res?.wickets || 0
            };
        };

        setBatsmanStats({
            striker: getBatStats(p1Id),
            nonStriker: getBatStats(p2Id)
        });
        setBowlerStats(getBowlStats(bowlId) as any);
    };

    const recalcPartnership = () => {
        // Find last wicket
        const lastWicket = db.getFirstSync(
            'SELECT id FROM Deliveries WHERE match_id=? AND inning=? AND is_wicket=1 ORDER BY id DESC LIMIT 1',
            matchId, score.inning
        ) as any;

        const lastWicketId = lastWicket ? lastWicket.id : 0;

        const res = db.getFirstSync(`
            SELECT sum(runs + extras_runs) as runs, 
            count(case when (extras_type IS NULL OR (extras_type != 'WD' AND extras_type != 'NB')) then 1 else null end) as balls
            FROM Deliveries 
            WHERE match_id=? AND inning=? AND id > ?
         `, matchId, score.inning, lastWicketId) as any;

        setPartnership({ runs: res?.runs || 0, balls: res?.balls || 0 });
    };
    const handleRetire = () => { setWicketDetails({ type: 'Retired', whoOut: score.currentBatsmanId, newBatsmanName: '', fielderName: '' }); setShowWicketModal(true); };
    const showPartnership = () => {
        // Detailed Stats
        Alert.alert('Current Partnership', `${partnership.runs} Runs in ${partnership.balls} balls`);
    };
    const showExtrasMenu = () => {
        // Detailed Extras
        Alert.alert('Extras', `Wide: ${extraStats.wide}\nNo Ball: ${extraStats.noBall}\nByes: ${extraStats.byes}\nLeg Byes: ${extraStats.legByes}\nTotal: ${extraStats.total}`);
    };
    const bowlersList = allPlayers.filter(p => p.team_id === bowlingTeam?.id);
    const toggleExtra = (key: keyof typeof extras) => setExtras(prev => ({ ...prev, [key]: !prev[key] }));

    return (
        <ScreenWrapper noPadding>
            <View style={styles.scoreCard}>
                <View style={styles.scoreHeader}>
                    <Text style={styles.teamName}>{battingTeam?.name} {score.inning === 2 ? '(2nd)' : ''}</Text>
                    <View><Text style={styles.vsText}>vs {bowlingTeam?.name}</Text></View>
                </View>
                <View style={styles.scoreRow}>
                    <View>
                        <Text style={styles.mainScore}>{score.totalRuns} - {score.wickets}</Text>
                        {score.target && <Text style={styles.targetText}>Target: {score.target}</Text>}
                    </View>
                    <View style={styles.overBox}>
                        <Text style={styles.oversText}>({score.overs}.{score.balls})</Text>
                        <Text style={styles.crrText}>CRR: {(score.totalRuns / (Math.max(1, score.overs * 6 + score.balls) / 6)).toFixed(2)}</Text>
                        {score.target && <Text style={styles.crrText}>RRR: {((score.target - score.totalRuns) / Math.max(1, ((matchData?.overs || 16) * 6 - (score.overs * 6 + score.balls)) / 6)).toFixed(2)}</Text>}
                    </View>
                </View>
            </View>

            <ScrollView style={styles.scrollArea}>
                {/* Batsman Stats */}
                <View style={styles.tableCard}>
                    <View style={[styles.tableRow, styles.tableHeader]}>
                        <Text style={[styles.cellName, styles.headerText]}>Batsman</Text>
                        <Text style={styles.cell}>R</Text>
                        <Text style={styles.cell}>B</Text>
                        <Text style={styles.cell}>4s</Text>
                        <Text style={styles.cell}>6s</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.cellName}>{batsmanStats.striker.name} *</Text>
                        <Text style={styles.cell}>{batsmanStats.striker.runs}</Text>
                        <Text style={styles.cell}>{batsmanStats.striker.balls}</Text>
                        <Text style={styles.cell}>{batsmanStats.striker.fours}</Text>
                        <Text style={styles.cell}>{batsmanStats.striker.sixes}</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.cellName}>{batsmanStats.nonStriker.name}</Text>
                        <Text style={styles.cell}>{batsmanStats.nonStriker.runs}</Text>
                        <Text style={styles.cell}>{batsmanStats.nonStriker.balls}</Text>
                        <Text style={styles.cell}>{batsmanStats.nonStriker.fours}</Text>
                        <Text style={styles.cell}>{batsmanStats.nonStriker.sixes}</Text>
                    </View>
                </View>

                {/* Bowler Stats */}
                <View style={styles.tableCard}>
                    <View style={[styles.tableRow, styles.tableHeader]}>
                        <Text style={[styles.cellName, styles.headerText]}>Bowler</Text>
                        <Text style={styles.cell}>O</Text>
                        <Text style={styles.cell}>M</Text>
                        <Text style={styles.cell}>R</Text>
                        <Text style={styles.cell}>W</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.cellName}>{bowlerStats.name}</Text>
                        <Text style={styles.cell}>{bowlerStats.overs}</Text>
                        <Text style={styles.cell}>{bowlerStats.maidens}</Text>
                        <Text style={styles.cell}>{bowlerStats.runs}</Text>
                        <Text style={styles.cell}>{bowlerStats.wickets}</Text>
                    </View>
                </View>

                {/* This Over */}
                <View style={styles.thisOverContainer}>
                    <Text style={styles.thisOverLabel}>This Over:</Text>
                    <View style={styles.ballList}>
                        {score.recentBalls.map((b, i) => (
                            <View key={i} style={styles.ballCircle}><Text style={styles.ballText}>{b}</Text></View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Control Pad */}
            <View style={styles.controlPad}>
                <View style={styles.extrasRow}>
                    {['wide', 'noBall', 'byes', 'legByes', 'wicket'].map((key) => (
                        <TouchableOpacity
                            key={key}
                            style={[styles.extraChip, extras[key as keyof typeof extras] && styles.extraChipActive]}
                            onPress={() => toggleExtra(key as keyof typeof extras)}
                        >
                            <Text style={[styles.extraChipText, extras[key as keyof typeof extras] && styles.extraChipTextActive]}>{key.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleRetire}><Text style={styles.actionText}>Retire</Text></TouchableOpacity>
                    <View style={{ width: 10 }} />
                    <TouchableOpacity style={styles.actionButton} onPress={swapBatsman}><Text style={styles.actionText}>Swap Batsman</Text></TouchableOpacity>
                </View>

                <View style={styles.keypadContainer}>
                    <View style={styles.keypadLeft}>
                        <TouchableOpacity style={styles.rectButton} onPress={handleUndo}><Text style={styles.rectButtonText}>Undo</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.rectButton} onPress={showPartnership}><Text style={styles.rectButtonText}>Partn.</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.rectButton} onPress={showExtrasMenu}><Text style={styles.rectButtonText}>Extras</Text></TouchableOpacity>
                    </View>
                    <View style={styles.keypadGrid}>
                        {[0, 1, 2, 3, 4, 5, 6].map(n => (
                            <TouchableOpacity key={n} style={styles.circleButton} onPress={() => handleScoreClick(n)}>
                                <Text style={styles.circleButtonText}>{n}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.circleButton} onPress={() => handleScoreClick(0)}><Text style={styles.circleButtonText}>.</Text></TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Bowler Modal */}
            <Modal visible={showBowlerModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>End of Over - Select New Bowler</Text>

                        <Text style={styles.label}>Enter New Bowler Name:</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="New Bowler Name"
                            value={newBowlerName}
                            onChangeText={setNewBowlerName}
                        />
                        <TouchableOpacity style={styles.saveButton} onPress={() => confirmNewBowler(undefined)}>
                            <Text style={styles.saveButtonText}>Add & Select This Bowler</Text>
                        </TouchableOpacity>

                        <Text style={[styles.label, { marginTop: 10 }]}>OR Select Existing:</Text>
                        <ScrollView style={{ maxHeight: 150 }}>
                            {bowlersList.map(p => (
                                <TouchableOpacity key={p.id} style={styles.modalItem} onPress={() => confirmNewBowler(p)}>
                                    <Text style={styles.modalItemText}>{p.name} {p.id === score.currentBowlerId ? '(Previous)' : ''}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Wicket Modal */}
            <Modal visible={showWicketModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Wicket Details</Text>

                        <Text style={styles.label}>How Out?</Text>
                        <View style={styles.row}>
                            {['Caught', 'Bowled', 'LBW', 'Run Out', 'Retired'].map(t => (
                                <TouchableOpacity
                                    key={t}
                                    style={[styles.chip, wicketDetails.type === t && styles.chipActive]}
                                    onPress={() => setWicketDetails(prev => ({ ...prev, type: t }))}
                                >
                                    <Text style={[styles.chipText, wicketDetails.type === t && styles.chipTextActive]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Who Out?</Text>
                        <View style={styles.row}>
                            <TouchableOpacity
                                style={[styles.chip, wicketDetails.whoOut === score.currentBatsmanId && styles.chipActive]}
                                onPress={() => setWicketDetails(prev => ({ ...prev, whoOut: score.currentBatsmanId }))}
                            >
                                <Text style={[styles.chipText, wicketDetails.whoOut === score.currentBatsmanId && styles.chipTextActive]}>{batsmanStats.striker.name}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.chip, wicketDetails.whoOut === score.nonStrikerId && styles.chipActive]}
                                onPress={() => setWicketDetails(prev => ({ ...prev, whoOut: score.nonStrikerId }))}
                            >
                                <Text style={[styles.chipText, wicketDetails.whoOut === score.nonStrikerId && styles.chipTextActive]}>{batsmanStats.nonStriker.name}</Text>
                            </TouchableOpacity>
                        </View>

                        {(wicketDetails.type === 'Caught' || wicketDetails.type === 'Run Out') && (
                            <>
                                <Text style={styles.label}>Fielder / Thrower Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter Fielder Name"
                                    value={wicketDetails.fielderName}
                                    onChangeText={t => setWicketDetails(prev => ({ ...prev, fielderName: t }))}
                                />
                            </>
                        )}

                        <Text style={styles.label}>New Batsman Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter Name"
                            value={wicketDetails.newBatsmanName}
                            onChangeText={t => setWicketDetails(prev => ({ ...prev, newBatsmanName: t }))}
                        />

                        <TouchableOpacity style={styles.saveButton} onPress={confirmWicket}>
                            <Text style={styles.saveButtonText}>Confirm Wicket</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setShowWicketModal(false)}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 2nd Inning Start Modal */}
            <Modal visible={showInningStartModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Start 2nd Innings</Text>
                        <Text style={styles.label}>Target: {score.target}</Text>

                        <Text style={styles.label}>Striker Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Striker Name"
                            value={newInningPlayers.striker}
                            onChangeText={t => setNewInningPlayers(prev => ({ ...prev, striker: t }))}
                        />
                        <Text style={styles.label}>Non-Striker Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Non-Striker Name"
                            value={newInningPlayers.nonStriker}
                            onChangeText={t => setNewInningPlayers(prev => ({ ...prev, nonStriker: t }))}
                        />
                        <Text style={styles.label}>Bowler Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Bowler Name"
                            value={newInningPlayers.bowler}
                            onChangeText={t => setNewInningPlayers(prev => ({ ...prev, bowler: t }))}
                        />

                        <TouchableOpacity style={styles.saveButton} onPress={confirmSecondInningsPlayers}>
                            <Text style={styles.saveButtonText}>Start Innings</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    scoreCard: {
        margin: 16,
        padding: 20,
        marginBottom: 8,
        borderRadius: 30
    },
    scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' },
    teamName: { fontSize: 24, fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
    vsBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    vsText: { fontSize: 12, color: '#ccc', fontWeight: 'bold' },
    scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    mainScore: { fontSize: 48, fontWeight: '900', color: '#00E676', lineHeight: 56 },
    targetText: { fontSize: 14, fontWeight: 'bold', color: '#FFD700', marginTop: 4 },
    overBox: { alignItems: 'flex-end' },
    oversText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    crrText: { fontSize: 12, color: '#ccc', marginTop: 2 },

    scrollArea: { flex: 1, paddingHorizontal: 16 },
    tableCard: { marginBottom: 12, borderRadius: 20, padding: 0 }, // Reset padding for custom table rows
    tableHeader: { backgroundColor: 'rgba(255,255,255,0.05)' },
    tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    cellName: { flex: 3, fontSize: 14, color: '#fff', fontWeight: '600' },
    cell: { flex: 1, fontSize: 14, color: '#fff', textAlign: 'center', fontWeight: 'bold' },
    headerText: { color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 1 },

    thisOverContainer: { marginVertical: 10 },
    thisOverLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 'bold', marginBottom: 8, marginLeft: 4 },
    ballList: { flexDirection: 'row' },
    ballCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    ballText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },

    controlPad: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: 20,
        paddingBottom: 40
    },
    extrasRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    extraChip: {
        width: 50, height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center'
    },
    extraChipActive: { backgroundColor: '#00E676', borderColor: '#00E676' },
    extraChipText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
    extraChipTextActive: { color: '#003300' },

    actionRow: { flexDirection: 'row', marginBottom: 16 },
    smallActionBtn: { flex: 1, paddingVertical: 10 },

    keypadContainer: { flexDirection: 'row', height: 160 },
    keypadLeft: { width: '25%', justifyContent: 'space-between', paddingRight: 10 },
    sideBtn: { marginBottom: 6, flex: 1, paddingVertical: 0, justifyContent: 'center' },

    keypadGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'space-between' },
    circleButton: {
        width: '30%', aspectRatio: 1,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 10
    },
    circleButtonText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#333' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
    label: { color: '#999', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
    input: { backgroundColor: '#2C2C2C', borderRadius: 12, color: '#fff', padding: 14, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#333' },
    saveButton: { backgroundColor: '#00E676', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
    saveButtonText: { color: '#003300', fontWeight: 'bold', fontSize: 16 },
    modalItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
    modalItemText: { color: '#fff', fontSize: 16 },

    row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#333', marginRight: 8, marginBottom: 8 },
    chipActive: { backgroundColor: '#FF4500' },
    chipText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    chipTextActive: { color: '#fff' },
    cancelButton: { marginTop: 16, alignItems: 'center' },
    cancelButtonText: { color: '#666', fontSize: 14 },

    // Missing Styles Added
    actionButton: {
        flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
        paddingVertical: 12, alignItems: 'center', justifyContent: 'center'
    },
    actionText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    rectButton: {
        flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
        marginBottom: 8, alignItems: 'center', justifyContent: 'center'
    },
    rectButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 }
});
