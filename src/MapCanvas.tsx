import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GeoProjection } from 'd3-geo';
import { MAP_H, MAP_W, Province, Transform } from './geo';

export interface MapHandle {
  centerOn: (lnglat: [number, number], k?: number) => void;
  resetView: () => void;
  zoomBy: (factor: number) => void;
}

interface Props {
  features: Province[];
  projection: GeoProjection;
  pathFor: (p: Province) => string; // 미리 만든 d 문자열
  fills: Record<string, string>;
  labels: Record<string, string>;
  selectedIds: string[];
  mode: 'view' | 'draw' | 'split';
  draft: [number, number][];
  onSelectAt: (id: string | null, alt: boolean, shift: boolean) => void;
  onAddPoint: (lnglat: [number, number]) => void;
}

const clampK = (k: number) => Math.max(1, Math.min(k, 60));

const MapCanvas = forwardRef<MapHandle, Props>(function MapCanvas(p, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [t, setT] = useState<Transform>({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(
    null
  );
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(
    null
  );

  useImperativeHandle(ref, () => ({
    centerOn(lnglat, k = 5) {
      const base = p.projection(lnglat);
      if (!base) return;
      setT({ k, x: MAP_W / 2 - k * base[0], y: MAP_H / 2 - k * base[1] });
    },
    resetView() {
      setT({ k: 1, x: 0, y: 0 });
    },
    zoomBy(factor) {
      setT((cur) => {
        const nk = clampK(cur.k * factor);
        const c = [MAP_W / 2, MAP_H / 2];
        return {
          k: nk,
          x: c[0] - ((c[0] - cur.x) * nk) / cur.k,
          y: c[1] - ((c[1] - cur.y) * nk) / cur.k,
        };
      });
    },
  }));

  // 화면 → SVG 사용자좌표
  function toUser(clientX: number, clientY: number) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  }
  function userToLngLat(loc: { x: number; y: number }): [number, number] | null {
    const bx = (loc.x - t.x) / t.k;
    const by = (loc.y - t.y) / t.k;
    const r = p.projection.invert?.([bx, by]);
    return r ? [r[0], r[1]] : null;
  }

  // ── 색칠된 폴리곤들 (transform/ hover 와 무관하게 memo) ──
  const selSet = useMemo(() => new Set(p.selectedIds), [p.selectedIds]);
  const paths = useMemo(() => {
    return p.features.map((f) => {
      const d = p.pathFor(f);
      if (!d) return null;
      const selected = selSet.has(f.id);
      return (
        <path
          key={f.id}
          data-id={f.id}
          d={d}
          fill={p.fills[f.id] || '#888'}
          stroke={selected ? '#ffffff' : '#0b0f16'}
          strokeWidth={selected ? 1.6 : 0.4}
          vectorEffect="non-scaling-stroke"
        />
      );
    });
  }, [p.features, p.fills, selSet, p.pathFor]);

  // ── 그리기 중인 폴리곤 오버레이 ──
  const draftOverlay = useMemo(() => {
    if (p.mode === 'view' || p.draft.length === 0) return null;
    const pts = p.draft
      .map((ll) => p.projection(ll))
      .filter(Boolean) as [number, number][];
    const d =
      'M' + pts.map((pt) => `${pt[0]},${pt[1]}`).join('L') +
      (pts.length > 2 ? 'Z' : '');
    const r = 4 / t.k;
    return (
      <g className="draft">
        <path
          d={d}
          fill="rgba(76,141,255,0.25)"
          stroke="#4c8dff"
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
        />
        {pts.map((pt, i) => (
          <circle key={i} cx={pt[0]} cy={pt[1]} r={r} fill="#4c8dff" />
        ))}
      </g>
    );
  }, [p.mode, p.draft, p.projection, t.k]);

  // ── 포인터 핸들링 (드래그 팬 / 클릭 / 그리기) ──
  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (drag.current) {
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
      if (drag.current.moved) {
        // 화면 픽셀 이동량을 사용자좌표 이동량으로 환산
        const svg = svgRef.current!;
        const scale = svg.getScreenCTM()!.a; // 화면픽셀/사용자단위
        setT((cur) => ({
          ...cur,
          x: drag.current!.tx + dx / scale,
          y: drag.current!.ty + dy / scale,
        }));
      }
      return;
    }
    if (p.mode !== 'view') return;
    // 호버 툴팁
    const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const id = el?.getAttribute?.('data-id');
    if (id && p.labels[id]) setHover({ x: e.clientX, y: e.clientY, text: p.labels[id] });
    else setHover(null);
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) return; // 팬이었음 → 클릭 무시

    if (p.mode !== 'view') {
      const ll = userToLngLat(toUser(e.clientX, e.clientY));
      if (ll) p.onAddPoint(ll);
      return;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const id = el?.getAttribute?.('data-id') ?? null;
    p.onSelectAt(id, e.altKey, e.shiftKey);
  }
  function onWheel(e: React.WheelEvent) {
    const loc = toUser(e.clientX, e.clientY);
    setT((cur) => {
      const nk = clampK(cur.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
      return {
        k: nk,
        x: loc.x - ((loc.x - cur.x) * nk) / cur.k,
        y: loc.y - ((loc.y - cur.y) * nk) / cur.k,
      };
    });
  }

  return (
    <div className="map-inner">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid meet"
        className={`mapsvg ${p.mode !== 'view' ? 'drawing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          drag.current = null;
          setHover(null);
        }}
        onWheel={onWheel}
      >
        <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="transparent" />
        <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
          {paths}
          {draftOverlay}
        </g>
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          {hover.text}
        </div>
      )}
    </div>
  );
});

export default MapCanvas;
