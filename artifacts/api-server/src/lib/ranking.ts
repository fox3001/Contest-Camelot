/**
 * Classifica a media bayesiana.
 * Ogni costume parte con PRIOR_WEIGHT voti "virtuali" pari alla media generale
 * della sessione: così un costume con 2 voti da 5 stelle non scavalca uno con
 * 60 voti da 4,6, e la classifica non premia chi riceve semplicemente più voti.
 */
export const PRIOR_WEIGHT = 5;

export type CostumeStats = {
  id: number;
  name: string;
  imagePath: string;
  totalVotes: number;
  sumScores: number;
};

export function rankCostumes(stats: CostumeStats[]) {
  const allVotes = stats.reduce((a, c) => a + c.totalVotes, 0);
  const allSum = stats.reduce((a, c) => a + c.sumScores, 0);
  const globalMean = allVotes > 0 ? allSum / allVotes : 3;

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return stats
    .map((c) => ({
      ...c,
      avgScore: c.totalVotes > 0 ? round2(c.sumScores / c.totalVotes) : 0,
      weightedScore: c.totalVotes > 0
        ? round2((PRIOR_WEIGHT * globalMean + c.sumScores) / (PRIOR_WEIGHT + c.totalVotes))
        : 0,
    }))
    .sort(
      (a, b) =>
        b.weightedScore - a.weightedScore ||
        b.totalVotes - a.totalVotes ||
        a.name.localeCompare(b.name),
    )
    .map((c, i) => ({ ...c, rank: i + 1 }));
}
