import { Demographics, District, PartisanLean } from '../types';
import { DISTRICTS } from './districts';

// ── 시드 RNG (코드 기반 재현성) ──
export function hashCode(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── 인구통계 보정치 (시드값, 밸런싱용) ──
export const DEMO_MODIFIERS: { [axis: string]: { [group: string]: PartisanLean } } = {
  gender: {
    male: { 더불어민주당: -6, 국민의힘: +6, 개혁신당: +3 },
    female: { 더불어민주당: +6, 국민의힘: -6, 여성의당: +4, 정의당: +1 },
  },
  age: {
    a2030: { 국민의힘: +5, 개혁신당: +5, 더불어민주당: -3 },
    a4050: { 더불어민주당: +8, 국민의힘: -6, 조국혁신당: +2 },
    a6070: { 국민의힘: +10, 더불어민주당: -7 },
  },
  class: {
    working: { 더불어민주당: +3, 진보당: +2, 기본소득당: +1 },
    middle: { 더불어민주당: +1, 국민의힘: +1 },
    upper: { 국민의힘: +5, 더불어민주당: -2 },
  },
};

// ── 광역 2당 기본 성향 [민주, 국힘] ──
const TWO: Record<string, [number, number]> = {
  '11': [49, 36], '21': [33, 52], '22': [16, 66], '23': [48, 37], '24': [70, 10],
  '25': [42, 39], '26': [34, 50], '29': [48, 35], '31': [49, 36], '32': [35, 50],
  '33': [39, 42], '34': [39, 42], '35': [67, 12], '36': [68, 11], '37': [17, 64],
  '38': [34, 51], '39': [45, 38],
};
const MINOR_BASE: PartisanLean = {
  개혁신당: 6, 조국혁신당: 5, 정의당: 3, 진보당: 2, 기본소득당: 1.5,
  사회민주당: 1.5, 자유와혁신: 2, 여성의당: 1,
};
const HONAM = ['24', '35', '36'];
const METRO = ['11', '23', '31'];

function provinceBaseLean(pc: string): PartisanLean {
  const [dem, ppp] = TWO[pc] ?? [40, 40];
  const o: PartisanLean = { 더불어민주당: dem, 국민의힘: ppp, ...MINOR_BASE };
  if (HONAM.includes(pc)) { o.조국혁신당 += 5; o.진보당 += 2; }
  if (METRO.includes(pc)) { o.개혁신당 += 2; }
  return o;
}

const GANGNAM3 = ['강남구', '서초구', '송파구'];

function districtDemographics(code: string, name: string): Demographics {
  const rnd = mulberry32(hashCode(code));
  const gu = name.endsWith('구'), gun = name.endsWith('군');
  const male = 0.485 + rnd() * 0.03;
  let a2030: number, a4050: number, a6070: number;
  if (gu) { [a2030, a4050, a6070] = [0.34, 0.40, 0.26]; }
  else if (gun) { [a2030, a4050, a6070] = [0.16, 0.34, 0.50]; }
  else { [a2030, a4050, a6070] = [0.26, 0.40, 0.34]; }
  a2030 += (rnd() - 0.5) * 0.06; a6070 += (rnd() - 0.5) * 0.06;
  const aSum = a2030 + a4050 + a6070;
  let working: number, middle: number, upper: number;
  const gangnam3 = code.startsWith('11') && GANGNAM3.includes(name);
  if (gangnam3) { [working, middle, upper] = [0.15, 0.55, 0.30]; }
  else if (gu) { [working, middle, upper] = [0.40, 0.48, 0.12]; }
  else if (gun) { [working, middle, upper] = [0.58, 0.37, 0.05]; }
  else { [working, middle, upper] = [0.48, 0.45, 0.07]; }
  const cSum = working + middle + upper;
  return {
    genderRatio: { male, female: 1 - male },
    ageRatio: { a2030: a2030 / aSum, a4050: a4050 / aSum, a6070: a6070 / aSum },
    classRatio: { working: working / cSum, middle: middle / cSum, upper: upper / cSum },
  };
}

function districtBaseLean(code: string, name: string): PartisanLean {
  const pc = code.slice(0, 2);
  const lean = provinceBaseLean(pc);
  const rnd = mulberry32(hashCode(code + 'lean'));
  if (pc === '11' && GANGNAM3.includes(name)) { lean.국민의힘 += 14; lean.더불어민주당 -= 10; }
  if (name.endsWith('군')) { lean.국민의힘 += 6; lean.더불어민주당 -= 4; }
  for (const k of Object.keys(lean)) lean[k] = Math.max(0, lean[k] + (rnd() - 0.5) * 4);
  return lean;
}

export function demographicShift(demo: Demographics, partyId: string): number {
  let s = 0;
  const g = DEMO_MODIFIERS.gender;
  s += demo.genderRatio.male * (g.male[partyId] ?? 0) + demo.genderRatio.female * (g.female[partyId] ?? 0);
  const a = DEMO_MODIFIERS.age;
  s += demo.ageRatio.a2030 * (a.a2030[partyId] ?? 0) + demo.ageRatio.a4050 * (a.a4050[partyId] ?? 0) + demo.ageRatio.a6070 * (a.a6070[partyId] ?? 0);
  const c = DEMO_MODIFIERS.class;
  s += demo.classRatio.working * (c.working[partyId] ?? 0) + demo.classRatio.middle * (c.middle[partyId] ?? 0) + demo.classRatio.upper * (c.upper[partyId] ?? 0);
  return s;
}

// ── 전체 시군구(풀 데이터) 빌드 (1회 계산) ──
let _districts: District[] | null = null;
export function getDistricts(): District[] {
  if (_districts) return _districts;
  _districts = DISTRICTS.map((d) => ({
    ...d,
    demographics: districtDemographics(d.code, d.name),
    baseLean: districtBaseLean(d.code, d.name),
  }));
  return _districts;
}
export function getDistrictMap(): Record<string, District> {
  const m: Record<string, District> = {};
  for (const d of getDistricts()) m[d.code] = d;
  return m;
}
