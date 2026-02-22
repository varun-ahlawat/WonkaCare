'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Modal } from '@/components/ui/modal';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/lib/theme';
import type { CallLog } from '@/lib/mock-call-logs';

const COLORS = {
  HIGH: '#B12925',
  MED: '#FAA56B',
  LOW: '#2D7C3E',
  Escalated: '#B12925',
  Resolved: '#2D7C3E',
  'Needs review': '#60a5fa',
};

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
  };
}

interface AnalyticsPanelProps {
  open: boolean;
  onClose: () => void;
  calls: CallLog[];
}

export function AnalyticsPanel({ open, onClose, calls }: AnalyticsPanelProps) {
  const { tooltipStyle, tickFill } = useChartStyles();

  const volumeByHour = useMemo(() => {
    const map: Record<string, number> = {};
    calls.forEach((c) => {
      const h = new Date(c.createdAt).getHours();
      const label = `${h.toString().padStart(2, '0')}:00`;
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [calls]);

  const triageDist = useMemo(() => {
    const map: Record<string, number> = { HIGH: 0, MED: 0, LOW: 0 };
    calls.forEach((c) => {
      map[c.triageLevel] = (map[c.triageLevel] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [calls]);

  const statusDist = useMemo(() => {
    const map: Record<string, number> = {};
    calls.forEach((c) => {
      map[c.status] = (map[c.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [calls]);

  const avgDuration = useMemo(() => {
    if (calls.length === 0) return '0:00';
    const avg = Math.round(
      calls.reduce((sum, c) => sum + c.durationSec, 0) / calls.length,
    );
    const m = Math.floor(avg / 60);
    const s = avg % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [calls]);

  return (
    <Modal open={open} onClose={onClose} title="Analytics" width="max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        {/* Call volume */}
        <Card title="Call volume by hour" className="col-span-2">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={volumeByHour}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                width={24}
              />
              <Tooltip {...tooltipStyle} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#60a5fa"
                strokeWidth={2}
                fill="url(#areaGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Triage distribution */}
        <Card title="By priority">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={triageDist}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                dataKey="value"
                strokeWidth={0}
              >
                {triageDist.map((d) => (
                  <Cell
                    key={d.name}
                    fill={COLORS[d.name as keyof typeof COLORS] ?? '#63637a'}
                  />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-4">
            {triageDist.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      COLORS[d.name as keyof typeof COLORS] ?? '#63637a',
                  }}
                />
                <span className="text-muted">
                  {d.name} ({d.value})
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Status breakdown */}
        <Card title="Escalated vs Resolved">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={statusDist} barCategoryGap="30%">
              <XAxis
                dataKey="name"
                tick={{ fill: tickFill, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: tickFill, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={24}
              />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {statusDist.map((d) => (
                  <Cell
                    key={d.name}
                    fill={COLORS[d.name as keyof typeof COLORS] ?? '#63637a'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Summary stats */}
        <Card title="Summary" className="col-span-2">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-[22px] font-semibold tabular-nums text-text">
                {calls.length}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">Total calls</p>
            </div>
            <div>
              <p className="text-[22px] font-semibold tabular-nums text-text">
                {avgDuration}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">Avg duration</p>
            </div>
            <div>
              <p className="text-[22px] font-semibold tabular-nums text-danger">
                {calls.filter((c) => c.triageLevel === 'HIGH').length}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">High priority</p>
            </div>
            <div>
              <p className="text-[22px] font-semibold tabular-nums text-success">
                {calls.filter((c) => c.status === 'Resolved').length}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">Resolved</p>
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
}
