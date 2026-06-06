import { partyColor, partyShort } from '../data/parties';

interface Props {
  title: string;
  parties: { id: string; votes: number; pct: number }[];
  turnout?: number;
  total?: number;
}

export default function RegionPanel({ title, parties, turnout, total }: Props) {
  const top = parties.slice(0, 6);
  return (
    <div className="region-panel">
      <h4>{title}</h4>
      {turnout != null && <div className="rp-meta">투표율 {(turnout * 100).toFixed(1)}% · 투표수 {total?.toLocaleString()}</div>}
      <div className="rp-bars">
        {top.map((p, i) => (
          <div className="rp-row" key={p.id}>
            <span className="rp-name" style={{ color: partyColor(p.id) }}>{partyShort(p.id)}{i === 0 && ' 👑'}</span>
            <div className="rp-bar"><div className="rp-fill" style={{ width: `${p.pct}%`, background: partyColor(p.id) }} /></div>
            <span className="rp-pct">{p.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
