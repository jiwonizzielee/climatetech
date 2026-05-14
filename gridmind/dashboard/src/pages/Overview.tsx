import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { loadResults, toEnergyMixData, ACTION_COLOR } from '../data';
import type { SimulationResult, HourRecord } from '../types';

function StatCard({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="card">
      <div className="stat-value" style={color ? { color } : {}}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function CollaborationFeedMini({ hours }: { hours: HourRecord[] }) {
  const items = hours
    .filter((h) => h.decision.reasoning || h.decision.classification === 'consequential')
    .slice(-6)
    .reverse();
  return (
    <div>
      {items.map((r) => (
        <div key={r.hour} className={`feed-card ${r.decision.classification}`}>
          <div className="feed-header">
            <span className="feed-hour">{String(r.hour).padStart(2, '0')}:00</span>
            <span className={`badge badge-${r.decision.classification === 'routine' ? 'routine' : 'consequential'}`}>
              {r.decision.classification}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{r.decision.action.replace(/_/g, ' ')}</span>
          </div>
          <div className="feed-body">
            {r.decision.reasoning || `${r.decision.action.replace(/_/g, ' ')} — ${r.decision.amount_kwh.toFixed(1)} kWh`}
          </div>
          {r.decision.question && (
            <div className="feed-question">❓ {r.decision.question}</div>
          )}
        </div>
      ))}
      {items.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          Run with <code>--reasoning</code> to see agent communications.
        </div>
      )}
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState<SimulationResult | null>(null);

  useEffect(() => { loadResults().then(setData); }, []);

  if (!data) return (
    <div className="empty">
      <h3>No simulation data found</h3>
      <p>Run the simulation first:</p>
      <br />
      <code>python main.py --scenario default --compare</code>
    </div>
  );

  const { cycle_summary, hours, scenario, scenario_description } = data;
  const a = cycle_summary.agent;
  const b = cycle_summary.baseline;
  const energyMix = toEnergyMixData(hours);
  const consequential = hours.filter((h) => h.decision.classification === 'consequential').length;

  return (
    <>
      <div className="page-title">Overview</div>
      <div className="page-sub">Scenario: <strong>{scenario}</strong> — {scenario_description}</div>

      {/* KPI row */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard value={`$${a.total_cost.toFixed(2)}`} label="Total cost (agent)" color="var(--green)" />
        <StatCard value={`${(a.total_carbon / 1000).toFixed(1)} kg`} label="CO₂ emitted" color="var(--cyan)" />
        <StatCard value={`${a.renewable_used.toFixed(0)} kWh`} label="Renewable used" color="var(--amber)" />
        <StatCard value={`${consequential}`} label="Consequential decisions" color="var(--red)" />
      </div>

      {/* Savings row */}
      {b && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="card-title">Cost vs Baseline</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span className="stat-value" style={{ color: 'var(--green)' }}>
                {cycle_summary.cost_saved_pct?.toFixed(1)}%
              </span>
              <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                saved (${b.total_cost.toFixed(2)} → ${a.total_cost.toFixed(2)})
              </span>
            </div>
          </div>
          <div className="card">
            <div className="card-title">Carbon vs Baseline</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span className="stat-value" style={{ color: 'var(--cyan)' }}>
                {cycle_summary.carbon_saved_pct?.toFixed(1)}%
              </span>
              <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                saved ({(b.total_carbon / 1000).toFixed(1)} → {(a.total_carbon / 1000).toFixed(1)} kg CO₂)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Energy mix chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">24-Hour Energy Mix</div>
        <div className="chart-wrap" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={energyMix} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--muted)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="solar" stackId="gen" stroke="#f59e0b" fill="#f59e0b40" name="Solar" />
              <Area type="monotone" dataKey="wind" stackId="gen" stroke="#06b6d4" fill="#06b6d440" name="Wind" />
              <Area type="monotone" dataKey="grid" stackId="gen" stroke="#ef4444" fill="#ef444440" name="Grid draw" />
              <Area type="monotone" dataKey="demand" stroke="#e2e8f0" fill="none" strokeDasharray="4 2" name="Demand" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Battery level */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Battery State of Charge</div>
        <div className="chart-wrap" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={hours.map((h) => ({ hour: `${String(h.hour).padStart(2, '0')}:00`, soc: +(h.outcome.battery_after.state_of_charge * 100).toFixed(1) }))}
              margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(v: number) => [`${v}%`, 'SoC']}
              />
              <Area type="monotone" dataKey="soc" stroke="var(--green)" fill="rgba(34,197,94,0.2)" name="SoC %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live collaboration feed */}
      <div className="card">
        <div className="card-title">Agent Communications (latest)</div>
        <CollaborationFeedMini hours={hours} />
      </div>
    </>
  );
}
