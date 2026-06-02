import { memo, useEffect, useMemo, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { defaultCountryColor } from './colors';

const TOPO_URL = '/world_provinces.topo.json';
const STORAGE_KEY = 'worldmap.v1';

interface ProvProps {
  adm1_code: string;
  admin: string;
  adm0_a3: string;
  name: string;
  iso_3166_2?: string;
  type_en?: string;
}

interface Overrides {
  countryColors: Record<string, string>; // adm0_a3 -> hex
  countryNames: Record<string, string>; // adm0_a3 -> 이름
  provinceNames: Record<string, string>; // adm1_code -> 이름
  provinceCountry: Record<string, string>; // adm1_code -> 소속 국가 코드
}

const EMPTY: Overrides = {
  countryColors: {},
  countryNames: {},
  provinceNames: {},
  provinceCountry: {},
};

function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Overrides) };
  } catch {
    /* ignore */
  }
  return EMPTY;
}

export default function App() {
  const [topo, setTopo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(
    null
  );
  const [position, setPosition] = useState<{
    coordinates: [number, number];
    zoom: number;
  }>({ coordinates: [10, 25], zoom: 1 });

  useEffect(() => {
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then(setTopo)
      .catch(() => setError('지도 데이터를 불러오지 못했습니다.'));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }, [overrides]);

  // 지도 메타데이터: 국가 목록 / 코드→이름 / 프로빈스 사전
  const meta = useMemo(() => {
    const countryName = new Map<string, string>();
    const provincesById = new Map<string, ProvProps>();
    const provinceCount = new Map<string, number>();
    if (topo) {
      const objName = Object.keys(topo.objects)[0];
      for (const g of topo.objects[objName].geometries) {
        const p = g.properties as ProvProps;
        if (!countryName.has(p.adm0_a3)) countryName.set(p.adm0_a3, p.admin);
        provincesById.set(p.adm1_code, p);
        provinceCount.set(p.adm0_a3, (provinceCount.get(p.adm0_a3) ?? 0) + 1);
      }
    }
    const countries = [...countryName.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { countryName, provincesById, countries, provinceCount };
  }, [topo]);

  // --- 색/이름 계산 헬퍼 ---
  const effCountryOf = (p: ProvProps) =>
    overrides.provinceCountry[p.adm1_code] ?? p.adm0_a3;
  const colorOfCountry = (code: string) =>
    overrides.countryColors[code] ?? defaultCountryColor(code);
  const nameOfCountry = (code: string) =>
    overrides.countryNames[code] ?? meta.countryName.get(code) ?? code;
  const nameOfProvince = (p: ProvProps) =>
    overrides.provinceNames[p.adm1_code] ?? p.name;

  // --- 편집 액션 ---
  const patch = (fn: (o: Overrides) => Overrides) => setOverrides(fn);

  function setCountryColor(code: string, hex: string) {
    patch((o) => ({ ...o, countryColors: { ...o.countryColors, [code]: hex } }));
  }
  function setCountryName(code: string, name: string) {
    patch((o) => ({ ...o, countryNames: { ...o.countryNames, [code]: name } }));
  }
  function setProvinceName(id: string, name: string) {
    patch((o) => ({ ...o, provinceNames: { ...o.provinceNames, [id]: name } }));
  }
  function reassignProvince(p: ProvProps, code: string) {
    patch((o) => {
      const next = { ...o.provinceCountry };
      if (code === p.adm0_a3) delete next[p.adm1_code];
      else next[p.adm1_code] = code;
      return { ...o, provinceCountry: next };
    });
  }
  function resetProvince(p: ProvProps) {
    patch((o) => {
      const pc = { ...o.provinceCountry };
      const pn = { ...o.provinceNames };
      delete pc[p.adm1_code];
      delete pn[p.adm1_code];
      return { ...o, provinceCountry: pc, provinceNames: pn };
    });
  }
  function resetCountryColor(code: string) {
    patch((o) => {
      const cc = { ...o.countryColors };
      const cn = { ...o.countryNames };
      delete cc[code];
      delete cn[code];
      return { ...o, countryColors: cc, countryNames: cn };
    });
  }
  function resetAll() {
    if (!confirm('모든 편집(색·이름·소속 변경)을 초기화할까요?')) return;
    setOverrides(EMPTY);
  }

  const selected = selectedId ? meta.provincesById.get(selectedId) ?? null : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          🗺️ <strong>WorldMap</strong>
          <span className="sub">세계 지도 편집기</span>
        </div>

        <input
          className="country-search"
          list="country-list"
          placeholder="국가로 이동 (예: South Korea)…"
          onChange={(e) => {
            const c = meta.countries.find((x) => x.name === e.target.value);
            if (!c) return;
            // 해당 국가의 첫 프로빈스를 선택
            for (const [id, p] of meta.provincesById) {
              if (p.adm0_a3 === c.code) {
                setSelectedId(id);
                break;
              }
            }
          }}
        />
        <datalist id="country-list">
          {meta.countries.map((c) => (
            <option key={c.code} value={c.name} />
          ))}
        </datalist>

        <div className="zoom-controls">
          <button
            onClick={() =>
              setPosition((p) => ({ ...p, zoom: Math.min(p.zoom * 1.5, 14) }))
            }
          >
            ＋
          </button>
          <button
            onClick={() =>
              setPosition((p) => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) }))
            }
          >
            －
          </button>
          <button
            onClick={() => setPosition({ coordinates: [10, 25], zoom: 1 })}
          >
            ⟲ 보기 초기화
          </button>
        </div>

        <div className="actions">
          <span className="count">
            {meta.countries.length}개국 · {meta.provincesById.size}개 행정구역
          </span>
          <button className="danger" onClick={resetAll}>
            편집 초기화
          </button>
        </div>
      </header>

      <div className="body">
        <div
          className="map-wrap"
          onMouseMove={(e) =>
            setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))
          }
          onMouseLeave={() => setHover(null)}
        >
          {error && <div className="loading">{error}</div>}
          {!topo && !error && <div className="loading">지도 불러오는 중…</div>}
          {topo && (
            <ComposableMap
              projection="geoEqualEarth"
              projectionConfig={{ scale: 170 }}
              style={{ width: '100%', height: '100%' }}
            >
              <ZoomableGroup
                center={position.coordinates}
                zoom={position.zoom}
                minZoom={1}
                maxZoom={14}
                onMoveEnd={(pos) => setPosition(pos)}
              >
                <Geographies geography={topo}>
                  {({ geographies }) => (
                    <MapLayer
                      geographies={geographies}
                      overrides={overrides}
                      selectedId={selectedId}
                      colorOfCountry={colorOfCountry}
                      effCountryOf={effCountryOf}
                      onSelect={setSelectedId}
                      onHover={(text, x, y) => setHover({ text, x, y })}
                      onLeave={() => setHover(null)}
                    />
                  )}
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          )}

          {hover && (
            <div
              className="tooltip"
              style={{ left: hover.x + 14, top: hover.y + 14 }}
            >
              {hover.text}
            </div>
          )}
        </div>

        <aside className="panel">
          {selected ? (
            <ProvincePanel
              p={selected}
              effCode={effCountryOf(selected)}
              countryName={nameOfCountry(effCountryOf(selected))}
              countryColor={colorOfCountry(effCountryOf(selected))}
              provinceName={nameOfProvince(selected)}
              provinceCount={meta.provinceCount.get(effCountryOf(selected)) ?? 0}
              countries={meta.countries}
              isColorOverridden={
                overrides.countryColors[effCountryOf(selected)] !== undefined
              }
              onCountryColor={(hex) => setCountryColor(effCountryOf(selected), hex)}
              onCountryName={(n) => setCountryName(effCountryOf(selected), n)}
              onProvinceName={(n) => setProvinceName(selected.adm1_code, n)}
              onReassign={(code) => reassignProvince(selected, code)}
              onResetProvince={() => resetProvince(selected)}
              onResetCountry={() => resetCountryColor(effCountryOf(selected))}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="panel-empty">
              <h3>편집하려면 지도를 클릭하세요</h3>
              <p>
                각 국가는 고유한 색으로 칠해지며, 같은 국가의 프로빈스(행정구역)는
                같은 색을 공유합니다.
              </p>
              <ul>
                <li>프로빈스를 클릭해 선택</li>
                <li>국가 색 변경 → 그 나라 전체에 적용</li>
                <li>프로빈스를 다른 국가로 이전(색도 따라 변경)</li>
                <li>국가·프로빈스 이름 편집</li>
                <li>드래그로 이동, 휠/버튼으로 확대·축소</li>
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── 지도 레이어 (hover 상태에 의존하지 않도록 memo 처리) ──
interface LayerProps {
  geographies: any[];
  overrides: Overrides;
  selectedId: string | null;
  colorOfCountry: (code: string) => string;
  effCountryOf: (p: ProvProps) => string;
  onSelect: (id: string) => void;
  onHover: (text: string, x: number, y: number) => void;
  onLeave: () => void;
}

const MapLayer = memo(function MapLayer(p: LayerProps) {
  return (
    <>
      {p.geographies.map((geo) => {
        const props = geo.properties as ProvProps;
        const code = p.effCountryOf(props);
        const fill = p.colorOfCountry(code);
        const selected = props.adm1_code === p.selectedId;
        const provName =
          p.overrides.provinceNames[props.adm1_code] ?? props.name;
        const countryName =
          p.overrides.countryNames[code] ?? props.admin;
        return (
          <Geography
            key={geo.rsmKey}
            geography={geo}
            fill={fill}
            onClick={() => p.onSelect(props.adm1_code)}
            onMouseEnter={(e) =>
              p.onHover(
                `${countryName} — ${provName}`,
                (e as any).clientX,
                (e as any).clientY
              )
            }
            onMouseLeave={p.onLeave}
            style={{
              default: {
                outline: 'none',
                stroke: selected ? '#ffffff' : '#0b0f16',
                strokeWidth: selected ? 1.1 : 0.22,
              },
              hover: {
                outline: 'none',
                stroke: '#ffffff',
                strokeWidth: 0.7,
                cursor: 'pointer',
                filter: 'brightness(1.15)',
              },
              pressed: { outline: 'none' },
            }}
          />
        );
      })}
    </>
  );
});

// ── 우측 편집 패널 ──
interface PanelProps {
  p: ProvProps;
  effCode: string;
  countryName: string;
  countryColor: string;
  provinceName: string;
  provinceCount: number;
  countries: { code: string; name: string }[];
  isColorOverridden: boolean;
  onCountryColor: (hex: string) => void;
  onCountryName: (name: string) => void;
  onProvinceName: (name: string) => void;
  onReassign: (code: string) => void;
  onResetProvince: () => void;
  onResetCountry: () => void;
  onClose: () => void;
}

function ProvincePanel(pp: PanelProps) {
  const reassigned = pp.effCode !== pp.p.adm0_a3;
  return (
    <div className="prov-panel">
      <div className="prov-head">
        <span className="swatch" style={{ background: pp.countryColor }} />
        <h3>{pp.provinceName}</h3>
        <button className="close" onClick={pp.onClose}>
          ✕
        </button>
      </div>

      <section className="field-block">
        <label className="fl">프로빈스 이름</label>
        <input
          value={pp.provinceName}
          onChange={(e) => pp.onProvinceName(e.target.value)}
        />
        <div className="hint">
          {pp.p.type_en || '행정구역'}
          {pp.p.iso_3166_2 ? ` · ${pp.p.iso_3166_2}` : ''} · ID {pp.p.adm1_code}
        </div>
      </section>

      <section className="field-block">
        <label className="fl">소속 국가 ({pp.provinceCount}개 행정구역)</label>
        <input
          value={pp.countryName}
          onChange={(e) => pp.onCountryName(e.target.value)}
        />
      </section>

      <section className="field-block">
        <label className="fl">국가 색 (같은 국가 전체 적용)</label>
        <div className="color-row">
          <input
            type="color"
            value={pp.countryColor}
            onChange={(e) => pp.onCountryColor(e.target.value)}
          />
          <code>{pp.countryColor}</code>
          {pp.isColorOverridden && (
            <button className="link" onClick={pp.onResetCountry}>
              기본색으로
            </button>
          )}
        </div>
      </section>

      <section className="field-block">
        <label className="fl">다른 국가로 이전</label>
        <select
          value={pp.effCode}
          onChange={(e) => pp.onReassign(e.target.value)}
        >
          {pp.countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
        {reassigned && (
          <div className="hint warn">
            원래 소속: {pp.p.admin} ({pp.p.adm0_a3})
          </div>
        )}
      </section>

      <div className="panel-actions">
        <button className="link danger" onClick={pp.onResetProvince}>
          이 프로빈스 변경 되돌리기
        </button>
      </div>
    </div>
  );
}
