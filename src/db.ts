import Dexie, { type EntityTable } from 'dexie';

export interface Team {
  id: string; name: string; players: Player[]; createdAt: number;
}
export interface Player {
  number: string; name: string; isGoalkeeper: boolean; isCaptain: boolean; isStarter: boolean; id: string;
}
export interface Match {
  id: string; homeTeam: string; awayTeam: string;
  homePlayers: Player[]; awayPlayers: Player[];
  homeScore: number; awayScore: number;
  htHomeScore: number | null; htAwayScore: number | null;
  halfDuration: number; playerCount: number;
  events: MatchEvent[]; notes: string;
  status: 'in-progress' | 'finished';
  createdAt: number; updatedAt: number;
}
export interface MatchEvent {
  id: string; type: 'goal' | 'card' | 'sub' | 'info';
  half: number; displayTime: string;
  goalType?: string; cardType?: string;
  player?: Player; outPlayer?: Player; inPlayer?: Player;
  team?: string; text?: string;
}
export interface SoundConfig {
  id: string; // event type: goal, eigentor, elfmeter, yellow, red, sub, halftime, fulltime
  uri: string | null;
  title: string;
}

export const db = new Dexie('MatchreportDB') as Dexie & {
  matches: EntityTable<Match, 'id'>;
  soundConfigs: EntityTable<SoundConfig, 'id'>;
};

db.version(1).stores({
  matches: 'id, status, createdAt',
  soundConfigs: 'id',
});

// Initialize default sound configs
export async function initSoundDefaults() {
  const count = await db.soundConfigs.count();
  if (count === 0) {
    await db.soundConfigs.bulkAdd([
      { id: 'goal', uri: null, title: 'Tor' },
      { id: 'eigentor', uri: null, title: 'Eigentor' },
      { id: 'elfmeter', uri: null, title: 'Elfmeter' },
      { id: 'yellow', uri: null, title: 'Gelbe Karte' },
      { id: 'red', uri: null, title: 'Rote Karte' },
      { id: 'sub', uri: null, title: 'Wechsel' },
      { id: 'halftime', uri: null, title: 'Halbzeit' },
      { id: 'fulltime', uri: null, title: 'Spielende' },
    ]);
  }
}

export async function requestPersistentStorage() {
  if (navigator.storage?.persist) await navigator.storage.persist();
}
