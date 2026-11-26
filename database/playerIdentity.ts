import { db } from './db';
import { Player } from './types';

export const normalizePlayerName = (name: string): string => name.trim().toLowerCase();

/**
 * Resolves or creates a team-scoped player record by normalized name (`trim().toLowerCase()`).
 */
export function getOrCreatePlayer(teamId: number, rawName: string): Player {
    const cleanName = rawName.trim();
    const normalized = normalizePlayerName(cleanName);
    if (!cleanName) {
        throw new Error('Player name cannot be empty');
    }

    const existing = db.getFirstSync(
        'SELECT id, name, team_id FROM Players WHERE team_id = ? AND LOWER(TRIM(name)) = ? LIMIT 1',
        teamId,
        normalized
    ) as Player | null;

    if (existing) {
        return existing;
    }

    const res = db.runSync(
        'INSERT INTO Players (name, team_id) VALUES (?, ?)',
        cleanName,
        teamId
    );
    return {
        id: res.lastInsertRowId,
        name: cleanName,
        team_id: teamId,
    };
}
