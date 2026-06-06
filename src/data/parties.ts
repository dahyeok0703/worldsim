import { Party } from '../types';

// 정당 + 상징색(근사). 정당명만 실명 사용, 인물은 모두 가상.
export const PARTIES: Party[] = [
  { id: '국민의힘', name: '국민의힘', short: '국힘', color: '#E61E2B', spectrum: 7 },
  { id: '더불어민주당', name: '더불어민주당', short: '민주', color: '#152484', spectrum: -4 },
  { id: '개혁신당', name: '개혁신당', short: '개혁', color: '#FF7210', spectrum: 3 },
  { id: '조국혁신당', name: '조국혁신당', short: '조국', color: '#0073CF', spectrum: -5 },
  { id: '기본소득당', name: '기본소득당', short: '기소', color: '#00D2C3', spectrum: -6 },
  { id: '정의당', name: '정의당', short: '정의', color: '#FFED00', spectrum: -7 },
  { id: '진보당', name: '진보당', short: '진보', color: '#7C0080', spectrum: -9 },
  { id: '사회민주당', name: '사회민주당', short: '사민', color: '#F58220', spectrum: -7 },
  { id: '자유와혁신', name: '자유와혁신', short: '자혁', color: '#1B3A6B', spectrum: 6 },
  { id: '여성의당', name: '여성의당', short: '여성', color: '#A0006D', spectrum: -3 },
  { id: '무소속', name: '무소속', short: '무소속', color: '#888888', spectrum: 0 },
];

export const PARTY_MAP: Record<string, Party> = Object.fromEntries(PARTIES.map((p) => [p.id, p]));
export const MAJOR_PARTY_IDS = PARTIES.filter((p) => p.id !== '무소속').map((p) => p.id);
export const partyColor = (id: string) => PARTY_MAP[id]?.color ?? '#888888';
export const partyShort = (id: string) => PARTY_MAP[id]?.short ?? id;
