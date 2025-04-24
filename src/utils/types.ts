export type PlayerWithMetadata = {
  id: string;
  metadata: PlayerMetadata;
}

export type PlayerMetadata = {
  skill: number;
  region: string;
  playStyle: string;
  latency: number;
  inputDevice: string;
  toxicity: string;
  favoriteWeapon: string;
}