import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { DEFAULT_SIM, DEFAULT_SUMMARY, HOUSES } from '../simulation';

const TT = { contentStyle: { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8 }, labelStyle: { color: 'var(--text-2)' } };

const chartData = DEFAULT_SIM.map(h => ({
  hour: h.label,
  solar: h.totalSolarKw,
  p2p: h.sharedLocallyKwh,
  grid: h.gridImportKwh,
  load: h.totalLoadKw,
  independence: h.independenceScore,
}));

export default function Overview() {
  const s = DEFAULT_SUMMARY;

  return (
    <>
      <div className="page-title">Community Overview</div>
      <div className="page-sub">3-household KineticKin microgrid · NREL load profiles · P2P closed-loop model</div>

      {/* KPI stat cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Avg Independence</div>
          <div className="stat-value" style={{ color: 'var(--teal)' }}>{s.avgIndependence}%</div>
          <div className="stat-delta">community self-sufficiency score</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">P2P Shared (72h)</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{s.totalSharedKwh} <span style={{ fontSize: '1rem', color: 'var(--text-2)' }}>kWh</span></div>
          <div className="stat-delta">neighbor-to-neighbor transfers</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Grid Import Saved</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{s.gridSavedKwh} <span style={{ fontSize: '1rem', color: 'var(--text-2)' }}>kWh</span></div>
          <div className="stat-delta">vs no-P2P baseline</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-label">Community Savings</div>
          <div className="stat-value" style={{ color: 'var(--cyan)' }}>${s.moneySaved}</div>
          <div className="stat-delta">across all 3 households today</div>
        </div>
      </div>

      {/* 72h energy flow chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">72-Hour Community Energy Flow (3 Days · 15-min resolution)</div>
        <div className="chart-wrap" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-2)' }} interval={23} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-2)' }} unit=" kW" />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="solar"  stroke="#f59e0b" fill="#f59e0b22" name="Community Solar"  strokeWidth={2} />
              <Area type="monotone" dataKey="p2p"    stroke="#00d4b8" fill="#00d4b822" name="P2P Shared"       strokeWidth={2} />
              <Area type="monotone" dataKey="grid"   stroke="#ef4444" fill="#ef444422" name="Grid Import"      strokeWidth={2} />
              <Area type="monotone" dataKey="load"   stroke="#94a3b8" fill="none"      name="Community Load"   strokeWidth={1.5} strokeDasharray="5 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Household contribution cards */}
      <div className="section-label" style={{ marginBottom: 12 }}>Household Contributions — 72h Totals</div>
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {s.perHouse.map((ph, i) => {
          const house = HOUSES[i];
          return (
            <div className="card" key={ph.id} style={{ borderTop: `2px solid ${house.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.88rem', color: house.color }}>{ph.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 2 }}>{house.type}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.65rem', fontFamily: 'var(--mono)', color: 'var(--text-3)', lineHeight: 1.6 }}>
                  <div>{ph.sellerSteps} steps seller</div>
                  <div>{ph.buyerSteps} steps buyer</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', fontSize: '0.72rem', fontFamily: 'var(--mono)' }}>
                <div>
                  <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Exported</div>
                  <div style={{ color: 'var(--green)', fontWeight: 700 }}>{ph.totalSentKwh} kWh</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Received</div>
                  <div style={{ color: 'var(--teal)', fontWeight: 700 }}>{ph.totalReceivedKwh} kWh</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>P2P Revenue</div>
                  <div style={{ color: 'var(--amber)', fontWeight: 700 }}>${ph.totalRevenue}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-3)', marginBottom: 2 }}>Net Benefit</div>
                  <div style={{ color: ph.p2pSaved >= 0 ? 'var(--green)' : 'var(--text-2)', fontWeight: 700 }}>
                    {ph.p2pSaved >= 0 ? '+' : ''}${ph.p2pSaved}
                  </div>
                </div>
              </div>
              {/* Mini feedback bar */}
              <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 6, fontSize: '0.68rem', color: 'var(--text-2)', fontFamily: 'var(--mono)', lineHeight: 1.6 }}>
                {house.hasBattery && '🔋 Battery self-sufficiency first · '}
                {ph.totalSentKwh > 0 && `↑ ${ph.totalSentKwh} kWh to community · `}
                {ph.totalReceivedKwh > 0 && `↓ ${ph.totalReceivedKwh} kWh from community`}
                {ph.totalSentKwh === 0 && ph.totalReceivedKwh === 0 && 'Balanced — grid + self'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Independence score trend */}
      <div className="card">
        <div className="card-title">Community Independence Score · 72h</div>
        <div className="chart-wrap" style={{ height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-2)' }} interval={23} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-2)' }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...TT} formatter={(v) => [`${v}%`, 'Independence']} />
              <Line type="monotone" dataKey="independence" stroke="var(--teal)" dot={false} strokeWidth={2.5} name="Independence %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
