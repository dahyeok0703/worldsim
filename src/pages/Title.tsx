import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';

export default function Title() {
  const nav = useNavigate();
  const load = useGameStore((s) => s.load);
  const hasSave = !!localStorage.getItem('kps.save');
  return (
    <div className="title-screen">
      <h1>대한민국 정치인<br />시뮬레이터</h1>
      <p className="subtitle">신인에서 대통령까지 — 당신의 정치 커리어</p>
      <div className="title-btns">
        <button className="primary big" onClick={() => nav('/create')}>새 게임</button>
        {hasSave && <button className="big" onClick={() => { if (load()) nav('/dashboard'); }}>이어하기</button>}
      </div>
      <p className="disclaimer">※ 개인 비공개 플레이용. 정당명만 실제이며 모든 인물은 가상입니다.</p>
    </div>
  );
}
