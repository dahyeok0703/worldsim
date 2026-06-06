import { Character, PositionId, StatKey } from '../types';

export const POSITION_LABEL: Record<PositionId, string> = {
  none: '정치 신인', local_member: '지방의원', local_head: '지방자치단체장',
  assembly_member: '국회의원', party_leader: '당대표', minister: '국무위원(장관)',
  pm: '국무총리', president: '대통령',
};

// 피선거권/임명 최소 연령
export const AGE_MIN = {
  president: 40, assembly: 18, local: 18,
} as const;

export const ageOf = (birthYear: number, year: number) => year - birthYear;

export function canRunPresident(c: Character, year: number) { return ageOf(c.birthYear, year) >= AGE_MIN.president; }
export function canRunAssembly(c: Character, year: number) { return ageOf(c.birthYear, year) >= AGE_MIN.assembly; }
export function canRunLocal(c: Character, year: number) { return ageOf(c.birthYear, year) >= AGE_MIN.local; }

export const EDUCATIONS = ['고졸', '전문대', '4년제 대학', '명문대(SKY)', '해외 유학', '대학원·박사'];
export const CAREERS = [
  '법조인(검사/판사/변호사)', '관료/고위공무원', '시민운동/노동운동', '기업인',
  '언론인', '학자/교수', '군 출신', '의사/전문직', '보좌관/당직자',
];

const EDU_FX: Record<string, Partial<Record<StatKey, number>>> = {
  '고졸': { affinity: 8, policy: -5 },
  '전문대': { affinity: 4 },
  '4년제 대학': { policy: 4 },
  '명문대(SKY)': { policy: 8, negotiation: 4, affinity: -4 },
  '해외 유학': { policy: 6, oratory: 3, affinity: -3 },
  '대학원·박사': { policy: 10, affinity: -4 },
};
const CAREER_FX: Record<string, Partial<Record<StatKey, number>>> = {
  '법조인(검사/판사/변호사)': { negotiation: 8, policy: 6, affinity: -6, integrity: 2 },
  '관료/고위공무원': { admin: 12, policy: 4, affinity: -3 },
  '시민운동/노동운동': { organization: 8, affinity: 5, integrity: 4 },
  '기업인': { funding: 12, organization: 4, affinity: -4 },
  '언론인': { oratory: 8, instinct: 6 },
  '학자/교수': { policy: 12, oratory: 3 },
  '군 출신': { admin: 5, organization: 4, negotiation: 2 },
  '의사/전문직': { integrity: 6, policy: 4 },
  '보좌관/당직자': { instinct: 12, organization: 5, negotiation: 4 },
};
const CAREER_SPECTRUM: Record<string, number> = {
  '기업인': 1.5, '군 출신': 2, '법조인(검사/판사/변호사)': 0.5,
  '시민운동/노동운동': -2.5, '학자/교수': -0.5,
};

const ALL_STATS: StatKey[] = ['oratory', 'policy', 'negotiation', 'admin', 'affinity', 'organization', 'funding', 'instinct', 'integrity'];

export function computeStats(edu: string, careers: string[], politicalFamily: boolean, selfMade: boolean): Record<StatKey, number> {
  const s = {} as Record<StatKey, number>;
  for (const k of ALL_STATS) s[k] = 45;
  const apply = (fx?: Partial<Record<StatKey, number>>) => { if (fx) for (const [k, v] of Object.entries(fx)) s[k as StatKey] += v as number; };
  apply(EDU_FX[edu]);
  for (const c of careers) apply(CAREER_FX[c]);
  if (politicalFamily) { s.organization += 8; s.funding += 6; s.instinct += 4; }
  if (selfMade) { s.affinity += 8; s.integrity += 3; }
  for (const k of ALL_STATS) s[k] = Math.max(10, Math.min(95, Math.round(s[k])));
  return s;
}

export function spectrumFromAxes(econ: number, social: number, security: number, careers: string[]): number {
  let base = (econ + social + security) / 3;
  for (const c of careers) base += CAREER_SPECTRUM[c] ?? 0;
  return Math.max(-10, Math.min(10, +base.toFixed(1)));
}

// 정당 궁합도 0~100
export function partyAffinity(spectrum: number, partySpectrum: number): number {
  return Math.max(0, Math.round(100 - Math.abs(spectrum - partySpectrum) * 7));
}
