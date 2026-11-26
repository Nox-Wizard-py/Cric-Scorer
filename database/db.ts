import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('cricket_scorer.db');

const ensureColumn = (table: string, column: string, definition: string) => {
  const cols = db.getAllSync(`PRAGMA table_info(${table})`) as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

export const initDatabase = () => {
  try {
    db.execSync(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS Tournaments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT CHECK(status IN ('Ongoing', 'Completed')) NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        logo_color TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        team_id INTEGER NOT NULL,
        FOREIGN KEY (team_id) REFERENCES Teams (id)
      );

      CREATE TABLE IF NOT EXISTS Matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id INTEGER,
        home_team_id INTEGER NOT NULL,
        away_team_id INTEGER NOT NULL,
        toss_winner_id INTEGER NOT NULL,
        opt_to TEXT CHECK(opt_to IN ('Bat', 'Bowl')) NOT NULL,
        overs INTEGER NOT NULL,
        is_completed INTEGER DEFAULT 0,
        inning1_completed INTEGER DEFAULT 0,
        inning2_striker_id INTEGER,
        inning2_non_striker_id INTEGER,
        inning2_bowler_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tournament_id) REFERENCES Tournaments (id),
        FOREIGN KEY (home_team_id) REFERENCES Teams (id),
        FOREIGN KEY (away_team_id) REFERENCES Teams (id),
        FOREIGN KEY (toss_winner_id) REFERENCES Teams (id)
      );

      CREATE TABLE IF NOT EXISTS Deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        inning INTEGER NOT NULL,
        over_number INTEGER NOT NULL,
        ball_number INTEGER NOT NULL,
        batsman_id INTEGER NOT NULL,
        non_striker_id INTEGER NOT NULL,
        bowler_id INTEGER NOT NULL,
        runs INTEGER NOT NULL,
        extras_type TEXT CHECK(extras_type IN ('WD', 'NB', 'LB', 'B')),
        extras_runs INTEGER DEFAULT 0,
        is_wicket INTEGER DEFAULT 0,
        wicket_type TEXT,
        player_out_id INTEGER,
        fielder_id INTEGER,
        next_batsman_id INTEGER,
        FOREIGN KEY (match_id) REFERENCES Matches (id),
        FOREIGN KEY (batsman_id) REFERENCES Players (id),
        FOREIGN KEY (non_striker_id) REFERENCES Players (id),
        FOREIGN KEY (bowler_id) REFERENCES Players (id),
        FOREIGN KEY (player_out_id) REFERENCES Players (id),
        FOREIGN KEY (fielder_id) REFERENCES Players (id),
        FOREIGN KEY (next_batsman_id) REFERENCES Players (id)
      );
    `);

    // Migrate pre-existing local databases safely
    ensureColumn('Matches', 'inning1_completed', 'INTEGER DEFAULT 0');
    ensureColumn('Matches', 'inning2_striker_id', 'INTEGER');
    ensureColumn('Matches', 'inning2_non_striker_id', 'INTEGER');
    ensureColumn('Matches', 'inning2_bowler_id', 'INTEGER');
    ensureColumn('Deliveries', 'fielder_id', 'INTEGER');
    ensureColumn('Deliveries', 'next_batsman_id', 'INTEGER');

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};
