// 랜덤 이벤트. 발언 주체는 플레이어(가상). 실존 인물/발언 없음.
export interface EventEffect {
  recognition?: number; approvalNational?: number; funding?: number;
  integrity?: number; reform?: number; stability?: number; populism?: number;
  partyStanding?: number;
}
export interface EventChoice { label: string; effect: EventEffect; result: string; }
export interface GameEvent { id: string; title: string; text: string; choices: EventChoice[]; }

export const EVENTS: GameEvent[] = [
  {
    id: 'scandal_funds', title: '⚠ 정치자금 의혹 보도',
    text: '한 언론이 당신의 후원금 사용에 의문을 제기했다. 어떻게 대응하겠는가?',
    choices: [
      { label: '즉시 회계 전면 공개', effect: { integrity: 6, recognition: 4, approvalNational: 2 }, result: '투명한 대응으로 신뢰를 얻었다.' },
      { label: '법적 대응을 예고하며 반박', effect: { recognition: 6, approvalNational: -3, stability: -2 }, result: '주목은 받았으나 인상은 갈렸다.' },
      { label: '침묵으로 일관', effect: { integrity: -8, approvalNational: -5 }, result: '의혹이 커지며 지지가 흔들렸다.' },
    ],
  },
  {
    id: 'economy_crisis', title: '📉 경기 침체 국면',
    text: '물가와 실업이 동시에 악화되고 있다. 어떤 메시지를 내겠는가?',
    choices: [
      { label: '대규모 재정 투입 촉구', effect: { populism: 6, approvalNational: 4, stability: -2 }, result: '서민층의 호응을 얻었다.' },
      { label: '구조개혁·긴축 강조', effect: { reform: 6, stability: 3, approvalNational: -2 }, result: '시장의 신뢰를 얻었지만 표심은 미묘.' },
      { label: '초당적 협의체 제안', effect: { stability: 5, approvalNational: 3, recognition: 3 }, result: '안정감 있는 정치인으로 비쳤다.' },
    ],
  },
  {
    id: 'diplomacy', title: '🌐 외교 현안 발생',
    text: '주변국과의 갈등이 고조되었다. 입장을 정하라.',
    choices: [
      { label: '강경 대응 천명', effect: { stability: 3, approvalNational: 2, populism: 2 }, result: '안보 이미지가 강화됐다.' },
      { label: '대화와 협상 우선', effect: { reform: 3, approvalNational: 1, stability: 1 }, result: '온건·평화 이미지를 얻었다.' },
    ],
  },
  {
    id: 'disaster', title: '🚨 대형 재난 발생',
    text: '지역에 재난이 발생했다. 정치인으로서 행동은?',
    choices: [
      { label: '현장으로 달려가 구호 지휘', effect: { recognition: 8, approvalNational: 5, integrity: 3 }, result: '발로 뛰는 모습이 깊은 인상을 남겼다.' },
      { label: '국회에서 예산 대책 추진', effect: { approvalNational: 4, reform: 2, stability: 2 }, result: '실질 대책으로 평가받았다.' },
    ],
  },
  {
    id: 'gaffe', title: '🎤 생방송 토론',
    text: '전국 생중계 토론에 출연했다. 전략은?',
    choices: [
      { label: '준비된 정책으로 승부', effect: { recognition: 6, approvalNational: 3, reform: 2 }, result: '정책 통으로 호평받았다.' },
      { label: '상대 공격에 집중', effect: { recognition: 8, approvalNational: -2, populism: 3 }, result: '화제는 됐으나 호불호가 갈렸다.' },
    ],
  },
  {
    id: 'good_press', title: '📰 우호적 인물 기사',
    text: '한 매체가 당신의 의정·활동을 호평하는 기획기사를 냈다.',
    choices: [
      { label: '겸손하게 감사 표명', effect: { recognition: 5, approvalNational: 3, integrity: 2 }, result: '호감도가 올랐다.' },
    ],
  },
];

export function drawEvent(rng: () => number): GameEvent {
  return EVENTS[Math.floor(rng() * EVENTS.length)];
}
