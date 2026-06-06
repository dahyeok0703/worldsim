import { useEffect, useReducer, useState } from 'react';
import { ITEMS, SCENES, SKILLS, START_SCENE } from './content';
import {
  applyEffect,
  dodgeChance,
  enemyAttack,
  expToNext,
  fleeChance,
  freshPlayer,
  getEnemy,
  maxHp,
  maxMental,
  onKill,
  playerAttack,
  weaponAtk,
} from './engine';
import {
  GameState,
  Player,
  Requirement,
  STAT_DESC,
  STAT_LABEL,
  StatKey,
  Stats,
} from './types';

const SAVE_KEY = 'zombie-system-rpg.v1';
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const capLog = (s: GameState): GameState => ({ ...s, log: s.log.slice(-40) });
const fmt = (t: string, name: string) => t.replaceAll('{name}', name || '생존자');

function titleState(): GameState {
  return { phase: 'title', player: freshPlayer(), sceneId: START_SCENE, log: [] };
}

function meets(p: Player, r?: Requirement): boolean {
  if (!r) return true;
  if (r.minLevel && p.level < r.minLevel) return false;
  if (r.skill && !p.skills.includes(r.skill)) return false;
  if (r.item && !p.inventory.includes(r.item)) return false;
  if (r.flag && !p.flags[r.flag]) return false;
  if (r.stat)
    for (const k of Object.keys(r.stat) as StatKey[])
      if (p.stats[k] < (r.stat[k] ?? 0)) return false;
  return true;
}

function enterScene(p: Player, id: string, log: string[]): GameState {
  if (id === '__restart__') return titleState();
  const s = SCENES[id];
  s.onEnter?.forEach((e) => applyEffect(p, e, log));
  return capLog({ phase: 'scene', player: p, sceneId: id, log, ending: s.ending });
}

type Action =
  | { type: 'NEW_GAME' }
  | { type: 'LOAD'; state: GameState }
  | { type: 'CREATE_CONFIRM'; name: string }
  | { type: 'CHOOSE'; index: number }
  | { type: 'ALLOC'; stat: StatKey }
  | { type: 'EQUIP'; id: string }
  | { type: 'USE_ITEM'; index: number }
  | { type: 'COMBAT'; kind: 'attack' | 'flee' | 'skill' | 'item'; id?: string; index?: number }
  | { type: 'COMBAT_CONTINUE' }
  | { type: 'RESTART' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'NEW_GAME':
      return { phase: 'create', player: freshPlayer(), sceneId: START_SCENE, log: [] };

    case 'LOAD':
      return action.state;

    case 'RESTART':
      return titleState();

    case 'CREATE_CONFIRM': {
      const p = clone(state.player);
      p.name = action.name.trim() || '생존자';
      return enterScene(p, START_SCENE, [`「생존자 시스템」이 ${p.name}에게 연결되었다.`]);
    }

    case 'ALLOC': {
      if (state.player.statPoints <= 0) return state;
      const p = clone(state.player);
      p.stats[action.stat] += 1;
      p.statPoints -= 1;
      if (action.stat === 'VIT') p.hp += 10;
      if (action.stat === 'WIL') p.mental += 6;
      return { ...state, player: p };
    }

    case 'EQUIP': {
      const p = clone(state.player);
      if (p.inventory.includes(action.id)) p.equipped = action.id;
      return { ...state, player: p };
    }

    case 'USE_ITEM': {
      if (state.phase !== 'scene') return state;
      const p = clone(state.player);
      const id = p.inventory[action.index];
      const it = ITEMS[id];
      if (!it || it.type !== 'heal') return state;
      const log = [...state.log];
      p.inventory.splice(action.index, 1);
      if (it.heal) p.hp = Math.min(maxHp(p), p.hp + it.heal);
      if (it.mental) p.mental = Math.min(maxMental(p), p.mental + it.mental);
      log.push(`${it.name} 사용`);
      return capLog({ ...state, player: p, log });
    }

    case 'CHOOSE': {
      const scene = SCENES[state.sceneId];
      const ch = scene.choices[action.index];
      if (!ch || !meets(state.player, ch.requires)) return state;
      const p = clone(state.player);
      const log = [...state.log];
      ch.effects?.forEach((e) => applyEffect(p, e, log));
      if (ch.combat) {
        const enemy = getEnemy(ch.combat);
        log.push(`⚔ ${enemy.name} 출현!`);
        return capLog({
          ...state,
          phase: 'combat',
          player: p,
          combat: { enemy, enemyHp: enemy.hp, turn: 1, next: ch.next ?? state.sceneId, analyzed: false, over: false },
          log,
        });
      }
      return enterScene(p, ch.next ?? state.sceneId, log);
    }

    case 'COMBAT_CONTINUE': {
      if (!state.combat) return state;
      const p = clone(state.player);
      return enterScene(p, state.combat.next, [...state.log]);
    }

    case 'COMBAT': {
      const c0 = state.combat;
      if (!c0 || c0.over) return state;
      const p = clone(state.player);
      const c = clone(c0);
      const log = [...state.log];
      const enemy = c.enemy;
      let acted = true;

      if (action.kind === 'attack') {
        const r = playerAttack(p, enemy, c.analyzed ? { forceCrit: true } : {});
        c.analyzed = false;
        if (r.dodged) log.push(`${enemy.name}이(가) 몸을 틀어 회피했다!`);
        else { c.enemyHp -= r.dmg; log.push(`${p.name}의 공격 → ${enemy.name} ${r.dmg} 피해${r.crit ? ' (치명타!)' : ''}`); }
      } else if (action.kind === 'skill') {
        const sk = action.id ? SKILLS[action.id] : null;
        if (!sk || !p.skills.includes(sk.id) || p.mental < sk.cost) return state;
        p.mental -= sk.cost;
        if (sk.id === 'gangta') {
          const r = playerAttack(p, enemy, { multiplier: 2.2 });
          if (r.dodged) log.push(`강타가 빗나갔다!`);
          else { c.enemyHp -= r.dmg; log.push(`강타! ${enemy.name} ${r.dmg} 피해${r.crit ? ' (치명타!)' : ''}`); }
        } else if (sk.id === 'firstaid') {
          const h = 30 + p.stats.WIL * 2;
          p.hp = Math.min(maxHp(p), p.hp + h);
          log.push(`응급처치 — HP +${h}`);
        } else if (sk.id === 'analyze') {
          c.analyzed = true;
          log.push(`간파 — 다음 공격이 치명타로 적중한다.`);
        } else {
          p.mental += sk.cost; // 패시브 등은 사용 불가, 환불
          return state;
        }
      } else if (action.kind === 'item') {
        const id = p.inventory[action.index ?? -1];
        const it = ITEMS[id];
        if (!it || it.type !== 'heal') return state;
        p.inventory.splice(action.index!, 1);
        if (it.heal) p.hp = Math.min(maxHp(p), p.hp + it.heal);
        if (it.mental) p.mental = Math.min(maxMental(p), p.mental + it.mental);
        log.push(`${it.name} 사용`);
      } else if (action.kind === 'flee') {
        if (Math.random() < fleeChance(p)) {
          log.push('도주 성공! 위기를 벗어났다.');
          return enterScene(p, c.next, log);
        }
        log.push('도주 실패! 등 뒤를 잡혔다.');
      }

      if (c.enemyHp <= 0) {
        log.push(`☠ ${enemy.name} 처치!`);
        onKill(p, enemy, log);
        c.over = true;
        return capLog({ ...state, player: p, combat: c, log });
      }

      if (acted) {
        const r = enemyAttack(p, enemy);
        if (r.dodged) log.push(`${p.name}이(가) 공격을 피했다!`);
        else {
          p.hp -= r.dmg;
          log.push(`${enemy.name}의 공격 → ${r.dmg} 피해`);
          if (p.mental > 0 && Math.random() < 0.3) p.mental = Math.max(0, p.mental - 3);
        }
      }
      c.turn += 1;

      if (p.hp <= 0) {
        p.hp = 0;
        log.push(`${p.name}은(는) 차갑게 식어간다…`);
        return capLog({ ...state, phase: 'gameover', player: p, combat: undefined, log, ending: 'bad' });
      }
      return capLog({ ...state, player: p, combat: c, log });
    }

    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, titleState);
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    setHasSave(!!localStorage.getItem(SAVE_KEY));
  }, []);

  // 진행 중 상태 자동 저장
  useEffect(() => {
    if (state.phase === 'scene' || state.phase === 'combat' || state.phase === 'gameover') {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      setHasSave(true);
    }
  }, [state]);

  function continueGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      dispatch({ type: 'LOAD', state: JSON.parse(raw) as GameState });
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="game">
      {state.phase === 'title' && (
        <TitleView hasSave={hasSave} onNew={() => dispatch({ type: 'NEW_GAME' })} onContinue={continueGame} />
      )}
      {state.phase === 'create' && (
        <CreateView base={state.player} onConfirm={(name) => dispatch({ type: 'CREATE_CONFIRM', name })} />
      )}
      {(state.phase === 'scene' || state.phase === 'combat' || state.phase === 'gameover') && (
        <div className="play">
          <StatusPanel
            p={state.player}
            onAlloc={(s) => dispatch({ type: 'ALLOC', stat: s })}
            onEquip={(id) => dispatch({ type: 'EQUIP', id })}
            onUse={(i) => dispatch({ type: 'USE_ITEM', index: i })}
            canUseItems={state.phase === 'scene'}
          />
          <main className="stage">
            {state.phase === 'scene' && (
              <SceneView state={state} onChoose={(i) => dispatch({ type: 'CHOOSE', index: i })} onRestart={() => dispatch({ type: 'RESTART' })} />
            )}
            {state.phase === 'combat' && state.combat && (
              <CombatView state={state} dispatch={dispatch} />
            )}
            {state.phase === 'gameover' && (
              <div className="ending bad">
                <h2>GAME OVER</h2>
                <p>도시는 또 하나의 감염체를 얻었다.</p>
                <button className="primary" onClick={() => dispatch({ type: 'RESTART' })}>다시 시작</button>
              </div>
            )}
            <LogView log={state.log} />
          </main>
        </div>
      )}
    </div>
  );
}

function Bar({ value, max, kind }: { value: number; max: number; kind: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bar ${kind}`}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
      <span className="bar-text">{Math.max(0, Math.round(value))} / {Math.round(max)}</span>
    </div>
  );
}

function TitleView({ hasSave, onNew, onContinue }: { hasSave: boolean; onNew: () => void; onContinue: () => void }) {
  return (
    <div className="title">
      <h1>감염도시</h1>
      <p className="tagline">2026 · 시스템 각성자</p>
      <p className="blurb">
        좀비 바이러스가 도시를 삼켰다. 당신에게만 보이는 푸른 상태창과 함께,<br />
        대피소까지 살아남아라.
      </p>
      <div className="title-btns">
        {hasSave && <button className="primary" onClick={onContinue}>이어하기</button>}
        <button className={hasSave ? '' : 'primary'} onClick={onNew}>새 게임</button>
      </div>
    </div>
  );
}

function CreateView({ base, onConfirm }: { base: Player; onConfirm: (name: string) => void }) {
  const [name, setName] = useState('');
  const [stats, setStats] = useState<Stats>({ ...base.stats });
  const [points, setPoints] = useState(base.statPoints);

  const inc = (k: StatKey) => points > 0 && (setStats({ ...stats, [k]: stats[k] + 1 }), setPoints(points - 1));
  const dec = (k: StatKey) => stats[k] > base.stats[k] && (setStats({ ...stats, [k]: stats[k] - 1 }), setPoints(points + 1));

  return (
    <div className="create">
      <h2>사용자 등록</h2>
      <label className="fl">이름</label>
      <input className="name-input" value={name} placeholder="상태창에 새길 이름…" onChange={(e) => setName(e.target.value)} maxLength={12} />

      <div className="alloc-head">
        능력치 분배 <span className="pts">남은 포인트 {points}</span>
      </div>
      <div className="alloc">
        {(Object.keys(stats) as StatKey[]).map((k) => (
          <div className="alloc-row" key={k}>
            <div className="alloc-name">{STAT_LABEL[k]} <em>{STAT_DESC[k]}</em></div>
            <div className="alloc-ctl">
              <button onClick={() => dec(k)} disabled={stats[k] <= base.stats[k]}>−</button>
              <b>{stats[k]}</b>
              <button onClick={() => inc(k)} disabled={points <= 0}>＋</button>
            </div>
          </div>
        ))}
      </div>

      <div className="ability-card">
        <b>◈ 고유 능력 · 포식(捕食)</b>
        <p>처치한 감염체의 잔재를 흡수해 드물게 능력치가 영구히 오른다. 레벨업으로 강타·응급처치·간파·질주를 차례로 습득한다.</p>
      </div>

      <button
        className="primary wide"
        onClick={() => {
          // 분배 결과를 base에 반영하기 위해 confirm 시 임시로 적용
          base.stats = stats;
          base.statPoints = points;
          base.hp = 100 + stats.VIT * 10;
          base.mental = 50 + stats.WIL * 6;
          onConfirm(name);
        }}
      >
        시작하기
      </button>
    </div>
  );
}

function StatusPanel({
  p, onAlloc, onEquip, onUse, canUseItems,
}: {
  p: Player;
  onAlloc: (s: StatKey) => void;
  onEquip: (id: string) => void;
  onUse: (i: number) => void;
  canUseItems: boolean;
}) {
  const weapon = p.equipped ? ITEMS[p.equipped] : null;
  return (
    <aside className="status">
      <div className="st-head">
        <h3>{p.name || '생존자'}</h3>
        <span className="lv">Lv.{p.level}</span>
      </div>
      {p.title && <div className="title-badge">『{p.title}』</div>}

      <div className="st-bars">
        <div className="st-line">HP</div>
        <Bar value={p.hp} max={maxHp(p)} kind="hp" />
        <div className="st-line">정신</div>
        <Bar value={p.mental} max={maxMental(p)} kind="mental" />
        <div className="st-line">EXP</div>
        <Bar value={p.exp} max={expToNext(p.level)} kind="exp" />
      </div>

      <div className="st-section">
        <div className="st-title">
          능력치 {p.statPoints > 0 && <span className="pts">+{p.statPoints}</span>}
        </div>
        {(Object.keys(p.stats) as StatKey[]).map((k) => (
          <div className="st-stat" key={k} title={STAT_DESC[k]}>
            <span>{STAT_LABEL[k]}</span>
            <b>{p.stats[k]}</b>
            {p.statPoints > 0 && <button className="mini" onClick={() => onAlloc(k)}>＋</button>}
          </div>
        ))}
      </div>

      <div className="st-section">
        <div className="st-title">무기</div>
        <div className="equipped">🗡 {weapon ? `${weapon.name} (공격 +${weapon.atk})` : '맨손'} · 총 공격력 {p.stats.STR * 2 + weaponAtk(p)}</div>
      </div>

      <div className="st-section">
        <div className="st-title">스킬</div>
        <div className="skills">
          {p.skills.map((id) => (
            <span className="skill-chip" key={id} title={SKILLS[id]?.desc}>{SKILLS[id]?.name}</span>
          ))}
        </div>
      </div>

      <div className="st-section">
        <div className="st-title">인벤토리</div>
        <div className="inv">
          {p.inventory.length === 0 && <div className="muted">비어 있음</div>}
          {p.inventory.map((id, i) => {
            const it = ITEMS[id];
            if (!it) return null;
            const isWeapon = it.type === 'weapon';
            const isHeal = it.type === 'heal';
            return (
              <div className="inv-row" key={`${id}-${i}`} title={it.desc}>
                <span>{it.name}</span>
                {isWeapon && p.equipped !== id && (
                  <button className="mini" onClick={() => onEquip(id)}>장착</button>
                )}
                {isWeapon && p.equipped === id && <span className="tag">장착중</span>}
                {isHeal && canUseItems && (
                  <button className="mini" onClick={() => onUse(i)}>사용</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function SceneView({ state, onChoose, onRestart }: { state: GameState; onChoose: (i: number) => void; onRestart: () => void }) {
  const scene = SCENES[state.sceneId];
  const p = state.player;
  return (
    <div className="scene">
      {scene.title && <div className="scene-title">{scene.title}</div>}
      <div className="scene-text">{fmt(scene.text, p.name)}</div>
      {state.ending ? (
        <div className={`ending ${state.ending === 'good' ? 'good' : ''}`}>
          <button className="primary" onClick={onRestart}>처음으로</button>
        </div>
      ) : (
        <div className="choices">
          {scene.choices.map((ch, i) => {
            const ok = meets(p, ch.requires);
            return (
              <button key={i} className="choice" disabled={!ok} onClick={() => onChoose(i)}>
                <span className="choice-label">{ch.label}</span>
                {ch.note && <span className="choice-note">{ch.note}</span>}
                {!ok && <span className="choice-req">🔒 {reqText(ch.requires)}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function reqText(r?: Requirement): string {
  if (!r) return '';
  const parts: string[] = [];
  if (r.minLevel) parts.push(`Lv.${r.minLevel}+`);
  if (r.stat) for (const k of Object.keys(r.stat) as StatKey[]) parts.push(`${STAT_LABEL[k]} ${r.stat[k]}+`);
  if (r.skill) parts.push(`스킬: ${SKILLS[r.skill]?.name ?? r.skill}`);
  if (r.item) parts.push(`소지: ${ITEMS[r.item]?.name ?? r.item}`);
  return parts.join(' · ');
}

function CombatView({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<Action> }) {
  const c = state.combat!;
  const p = state.player;
  const [menu, setMenu] = useState<'main' | 'skill' | 'item'>('main');

  const activeSkills = p.skills.map((id) => SKILLS[id]).filter((s) => s && s.type !== 'passive');
  const healItems = p.inventory.map((id, i) => ({ id, i, it: ITEMS[id] })).filter((x) => x.it?.type === 'heal');

  return (
    <div className="combat">
      <div className="enemy-card">
        <div className="enemy-top">
          <h3>{c.enemy.boss ? '👹 ' : '🧟 '}{c.enemy.name}</h3>
          <span className="turn">TURN {c.turn}</span>
        </div>
        <div className="enemy-desc">{c.enemy.desc}</div>
        <Bar value={c.enemyHp} max={c.enemy.hp} kind="enemy" />
        <div className="combat-meta">
          내 회피 {Math.round(dodgeChance(p) * 100)}% · 도주 {Math.round(fleeChance(p) * 100)}%
          {c.analyzed && <span className="analyzed"> · 간파 적중 대기</span>}
        </div>
      </div>

      {c.over ? (
        <button className="primary wide" onClick={() => dispatch({ type: 'COMBAT_CONTINUE' })}>계속 ▶</button>
      ) : menu === 'main' ? (
        <div className="actions">
          <button className="act" onClick={() => dispatch({ type: 'COMBAT', kind: 'attack' })}>공격</button>
          <button className="act" onClick={() => setMenu('skill')} disabled={!activeSkills.length}>스킬</button>
          <button className="act" onClick={() => setMenu('item')} disabled={!healItems.length}>아이템</button>
          <button className="act flee" onClick={() => dispatch({ type: 'COMBAT', kind: 'flee' })}>도주</button>
        </div>
      ) : menu === 'skill' ? (
        <div className="submenu">
          {activeSkills.map((s) => (
            <button
              key={s.id}
              className="act"
              disabled={p.mental < s.cost}
              title={s.desc}
              onClick={() => { dispatch({ type: 'COMBAT', kind: 'skill', id: s.id }); setMenu('main'); }}
            >
              {s.name} <em>정신 {s.cost}</em>
            </button>
          ))}
          <button className="act back" onClick={() => setMenu('main')}>← 뒤로</button>
        </div>
      ) : (
        <div className="submenu">
          {healItems.map((x) => (
            <button
              key={`${x.id}-${x.i}`}
              className="act"
              title={x.it.desc}
              onClick={() => { dispatch({ type: 'COMBAT', kind: 'item', index: x.i }); setMenu('main'); }}
            >
              {x.it.name} <em>{x.it.heal ? `HP+${x.it.heal}` : ''}{x.it.mental ? ` 정신+${x.it.mental}` : ''}</em>
            </button>
          ))}
          <button className="act back" onClick={() => setMenu('main')}>← 뒤로</button>
        </div>
      )}
    </div>
  );
}

function LogView({ log }: { log: string[] }) {
  return (
    <div className="log">
      {log.slice(-12).map((l, i) => (
        <div key={i} className="log-line">{l}</div>
      ))}
    </div>
  );
}
