import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { SCENARIOS, runSimulation, getSummary } from '../simulation';

const TT = { contentStyle: { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8 }, labelStyle: { color: 'var(--text-2)' } };

export default function Scenarios() {
  const [selectedId, setSelectedId] = useState('clear');
  const sc = SCENARIOS.find(s => s.id === selectedId)!;

  const sim     = useMemo(() => runSimulation(sc.solarMult, sc.loadMult, sc.priceMult), [selectedId]);
  const summary = useMemo(() => getSummary(sim), [sim]);

  const chartData = sim.map(h => ({
    hour: h.label,
    solar: h.totalSolarKw,
    p2p: h.sharedLocallyKwh,
    grid: h.gridImportKwh,
    load: h.totalLoadKw,
    independence: h.independenceScore,
  }));

  return (
    <>
      <div className="page-title">Scenarios</div>
      <div className="page-sub">Switch conditions to see how the P2P model responds — all metrics recalculate live across 72h</div>

      {/* Scenario cards */}
      <div className="scenario-grid" style={{ marginBottom: 20 }}>
        {SCENARIOS.map(s => (
          <div
            key={s.id}
            className={`scenario-card${selectedId === s.id ? ' selected' : ''}`}
            onClick={() => setSelectedId(s.id)}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{s.icon}</div>
            <div className="scenario-name">{s.name}</div>
            <div className="scenario-desc">{s.description}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { l: 'Solar', v: `×${s.solarMult}`, c: s.solarMult < 0.8 ? 'var(--red)' : s.solarMult === 1 ? 'var(--text-3)' : 'var(--green)' },
                { l: 'Load',  v: `×${s.loadMult}`,  c: s.loadMult > 1.1 ? 'var(--red)' : s.loadMult === 1 ? 'var(--text-3)' : 'var(--amber)' },
                { l: 'Price', v: `×${s.priceMult}`, c: s.priceMult > 1 ? 'var(--red)' : s.priceMult < 1 ? 'var(--green)' : 'var(--text-3)' },
              ].map(b => (
                <span key={b.l} style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem', color: b.c }}>
                  {b.l} {b.v}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Scenario KPI cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Avg Independence</div>
          <div className="stat-value" style={{ color: summary.avgIndependence >= 70 ? 'var(--teal)' : summary.avgIndependence >= 50 ? 'var(--amber)' : 'var(--red)', fontSize: '1.6rem' }}>
            {summary.avgIndependence}%
          </div>
          <div className="stat-delta">{sc.name}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">P2P Shared (72h)</div>
          <div className="stat-value" style={{ color: 'var(--green)', fontSize: '1.6rem' }}>{summary.totalSharedKwh} kWh</div>
          <div className="stat-delta">neighbor-to-neighbor</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Grid Import</div>
          <div className="stat-value" style={{ color: 'var(--amber)', fontSize: '1.6rem' }}>{summary.totalGridKwh} kWh</div>
          <div className="stat-delta">saved {summary.gridSavedKwh} kWh vs no-P2P</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-label">Community Savings</div>
          <div className="stat-value" style={{ color: 'var(--cyan)', fontSize: '1.6rem' }}>${summary.moneySaved}</div>
          <div className="stat-delta">all 3 households</div>
        </div>
      </div>

      {/* Energy flow chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Community Energy Flow — {sc.name} (72h · 15-min)</div>
        <div className="chart-wrap" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-2)' }} interval={23} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-2)' }} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="solar" stroke="#f59e0b" fill="#f59e0b22" name="Solar (kW)"       strokeWidth={2} />
              <Area type="monotone" dataKey="p2p"   stroke="#00d4b8" fill="#00d4b822" name="P2P Shared (kWh)" strokeWidth={2} />
              <Area type="monotone" dataKey="grid"  stroke="#ef4444" fill="#ef444422" name="Grid Import (kWh)" strokeWidth={2} />
              <Area type="monotone" dataKey="load"  stroke="#94a3b8" fill="none"      name="Load (kW)"         strokeWidth={1.5} strokeDasharray="5 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-house breakdown for selected scenario */}
      <div className="section-label" style={{ marginBottom: 12 }}>Household Impact — {sc.name}</div>
      <div className="grid-3">
        {summary.perHouse.map((ph, i) => {
          const colors = ['var(--teal)', 'var(--amber)', 'var(--purple)'];
          const color = colors[i];
          return (
            <div className="card" key={ph.id}>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.82rem', color, marginBottom: 10 }}>{ph.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 8, fontSize: '0.72rem', fontFamily: 'var(--mono)' }}>
                <div><div style={{ color: 'var(--text-3)' }}>Exported</div><div style={{ color: 'var(--green)' }}>{ph.totalSentKwh} kWh</div></div>
                <div><div style={{ color: 'var(--text-3)' }}>Received</div><div style={{ color: 'var(--teal)' }}>{ph.totalReceivedKwh} kWh</div></div>
                <div><div style={{ color: 'var(--text-3)' }}>Net Cost</div><div style={{ color: 'var(--text-1)' }}>${ph.netCost}</div></div>
                <div><div style={{ color: 'var(--text-3)' }}>P2P Benefit</div><div style={{ color: ph.p2pSaved >= 0 ? 'var(--green)' : 'var(--red)' }}>{ph.p2pSaved >= 0 ? '+' : ''}${ph.p2pSaved}</div></div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
