import { NationalPartyResult } from '../types';
import { partyColor, partyShort } from '../data/parties';

export function NationalSummary({ national, showSeats }: { national: NationalPartyResult[]; showSeats: boolean }) {
  const top = national.filter((p) => p.votes > 0).slice(0, 8);
  return (
    <div className="legend">
      {top.map((p) => (
        <div className="legend-row" key={p.id}>
          <span className="swatch" style={{ background: partyColor(p.id) }} />
          <span className="lg-name">{partyShort(p.id)}</span>
          <span className="lg-val">{p.pct.toFixed(1)}%</span>
          {showSeats && <span className="lg-seat">{p.seats}석<em>(지{p.seatsLocal}+비{p.seatsPL})</em></span>}
        </div>
      ))}
    </div>
  );
}
