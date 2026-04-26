import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export function generatePDF(data: ExportData): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = 15;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Spielbericht', w / 2, y, { align: 'center' });
  y += 12;

  // Score
  doc.setFontSize(24);
  doc.text(`${data.homeTeam}  ${data.homeScore} : ${data.awayScore}  ${data.awayTeam}`, w / 2, y, { align: 'center' });
  y += 8;

  if (data.htHomeScore !== null) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Halbzeit: ${data.htHomeScore} : ${data.htAwayScore}`, w / 2, y, { align: 'center' });
    y += 8;
  }

  // Line
  doc.setLineWidth(0.5);
  doc.line(15, y, w - 15, y);
  y += 8;

  // Lineups side by side
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Aufstellung', 15, y);
  y += 6;

  const halfW = (w - 30) / 2;

  // Home team
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(data.homeTeam, 15, y);
  doc.text(data.awayTeam, 15 + halfW + 10, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const homeStarters = data.homePlayers.filter(p => p.isStarter);
  const homeSubs = data.homePlayers.filter(p => !p.isStarter);
  const awayStarters = data.awayPlayers.filter(p => p.isStarter);
  const awaySubs = data.awayPlayers.filter(p => !p.isStarter);

  const maxRows = Math.max(homeStarters.length + homeSubs.length + 1, awayStarters.length + awaySubs.length + 1);

  const playerLine = (p: any) => {
    let line = `${p.number} ${p.name}`;
    if (p.isGoalkeeper) line += ' (TW)';
    if (p.isCaptain) line += ' (C)';
    // Add event icons
    const goals = data.events.filter(e => e.type === 'goal' && e.player?.id === p.id);
    const cards = data.events.filter(e => e.type === 'card' && e.player?.id === p.id);
    const subsOut = data.events.filter(e => e.type === 'sub' && e.outPlayer?.id === p.id);
    const subsIn = data.events.filter(e => e.type === 'sub' && e.inPlayer?.id === p.id);
    goals.forEach(g => line += ` [Tor ${g.displayTime}]`);
    cards.forEach(c => line += ` [${c.cardType} ${c.displayTime}]`);
    subsOut.forEach(s => line += ` [Aus ${s.displayTime}]`);
    subsIn.forEach(s => line += ` [Ein ${s.displayTime}]`);
    return line;
  };

  homeStarters.forEach(p => { doc.text(playerLine(p), 15, y); y += 4; });
  if (homeSubs.length) { doc.setFont('helvetica', 'italic'); doc.text('Ersatz:', 15, y); doc.setFont('helvetica', 'normal'); y += 4; }
  homeSubs.forEach(p => { doc.text(playerLine(p), 15, y); y += 4; });

  // Reset y for away team
  let yAway = y - (homeStarters.length + homeSubs.length + (homeSubs.length ? 1 : 0)) * 4;
  awayStarters.forEach(p => { doc.text(playerLine(p), 15 + halfW + 10, yAway); yAway += 4; });
  if (awaySubs.length) { doc.setFont('helvetica', 'italic'); doc.text('Ersatz:', 15 + halfW + 10, yAway); doc.setFont('helvetica', 'normal'); yAway += 4; }
  awaySubs.forEach(p => { doc.text(playerLine(p), 15 + halfW + 10, yAway); yAway += 4; });

  y = Math.max(y, yAway) + 6;

  // Events table
  doc.setLineWidth(0.5);
  doc.line(15, y, w - 15, y);
  y += 6;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Spielverlauf', 15, y);
  y += 4;

  const gameEvents = data.events.filter(e => e.type !== 'info');
  const hz1 = gameEvents.filter(e => e.half === 1);
  const hz2 = gameEvents.filter(e => e.half === 2);

  const eventToRow = (ev: any) => {
    const team = ev.team === 'home' ? data.homeTeam : data.awayTeam;
    if (ev.type === 'goal') return [ev.displayTime, `Tor${ev.goalType !== 'Tor' ? ` (${ev.goalType})` : ''}: ${ev.player.number} ${ev.player.name}`, team];
    if (ev.type === 'card') return [ev.displayTime, `${ev.cardType}: ${ev.player.number} ${ev.player.name}`, team];
    if (ev.type === 'sub') return [ev.displayTime, `Wechsel: ${ev.outPlayer.number} ${ev.outPlayer.name} -> ${ev.inPlayer.number} ${ev.inPlayer.name}`, team];
    return [ev.displayTime, ev.text || '', ''];
  };

  if (hz1.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    y += 2;
    doc.text('1. Halbzeit', 15, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Min.', 'Aktion', 'Mannschaft']],
      body: hz1.map(eventToRow),
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 45 } },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  if (hz2.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Halbzeit', 15, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [['Min.', 'Aktion', 'Mannschaft']],
      body: hz2.map(eventToRow),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 45 } },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  if (gameEvents.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Keine Aktionen erfasst.', 15, y + 4);
    y += 10;
  }

  // Notes
  if (data.notes) {
    y += 4;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Bemerkungen', 15, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(data.notes, w - 30);
    doc.text(lines, 15, y);
    y += lines.length * 4;
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text('Erstellt mit Matchreport App', w / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  return doc.output('datauristring');
}
