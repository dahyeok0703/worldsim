import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import { useGameStore } from '../store/useGameStore';
import { PROVINCES, provinceName } from '../data/provinces';
import { STAT_LABEL, StatKey } from '../types';
import { PARTY_MAP } from '../data/parties';

const GROUPS: { k: any; label: string }[] = [
  { k: 'male', label: '남성' }, { k: 'female', label: '여성' },
  { k: 'a2030', label: '2030' }, { k: 'a4050', label: '4050' }, { k: 'a6070', label: '6070' },
  { k: 'working', label: '서민층' }, { k: 'middle', label: '중산층' }, { k: 'upper', label: '상류층' },
];
const TOPICS = ['경제', '안보', '복지', '개혁'];
const STANCES: { label: string; effect: any }[] = [
  { label: '개혁 의제 제시', effect: { reform: 5, approvalNational: 2 } },
  { label: '안정·통합 강조', effect: { stability: 5, approvalNational: 2 } },
  { label: '민생·복지 강조', effect: { populism: 5, approvalNational: 3 } },
  { label: '안보 강경 발언', effect: { stability: 3, populism: 1, approvalNational: 1 } },
];

export default function Dashboard() {
  const nav = useNavigate();
  const s = useGameStore();
  const [prov, setProv] = useState(s.character?.originProvince ?? '11');
  const [group, setGroup] = useState<any>('a4050');
  const [topic, setTopic] = useState('경제');

  useEffect(() => { if (!s.character) nav('/'); }, [s.character, nav]);
  if (!s.character) return null;
  const c = s.character;

  function doPress(stance: { label: string; effect: any }) {
    if (s.ap < 1) return;
    if (Math.random() < 0.12) s.press({ integrity: -6, approvalNational: -4 }, `${stance.label} (실언 발생!)`);
    else s.press(stance.effect, stance.label);
  }

  return (
    <div className="page">
      <Nav />
      {s.pendingEvent && (
        <div className="modal-bg"><div className="modal">
          <h3>{s.pendingEvent.title}</h3><p>{s.pendingEvent.text}</p>
          <div className="modal-choices">
            {s.pendingEvent.choices.map((ch, i) => <button key={i} onClick={() => s.resolveEvent(i)}>{ch.label}</button>)}
          </div>
        </div></div>
      )}

      <div className="dash">
        <section className="card">
          <h3>현황</h3>
          <div className="kv"><span>소속</span><b style={{ color: PARTY_MAP[c.partyId]?.color }}>{c.partyId}</b></div>
          <Stat label="전국 인지도" v={s.recognition} color="#5fa8ff" />
          <Stat label="전국 지지율" v={s.approval.national} color="#5fd38a" />
          <Stat label={`${provinceName(c.originProvince)} 지지율`} v={s.approval.byProvince[c.originProvince] ?? 5} color="#9d7bff" />
          <Stat label="당내 입지" v={s.partyStanding} color="#e8c46a" />
          <Stat label="자금력" v={s.funding} color="#d6a44c" />
          <div className="img-axes">
            {(['integrity', 'reform', 'stability', 'populism'] as const).map((k) => (
              <span key={k} className="ia">{({ integrity: '청렴', reform: '개혁', stability: '안정', populism: '친서민' } as any)[k]} {Math.round(s.image[k])}</span>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>능력치</h3>
          <div className="stat-preview">
            {(Object.keys(c.stats) as StatKey[]).map((k) => (
              <div className="sp-row" key={k}><span>{STAT_LABEL[k]}</span>
                <div className="sp-bar"><div className="sp-fill" style={{ width: `${c.stats[k]}%` }} /></div><b>{c.stats[k]}</b></div>
            ))}
          </div>
        </section>

        <section className="card actions">
          <h3>활동 (AP {s.ap}/{s.maxAp})</h3>
          <div className="act-block">
            <div className="act-title">📣 유세</div>
            <div className="row">
              <select value={prov} onChange={(e) => setProv(e.target.value)}>
                {PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
              <button disabled={s.ap < 1} onClick={() => s.campaign(prov)}>유세 (AP1)</button>
            </div>
          </div>
          <div className="act-block">
            <div className="act-title">🎙 연설</div>
            <div className="row">
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
              <select value={group} onChange={(e) => setGroup(e.target.value)}>{GROUPS.map((g) => <option key={g.k} value={g.k}>{g.label}</option>)}</select>
              <button disabled={s.ap < 1} onClick={() => s.speech(group, topic)}>연설 (AP1)</button>
            </div>
          </div>
          <div className="act-block">
            <div className="act-title">📺 기자회견</div>
            <div className="stance-grid">
              {STANCES.map((st) => <button key={st.label} disabled={s.ap < 1} onClick={() => doPress(st)}>{st.label}</button>)}
            </div>
          </div>
          <div className="row act-misc">
            <button disabled={s.ap < 1} onClick={() => s.sns()}>📱 SNS (AP1)</button>
            <button disabled={s.ap < 1} onClick={() => s.fundraise()}>💰 모금 (AP1)</button>
            <button className="primary" onClick={() => s.endTurn()}>⏭ 턴 종료</button>
          </div>
          <div className="row act-misc">
            <button onClick={() => nav('/election')}>🗳 선거 출마</button>
            <button onClick={() => nav('/cabinet')}>🏛 행정부 입각</button>
          </div>
        </section>

        <section className="card">
          <h3>계층별 지지율</h3>
          <div className="stat-preview">
            {GROUPS.map((g) => (
              <div className="sp-row" key={g.k}><span>{g.label}</span>
                <div className="sp-bar"><div className="sp-fill" style={{ width: `${s.approval.byGroup[g.k as keyof typeof s.approval.byGroup]}%`, background: '#5fd38a' }} /></div>
                <b>{Math.round(s.approval.byGroup[g.k as keyof typeof s.approval.byGroup])}</b></div>
            ))}
          </div>
        </section>
      </div>

      <div className="log card"><h3>활동 기록</h3>{s.log.slice(-12).reverse().map((l, i) => <div key={i} className="log-line">{l}</div>)}</div>
    </div>
  );
}

function Stat({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="sp-row"><span style={{ width: 90 }}>{label}</span>
      <div className="sp-bar"><div className="sp-fill" style={{ width: `${v}%`, background: color }} /></div><b>{Math.round(v)}</b></div>
  );
}
