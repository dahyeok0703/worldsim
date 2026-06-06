export type StatKey = 'STR' | 'AGI' | 'VIT' | 'PER' | 'WIL';
export interface Stats { STR: number; AGI: number; VIT: number; PER: number; WIL: number; }

export const STAT_LABEL: Record<StatKey, string> = {
  STR: '힘', AGI: '민첩', VIT: '체력', PER: '감각', WIL: '정신',
};
export const STAT_DESC: Record<StatKey, string> = {
  STR: '근접 공격력·완력',
  AGI: '회피·도주·은신',
  VIT: '최대 HP·피해 감소',
  PER: '치명타·수색 효율·위험 감지',
  WIL: '최대 정신력·공포 저항',
};

export type ItemType = 'food' | 'water' | 'med' | 'material' | 'weapon' | 'tool';
export interface ItemDef {
  id: string; name: string; type: ItemType; desc: string;
  food?: number; water?: number; hp?: number; sanity?: number;
  cureInfection?: number; atk?: number;
}

export interface Recipe { id: string; name: string; out: string; outQty: number; inputs: { id: string; qty: number }[]; needTool?: string; desc: string; }

export type SpotType =
  | 'residential' | 'mart' | 'pharmacy' | 'hospital' | 'military' | 'police'
  | 'station' | 'park' | 'industrial' | 'school' | 'gas' | 'downtown'
  | 'gov' | 'airport' | 'port' | 'lab';

export interface Spot {
  id: string;
  regionId: string;
  name: string;
  type: SpotType;
  zombies: number;
  looted: number; // 0~100 (남은 물자 %는 100-looted 개념)
  secured: boolean; // 거점화 여부
  discovered: boolean;
}

export interface Region {
  id: string;
  name: string;
  neighbors: string[];
  overseas?: boolean;
  infestation: number; // 0~100
  spots: Spot[];
}

export interface Player {
  name: string;
  level: number; exp: number; statPoints: number;
  stats: Stats;
  hp: number; sanity: number;
  food: number; water: number; energy: number; infection: number;
  skills: string[];
  inv: Record<string, number>; // itemId -> qty
  equipped?: string;
  locationId: string;
  baseId?: string;
  day: number; hour: number;
  killed: number;
  flags: Record<string, boolean | number | string>;
}

export type Phase = 'title' | 'create' | 'play' | 'dead';

export interface GameState {
  phase: Phase;
  player: Player;
  regions: Record<string, Region>;
  log: string[];
  pending?: PendingEvent; // 선택이 필요한 이벤트
}

export interface EventChoice { label: string; }
export interface PendingEvent {
  title: string;
  text: string;
  choices: { label: string; key: string }[];
}
