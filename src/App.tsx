import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Category,
  Consequence,
  Country,
  Field,
  REGIONS,
  ScenarioEvent,
  WorldState,
  uid,
} from './types';
import { seedWorld } from './data';
import {
  MetricKey,
  METRIC_OPTIONS,
  WorldStats,
  computeStats,
  fmtMetric,
  getMetric,
  intl,
} from './metrics';

const STORAGE_KEY = 'worldsim.v3';

function loadWorld(): WorldState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as WorldState;
      if (!Array.isArray(data.events)) data.events = []; // 구버전 데이터 호환
      return data;
    }
  } catch {
    /* 손상된 데이터는 무시하고 새로 시작 */
  }
  return seedWorld();
}

export default function App() {
  const [world, setWorld] = useState<WorldState>(loadWorld);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => world.countries[0]?.id ?? null
  );
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<'region' | MetricKey>('region');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showStats, setShowStats] = useState(false);
  const [view, setView] = useState<'countries' | 'scenario'>('countries');
  const [eventSortDir, setEventSortDir] = useState<'asc' | 'desc'>('asc');
  const fileInput = useRef<HTMLInputElement>(null);

  // 모든 변경은 자동으로 로컬 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(world));
  }, [world]);

  const selected = useMemo(
    () => world.countries.find((c) => c.id === selectedId) ?? null,
    [world, selectedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return world.countries;
    return world.countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q)
    );
  }, [world.countries, query]);

  // 대륙별로 묶어 사이드바에 표시 (REGIONS 순서 유지)
  const grouped = useMemo(() => {
    const order = [...REGIONS] as string[];
    const map = new Map<string, Country[]>();
    for (const c of filtered) {
      const key = order.includes(c.region) ? c.region : '기타';
      (map.get(key) ?? map.set(key, []).get(key)!).push(c);
    }
    return order
      .filter((r) => map.has(r))
      .map((r) => ({ region: r, countries: map.get(r)! }));
  }, [filtered]);

  // 정렬된 평면 목록 (sortKey가 '대륙별'이 아닐 때 사용)
  const sorted = useMemo(() => {
    if (sortKey === 'region') return [];
    const dir = sortDir === 'asc' ? 1 : -1;
    const list = [...filtered];
    list.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'ko') * dir;
      const av = getMetric(a, sortKey);
      const bv = getMetric(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // 값 없음은 항상 뒤로
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const stats = useMemo<WorldStats>(() => computeStats(filtered), [filtered]);

  const isGrouped = sortKey === 'region';

  // --- 국가 단위 조작 -------------------------------------------------
  function updateCountry(id: string, fn: (c: Country) => Country) {
    setWorld((w) => ({
      ...w,
      countries: w.countries.map((c) => (c.id === id ? fn(c) : c)),
    }));
  }

  function addCountry() {
    const c: Country = {
      id: uid('country'),
      name: '새 국가',
      flag: '🏳️',
      region: '기타',
      categories: [
        {
          id: uid('cat'),
          name: '기본',
          fields: [
            { id: uid('field'), label: '수도', value: '' },
            { id: uid('field'), label: '인구', value: '' },
            { id: uid('field'), label: '면적', value: '' },
          ],
        },
      ],
    };
    setWorld((w) => ({ ...w, countries: [...w.countries, c] }));
    setSelectedId(c.id);
  }

  function deleteCountry(id: string) {
    const c = world.countries.find((x) => x.id === id);
    if (!c) return;
    if (!confirm(`"${c.name}" 국가를 삭제할까요?`)) return;
    setWorld((w) => ({
      ...w,
      countries: w.countries.filter((x) => x.id !== id),
    }));
    if (selectedId === id) {
      setSelectedId(world.countries.find((x) => x.id !== id)?.id ?? null);
    }
  }

  // --- 카테고리 / 항목 조작 -------------------------------------------
  function addCategory(countryId: string) {
    updateCountry(countryId, (c) => ({
      ...c,
      categories: [
        ...c.categories,
        { id: uid('cat'), name: '새 분류', fields: [] },
      ],
    }));
  }

  function updateCategory(
    countryId: string,
    catId: string,
    fn: (cat: Category) => Category
  ) {
    updateCountry(countryId, (c) => ({
      ...c,
      categories: c.categories.map((cat) =>
        cat.id === catId ? fn(cat) : cat
      ),
    }));
  }

  function deleteCategory(countryId: string, catId: string) {
    updateCountry(countryId, (c) => ({
      ...c,
      categories: c.categories.filter((cat) => cat.id !== catId),
    }));
  }

  function addField(countryId: string, catId: string) {
    updateCategory(countryId, catId, (cat) => ({
      ...cat,
      fields: [...cat.fields, { id: uid('field'), label: '새 항목', value: '' }],
    }));
  }

  function updateField(
    countryId: string,
    catId: string,
    fieldId: string,
    patch: Partial<Field>
  ) {
    updateCategory(countryId, catId, (cat) => ({
      ...cat,
      fields: cat.fields.map((f) =>
        f.id === fieldId ? { ...f, ...patch } : f
      ),
    }));
  }

  function deleteField(countryId: string, catId: string, fieldId: string) {
    updateCategory(countryId, catId, (cat) => ({
      ...cat,
      fields: cat.fields.filter((f) => f.id !== fieldId),
    }));
  }

  // --- 가져오기 / 내보내기 / 초기화 -----------------------------------
  function exportJson() {
    const blob = new Blob([JSON.stringify(world, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worldsim-${world.asOf}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as WorldState;
        if (!Array.isArray(data.countries)) throw new Error('형식 오류');
        setWorld(data);
        setSelectedId(data.countries[0]?.id ?? null);
      } catch {
        alert('JSON 파일을 읽을 수 없습니다.');
      }
    };
    reader.readAsText(file);
  }

  function resetWorld() {
    if (!confirm('모든 편집 내용을 버리고 초기 데이터로 되돌릴까요?')) return;
    const fresh = seedWorld();
    setWorld(fresh);
    setSelectedId(fresh.countries[0]?.id ?? null);
  }

  // --- 시나리오(사건) 조작 -------------------------------------------
  const sortedEvents = useMemo(() => {
    const dir = eventSortDir === 'asc' ? 1 : -1;
    return [...world.events].sort(
      (a, b) => a.date.localeCompare(b.date) * dir
    );
  }, [world.events, eventSortDir]);

  function addEvent() {
    const ev: ScenarioEvent = {
      id: uid('event'),
      date: world.asOf || '2026-01-01',
      title: '새 사건',
      description: '',
      countries: [],
      consequences: [],
    };
    setWorld((w) => ({ ...w, events: [...w.events, ev] }));
  }

  function updateEvent(id: string, patch: Partial<ScenarioEvent>) {
    setWorld((w) => ({
      ...w,
      events: w.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }

  function deleteEvent(id: string) {
    const ev = world.events.find((e) => e.id === id);
    if (ev && !confirm(`"${ev.title}" 사건을 삭제할까요?`)) return;
    setWorld((w) => ({ ...w, events: w.events.filter((e) => e.id !== id) }));
  }

  function addConsequence(eventId: string) {
    updateEvent(eventId, {
      consequences: [
        ...(world.events.find((e) => e.id === eventId)?.consequences ?? []),
        { id: uid('cons'), text: '' },
      ],
    });
  }

  function updateConsequence(eventId: string, consId: string, text: string) {
    const ev = world.events.find((e) => e.id === eventId);
    if (!ev) return;
    updateEvent(eventId, {
      consequences: ev.consequences.map((c) =>
        c.id === consId ? { ...c, text } : c
      ),
    });
  }

  function deleteConsequence(eventId: string, consId: string) {
    const ev = world.events.find((e) => e.id === eventId);
    if (!ev) return;
    updateEvent(eventId, {
      consequences: ev.consequences.filter((c) => c.id !== consId),
    });
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          🌍 <strong>WorldSim</strong>
          <span className="sub">지구 편집기</span>
        </div>
        <div className="tabs">
          <button
            className={view === 'countries' ? 'tab active' : 'tab'}
            onClick={() => setView('countries')}
          >
            🌍 국가
          </button>
          <button
            className={view === 'scenario' ? 'tab active' : 'tab'}
            onClick={() => setView('scenario')}
          >
            📜 시나리오
          </button>
        </div>
        <label className="asof">
          기준일
          <input
            value={world.asOf}
            onChange={(e) =>
              setWorld((w) => ({ ...w, asOf: e.target.value }))
            }
          />
        </label>
        <div className="actions">
          {view === 'countries' && (
            <button className="primary" onClick={() => setShowStats(true)}>
              📊 통계
            </button>
          )}
          <button onClick={exportJson}>내보내기</button>
          <button onClick={() => fileInput.current?.click()}>가져오기</button>
          <button className="danger" onClick={resetWorld}>
            초기화
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {view === 'scenario' ? (
        <ScenarioEditor
          events={sortedEvents}
          sortDir={eventSortDir}
          onToggleSort={() =>
            setEventSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
          }
          onAdd={addEvent}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
          onAddConsequence={addConsequence}
          onUpdateConsequence={updateConsequence}
          onDeleteConsequence={deleteConsequence}
        />
      ) : (
      <div className="body">
        <aside className="sidebar">
          <input
            className="search"
            placeholder="국가 검색…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="sort-bar">
            <select
              className="sort-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as 'region' | MetricKey)}
            >
              <option value="region">대륙별 (기본)</option>
              {METRIC_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              className="sort-dir"
              title={sortDir === 'asc' ? '오름차순' : '내림차순'}
              disabled={isGrouped}
              onClick={() =>
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
              }
            >
              {sortDir === 'asc' ? '▲' : '▼'}
            </button>
          </div>
          <div className="country-list">
            {isGrouped ? (
              <>
                {grouped.map((g) => (
                  <div className="region-group" key={g.region}>
                    <div className="region-head">
                      {g.region}{' '}
                      <span className="region-count">{g.countries.length}</span>
                    </div>
                    <ul>
                      {g.countries.map((c) => (
                        <li
                          key={c.id}
                          className={c.id === selectedId ? 'active' : ''}
                          onClick={() => setSelectedId(c.id)}
                        >
                          <span className="flag">{c.flag}</span>
                          <span className="name">{c.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {grouped.length === 0 && (
                  <div className="no-result">검색 결과 없음</div>
                )}
              </>
            ) : (
              <ul className="ranked">
                {sorted.map((c, i) => (
                  <li
                    key={c.id}
                    className={c.id === selectedId ? 'active' : ''}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <span className="rank">{i + 1}</span>
                    <span className="flag">{c.flag}</span>
                    <span className="name">{c.name}</span>
                    {sortKey !== 'name' && (
                      <span className="metric">
                        {fmtMetric(sortKey, getMetric(c, sortKey))}
                      </span>
                    )}
                  </li>
                ))}
                {sorted.length === 0 && (
                  <div className="no-result">검색 결과 없음</div>
                )}
              </ul>
            )}
          </div>
          <button className="add-country" onClick={addCountry}>
            + 국가 추가
          </button>
          <div className="count">총 {world.countries.length}개국</div>
        </aside>

        <main className="detail">
          {selected ? (
            <CountryEditor
              country={selected}
              onName={(name) =>
                updateCountry(selected.id, (c) => ({ ...c, name }))
              }
              onFlag={(flag) =>
                updateCountry(selected.id, (c) => ({ ...c, flag }))
              }
              onRegion={(region) =>
                updateCountry(selected.id, (c) => ({ ...c, region }))
              }
              onDelete={() => deleteCountry(selected.id)}
              onAddCategory={() => addCategory(selected.id)}
              onCategoryName={(catId, name) =>
                updateCategory(selected.id, catId, (cat) => ({ ...cat, name }))
              }
              onDeleteCategory={(catId) =>
                deleteCategory(selected.id, catId)
              }
              onAddField={(catId) => addField(selected.id, catId)}
              onField={(catId, fieldId, patch) =>
                updateField(selected.id, catId, fieldId, patch)
              }
              onDeleteField={(catId, fieldId) =>
                deleteField(selected.id, catId, fieldId)
              }
            />
          ) : (
            <div className="empty">왼쪽에서 국가를 선택하거나 추가하세요.</div>
          )}
        </main>
      </div>
      )}

      {showStats && (
        <StatsPanel
          stats={stats}
          asOf={world.asOf}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}

interface ScenarioProps {
  events: ScenarioEvent[];
  sortDir: 'asc' | 'desc';
  onToggleSort: () => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<ScenarioEvent>) => void;
  onDelete: (id: string) => void;
  onAddConsequence: (eventId: string) => void;
  onUpdateConsequence: (eventId: string, consId: string, text: string) => void;
  onDeleteConsequence: (eventId: string, consId: string) => void;
}

function ScenarioEditor(p: ScenarioProps) {
  return (
    <main className="scenario">
      <div className="scenario-head">
        <h2>📜 시나리오 타임라인</h2>
        <span className="scenario-sub">{p.events.length}개 사건</span>
        <div className="scenario-actions">
          <button onClick={p.onToggleSort}>
            날짜 {p.sortDir === 'asc' ? '오래된순 ▲' : '최신순 ▼'}
          </button>
          <button className="primary" onClick={p.onAdd}>
            + 사건 추가
          </button>
        </div>
      </div>

      {p.events.length === 0 ? (
        <div className="empty">
          아직 기록된 사건이 없습니다. <b>+ 사건 추가</b>로 시작하세요.
        </div>
      ) : (
        <div className="timeline">
          {p.events.map((ev) => (
            <EventCard
              key={ev.id}
              ev={ev}
              onUpdate={(patch) => p.onUpdate(ev.id, patch)}
              onDelete={() => p.onDelete(ev.id)}
              onAddConsequence={() => p.onAddConsequence(ev.id)}
              onUpdateConsequence={(cid, text) =>
                p.onUpdateConsequence(ev.id, cid, text)
              }
              onDeleteConsequence={(cid) => p.onDeleteConsequence(ev.id, cid)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function EventCard({
  ev,
  onUpdate,
  onDelete,
  onAddConsequence,
  onUpdateConsequence,
  onDeleteConsequence,
}: {
  ev: ScenarioEvent;
  onUpdate: (patch: Partial<ScenarioEvent>) => void;
  onDelete: () => void;
  onAddConsequence: () => void;
  onUpdateConsequence: (consId: string, text: string) => void;
  onDeleteConsequence: (consId: string) => void;
}) {
  return (
    <article className="event-card">
      <div className="event-line" />
      <div className="event-dot" />
      <div className="event-body">
        <div className="event-top">
          <input
            className="event-date"
            type="date"
            value={ev.date}
            onChange={(e) => onUpdate({ date: e.target.value })}
          />
          <input
            className="event-title"
            value={ev.title}
            placeholder="사건 제목"
            onChange={(e) => onUpdate({ title: e.target.value })}
          />
          <button className="link danger" onClick={onDelete}>
            삭제
          </button>
        </div>

        <textarea
          className="event-desc"
          value={ev.description}
          placeholder="무슨 일이 일어났는지 설명…"
          rows={2}
          onChange={(e) => onUpdate({ description: e.target.value })}
        />

        <label className="event-field">
          <span>관련국</span>
          <input
            value={ev.countries.join(', ')}
            placeholder="예: 대한민국, 미국, 중국 (쉼표로 구분)"
            onChange={(e) =>
              onUpdate({
                countries: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>

        <div className="consequences">
          <div className="consequences-head">결과</div>
          {ev.consequences.map((c: Consequence) => (
            <div className="cons-row" key={c.id}>
              <span className="cons-bullet">→</span>
              <input
                value={c.text}
                placeholder="그에 따른 결과…"
                onChange={(e) => onUpdateConsequence(c.id, e.target.value)}
              />
              <button
                className="del-field"
                title="결과 삭제"
                onClick={() => onDeleteConsequence(c.id)}
              >
                ×
              </button>
            </div>
          ))}
          <button className="link" onClick={onAddConsequence}>
            + 결과 추가
          </button>
        </div>
      </div>
    </article>
  );
}

function StatsPanel({
  stats,
  asOf,
  onClose,
}: {
  stats: WorldStats;
  asOf: string;
  onClose: () => void;
}) {
  const cards: { label: string; value: string }[] = [
    { label: '국가 수', value: `${stats.count}개국` },
    {
      label: '총인구',
      value: `${intl(stats.totalPopulation)}명 (약 ${(stats.totalPopulation / 1e8).toFixed(1)}억)`,
    },
    { label: '총면적', value: `${intl(stats.totalArea)} km²` },
    {
      label: 'GDP 합계 (명목)',
      value: `$${(stats.totalGdp / 1000).toFixed(1)}T`,
    },
    { label: '평균 1인당 GDP', value: `$${intl(stats.avgGdpPerCapita)}` },
    { label: '평균 합계출산율', value: stats.avgBirthRate.toFixed(2) },
    { label: '평균 기대수명', value: `${stats.avgLifeExp.toFixed(1)}세` },
    { label: '평균 도시화율', value: `${stats.avgUrban.toFixed(0)}%` },
    { label: '전체 인구밀도', value: `${stats.density.toFixed(1)} 명/km²` },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>📊 세계 통계</h2>
          <span className="modal-sub">현재 목록 기준 · {asOf}</span>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="stat-grid">
          {cards.map((c) => (
            <div className="stat-card" key={c.label}>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="top-lists">
          <TopList title="인구 상위 5개국" rows={stats.topPopulation} unit="명" />
          <TopList
            title="GDP 상위 5개국"
            rows={stats.topGdp}
            unit="B"
            money
          />
        </div>
      </div>
    </div>
  );
}

function TopList({
  title,
  rows,
  unit,
  money,
}: {
  title: string;
  rows: { name: string; flag: string; value: number }[];
  unit: string;
  money?: boolean;
}) {
  return (
    <div className="top-list">
      <h3>{title}</h3>
      <ol>
        {rows.map((r) => (
          <li key={r.name}>
            <span className="flag">{r.flag}</span>
            <span className="name">{r.name}</span>
            <span className="val">
              {money
                ? r.value >= 1000
                  ? `$${(r.value / 1000).toFixed(2)}T`
                  : `$${intl(r.value)}B`
                : `${intl(r.value)}${unit}`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface EditorProps {
  country: Country;
  onName: (name: string) => void;
  onFlag: (flag: string) => void;
  onRegion: (region: string) => void;
  onDelete: () => void;
  onAddCategory: () => void;
  onCategoryName: (catId: string, name: string) => void;
  onDeleteCategory: (catId: string) => void;
  onAddField: (catId: string) => void;
  onField: (catId: string, fieldId: string, patch: Partial<Field>) => void;
  onDeleteField: (catId: string, fieldId: string) => void;
}

function CountryEditor(p: EditorProps) {
  const { country } = p;
  return (
    <div className="editor">
      <div className="editor-head">
        <input
          className="flag-input"
          value={country.flag}
          onChange={(e) => p.onFlag(e.target.value)}
          title="국기 이모지"
        />
        <input
          className="name-input"
          value={country.name}
          onChange={(e) => p.onName(e.target.value)}
        />
        <select
          className="region-select"
          value={REGIONS.includes(country.region as never) ? country.region : '기타'}
          onChange={(e) => p.onRegion(e.target.value)}
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button className="danger" onClick={p.onDelete}>
          국가 삭제
        </button>
      </div>

      {country.categories.map((cat) => (
        <section className="category" key={cat.id}>
          <div className="category-head">
            <input
              className="category-name"
              value={cat.name}
              onChange={(e) => p.onCategoryName(cat.id, e.target.value)}
            />
            <button
              className="link danger"
              onClick={() => p.onDeleteCategory(cat.id)}
            >
              분류 삭제
            </button>
          </div>

          <div className="fields">
            {cat.fields.map((f) => (
              <div className="field-row" key={f.id}>
                <input
                  className="field-label"
                  value={f.label}
                  onChange={(e) =>
                    p.onField(cat.id, f.id, { label: e.target.value })
                  }
                />
                <input
                  className="field-value"
                  value={f.value}
                  placeholder="값 입력…"
                  onChange={(e) =>
                    p.onField(cat.id, f.id, { value: e.target.value })
                  }
                />
                <button
                  className="del-field"
                  title="항목 삭제"
                  onClick={() => p.onDeleteField(cat.id, f.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button className="link" onClick={() => p.onAddField(cat.id)}>
            + 항목 추가
          </button>
        </section>
      ))}

      <button className="add-category" onClick={p.onAddCategory}>
        + 분류 추가
      </button>
    </div>
  );
}
