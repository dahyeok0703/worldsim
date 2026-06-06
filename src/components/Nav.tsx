import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { POSITION_LABEL } from '../engine/careerSystem';

export default function Nav() {
  const nav = useNavigate();
  const s = useGameStore();
  if (!s.character) return null;
  const age = s.year - s.character.birthYear;
  return (
    <header className="nav">
      <div className="nav-brand" onClick={() => nav('/dashboard')}>🏛 정치인 SIM</div>
      <div className="nav-info">
        {s.character.name} · {POSITION_LABEL[s.position]} · 만{age}세 · {s.year}년 {s.quarter}분기 · AP {s.ap}/{s.maxAp}
      </div>
      <nav className="nav-links">
        <button onClick={() => nav('/dashboard')}>대시보드</button>
        <button onClick={() => nav('/election')}>선거센터</button>
        <button onClick={() => nav('/cabinet')}>행정부</button>
        <button onClick={() => nav('/archive')}>연감</button>
        <button onClick={() => s.save()}>저장</button>
      </nav>
    </header>
  );
}
