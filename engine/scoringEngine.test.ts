import {
    computeMatchResult,
    deriveMatchState,
    dismissalCreditsBowler,
    dismissalRequiresFielder,
} from './scoringEngine';
import { Delivery, Match, Player, Team } from '../database/types';

const assert = {
    equal: (a: unknown, b: unknown, msg?: string) => {
        if (a !== b) throw new Error(`${msg || 'Assertion failed'}: expected ${String(b)}, got ${String(a)}`);
    },
    notEqual: (a: unknown, b: unknown, msg?: string) => {
        if (a === b) throw new Error(`${msg || 'Expected values to differ'}: got ${String(a)}`);
    },
    ok: (cond: unknown, msg?: string) => {
        if (!cond) throw new Error(msg || 'Expected truthy value');
    },
    deepEqual: (a: unknown, b: unknown, msg?: string) => {
        if (JSON.stringify(a) !== JSON.stringify(b)) {
            throw new Error(`${msg || 'DeepEqual failed'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
        }
    },
};

const homeTeam: Team = { id: 1, name: 'Tigers', logo_color: '#162B40' };
const awayTeam: Team = { id: 2, name: 'Lions', logo_color: '#162B40' };

const players: Player[] = [
    { id: 101, name: 'Rohit', team_id: 1 },
    { id: 102, name: 'Gill', team_id: 1 },
    { id: 103, name: 'Virat', team_id: 1 },
    { id: 201, name: 'Starc', team_id: 2 },
    { id: 202, name: 'Cummins', team_id: 2 },
    { id: 203, name: 'Zampa', team_id: 2 },
];

const baseMatch: Match = {
    id: 1,
    tournament_id: null,
    home_team_id: 1,
    away_team_id: 2,
    toss_winner_id: 1,
    opt_to: 'Bat',
    overs: 2,
    is_completed: 0,
    inning1_completed: 0,
    inning2_striker_id: null,
    inning2_non_striker_id: null,
    inning2_bowler_id: null,
    created_at: '2026-11-26',
};

const d = (partial: Partial<Delivery> & { id: number }): Delivery => ({
    match_id: 1,
    inning: 1,
    over_number: 0,
    ball_number: 1,
    batsman_id: 101,
    non_striker_id: 102,
    bowler_id: 201,
    runs: 0,
    extras_type: null,
    extras_runs: 0,
    is_wicket: 0,
    wicket_type: null,
    player_out_id: null,
    fielder_id: null,
    next_batsman_id: null,
    ...partial,
});

// 1. Wide + Byes + Maiden over + Consecutive over block + Strike rotation
const over1Deliveries: Delivery[] = [
    d({ id: 1, ball_number: 1, runs: 0, extras_type: 'B', extras_runs: 1 }), // 1B -> swaps strike (102 on strike)
    d({ id: 2, ball_number: 2, batsman_id: 102, non_striker_id: 101, runs: 0 }),
    d({ id: 3, ball_number: 3, batsman_id: 102, non_striker_id: 101, runs: 0 }),
    d({ id: 4, ball_number: 4, batsman_id: 102, non_striker_id: 101, runs: 0, extras_type: 'LB', extras_runs: 2 }), // LB doesn't break maiden
    d({ id: 5, ball_number: 5, batsman_id: 102, non_striker_id: 101, runs: 0 }),
    d({ id: 6, ball_number: 6, batsman_id: 102, non_striker_id: 101, runs: 0 }), // Over 0 complete -> swaps strike back to 101
];

let state = deriveMatchState({ match: baseMatch, homeTeam, awayTeam, players, deliveries: over1Deliveries });
assert.equal(state.inning1.totalRuns, 3);
assert.equal(state.inning1.oversDisplay, '1.0');
assert.equal(state.inning1.bowlerStats[201].maidens, 1, 'Byes/LB must not break a maiden');
assert.equal(state.inning1.bowlerStats[201].runsConceded, 0);
assert.equal(state.inning1.needsBowlerChange, true);
assert.equal(state.inning1.previousOverBowlerId, 201, 'Previous over bowler must be blocked');
assert.equal(state.inning1.strikerId, 101, 'End of over must rotate strike back to 101');

// Undo over completion (pop ball 6 -> back to 0.5)
state = deriveMatchState({
    match: baseMatch,
    homeTeam,
    awayTeam,
    players,
    deliveries: over1Deliveries.slice(0, 5),
});
assert.equal(state.inning1.oversDisplay, '0.5');
assert.equal(state.inning1.bowlerStats[201].maidens, 0);
assert.equal(state.inning1.needsBowlerChange, false);
assert.equal(state.inning1.previousOverBowlerId, null);
assert.equal(state.inning1.strikerId, 102);

// 2. Wicket + Partnership Transition + Surviving Batter Global Stats + Undo Wicket
const wicketFlow: Delivery[] = [
    d({ id: 1, ball_number: 1, batsman_id: 101, non_striker_id: 102, bowler_id: 201, runs: 4 }),
    d({ id: 2, ball_number: 2, batsman_id: 101, non_striker_id: 102, bowler_id: 201, runs: 1 }), // 102 on strike
    d({
        id: 3,
        ball_number: 3,
        batsman_id: 102,
        non_striker_id: 101,
        bowler_id: 201,
        runs: 0,
        is_wicket: 1,
        wicket_type: 'Caught',
        player_out_id: 102,
        fielder_id: 202,
        next_batsman_id: 103,
    }),
    d({ id: 4, ball_number: 4, batsman_id: 103, non_striker_id: 101, bowler_id: 201, runs: 2 }),
];

state = deriveMatchState({ match: baseMatch, homeTeam, awayTeam, players, deliveries: wicketFlow });
assert.equal(state.inning1.wickets, 1);
assert.equal(state.inning1.partnerships.length, 2);
assert.equal(state.inning1.partnerships[0].status, 'COMPLETED');
assert.equal(state.inning1.partnerships[0].runs, 5);
assert.equal(state.inning1.activePartnership?.batter1Id, 101);
assert.equal(state.inning1.activePartnership?.batter2Id, 103);
assert.notEqual(state.inning1.activePartnership?.batter1Id, state.inning1.activePartnership?.batter2Id);
assert.equal(state.inning1.activePartnership?.runs, 2);
assert.equal(state.inning1.activePartnership?.batter1Runs, 0, 'Surviving batter starts at 0 in new partnership');
assert.equal(state.inning1.batterStats[101].runs, 5, 'Surviving batter preserves global runs');
assert.ok(state.inning1.battedPlayerIds.includes(102), 'Dismissed batter stays blocked from batting twice');
assert.ok(state.inning1.battedPlayerIds.includes(101), 'Active batter stays blocked from batting twice');

// Undo back before wicket (pop balls 4 & 3)
state = deriveMatchState({ match: baseMatch, homeTeam, awayTeam, players, deliveries: wicketFlow.slice(0, 2) });
assert.equal(state.inning1.wickets, 0);
assert.equal(state.inning1.partnerships.length, 1);
assert.equal(state.inning1.activePartnership?.status, 'ACTIVE');
assert.equal(state.inning1.batterStats[103], undefined, 'Incoming batter slot removed on wicket undo');
assert.equal(state.inning1.nonStrikerId, 101);
assert.equal(state.inning1.strikerId, 102);

// 3. Fielder & Bowler wicket credit rules
assert.equal(dismissalRequiresFielder('Bowled'), false);
assert.equal(dismissalRequiresFielder('LBW'), false);
assert.equal(dismissalRequiresFielder('Hit Wicket'), false);
assert.equal(dismissalRequiresFielder('Retired'), false);
assert.equal(dismissalRequiresFielder('Caught'), true);
assert.equal(dismissalRequiresFielder('Stumped'), true);
assert.equal(dismissalRequiresFielder('Run Out'), true);

assert.equal(dismissalCreditsBowler('Bowled'), true);
assert.equal(dismissalCreditsBowler('Caught'), true);
assert.equal(dismissalCreditsBowler('LBW'), true);
assert.equal(dismissalCreditsBowler('Stumped'), true);
assert.equal(dismissalCreditsBowler('Hit Wicket'), true);
assert.equal(dismissalCreditsBowler('Run Out'), false);
assert.equal(dismissalCreditsBowler('Retired'), false);

// 4. Manual Complete Innings -> 2nd Innings Cross-Innings Suggestions & Result Comparison
const manualBreakMatch: Match = {
    ...baseMatch,
    inning1_completed: 1,
    inning2_striker_id: 201,
    inning2_non_striker_id: 202,
    inning2_bowler_id: 101,
};
state = deriveMatchState({ match: manualBreakMatch, homeTeam, awayTeam, players, deliveries: wicketFlow });
assert.equal(state.activeInning, 2);
assert.equal(state.inning2?.target, 8, 'Target = 1st innings total (7) + 1');
assert.ok(state.inning2BowlerSuggestions.some((p) => p.id === 101 && p.team_id === 1));
assert.ok(state.inning2BowlerSuggestions.some((p) => p.id === 102 && p.team_id === 1));
assert.ok(state.inning2BowlerSuggestions.some((p) => p.id === 103 && p.team_id === 1));
assert.ok(!state.inning2BatterSuggestions.some((p) => p.id === 201), '201 already batting in 2nd innings');
assert.ok(!state.inning2BatterSuggestions.some((p) => p.id === 202), '202 already batting in 2nd innings');

assert.deepEqual(computeMatchResult(50, 51, 3, 'Tigers', 'Lions'), {
    winner: 'Lions',
    margin: 'by 7 wickets',
    isTie: false,
});
assert.deepEqual(computeMatchResult(50, 42, 6, 'Tigers', 'Lions'), {
    winner: 'Tigers',
    margin: 'by 8 runs',
    isTie: false,
});
assert.deepEqual(computeMatchResult(50, 50, 10, 'Tigers', 'Lions'), {
    winner: 'Match Tied',
    margin: '',
    isTie: true,
});

// 5. Wide + No-Ball + 10-wicket All Out + Automatic 2nd Innings Chase Win
const wideAndNb: Delivery[] = [
    d({ id: 1, ball_number: 1, batsman_id: 101, non_striker_id: 102, bowler_id: 201, runs: 0, extras_type: 'WD', extras_runs: 2 }), // 1wd + 1 extra -> swaps strike to 102, 0 legal balls
    d({ id: 2, ball_number: 1, batsman_id: 102, non_striker_id: 101, bowler_id: 201, runs: 4, extras_type: 'NB', extras_runs: 1 }), // NB + 4 -> 5 runs, 0 legal balls
];
state = deriveMatchState({ match: baseMatch, homeTeam, awayTeam, players, deliveries: wideAndNb });
assert.equal(state.inning1.totalRuns, 7);
assert.equal(state.inning1.legalBalls, 0);
assert.equal(state.inning1.oversDisplay, '0.0');
assert.equal(state.inning1.batterStats[101].balls, 0, 'Wide must not count as ball faced');
assert.equal(state.inning1.batterStats[102].runs, 4);
assert.equal(state.inning1.batterStats[102].balls, 1, 'No ball counts as ball faced');
assert.equal(state.inning1.bowlerStats[201].runsConceded, 7);

// 10 wickets -> All Out triggers inning1 completion
const tenWickets: Delivery[] = Array.from({ length: 10 }, (_, idx) =>
    d({
        id: idx + 1,
        over_number: Math.floor(idx / 6),
        ball_number: (idx % 6) + 1,
        batsman_id: 101,
        non_striker_id: 102,
        bowler_id: Math.floor(idx / 6) % 2 === 0 ? 201 : 202,
        runs: 0,
        is_wicket: 1,
        wicket_type: 'Bowled',
        player_out_id: 101,
        next_batsman_id: idx < 9 ? 103 : null,
    })
);
state = deriveMatchState({ match: baseMatch, homeTeam, awayTeam, players, deliveries: tenWickets });
assert.equal(state.inning1.wickets, 10);
assert.equal(state.inning1.isAllOut, true);
assert.equal(state.inning1.isInningsComplete, true);
assert.equal(state.needsSecondInningsSetup, true);

// Auto chase win in 2nd innings
const chaseWinDeliveries: Delivery[] = [
    d({ id: 1, inning: 1, runs: 6 }),
    d({ id: 2, inning: 2, batsman_id: 201, non_striker_id: 202, bowler_id: 101, runs: 4 }),
    d({ id: 3, inning: 2, batsman_id: 201, non_striker_id: 202, bowler_id: 101, runs: 4 }),
];
state = deriveMatchState({
    match: { ...baseMatch, inning1_completed: 1, inning2_striker_id: 201, inning2_non_striker_id: 202, inning2_bowler_id: 101 },
    homeTeam,
    awayTeam,
    players,
    deliveries: chaseWinDeliveries,
});
assert.equal(state.isMatchComplete, true);
assert.deepEqual(state.result, { winner: 'Lions', margin: 'by 10 wickets', isTie: false });

console.log('ALL_SCORING_ENGINE_CHECKS_PASSED');
