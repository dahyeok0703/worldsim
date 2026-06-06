import { useEffect, useReducer, useState } from 'react';
import { GameState, STAT_DESC, STAT_LABEL, StatKey, Stats } from './types';
import { ITEMS, RECIPES, SPOT_TYPES } from './world';
import {
  SKILLS, buildGame, consume, craft, curRegion, curSpot, itemCount,
  maxHp, maxSanity, moveSpot, rest, resolvePending, scavenge, seaDestinations, seaTravel,
  secureBase, skirmish, travelRegion, tryVaccine, useMolotov,
} from './sim';

const SAVE = 'zombie-openworld.v1';
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const cap = (s: GameState): GameState => ({ ...s, log: s.log.slice(-60) });
const r1 = (n: number) => Math.max(0, Math.round(n));

type Action =
  | { type: 'NEW' } | { type: 'LOAD'; s: GameState } | { type: 'RESTART' }
  | { type: 'CREATE'; name: string; stats: Stats }
  | { type: 'ALLOC'; k: StatKey } | { type: 'EQUIP'; id: string }
  | { type: 'DO'; fn: (s: GameState) => void }
  | { type: 'PENDING'; key: string };

function titleState(): GameState {
  return { phase: 'title', player: {} as never, regions: {}, log: [] };
}

function reducer(state: GameState, a: Action): GameState {
  switch (a.type) {
    case 'NEW': return { ...state, phase: 'create' };
    case 'LOAD': return a.s;
    case 'RESTART': return titleState();
    case 'CREATE': return cap(buildGame(a.name, a.stats));
    case 'ALLOC': {
      if (state.player.statPoints <= 0) return state;
      const s = clone(state); s.player.stats[a.k]++; s.player.statPoints--;
      if (a.k === 'VIT') s.player.hp += 10; if (a.k === 'WIL') s.player.sanity += 8;
      return s;
    }
    case 'EQUIP': { const s = clone(state); if (itemCount(s.player, a.id) > 0) s.player.equipped = a.id; return s; }
    case 'PENDING': { const s = clone(state); resolvePending(s, a.key); return cap(s); }
    case 'DO': { const s = clone(state); a.fn(s); return cap(s); }
    default: return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, titleState);
  const [hasSave, setHasSave] = useState(false);
  useEffect(() => { setHasSave(!!localStorage.getItem(SAVE)); }, []);
  useEffect(() => {
    if (state.phase === 'play' || state.phase === 'dead') {
      localStorage.setItem(SAVE, JSON.stringify(state)); setHasSave(true);
    }
  }, [state]);

  if (state.phase === 'title')
    return <Title hasSave={hasSave} onNew={() => dispatch({ type: 'NEW' })}
      onCont={() => { const raw = localStorage.getItem(SAVE); if (raw) dispatch({ type: 'LOAD', s: JSON.parse(raw) }); }} />;
  if (state.phase === 'create')
    return <Create onStart={(name, stats) => dispatch({ type: 'CREATE', name, stats })} />;

  return (
    <div className="app">
      <TopBar state={state} />
      <div className="play">
        <Status state={state} dispatch={dispatch} />
        <main className="stage">
          {state.phase === 'dead'
            ? <Death state={state} onRestart={() => dispatch({ type: 'RESTART' })} />
            : <Actions state={state} dispatch={dispatch} />}
          <Log log={state.log} />
        </main>
      </div>
      {state.pending && (
        <div className="modal-bg">
          <div className="modal">
            <h3>{state.pending.title}</h3>
            <p>{state.pending.text}</p>
            <div className="modal-choices">
              {state.pending.choices.map((c) => (
                <button key={c.key} onClick={() => dispatch({ type: 'PENDING', key: c.key })}>{c.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bar({ v, max, kind }: { v: number; max: number; kind: string }) {
  return (
    <div className={`bar ${kind}`}>
      <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} />
      <span className="bar-text">{r1(v)}/{r1(max)}</span>
    </div>
  );
}

function Title({ hasSave, onNew, onCont }: { hasSave: boolean; onNew: () => void; onCont: () => void }) {
  return (
    <div className="title">
      <h1>감염 대한민국</h1>
      <p className="tagline">2026 · 오픈월드 생존 시뮬</p>
      <p className="blurb">실제 한국 17개 시도와 세계를 무대로,<br />정해진 길 없이 자유롭게 살아남아라.<br />당신에겐 오직 자신만 보는 「시스템」이 있다.</p>
      <div className="title-btns">
        {hasSave && <button className="primary" onClick={onCont}>이어하기</button>}
        <button className={hasSave ? '' : 'primary'} onClick={onNew}>새 게임</button>
      </div>
    </div>
  );
}

function Create({ onStart }: { onStart: (name: string, stats: Stats) => void }) {
  const [name, setName] = useState('');
  const [stats, setStats] = useState<Stats>({ STR: 5, AGI: 5, VIT: 5, PER: 5, WIL: 5 });
  const [pts, setPts] = useState(5);
  const inc = (k: StatKey) => { if (pts > 0) { setStats({ ...stats, [k]: stats[k] + 1 }); setPts(pts - 1); } };
  const dec = (k: StatKey) => { if (stats[k] > 5) { setStats({ ...stats, [k]: stats[k] - 1 }); setPts(pts + 1); } };
  return (
    <div className="create">
      <h2>생존자 등록</h2>
      <label className="fl">이름</label>
      <input value={name} maxLength={12} placeholder="이름을 입력…" onChange={(e) => setName(e.target.value)} />
      <div className="alloc-head">능력치 분배 <span className="pts">남은 {pts}</span></div>
      {(Object.keys(stats) as StatKey[]).map((k) => (
        <div className="alloc-row" key={k}>
          <div className="alloc-name">{STAT_LABEL[k]} <em>{STAT_DESC[k]}</em></div>
          <div className="alloc-ctl">
            <button onClick={() => dec(k)} disabled={stats[k] <= 5}>−</button>
            <b>{stats[k]}</b>
            <button onClick={() => inc(k)} disabled={pts <= 0}>＋</button>
          </div>
        </div>
      ))}
      <div className="ability-card"><b>◈ 고유 능력 · 포식</b>
        <p>처치한 감염체의 잔재를 흡수해 드물게 능력치가 영구히 오른다. 레벨업으로 생존본능·응급처치·도살자·그림자를 습득한다.</p></div>
      <button className="primary wide" onClick={() => onStart(name, stats)}>도시로</button>
    </div>
  );
}

function TopBar({ state }: { state: GameState }) {
  const p = state.player; const reg = curRegion(state);
  const labHint = p.flags['labRumor'] as string | undefined;
  return (
    <header className="topbar">
      <div className="brand">🧟 감염 대한민국</div>
      <div className="clock">{p.day}일차 · {String(p.hour).padStart(2, '0')}:00 {p.hour >= 21 || p.hour < 6 ? '🌙' : '☀'}</div>
      <div className="loc">{reg.name}{reg.overseas ? ' 🌐' : ''} · 감염도 {r1(reg.infestation)}%</div>
      {p.flags['vaccine'] ? <div className="goal done">🧪 백신 확보 완료</div>
        : labHint ? <div className="goal">목표 단서: {state.regions[labHint].name} 연구소</div> : <span />}
    </header>
  );
}

function Status({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Action> }) {
  const p = state.player;
  const weapon = p.equipped ? ITEMS[p.equipped] : null;
  const invEntries = Object.entries(p.inv).filter(([, q]) => q > 0);
  return (
    <aside className="status">
      <div className="st-head"><h3>{p.name}</h3><span className="lv">Lv.{p.level}</span></div>
      <div className="st-bars">
        {[['HP', p.hp, maxHp(p), 'hp'], ['정신', p.sanity, maxSanity(p), 'mental'],
          ['포만', p.food, 100, 'food'], ['수분', p.water, 100, 'water'],
          ['기력', p.energy, 100, 'energy'], ['감염', p.infection, 100, 'infect']].map(
          ([lab, v, m, k]) => (
            <div key={lab as string}><div className="st-line">{lab}</div><Bar v={v as number} max={m as number} kind={k as string} /></div>
          ))}
        <div className="st-line">EXP</div>
        <Bar v={p.exp} max={70 + p.level * 45} kind="exp" />
      </div>
      <div className="st-section">
        <div className="st-title">능력치 {p.statPoints > 0 && <span className="pts">+{p.statPoints}</span>}</div>
        {(Object.keys(p.stats) as StatKey[]).map((k) => (
          <div className="st-stat" key={k} title={STAT_DESC[k]}>
            <span>{STAT_LABEL[k]}</span><b>{p.stats[k]}</b>
            {p.statPoints > 0 && <button className="mini" onClick={() => dispatch({ type: 'ALLOC', k })}>＋</button>}
          </div>
        ))}
      </div>
      <div className="st-section">
        <div className="st-title">무기 · 스킬</div>
        <div className="equipped">🗡 {weapon ? `${weapon.name} (+${weapon.atk})` : '맨손'}</div>
        <div className="skills">{p.skills.map((id) => <span className="chip" key={id} title={SKILLS[id]?.desc}>{SKILLS[id]?.name}</span>)}</div>
      </div>
      <div className="st-section">
        <div className="st-title">소지품</div>
        <div className="inv">
          {invEntries.length === 0 && <div className="muted">비어 있음</div>}
          {invEntries.map(([id, q]) => {
            const it = ITEMS[id]; if (!it) return null;
            return (
              <div className="inv-row" key={id} title={it.desc}>
                <span>{it.name} ×{q}</span>
                {it.type === 'weapon' && p.equipped !== id && <button className="mini" onClick={() => dispatch({ type: 'EQUIP', id })}>장착</button>}
                {p.equipped === id && <span className="tag">장착</span>}
                {(it.type === 'food' || it.type === 'water' || it.type === 'med') && state.phase === 'play' &&
                  <button className="mini" onClick={() => dispatch({ type: 'DO', fn: (s) => consume(s, id) })}>사용</button>}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function Actions({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Action> }) {
  const [menu, setMenu] = useState<'' | 'fight' | 'craft'>('');
  const p = state.player; const sp = curSpot(state)!; const reg = curRegion(state);
  const td = SPOT_TYPES[sp.type];
  const DO = (fn: (s: GameState) => void) => { setMenu(''); dispatch({ type: 'DO', fn }); };
  const sea = seaDestinations(state);

  return (
    <div className="spot">
      <div className="spot-head">
        <div>
          <div className="spot-type">{td.label}{sp.secured && ' · 🏠거점'}</div>
          <h2>{sp.name}</h2>
        </div>
        <div className="spot-stat">
          <div className={`z ${sp.zombies > 0 ? 'on' : ''}`}>🧟 {sp.zombies}</div>
          <div className="muted">수색 {sp.looted}%</div>
        </div>
      </div>

      {menu === '' && (
        <div className="acts">
          <button className="act" onClick={() => DO(scavenge)}>🔍 수색하기</button>
          <button className="act" onClick={() => setMenu('fight')} disabled={sp.zombies <= 0}>⚔ 교전</button>
          <button className="act" onClick={() => DO((s) => rest(s, 3))}>😴 휴식 3h</button>
          <button className="act" onClick={() => DO((s) => rest(s, 6))}>🛌 휴식 6h</button>
          <button className="act" onClick={() => setMenu('craft')}>🛠 제작</button>
          <button className="act" onClick={() => DO(secureBase)} disabled={sp.secured || sp.zombies > 0}>🏠 거점화</button>
          {sp.type === 'lab' && !p.flags['vaccine'] && <button className="act key" onClick={() => DO(tryVaccine)}>🧪 백신 확보</button>}
        </div>
      )}

      {menu === 'fight' && (
        <div className="acts">
          <button className="act" onClick={() => DO((s) => skirmish(s, 'aggro'))}>정면 돌파 (빠르게·위험)</button>
          <button className="act" onClick={() => DO((s) => skirmish(s, 'careful'))}>신중하게 (위험하면 후퇴)</button>
          <button className="act" onClick={() => DO((s) => skirmish(s, 'stealth'))}>은밀 처치 (민첩·감각)</button>
          {itemCount(p, 'molotov') > 0 && <button className="act" onClick={() => DO(useMolotov)}>🔥 화염병 (×{itemCount(p, 'molotov')})</button>}
          <button className="act back" onClick={() => setMenu('')}>← 뒤로</button>
        </div>
      )}

      {menu === 'craft' && (
        <div className="craft-list">
          {RECIPES.map((rc) => {
            const ok = rc.inputs.every((i) => itemCount(p, i.id) >= i.qty) && (!rc.needTool || itemCount(p, rc.needTool) > 0);
            return (
              <button key={rc.id} className="craft-row" disabled={!ok} onClick={() => DO((s) => craft(s, rc.id))}>
                <b>{rc.name}</b>
                <span>{rc.inputs.map((i) => `${ITEMS[i.id].name}×${i.qty}`).join(', ')}{rc.needTool ? ` + ${ITEMS[rc.needTool].name}` : ''}</span>
              </button>
            );
          })}
          <button className="act back" onClick={() => setMenu('')}>← 뒤로</button>
        </div>
      )}

      <div className="move">
        <div className="move-title">📍 {reg.name} 내 장소</div>
        <div className="move-grid">
          {reg.spots.filter((x) => x.discovered).map((x) => (
            <button key={x.id} className={`movebtn ${x.id === sp.id ? 'here' : ''}`} disabled={x.id === sp.id}
              onClick={() => dispatch({ type: 'DO', fn: (s) => moveSpot(s, x.id) })}>
              <span>{x.name}</span>
              <em>{SPOT_TYPES[x.type].label} · 🧟{x.zombies}{x.secured ? ' · 🏠' : ''}</em>
            </button>
          ))}
        </div>

        {reg.neighbors.length > 0 && <>
          <div className="move-title">🚗 인접 지역 이동 {itemCount(p, 'fuel') > 0 ? '(연료 보유: 차량 2h)' : '(도보 5h)'}</div>
          <div className="move-grid">
            {reg.neighbors.map((nid) => (
              <button key={nid} className="movebtn" onClick={() => dispatch({ type: 'DO', fn: (s) => travelRegion(s, nid) })}>
                <span>{state.regions[nid].name}</span><em>감염도 {r1(state.regions[nid].infestation)}%</em>
              </button>
            ))}
          </div>
        </>}

        {sea.length > 0 && <>
          <div className="move-title">⛴ 해외/항로 이동 (연료 3 · 8h)</div>
          <div className="move-grid">
            {sea.map((d) => (
              <button key={d.id} className="movebtn sea" onClick={() => dispatch({ type: 'DO', fn: (s) => seaTravel(s, d.id) })}>
                <span>{d.name}</span><em>감염도 {r1(state.regions[d.id].infestation)}%</em>
              </button>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

function Death({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const p = state.player;
  return (
    <div className="death">
      <h2>SURVIVAL ENDED</h2>
      <p>{p.name}은(는) {p.day}일차에 쓰러졌다.</p>
      <p className="muted">처치한 감염체 {p.killed}마리 · 최종 Lv.{p.level}{p.flags['vaccine'] ? ' · 🧪 백신 확보' : ''}</p>
      <button className="primary" onClick={onRestart}>다시 시작</button>
    </div>
  );
}

function Log({ log }: { log: string[] }) {
  return <div className="log">{log.slice(-16).map((l, i) => <div key={i} className="log-line">{l}</div>)}</div>;
}
