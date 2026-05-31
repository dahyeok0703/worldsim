import { useEffect, useMemo, useRef, useState } from 'react';
import { Category, Country, Field, WorldState, uid } from './types';
import { seedWorld } from './data';

const STORAGE_KEY = 'worldsim.v1';

function loadWorld(): WorldState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as WorldState;
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
    return world.countries.filter((c) => c.name.toLowerCase().includes(q));
  }, [world.countries, query]);

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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          🌍 <strong>WorldSim</strong>
          <span className="sub">지구 편집기</span>
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

      <div className="body">
        <aside className="sidebar">
          <input
            className="search"
            placeholder="국가 검색…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="country-list">
            {filtered.map((c) => (
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
    </div>
  );
}

interface EditorProps {
  country: Country;
  onName: (name: string) => void;
  onFlag: (flag: string) => void;
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
