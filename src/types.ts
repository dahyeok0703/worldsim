export interface Party {
  id: string; // 정식명칭을 키로 사용
  name: string;
  short: string;
  color: string;
  spectrum: number; // -10(진보) ~ +10(보수)
}

export type PartisanLean = Record<string, number>;

export interface Demographics {
  genderRatio: { male: number; female: number };
  ageRatio: { a2030: number; a4050: number; a6070: number };
  classRatio: { working: number; middle: number; upper: number };
}

export interface District {
  code: string;
  name: string;
  provinceCode: string;
  provinceName: string;
  electorate: number;
  demographics: Demographics;
  baseLean: PartisanLean;
}

export type StatKey =
  | 'oratory' | 'policy' | 'negotiation' | 'admin' | 'affinity'
  | 'organization' | 'funding' | 'instinct' | 'integrity';

export const STAT_LABEL: Record<StatKey, string> = {
  oratory: '연설력', policy: '정책역량', negotiation: '협상력', admin: '행정력',
  affinity: '친화력', organization: '조직력', funding: '자금력', instinct: '정치감각',
  integrity: '청렴도',
};

export type PositionId =
  | 'none' | 'local_member' | 'local_head' | 'assembly_member'
  | 'party_leader' | 'minister' | 'pm' | 'president';

export interface Character {
  name: string;
  gender: 'male' | 'female';
  birthYear: number;
  originProvince: string; // provinceCode
  education: string;
  careers: string[];
  spouse: boolean;
  children: number;
  politicalFamily: boolean;
  selfMade: boolean;
  // 세부 성향 (-10 좌 ~ +10 우)
  axisEcon: number;
  axisSocial: number;
  axisSecurity: number;
  partyId: string;
  stats: Record<StatKey, number>;
  spectrum: number;
}

export interface Approval {
  national: number;
  byProvince: Record<string, number>;
  byGroup: {
    male: number; female: number;
    a2030: number; a4050: number; a6070: number;
    working: number; middle: number; upper: number;
  };
}

export interface ImageAxis {
  integrity: number; reform: number; stability: number; populism: number;
}

export interface Politician {
  id: string;
  name: string;
  partyId: string;
  spectrum: number;
  power: number; // 종합 역량 0~100
  province: string;
}

export interface DistrictResult {
  code: string;
  winner: string;
  parties: { id: string; votes: number; pct: number }[];
  turnout: number;
  total: number;
}
export interface ProvinceResult {
  code: string;
  winner: string;
  parties: { id: string; votes: number; pct: number }[];
}
export interface NationalPartyResult {
  id: string; votes: number; pct: number; seatsLocal: number; seatsPL: number; seats: number;
}
export interface ElectionResult {
  type: ElectionType;
  year: number;
  districts: Record<string, DistrictResult>;
  provinces: Record<string, ProvinceResult>;
  national: NationalPartyResult[];
  totalLocal: number;
  totalPL: number;
  playerWon?: boolean;
  playerDistrict?: string;
  winnerPartyId?: string; // 대선 등 단일 결과
}

export type ElectionType = 'president' | 'assembly' | 'local';

export interface CareerEvent { year: number; text: string; }
