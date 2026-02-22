/**
 * Epidemiological Early Warning System — simulated data
 *
 * Generates realistic outbreak cluster data derived from call transcripts.
 * In production this would come from a K-Means / LDA pipeline running
 * against real-time call embeddings.
 */

export type ThreatLevel = 'critical' | 'elevated' | 'advisory' | 'nominal';

export interface SymptomCluster {
  id: string;
  label: string;
  keywords: string[];
  threatLevel: ThreatLevel;
  callCount: number;
  uniqueCallers: number;
  affectedZips: string[];
  growthPct: number;
  firstDetected: string;
  trend: { hour: string; count: number }[];
}

export interface ZipHotspot {
  zip: string;
  area: string;
  calls: number;
  dominantCluster: string;
  growth: number;
}

export interface SymptomVelocity {
  symptom: string;
  last12h: number;
  prev12h: number;
  delta: number;
}

export interface EpiAlert {
  id: string;
  level: ThreatLevel;
  title: string;
  body: string;
  cluster: string;
  timestamp: string;
}

/* ── Helpers ────────────────────────────────────────── */

function hoursAgo(h: number): string {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
}

function buildTrend(
  hours: number,
  base: number,
  growthFactor: number,
  noise = 0.25,
): { hour: string; count: number }[] {
  const points: { hour: string; count: number }[] = [];
  for (let h = hours; h >= 0; h -= 4) {
    const t = (hours - h) / hours;
    const exponential = base * Math.pow(growthFactor, t * 4);
    const jitter = 1 + (Math.sin(h * 7) * noise);
    points.push({
      hour: `${h}h ago`,
      count: Math.max(0, Math.round(exponential * jitter)),
    });
  }
  return points;
}

/* ── Detected clusters ──────────────────────────────── */

export const symptomClusters: SymptomCluster[] = [
  {
    id: 'cluster-resp',
    label: 'Respiratory / Flu-like',
    keywords: ['sore throat', 'fever', 'cough', 'body aches', 'fatigue', 'congestion'],
    threatLevel: 'critical',
    callCount: 23,
    uniqueCallers: 21,
    affectedZips: ['30301', '30305', '30308'],
    growthPct: 340,
    firstDetected: hoursAgo(38),
    trend: buildTrend(48, 1, 2.2),
  },
  {
    id: 'cluster-gi',
    label: 'Gastrointestinal',
    keywords: ['nausea', 'vomiting', 'diarrhea', 'abdominal cramps', 'fever'],
    threatLevel: 'elevated',
    callCount: 11,
    uniqueCallers: 11,
    affectedZips: ['30305', '30312'],
    growthPct: 120,
    firstDetected: hoursAgo(26),
    trend: buildTrend(48, 1, 1.6),
  },
  {
    id: 'cluster-neuro',
    label: 'Neurological / Headache',
    keywords: ['severe headache', 'dizziness', 'photophobia', 'visual aura', 'nausea'],
    threatLevel: 'advisory',
    callCount: 5,
    uniqueCallers: 5,
    affectedZips: ['30308', '30309'],
    growthPct: 25,
    firstDetected: hoursAgo(44),
    trend: buildTrend(48, 2, 1.1),
  },
  {
    id: 'cluster-cardiac',
    label: 'Cardiac / Chest pain',
    keywords: ['chest pain', 'dyspnea', 'jaw pain', 'diaphoresis', 'palpitations'],
    threatLevel: 'nominal',
    callCount: 4,
    uniqueCallers: 4,
    affectedZips: ['30301'],
    growthPct: 0,
    firstDetected: hoursAgo(46),
    trend: buildTrend(48, 1.5, 1.0),
  },
];

/* ── Geographic hotspots ────────────────────────────── */

export const zipHotspots: ZipHotspot[] = [
  { zip: '30301', area: 'Downtown',          calls: 14, dominantCluster: 'Respiratory',     growth: 280 },
  { zip: '30305', area: 'Buckhead',           calls: 10, dominantCluster: 'GI / Respiratory', growth: 160 },
  { zip: '30308', area: 'Midtown',            calls: 7,  dominantCluster: 'Respiratory',     growth: 90 },
  { zip: '30312', area: 'Grant Park',         calls: 5,  dominantCluster: 'Gastrointestinal', growth: 70 },
  { zip: '30309', area: 'Ansley Park',        calls: 3,  dominantCluster: 'Neurological',    growth: 15 },
  { zip: '30306', area: 'Virginia-Highland',  calls: 2,  dominantCluster: '—',               growth: 0 },
];

/* ── Symptom velocity (last 12 h vs prev 12 h) ────── */

export const symptomVelocity: SymptomVelocity[] = [
  { symptom: 'sore throat',       last12h: 14, prev12h: 3,  delta: 367 },
  { symptom: 'fever',             last12h: 18, prev12h: 5,  delta: 260 },
  { symptom: 'cough',             last12h: 11, prev12h: 3,  delta: 267 },
  { symptom: 'body aches',        last12h: 9,  prev12h: 2,  delta: 350 },
  { symptom: 'nausea',            last12h: 8,  prev12h: 4,  delta: 100 },
  { symptom: 'diarrhea',          last12h: 6,  prev12h: 2,  delta: 200 },
  { symptom: 'congestion',        last12h: 7,  prev12h: 3,  delta: 133 },
  { symptom: 'abdominal cramps',  last12h: 5,  prev12h: 2,  delta: 150 },
  { symptom: 'fatigue',           last12h: 6,  prev12h: 4,  delta: 50 },
  { symptom: 'severe headache',   last12h: 3,  prev12h: 2,  delta: 50 },
];

/* ── Active alerts ──────────────────────────────────── */

export const epiAlerts: EpiAlert[] = [
  {
    id: 'alert-1',
    level: 'critical',
    title: 'Respiratory cluster surge — Downtown & Buckhead',
    body: '23 calls reporting sore throat + fever in zip codes 30301, 30305, 30308 over the last 38 hours. Growth rate 340 %. Pattern consistent with early-stage influenza or strep outbreak. Recommend notifying county health department.',
    cluster: 'cluster-resp',
    timestamp: hoursAgo(1),
  },
  {
    id: 'alert-2',
    level: 'elevated',
    title: 'GI illness cluster — Buckhead & Grant Park',
    body: '11 calls with nausea, vomiting, and diarrhea concentrated in 30305 and 30312. Possible foodborne pathogen. Growth rate 120 % over 26 hours.',
    cluster: 'cluster-gi',
    timestamp: hoursAgo(4),
  },
];

/* ── Aggregate timeline (all clusters overlaid) ────── */

export interface TimelinePoint {
  hour: string;
  respiratory: number;
  gi: number;
  neuro: number;
  cardiac: number;
  total: number;
}

export const clusterTimeline: TimelinePoint[] = (() => {
  const resp = symptomClusters[0].trend;
  const gi   = symptomClusters[1].trend;
  const neuro = symptomClusters[2].trend;
  const cardiac = symptomClusters[3].trend;

  return resp.map((p, i) => ({
    hour: p.hour,
    respiratory: p.count,
    gi: gi[i]?.count ?? 0,
    neuro: neuro[i]?.count ?? 0,
    cardiac: cardiac[i]?.count ?? 0,
    total: p.count + (gi[i]?.count ?? 0) + (neuro[i]?.count ?? 0) + (cardiac[i]?.count ?? 0),
  }));
})();

/* ── Overall threat assessment ──────────────────────── */

export function getOverallThreat(): ThreatLevel {
  if (symptomClusters.some((c) => c.threatLevel === 'critical')) return 'critical';
  if (symptomClusters.some((c) => c.threatLevel === 'elevated')) return 'elevated';
  if (symptomClusters.some((c) => c.threatLevel === 'advisory')) return 'advisory';
  return 'nominal';
}

export const THREAT_META: Record<ThreatLevel, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRITICAL', color: '#B12925', bg: 'rgba(177,41,37,0.15)' },
  elevated: { label: 'ELEVATED', color: '#FAA56B', bg: 'rgba(250,165,107,0.12)' },
  advisory: { label: 'ADVISORY', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' },
  nominal:  { label: 'NOMINAL',  color: '#2D7C3E', bg: 'rgba(45,124,62,0.12)' },
};
