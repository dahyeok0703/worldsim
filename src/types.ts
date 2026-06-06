export type StatKey = 'STR' | 'AGI' | 'VIT' | 'PER' | 'WIL';

export interface Stats {
  STR: number; // 힘 — 공격력
  AGI: number; // 민첩 — 회피·도주
  VIT: number; // 체력 — HP·방어
  PER: number; // 감각 — 치명타·명중
  WIL: number; // 정신 — 능력·공포저항
}

export const STAT_LABEL: Record<StatKey, string> = {
  STR: '힘',
  AGI: '민첩',
  VIT: '체력',
  PER: '감각',
  WIL: '정신',
};

export const STAT_DESC: Record<StatKey, string> = {
  STR: '공격력과 완력',
  AGI: '이동 속도·회피·도주 성공률',
  VIT: '최대 HP와 피해 감소',
  PER: '치명타 확률·위험 감지',
  WIL: '최대 정신력·스킬 자원·공포 저항',
};

export interface Skill {
  id: string;
  name: string;
  desc: string;
  cost: number; // 정신력 소모
  type: 'attack' | 'heal' | 'utility' | 'passive';
  unlockLevel: number;
}

export interface Item {
  id: string;
  name: string;
  desc: string;
  type: 'weapon' | 'heal' | 'misc';
  atk?: number; // 무기 공격력
  heal?: number; // 회복량(HP)
  mental?: number; // 정신력 회복
}

export interface Enemy {
  id: string;
  name: string;
  desc: string;
  hp: number;
  atk: number;
  def?: number;
  exp: number;
  dodge?: number; // 적의 회피율(0~1)
  loot?: { item: string; chance: number }[];
  noEat?: boolean; // 포식 불가
  boss?: boolean;
}

export interface Player {
  name: string;
  level: number;
  exp: number;
  hp: number;
  mental: number;
  stats: Stats;
  statPoints: number;
  skills: string[];
  inventory: string[];
  equipped?: string; // 무기 id
  title?: string;
  flags: Record<string, boolean | number>;
}

export interface CombatState {
  enemy: Enemy;
  enemyHp: number;
  turn: number;
  next: string; // 승리 후 이동할 씬
  analyzed: boolean; // 간파 적용 여부
  over: boolean; // 적 처치 완료(계속 버튼 대기)
}

export interface Effect {
  hp?: number;
  mental?: number;
  exp?: number;
  addItem?: string;
  removeItem?: string;
  addSkill?: string;
  statPoints?: number;
  equip?: string;
  title?: string;
  flag?: [string, boolean | number];
}

export interface Requirement {
  stat?: Partial<Stats>;
  item?: string;
  skill?: string;
  flag?: string;
  minLevel?: number;
}

export interface Choice {
  label: string;
  effects?: Effect[];
  combat?: string; // 적 id → 전투 시작
  next?: string; // 이동할 씬
  requires?: Requirement;
  note?: string; // 선택지 보조 설명
}

export interface Scene {
  id: string;
  title?: string;
  text: string;
  onEnter?: Effect[];
  choices: Choice[];
  ending?: 'good' | 'bad' | 'neutral';
}

export type Phase = 'title' | 'create' | 'scene' | 'combat' | 'gameover';

export interface GameState {
  phase: Phase;
  player: Player;
  sceneId: string;
  combat?: CombatState;
  log: string[];
  ending?: 'good' | 'bad' | 'neutral';
}
