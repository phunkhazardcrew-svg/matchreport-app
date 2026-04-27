import * as XLSX from 'xlsx';

interface ExportData {
  homeTeam: string; awayTeam: string;
  homeScore: number; awayScore: number;
  htHomeScore: number | null; htAwayScore: number | null;
  homePlayers: any[]; awayPlayers: any[];
  events: any[]; notes: string; halfDuration: number;
}

export function generateXLS(data: ExportData): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Overview
  const ov: any[][] = [
    ['SPIELBERICHT', '', '', ''],
    [],
    ['Heimmannschaft', data.homeTeam, 'Gastmannschaft', data.awayTeam],
    ['Endergebnis', `${data.homeScore} : ${data.awayScore}`, '', ''],
  ];
  if (data.htHomeScore !== null) ov.push(['Halbzeitergebnis', `${data.htHomeScore} : ${data.htAwayScore}`, '', '']);
  ov.push(['Halbzeitdauer', `${data.halfDuration} min`, '', '']);
  ov.push([]);
  if (data.notes) { ov.push(['Bemerkungen']); ov.push([data.notes]); }
  const ws1 = XLSX.utils.aoa_to_sheet(ov);
  ws1['!cols'] = [{wch:20},{wch:30},{wch:20},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Uebersicht');

  // Sheet 2+3: Teams
  const makeTeamSheet = (name: string, players: any[]) => {
    const rows: any[][] = [
      [name],
      ['Nr', 'Name', 'Position', 'Status', 'Tore', 'Karten', 'Wechsel'],
    ];
    players.forEach(p => {
      const goals = data.events.filter(e => e.type === 'goal' && e.player?.id === p.id);
      const cards = data.events.filter(e => e.type === 'card' && e.player?.id === p.id);
      const subs = data.events.filter(e => e.type === 'sub' && (e.outPlayer?.id === p.id || e.inPlayer?.id === p.id));
      rows.push([
        parseInt(p.number) || p.number,
        p.name,
        p.isGoalkeeper ? 'TW' : (p.isCaptain ? 'C' : ''),
        p.isStarter ? 'Starter' : 'Ersatz',
        goals.map((g: any) => `${g.goalType} ${g.displayTime}`).join(', ') || '',
        cards.map((c: any) => `${c.cardType} ${c.displayTime}`).join(', ') || '',
        subs.map((s: any) => s.outPlayer?.id === p.id ? `Aus ${s.displayTime}` : `Ein ${s.displayTime}`).join(', ') || '',
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:6},{wch:25},{wch:10},{wch:10},{wch:25},{wch:25},{wch:25}];
    return ws;
  };
  XLSX.utils.book_append_sheet(wb, makeTeamSheet(data.homeTeam, data.homePlayers), 'Heim');
  XLSX.utils.book_append_sheet(wb, makeTeamSheet(data.awayTeam, data.awayPlayers), 'Gast');

  // Sheet 4: Events
  const evRows: any[][] = [
    ['Spielverlauf'],
    ['HZ', 'Minute', 'Typ', 'Details', 'Mannschaft'],
  ];
  data.events.filter(e => e.type !== 'info').forEach(ev => {
    const team = ev.team === 'home' ? data.homeTeam : data.awayTeam;
    let details = '';
    if (ev.type === 'goal') details = `${ev.goalType}: ${ev.player?.number} ${ev.player?.name}`;
    if (ev.type === 'card') details = `${ev.cardType}: ${ev.player?.number} ${ev.player?.name}`;
    if (ev.type === 'sub') details = `${ev.outPlayer?.number} ${ev.outPlayer?.name} > ${ev.inPlayer?.number} ${ev.inPlayer?.name}`;
    evRows.push([`${ev.half}. HZ`, ev.displayTime || '', ev.type === 'goal' ? 'Tor' : ev.type === 'card' ? 'Karte' : 'Wechsel', details, team]);
  });
  const ws4 = XLSX.utils.aoa_to_sheet(evRows);
  ws4['!cols'] = [{wch:8},{wch:10},{wch:10},{wch:45},{wch:25}];
  XLSX.utils.book_append_sheet(wb, ws4, 'Spielverlauf');

  // Write as buffer
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return new Uint8Array(out);
}
