export interface Tournament {
    id: number;
    name: string;
    status: 'Ongoing' | 'Completed';
    created_at: string;
}

export interface Team {
    id: number;
    name: string;
    logo_color: string;
}

export interface Player {
    id: number;
    name: string;
    team_id: number;
}

export interface Match {
    id: number;
    tournament_id: number | null;
    home_team_id: number;
    away_team_id: number;
    toss_winner_id: number;
    opt_to: 'Bat' | 'Bowl';
    overs: number;
    is_completed: boolean; // stored as 0 or 1 in SQLite, converted to boolean in app
    created_at: string;
}

export interface Delivery {
    id: number;
    match_id: number;
    inning: 1 | 2;
    over_number: number;
    ball_number: number;
    batsman_id: number;
    non_striker_id: number;
    bowler_id: number;
    runs: number;
    extras_type: 'WD' | 'NB' | 'LB' | 'B' | null;
    extras_runs: number;
    is_wicket: boolean;
    wicket_type: string | null;
    player_out_id: number | null;
}
