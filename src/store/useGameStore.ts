import { create } from 'zustand';
import { Approval, Character, ElectionResult, ElectionType, ImageAxis, PositionId } from '../types';
import { computeElection } from '../engine/electionEngine';
import { POSITION_LABEL } from '../engine/careerSystem';
import { EventEffect, GameEvent, drawEvent } from '../engine/eventSystem';
import { getDistricts } from '../data/supportModel';
import { provinceName as pcName } from '../data/provinces';

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const START_YEAR = 2026;

export interface OfficeChoice {
  kind: 'president' | 'assembly' | 'governor' | 'local_head';
  districtCode?: string;
  provinceCode?: string;
}

interface ArchiveEntry { year: number; type: ElectionType; label: string; won: boolean; summary: string; result: ElectionResult; }

interface GameState {
  started: boolean;
  character: Character | null;
  year: number; quarter: number; ap: number; maxAp: number;
  position: PositionId;
  ministry?: string;
  approval: Approval;
  recognition: number;
  image: ImageAxis;
  partyStanding: number;
  funding: number;
  rulingPartyId?: string;
  govApproval: number;
  log: string[];
  pendingEvent: GameEvent | null;
  lastElection: ElectionResult | null;
  archive: ArchiveEntry[];

  newGame: (c: Character) => void;
  reset: () => void;
  spendAp: (n: number) => boolean;
  endTurn: () => void;
  campaign: (provinceCode: string) => void;
  speech: (group: keyof Approval['byGroup'], topic: string) => void;
  applyEffect: (e: EventEffect, log: string) => void;
  press: (effect: EventEffect, label: string) => void;
  sns: () => void;
  fundraise: () => void;
  resolveEvent: (choiceIndex: number) => void;
  candidateBonus: () => number;
  nationalMood: () => Record<string, number>;
  runElection: (type: ElectionType, office: OfficeChoice) => ElectionResult;
  becomeMinister: (ministry: string) => void;
  save: () => void;
  load: () => boolean;
}

function emptyApproval(): Approval {
  return {
    national: 5,
    byProvince: {},
    byGroup: { male: 5, female: 5, a2030: 5, a4050: 5, a6070: 5, working: 5, middle: 5, upper: 5 },
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  started: false,
  character: null,
  year: START_YEAR, quarter: 1, ap: 3, maxAp: 3,
  position: 'none',
  approval: emptyApproval(),
  recognition: 10,
  image: { integrity: 55, reform: 50, stability: 50, populism: 50 },
  partyStanding: 30,
  funding: 30,
  govApproval: 50,
  log: [],
  pendingEvent: null,
  lastElection: null,
  archive: [],

  newGame: (c) => {
    const ap = emptyApproval();
    ap.byProvince[c.originProvince] = 14;
    set({
      started: true, character: c, year: START_YEAR, quarter: 1, ap: 3, maxAp: 3,
      position: 'none', approval: ap, recognition: 10,
      image: { integrity: 50 + (c.stats.integrity - 45) * 0.3, reform: 50, stability: 50, populism: 50 },
      partyStanding: 30, funding: 30 + (c.stats.funding - 45) * 0.4, govApproval: 50,
      log: [`${c.name} 정치 입문 — ${POSITION_LABEL.none} (${START_YEAR}년)`],
      pendingEvent: null, lastElection: null, archive: [], rulingPartyId: undefined,
    });
  },
  reset: () => set({ started: false, character: null }),

  spendAp: (n) => { const { ap } = get(); if (ap < n) return false; set({ ap: ap - n }); return true; },

  endTurn: () => {
    const s = get();
    let { year, quarter } = s;
    quarter += 1; if (quarter > 4) { quarter = 1; year += 1; }
    const recognition = clamp(s.recognition - 2);
    const log = [...s.log, `── ${year}년 ${quarter}분기 ──`];
    // 25% 랜덤 이벤트
    let pendingEvent: GameEvent | null = null;
    if (Math.random() < 0.3) pendingEvent = drawEvent(Math.random);
    set({ year, quarter, ap: s.maxAp, recognition, log: log.slice(-80), pendingEvent });
  },

  campaign: (pc) => {
    const s = get(); if (!s.spendAp(1)) return;
    const c = s.character!;
    const gain = 4 + c.stats.oratory * 0.06 + c.stats.funding * 0.03 + s.funding * 0.02;
    const ap = structuredClone(s.approval);
    ap.byProvince[pc] = clamp((ap.byProvince[pc] ?? 5) + gain);
    ap.national = clamp(ap.national + gain * 0.15);
    set({ approval: ap, recognition: clamp(s.recognition + 3), log: [...s.log, `${pcName(pc)} 유세 — 지역 지지율 +${gain.toFixed(1)}`].slice(-80) });
  },

  speech: (group, topic) => {
    const s = get(); if (!s.spendAp(1)) return;
    const c = s.character!;
    const gain = 4 + c.stats.oratory * 0.08;
    const ap = structuredClone(s.approval);
    ap.byGroup[group] = clamp(ap.byGroup[group] + gain);
    ap.national = clamp(ap.national + gain * 0.2);
    set({ approval: ap, recognition: clamp(s.recognition + 2), log: [...s.log, `'${topic}' 연설 — 해당 계층 지지율 +${gain.toFixed(1)}`].slice(-80) });
  },

  applyEffect: (e, logMsg) => {
    const s = get();
    const ap = structuredClone(s.approval);
    if (e.approvalNational) ap.national = clamp(ap.national + e.approvalNational);
    const img = { ...s.image };
    if (e.integrity) img.integrity = clamp(img.integrity + e.integrity);
    if (e.reform) img.reform = clamp(img.reform + e.reform);
    if (e.stability) img.stability = clamp(img.stability + e.stability);
    if (e.populism) img.populism = clamp(img.populism + e.populism);
    set({
      approval: ap, image: img,
      recognition: clamp(s.recognition + (e.recognition ?? 0)),
      funding: clamp(s.funding + (e.funding ?? 0)),
      partyStanding: clamp(s.partyStanding + (e.partyStanding ?? 0)),
      log: [...s.log, logMsg].slice(-80),
    });
  },

  press: (effect, label) => { const s = get(); if (!s.spendAp(1)) return; s.applyEffect({ recognition: 4, ...effect }, `기자회견: ${label}`); },
  sns: () => { const s = get(); if (!s.spendAp(1)) return; set({ recognition: clamp(s.recognition + 4), log: [...s.log, 'SNS/언론 활동 — 인지도 +4'].slice(-80) }); },
  fundraise: () => { const s = get(); if (!s.spendAp(1)) return; const g = 6 + s.character!.stats.funding * 0.06; set({ funding: clamp(s.funding + g), partyStanding: clamp(s.partyStanding + 1), log: [...s.log, `자금 모금 — 자금력 +${g.toFixed(0)}`].slice(-80) }); },

  resolveEvent: (i) => { const s = get(); const ev = s.pendingEvent; if (!ev) return; const ch = ev.choices[i]; s.applyEffect(ch.effect, `[${ev.title}] ${ch.result}`); set({ pendingEvent: null }); },

  candidateBonus: () => {
    const s = get(); const c = s.character!;
    const prov = c.originProvince;
    return Math.round((s.approval.byProvince[prov] ?? 5) * 0.4 + s.recognition * 0.35 + c.stats.oratory * 0.12);
  },

  nationalMood: () => {
    const s = get(); const c = s.character!; const mood: Record<string, number> = {};
    const tail = (s.recognition - 30) * 0.06 + (s.approval.national - 50) * 0.06;
    mood[c.partyId] = (mood[c.partyId] ?? 0) + tail;
    if (s.rulingPartyId) mood[s.rulingPartyId] = (mood[s.rulingPartyId] ?? 0) + (s.govApproval - 50) * 0.12;
    return mood;
  },

  runElection: (type, office) => {
    const s = get(); const c = s.character!;
    const districtCode = office.districtCode ?? defaultDistrict(c.originProvince);
    const result = computeElection({
      type, year: s.year, nationalMood: s.nationalMood(), seed: s.year * 7 + s.quarter,
      player: { partyId: c.partyId, districtCode, bonus: s.candidateBonus() },
    });
    // 승패 판정
    let won = false; let label = '';
    if (office.kind === 'president') { won = result.winnerPartyId === c.partyId; label = '대통령선거'; }
    else if (office.kind === 'assembly') { won = result.districts[districtCode]?.winner === c.partyId; label = '국회의원선거'; }
    else if (office.kind === 'governor') { won = result.provinces[office.provinceCode ?? c.originProvince]?.winner === c.partyId; label = '광역단체장선거'; }
    else { won = result.districts[districtCode]?.winner === c.partyId; label = '기초단체장선거'; }
    result.playerWon = won;

    // 커리어 반영
    const patch: Partial<GameState> = {};
    if (won) {
      if (office.kind === 'president') { patch.position = 'president'; patch.rulingPartyId = c.partyId; patch.govApproval = s.approval.national; }
      else if (office.kind === 'assembly') patch.position = 'assembly_member';
      else patch.position = 'local_head';
    }
    const entry: ArchiveEntry = {
      year: s.year, type, label, won,
      summary: won ? '당선' : '낙선', result,
    };
    set({
      lastElection: result, archive: [entry, ...s.archive].slice(0, 20),
      log: [...s.log, `${s.year} ${label} — ${won ? '🎉 당선!' : '낙선'}`].slice(-80),
      ...patch,
    });
    return result;
  },

  becomeMinister: (ministry) => {
    const s = get();
    set({ position: s.position === 'pm' ? 'pm' : 'minister', ministry, log: [...s.log, `${ministry} 임명 — 국정 수행 시작`].slice(-80), partyStanding: clamp(s.partyStanding + 8) });
  },

  save: () => { const s = get(); const { newGame, reset, spendAp, endTurn, campaign, speech, applyEffect, press, sns, fundraise, resolveEvent, candidateBonus, nationalMood, runElection, becomeMinister, save, load, ...data } = s; localStorage.setItem('kps.save', JSON.stringify(data)); set({ log: [...s.log, '게임 저장됨'].slice(-80) }); },
  load: () => { const raw = localStorage.getItem('kps.save'); if (!raw) return false; try { set(JSON.parse(raw)); return true; } catch { return false; } },
}));

function defaultDistrict(provinceCode: string) {
  const d = getDistricts().find((x) => x.provinceCode === provinceCode);
  return d?.code ?? getDistricts()[0].code;
}
