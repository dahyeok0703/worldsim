import { GameState, Player, Region, Spot, Stats } from './types';
import {
  ITEMS, RECIPES, SEA_ROUTES, SPOT_TYPES, chance, clamp, generateWorld, pick, rint, rnd,
} from './world';

export const SKILLS: Record<string, { name: string; desc: string; lv: number }> = {
  posik: { name: '포식', desc: '처치 시 드물게 능력치가 영구 상승하거나 회복한다.', lv: 1 },
  instinct: { name: '생존본능', desc: '수색 중 위험 감지가 좋아져 기습 확률이 준다.', lv: 2 },
  aid: { name: '응급처치', desc: '휴식 시 HP를 추가로 회복한다.', lv: 3 },
  butcher: { name: '도살자', desc: '교전 시 전투력과 처치 수가 증가한다.', lv: 4 },
  shadow: { name: '그림자', desc: '은밀 교전이 강해지고 야간 공포가 줄어든다.', lv: 5 },
};

export const maxHp = (p: Player) => 100 + p.stats.VIT * 10;
export const maxSanity = (p: Player) => 60 + p.stats.WIL * 8;
export const expToNext = (lv: number) => 70 + lv * 45;
export const weaponAtk = (p: Player) => (p.equipped ? ITEMS[p.equipped]?.atk ?? 0 : 0);

export function combatPower(p: Player) {
  let v = p.stats.STR * 2 + weaponAtk(p) + p.level * 1.5 + (p.skills.includes('butcher') ? 6 : 0);
  if (p.energy < 20) v *= 0.8;
  if (p.sanity < 15) v *= 0.85;
  return v;
}
export function dodgeChance(p: Player) {
  return clamp(p.stats.AGI * 0.02 + (p.skills.includes('shadow') ? 0.08 : 0) + (p.energy < 15 ? -0.1 : 0), 0, 0.5);
}

const L = (s: GameState, m: string) => s.log.push(m);
export const addItem = (p: Player, id: string, q = 1) => { p.inv[id] = (p.inv[id] ?? 0) + q; };
export const itemCount = (p: Player, id: string) => p.inv[id] ?? 0;
export function removeItem(p: Player, id: string, q = 1) {
  p.inv[id] = (p.inv[id] ?? 0) - q;
  if (p.inv[id] <= 0) delete p.inv[id];
}
export const curSpot = (s: GameState): Spot | undefined => {
  for (const r of Object.values(s.regions)) { const sp = r.spots.find((x) => x.id === s.player.locationId); if (sp) return sp; }
  return undefined;
};
export const curRegion = (s: GameState): Region => {
  const sp = curSpot(s);
  return s.regions[sp?.regionId ?? s.player.locationId];
};
const isNight = (h: number) => h >= 21 || h < 6;

export function gainExp(s: GameState, amount: number) {
  const p = s.player;
  p.exp += amount;
  while (p.exp >= expToNext(p.level)) {
    p.exp -= expToNext(p.level);
    p.level += 1; p.statPoints += 3;
    p.hp = maxHp(p); p.sanity = maxSanity(p);
    L(s, `▲ 레벨 업! Lv.${p.level} (능력치 포인트 +3, 체력·정신 회복)`);
    for (const [id, sk] of Object.entries(SKILLS))
      if (sk.lv === p.level && !p.skills.includes(id)) { p.skills.push(id); L(s, `✦ 스킬 습득: ${sk.name}`); }
  }
}

function rewardKills(s: GameState, kills: number) {
  const p = s.player;
  p.killed += kills;
  const infest = curRegion(s).infestation;
  gainExp(s, Math.round(kills * (7 + infest * 0.06)));
  // 포식
  let procs = 0;
  for (let i = 0; i < kills; i++) if (chance(0.06)) procs++;
  for (let i = 0; i < procs; i++) {
    if (chance(0.5)) {
      const k = pick(['STR', 'AGI', 'VIT', 'PER', 'WIL']) as keyof Stats;
      p.stats[k] += 1; L(s, `◈ 포식! 잔재를 흡수해 ${k}이(가) 영구히 상승했다.`);
    } else { p.hp = Math.min(maxHp(p), p.hp + 15); L(s, '◈ 포식! 생체 조직을 흡수해 상처가 아문다. (HP +15)'); }
  }
}

export function checkDeath(s: GameState) {
  const p = s.player;
  if (p.infection >= 100) { L(s, '감염도가 한계를 넘었다. 시야가 붉게 물들고… 당신은 더 이상 당신이 아니다.'); s.phase = 'dead'; }
  else if (p.hp <= 0) { p.hp = 0; L(s, '상처가 너무 깊다. 의식이 흐려진다…'); s.phase = 'dead'; }
}

export function advanceTime(s: GameState, hours: number, opts: { resting?: boolean } = {}) {
  const p = s.player;
  const prevDay = p.day;
  for (let i = 0; i < hours; i++) {
    p.hour += 1; if (p.hour >= 24) { p.hour -= 24; p.day += 1; }
    p.food = clamp(p.food - 1.8, 0, 100);
    p.water = clamp(p.water - 2.2, 0, 100);
    if (opts.resting) p.energy = clamp(p.energy + 9, 0, 100);
    else p.energy = clamp(p.energy - 1.0, 0, 100);
    if (p.infection > 0) p.infection = clamp(p.infection + 0.6, 0, 100);
    if (p.food <= 0) { p.hp -= 2.5; p.sanity -= 1; }
    if (p.water <= 0) p.hp -= 3.5;
    if (p.energy <= 0) p.sanity -= 1.5;
    if (isNight(p.hour) && !opts.resting) {
      const fear = p.skills.includes('shadow') ? 0.2 : itemCount(p, 'flashlight') ? 0.3 : 0.6;
      p.sanity = clamp(p.sanity - fear, 0, maxSanity(p));
    }
    p.hp = clamp(p.hp, -999, maxHp(p));
    p.sanity = clamp(p.sanity, 0, maxSanity(p));
  }
  // 하루 경과: 비거점 장소 좀비 재유입 + 감염도 변동
  if (p.day > prevDay) {
    for (const r of Object.values(s.regions)) {
      r.infestation = clamp(r.infestation + rnd(-3, 4), 5, 100);
      for (const sp of r.spots) if (!sp.secured) sp.zombies += rint(0, Math.round(SPOT_TYPES[sp.type].zMax * 0.15));
    }
    L(s, `── ${p.day}일차 아침 ──`);
  }
}

// ── 수색 ──
export function scavenge(s: GameState) {
  const p = s.player; const sp = curSpot(s)!; const td = SPOT_TYPES[sp.type];
  if (sp.looted >= 95) { L(s, '이곳은 이미 샅샅이 뒤졌다. 쓸 만한 게 거의 없다.'); }
  const eff = (1 - sp.looted / 130) * (1 + p.stats.PER * 0.04);
  const found: string[] = [];
  for (const e of td.loot) {
    if (chance(e.c * eff)) {
      const q = rint(e.q[0], e.q[1]);
      addItem(p, e.id, q); found.push(`${ITEMS[e.id].name}×${q}`);
      if (ITEMS[e.id].type === 'weapon' && (ITEMS[e.id].atk ?? 0) > weaponAtk(p)) { p.equipped = e.id; }
    }
  }
  sp.looted = clamp(sp.looted + rint(14, 28), 0, 100);
  L(s, found.length ? `수색 결과: ${found.join(', ')}` : '쓸 만한 물자를 찾지 못했다.');
  p.energy = clamp(p.energy - 6, 0, 100);
  advanceTime(s, 2);
  // 기습 위험
  let risk = 0.08 + td.danger * 0.05 + sp.zombies * 0.015 + curRegion(s).infestation * 0.002;
  if (isNight(p.hour)) risk += 0.12;
  if (p.skills.includes('instinct')) risk -= 0.12;
  if (chance(clamp(risk, 0, 0.85)) && sp.zombies > 0) {
    L(s, '⚠ 소음에 이끌려 감염체들이 다가온다!');
    const ambush = Math.min(sp.zombies, rint(1, 3));
    skirmishResolve(s, ambush, 'careful', true);
  } else {
    maybeEvent(s);
  }
  checkDeath(s);
}

// ── 교전 ──
export function skirmish(s: GameState, mode: 'aggro' | 'careful' | 'stealth') {
  const sp = curSpot(s)!;
  if (sp.zombies <= 0) { L(s, '주변에 감염체가 없다.'); return; }
  const engage = sp.zombies;
  skirmishResolve(s, engage, mode, false);
  s.player.energy = clamp(s.player.energy - 8, 0, 100);
  advanceTime(s, 1);
  checkDeath(s);
}

function skirmishResolve(s: GameState, count: number, mode: 'aggro' | 'careful' | 'stealth', ambush: boolean) {
  const p = s.player; const sp = curSpot(s)!; const infest = curRegion(s).infestation;
  const zHp = 16 + infest * 0.12; const zAtk = 8 + infest * 0.06; const bite = 0.10;
  let z = count, killed = 0, rounds = 0, retreat = false;
  while (z > 0 && p.hp > 0 && rounds < 40) {
    let power = combatPower(p) * (mode === 'aggro' ? 1.25 : mode === 'stealth' ? 0.9 : 1);
    const k = clamp(Math.floor((power / zHp) * rnd(0.7, 1.15)), 1, z);
    z -= k; killed += k;
    if (z <= 0) break;
    const attackers = mode === 'stealth' ? Math.min(z, rint(0, 1)) : mode === 'careful' ? Math.min(z, 2) : Math.min(z, 4);
    for (let i = 0; i < attackers; i++) {
      if (chance(dodgeChance(p))) continue;
      const dmg = Math.max(1, Math.round(zAtk - p.stats.VIT * 0.4));
      p.hp -= dmg;
      if (chance(bite)) { p.infection = clamp(p.infection + rint(8, 16), 0, 100); L(s, `🩸 물렸다! 감염도 상승 (현재 ${Math.round(p.infection)})`); }
    }
    rounds++;
    if (mode === 'careful' && p.hp < maxHp(p) * 0.4) { retreat = true; break; }
  }
  sp.zombies = Math.max(0, z);
  if (killed > 0) { L(s, `${ambush ? '응전' : '교전'}: 감염체 ${killed}마리 처치.`); rewardKills(s, killed); }
  if (retreat) L(s, '위험을 느끼고 물러섰다. 일부는 아직 남아 있다.');
  else if (sp.zombies === 0) L(s, '이 일대를 정리했다. 잠시 안전하다.');
  else if (sp.zombies > 0 && !ambush) L(s, `아직 ${sp.zombies}마리가 남았다.`);
}

export function useMolotov(s: GameState) {
  const p = s.player; const sp = curSpot(s)!;
  if (itemCount(p, 'molotov') <= 0) { L(s, '화염병이 없다.'); return; }
  if (sp.zombies <= 0) { L(s, '던질 대상이 없다.'); return; }
  removeItem(p, 'molotov', 1);
  const k = Math.min(sp.zombies, rint(4, 9));
  sp.zombies -= k;
  L(s, `🔥 화염병이 터지며 감염체 ${k}마리를 불태웠다!`);
  rewardKills(s, k);
  advanceTime(s, 1);
  checkDeath(s);
}

// ── 휴식 ──
export function rest(s: GameState, hours: number) {
  const p = s.player; const sp = curSpot(s);
  const safe = sp?.secured || (sp?.zombies ?? 99) === 0;
  advanceTime(s, hours, { resting: true });
  let heal = hours * 1.5 + (p.skills.includes('aid') ? hours * 1.0 : 0);
  if (safe) heal *= 1.5;
  p.hp = Math.min(maxHp(p), p.hp + heal);
  p.sanity = Math.min(maxSanity(p), p.sanity + hours * (safe ? 2.2 : 0.8));
  L(s, `${hours}시간 휴식했다. (${safe ? '안전한 곳' : '불안한 곳'}) HP/정신 회복.`);
  if (!safe && chance(0.3 + (sp?.zombies ?? 0) * 0.02)) {
    L(s, '⚠ 잠결에 감염체가 들이닥쳤다!');
    skirmishResolve(s, Math.min(sp?.zombies ?? 1, rint(1, 4)), 'careful', true);
  }
  checkDeath(s);
}

// ── 섭취 ──
export function consume(s: GameState, id: string) {
  const p = s.player; const it = ITEMS[id];
  if (!it || itemCount(p, id) <= 0) return;
  removeItem(p, id, 1);
  if (it.food) p.food = clamp(p.food + it.food, 0, 100);
  if (it.water) p.water = clamp(p.water + it.water, 0, 100);
  if (it.hp) p.hp = Math.min(maxHp(p), p.hp + it.hp);
  if (it.sanity) p.sanity = clamp(p.sanity + it.sanity, 0, maxSanity(p));
  if (it.cureInfection) p.infection = clamp(p.infection - it.cureInfection, 0, 100);
  L(s, `${it.name} 사용.`);
}

// ── 제작 ──
export function craft(s: GameState, recipeId: string) {
  const p = s.player; const r = RECIPES.find((x) => x.id === recipeId)!;
  for (const inp of r.inputs) if (itemCount(p, inp.id) < inp.qty) { L(s, '재료가 부족하다.'); return; }
  if (r.needTool && itemCount(p, r.needTool) <= 0) { L(s, `${ITEMS[r.needTool].name}이(가) 필요하다.`); return; }
  for (const inp of r.inputs) removeItem(p, inp.id, inp.qty);
  addItem(p, r.out, r.outQty);
  if (r.out === 'pipe' && (ITEMS.pipe.atk ?? 0) > weaponAtk(p)) p.equipped = 'pipe';
  L(s, `제작 완료: ${ITEMS[r.out].name}×${r.outQty}`);
  advanceTime(s, 1);
}

// ── 거점화 ──
export function secureBase(s: GameState) {
  const p = s.player; const sp = curSpot(s)!;
  if (sp.zombies > 0) { L(s, '먼저 이곳의 감염체를 정리해야 한다.'); return; }
  if (itemCount(p, 'wood') < 3 || itemCount(p, 'scrap') < 2) { L(s, '거점화에는 목재×3, 고철×2가 필요하다.'); return; }
  removeItem(p, 'wood', 3); removeItem(p, 'scrap', 2);
  sp.secured = true; p.baseId = sp.id;
  L(s, `${sp.name}을(를) 거점으로 확보했다. 이제 안전하게 쉴 수 있다.`);
  advanceTime(s, 2);
}

// ── 이동 ──
export function moveSpot(s: GameState, spotId: string) {
  const target = curRegion(s).spots.find((x) => x.id === spotId);
  if (!target) return;
  s.player.locationId = spotId; target.discovered = true;
  L(s, `${target.name}(으)로 이동했다.`);
  s.player.energy = clamp(s.player.energy - 3, 0, 100);
  advanceTime(s, 1);
  maybeEvent(s);
  checkDeath(s);
}

export function travelRegion(s: GameState, regionId: string) {
  const p = s.player; const from = curRegion(s);
  if (!from.neighbors.includes(regionId)) { L(s, '바로 갈 수 없는 지역이다.'); return; }
  const to = s.regions[regionId];
  const drive = itemCount(p, 'fuel') >= 1;
  if (drive) { removeItem(p, 'fuel', 1); }
  const hours = drive ? 2 : 5;
  to.spots.forEach((x) => (x.discovered = true));
  const arrive = pick(to.spots.filter((x) => SPOT_TYPES[x.type].danger <= 2)) ?? to.spots[0];
  p.locationId = arrive.id;
  L(s, `${to.name}으로 ${drive ? '차량 이동' : '도보 이동'}했다 (${hours}시간). 도착: ${arrive.name}`);
  p.energy = clamp(p.energy - (drive ? 6 : 14), 0, 100);
  advanceTime(s, hours);
  roadEvent(s);
  checkDeath(s);
}

export function seaDestinations(s: GameState): { id: string; name: string }[] {
  const sp = curSpot(s); if (!sp || (sp.type !== 'port' && sp.type !== 'airport')) return [];
  const cur = curRegion(s).id;
  const out: { id: string; name: string }[] = [];
  for (const r of SEA_ROUTES) {
    if (r.from === cur) out.push({ id: r.to, name: s.regions[r.to].name });
    if (r.to === cur) out.push({ id: r.from, name: s.regions[r.from].name });
  }
  return out;
}
export function seaTravel(s: GameState, regionId: string) {
  const p = s.player;
  if (itemCount(p, 'fuel') < 3) { L(s, '항해(연료 3)가 부족하다.'); return; }
  removeItem(p, 'fuel', 3);
  const to = s.regions[regionId];
  to.spots.forEach((x) => (x.discovered = true));
  const arrive = to.spots.find((x) => x.type === 'port' || x.type === 'airport') ?? to.spots[0];
  p.locationId = arrive.id;
  L(s, `배를 타고 ${to.name}에 도착했다 (8시간). ${to.overseas ? '낯선 땅이다.' : ''}`);
  p.energy = clamp(p.energy - 12, 0, 100);
  advanceTime(s, 8);
  checkDeath(s);
}

// ── 이벤트 ──
function maybeEvent(s: GameState) {
  if (s.pending) return;
  if (!chance(0.28)) return;
  const roll = Math.random();
  const p = s.player;
  if (roll < 0.3) {
    s.pending = {
      title: '생존자 조우',
      text: '한 생존자가 경계하며 다가온다. "물자를… 좀 나눌 수 있을까요? 대신 정보를 드리죠."',
      choices: [
        { label: '음식을 나눠준다 (식량 소비, 단서 획득)', key: 'survivor_help' },
        { label: '협박해 빼앗는다 (물자 획득, 정신 -)', key: 'survivor_rob' },
        { label: '무시하고 지나간다', key: 'survivor_ignore' },
      ],
    };
  } else if (roll < 0.5) {
    const r = rint(1, 3); addItem(p, 'fuel', r); L(s, `버려진 차량에서 연료 ${r}을(를) 빼냈다.`);
  } else if (roll < 0.68) {
    L(s, '낡은 라디오에서 잡음 섞인 군 방송이 흘러나온다. 잠시 마음이 놓인다. (정신 +6)');
    p.sanity = clamp(p.sanity + 6, 0, maxSanity(s.player));
  } else if (roll < 0.84) {
    revealLabRumor(s);
  } else {
    const sp = curSpot(s)!; const add = rint(2, 5); sp.zombies += add;
    L(s, `멀리서 무리가 몰려온다. 이곳의 감염체가 ${add}마리 늘었다.`);
  }
}

function roadEvent(s: GameState) {
  if (!chance(0.45)) return;
  const p = s.player; const roll = Math.random();
  if (roll < 0.4) {
    L(s, '도로에서 감염체 무리와 마주쳤다!');
    skirmishResolve(s, rint(2, 6), 'careful', true);
  } else if (roll < 0.7) {
    L(s, '길가 폐가에서 보급품을 발견했다.');
    addItem(p, pick(['canned', 'water', 'bandage', 'scrap']), rint(1, 2));
  } else {
    revealLabRumor(s);
  }
}

function revealLabRumor(s: GameState) {
  if (s.player.flags['labRumor']) return;
  let labRegion: Region | undefined;
  for (const r of Object.values(s.regions)) if (r.spots.some((x) => x.type === 'lab')) labRegion = r;
  if (!labRegion) return;
  s.player.flags['labRumor'] = labRegion.id;
  L(s, `📻 단서 입수: "${labRegion.name}에 국립 감염병연구소가 있고, 백신 자료가 남아 있다"는 소문을 들었다.`);
}

export function resolvePending(s: GameState, key: string) {
  const p = s.player; s.pending = undefined;
  if (key === 'survivor_help') {
    if (itemCount(p, 'canned') > 0 || itemCount(p, 'rice') > 0) {
      removeItem(p, itemCount(p, 'canned') > 0 ? 'canned' : 'rice', 1);
      revealLabRumor(s);
      p.sanity = clamp(p.sanity + 8, 0, maxSanity(p));
      L(s, '생존자가 고마워하며 단서를 남기고 떠났다. (정신 +8)');
    } else L(s, '나눠줄 식량이 없어 생존자는 실망하며 떠났다.');
  } else if (key === 'survivor_rob') {
    addItem(p, pick(['canned', 'water', 'bandage', 'scrap']), rint(1, 3));
    p.sanity = clamp(p.sanity - 12, 0, maxSanity(p));
    p.flags['ruthless'] = true;
    L(s, '겁에 질린 생존자의 물자를 빼앗았다. 뒷맛이 씁쓸하다. (정신 -12)');
  } else {
    L(s, '못 본 척 지나쳤다.');
  }
}

// ── 백신/엔딩 체크 ──
export function tryVaccine(s: GameState) {
  const sp = curSpot(s)!;
  if (sp.type !== 'lab') return;
  if (sp.zombies > 0) { L(s, '연구소를 장악한 감염체부터 처리해야 한다.'); return; }
  s.player.flags['vaccine'] = true;
  L(s, '🧪 연구소 깊은 곳에서 백신 시료와 연구 자료를 확보했다! 인류에게 희망이 생겼다.');
  L(s, `── 당신은 ${s.player.day}일을 버텨냈고, 끝내 백신을 손에 넣었다. (목표 달성) ──`);
}

// ── 생성 ──
export function buildGame(name: string, stats: Stats): GameState {
  const regions = generateWorld();
  const start = regions['seoul'].spots.find((x) => x.type === 'residential')!;
  regions['seoul'].spots.forEach((x) => (x.discovered = true));
  start.zombies = Math.min(start.zombies, 2);
  const player: Player = {
    name: name.trim() || '생존자',
    level: 1, exp: 0, statPoints: 0, stats,
    hp: 100 + stats.VIT * 10, sanity: 60 + stats.WIL * 8,
    food: 80, water: 80, energy: 100, infection: 0,
    skills: ['posik'], inv: { knife: 1, water: 2, rice: 1, bandage: 1 }, equipped: 'knife',
    locationId: start.id, day: 1, hour: 8, killed: 0, flags: {},
  };
  return {
    phase: 'play', player, regions,
    log: [
      '디데이 +3. 좀비 바이러스가 전국을 삼켰다.',
      `${player.name}의 눈앞에 자신만 보이는 「생존자 시스템」이 떠올랐다.`,
      '— 자유롭게 행동하라. 정답은 없다. 그저 살아남아라. —',
    ],
  };
}
