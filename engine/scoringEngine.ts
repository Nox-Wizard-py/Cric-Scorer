import { Delivery, Match, Player, Team } from '../database/types';

export const MAX_PLAYERS_PER_TEAM = 11;
export const MAX_WICKETS = 10;

export const DISMISSAL_TYPES = [
    'Caught',
    'Bowled',
    'LBW',
    'Run Out',
    'Stumped',
    'Hit Wicket',
    'Retired',
] as const;

export type DismissalType = (typeof DISMISSAL_TYPES)[number];

const FIELDER_REQUIRED_TYPES = new Set<string>(['Caught', 'Stumped', 'Run Out']);
const BOWLER_CREDITED_TYPES = new Set<string>(['Bowled', 'Caught', 'LBW', 'Stumped', 'Hit Wicket']);

export const dismissalRequiresFielder = (type: string): boolean => FIELDER_REQUIRED_TYPES.has(type);
export const dismissalCreditsBowler = (type: string | null | undefined): boolean =>
    Boolean(type && BOWLER_CREDITED_TYPES.has(type));

export interface BatterStat {
    playerId: number;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    isOut: boolean;
    dismissalType: string | null;
    dismissalText: string;
}

export interface FallOfWicketRecord {
    wicketNumber: number;
    playerOutId: number;
    batterName: string;
    scoreAtFall: number;
    scoreDisplay: string;
    overDisplay: string;
}

export interface OverDeliveryChip {
    id: number;
    circleLabel: string;
    subLabel: string | null;
    kind: 'normal' | 'boundary' | 'wicket' | 'extra';
}

export interface OverBreakdown {
    overNumber: number;
    runs: number;
    bowlerNames: string[];
    batterNames: string[];
    deliveries: OverDeliveryChip[];
}

export interface BowlerStat {
    playerId: number;
    name: string;
    legalBalls: number;
    overs: number;
    ballsInOver: number;
    oversDisplay: string;
    maidens: number;
    runsConceded: number;
    wickets: number;
    economy: string;
}

export interface PartnershipRecord {
    index: number;
    batter1Id: number;
    batter2Id: number;
    batter1Name: string;
    batter2Name: string;
    runs: number;
    balls: number;
    batter1Runs: number;
    batter1Balls: number;
    batter2Runs: number;
    batter2Balls: number;
    extras: number;
    status: 'ACTIVE' | 'COMPLETED';
}

export interface OverBallBadge {
    id: number;
    label: string;
    kind: 'normal' | 'boundary' | 'wicket' | 'extra';
}

export interface ExtrasSummary {
    wide: number;
    noBall: number;
    byes: number;
    legByes: number;
    total: number;
}

export interface InningsDerivedState {
    inning: 1 | 2;
    battingTeam: Team;
    bowlingTeam: Team;
    totalRuns: number;
    wickets: number;
    legalBalls: number;
    oversCompleted: number;
    ballsInOver: number;
    oversDisplay: string;
    crr: string;
    target: number | null;
    runsNeeded: number | null;
    ballsRemaining: number;
    rrr: string | null;
    extras: ExtrasSummary;
    strikerId: number;
    nonStrikerId: number;
    currentBowlerId: number;
    previousOverBowlerId: number | null;
    needsBowlerChange: boolean;
    currentOverBalls: OverBallBadge[];
    batterStats: Record<number, BatterStat>;
    battersList: BatterStat[];
    bowlerStats: Record<number, BowlerStat>;
    bowlersList: BowlerStat[];
    partnerships: PartnershipRecord[];
    activePartnership: PartnershipRecord | null;
    fallOfWickets: FallOfWicketRecord[];
    oversHistory: OverBreakdown[];
    battedPlayerIds: number[];
    dismissedPlayerIds: number[];
    bowledPlayerIds: number[];
    isAllOut: boolean;
    isOversComplete: boolean;
    isTargetChased: boolean;
    isInningsComplete: boolean;
}

export interface MatchResultSummary {
    winner: string;
    margin: string;
    isTie: boolean;
}

export interface MatchDerivedState {
    match: Match;
    firstBatTeam: Team;
    firstBowlTeam: Team;
    inning1: InningsDerivedState;
    inning2: InningsDerivedState | null;
    activeInning: 1 | 2;
    activeState: InningsDerivedState;
    needsSecondInningsSetup: boolean;
    result: MatchResultSummary | null;
    isMatchComplete: boolean;
    canUndo: boolean;
    inning1BowlerSuggestions: Player[];
    inning2BowlerSuggestions: Player[];
    inning2BatterSuggestions: Player[];
    activeFieldingSuggestions: Player[];
}

const formatOvers = (legalBalls: number): string =>
    `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;

const formatRate = (runs: number, legalBalls: number): string => {
    if (legalBalls <= 0) return '0.00';
    return (runs / (legalBalls / 6)).toFixed(2);
};

export const formatStrikeRate = (runs: number, balls: number): string =>
    balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00';

export const formatDismissalText = (
    type: string | null | undefined,
    bowlerName: string,
    fielderName?: string | null
): string => {
    const cleanFielder = fielderName?.trim() || '';
    switch (type) {
        case 'Bowled':
            return `b ${bowlerName}`;
        case 'Caught':
            return cleanFielder ? `c ${cleanFielder} b ${bowlerName}` : `c & b ${bowlerName}`;
        case 'LBW':
            return `lbw b ${bowlerName}`;
        case 'Stumped':
            return cleanFielder ? `st ${cleanFielder} b ${bowlerName}` : `st b ${bowlerName}`;
        case 'Run Out':
            return cleanFielder ? `run out (${cleanFielder})` : 'run out';
        case 'Hit Wicket':
            return `hit wicket b ${bowlerName}`;
        case 'Retired':
            return 'retired';
        default:
            return type ? type.toLowerCase() : 'out';
    }
};

export const formatOverDeliveryChip = (d: Delivery): OverDeliveryChip => {
    const extraRuns = d.extras_runs || 0;
    const total = (d.runs || 0) + extraRuns;
    const isWicket = Boolean(d.is_wicket);

    let subLabel: string | null = null;
    if (d.extras_type === 'WD') subLabel = 'WD';
    else if (d.extras_type === 'NB') subLabel = 'NB';
    else if (d.extras_type === 'B') subLabel = `${extraRuns}BYE`;
    else if (d.extras_type === 'LB') subLabel = `${extraRuns}LB`;

    if (isWicket) {
        return { id: d.id, circleLabel: 'OUT', subLabel, kind: 'wicket' };
    }
    if (d.extras_type) {
        return { id: d.id, circleLabel: String(total), subLabel, kind: 'extra' };
    }
    if (d.runs === 4 || d.runs === 6) {
        return { id: d.id, circleLabel: String(total), subLabel: null, kind: 'boundary' };
    }
    return { id: d.id, circleLabel: String(total), subLabel: null, kind: 'normal' };
};

export const formatDeliveryBadge = (d: Delivery): OverBallBadge => {
    const total = d.runs + (d.extras_runs || 0);
    const isWicket = Boolean(d.is_wicket);
    if (isWicket) {
        return { id: d.id, label: 'W', kind: 'wicket' };
    }
    if (d.extras_type === 'WD') {
        return { id: d.id, label: `${total}wd`, kind: 'extra' };
    }
    if (d.extras_type === 'NB') {
        return { id: d.id, label: `${total}nb`, kind: 'extra' };
    }
    if (d.extras_type === 'B') {
        return { id: d.id, label: `${total}b`, kind: 'extra' };
    }
    if (d.extras_type === 'LB') {
        return { id: d.id, label: `${total}lb`, kind: 'extra' };
    }
    if (d.runs === 4 || d.runs === 6) {
        return { id: d.id, label: `${total}`, kind: 'boundary' };
    }
    return { id: d.id, label: `${total}`, kind: 'normal' };
};

export const computeMatchResult = (
    inning1Total: number,
    inning2Total: number,
    inning2Wickets: number,
    firstBatTeamName: string,
    secondBatTeamName: string
): MatchResultSummary => {
    if (inning2Total > inning1Total) {
        const wicketsRemaining = Math.max(1, MAX_WICKETS - inning2Wickets);
        return {
            winner: secondBatTeamName,
            margin: `by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}`,
            isTie: false,
        };
    }
    if (inning2Total < inning1Total) {
        const runDiff = inning1Total - inning2Total;
        return {
            winner: firstBatTeamName,
            margin: `by ${runDiff} run${runDiff === 1 ? '' : 's'}`,
            isTie: false,
        };
    }
    return {
        winner: 'Match Tied',
        margin: '',
        isTie: true,
    };
};

interface DeriveInningsParams {
    inning: 1 | 2;
    maxOvers: number;
    target: number | null;
    battingTeam: Team;
    bowlingTeam: Team;
    openingStrikerId: number;
    openingNonStrikerId: number;
    openingBowlerId: number;
    deliveries: Delivery[];
    playersById: Map<number, Player>;
    manualComplete: boolean;
}

export function deriveInningsState(params: DeriveInningsParams): InningsDerivedState {
    const {
        inning,
        maxOvers,
        target,
        battingTeam,
        bowlingTeam,
        openingStrikerId,
        openingNonStrikerId,
        openingBowlerId,
        deliveries,
        playersById,
        manualComplete,
    } = params;

    const getName = (pid: number, fallback: string) => playersById.get(pid)?.name || fallback;

    const batterStats: Record<number, BatterStat> = {};
    const batterOrder: number[] = [];
    const bowlerStats: Record<number, BowlerStat> = {};
    const bowlerOrder: number[] = [];
    const battedSet = new Set<number>();
    const dismissedSet = new Set<number>();

    const ensureBatter = (pid: number) => {
        if (!pid) return;
        battedSet.add(pid);
        if (!batterStats[pid]) {
            batterOrder.push(pid);
            batterStats[pid] = {
                playerId: pid,
                name: getName(pid, 'Batter'),
                runs: 0,
                balls: 0,
                fours: 0,
                sixes: 0,
                isOut: false,
                dismissalType: null,
                dismissalText: 'not out',
            };
        }
    };

    const ensureBowler = (pid: number) => {
        if (!pid) return;
        if (!bowlerStats[pid]) {
            bowlerOrder.push(pid);
            bowlerStats[pid] = {
                playerId: pid,
                name: getName(pid, 'Bowler'),
                legalBalls: 0,
                overs: 0,
                ballsInOver: 0,
                oversDisplay: '0.0',
                maidens: 0,
                runsConceded: 0,
                wickets: 0,
                economy: '0.00',
            };
        }
    };

    let strikerId = deliveries.length > 0 ? deliveries[0].batsman_id : openingStrikerId;
    let nonStrikerId = deliveries.length > 0 ? deliveries[0].non_striker_id : openingNonStrikerId;
    let currentBowlerId = deliveries.length > 0 ? deliveries[0].bowler_id : openingBowlerId;

    ensureBatter(strikerId);
    ensureBatter(nonStrikerId);
    ensureBowler(currentBowlerId);

    const partnerships: PartnershipRecord[] = [];
    const openPartnership = (b1Id: number, b2Id: number) => {
        if (!b1Id || !b2Id || b1Id === b2Id) return;
        partnerships.push({
            index: partnerships.length + 1,
            batter1Id: b1Id,
            batter2Id: b2Id,
            batter1Name: getName(b1Id, 'Batter 1'),
            batter2Name: getName(b2Id, 'Batter 2'),
            runs: 0,
            balls: 0,
            batter1Runs: 0,
            batter1Balls: 0,
            batter2Runs: 0,
            batter2Balls: 0,
            extras: 0,
            status: 'ACTIVE',
        });
    };

    openPartnership(strikerId, nonStrikerId);

    let totalRuns = 0;
    let wickets = 0;
    let legalBalls = 0;
    const extras: ExtrasSummary = { wide: 0, noBall: 0, byes: 0, legByes: 0, total: 0 };

    let overLegalBalls = 0;
    let overBowlerRuns = 0;
    let overBowlerId: number | null = null;
    let overMixedBowlers = false;
    let lastCompletedOverBowlerId: number | null = null;
    let awaitingBowlerChange = false;
    let currentOverBadges: OverBallBadge[] = [];
    const fallOfWickets: FallOfWicketRecord[] = [];
    const oversHistory: OverBreakdown[] = [];
    let currentOverRecord: OverBreakdown | null = null;

    const addUniqueName = (arr: string[], name: string) => {
        if (name && !arr.includes(name)) arr.push(name);
    };

    for (const d of deliveries) {
        strikerId = d.batsman_id;
        nonStrikerId = d.non_striker_id;
        currentBowlerId = d.bowler_id;
        awaitingBowlerChange = false;

        ensureBatter(strikerId);
        ensureBatter(nonStrikerId);
        ensureBowler(currentBowlerId);

        if (!currentOverRecord) {
            currentOverRecord = {
                overNumber: oversHistory.length + 1,
                runs: 0,
                bowlerNames: [],
                batterNames: [],
                deliveries: [],
            };
        }
        addUniqueName(currentOverRecord.bowlerNames, getName(currentBowlerId, 'Bowler'));
        addUniqueName(currentOverRecord.batterNames, getName(strikerId, 'Batter'));
        addUniqueName(currentOverRecord.batterNames, getName(nonStrikerId, 'Batter'));

        if (overBowlerId === null) {
            overBowlerId = currentBowlerId;
        } else if (overBowlerId !== currentBowlerId) {
            overMixedBowlers = true;
        }

        const isWide = d.extras_type === 'WD';
        const isNoBall = d.extras_type === 'NB';
        const isByes = d.extras_type === 'B';
        const isLegByes = d.extras_type === 'LB';
        const isLegal = !isWide && !isNoBall;
        const extraRuns = d.extras_runs || 0;
        const batRuns = d.runs || 0;
        const deliveryTotal = batRuns + extraRuns;

        totalRuns += deliveryTotal;

        if (d.extras_type === 'WD') extras.wide += extraRuns;
        else if (d.extras_type === 'NB') extras.noBall += extraRuns;
        else if (d.extras_type === 'B') extras.byes += extraRuns;
        else if (d.extras_type === 'LB') extras.legByes += extraRuns;
        extras.total += extraRuns;

        // Batter stats (wide is not a ball faced; bat runs come from d.runs)
        const activeBatter = batterStats[strikerId];
        if (activeBatter) {
            activeBatter.runs += batRuns;
            if (!isWide) activeBatter.balls += 1;
            if (batRuns === 4) activeBatter.fours += 1;
            if (batRuns === 6) activeBatter.sixes += 1;
        }

        // Bowler stats (Byes & Leg Byes are NOT charged to bowler and do NOT break a maiden)
        const bowler = bowlerStats[currentBowlerId];
        const bowlerRunsThisBall = isByes || isLegByes ? 0 : isWide ? extraRuns : batRuns + extraRuns;
        if (bowler) {
            bowler.runsConceded += bowlerRunsThisBall;
            if (isLegal) bowler.legalBalls += 1;
            if (Boolean(d.is_wicket) && dismissalCreditsBowler(d.wicket_type)) {
                bowler.wickets += 1;
            }
        }
        overBowlerRuns += bowlerRunsThisBall;

        // Active partnership accumulation
        let currentPart = partnerships[partnerships.length - 1];
        if (!currentPart || currentPart.status !== 'ACTIVE') {
            openPartnership(strikerId, nonStrikerId);
            currentPart = partnerships[partnerships.length - 1];
        }
        if (currentPart) {
            currentPart.runs += deliveryTotal;
            if (isLegal) currentPart.balls += 1;
            currentPart.extras += extraRuns;
            if (strikerId === currentPart.batter1Id) {
                currentPart.batter1Runs += batRuns;
                if (!isWide) currentPart.batter1Balls += 1;
            } else if (strikerId === currentPart.batter2Id) {
                currentPart.batter2Runs += batRuns;
                if (!isWide) currentPart.batter2Balls += 1;
            }
        }

        currentOverBadges.push(formatDeliveryBadge(d));
        currentOverRecord.runs += deliveryTotal;
        currentOverRecord.deliveries.push(formatOverDeliveryChip(d));

        if (isLegal) {
            legalBalls += 1;
            overLegalBalls += 1;
        }

        // Strike rotation from runs scored on this delivery
        let runsForStrikeSwap = 0;
        if (isWide) {
            // Wide gives 1 penalty run + additional running runs; odd additional runs rotate strike
            runsForStrikeSwap = Math.max(0, extraRuns - 1);
        } else if (isByes || isLegByes) {
            runsForStrikeSwap = extraRuns;
        } else {
            // Normal ball or No-Ball (bat runs or NB+bye runs)
            runsForStrikeSwap = batRuns > 0 ? batRuns : Math.max(0, extraRuns - 1);
        }

        if (runsForStrikeSwap % 2 !== 0) {
            const tmp = strikerId;
            strikerId = nonStrikerId;
            nonStrikerId = tmp;
        }

        // Wicket handling
        if (Boolean(d.is_wicket)) {
            wickets += 1;
            const outId = d.player_out_id ?? d.batsman_id;
            dismissedSet.add(outId);
            const bowlerName = getName(currentBowlerId, 'Bowler');
            const fielderName = d.fielder_id ? getName(d.fielder_id, '') : '';
            if (batterStats[outId]) {
                batterStats[outId].isOut = true;
                batterStats[outId].dismissalType = d.wicket_type || 'Out';
                batterStats[outId].dismissalText = formatDismissalText(
                    d.wicket_type,
                    bowlerName,
                    fielderName
                );
            }

            fallOfWickets.push({
                wicketNumber: wickets,
                playerOutId: outId,
                batterName: getName(outId, 'Batter'),
                scoreAtFall: totalRuns,
                scoreDisplay: `${totalRuns}/${wickets}`,
                overDisplay: formatOvers(legalBalls),
            });

            if (currentPart) {
                currentPart.status = 'COMPLETED';
            }

            const survivingId = outId === strikerId ? nonStrikerId : strikerId;
            const nextId = d.next_batsman_id ?? null;

            if (nextId && wickets < MAX_WICKETS && nextId !== survivingId) {
                ensureBatter(nextId);
                if (outId === strikerId) {
                    strikerId = nextId;
                } else {
                    nonStrikerId = nextId;
                }
                openPartnership(survivingId, nextId);
            }
        }

        // End of over check
        if (isLegal && overLegalBalls === 6) {
            if (!overMixedBowlers && overBowlerId && overBowlerRuns === 0 && bowlerStats[overBowlerId]) {
                bowlerStats[overBowlerId].maidens += 1;
            }
            if (currentOverRecord) {
                oversHistory.push(currentOverRecord);
                currentOverRecord = null;
            }
            lastCompletedOverBowlerId = currentBowlerId;
            awaitingBowlerChange = true;
            overLegalBalls = 0;
            overBowlerRuns = 0;
            overBowlerId = null;
            overMixedBowlers = false;
            currentOverBadges = [];

            // Rotate strike at end of over
            const tmp = strikerId;
            strikerId = nonStrikerId;
            nonStrikerId = tmp;
        }
    }

    if (currentOverRecord && currentOverRecord.deliveries.length > 0) {
        oversHistory.push(currentOverRecord);
    }

    // Finalize derived bowler display fields
    for (const pid of bowlerOrder) {
        const b = bowlerStats[pid];
        b.overs = Math.floor(b.legalBalls / 6);
        b.ballsInOver = b.legalBalls % 6;
        b.oversDisplay = formatOvers(b.legalBalls);
        b.economy = formatRate(b.runsConceded, b.legalBalls);
    }

    const oversCompleted = Math.floor(legalBalls / 6);
    const ballsInOver = legalBalls % 6;
    const isAllOut = wickets >= MAX_WICKETS;
    const isOversComplete = oversCompleted >= maxOvers;
    const isTargetChased = target !== null && totalRuns >= target;
    const isInningsComplete = manualComplete || isAllOut || isOversComplete || isTargetChased;

    const totalMatchBalls = maxOvers * 6;
    const ballsRemaining = Math.max(0, totalMatchBalls - legalBalls);
    const runsNeeded = target !== null ? Math.max(0, target - totalRuns) : null;
    const rrr =
        target !== null
            ? totalRuns >= target
                ? '0.00'
                : ballsRemaining > 0
                ? ((target - totalRuns) / (ballsRemaining / 6)).toFixed(2)
                : '0.00'
            : null;

    const needsBowlerChange = awaitingBowlerChange && !isInningsComplete;
    const activePartnership =
        [...partnerships].reverse().find((p) => p.status === 'ACTIVE') ?? null;

    return {
        inning,
        battingTeam,
        bowlingTeam,
        totalRuns,
        wickets,
        legalBalls,
        oversCompleted,
        ballsInOver,
        oversDisplay: formatOvers(legalBalls),
        crr: formatRate(totalRuns, legalBalls),
        target,
        runsNeeded,
        ballsRemaining,
        rrr,
        extras,
        strikerId,
        nonStrikerId,
        currentBowlerId,
        previousOverBowlerId: needsBowlerChange ? lastCompletedOverBowlerId : null,
        needsBowlerChange,
        currentOverBalls: currentOverBadges,
        batterStats,
        battersList: batterOrder.map((id) => batterStats[id]),
        bowlerStats,
        bowlersList: bowlerOrder.map((id) => bowlerStats[id]),
        partnerships,
        activePartnership,
        fallOfWickets,
        oversHistory,
        battedPlayerIds: Array.from(battedSet),
        dismissedPlayerIds: Array.from(dismissedSet),
        bowledPlayerIds: bowlerOrder,
        isAllOut,
        isOversComplete,
        isTargetChased,
        isInningsComplete,
    };
}

export interface DeriveMatchParams {
    match: Match;
    homeTeam: Team;
    awayTeam: Team;
    players: Player[];
    deliveries: Delivery[];
}

export function deriveMatchState(params: DeriveMatchParams): MatchDerivedState {
    const { match, homeTeam, awayTeam, players, deliveries } = params;
    const maxOvers = match.overs || 16;

    const firstBatTeam =
        match.opt_to === 'Bat'
            ? match.toss_winner_id === homeTeam.id
                ? homeTeam
                : awayTeam
            : match.toss_winner_id === homeTeam.id
            ? awayTeam
            : homeTeam;

    const firstBowlTeam = firstBatTeam.id === homeTeam.id ? awayTeam : homeTeam;

    const playersById = new Map<number, Player>();
    for (const p of players) {
        playersById.set(p.id, p);
    }

    const firstBatTeamPlayers = players.filter((p) => p.team_id === firstBatTeam.id);
    const firstBowlTeamPlayers = players.filter((p) => p.team_id === firstBowlTeam.id);

    const inn1Deliveries = deliveries.filter((d) => d.inning === 1);
    const inn2Deliveries = deliveries.filter((d) => d.inning === 2);

    const inning1 = deriveInningsState({
        inning: 1,
        maxOvers,
        target: null,
        battingTeam: firstBatTeam,
        bowlingTeam: firstBowlTeam,
        openingStrikerId: firstBatTeamPlayers[0]?.id || 0,
        openingNonStrikerId: firstBatTeamPlayers[1]?.id || 0,
        openingBowlerId: firstBowlTeamPlayers[0]?.id || 0,
        deliveries: inn1Deliveries,
        playersById,
        manualComplete: Boolean(match.inning1_completed),
    });

    const hasInning2Openers = Boolean(
        match.inning2_striker_id && match.inning2_non_striker_id && match.inning2_bowler_id
    );
    const hasInning2Started = inn2Deliveries.length > 0 || hasInning2Openers;
    const target = inning1.totalRuns + 1;

    const inning2 = hasInning2Started
        ? deriveInningsState({
              inning: 2,
              maxOvers,
              target,
              battingTeam: firstBowlTeam,
              bowlingTeam: firstBatTeam,
              openingStrikerId: match.inning2_striker_id || 0,
              openingNonStrikerId: match.inning2_non_striker_id || 0,
              openingBowlerId: match.inning2_bowler_id || 0,
              deliveries: inn2Deliveries,
              playersById,
              manualComplete: Boolean(match.is_completed),
          })
        : null;

    const activeInning: 1 | 2 = inning2 ? 2 : 1;
    const activeState = inning2 ?? inning1;
    const needsSecondInningsSetup = inning1.isInningsComplete && !inning2;

    const isMatchComplete = Boolean(inning2 && inning2.isInningsComplete);
    const result =
        inning2 && (isMatchComplete || Boolean(match.is_completed))
            ? computeMatchResult(
                  inning1.totalRuns,
                  inning2.totalRuns,
                  inning2.wickets,
                  firstBatTeam.name,
                  firstBowlTeam.name
              )
            : null;

    // Cross-innings quick-select suggestions
    const uniquePlayersByIds = (ids: number[]): Player[] => {
        const seen = new Set<number>();
        const list: Player[] = [];
        for (const id of ids) {
            if (!id || seen.has(id)) continue;
            const player = playersById.get(id);
            if (player) {
                seen.add(id);
                list.push(player);
            }
        }
        return list;
    };

    const inning1BowlerSuggestions = uniquePlayersByIds([
        ...inning1.bowledPlayerIds,
        ...firstBowlTeamPlayers.map((p) => p.id),
    ]);

    const inning2BowlerSuggestions = uniquePlayersByIds([
        ...inning1.battedPlayerIds,
        ...(inning2?.bowledPlayerIds ?? []),
        ...firstBatTeamPlayers.map((p) => p.id),
    ]);

    const inn2BattedSet = new Set(inning2?.battedPlayerIds ?? []);
    const inning2BatterSuggestions = uniquePlayersByIds([
        ...inning1.bowledPlayerIds,
        ...firstBowlTeamPlayers.map((p) => p.id),
    ]).filter((p) => !inn2BattedSet.has(p.id));

    const activeFieldingSuggestions =
        activeInning === 1 ? inning1BowlerSuggestions : inning2BowlerSuggestions;

    const canUndo =
        deliveries.length > 0 || Boolean(match.inning1_completed) || hasInning2Openers;

    return {
        match,
        firstBatTeam,
        firstBowlTeam,
        inning1,
        inning2,
        activeInning,
        activeState,
        needsSecondInningsSetup,
        result,
        isMatchComplete,
        canUndo,
        inning1BowlerSuggestions,
        inning2BowlerSuggestions,
        inning2BatterSuggestions,
        activeFieldingSuggestions,
    };
}
