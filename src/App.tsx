import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapCanvas, { MapHandle } from './MapCanvas';
import { defaultCountryColor } from './colors';
import {
  Edits,
  EMPTY_EDITS,
  KV,
  Province,
  centroidOf,
  makePath,
  makeProjection,
  mergeGeoms,
  provincesFromTopo,
  splitGeom,
  uid,
} from './geo';

const TOPO_URL = '/world_provinces.topo.json';
const STORAGE_KEY = 'worldmap.v2';

function loadEdits(): Edits {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY_EDITS, ...(JSON.parse(raw) as Edits) };
  } catch {
    /* ignore */
  }
  return EMPTY_EDITS;
}

type Mode = 'view' | 'draw' | 'split';

export default function App() {
  const [topo, setTopo] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [base, setBase] = useState<Province[]>([]);
  const [edits, setEdits] = useState<Edits>(loadEdits);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState<[number, number][]>([]);
  const splitTarget = useRef<string | null>(null);

  const mapRef = useRef<MapHandle>(null);

  useEffect(() => {
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((t) => {
        setTopo(t);
        setBase(provincesFromTopo(t));
      })
      .catch(() => setErr('지도 데이터를 불러오지 못했습니다.'));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  }, [edits]);

  const projection = useMemo(() => (topo ? makeProjection(topo) : null), [topo]);
  const pathGen = useMemo(() => (projection ? makePath(projection) : null), [projection]);

  // 표시 대상 프로빈스 = 기본 − 삭제 + 추가
  const features = useMemo(() => {
    const removed = new Set(edits.removedIds);
    return base.filter((p) => !removed.has(p.id)).concat(edits.added);
  }, [base, edits.added, edits.removedIds]);

  const byId = useMemo(() => {
    const m = new Map<string, Province>();
    for (const f of features) m.set(f.id, f);
    return m;
  }, [features]);

  const countryNameByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of features) if (!m.has(f.countryCode)) m.set(f.countryCode, f.countryName);
    return m;
  }, [features]);

  const countryOptions = useMemo(
    () =>
      [...countryNameByCode.entries()]
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [countryNameByCode]
  );

  const effCode = useCallback(
    (p: Province) => edits.provinceCountry[p.id] ?? p.countryCode,
    [edits.provinceCountry]
  );

  const idsByCountry = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const f of features) {
      const c = edits.provinceCountry[f.id] ?? f.countryCode;
      (m.get(c) ?? m.set(c, []).get(c)!).push(f.id);
    }
    return m;
  }, [features, edits.provinceCountry]);

  // d 경로 문자열 (지오메트리 변경 시에만 재계산)
  const dById = useMemo(() => {
    const m: Record<string, string> = {};
    if (pathGen) for (const f of features) m[f.id] = pathGen(f.geometry as any) || '';
    return m;
  }, [features, pathGen]);
  const pathFor = useCallback((f: Province) => dById[f.id] || '', [dById]);

  // 색/라벨 (스타일 편집 시 재계산)
  const display = useMemo(() => {
    const fills: Record<string, string> = {};
    const labels: Record<string, string> = {};
    for (const f of features) {
      const code = edits.provinceCountry[f.id] ?? f.countryCode;
      fills[f.id] =
        edits.provinceColors[f.id] ??
        edits.countryColors[code] ??
        defaultCountryColor(code);
      const cName = edits.countryNames[code] ?? countryNameByCode.get(code) ?? f.countryName;
      const pName = edits.provinceNames[f.id] ?? f.name;
      labels[f.id] = `${cName} — ${pName}`;
    }
    return { fills, labels };
  }, [features, edits, countryNameByCode]);

  // ── 편집 헬퍼 ──
  const patch = (fn: (e: Edits) => Edits) => setEdits(fn);
  const provColorOf = (id: string, code: string) =>
    edits.provinceColors[id] ?? edits.countryColors[code] ?? defaultCountryColor(code);
  const provNameOf = (p: Province) => edits.provinceNames[p.id] ?? p.name;
  const countryNameOf = (code: string) =>
    edits.countryNames[code] ?? countryNameByCode.get(code) ?? code;

  // ── 선택 ──
  function onSelectAt(id: string | null, alt: boolean, shift: boolean) {
    if (!id) {
      setSelectedIds([]);
      setCountryCode(null);
      return;
    }
    const prov = byId.get(id);
    if (!prov) return;
    if (alt) {
      const code = effCode(prov);
      setSelectedIds(idsByCountry.get(code) ?? [id]);
      setCountryCode(code);
    } else if (shift) {
      setCountryCode(null);
      setSelectedIds((cur) =>
        cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      );
    } else {
      setCountryCode(null);
      setSelectedIds([id]);
    }
  }

  // ── 그리기 / 분할 ──
  function startDraw() {
    setMode('draw');
    setDraft([]);
    setSelectedIds([]);
    setCountryCode(null);
  }
  function startSplit(id: string) {
    splitTarget.current = id;
    setMode('split');
    setDraft([]);
  }
  function cancelEdit() {
    setMode('view');
    setDraft([]);
    splitTarget.current = null;
  }
  function undoPoint() {
    setDraft((d) => d.slice(0, -1));
  }

  function finishDraw() {
    if (draft.length < 3) return alert('점을 3개 이상 찍어 주세요.');
    const ring = [...draft, draft[0]];
    const np: Province = {
      id: uid('prov'),
      countryCode: 'XAA',
      countryName: '사용자 지역',
      name: '새 프로빈스',
      type: '사용자 정의',
      geometry: { type: 'Polygon', coordinates: [ring as any] },
    };
    patch((e) => ({ ...e, added: [...e.added, np] }));
    cancelEdit();
    setSelectedIds([np.id]);
    setCountryCode(null);
  }

  function finishSplit() {
    const tid = splitTarget.current;
    const target = tid ? byId.get(tid) : null;
    if (!target) return cancelEdit();
    if (draft.length < 3) return alert('자를 영역을 3개 점 이상으로 그려 주세요.');
    const { inside, outside } = splitGeom(target.geometry, draft);
    const code = effCode(target);
    const col = edits.provinceColors[target.id];
    const pieces: Province[] = [];
    if (inside)
      pieces.push({
        id: uid('prov'),
        countryCode: code,
        countryName: target.countryName,
        name: `${provNameOf(target)} (1)`,
        type: target.type,
        geometry: inside,
      });
    if (outside)
      pieces.push({
        id: uid('prov'),
        countryCode: code,
        countryName: target.countryName,
        name: `${provNameOf(target)} (2)`,
        type: target.type,
        geometry: outside,
      });
    if (pieces.length < 2) {
      alert('분할 영역이 프로빈스와 겹치도록 그려 주세요.');
      return;
    }
    patch((e) => {
      const isAdded = e.added.some((a) => a.id === target.id);
      const provinceColors = { ...e.provinceColors };
      if (col) pieces.forEach((p) => (provinceColors[p.id] = col));
      delete provinceColors[target.id];
      return {
        ...e,
        added: e.added.filter((a) => a.id !== target.id).concat(pieces),
        removedIds: isAdded ? e.removedIds : [...e.removedIds, target.id],
        provinceColors,
      };
    });
    cancelEdit();
    setSelectedIds(pieces.map((p) => p.id));
    setCountryCode(null);
  }

  // ── 병합 ──
  function mergeSelected() {
    const provs = selectedIds.map((id) => byId.get(id)).filter(Boolean) as Province[];
    if (provs.length < 2) return;
    const code = effCode(provs[0]);
    const np: Province = {
      id: uid('prov'),
      countryCode: code,
      countryName: provs[0].countryName,
      name: `${provNameOf(provs[0])} 외 ${provs.length - 1}`,
      type: provs[0].type,
      geometry: mergeGeoms(provs),
    };
    const col = edits.provinceColors[provs[0].id];
    patch((e) => {
      const ids = new Set(provs.map((p) => p.id));
      const provinceColors = { ...e.provinceColors };
      ids.forEach((id) => delete provinceColors[id]);
      if (col) provinceColors[np.id] = col;
      const addedRemain = e.added.filter((a) => !ids.has(a.id));
      const removedBase = provs.filter((p) => !e.added.some((a) => a.id === p.id)).map((p) => p.id);
      return {
        ...e,
        added: [...addedRemain, np],
        removedIds: [...e.removedIds, ...removedBase],
        provinceColors,
      };
    });
    setSelectedIds([np.id]);
    setCountryCode(null);
  }

  function deleteProvince(id: string) {
    if (!confirm('이 프로빈스를 삭제할까요?')) return;
    patch((e) => {
      const isAdded = e.added.some((a) => a.id === id);
      return {
        ...e,
        added: e.added.filter((a) => a.id !== id),
        removedIds: isAdded ? e.removedIds : [...e.removedIds, id],
      };
    });
    setSelectedIds([]);
    setCountryCode(null);
  }

  // ── 스타일/이름/소속/정보 세터 ──
  const setProvColor = (id: string, hex: string) =>
    patch((e) => ({ ...e, provinceColors: { ...e.provinceColors, [id]: hex } }));
  const resetProvColor = (id: string) =>
    patch((e) => {
      const c = { ...e.provinceColors };
      delete c[id];
      return { ...e, provinceColors: c };
    });
  const setProvName = (id: string, name: string) =>
    patch((e) => ({ ...e, provinceNames: { ...e.provinceNames, [id]: name } }));
  const setProvInfo = (id: string, info: KV[]) =>
    patch((e) => ({ ...e, provinceInfo: { ...e.provinceInfo, [id]: info } }));
  const reassign = (p: Province, code: string) =>
    patch((e) => {
      const pc = { ...e.provinceCountry };
      if (code === p.countryCode) delete pc[p.id];
      else pc[p.id] = code;
      return { ...e, provinceCountry: pc };
    });
  const setCountryColor = (code: string, hex: string) =>
    patch((e) => ({ ...e, countryColors: { ...e.countryColors, [code]: hex } }));
  const resetCountryColor = (code: string) =>
    patch((e) => {
      const c = { ...e.countryColors };
      delete c[code];
      return { ...e, countryColors: c };
    });
  const setCountryName = (code: string, name: string) =>
    patch((e) => ({ ...e, countryNames: { ...e.countryNames, [code]: name } }));
  const setCountryInfo = (code: string, info: KV[]) =>
    patch((e) => ({ ...e, countryInfo: { ...e.countryInfo, [code]: info } }));

  function resetAll() {
    if (!confirm('모든 편집(지오메트리·색·이름·정보)을 초기화할까요?')) return;
    setEdits(EMPTY_EDITS);
    setSelectedIds([]);
    setCountryCode(null);
    cancelEdit();
  }

  function gotoCountry(name: string) {
    const c = countryOptions.find((x) => x.name === name);
    if (!c) return;
    const ids = idsByCountry.get(c.code) ?? [];
    if (!ids.length) return;
    const first = byId.get(ids[0])!;
    mapRef.current?.centerOn(centroidOf(first), 4);
    setSelectedIds(ids);
    setCountryCode(c.code);
  }

  const single = !countryCode && selectedIds.length === 1 ? byId.get(selectedIds[0]) : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          🗺️ <strong>WorldMap</strong>
          <span className="sub">지도 편집기</span>
        </div>

        <input
          className="country-search"
          list="clist"
          placeholder="국가로 이동…"
          onChange={(e) => gotoCountry(e.target.value)}
        />
        <datalist id="clist">
          {countryOptions.map((c) => (
            <option key={c.code} value={c.name} />
          ))}
        </datalist>

        <button onClick={startDraw} disabled={mode !== 'view'}>
          ✏️ 새 프로빈스 그리기
        </button>
        <div className="zoom-controls">
          <button onClick={() => mapRef.current?.zoomBy(1.5)}>＋</button>
          <button onClick={() => mapRef.current?.zoomBy(1 / 1.5)}>－</button>
          <button onClick={() => mapRef.current?.resetView()}>⟲</button>
        </div>
        <div className="actions">
          <span className="count">{features.length}개 행정구역</span>
          <button className="danger" onClick={resetAll}>
            편집 초기화
          </button>
        </div>
      </header>

      {mode !== 'view' && (
        <div className="draw-banner">
          <span>
            {mode === 'draw' ? '🖌️ 새 프로빈스 그리기' : '✂️ 분할 영역 그리기'} — 지도를
            클릭해 점을 찍으세요 (현재 {draft.length}점). 자를/만들 영역을 폴리곤으로 그린 뒤
            완료하세요.
          </span>
          <span className="spacer" />
          <button onClick={undoPoint} disabled={!draft.length}>
            ↩︎ 마지막 점
          </button>
          <button
            className="primary"
            onClick={mode === 'draw' ? finishDraw : finishSplit}
          >
            ✓ 완료
          </button>
          <button onClick={cancelEdit}>취소</button>
        </div>
      )}

      <div className="body">
        <div className="map-wrap">
          {err && <div className="loading">{err}</div>}
          {!topo && !err && <div className="loading">지도 불러오는 중…</div>}
          {topo && projection && (
            <MapCanvas
              ref={mapRef}
              features={features}
              projection={projection}
              pathFor={pathFor}
              fills={display.fills}
              labels={display.labels}
              selectedIds={selectedIds}
              mode={mode}
              draft={draft}
              onSelectAt={onSelectAt}
              onAddPoint={(ll) => setDraft((d) => [...d, ll])}
            />
          )}
        </div>

        <aside className="panel">
          {countryCode ? (
            <CountryPanel
              code={countryCode}
              name={countryNameOf(countryCode)}
              color={edits.countryColors[countryCode] ?? defaultCountryColor(countryCode)}
              isColorSet={edits.countryColors[countryCode] !== undefined}
              provinceCount={(idsByCountry.get(countryCode) ?? []).length}
              info={edits.countryInfo[countryCode] ?? []}
              onName={(n) => setCountryName(countryCode, n)}
              onColor={(h) => setCountryColor(countryCode, h)}
              onResetColor={() => resetCountryColor(countryCode)}
              onInfo={(i) => setCountryInfo(countryCode, i)}
              onClose={() => {
                setCountryCode(null);
                setSelectedIds([]);
              }}
            />
          ) : single ? (
            <ProvincePanel
              p={single}
              effCode={effCode(single)}
              color={provColorOf(single.id, effCode(single))}
              hasColor={edits.provinceColors[single.id] !== undefined}
              name={provNameOf(single)}
              info={edits.provinceInfo[single.id] ?? []}
              countries={countryOptions}
              onName={(n) => setProvName(single.id, n)}
              onColor={(h) => setProvColor(single.id, h)}
              onResetColor={() => resetProvColor(single.id)}
              onReassign={(code) => reassign(single, code)}
              onInfo={(i) => setProvInfo(single.id, i)}
              onSplit={() => startSplit(single.id)}
              onDelete={() => deleteProvince(single.id)}
              onClose={() => setSelectedIds([])}
            />
          ) : selectedIds.length > 1 ? (
            <div className="multi-panel">
              <h3>{selectedIds.length}개 프로빈스 선택됨</h3>
              <p className="hint">Shift+클릭으로 더 선택할 수 있어요.</p>
              <button className="primary wide" onClick={mergeSelected}>
                🔗 선택 항목 병합
              </button>
              <button className="link" onClick={() => setSelectedIds([])}>
                선택 해제
              </button>
            </div>
          ) : (
            <HelpPanel />
          )}
        </aside>
      </div>
    </div>
  );
}

function HelpPanel() {
  return (
    <div className="panel-empty">
      <h3>지도를 클릭해 편집</h3>
      <ul>
        <li>
          <b>좌클릭</b> — 프로빈스 선택 (색·이름·정보 편집)
        </li>
        <li>
          <b>Alt + 좌클릭</b> — 국가 전체 선택 → 국가 상태창
        </li>
        <li>
          <b>Shift + 좌클릭</b> — 여러 프로빈스 선택 → 병합
        </li>
        <li>
          <b>✏️ 새 프로빈스</b> — 폴리곤을 그려 새 행정구역 생성
        </li>
        <li>
          <b>✂️ 분할</b> — 프로빈스 위에 영역을 그려 둘로 나눔
        </li>
        <li>드래그 이동 · 휠/버튼 확대축소</li>
      </ul>
    </div>
  );
}

// ── 상세정보 편집기 ──
function InfoEditor({ info, onChange }: { info: KV[]; onChange: (i: KV[]) => void }) {
  return (
    <div className="info-editor">
      {info.map((kv) => (
        <div className="kv-row" key={kv.id}>
          <input
            className="kv-label"
            value={kv.label}
            placeholder="항목"
            onChange={(e) =>
              onChange(info.map((x) => (x.id === kv.id ? { ...x, label: e.target.value } : x)))
            }
          />
          <input
            className="kv-value"
            value={kv.value}
            placeholder="값"
            onChange={(e) =>
              onChange(info.map((x) => (x.id === kv.id ? { ...x, value: e.target.value } : x)))
            }
          />
          <button
            className="del-field"
            onClick={() => onChange(info.filter((x) => x.id !== kv.id))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="link"
        onClick={() => onChange([...info, { id: uid('kv'), label: '', value: '' }])}
      >
        + 항목 추가
      </button>
    </div>
  );
}

// ── 프로빈스 패널 ──
interface PP {
  p: Province;
  effCode: string;
  color: string;
  hasColor: boolean;
  name: string;
  info: KV[];
  countries: { code: string; name: string }[];
  onName: (n: string) => void;
  onColor: (h: string) => void;
  onResetColor: () => void;
  onReassign: (code: string) => void;
  onInfo: (i: KV[]) => void;
  onSplit: () => void;
  onDelete: () => void;
  onClose: () => void;
}
function ProvincePanel(pp: PP) {
  const reassigned = pp.effCode !== pp.p.countryCode;
  return (
    <div className="detail-panel">
      <div className="dp-head">
        <span className="swatch" style={{ background: pp.color }} />
        <h3>{pp.name}</h3>
        <button className="close" onClick={pp.onClose}>
          ✕
        </button>
      </div>

      <section className="fb">
        <label className="fl">프로빈스 이름</label>
        <input value={pp.name} onChange={(e) => pp.onName(e.target.value)} />
        <div className="hint">
          {pp.p.type || '행정구역'} · ID {pp.p.id}
        </div>
      </section>

      <section className="fb">
        <label className="fl">프로빈스 색</label>
        <div className="color-row">
          <input type="color" value={pp.color} onChange={(e) => pp.onColor(e.target.value)} />
          <code>{pp.color}</code>
          {pp.hasColor && (
            <button className="link" onClick={pp.onResetColor}>
              국가색 따르기
            </button>
          )}
        </div>
      </section>

      <section className="fb">
        <label className="fl">소속 국가</label>
        <select value={pp.effCode} onChange={(e) => pp.onReassign(e.target.value)}>
          {pp.countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
        {reassigned && (
          <div className="hint warn">원래 소속: {pp.p.countryName} ({pp.p.countryCode})</div>
        )}
      </section>

      <section className="fb">
        <label className="fl">상세정보</label>
        <InfoEditor info={pp.info} onChange={pp.onInfo} />
      </section>

      <div className="panel-actions">
        <button className="wide" onClick={pp.onSplit}>
          ✂️ 이 프로빈스 분할
        </button>
        <button className="wide danger" onClick={pp.onDelete}>
          🗑 삭제
        </button>
      </div>
    </div>
  );
}

// ── 국가 상태창 ──
interface CP {
  code: string;
  name: string;
  color: string;
  isColorSet: boolean;
  provinceCount: number;
  info: KV[];
  onName: (n: string) => void;
  onColor: (h: string) => void;
  onResetColor: () => void;
  onInfo: (i: KV[]) => void;
  onClose: () => void;
}
function CountryPanel(cp: CP) {
  return (
    <div className="detail-panel">
      <div className="dp-head">
        <span className="swatch" style={{ background: cp.color }} />
        <h3>{cp.name}</h3>
        <button className="close" onClick={cp.onClose}>
          ✕
        </button>
      </div>
      <div className="country-badge">
        국가 상태창 · {cp.code} · {cp.provinceCount}개 행정구역
      </div>

      <section className="fb">
        <label className="fl">국가 이름</label>
        <input value={cp.name} onChange={(e) => cp.onName(e.target.value)} />
      </section>

      <section className="fb">
        <label className="fl">국가 색 (전체 프로빈스 적용)</label>
        <div className="color-row">
          <input type="color" value={cp.color} onChange={(e) => cp.onColor(e.target.value)} />
          <code>{cp.color}</code>
          {cp.isColorSet && (
            <button className="link" onClick={cp.onResetColor}>
              기본색으로
            </button>
          )}
        </div>
      </section>

      <section className="fb">
        <label className="fl">국가 상세정보</label>
        <InfoEditor info={cp.info} onChange={cp.onInfo} />
      </section>
    </div>
  );
}
