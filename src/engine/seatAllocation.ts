// 비례대표 배분: 봉쇄조항 3% + 헤어식(최대잉여법). 준연동형은 간이화(병립형으로 처리).
export function allocatePR(
  voteShare: Record<string, number>, // 정당별 전국 득표율(%)
  totalSeats: number,
  threshold = 3
): Record<string, number> {
  const eligible = Object.entries(voteShare).filter(([, v]) => v >= threshold);
  const sum = eligible.reduce((a, [, v]) => a + v, 0);
  if (sum <= 0) return {};
  const quotas = eligible.map(([id, v]) => ({ id, exact: (v / sum) * totalSeats }));
  const result: Record<string, number> = {};
  let assigned = 0;
  for (const q of quotas) { result[q.id] = Math.floor(q.exact); assigned += result[q.id]; }
  const remain = quotas
    .map((q) => ({ id: q.id, frac: q.exact - Math.floor(q.exact) }))
    .sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (assigned < totalSeats && i < remain.length) { result[remain[i].id] += 1; assigned++; i++; }
  return result;
}
