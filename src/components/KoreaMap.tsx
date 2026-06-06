import { useMemo, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { ElectionResult } from '../types';
import { partyColor } from '../data/parties';
import { GeoFeature, blendColor, loadGeo } from './geo';

const W = 560, H = 680;

interface Props {
  result: ElectionResult;
  mode: 'national' | 'drill';
  selectedProvince?: string;
  onProvinceClick?: (code: string) => void;
  onDistrictHover?: (code: string | null) => void;
  onDistrictClick?: (code: string) => void;
}

export default function KoreaMap(p: Props) {
  const { provinces, districts } = loadGeo();
  const [hover, setHover] = useState<string | null>(null);

  const features: GeoFeature[] = useMemo(() => {
    if (p.mode === 'drill' && p.selectedProvince)
      return districts.filter((d) => d.properties.code.startsWith(p.selectedProvince!));
    return provinces;
  }, [p.mode, p.selectedProvince, provinces, districts]);

  const path = useMemo(() => {
    const proj = geoMercator().fitExtent([[12, 12], [W - 12, H - 12]],
      { type: 'FeatureCollection', features: features as any });
    return geoPath(proj);
  }, [features]);

  function fillFor(code: string): string {
    if (p.mode === 'national') {
      const pr = p.result.provinces[code];
      if (!pr) return '#1b2230';
      const margin = (pr.parties[0]?.pct ?? 0) - (pr.parties[1]?.pct ?? 0);
      return blendColor(partyColor(pr.winner), margin / 28);
    }
    const dr = p.result.districts[code];
    if (!dr) return '#1b2230';
    const margin = (dr.parties[0]?.pct ?? 0) - (dr.parties[1]?.pct ?? 0);
    return blendColor(partyColor(dr.winner), margin / 28);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="korea-map" preserveAspectRatio="xMidYMid meet">
      {features.map((f) => {
        const code = f.properties.code;
        const d = path(f as any) || '';
        const isHover = hover === code;
        return (
          <path
            key={code}
            d={d}
            fill={fillFor(code)}
            stroke={isHover ? '#fff' : '#0c1118'}
            strokeWidth={isHover ? 1.6 : 0.5}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: 'pointer', filter: isHover ? 'brightness(1.2)' : undefined }}
            onMouseEnter={() => { setHover(code); if (p.mode === 'drill') p.onDistrictHover?.(code); }}
            onMouseLeave={() => { setHover(null); if (p.mode === 'drill') p.onDistrictHover?.(null); }}
            onClick={() => { if (p.mode === 'national') p.onProvinceClick?.(code); else p.onDistrictClick?.(code); }}
          />
        );
      })}
    </svg>
  );
}
