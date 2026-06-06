import { ENEMIES, ITEMS, SKILLS } from './content';
import { Effect, Enemy, Player, Stats } from './types';

export const maxHp = (p: Player) => 100 + p.stats.VIT * 10;
export const maxMental = (p: Player) => 50 + p.stats.WIL * 6;
export const expToNext = (level: number) => 80 + level * 40;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function weaponAtk(p: Player): number {
  const w = p.equipped ? ITEMS[p.equipped] : null;
  return w?.atk ?? 0;
}

export const critChance = (p: Player) => clamp(0.05 + p.stats.PER * 0.02, 0, 0.55);
export const dodgeChance = (p: Player) =>
  clamp(p.stats.AGI * 0.02 + (p.skills.includes('sprint') ? 0.1 : 0) + (p.mental < 10 ? -0.1 : 0), 0, 0.5);
export const fleeChance = (p: Player) =>
  clamp(0.4 + p.stats.AGI * 0.035 + (p.skills.includes('sprint') ? 0.15 : 0), 0.1, 0.92);

export function basePlayerHit(p: Player) {
  const dmg = p.stats.STR * 2 + weaponAtk(p) + randInt(0, p.stats.STR);
  return Math.max(1, Math.round(dmg));
}

/** 플레이어 공격 결과 */
export function playerAttack(
  p: Player,
  enemy: Enemy,
  opts: { multiplier?: number; forceCrit?: boolean } = {}
): { dmg: number; crit: boolean; dodged: boolean } {
  if (enemy.dodge && Math.random() < enemy.dodge) return { dmg: 0, crit: false, dodged: true };
  let dmg = basePlayerHit(p) * (opts.multiplier ?? 1);
  const crit = opts.forceCrit || Math.random() < critChance(p);
  if (crit) dmg *= 1.8;
  dmg -= enemy.def ?? 0;
  return { dmg: Math.max(1, Math.round(dmg)), crit, dodged: false };
}

/** 적 공격 결과 (플레이어 회피 반영) */
export function enemyAttack(p: Player, enemy: Enemy): { dmg: number; dodged: boolean } {
  if (Math.random() < dodgeChance(p)) return { dmg: 0, dodged: true };
  const ally = p.flags['ally'] ? 0.85 : 1; // 동행자가 어그로를 분산
  let dmg = (enemy.atk + randInt(-2, 2)) * ally - p.stats.VIT * 0.4;
  return { dmg: Math.max(1, Math.round(dmg)), dodged: false };
}

export function getEnemy(id: string): Enemy {
  return { ...ENEMIES[id] };
}

/** exp 획득 후 레벨업 처리. 반환: 로그 메시지들 */
export function gainExp(p: Player, amount: number, log: string[]) {
  p.exp += amount;
  log.push(`경험치 +${amount}`);
  while (p.exp >= expToNext(p.level)) {
    p.exp -= expToNext(p.level);
    p.level += 1;
    p.statPoints += 3;
    log.push(`▲ 레벨 업! Lv.${p.level} (자유 능력치 +3)`);
    // HP/정신 풀 회복 + 신규 스킬 해금
    p.hp = maxHp(p);
    p.mental = maxMental(p);
    for (const s of Object.values(SKILLS)) {
      if (s.unlockLevel === p.level && !p.skills.includes(s.id)) {
        p.skills.push(s.id);
        log.push(`✦ 새 스킬 습득: ${s.name}`);
      }
    }
  }
}

/** 적 처치 시: exp + 전리품 + 포식 */
export function onKill(p: Player, enemy: Enemy, log: string[]) {
  gainExp(p, enemy.exp, log);
  for (const l of enemy.loot ?? []) {
    if (Math.random() < l.chance) {
      p.inventory.push(l.item);
      log.push(`전리품 획득: ${ITEMS[l.item].name}`);
    }
  }
  if (!enemy.noEat && Math.random() < 0.22) {
    if (Math.random() < 0.5) {
      const keys: (keyof Stats)[] = ['STR', 'AGI', 'VIT', 'PER', 'WIL'];
      const k = keys[randInt(0, keys.length - 1)];
      p.stats[k] += 1;
      log.push(`◈ 포식! 잔재를 흡수해 능력이 각성한다. (${k} +1)`);
    } else {
      p.hp = Math.min(maxHp(p), p.hp + 20);
      log.push('◈ 포식! 생체 조직을 흡수해 상처가 아문다. (HP +20)');
    }
  }
}

/** 효과 적용 (씬 onEnter / 선택지 effects) */
export function applyEffect(p: Player, e: Effect, log: string[]) {
  if (e.hp) {
    p.hp = clamp(p.hp + e.hp, 0, maxHp(p));
    log.push(`${e.hp > 0 ? 'HP +' : 'HP '}${e.hp}`);
  }
  if (e.mental) {
    p.mental = clamp(p.mental + e.mental, 0, maxMental(p));
    log.push(`${e.mental > 0 ? '정신 +' : '정신 '}${e.mental}`);
  }
  if (e.exp) gainExp(p, e.exp, log);
  if (e.addItem) {
    p.inventory.push(e.addItem);
    log.push(`획득: ${ITEMS[e.addItem]?.name ?? e.addItem}`);
    // 더 좋은 무기는 자동 장착
    const it = ITEMS[e.addItem];
    if (it?.type === 'weapon' && (it.atk ?? 0) > weaponAtk(p)) {
      p.equipped = e.addItem;
      log.push(`${it.name} 장착`);
    }
  }
  if (e.removeItem) {
    const i = p.inventory.indexOf(e.removeItem);
    if (i >= 0) p.inventory.splice(i, 1);
  }
  if (e.addSkill && !p.skills.includes(e.addSkill)) {
    p.skills.push(e.addSkill);
    log.push(`스킬 습득: ${SKILLS[e.addSkill]?.name}`);
  }
  if (e.statPoints) p.statPoints += e.statPoints;
  if (e.equip) p.equipped = e.equip;
  if (e.title) {
    p.title = e.title;
    log.push(`칭호 획득: ${e.title}`);
  }
  if (e.flag) p.flags[e.flag[0]] = e.flag[1];
}

export function freshPlayer(): Player {
  return {
    name: '',
    level: 1,
    exp: 0,
    hp: 100,
    mental: 80,
    stats: { STR: 5, AGI: 5, VIT: 5, PER: 5, WIL: 5 },
    statPoints: 5,
    skills: ['posik'],
    inventory: ['knife', 'water'],
    equipped: 'knife',
    flags: {},
  };
}
