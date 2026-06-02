import { geoEqualEarth, geoPath, geoCentroid, GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import pc, { MultiPolygon as PCMP } from 'polygon-clipping';

// ── 모델 ─────────────────────────────────────────────
export interface KV {
  id: string;
  label: string;
  value: string;
}

export type Geom =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface Province {
  id: string;
  countryCode: string; // 원래 소속 (adm0_a3)
  countryName: string;
  name: string;
  type?: string;
  geometry: Geom;
}

/** 영구 저장되는 편집 내역 (기본 4596개 지오메트리는 저장하지 않음) */
export interface Edits {
  removedIds: string[];
  added: Province[]; // 새로 그리기 / 분할 / 병합 결과
  provinceColors: Record<string, string>;
  provinceNames: Record<string, string>;
  provinceInfo: Record<string, KV[]>;
  provinceCountry: Record<string, string>; // 소속 변경
  countryColors: Record<string, string>;
  countryNames: Record<string, string>;
  countryInfo: Record<string, KV[]>;
}

export const EMPTY_EDITS: Edits = {
  removedIds: [],
  added: [],
  provinceColors: {},
  provinceNames: {},
  provinceInfo: {},
  provinceCountry: {},
  countryColors: {},
  countryNames: {},
  countryInfo: {},
};

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

// ── topojson → 기본 프로빈스 ─────────────────────────
export function provincesFromTopo(topo: any): Province[] {
  const objName = Object.keys(topo.objects)[0];
  const fc: any = feature(topo, topo.objects[objName]);
  return fc.features.map((f: any) => ({
    id: f.properties.adm1_code,
    countryCode: f.properties.adm0_a3,
    countryName: f.properties.admin,
    name: f.properties.name ?? '(이름 없음)',
    type: f.properties.type_en,
    geometry: f.geometry,
  }));
}

// ── 투영 / 경로 ──────────────────────────────────────
export const MAP_W = 1000;
export const MAP_H = 540;

export function makeProjection(topo: any): GeoProjection {
  const objName = Object.keys(topo.objects)[0];
  const fc: any = feature(topo, topo.objects[objName]);
  return geoEqualEarth().fitExtent(
    [
      [8, 8],
      [MAP_W - 8, MAP_H - 8],
    ],
    fc
  );
}

export function makePath(projection: GeoProjection) {
  return geoPath(projection);
}

export function centroidOf(p: Province): [number, number] {
  return geoCentroid(p.geometry as any) as [number, number];
}

// ── 폴리곤 불리언 헬퍼 ───────────────────────────────
function toMP(g: Geom): PCMP {
  return (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]) as PCMP;
}

function fromMP(mp: PCMP): Geom {
  return { type: 'MultiPolygon', coordinates: mp as unknown as number[][][][] };
}

function isEmpty(mp: PCMP): boolean {
  return !mp || mp.length === 0;
}

/** 여러 프로빈스를 하나로 병합 (합집합) */
export function mergeGeoms(provs: Province[]): Geom {
  const [first, ...rest] = provs;
  let acc = toMP(first.geometry);
  if (rest.length) acc = pc.union(acc, ...rest.map((p) => toMP(p.geometry)));
  return fromMP(acc);
}

/** 라쏘 폴리곤으로 프로빈스를 둘로 분할 → [내부, 외부] */
export function splitGeom(
  target: Geom,
  lassoRing: [number, number][]
): { inside: Geom | null; outside: Geom | null } {
  const lasso: PCMP = [[lassoRing.map((p) => [p[0], p[1]]) as any]];
  const t = toMP(target);
  const inside = pc.intersection(t, lasso);
  const outside = pc.difference(t, lasso);
  return {
    inside: isEmpty(inside) ? null : fromMP(inside),
    outside: isEmpty(outside) ? null : fromMP(outside),
  };
}

// ── 화면 좌표 ↔ 경위도 변환 ──────────────────────────
export interface Transform {
  k: number;
  x: number;
  y: number;
}

/** SVG 사용자좌표(loc) + 줌 변환 → 경위도 */
export function screenToLngLat(
  loc: { x: number; y: number },
  t: Transform,
  projection: GeoProjection
): [number, number] | null {
  const bx = (loc.x - t.x) / t.k;
  const by = (loc.y - t.y) / t.k;
  const r = projection.invert?.([bx, by]);
  return r ? [r[0], r[1]] : null;
}
