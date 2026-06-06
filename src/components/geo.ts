import { feature } from 'topojson-client';
import provTopo from '../data/maps/provinces.topo.json';
import distTopo from '../data/maps/districts.topo.json';

export interface GeoFeature {
  type: 'Feature';
  properties: { code: string; name: string };
  geometry: any;
}

let _cache: { provinces: GeoFeature[]; districts: GeoFeature[] } | null = null;

export function loadGeo() {
  if (_cache) return _cache;
  const pObj = (provTopo as any).objects.skorea_provinces_2018_geo;
  const dObj = (distTopo as any).objects.skorea_municipalities_2018_geo;
  const provinces = (feature(provTopo as any, pObj) as any).features as GeoFeature[];
  const districts = (feature(distTopo as any, dObj) as any).features as GeoFeature[];
  _cache = { provinces, districts };
  return _cache;
}

// 색 혼합: winner 색을 격차(intensity 0~1)에 따라 어두운 배경과 섞어 채도 표현
export function blendColor(hex: string, intensity: number, bg = '#1b2230'): string {
  const t = Math.max(0.12, Math.min(1, intensity));
  const a = hexToRgb(hex), b = hexToRgb(bg);
  const mix = (x: number, y: number) => Math.round(y + (x - y) * t);
  return `rgb(${mix(a.r, b.r)},${mix(a.g, b.g)},${mix(a.b, b.b)})`;
}
function hexToRgb(h: string) {
  const m = h.replace('#', '');
  return { r: parseInt(m.slice(0, 2), 16), g: parseInt(m.slice(2, 4), 16), b: parseInt(m.slice(4, 6), 16) };
}
