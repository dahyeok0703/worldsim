import { Country } from './types';

// 필드 값은 사용자가 자유롭게 편집하는 문자열이므로,
// 정렬·통계를 위해 라벨로 값을 찾아 숫자만 추출한다.

function findValue(c: Country, labelParts: string[]): string | undefined {
  for (const cat of c.categories) {
    for (const f of cat.fields) {
      if (labelParts.some((p) => f.label.includes(p))) return f.value;
    }
  }
  return undefined;
}

/** 문자열에서 첫 숫자(콤마 제거)를 추출. 없으면 null */
export function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export type MetricKey =
  | 'name'
  | 'population'
  | 'area'
  | 'gdp'
  | 'gdpPerCapita'
  | 'birthRate'
  | 'lifeExp'
  | 'urban'
  | 'density';

const LABELS: Record<Exclude<MetricKey, 'name' | 'density'>, string[]> = {
  population: ['인구'],
  area: ['면적'],
  gdp: ['명목'],
  gdpPerCapita: ['1인당'],
  birthRate: ['출산율'],
  lifeExp: ['기대수명'],
  urban: ['도시화'],
};

/** 정렬·통계용 숫자 메트릭. gdp 단위는 10억 USD(=B). density는 명/km². */
export function getMetric(c: Country, key: MetricKey): number | null {
  if (key === 'name') return null;
  if (key === 'density') {
    const pop = parseNum(findValue(c, LABELS.population));
    const area = parseNum(findValue(c, LABELS.area));
    return pop != null && area ? pop / area : null;
  }
  return parseNum(findValue(c, LABELS[key]));
}

export const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'name', label: '이름' },
  { key: 'population', label: '인구' },
  { key: 'area', label: '면적' },
  { key: 'gdp', label: 'GDP (명목)' },
  { key: 'gdpPerCapita', label: '1인당 GDP' },
  { key: 'birthRate', label: '합계출산율' },
  { key: 'lifeExp', label: '기대수명' },
  { key: 'urban', label: '도시화율' },
  { key: 'density', label: '인구밀도' },
];

// ── 표시용 포맷터 ──────────────────────────────────────────
const intl = (n: number) => Math.round(n).toLocaleString('en-US');

export function fmtMetric(key: MetricKey, v: number | null): string {
  if (v == null) return '—';
  switch (key) {
    case 'population':
      return `${intl(v)}명`;
    case 'area':
      return `${intl(v)} km²`;
    case 'gdp':
      return v >= 1000 ? `$${(v / 1000).toFixed(2)}T` : `$${intl(v)}B`;
    case 'gdpPerCapita':
      return `$${intl(v)}`;
    case 'birthRate':
      return v.toFixed(2);
    case 'lifeExp':
      return `${v.toFixed(1)}세`;
    case 'urban':
      return `${v.toFixed(0)}%`;
    case 'density':
      return `${v.toFixed(1)} 명/km²`;
    default:
      return String(v);
  }
}

export interface WorldStats {
  count: number;
  totalPopulation: number;
  totalArea: number;
  totalGdp: number; // 10억 USD
  avgGdpPerCapita: number;
  avgBirthRate: number;
  avgLifeExp: number;
  avgUrban: number;
  density: number;
  topPopulation: { name: string; flag: string; value: number }[];
  topGdp: { name: string; flag: string; value: number }[];
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function topBy(countries: Country[], key: MetricKey, n: number) {
  return countries
    .map((c) => ({ name: c.name, flag: c.flag, value: getMetric(c, key) }))
    .filter((x): x is { name: string; flag: string; value: number } => x.value != null)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

export function computeStats(countries: Country[]): WorldStats {
  const pops = countries.map((c) => getMetric(c, 'population')).filter((v): v is number => v != null);
  const areas = countries.map((c) => getMetric(c, 'area')).filter((v): v is number => v != null);
  const gdps = countries.map((c) => getMetric(c, 'gdp')).filter((v): v is number => v != null);
  const pcs = countries.map((c) => getMetric(c, 'gdpPerCapita')).filter((v): v is number => v != null);
  const births = countries.map((c) => getMetric(c, 'birthRate')).filter((v): v is number => v != null);
  const lifes = countries.map((c) => getMetric(c, 'lifeExp')).filter((v): v is number => v != null);
  const urbans = countries.map((c) => getMetric(c, 'urban')).filter((v): v is number => v != null);

  const totalPopulation = pops.reduce((a, b) => a + b, 0);
  const totalArea = areas.reduce((a, b) => a + b, 0);

  return {
    count: countries.length,
    totalPopulation,
    totalArea,
    totalGdp: gdps.reduce((a, b) => a + b, 0),
    avgGdpPerCapita: avg(pcs),
    avgBirthRate: avg(births),
    avgLifeExp: avg(lifes),
    avgUrban: avg(urbans),
    density: totalArea ? totalPopulation / totalArea : 0,
    topPopulation: topBy(countries, 'population', 5),
    topGdp: topBy(countries, 'gdp', 5),
  };
}

export { intl };
