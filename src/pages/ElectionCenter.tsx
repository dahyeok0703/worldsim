import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import KoreaMap from '../components/KoreaMap';
import RegionPanel from '../components/RegionPanel';
import { NationalSummary } from '../components/PartyLegend';
import { useGameStore, OfficeChoice } from '../store/useGameStore';
import { PROVINCES, provinceName } from '../data/provinces';
import { getDistricts } from '../data/supportModel';
import { AGE_MIN } from '../engine/careerSystem';
import { ElectionType } from '../types';

type Kind = OfficeChoice['kind'];
const KIND_LABEL: Record<Kind, string> = { president: '대통령', assembly: '국회의원', governor: '광역단체장', local_head: '기초단체장' };

export default function ElectionCenter() {
  const nav = useNavigate();
  const s = useGameStore();
  const [kind, setKind] = useState<Kind>('assembly');
  const [prov, setProv] = useState(s.character?.originProvince ?? '11');
  const [dist, setDist] = useState('');
  const [mode, setMode] = useState<'national' | 'drill'>('national');
  const [drillProv, setDrillProv] = useState<string | undefined>();
  const [hoverDist, setHoverDist] = useState<string | null>(null);

  useEffect(() => { if (!s.character) nav('/'); }, [s.character, nav]);
  const provDistricts = useMemo(() => getDistricts().filter((d) => d.provinceCode === prov), [prov]);
  useEffect(() => { if (provDistricts.length && !provDistricts.find((d) => d.code === dist)) setDist(provDistricts[0].code); }, [provDistricts, dist]);
  if (!s.character) return null;
  const age = s.year - s.character.birthYear;

  const eligible: Record<Kind, boolean> = {
    president: age >= AGE_MIN.president,
    assembly: age >= AGE_MIN.assembly,
    governor: age >= AGE_MIN.local,
    local_head: age >= AGE_MIN.local,
  };

  function run() {
    const type: ElectionType = kind === 'president' ? 'president' : kind === 'assembly' ? 'assembly' : 'local';
    const office: OfficeChoice = { kind, districtCode: dist, provinceCode: prov };
    s.runElection(type, office);
    setMode('national'); setDrillProv(undefined);
  }

  const result = s.lastElection;
  const drillDistrict = hoverDist ? result?.districts[hoverDist] : undefined;
  const distName = (code: string) => getDistricts().find((d) => d.code === code)?.name ?? code;

  return (
    <div className="page">
      <Nav />
      <div className="ec">
        <section className="card ec-controls">
          <h3>출마 등록</h3>
          <div className="kind-grid">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <button key={k} className={kind === k ? 'tog on' : 'tog'} disabled={!eligible[k]}
                title={!eligible[k] ? `피선거권 미달 (만 ${k === 'president' ? 40 : 18}세 이상)` : ''}
                onClick={() => setKind(k)}>
                {KIND_LABEL[k]}{!eligible[k] && ' 🔒'}
              </button>
            ))}
          </div>
          {kind !== 'president' && (
            <>
              <label className="fl">지역</label>
              <select value={prov} onChange={(e) => setProv(e.target.value)}>
                {PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
              {(kind === 'assembly' || kind === 'local_head') && (
                <>
                  <label className="fl">선거구(시군구)</label>
                  <select value={dist} onChange={(e) => setDist(e.target.value)}>
                    {provDistricts.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                  </select>
                </>
              )}
            </>
          )}
          <button className="primary wide" onClick={run}>🗳 선거 시뮬레이션 실행</button>
          <p className="hint">후보 보정치(본인 효과): +{s.candidateBonus()} · 인지도 {Math.round(s.recognition)} · {provinceName(s.character.originProvince)} 지지율 {Math.round(s.approval.byProvince[s.character.originProvince] ?? 5)}</p>

          {result && (
            <div className={`result-banner ${result.playerWon ? 'win' : 'lose'}`}>
              {result.playerWon ? '🎉 당선되었습니다!' : '낙선했습니다…'}
              <div className="rb-sub">{result.year} {KIND_LABEL[kind]} 선거</div>
            </div>
          )}
          {result && <NationalSummary national={result.national} showSeats={result.type === 'assembly'} />}
        </section>

        <section className="card ec-map">
          <div className="map-tabs">
            <button className={mode === 'national' ? 'on' : ''} onClick={() => { setMode('national'); setDrillProv(undefined); }}>전국</button>
            {drillProv && <button className="on">{provinceName(drillProv)} 시군구</button>}
            <span className="map-hint">{mode === 'national' ? '광역을 클릭하면 시군구로 드릴다운' : '뒤로: 전국 탭'}</span>
          </div>
          {result ? (
            <KoreaMap
              result={result}
              mode={mode}
              selectedProvince={drillProv}
              onProvinceClick={(code) => { setDrillProv(code); setMode('drill'); }}
              onDistrictHover={setHoverDist}
            />
          ) : <div className="map-empty">선거를 실행하면 전국 개표 지도가 표시됩니다.</div>}
        </section>

        <section className="card ec-side">
          {result && mode === 'national' && (
            <RegionPanel title={`전국 (${result.type === 'assembly' ? '정당 득표율' : '득표율'})`}
              parties={result.national.map((n) => ({ id: n.id, votes: n.votes, pct: n.pct }))} />
          )}
          {result && mode === 'drill' && drillProv && (
            <>
              <RegionPanel title={`${provinceName(drillProv)} 합계`} parties={result.provinces[drillProv]?.parties ?? []} />
              {drillDistrict && (
                <RegionPanel title={distName(hoverDist!)} parties={drillDistrict.parties}
                  turnout={drillDistrict.turnout} total={drillDistrict.total} />
              )}
              {!drillDistrict && <p className="hint">시군구에 마우스를 올리면 상세 득표가 표시됩니다.</p>}
            </>
          )}
          {!result && <p className="hint">좌측에서 출마할 선거를 고르고 실행하세요.</p>}
        </section>
      </div>
    </div>
  );
}
