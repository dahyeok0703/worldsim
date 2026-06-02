// 국가 코드(adm0_a3)로부터 결정적(deterministic)으로 고유한 색을 만든다.
// 같은 국가의 모든 프로빈스는 같은 코드를 쓰므로 자동으로 같은 색을 갖는다.

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/** 국가 코드별 기본 색 (황금각으로 색상환을 고르게 분포) */
export function defaultCountryColor(code: string): string {
  const h = hashCode(code || 'XXX');
  const hue = (h * 137.508) % 360;
  const sat = 50 + (h % 25); // 50–74%
  const light = 52 + ((h >> 5) % 14); // 52–65%
  return hslToHex(hue, sat, light);
}
