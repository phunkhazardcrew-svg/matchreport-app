import * as XLSX from 'xlsx';

interface ExportData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  htHomeScore: number | null;
  htAwayScore: number | null;
  homePlayers: any[];
  awayPlayers: any[];
  events: any[];
  notes: string;
  halfDuration: number;
}

export function generateXLS(data: ExportData): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Match Overview
  const overviewData = [
    ['SPIELBERICHT'],
    [],
    ['Heimmannschaft', data.homeTeam],
    ['Gastmannschaft', data.awayTeam],
    ['Endergebnis', `${data.homeScore} : ${data.awayScore}`],
    ...(data.htHomeScore !== null ? [['Halbzeitergebnis', `${data.htHomeScore} : ${data.htAwayScore}`]] : []),
    ['Halbzeitdauer', `${data.halfDuration} min`],
    [],
    ...(data.notes ? [['Bemerkungen', data.notes]] : []),
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview['!cols'] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Übersicht');

  // Sheet 2: Home Team
  const homeData = [
    [data.homeTeam],
    ['Nr', 'Name', 'Position', 'Status', 'Tore', 'Karten', 'Wechsel'],
    ...data.homePlayers.map(p => {
      const goals = data.events.filter(e => e.type === 'goal' && e.player?.id === p.id);
      const cards = data.events.filter(e => e.type === 'card' && e.player?.id === p.id);
      const subs = data.events.filter(e => e.type === 'sub' && (e.outPlayer?.id === p.id || e.inPlayer?.id === p.id));
      return [
        p.number,
        p.name,
        p.isGoalkeeper ? 'TW' : (p.isCaptain ? 'C' : ''),
        p.isStarter ? 'Starter' : 'Ersatz',
        goals.map((g: any) => `${g.goalType} ${g.displayTime}`).join(', '),
        cards.map((c: any) => `${c.cardType} ${c.displayTime}`).join(', '),
        subs.map((s: any) => {
          if (s.outPlayer?.id === p.id) return `Aus ${s.displayTime}`;
          return `Ein ${s.displayTime}`;
        }).join(', '),
      ];
    }),
  ];
  const wsHome = XLSX.utils.aoa_to_sheet(homeData);
  wsHome['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsHome, data.homeTeam.substring(0, 30));

  // Sheet 3: Away Team
  const awayData = [
    [data.awayTeam],
    ['Nr', 'Name', 'Position', 'Status', 'Tore', 'Karten', 'Wechsel'],
    ...data.awayPlayers.map(p => {
      const goals = data.events.filter(e => e.type === 'goal' && e.player?.id === p.id);
      const cards = data.events.filter(e => e.type === 'card' && e.player?.id === p.id);
      const subs = data.events.filter(e => e.type === 'sub' && (e.outPlayer?.id === p.id || e.inPlayer?.id === p.id));
      return [
        p.number,
        p.name,
        p.isGoalkeeper ? 'TW' : (p.isCaptain ? 'C' : ''),
        p.isStarter ? 'Starter' : 'Ersatz',
        goals.map((g: any) => `${g.goalType} ${g.displayTime}`).join(', '),
        cards.map((c: any) => `${c.cardType} ${c.displayTime}`).join(', '),
        subs.map((s: any) => {
          if (s.outPlayer?.id === p.id) return `Aus ${s.displayTime}`;
          return `Ein ${s.displayTime}`;
        }).join(', '),
      ];
    }),
  ];
  const wsAway = XLSX.utils.aoa_to_sheet(awayData);
  wsAway['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsAway, data.awayTeam.substring(0, 30));

  // Sheet 4: Events
  const eventsData = [
    ['Spielverlauf'],
    ['Halbzeit', 'Minute', 'Typ', 'Details', 'Mannschaft'],
    ...data.events.filter(e => e.type !== 'info').map(ev => {
      const team = ev.team === 'home' ? data.homeTeam : data.awayTeam;
      let details = '';
      if (ev.type === 'goal') details = `${ev.goalType}: ${ev.player.number} ${ev.player.name}`;
      if (ev.type === 'card') details = `${ev.cardType}: ${ev.player.number} ${ev.player.name}`;
      if (ev.type === 'sub') details = `${ev.outPlayer.number} ${ev.outPlayer.name} → ${ev.inPlayer.number} ${ev.inPlayer.name}`;
      return [
        `${ev.half}. HZ`,
        ev.displayTime,
        ev.type === 'goal' ? 'Tor' : ev.type === 'card' ? 'Karte' : 'Wechsel',
        details,
        team,
      ];
    }),
  ];
  const wsEvents = XLSX.utils.aoa_to_sheet(eventsData);
  wsEvents['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 45 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsEvents, 'Spielverlauf');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
}
