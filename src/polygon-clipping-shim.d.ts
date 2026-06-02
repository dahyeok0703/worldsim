// polygon-clipping의 ESM 번들은 default export(객체)만 제공하므로 default 타입을 보강한다.
declare module 'polygon-clipping' {
  export type Pair = [number, number];
  export type Ring = Pair[];
  export type Polygon = Ring[];
  export type MultiPolygon = Polygon[];
  type Geom = Polygon | MultiPolygon;
  interface PolygonClipping {
    union(geom: Geom, ...geoms: Geom[]): MultiPolygon;
    intersection(geom: Geom, ...geoms: Geom[]): MultiPolygon;
    difference(subject: Geom, ...clips: Geom[]): MultiPolygon;
    xor(geom: Geom, ...geoms: Geom[]): MultiPolygon;
  }
  const pc: PolygonClipping;
  export default pc;
}
