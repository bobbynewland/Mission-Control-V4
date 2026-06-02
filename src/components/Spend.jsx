import React, { useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Title,
  Filler,
} from 'chart.js';
import { DollarSign, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchSpend } from '../lib/spend';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Title,
  Filler
);

const USD = (n) =>
  (typeof n === 'number' && isFinite(n) ? n : 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const PROVIDER_COLORS = {
  minimax: '#A855F7',
  claude: '#EAB308',
  codex: '#22D3EE',
  fal: '#F472B6',
};

const PROVIDER_LABELS = {
  minimax: 'MiniMax',
  claude: 'Claude',
  codex: 'Codex',
  fal: 'FAL',
};

const StatCard = ({ label, value }) => (
  <div className="glass rounded-2xl border border-white/10 backdrop-blur-xl p-5 flex flex-col gap-2">
    <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">
      {label}
    </span>
    <span className="text-3xl font-mono font-black text-white tabular-nums">
      {USD(value)}
    </span>
  </div>
);

const RingColor = { green: '#10B981', yellow: '#EAB308', red: '#EF4444' };

const RateLimitRing = ({ used, limit, pct, color }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const safePct = Math.max(0, Math.min(100, pct || 0));
  const dash = (safePct / 100) * circumference;
  const stroke = RingColor[color] || RingColor.green;
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="12"
        />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 80 80)"
        />
        <text
          x="80"
          y="78"
          textAnchor="middle"
          fill="#fff"
          fontSize="26"
          fontWeight="900"
          fontFamily="ui-monospace, monospace"
        >
          {safePct.toFixed(0)}%
        </text>
        <text
          x="80"
          y="100"
          textAnchor="middle"
          fill="rgba(255,255,255,0.5)"
          fontSize="10"
          fontFamily="ui-monospace, monospace"
        >
          {used}/{limit}
        </text>
      </svg>
      <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
        MiniMax · Rate Buffer
      </span>
    </div>
  );
};

const UnavailableCard = ({ provider, reason }) => (
  <div className="glass rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex items-start gap-3">
    <AlertCircle size={18} className="text-white/30 mt-0.5 shrink-0" />
    <div className="min-w-0">
      <p className="text-sm font-bold text-white/60">
        {PROVIDER_LABELS[provider] || provider}
      </p>
      <p className="text-xs text-white/40 mt-0.5">{reason || 'unavailable'}</p>
    </div>
  </div>
);

const chartOpts = (yLabel = 'USD') => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } } },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: {
    x: {
      stacked: true,
      ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } },
      grid: { color: 'rgba(255,255,255,0.05)' },
    },
    y: {
      stacked: true,
      ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } },
      grid: { color: 'rgba(255,255,255,0.05)' },
      title: { display: true, text: yLabel, color: 'rgba(255,255,255,0.4)' },
    },
  },
});

const Spend = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSpend();
      setData(result);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const dates = useMemo(
    () => (data?.byDay || []).map((d) => d.date.slice(5)),
    [data]
  );

  const barData = useMemo(() => {
    if (!data) return { labels: [], datasets: [] };
    const providers = Object.keys(data.byProvider || {});
    const available = providers.filter(
      (p) => data.byProvider[p] && !data.byProvider[p].unavailable
    );
    return {
      labels: dates,
      datasets: available.map((p) => ({
        label: PROVIDER_LABELS[p] || p,
        backgroundColor: PROVIDER_COLORS[p] || '#888',
        data: (data.byDay || []).map((day) => {
          const prov = data.byProvider[p];
          if (p === 'minimax') {
            return day.date === data.byDay[data.byDay.length - 1].date
              ? prov.today || 0
              : 0;
          }
          return 0;
        }),
        stack: 'spend',
      })),
    };
  }, [data, dates]);

  const lineData = useMemo(
    () => ({
      labels: dates,
      datasets: [
        {
          label: 'Total Daily Spend',
          data: (data?.byDay || []).map((d) => d.total),
          borderColor: '#EAB308',
          backgroundColor: 'rgba(234, 179, 8, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#EAB308',
        },
      ],
    }),
    [data, dates]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="glass rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
          <p className="text-sm text-red-300 font-bold">Failed to load spend data</p>
          <p className="text-xs text-white/50 mt-1">{error}</p>
          <button
            onClick={load}
            className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-gold text-black rounded-xl text-xs font-bold uppercase"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const byProvider = data?.byProvider || {};
  const unavailable = Object.entries(byProvider).filter(([, v]) => v?.unavailable);
  const minimaxRing = data?.rateLimitBuffer?.minimax;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3">
            <DollarSign className="text-gold" size={28} />
            AI <span className="text-gold">Spend</span>
          </h1>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] mt-1">
            Cross-provider aggregation
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 glass rounded-xl text-white/60 hover:text-white border border-white/10"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Today" value={data?.totalToday} />
        <StatCard label="Last 7 Days" value={data?.totalWeek} />
        <StatCard label="Last 30 Days" value={data?.totalMonth} />
      </div>

      <div className="glass rounded-2xl border border-white/10 backdrop-blur-xl p-5">
        <h2 className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold mb-4">
          Spend by Provider · 7 days
        </h2>
        <div className="h-64">
          <Bar data={barData} options={chartOpts('USD')} />
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/10 backdrop-blur-xl p-5">
        <h2 className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold mb-4">
          Daily Total · 7 days
        </h2>
        <div className="h-64">
          <Line
            data={lineData}
            options={{
              ...chartOpts('USD'),
              scales: {
                x: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { color: 'rgba(255,255,255,0.05)' } },
              },
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl border border-white/10 backdrop-blur-xl p-5 flex items-center justify-center">
          {minimaxRing ? (
            <RateLimitRing {...minimaxRing} />
          ) : (
            <div className="text-center text-white/40 text-xs">
              MiniMax rate-limit data unavailable
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-xs uppercase tracking-[0.2em] text-white/50 font-bold mb-2">
            Unavailable Sources
          </h2>
          {unavailable.length === 0 ? (
            <div className="text-xs text-white/40 px-1">
              All providers reporting.
            </div>
          ) : (
            unavailable.map(([key, v]) => (
              <UnavailableCard key={key} provider={key} reason={v.reason} />
            ))
          )}
        </div>
      </div>

      <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest text-center">
        Updated {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : '—'}
      </p>
    </div>
  );
};

export default Spend;
