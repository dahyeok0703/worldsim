// 세계 데이터 모델
// "국가 → 카테고리 → 항목(라벨:값)" 구조라 어떤 정보든 자유롭게 추가/편집/삭제할 수 있다.

export interface Field {
  id: string;
  label: string;
  value: string;
}

export interface Category {
  id: string;
  name: string;
  fields: Field[];
}

export interface Country {
  id: string;
  name: string;
  flag: string;
  region: string;
  categories: Category[];
}

export const REGIONS = [
  '아시아',
  '유럽',
  '아프리카',
  '북아메리카',
  '남아메리카',
  '오세아니아',
  '기타',
] as const;

export interface WorldState {
  /** 데이터 기준 시점 (사용자가 편집 가능) */
  asOf: string;
  countries: Country[];
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
