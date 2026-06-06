# 🏛 대한민국 정치인 시뮬레이터

한국 정치인이 되어 **캐릭터 생성 → 정당 활동 → 선거 출마 → 당선 → 입법/입각 → 대통령**까지
커리어를 쌓는 클라이언트 전용 시뮬레이션 게임. StackBlitz에서 바로 실행됩니다.

> 개인 비공개 플레이용. **정당명만 실제**이며 등장 인물은 전부 가상입니다.

## 실행
```bash
npm install
npm run dev
```
StackBlitz에서 import 후 위 명령으로 바로 구동 (Vite dev 프록시 자동).

## 핵심 시스템
- **캐릭터 생성**: 이름/성별/출생연도/출신지/학력/경력(복수)/가족관계/세부 정치성향(경제·사회·안보 3축)
  → 9개 능력치·초기 지지층·정당 궁합도 산출. 피선거권 **나이 제한**(대통령 만40세, 국회/지방 만18세) 적용.
- **지지율·인지도·평판**: 전국 + **광역17 지역별** + **계층별(성별/세대/계층)** 분해. 이미지 4축(청렴·개혁·안정·친서민).
- **턴제 활동(AP)**: 유세 · 연설 · 기자회견(실언 리스크) · SNS · 모금 · 턴 종료 + 랜덤 이벤트.
- **선거 시뮬레이션(핵심)**: 전국 **250개 시군구** 단위로 정당 득표율 계산 → 광역 → 전국 상향 집계.
  지역구(시군구 1위) + **비례대표(3% 봉쇄 + 헤어식 46석)**. 대통령/국회의원/광역·기초단체장 출마.
- **지도 시각화(3단계)**: 실제 한국 행정구역 TopoJSON(d3-geo) → **전국 17광역 → 클릭 시 시군구 드릴다운**.
  1위 정당 상징색 + **득표 격차에 따른 채도**, 호버 시 정당별 득표 상세.
- **행정부 입각**: 의원이 아니어도 **인사청문회 미니게임** 통과 시 장관 임명 → 국정 수행.
  대통령 당선 시 **내각 인선**(가상 NPC 풀).
- **세이브**: localStorage 저장/이어하기, 연감(역대 선거 지도 다시보기 + 커리어 타임라인).

## 정치지형 재현 (검증됨)
호남=민주 압도 · TK/부울경/강원=국힘 강세 · **강남3구=국힘**(서울 내 오버라이드) · 수도권=약민주 우세 ·
여성층 민주↑/남성층 국힘↑ · 2030 국힘↑/4050 민주↑/6070 국힘↑ (DEMO_MODIFIERS).

## 기술 스택
React 18 + TypeScript + Vite · Zustand(상태) · react-router-dom · d3-geo + topojson-client(지도) · 순수 CSS.
지도 데이터: `southkorea/southkorea-maps` kostat 2018 (시도 17 / 시군구 250) TopoJSON 번들.

## 구조
```
src/
  data/        parties · provinces · districts(자동생성) · supportModel · politicians · maps/*.topo.json
  engine/      electionEngine · seatAllocation · careerSystem · eventSystem
  store/       useGameStore (Zustand)
  components/  KoreaMap · RegionPanel · PartyLegend · Nav · geo
  pages/       Title · CharacterCreator · Dashboard · ElectionCenter · Cabinet · Archive
```

## 밸런싱
지역 기본성향·인구통계 보정치는 `src/data/supportModel.ts` 한 곳에 상수로 모여 있어 조정이 쉽습니다.

## 간이화 참고
- 선거구 = 시군구(250)로 매핑(실제 254 근사). 비례 46석, 준연동형은 병립형으로 간이화.
- 차트는 경량화를 위해 recharts 대신 CSS 막대 사용. Tailwind 대신 순수 CSS(StackBlitz 안정성).
