import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { loadResults } from '../data';
import type { SimulationResult } from '../types';

function CompareBar({ label, agent, baseline, unit, color }: {
  label: string; agent: number; baseline: number; unit: string; color: string;
}) {
  const max = Math.max(agent, baseline, 1);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      <div className="compare-bar-wrap">
        <div className="compare-bar-label">Agent</div>
        <div className="compare-bar-track">
          <div className="compare-bar-fill" style={{ width: `${(agent / max) * 100}%`, background: color }} />
        </div>
        <div className="compare-bar-val">{agent.toFixed(1)} {unit}</div>
      </div>
      <div className="compare-bar-wrap">
        <div className="compare-bar-label">Baseline</div>
        <div className="compare-bar-track">
          <div className="compare-bar-fill" style={{ width: `${(baseline / max) * 100}%`, background: 'var(--muted)' }} />
        </div>
        <div className="compare-bar-val">{baseline.toFixed(1)} {unit}</div>
      </div>
    </div>
  );
}

export default function Comparison() {
  const [data, setData] = useState<SimulationResult | null>(null);

  useEffect(() => { loadResults().then(setData); }, []);

  if (!data) return (
    <div className="empty">
      <h3>No simulation data</h3>
      <p>Run <code>python main.py --scenario default --compare</code> first.</p>
    </div>
  );

  const a = data.cycle_summary.agent;
  const b = data.cycle_summary.baseline;

  if (!b) return (
    <div className="empty">
      <h3>No baseline data</h3>
      <p>Re-run with <code>--compare</code> flag to include baseline comparison.</p>
      <br />
      <code>python main.py --scenario {data.scenario} --compare</code>
    </div>
  );

  const costSaved = data.cycle_summary.cost_saved_pct ?? 0;
  const carbonSaved = data.cycle_summary.carbon_saved_pct ?? 0;

  const summaryChart = [
    { metric: 'Cost ($)', agent: a.total_cost, baseline: b.total_cost },
    { metric: 'Carbon (kg)', agent: +(a.total_carbon / 1000).toFixed(2), baseline: +(b.total_carbon / 1000).toFixed(2) },
    { metric: 'Renewable (kWh)', agent: a.renewable_used, baseline: b.renewable_used },
    { metric: 'Curtailed (kWh)', agent: a.curtailed, baseline: b.curtailed },
  ];

  return (
    <>
      <div className="page-title">Comparison</div>
      <div className="page-sub">
        Scenario: <strong>{data.scenario}</strong> — Agent vs Baseline (naive grid-draw-only agent)
      </div>

      {/* Headline savings */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ borderColor: costSaved > 0 ? 'var(--green)' : 'var(--red)' }}>
          <div className="card-title">Cost Savings</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{costSaved.toFixed(1)}%</div>
          <div className="stat-label">
            ${b.total_cost.toFixed(2)} → ${a.total_cost.toFixed(2)} &nbsp;(saved ${(b.total_cost - a.total_cost).toFixed(2)})
          </div>
        </div>
        <div className="card" style={{ borderColor: carbonSaved > 0 ? 'var(--cyan)' : 'var(--red)' }}>
          <div className="card-title">Carbon Reduction</div>
          <div className="stat-value" style={{ color: 'var(--cyan)' }}>{carbonSaved.toFixed(1)}%</div>
          <div className="stat-label">
            {(b.total_carbon / 1000).toFixed(1)} → {(a.total_carbon / 1000).toFixed(1)} kg CO₂
          </div>
        </div>
      </div>

      {/* Side-by-side bar chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Head-to-head Metrics</div>
        <div className="chart-wrap" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summaryChart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="agent" name="GridMind Agent" fill="var(--green)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="baseline" name="Baseline (naive)" fill="var(--muted)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Progress bars */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Detailed Comparison</div>
        <CompareBar label="Total cost" agent={a.total_cost} baseline={b.total_cost} unit="$" color="var(--green)" />
        <CompareBar label="Total carbon" agent={a.total_carbon / 1000} baseline={b.total_carbon / 1000} unit="kg" color="var(--cyan)" />
        <CompareBar label="Renewable energy used" agent={a.renewable_used} baseline={b.renewable_used} unit="kWh" color="var(--amber)" />
        <CompareBar label="Energy curtailed (wasted)" agent={a.curtailed} baseline={b.curtailed} unit="kWh" color="var(--purple)" />
      </div>

      {/* Value statement */}
      <div className="card" style={{ borderColor: 'var(--green)' }}>
        <div className="card-title">Platform Value</div>
        <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--muted)' }}>
          <span style={{ color: 'var(--green)', fontWeight: 700 }}>GridMind's collaborative agent</span> saved{' '}
          <strong style={{ color: 'var(--text)' }}>${(b.total_cost - a.total_cost).toFixed(2)}</strong> and{' '}
          <strong style={{ color: 'var(--text)' }}>{((b.total_carbon - a.total_carbon) / 1000).toFixed(1)} kg CO₂</strong>{' '}
          compared to the naive baseline over a single 24-hour cycle — without any physical hardware, market integrations,
          or energy engineering expertise required. Decisions were explained in plain language and consequential calls
          were surfaced to the operator before action.
        </div>
      </div>
    </>
  );
}
