import { useEffect, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { loadResults, toTimelineRows, ACTION_COLOR, ACTION_LABEL } from '../data';
import type { SimulationResult, HourRecord } from '../types';

export default function Timeline() {
  const [data, setData] = useState<SimulationResult | null>(null);
  const [hour, setHour] = useState(12);

  useEffect(() => { loadResults().then(setData); }, []);

  if (!data) return (
    <div className="empty">
      <h3>No simulation data</h3>
      <p>Run <code>python main.py --scenario default</code> first.</p>
    </div>
  );

  const rows = toTimelineRows(data.hours);
  const focused: HourRecord = data.hours[hour];
  const action = focused.decision.action;

  return (
    <>
      <div className="page-title">Timeline</div>
      <div className="page-sub">Scrub through the 24-hour simulation cycle</div>

      {/* Hour scrubber */}
      <div className="scrubber card" style={{ marginBottom: 20 }}>
        <span style={{ color: 'var(--muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Hour</span>
        <input
          type="range" min={0} max={23} value={hour}
          onChange={(e) => setHour(+e.target.value)}
          style={{ flex: 1 }}
        />
        <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 52 }}>
          {String(hour).padStart(2, '0')}:00
        </span>
      </div>

      {/* Focused hour snapshot */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { v: `${focused.state.solar.toFixed(1)} kW`, l: 'Solar', c: 'var(--amber)' },
          { v: `${focused.state.wind.toFixed(1)} kW`, l: 'Wind', c: 'var(--cyan)' },
          { v: `${focused.state.demand.toFixed(1)} kW`, l: 'Demand', c: 'var(--text)' },
          { v: `${(focused.outcome.battery_after.state_of_charge * 100).toFixed(0)}%`, l: 'Battery SoC', c: 'var(--green)' },
        ].map((s) => (
          <div key={s.l} className="card">
            <div className="stat-value" style={{ color: s.c }}>{s.v}</div>
            <div className="stat-label">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Decision card */}
      <div className="card" style={{ marginBottom: 20, borderLeft: `3px solid ${ACTION_COLOR[action] || 'var(--border)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{ACTION_LABEL[action]}</span>
          <span style={{ color: ACTION_COLOR[action], fontSize: '1.1rem', fontWeight: 700 }}>
            {focused.decision.amount_kwh.toFixed(1)} kWh
          </span>
          <span className={`badge badge-${focused.decision.classification}`}>
            {focused.decision.classification}
          </span>
        </div>
        {focused.decision.reasoning ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{focused.decision.reasoning}</p>
        ) : (
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
            Run with <code>--reasoning</code> for agent explanations.
          </p>
        )}
        <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: '0.8rem', color: 'var(--muted)' }}>
          <span>Grid draw: <strong style={{ color: 'var(--text)' }}>{focused.outcome.grid_draw_kwh.toFixed(1)} kWh</strong></span>
          <span>Cost: <strong style={{ color: 'var(--text)' }}>${focused.outcome.cost_usd.toFixed(3)}</strong></span>
          <span>Carbon: <strong style={{ color: 'var(--text)' }}>{focused.outcome.carbon_g.toFixed(0)} g</strong></span>
          <span>Grid price: <strong style={{ color: 'var(--text)' }}>${focused.state.price.toFixed(3)}/kWh</strong></span>
        </div>
      </div>

      {/* Energy flows chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Generation, Demand &amp; Battery (all hours)</div>
        <div className="chart-wrap" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval={2} />
              <YAxis yAxisId="kwh" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis yAxisId="bat" orientation="right" tick={{ fontSize: 10, fill: 'var(--muted)' }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--muted)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="kwh" dataKey="solar" stackId="gen" fill="#f59e0b80" name="Solar" />
              <Bar yAxisId="kwh" dataKey="wind" stackId="gen" fill="#06b6d480" name="Wind" />
              <Bar yAxisId="kwh" dataKey="grid_draw" stackId="gen" fill="#ef444480" name="Grid" />
              <Line yAxisId="kwh" type="monotone" dataKey="demand" stroke="#e2e8f0" dot={false} name="Demand" strokeDasharray="4 2" />
              <Line
                yAxisId="bat"
                type="monotone"
                dataKey={(r) => +(r.battery / 100 * 100).toFixed(1)}
                stroke="var(--green)"
                dot={false}
                name="Battery kWh"
                strokeWidth={2}
              />
              {/* highlight current hour */}
              <Bar
                yAxisId="kwh"
                dataKey={(r) => (r.hour === hour ? 200 : 0)}
                fill="rgba(255,255,255,0.04)"
                stackId="hl"
                name=""
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost / carbon per hour */}
      <div className="card">
        <div className="card-title">Hourly Cost &amp; Carbon</div>
        <div className="chart-wrap" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval={2} />
              <YAxis yAxisId="cost" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis yAxisId="carbon" orientation="right" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="cost" dataKey="cost" fill="#3b82f680" name="Cost ($)" />
              <Line yAxisId="carbon" type="monotone" dataKey="carbon" stroke="#06b6d4" dot={false} name="Carbon (g)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
