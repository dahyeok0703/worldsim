import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import { useGameStore } from '../store/useGameStore';
import { npcsByParty } from '../data/politicians';

const MINISTRIES = ['경제부총리', '외교부장관', '행정안전부장관', '국방부장관', '보건복지부장관', '법무부장관', '교육부장관', '국무총리'];

const HEARING = [
  { q: '후보자 본인과 가족의 재산 형성 과정에 의혹이 제기됩니다. 답변하십시오.', a: [
    { t: '모든 자료를 투명하게 공개하고 소명하겠습니다.', s: 3 },
    { t: '법적으로 문제없으며 정치공세일 뿐입니다.', s: 1 },
    { t: '사생활이라 답변하지 않겠습니다.', s: -2 },
  ] },
  { q: '과거 발언과 현재 정책 입장이 다릅니다. 해명하십시오.', a: [
    { t: '상황 변화에 따라 숙고 끝에 입장을 발전시켰습니다.', s: 3 },
    { t: '그런 발언을 한 적 없습니다.', s: -1 },
    { t: '맥락이 잘렸습니다. 전체를 보면 일관됩니다.', s: 2 },
  ] },
  { q: '해당 부처를 이끌 전문성이 부족하다는 지적입니다.', a: [
    { t: '구체적 정책 로드맵으로 증명하겠습니다.', s: 3 },
    { t: '유능한 실무진과 협업하면 됩니다.', s: 1 },
    { t: '제 경력만으로 충분합니다.', s: 0 },
  ] },
];

export default function Cabinet() {
  const nav = useNavigate();
  const s = useGameStore();
  const [ministry, setMinistry] = useState(MINISTRIES[0]);
  const [hearing, setHearing] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [cabinet, setCabinet] = useState<Record<string, string>>({});

  useEffect(() => { if (!s.character) nav('/'); }, [s.character, nav]);
  if (!s.character) return null;

  const isPresident = s.position === 'president';
  const eligible = s.rulingPartyId === s.character.partyId || s.partyStanding >= 55;

  function answer(idx: number) {
    if (hearing == null) return;
    const sc = score + HEARING[hearing].a[idx].s + (s.image.integrity - 50) * 0.04;
    if (hearing + 1 < HEARING.length) { setScore(sc); setHearing(hearing + 1); }
    else {
      const pass = sc + s.character!.stats.negotiation * 0.03 >= 4;
      if (pass) { s.becomeMinister(ministry); setVerdict(`✅ 인사청문회 통과! ${ministry}에 임명되었습니다.`); }
      else setVerdict('❌ 낙마했습니다. 청문회의 벽을 넘지 못했습니다.');
      setHearing(null); setScore(0);
    }
  }

  function govWork() {
    const delta = Math.round(2 + s.character!.stats.admin * 0.06 + (Math.random() - 0.4) * 6);
    s.applyEffect({ approvalNational: Math.max(-3, delta), recognition: 2, partyStanding: 1 }, `국정 수행(${s.ministry}) — 성과 ${delta >= 0 ? '+' : ''}${delta}`);
    useGameStore.setState((st) => ({ govApproval: Math.max(0, Math.min(100, st.govApproval + delta)) }));
  }

  return (
    <div className="page">
      <Nav />
      <div className="cabinet">
        {isPresident ? (
          <section className="card">
            <h3>🏛 내각 구성 (대통령)</h3>
            <p className="hint">집권당: {s.character.partyId} · 국정 지지율 {Math.round(s.govApproval)}</p>
            {MINISTRIES.filter((m) => m !== '국무총리').map((m) => (
              <div className="row cab-row" key={m}>
                <span style={{ width: 130 }}>{m}</span>
                <select value={cabinet[m] ?? ''} onChange={(e) => setCabinet({ ...cabinet, [m]: e.target.value })}>
                  <option value="">— 지명 —</option>
                  {npcsByParty(s.character!.partyId).map((n) => <option key={n.id} value={n.name}>{n.name} (역량 {n.power})</option>)}
                </select>
              </div>
            ))}
            <button className="primary" onClick={() => {
              const avg = MINISTRIES.filter((m) => m !== '국무총리').every((m) => cabinet[m]);
              s.applyEffect({ approvalNational: avg ? 5 : 1, partyStanding: 3 }, avg ? '내각 인선 완료 — 안정적 출범' : '내각 일부 공석으로 출범');
            }}>내각 출범</button>
          </section>
        ) : (
          <section className="card">
            <h3>🏛 행정부 입각</h3>
            {s.position === 'minister' ? (
              <>
                <p>현재 <b>{s.ministry}</b>로 국정을 수행 중입니다. (국정 지지율 {Math.round(s.govApproval)})</p>
                <button className="primary" onClick={govWork}>국정 수행</button>
              </>
            ) : !eligible ? (
              <p className="hint">아직 입각 제안이 없습니다. <b>당내 입지(현재 {Math.round(s.partyStanding)})</b>를 55 이상으로 올리거나 집권당이 되면 장관 후보로 지명됩니다.</p>
            ) : verdict ? (
              <p className="result-banner win">{verdict}</p>
            ) : hearing == null ? (
              <>
                <p className="hint">의원이 아니어도 각료가 될 수 있습니다. 부처를 선택하고 인사청문회에 임하세요.</p>
                <label className="fl">희망 부처</label>
                <select value={ministry} onChange={(e) => setMinistry(e.target.value)}>{MINISTRIES.map((m) => <option key={m}>{m}</option>)}</select>
                <button className="primary wide" onClick={() => { setHearing(0); setScore(0); }}>장관 후보 지명 수락 → 인사청문회</button>
              </>
            ) : (
              <div className="hearing">
                <div className="hearing-q">Q{hearing + 1}. {HEARING[hearing].q}</div>
                <div className="hearing-a">
                  {HEARING[hearing].a.map((opt, i) => <button key={i} onClick={() => answer(i)}>{opt.t}</button>)}
                </div>
              </div>
            )}
          </section>
        )}
        <section className="card">
          <h3>설명</h3>
          <p className="hint">의원직과 무관하게 <b>장관·총리 입각</b>이 가능합니다. 인사청문회를 통과하면 부처를 운영하며, 국정 성과가 본인·정권 지지율에 반영됩니다. 대통령이 되면 직접 내각을 인선합니다.</p>
          <p className="hint">집권당 여부는 본인이 <b>대통령선거에서 당선</b>되면 결정됩니다(선거센터).</p>
        </section>
      </div>
    </div>
  );
}
