import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
    InningsDerivedState,
    MatchDerivedState,
    formatStrikeRate,
} from '../engine/scoringEngine';

const escapeHtml = (value: string | number | null | undefined): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const renderInningsHtml = (innings: InningsDerivedState, heading: string): string => {
    const batterRows = innings.battersList
        .map(
            (b) => `
      <tr>
        <td>
          <div class="name">${escapeHtml(b.name)}</div>
          <div class="sub">${escapeHtml(b.dismissalText)}</div>
        </td>
        <td class="num strong">${b.runs}</td>
        <td class="num">${b.balls}</td>
        <td class="num">${b.fours}</td>
        <td class="num">${b.sixes}</td>
        <td class="num">${formatStrikeRate(b.runs, b.balls)}</td>
      </tr>`
        )
        .join('');

    const bowlerRows = innings.bowlersList
        .map(
            (bw) => `
      <tr>
        <td class="name">${escapeHtml(bw.name)}</td>
        <td class="num">${escapeHtml(bw.oversDisplay)}</td>
        <td class="num">${bw.maidens}</td>
        <td class="num strong">${bw.runsConceded}</td>
        <td class="num strong">${bw.wickets}</td>
        <td class="num">${escapeHtml(bw.economy)}</td>
      </tr>`
        )
        .join('');

    const fowRows =
        innings.fallOfWickets.length > 0
            ? innings.fallOfWickets
                  .map(
                      (f) => `
      <tr>
        <td class="name">${escapeHtml(f.batterName)}</td>
        <td class="num strong">${escapeHtml(f.scoreDisplay)}</td>
        <td class="num">${escapeHtml(f.overDisplay)}</td>
      </tr>`
                  )
                  .join('')
            : `<tr><td colspan="3" class="sub">No wickets fallen</td></tr>`;

    return `
    <section class="innings-block">
      <div class="innings-head">
        <span>${escapeHtml(heading)}: ${escapeHtml(innings.battingTeam.name)}</span>
        <span class="num">${innings.totalRuns}-${innings.wickets} (${escapeHtml(innings.oversDisplay)})</span>
      </div>

      <table>
        <thead>
          <tr><th>Batsman</th><th class="num">R</th><th class="num">B</th><th class="num">4s</th><th class="num">6s</th><th class="num">SR</th></tr>
        </thead>
        <tbody>
          ${batterRows}
          <tr class="summary-row">
            <td><strong>Extras</strong></td>
            <td colspan="5" class="num"><strong>${innings.extras.total}</strong> &nbsp; ${innings.extras.byes} B, ${innings.extras.legByes} LB, ${innings.extras.wide} WD, ${innings.extras.noBall} NB</td>
          </tr>
          <tr class="summary-row total-row">
            <td><strong>Total</strong></td>
            <td colspan="5" class="num"><strong>${innings.totalRuns}-${innings.wickets}</strong> (${escapeHtml(innings.oversDisplay)}) &nbsp; CRR ${escapeHtml(innings.crr)}</td>
          </tr>
        </tbody>
      </table>

      <table>
        <thead>
          <tr><th>Bowler</th><th class="num">O</th><th class="num">M</th><th class="num">R</th><th class="num">W</th><th class="num">ER</th></tr>
        </thead>
        <tbody>${bowlerRows}</tbody>
      </table>

      <table>
        <thead>
          <tr><th>Fall of wickets</th><th class="num">Score</th><th class="num">Over</th></tr>
        </thead>
        <tbody>${fowRows}</tbody>
      </table>
    </section>`;
};

export function buildScorecardHtml(matchState: MatchDerivedState): string {
    const { match, firstBatTeam, firstBowlTeam, inning1, inning2, result } = matchState;
    const tossWinner = match.toss_winner_id === firstBatTeam.id ? firstBatTeam.name : firstBowlTeam.name;
    const statusText = result
        ? result.isTie
            ? 'Match Tied'
            : `${result.winner} won ${result.margin}`
        : `${tossWinner} won the toss and opted to ${match.opt_to} first.`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #102030; margin: 0; font-size: 12px; }
    .doc-header { background: #102030; color: #F7F8FA; padding: 14px 16px; border-bottom: 4px solid #00B48A; display: flex; justify-content: space-between; align-items: center; }
    .doc-title { font-size: 18px; font-weight: 800; }
    .doc-meta { font-size: 11px; color: #A7C0D8; font-weight: 700; }
    .status-strip { background: #E6EBF0; border: 1px solid #CFD8E2; padding: 8px 12px; margin: 12px 0; border-radius: 6px; font-weight: 700; font-size: 11px; }
    .innings-block { margin-bottom: 18px; page-break-inside: avoid; }
    .innings-head { background: #162B40; color: #F7F8FA; padding: 9px 12px; border-radius: 6px 6px 0 0; border-bottom: 3px solid #00B48A; display: flex; justify-content: space-between; font-weight: 800; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 1px solid #CFD8E2; }
    th { background: #E6EBF0; color: #4A6075; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #CFD8E2; }
    td { padding: 6px 8px; border-bottom: 1px solid #E0E6ED; vertical-align: middle; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .name { font-weight: 700; }
    .sub { font-size: 10px; color: #4A6075; margin-top: 2px; }
    .strong { font-weight: 800; }
    .summary-row td { background: #F7F8FA; }
    .total-row td { background: #E6EBF0; }
  </style>
</head>
<body>
  <header class="doc-header">
    <div>
      <div class="doc-title">${escapeHtml(firstBatTeam.name)} v/s ${escapeHtml(firstBowlTeam.name)}</div>
      <div class="doc-meta">${match.overs} Overs · Full Match Scorecard</div>
    </div>
    <div class="doc-meta">CRIC-SCORER</div>
  </header>

  <div class="status-strip">${escapeHtml(statusText)}</div>

  ${renderInningsHtml(inning1, '1st Innings')}
  ${inning2 ? renderInningsHtml(inning2, '2nd Innings') : ''}
</body>
</html>`;
}

export async function exportScorecardPdf(matchState: MatchDerivedState): Promise<void> {
    const html = buildScorecardHtml(matchState);
    const { uri, base64 } = await Print.printToFileAsync({ html, base64: true });
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
        throw new Error('Sharing is not available on this device.');
    }

    let shareUri = uri;
    if (base64) {
        const sanitize = (name: string) => name.trim().replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Team';
        const fileName = `${sanitize(matchState.firstBatTeam.name)}_vs_${sanitize(
            matchState.firstBowlTeam.name
        )}_Scorecard.pdf`;
        const targetFile = new File(Paths.cache, fileName);
        targetFile.create({ overwrite: true });
        await targetFile.write(base64, { encoding: 'base64' });
        shareUri = targetFile.uri;
    }

    await Sharing.shareAsync(shareUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save Scorecard PDF',
        UTI: 'com.adobe.pdf',
    });
}
