export interface ProvinceSeed { code: string; name: string; full: string; }

export const PROVINCES: ProvinceSeed[] = [
  { code: '11', name: '서울', full: '서울특별시' },
  { code: '21', name: '부산', full: '부산광역시' },
  { code: '22', name: '대구', full: '대구광역시' },
  { code: '23', name: '인천', full: '인천광역시' },
  { code: '24', name: '광주', full: '광주광역시' },
  { code: '25', name: '대전', full: '대전광역시' },
  { code: '26', name: '울산', full: '울산광역시' },
  { code: '29', name: '세종', full: '세종특별자치시' },
  { code: '31', name: '경기', full: '경기도' },
  { code: '32', name: '강원', full: '강원도' },
  { code: '33', name: '충북', full: '충청북도' },
  { code: '34', name: '충남', full: '충청남도' },
  { code: '35', name: '전북', full: '전라북도' },
  { code: '36', name: '전남', full: '전라남도' },
  { code: '37', name: '경북', full: '경상북도' },
  { code: '38', name: '경남', full: '경상남도' },
  { code: '39', name: '제주', full: '제주특별자치도' },
];

export const PROVINCE_MAP: Record<string, ProvinceSeed> = Object.fromEntries(PROVINCES.map((p) => [p.code, p]));
export const provinceName = (code: string) => PROVINCE_MAP[code]?.name ?? code;
