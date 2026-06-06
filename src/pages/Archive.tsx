import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import KoreaMap from '../components/KoreaMap';
import { NationalSummary } from '../components/PartyLegend';
import { useGameStore } from '../store/useGameStore';

export default function Archive() {
  const nav = useNavigate();
  const s = useGameStore();
  const [sel, setSel] = useState(0);
  useEffect(() => { if (!s.character) nav('/'); }, [s.character, nav]);
  if (!s.character) return null;

  const entry = s.archive[sel];
  return (
    <div className="page">
      <Nav />
      <div className="archive">
        <section className="card arc-list">
          <h3>커리어 타임라인</h3>
          <div className="timeline">
            <div className="tl-row">{s.year}년 현재 — {s.character.name}</div>
            {s.log.filter((l) => l.includes('당선') || l.includes('임명') || l.includes('입문')).slice(-10).reverse().map((l, i) => (
              <div className="tl-row" key={i}>{l}</div>
            ))}
          </div>
          <h3 style={{ marginTop: 14 }}>역대 선거</h3>
          {s.archive.length === 0 && <p className="hint">아직 치른 선거가 없습니다.</p>}
          {s.archive.map((e, i) => (
            <button key={i} className={`arc-item ${i === sel ? 'on' : ''} ${e.won ? 'won' : ''}`} onClick={() => setSel(i)}>
              {e.year} {e.label} — {e.summary}
            </button>
          ))}
        </section>
        <section className="card">
          {entry ? (
            <>
              <h3>{entry.year} {entry.label} 개표 지도</h3>
              <KoreaMap result={entry.result} mode="national" />
            </>
          ) : <p className="hint">왼쪽에서 선거를 선택하세요.</p>}
        </section>
        <section className="card">
          {entry && <NationalSummary national={entry.result.national} showSeats={entry.result.type === 'assembly'} />}
        </section>
      </div>
    </div>
  );
}
