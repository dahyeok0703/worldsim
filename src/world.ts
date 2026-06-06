import { ItemDef, Recipe, Region, Spot, SpotType } from './types';

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const rint = (a: number, b: number) => Math.floor(rnd(a, b + 1));
export const pick = <T,>(arr: T[]): T => arr[rint(0, arr.length - 1)];
export const chance = (p: number) => Math.random() < p;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
let _id = 0;
export const uid = (p = 'id') => `${p}-${(_id++).toString(36)}-${Date.now().toString(36).slice(-4)}`;

// ── 아이템 ──────────────────────────────────────────
export const ITEMS: Record<string, ItemDef> = {
  rice: { id: 'rice', name: '즉석밥', type: 'food', desc: '포만감 +35', food: 35 },
  canned: { id: 'canned', name: '통조림', type: 'food', desc: '포만감 +28', food: 28 },
  ramen: { id: 'ramen', name: '라면', type: 'food', desc: '포만감 +22', food: 22 },
  snack: { id: 'snack', name: '과자', type: 'food', desc: '포만감 +12, 정신 +4', food: 12, sanity: 4 },
  bar: { id: 'bar', name: '에너지바', type: 'food', desc: '포만감 +16', food: 16 },
  water: { id: 'water', name: '생수', type: 'water', desc: '수분 +35', water: 35 },
  drink: { id: 'drink', name: '음료수', type: 'water', desc: '수분 +25, 정신 +3', water: 25, sanity: 3 },
  soju: { id: 'soju', name: '소주', type: 'water', desc: '수분 +8, 정신 +10 (취함)', water: 8, sanity: 10 },
  bandage: { id: 'bandage', name: '붕대', type: 'med', desc: 'HP +25', hp: 25 },
  painkiller: { id: 'painkiller', name: '진통제', type: 'med', desc: 'HP +12, 정신 +6', hp: 12, sanity: 6 },
  antibiotic: { id: 'antibiotic', name: '항생제', type: 'med', desc: '감염도 -40', cureInfection: 40 },
  medkit: { id: 'medkit', name: '구급킷', type: 'med', desc: 'HP +60, 감염도 -15', hp: 60, cureInfection: 15 },
  sedative: { id: 'sedative', name: '안정제', type: 'med', desc: '정신 +35', sanity: 35 },
  cloth: { id: 'cloth', name: '천 조각', type: 'material', desc: '제작 재료', },
  wood: { id: 'wood', name: '목재', type: 'material', desc: '제작 재료' },
  scrap: { id: 'scrap', name: '고철', type: 'material', desc: '제작 재료' },
  tape: { id: 'tape', name: '접착테이프', type: 'material', desc: '제작 재료' },
  fuel: { id: 'fuel', name: '연료', type: 'material', desc: '차량·해외 이동에 필요' },
  knife: { id: 'knife', name: '주머니칼', type: 'weapon', desc: '공격 +2', atk: 2 },
  bat: { id: 'bat', name: '야구방망이', type: 'weapon', desc: '공격 +6', atk: 6 },
  pipe: { id: 'pipe', name: '쇠파이프', type: 'weapon', desc: '공격 +8', atk: 8 },
  machete: { id: 'machete', name: '마체테', type: 'weapon', desc: '공격 +11', atk: 11 },
  axe: { id: 'axe', name: '소방도끼', type: 'weapon', desc: '공격 +14', atk: 14 },
  lighter: { id: 'lighter', name: '라이터', type: 'tool', desc: '화염병 제작에 필요' },
  flashlight: { id: 'flashlight', name: '손전등', type: 'tool', desc: '야간 위험 감소' },
  map: { id: 'map', name: '지도', type: 'tool', desc: '지역 정보 정확도 상승' },
  molotov: { id: 'molotov', name: '화염병', type: 'weapon', desc: '교전 시 다수 처치(1회용)', atk: 0 },
};

export const RECIPES: Recipe[] = [
  { id: 'r_bandage', name: '붕대', out: 'bandage', outQty: 2, inputs: [{ id: 'cloth', qty: 2 }], desc: '천으로 붕대를 만든다' },
  { id: 'r_molotov', name: '화염병', out: 'molotov', outQty: 1, inputs: [{ id: 'soju', qty: 1 }, { id: 'cloth', qty: 1 }], needTool: 'lighter', desc: '소주+천+라이터' },
  { id: 'r_pipe', name: '쇠파이프', out: 'pipe', outQty: 1, inputs: [{ id: 'scrap', qty: 3 }], desc: '고철을 벼려 둔기를 만든다' },
];

// ── 장소 유형 ───────────────────────────────────────
interface SpotTypeDef {
  label: string; danger: number; zMin: number; zMax: number;
  loot: { id: string; q: [number, number]; c: number }[];
}
export const SPOT_TYPES: Record<SpotType, SpotTypeDef> = {
  residential: { label: '주택가', danger: 1, zMin: 1, zMax: 5, loot: [
    { id: 'rice', q: [1, 2], c: .6 }, { id: 'water', q: [1, 3], c: .6 }, { id: 'cloth', q: [1, 3], c: .7 },
    { id: 'painkiller', q: [1, 1], c: .3 }, { id: 'knife', q: [1, 1], c: .15 }, { id: 'snack', q: [1, 2], c: .4 }] },
  mart: { label: '대형마트', danger: 2, zMin: 2, zMax: 8, loot: [
    { id: 'canned', q: [1, 3], c: .8 }, { id: 'water', q: [2, 4], c: .8 }, { id: 'ramen', q: [1, 3], c: .7 },
    { id: 'snack', q: [1, 3], c: .7 }, { id: 'soju', q: [1, 2], c: .5 }, { id: 'bat', q: [1, 1], c: .2 } ] },
  pharmacy: { label: '약국', danger: 2, zMin: 1, zMax: 5, loot: [
    { id: 'bandage', q: [1, 3], c: .8 }, { id: 'painkiller', q: [1, 2], c: .7 }, { id: 'antibiotic', q: [1, 2], c: .5 },
    { id: 'sedative', q: [1, 2], c: .4 }, { id: 'medkit', q: [1, 1], c: .2 } ] },
  hospital: { label: '종합병원', danger: 4, zMin: 6, zMax: 16, loot: [
    { id: 'medkit', q: [1, 2], c: .6 }, { id: 'antibiotic', q: [1, 3], c: .7 }, { id: 'bandage', q: [2, 4], c: .8 },
    { id: 'sedative', q: [1, 2], c: .5 } ] },
  military: { label: '군부대', danger: 5, zMin: 8, zMax: 22, loot: [
    { id: 'axe', q: [1, 1], c: .3 }, { id: 'machete', q: [1, 1], c: .3 }, { id: 'fuel', q: [2, 4], c: .7 },
    { id: 'scrap', q: [2, 5], c: .7 }, { id: 'medkit', q: [1, 2], c: .4 }, { id: 'canned', q: [2, 4], c: .6 } ] },
  police: { label: '경찰서', danger: 4, zMin: 4, zMax: 12, loot: [
    { id: 'bat', q: [1, 1], c: .4 }, { id: 'machete', q: [1, 1], c: .2 }, { id: 'scrap', q: [1, 3], c: .6 },
    { id: 'flashlight', q: [1, 1], c: .4 } ] },
  station: { label: '역·지하철', danger: 2, zMin: 3, zMax: 10, loot: [
    { id: 'snack', q: [1, 3], c: .6 }, { id: 'water', q: [1, 3], c: .6 }, { id: 'scrap', q: [1, 2], c: .5 }, { id: 'map', q: [1, 1], c: .3 } ] },
  park: { label: '공원·하천', danger: 1, zMin: 0, zMax: 4, loot: [
    { id: 'water', q: [1, 2], c: .5 }, { id: 'cloth', q: [1, 2], c: .5 }, { id: 'wood', q: [1, 3], c: .7 } ] },
  industrial: { label: '공장·물류', danger: 3, zMin: 3, zMax: 12, loot: [
    { id: 'scrap', q: [2, 5], c: .8 }, { id: 'wood', q: [2, 4], c: .7 }, { id: 'fuel', q: [1, 3], c: .6 },
    { id: 'pipe', q: [1, 1], c: .3 }, { id: 'tape', q: [1, 2], c: .6 } ] },
  school: { label: '학교', danger: 2, zMin: 2, zMax: 9, loot: [
    { id: 'water', q: [1, 3], c: .6 }, { id: 'snack', q: [1, 2], c: .5 }, { id: 'bat', q: [1, 1], c: .3 }, { id: 'cloth', q: [1, 2], c: .5 } ] },
  gas: { label: '주유소', danger: 2, zMin: 1, zMax: 6, loot: [
    { id: 'fuel', q: [2, 5], c: .85 }, { id: 'snack', q: [1, 2], c: .5 }, { id: 'lighter', q: [1, 1], c: .5 } ] },
  downtown: { label: '번화가', danger: 3, zMin: 4, zMax: 14, loot: [
    { id: 'snack', q: [1, 3], c: .6 }, { id: 'soju', q: [1, 3], c: .6 }, { id: 'canned', q: [1, 2], c: .5 },
    { id: 'machete', q: [1, 1], c: .15 }, { id: 'drink', q: [1, 3], c: .6 } ] },
  gov: { label: '관공서', danger: 3, zMin: 2, zMax: 8, loot: [
    { id: 'scrap', q: [1, 3], c: .5 }, { id: 'sedative', q: [1, 1], c: .4 }, { id: 'map', q: [1, 1], c: .4 }, { id: 'tape', q: [1, 2], c: .5 } ] },
  airport: { label: '공항', danger: 3, zMin: 5, zMax: 14, loot: [
    { id: 'fuel', q: [2, 5], c: .7 }, { id: 'canned', q: [2, 4], c: .6 }, { id: 'water', q: [2, 4], c: .6 }, { id: 'map', q: [1, 1], c: .5 } ] },
  port: { label: '항구', danger: 3, zMin: 4, zMax: 12, loot: [
    { id: 'fuel', q: [2, 5], c: .7 }, { id: 'canned', q: [1, 3], c: .6 }, { id: 'scrap', q: [2, 4], c: .6 } ] },
  lab: { label: '연구소', danger: 5, zMin: 12, zMax: 26, loot: [
    { id: 'medkit', q: [2, 3], c: .8 }, { id: 'antibiotic', q: [3, 5], c: .9 } ] },
};

// ── 지리 (실제 한국 17개 시도 + 해외) ────────────────
interface RegionDef { id: string; name: string; neighbors: string[]; overseas?: boolean; spots: { name: string; type: SpotType }[]; }

const KR: RegionDef[] = [
  { id: 'seoul', name: '서울', neighbors: ['gyeonggi', 'incheon'], spots: [
    { name: '강남역 일대', type: 'downtown' }, { name: '명동 거리', type: 'downtown' },
    { name: '서울역', type: 'station' }, { name: '서울대병원', type: 'hospital' },
    { name: '용산 전자상가', type: 'industrial' }, { name: '한강공원', type: 'park' },
    { name: '잠실 대형마트', type: 'mart' }, { name: '종로 약국거리', type: 'pharmacy' },
    { name: '강북 아파트단지', type: 'residential' }, { name: '여의도 국회', type: 'gov' } ] },
  { id: 'incheon', name: '인천', neighbors: ['seoul', 'gyeonggi'], spots: [
    { name: '인천국제공항', type: 'airport' }, { name: '인천항', type: 'port' },
    { name: '부평 시장', type: 'mart' }, { name: '송도 신도시', type: 'residential' },
    { name: '남동공단', type: 'industrial' }, { name: '인천의료원', type: 'hospital' } ] },
  { id: 'gyeonggi', name: '경기', neighbors: ['seoul', 'incheon', 'gangwon', 'chungbuk', 'chungnam'], spots: [
    { name: '수원 화성', type: 'downtown' }, { name: '성남 물류센터', type: 'industrial' },
    { name: '고양 대형마트', type: 'mart' }, { name: '의정부 군부대', type: 'military' },
    { name: '분당 아파트', type: 'residential' }, { name: '용인 휴게소', type: 'gas' } ] },
  { id: 'gangwon', name: '강원', neighbors: ['gyeonggi', 'chungbuk', 'gyeongbuk'], spots: [
    { name: '춘천 시내', type: 'downtown' }, { name: '원주 종합병원', type: 'hospital' },
    { name: '강릉 항구', type: 'port' }, { name: '평창 산간마을', type: 'residential' },
    { name: '속초 수산시장', type: 'mart' } ] },
  { id: 'chungbuk', name: '충북', neighbors: ['gyeonggi', 'gangwon', 'chungnam', 'sejong', 'daejeon', 'gyeongbuk', 'jeonbuk'], spots: [
    { name: '청주 시내', type: 'downtown' }, { name: '오송 바이오단지', type: 'industrial' },
    { name: '충주 군부대', type: 'military' }, { name: '제천 약국', type: 'pharmacy' } ] },
  { id: 'chungnam', name: '충남', neighbors: ['gyeonggi', 'chungbuk', 'sejong', 'daejeon', 'jeonbuk'], spots: [
    { name: '천안 터미널', type: 'station' }, { name: '아산 공단', type: 'industrial' },
    { name: '서산 주유소', type: 'gas' }, { name: '공주 대형마트', type: 'mart' } ] },
  { id: 'sejong', name: '세종', neighbors: ['chungbuk', 'chungnam', 'daejeon'], spots: [
    { name: '정부세종청사', type: 'gov' }, { name: '세종 아파트', type: 'residential' }, { name: '조치원 시장', type: 'mart' } ] },
  { id: 'daejeon', name: '대전', neighbors: ['chungbuk', 'chungnam', 'sejong'], spots: [
    { name: '대전역', type: 'station' }, { name: '둔산 번화가', type: 'downtown' },
    { name: '충남대병원', type: 'hospital' }, { name: '대덕연구단지', type: 'industrial' } ] },
  { id: 'gyeongbuk', name: '경북', neighbors: ['gangwon', 'chungbuk', 'daegu', 'gyeongnam'], spots: [
    { name: '포항 제철소', type: 'industrial' }, { name: '경주 시내', type: 'downtown' },
    { name: '안동 구시가', type: 'residential' }, { name: '구미 공단', type: 'industrial' } ] },
  { id: 'daegu', name: '대구', neighbors: ['gyeongbuk', 'gyeongnam'], spots: [
    { name: '동성로', type: 'downtown' }, { name: '서문시장', type: 'mart' },
    { name: '경북대병원', type: 'hospital' }, { name: '대구역', type: 'station' } ] },
  { id: 'gyeongnam', name: '경남', neighbors: ['gyeongbuk', 'daegu', 'busan', 'ulsan', 'jeonnam'], spots: [
    { name: '창원 공단', type: 'industrial' }, { name: '진주 시내', type: 'downtown' },
    { name: '김해공항', type: 'airport' }, { name: '통영 항구', type: 'port' } ] },
  { id: 'busan', name: '부산', neighbors: ['gyeongnam', 'ulsan'], spots: [
    { name: '서면 번화가', type: 'downtown' }, { name: '부산항', type: 'port' },
    { name: '해운대', type: 'park' }, { name: '부산역', type: 'station' },
    { name: '부산대병원', type: 'hospital' }, { name: '자갈치시장', type: 'mart' } ] },
  { id: 'ulsan', name: '울산', neighbors: ['gyeongnam', 'busan', 'gyeongbuk'], spots: [
    { name: '울산 석유화학단지', type: 'industrial' }, { name: '현대 조선소', type: 'industrial' },
    { name: '태화강', type: 'park' }, { name: '울산 대형마트', type: 'mart' } ] },
  { id: 'jeonbuk', name: '전북', neighbors: ['chungnam', 'chungbuk', 'jeonnam', 'gyeongnam'], spots: [
    { name: '전주 한옥마을', type: 'downtown' }, { name: '군산항', type: 'port' },
    { name: '익산역', type: 'station' }, { name: '전북대병원', type: 'hospital' } ] },
  { id: 'jeonnam', name: '전남', neighbors: ['jeonbuk', 'gyeongnam', 'gwangju'], spots: [
    { name: '여수 산단', type: 'industrial' }, { name: '목포항', type: 'port' },
    { name: '순천만', type: 'park' }, { name: '광양 제철', type: 'industrial' } ] },
  { id: 'gwangju', name: '광주', neighbors: ['jeonnam'], spots: [
    { name: '충장로', type: 'downtown' }, { name: '광주역', type: 'station' },
    { name: '전남대병원', type: 'hospital' }, { name: '광주 대형마트', type: 'mart' } ] },
  { id: 'jeju', name: '제주', neighbors: [], spots: [
    { name: '제주국제공항', type: 'airport' }, { name: '제주항', type: 'port' },
    { name: '제주시 번화가', type: 'downtown' }, { name: '서귀포 마을', type: 'residential' } ] },
];

// 해외 (실제 도시 기반) — 공항/항구를 통해서만 진입
const OVERSEAS: RegionDef[] = [
  { id: 'japan', name: '일본(규슈·간토)', neighbors: [], overseas: true, spots: [
    { name: '후쿠오카 하카타', type: 'downtown' }, { name: '도쿄 신주쿠', type: 'downtown' },
    { name: '나리타 공항', type: 'airport' }, { name: '오사카 대형마트', type: 'mart' } ] },
  { id: 'china', name: '중국(산둥·상하이)', neighbors: [], overseas: true, spots: [
    { name: '칭다오 항구', type: 'port' }, { name: '상하이 푸둥', type: 'downtown' },
    { name: '웨이하이 시장', type: 'mart' }, { name: '산둥 공단', type: 'industrial' } ] },
  { id: 'russia', name: '러시아(연해주)', neighbors: [], overseas: true, spots: [
    { name: '블라디보스토크 항', type: 'port' }, { name: '연해주 군기지', type: 'military' },
    { name: '우수리스크 마을', type: 'residential' } ] },
];

// 해외 항로: 한국 transit spot 지역 → 해외 지역
export const SEA_ROUTES: { from: string; to: string }[] = [
  { from: 'incheon', to: 'china' }, { from: 'busan', to: 'japan' },
  { from: 'gyeongnam', to: 'japan' }, { from: 'gangwon', to: 'russia' },
  { from: 'jeonnam', to: 'china' },
];

export function generateWorld(): Record<string, Region> {
  const regions: Record<string, Region> = {};
  for (const def of [...KR, ...OVERSEAS]) {
    const spots: Spot[] = def.spots.map((s) => {
      const t = SPOT_TYPES[s.type];
      return {
        id: uid('spot'), regionId: def.id, name: s.name, type: s.type,
        zombies: rint(t.zMin, t.zMax), looted: 0, secured: false, discovered: false,
      };
    });
    regions[def.id] = {
      id: def.id, name: def.name, neighbors: def.neighbors, overseas: def.overseas,
      infestation: def.overseas ? rint(50, 80) : rint(20, 55), spots,
    };
  }
  // 백신 연구소를 한국의 무작위 내륙 지역 한 곳에 숨긴다 (소문으로 발견)
  const inland = ['chungbuk', 'daejeon', 'gyeongbuk', 'gangwon'];
  const labRegion = regions[pick(inland)];
  labRegion.spots.push({
    id: uid('spot'), regionId: labRegion.id, name: '국립 감염병연구소',
    type: 'lab', zombies: rint(14, 26), looted: 0, secured: false, discovered: false,
  });
  (labRegion as Region & { hasLab?: boolean }).hasLab = true;
  return regions;
}

export const KR_REGION_IDS = KR.map((r) => r.id);
