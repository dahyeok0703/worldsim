import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROVINCES } from '../data/provinces';
import { PARTIES } from '../data/parties';
import { CAREERS, EDUCATIONS, computeStats, partyAffinity, spectrumFromAxes } from '../engine/careerSystem';
import { STAT_LABEL, StatKey } from '../types';
import { useGameStore } from '../store/useGameStore';

export default function CharacterCreator() {
  const nav = useNavigate();
  const newGame = useGameStore((s) => s.newGame);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [birthYear, setBirthYear] = useState(1980);
  const [origin, setOrigin] = useState('11');
  const [edu, setEdu] = useState(EDUCATIONS[2]);
  const [careers, setCareers] = useState<string[]>([]);
  const [spouse, setSpouse] = useState(true);
  const [children, setChildren] = useState(2);
  const [politicalFamily, setPolFam] = useState(false);
  const [selfMade, setSelfMade] = useState(false);
  const [econ, setEcon] = useState(0);
  const [social, setSocial] = useState(0);
  const [security, setSecurity] = useState(0);
  const [partyId, setPartyId] = useState('더불어민주당');

  const stats = useMemo(() => computeStats(edu, careers, politicalFamily, selfMade), [edu, careers, politicalFamily, selfMade]);
  const spectrum = useMemo(() => spectrumFromAxes(econ, social, security, careers), [econ, social, security, careers]);
  const recommend = useMemo(() => [...PARTIES].filter((p) => p.id !== '무소속')
    .map((p) => ({ p, aff: partyAffinity(spectrum, p.spectrum) }))
    .sort((a, b) => b.aff - a.aff), [spectrum]);
  const age = 2026 - birthYear;

  const toggleCareer = (c: string) => setCareers((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);

  function create() {
    newGame({
      name: name.trim() || '홍길동', gender, birthYear, originProvince: origin,
      education: edu, careers, spouse, children, politicalFamily, selfMade,
      axisEcon: econ, axisSocial: social, axisSecurity: security,
      partyId, stats, spectrum,
    });
    nav('/dashboard');
  }

  return (
    <div className="creator">
      <div className="creator-head"><h2>캐릭터 생성</h2><button onClick={() => nav('/')}>← 타이틀</button></div>
      <div className="creator-grid">
        <section className="card">
          <h3>기본 정보</h3>
          <label className="fl">이름</label>
          <input value={name} maxLength={10} placeholder="이름" onChange={(e) => setName(e.target.value)} />
          <label className="fl">성별</label>
          <div className="row">
            <button className={gender === 'male' ? 'tog on' : 'tog'} onClick={() => setGender('male')}>남성</button>
            <button className={gender === 'female' ? 'tog on' : 'tog'} onClick={() => setGender('female')}>여성</button>
          </div>
          <label className="fl">출생연도 (현재 만 {age}세)</label>
          <input type="number" value={birthYear} min={1940} max={2008} onChange={(e) => setBirthYear(+e.target.value)} />
          <label className="fl">출신 지역</label>
          <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
            {PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
          <label className="fl">학력</label>
          <select value={edu} onChange={(e) => setEdu(e.target.value)}>
            {EDUCATIONS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </section>

        <section className="card">
          <h3>경력 (복수 선택)</h3>
          <div className="career-grid">
            {CAREERS.map((c) => (
              <button key={c} className={careers.includes(c) ? 'tog on' : 'tog'} onClick={() => toggleCareer(c)}>{c}</button>
            ))}
          </div>
          <h3 style={{ marginTop: 14 }}>가족관계</h3>
          <label className="chk"><input type="checkbox" checked={spouse} onChange={(e) => setSpouse(e.target.checked)} /> 배우자 있음</label>
          <label className="fl">자녀 수</label>
          <input type="number" value={children} min={0} max={8} onChange={(e) => setChildren(+e.target.value)} />
          <label className="chk"><input type="checkbox" checked={politicalFamily} onChange={(e) => setPolFam(e.target.checked)} /> 정치 명문가 출신</label>
          <label className="chk"><input type="checkbox" checked={selfMade} onChange={(e) => setSelfMade(e.target.checked)} /> 자수성가(서민 이미지)</label>
        </section>

        <section className="card">
          <h3>정치 성향</h3>
          {[['경제 (분배◀▶시장)', econ, setEcon], ['사회 (진보◀▶전통)', social, setSocial], ['안보 (평화◀▶강경)', security, setSecurity]].map(
            ([lab, val, set]) => (
              <div key={lab as string}>
                <label className="fl">{lab as string}: {val as number > 0 ? '+' : ''}{val as number}</label>
                <input type="range" min={-10} max={10} value={val as number} onChange={(e) => (set as (n: number) => void)(+e.target.value)} />
              </div>
            ))}
          <div className="spectrum-out">종합 성향: <b>{spectrum > 0 ? '보수' : spectrum < 0 ? '진보' : '중도'} ({spectrum > 0 ? '+' : ''}{spectrum})</b></div>
          <h3 style={{ marginTop: 12 }}>입당</h3>
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            {PARTIES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="reco">
            {recommend.slice(0, 4).map(({ p, aff }) => (
              <button key={p.id} className="reco-row" onClick={() => setPartyId(p.id)} style={{ borderColor: p.color }}>
                <span style={{ color: p.color }}>{p.short}</span> 궁합 {aff}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>능력치 미리보기</h3>
          <div className="stat-preview">
            {(Object.keys(stats) as StatKey[]).map((k) => (
              <div className="sp-row" key={k}>
                <span>{STAT_LABEL[k]}</span>
                <div className="sp-bar"><div className="sp-fill" style={{ width: `${stats[k]}%` }} /></div>
                <b>{stats[k]}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
      <button className="primary big wide" onClick={create}>정치 입문</button>
    </div>
  );
}
