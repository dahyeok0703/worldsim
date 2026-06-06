import { Enemy, Item, Scene, Skill } from './types';

export const ITEMS: Record<string, Item> = {
  knife: { id: 'knife', name: '주머니칼', desc: '작지만 없는 것보단 낫다.', type: 'weapon', atk: 2 },
  bat: { id: 'bat', name: '야구방망이', desc: '묵직한 한 방.', type: 'weapon', atk: 6 },
  pipe: { id: 'pipe', name: '쇠파이프', desc: '리치가 길고 단단하다.', type: 'weapon', atk: 8 },
  axe: { id: 'axe', name: '소방도끼', desc: '머리를 단숨에 가른다.', type: 'weapon', atk: 13 },
  water: { id: 'water', name: '생수', desc: 'HP +10, 정신 +6', type: 'heal', heal: 10, mental: 6 },
  bar: { id: 'bar', name: '에너지바', desc: 'HP +18', type: 'heal', heal: 18 },
  bandage: { id: 'bandage', name: '붕대', desc: 'HP +30', type: 'heal', heal: 30 },
  medkit: { id: 'medkit', name: '구급킷', desc: 'HP +60, 정신 +10', type: 'heal', heal: 60, mental: 10 },
  sedative: { id: 'sedative', name: '안정제', desc: '정신 +30', type: 'heal', mental: 30 },
};

export const SKILLS: Record<string, Skill> = {
  posik: {
    id: 'posik',
    name: '포식(捕食)',
    desc: '처치한 감염체의 잔재를 흡수한다. 낮은 확률로 능력치가 영구히 오르거나 체력을 회복한다.',
    cost: 0,
    type: 'passive',
    unlockLevel: 1,
  },
  gangta: {
    id: 'gangta',
    name: '강타',
    desc: '온 힘을 실어 내려친다. 큰 피해. (정신 12)',
    cost: 12,
    type: 'attack',
    unlockLevel: 2,
  },
  firstaid: {
    id: 'firstaid',
    name: '응급처치',
    desc: '전투 중 상처를 지혈한다. HP 회복. (정신 10)',
    cost: 10,
    type: 'heal',
    unlockLevel: 3,
  },
  analyze: {
    id: 'analyze',
    name: '간파',
    desc: '약점을 꿰뚫어 다음 공격을 반드시 치명타로 만든다. (정신 8)',
    cost: 8,
    type: 'utility',
    unlockLevel: 4,
  },
  sprint: {
    id: 'sprint',
    name: '질주',
    desc: '[패시브] 회피율과 도주 성공률이 상승한다.',
    cost: 0,
    type: 'passive',
    unlockLevel: 5,
  },
};

export const ENEMIES: Record<string, Enemy> = {
  walker: {
    id: 'walker',
    name: '보행 감염체',
    desc: '느릿느릿 다가오지만, 물리면 끝이다.',
    hp: 38,
    atk: 8,
    exp: 30,
    loot: [{ item: 'water', chance: 0.4 }],
  },
  walker_tough: {
    id: 'walker_tough',
    name: '거구의 감염체',
    desc: '덩치가 커 가죽이 두껍다.',
    hp: 60,
    atk: 11,
    def: 2,
    exp: 50,
    loot: [{ item: 'bandage', chance: 0.4 }],
  },
  crawler: {
    id: 'crawler',
    name: '기어다니는 감염체',
    desc: '바닥을 기며 발목을 노린다. 빠르고 회피가 높다.',
    hp: 26,
    atk: 12,
    exp: 35,
    dodge: 0.2,
    loot: [{ item: 'bar', chance: 0.5 }],
  },
  runner: {
    id: 'runner',
    name: '질주 감염체',
    desc: '미친 듯이 달려든다. 위협적이다.',
    hp: 40,
    atk: 16,
    exp: 60,
    dodge: 0.15,
    loot: [{ item: 'bandage', chance: 0.5 }],
  },
  mutant: {
    id: 'mutant',
    name: '변이 포식체',
    desc: '여러 시체가 뒤엉켜 거대해진 괴물. 학교 정문을 막고 있다.',
    hp: 180,
    atk: 22,
    def: 3,
    exp: 220,
    noEat: true,
    boss: true,
    loot: [{ item: 'medkit', chance: 1 }],
  },
};

// {name} 은 렌더링 시 플레이어 이름으로 치환된다.
export const SCENES: Record<string, Scene> = {
  apartment: {
    id: 'apartment',
    title: '디데이 +3 · 원룸',
    text:
      '현관문 틈으로 회색 손가락이 비집고 들어온다. 썩은 내, 끄으윽거리는 신음. {name}의 눈앞엔 오직 자신만 볼 수 있는 푸른 상태창이 떠 있다.\n\n문이 다시 쾅 휘청인다. 버틸 수 있는 건 길어야 몇 초.',
    choices: [
      {
        label: '문 옆에 붙어 들어오는 순간 기습한다',
        combat: 'walker',
        next: 'street',
      },
      {
        label: '창문으로 배수관을 타고 조용히 내려간다',
        requires: { stat: { AGI: 7 } },
        note: '민첩 7 이상이면 전투 없이 빠져나간다',
        effects: [{ mental: 5, flag: ['stealthy', true] }],
        next: 'street',
      },
      {
        label: '냉장고를 밀어 문을 막고 숨을 고른 뒤 맞선다',
        effects: [{ hp: 15, mental: 8 }],
        combat: 'walker_tough',
        next: 'street',
      },
    ],
  },

  street: {
    id: 'street',
    title: '거리',
    text:
      '계단을 내려와 거리로 나섰다. 뒤집힌 차들, 검붉은 자국, 멀리서 들리는 무리의 소리. 큰길로 곧장 가면 위험하다. 두 갈래 길이 보인다.',
    choices: [
      {
        label: '편의점(GS25)을 거쳐 보급을 챙긴다',
        next: 'store',
      },
      {
        label: '뒷골목으로 은밀히 우회한다',
        next: 'alley',
      },
    ],
  },

  store: {
    id: 'store',
    title: '편의점',
    text:
      '깨진 유리문 너머 진열대가 어지럽다. 음료와 식량이 보인다. 카운터 뒤에서 무언가 바닥을 기는 소리가 난다.',
    onEnter: [{ addItem: 'water' }, { addItem: 'bar' }],
    choices: [
      {
        label: '선반의 야구방망이를 집고 정면으로 처리한다',
        effects: [{ addItem: 'bat' }],
        combat: 'crawler',
        next: 'avenue',
      },
      {
        label: '소리 없이 필요한 것만 챙겨 빠져나온다',
        requires: { stat: { PER: 7 } },
        note: '감각 7 이상이면 전투를 피한다',
        effects: [{ addItem: 'bat' }, { addItem: 'bandage' }, { mental: 4 }],
        next: 'avenue',
      },
    ],
  },

  alley: {
    id: 'alley',
    title: '뒷골목',
    text:
      '좁은 골목, 에어컨 실외기 위에 한 남자가 쇠파이프를 쥔 채 떨고 있다. "사, 살아있는 사람…? 제발, 같이 가요. 길은 제가 알아요."',
    choices: [
      {
        label: '함께 간다 — 정보를 얻는다',
        effects: [{ flag: ['ally', true], mental: 8 }],
        next: 'avenue',
        note: '생존자 동행 (이후 전투에 도움)',
      },
      {
        label: '쇠파이프만 빼앗고 혼자 간다',
        effects: [{ addItem: 'pipe' }, { mental: -10, flag: ['ruthless', true] }],
        next: 'avenue',
        note: '무기를 얻지만 정신력이 깎인다',
      },
      {
        label: '함께 가되, 그의 쇠파이프는 내가 든다 (설득)',
        requires: { stat: { WIL: 7 } },
        note: '정신 7 이상: 동행 + 무기',
        effects: [{ flag: ['ally', true], addItem: 'pipe' }],
        next: 'avenue',
      },
    ],
  },

  avenue: {
    id: 'avenue',
    title: '대로',
    text:
      '큰길이다. 신호등은 꺼졌고, 버려진 시내버스 너머로 감염체 한 마리가 {name}을(를) 발견하고 머리를 홱 돌린다. 비명 같은 포효 — 질주해 온다!',
    choices: [
      {
        label: '맞받아친다',
        combat: 'runner',
        next: 'clinic',
      },
      {
        label: '버스 밑으로 굴러 따돌린다',
        requires: { stat: { AGI: 8 } },
        note: '민첩 8 이상이면 전투를 피한다',
        effects: [{ mental: -4 }],
        next: 'clinic',
      },
      {
        label: '질주 스킬로 단숨에 거리를 벌린다',
        requires: { skill: 'sprint' },
        next: 'clinic',
      },
    ],
  },

  clinic: {
    id: 'clinic',
    title: '동네 의원',
    text:
      '간판이 반쯤 떨어진 의원. 약장이 통째로 남아 있다. 잠시 숨을 돌릴 수 있는 드문 순간. 다음은 학교 대피소 — 무전으로 들은 마지막 안전지대다.',
    onEnter: [{ addItem: 'medkit' }, { addItem: 'sedative' }, { hp: 20, mental: 10 }],
    choices: [
      {
        label: '장비를 정비하고 학교 정문으로 향한다',
        next: 'gate',
      },
    ],
  },

  gate: {
    id: 'gate',
    title: '대피소 정문',
    text:
      '학교 정문 앞. 안에서 사람들의 목소리가 들린다 — 거의 다 왔다. 그러나 정문을 가로막은 건 여러 시체가 뒤엉켜 거대해진 괴물, 변이 포식체. 놈이 {name}을(를) 향해 몸을 일으킨다.',
    choices: [
      {
        label: '정면 돌파한다',
        combat: 'mutant',
        next: 'shelter',
      },
    ],
  },

  shelter: {
    id: 'shelter',
    title: '대피소 — 생존',
    ending: 'good',
    text:
      '괴물이 무너지고, 철문이 안에서 열렸다. 사람들이 {name}을(를) 끌어들인다. 따뜻한 손들. 살아남았다.\n\n눈앞의 상태창이 마지막으로 깜빡인다 —\n「1막 종료. 당신은 더 강해졌다. 도시는 아직 넓다.」\n\n— 데모 클리어 —',
    choices: [{ label: '처음부터 다시', next: '__restart__' }],
  },
};

export const START_SCENE = 'apartment';
