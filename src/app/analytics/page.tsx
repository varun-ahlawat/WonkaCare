'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { useTheme } from '@/lib/theme';
import { Card } from '@/components/ui/card';
import {
  symptomClusters,
  zipHotspots,
  symptomVelocity,
  epiAlerts,
  clusterTimeline,
  getOverallThreat,
  THREAT_META,
  type ThreatLevel,
  type SymptomCluster,
} from '@/lib/epi-data';

/* ── Chart style hook ────────────────────────────────── */

function useChartStyles() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return {
    tooltipStyle: {
      contentStyle: {
        background: isDark ? '#121215' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 12,
        fontSize: 12,
        color: isDark ? '#a1a1aa' : '#55555e',
      },
      itemStyle: { color: isDark ? '#ececef' : '#111113' },
    },
    tickFill: isDark ? '#63637a' : '#8c8c9a',
    gridColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
  };
}

/* ── Cluster colors ──────────────────────────────────── */

const CLUSTER_COLORS: Record<string, string> = {
  'cluster-resp':    '#B12925',
  'cluster-gi':      '#FAA56B',
  'cluster-neuro':   '#60a5fa',
  'cluster-cardiac': '#a78bfa',
};

const ZIP_BAR_COLORS = ['#B12925', '#FAA56B', '#60a5fa', '#a78bfa', '#2D7C3E', '#63637a'];

/* ── Small components ────────────────────────────────── */

function ThreatPill({ level }: { level: ThreatLevel }) {
  const m = THREAT_META[level];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]"
      style={{ color: m.color, background: m.bg }}
    >
      {level === 'critical' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: m.color }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
        </span>
      )}
      {m.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = 'text-text',
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
      <p className={`text-[28px] font-semibold tabular-nums leading-none ${color}`}>{value}</p>
      <p className="mt-2 text-[12px] font-medium text-text-secondary">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function AlertCard({ alert }: { alert: typeof epiAlerts[number] }) {
  const m = THREAT_META[alert.level];
  return (
    <div
      className="rounded-[var(--radius-md)] border p-4"
      style={{ borderColor: m.color + '33', background: m.bg }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {alert.level === 'critical' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold" style={{ color: m.color }}>
              {alert.title}
            </p>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
            {alert.body}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-muted">
            {new Date(alert.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: SymptomCluster }) {
  const m = THREAT_META[cluster.threatLevel];
  const clusterColor = CLUSTER_COLORS[cluster.id] ?? '#63637a';
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: clusterColor }} />
          <p className="text-[13px] font-semibold text-text">{cluster.label}</p>
        </div>
        <ThreatPill level={cluster.threatLevel} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {cluster.keywords.map((k) => (
          <span
            key={k}
            className="rounded-sm border border-border bg-surface2 px-1.5 py-0.5 text-[10px] text-text-secondary"
          >
            {k}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3 border-t border-border pt-3">
        <div>
          <p className="text-[16px] font-semibold tabular-nums text-text">{cluster.callCount}</p>
          <p className="text-[10px] text-muted">calls</p>
        </div>
        <div>
          <p className="text-[16px] font-semibold tabular-nums text-text">{cluster.uniqueCallers}</p>
          <p className="text-[10px] text-muted">callers</p>
        </div>
        <div>
          <p className="text-[16px] font-semibold tabular-nums text-text">{cluster.affectedZips.length}</p>
          <p className="text-[10px] text-muted">zip codes</p>
        </div>
        <div>
          <p className="text-[16px] font-semibold tabular-nums" style={{ color: m.color }}>
            {cluster.growthPct > 0 ? `+${cluster.growthPct}%` : '0%'}
          </p>
          <p className="text-[10px] text-muted">growth</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted">
        Zip codes: {cluster.affectedZips.join(', ')}
      </p>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const router = useRouter();
  const { tooltipStyle, tickFill, gridColor } = useChartStyles();
  const overallThreat = getOverallThreat();

  const totalClusterCalls = useMemo(
    () => symptomClusters.reduce((s, c) => s + c.callCount, 0),
    [],
  );

  const peakGrowth = useMemo(
    () => Math.max(...symptomClusters.map((c) => c.growthPct)),
    [],
  );

  const affectedZipCount = useMemo(() => {
    const zips = new Set(symptomClusters.flatMap((c) => c.affectedZips));
    return zips.size;
  }, []);

  const velocitySorted = useMemo(
    () => [...symptomVelocity].sort((a, b) => b.delta - a.delta),
    [],
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg font-sans animate-page-enter">
      {/* Header */}
      <header className="shrink-0 border-b border-border px-8 py-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="focus-ring flex items-center gap-1.5 rounded-[var(--radius-sm)] text-[12px] text-muted transition-colors duration-200 hover:text-text"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Dashboard
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-3">
            <h1 className="text-[16px] font-semibold tracking-[-0.01em] text-text">
              Epidemiological Early Warning
            </h1>
            <ThreatPill level={overallThreat} />
          </div>
          <span className="ml-auto text-[12px] text-muted">
            48-hour surveillance window
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-[1400px] space-y-6">

          {/* ── Active alerts ── */}
          {epiAlerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Active alerts
              </h2>
              {epiAlerts.map((a) => (
                <AlertCard key={a.id} alert={a} />
              ))}
            </div>
          )}

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-5 gap-4">
            <StatCard
              label="Calls in window"
              value={totalClusterCalls}
              sub="Last 48 hours"
            />
            <StatCard
              label="Active clusters"
              value={symptomClusters.filter((c) => c.callCount >= 3).length}
              sub="K-Means detected"
              color="text-warning"
            />
            <StatCard
              label="Zip codes affected"
              value={affectedZipCount}
              sub="With cluster activity"
            />
            <StatCard
              label="Peak growth rate"
              value={`+${peakGrowth}%`}
              sub="Respiratory cluster"
              color="text-danger"
            />
            <StatCard
              label="Escalation needed"
              value={symptomClusters.filter((c) => c.threatLevel === 'critical').length}
              sub="Clusters above threshold"
              color="text-danger"
            />
          </div>

          {/* ── Cluster trend timeline ── */}
          <Card title="Symptom cluster growth — 48h window">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={clusterTimeline}>
                <defs>
                  <linearGradient id="gradResp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B12925" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#B12925" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradGi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FAA56B" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#FAA56B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradNeuro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: tickFill, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: tickFill, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="respiratory" stroke="#B12925" strokeWidth={2} fill="url(#gradResp)" name="Respiratory" />
                <Area type="monotone" dataKey="gi" stroke="#FAA56B" strokeWidth={2} fill="url(#gradGi)" name="GI" />
                <Area type="monotone" dataKey="neuro" stroke="#60a5fa" strokeWidth={1.5} fill="url(#gradNeuro)" name="Neuro" />
                <Area type="monotone" dataKey="cardiac" stroke="#a78bfa" strokeWidth={1} fill="none" name="Cardiac" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 flex items-center gap-5 border-t border-border pt-3">
              {[
                { label: 'Respiratory', color: '#B12925' },
                { label: 'Gastrointestinal', color: '#FAA56B' },
                { label: 'Neurological', color: '#60a5fa' },
                { label: 'Cardiac', color: '#a78bfa' },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </Card>

          {/* ── Detected clusters ── */}
          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Detected symptom clusters (K-Means)
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {symptomClusters.map((c) => (
                <ClusterCard key={c.id} cluster={c} />
              ))}
            </div>
          </div>

          {/* ── Two columns: Geo hotspots + Symptom velocity ── */}
          <div className="grid grid-cols-2 gap-4">
            {/* Geographic hotspots */}
            <Card title="Geographic concentration by zip code">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={zipHotspots} barCategoryGap="20%">
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="zip"
                    tick={{ fill: tickFill, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: tickFill, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                    {zipHotspots.map((_, i) => (
                      <Cell key={i} fill={ZIP_BAR_COLORS[i % ZIP_BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1 border-t border-border pt-3">
                {zipHotspots.slice(0, 4).map((h) => (
                  <div key={h.zip} className="flex items-center justify-between text-[11px]">
                    <span className="text-text-secondary">
                      {h.zip} · {h.area}
                    </span>
                    <span className="text-muted">
                      {h.dominantCluster}
                      {h.growth > 0 && (
                        <span className="ml-2 font-semibold text-danger">+{h.growth}%</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Symptom velocity */}
            <Card title="Symptom velocity — 12h acceleration">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={velocitySorted} layout="vertical" barCategoryGap="12%">
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: tickFill, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="symptom"
                    tick={{ fill: tickFill, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="prev12h" fill="rgba(96,165,250,0.2)" name="Prev 12h" radius={[0, 4, 4, 0]} stackId="v" />
                  <Bar dataKey="last12h" fill="#B12925" name="Last 12h" radius={[0, 4, 4, 0]} stackId="v" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex items-center gap-4 border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgba(96,165,250,0.4)' }} />
                  Previous 12h
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="h-2 w-2 rounded-full bg-danger" />
                  Last 12h
                </div>
              </div>
            </Card>
          </div>

          {/* ── Fastest accelerating symptoms ── */}
          <Card title="Fastest accelerating symptoms">
            <div className="grid grid-cols-5 gap-3">
              {velocitySorted.slice(0, 5).map((v, i) => (
                <div
                  key={v.symptom}
                  className="rounded-[var(--radius-md)] border border-border bg-surface2/50 p-3 text-center"
                >
                  <p className="text-[20px] font-bold tabular-nums" style={{ color: i === 0 ? '#B12925' : i < 3 ? '#FAA56B' : '#60a5fa' }}>
                    +{v.delta}%
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-text">{v.symptom}</p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {v.prev12h} → {v.last12h} calls
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* ── Methodology note ── */}
          <div className="rounded-[var(--radius-md)] border border-border bg-surface/50 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Detection methodology
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
              Clusters are identified using K-Means clustering on TF-IDF vectorized call transcripts,
              with Latent Dirichlet Allocation (LDA) for topic extraction. Geographic concentration
              is measured via spatial autocorrelation (Moran&apos;s I) across zip codes. Growth rates
              are computed as exponential regression slopes over rolling 12-hour windows.
              Alerts trigger automatically when a cluster exceeds 10 calls within 48 hours with a
              growth rate above 100%.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
