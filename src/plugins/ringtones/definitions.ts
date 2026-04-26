export interface RingtonesPlugin {
  list(options?: { type?: string }): Promise<{ ringtones: { title: string; uri: string }[] }>;
  play(options: { uri: string }): Promise<void>;
  stop(): Promise<void>;
  pick(options?: { type?: string; title?: string; existingUri?: string }): Promise<{ uri: string | null; cancelled: boolean }>;
  getDefault(options?: { type?: string }): Promise<{ uri: string | null }>;
}
