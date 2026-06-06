import { MAJOR_PARTY_IDS } from '../data/parties';
import { getDistricts } from '../data/supportModel';
import { demographicShift, hashCode, mulberry32 } from '../data/supportModel';
import {
  DistrictResult, ElectionResult, ElectionType, NationalPartyResult, ProvinceResult,
} from '../types';
import { allocatePR } from './seatAllocation';

export interface ElectionContext {
  type: ElectionType;
  year: number;
  nationalMood?: Record<string, number>; // 정당별 전국 기류 가산
  player?: { partyId: string; districtCode: string; bonus: number } | null;
  incumbents?: Record<string, string>; // districtCode -> partyId (현역)
  seed?: number;
}

const TOTAL_PL = 46; // 비례대표 의석(간이)

function turnoutOf(code: string): number {
  return 0.55 + mulberry32(hashCode(code + 'turnout'))() * 0.23;
}

export function computeElection(ctx: ElectionContext): ElectionResult {
  const districts = getDistricts();
  const seed = ctx.seed ?? 1;
  const mood = ctx.nationalMood ?? {};
  const player = ctx.player ?? null;

  const districtResults: Record<string, DistrictResult> = {};
  const nationalVotes: Record<string, number> = {};
  const provinceAgg: Record<string, Record<string, number>> = {};

  for (const d of districts) {
    const runningParties = [...MAJOR_PARTY_IDS];
    if (player?.partyId === '무소속' && player.districtCode === d.code) runningParties.push('무소속');

    const raw: Record<string, number> = {};
    const rnd = mulberry32(hashCode(d.code + ':' + seed));
    for (const p of runningParties) {
      let v = (d.baseLean[p] ?? 0) + demographicShift(d.demographics, p) + (mood[p] ?? 0);
      if (ctx.incumbents?.[d.code] === p) v += 3;
      if (player && player.districtCode === d.code && player.partyId === p) v += player.bonus;
      v += (rnd() - 0.5) * 6;
      raw[p] = Math.max(0, v);
    }
    const sum = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
    const turnout = turnoutOf(d.code);
    const totalVotes = Math.round(d.electorate * turnout);
    const parts = runningParties
      .map((p) => {
        const pct = (raw[p] / sum) * 100;
        const votes = Math.round((pct / 100) * totalVotes);
        nationalVotes[p] = (nationalVotes[p] ?? 0) + votes;
        provinceAgg[d.provinceCode] = provinceAgg[d.provinceCode] ?? {};
        provinceAgg[d.provinceCode][p] = (provinceAgg[d.provinceCode][p] ?? 0) + votes;
        return { id: p, votes, pct };
      })
      .sort((a, b) => b.votes - a.votes);
    districtResults[d.code] = {
      code: d.code, winner: parts[0].id, parties: parts, turnout, total: totalVotes,
    };
  }

  // 광역 집계
  const provinces: Record<string, ProvinceResult> = {};
  for (const [pc, votesByParty] of Object.entries(provinceAgg)) {
    const total = Object.values(votesByParty).reduce((a, b) => a + b, 0) || 1;
    const parts = Object.entries(votesByParty)
      .map(([id, votes]) => ({ id, votes, pct: (votes / total) * 100 }))
      .sort((a, b) => b.votes - a.votes);
    provinces[pc] = { code: pc, winner: parts[0].id, parties: parts };
  }

  // 전국 집계
  const totalNational = Object.values(nationalVotes).reduce((a, b) => a + b, 0) || 1;
  const voteShare: Record<string, number> = {};
  for (const [id, v] of Object.entries(nationalVotes)) voteShare[id] = (v / totalNational) * 100;

  // 지역구 의석 = 시군구 승자
  const seatsLocal: Record<string, number> = {};
  for (const r of Object.values(districtResults)) seatsLocal[r.winner] = (seatsLocal[r.winner] ?? 0) + 1;

  // 비례 의석
  const seatsPL = ctx.type === 'assembly' ? allocatePR(voteShare, TOTAL_PL, 3) : {};

  const national: NationalPartyResult[] = Object.keys(nationalVotes)
    .map((id) => ({
      id, votes: nationalVotes[id], pct: voteShare[id],
      seatsLocal: seatsLocal[id] ?? 0, seatsPL: seatsPL[id] ?? 0,
      seats: (seatsLocal[id] ?? 0) + (seatsPL[id] ?? 0),
    }))
    .sort((a, b) => (ctx.type === 'assembly' ? b.seats - a.seats : b.votes - a.votes));

  const winnerPartyId = [...national].sort((a, b) => b.votes - a.votes)[0]?.id;

  let playerWon: boolean | undefined;
  if (player) {
    if (ctx.type === 'president') playerWon = winnerPartyId === player.partyId;
    else playerWon = districtResults[player.districtCode]?.winner === player.partyId;
  }

  return {
    type: ctx.type, year: ctx.year, districts: districtResults, provinces, national,
    totalLocal: districts.length, totalPL: ctx.type === 'assembly' ? TOTAL_PL : 0,
    playerWon, playerDistrict: player?.districtCode, winnerPartyId,
  };
}
