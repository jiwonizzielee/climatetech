import { useState } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { DEFAULT_SIM, HOUSES } from '../simulation';

const TT = { contentStyle: { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8 }, labelStyle: { color: 'var(--text-2)' } };

const STRESS_THRESHOLD = 60;

export default function Forecast() {
  const [currentStep, setCurrentStep] = useState(40); // D1 10:00

  const future = DEFAULT_SIM.slice(currentStep);

  const stressSteps  = future.filter(h => h.independenceScore < STRESS_THRESHOLD);
  const stepHr       = DEFAULT_SIM[currentStep];
  const batteryHouse = stepHr.houses.find(h => HOUSES.find(hc => hc.hasBattery && hc.id === h.houseId));
  const socNow       = batteryHouse?.socAfter ?? 0;
  const socPct       = Math.round((socNow / 10) * 100);

  // Chart data — all 288 steps, mark past vs future
  const chartData = DEFAULT_SIM.map(h => ({
    hour: h.label,
    independence: h.step < currentStep ? h.independenceScore : undefined,
    forecast:     h.step >= currentStep ? h.independenceScore : undefined,
    gridImport:   h.gridImportKwh,
    solar:        h.totalSolarKw,
  }));

  // Remaining steps table — show next 16 steps (4 hours)
  const tableRows = future.slice(0, 16).map(h => {
    const isStress = h.independenceScore < STRESS_THRESHOLD;
    const isHigh   = h.gridImportKwh > 1.0;
    return { ...h, isStress, isHigh };
  });

  // Best pre-charge window: upcoming step with lowest grid price + battery < 80%
  const preChargeRec = future.find(h => h.gridPrice <= 0.15 && socPct < 80);

  return (
    <>
      <div className="page-title">Forecast</div>
      <div className="page-sub">Rest-of-72h projection · stress points · battery recommendations</div>

      {/* Step scrubber */}
      <div className="card scrubber" style={{ marginBottom: 20, gap: 14 }}>
        <span style={{ color: 'var(--text-3)', fontSize: '0.72rem', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>NOW</span>
        <input type="range" min={0} max={287} value={currentStep} onChange={e => setCurrentStep(+e.target.value)} style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--teal)', minWidth: 70 }}>
          {stepHr.label}
        </span>
      </div>

      {/* Snapshot cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Independence Now</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: stepHr.independenceScore >= STRESS_THRESHOLD ? 'var(--teal)' : 'var(--red)' }}>
            {stepHr.independenceScore}%
          </div>
          <div className="stat-delta">{stepHr.label}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Battery SoC</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: socPct > 50 ? 'var(--green)' : socPct > 20 ? 'var(--amber)' : 'var(--red)' }}>
            {socPct}%
          </div>
          <div className="stat-delta">{socNow.toFixed(1)} kWh of 10 kWh</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Stress Steps Ahead</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: stressSteps.length > 0 ? 'var(--red)' : 'var(--green)' }}>
            {stressSteps.length}
          </div>
          <div className="stat-delta">independence &lt; {STRESS_THRESHOLD}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Grid Price Now</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: stepHr.gridPrice > 0.25 ? 'var(--red)' : stepHr.gridPrice > 0.15 ? 'var(--amber)' : 'var(--green)' }}>
            {(stepHr.gridPrice * 100).toFixed(0)}¢
          </div>
          <div className="stat-delta">community {(stepHr.communityPrice * 100).toFixed(0)}¢/kWh</div>
        </div>
      </div>

      {/* Battery recommendation */}
      {preChargeRec && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid var(--teal)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            AGENT RECOMMENDATION
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: '0.9rem', color: 'var(--text-1)' }}>
            Battery is at <strong style={{ color: 'var(--amber)' }}>{socPct}%</strong>. Off-peak rate available at{' '}
            <strong style={{ color: 'var(--teal)' }}>{preChargeRec.label}</strong>{' '}
            ({(preChargeRec.gridPrice * 100).toFixed(0)}¢/kWh). Pre-charging now would reduce grid cost during{' '}
            {stressSteps.length > 0 ? `the ${stressSteps.length} upcoming high-import steps.` : 'peak periods.'}
          </div>
        </div>
      )}

      {/* Forecast chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Independence Score Forecast — Actual vs Projected (72h)</div>
        <div className="chart-wrap" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-2)' }} interval={23} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-2)' }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip {...TT} formatter={(v) => [`${v}%`, '']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={STRESS_THRESHOLD} stroke="var(--red)" strokeDasharray="4 2" opacity={0.5} />
              <ReferenceLine x={stepHr.label} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="independence" stroke="var(--teal)"  dot={false} strokeWidth={2.5} name="Actual" connectNulls={false} />
              <Line type="monotone" dataKey="forecast"     stroke="var(--teal)"  dot={false} strokeWidth={2} strokeDasharray="6 3" name="Forecast" connectNulls={false} opacity={0.7} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid import forecast */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Solar vs Grid Import — Remaining Steps</div>
        <div className="chart-wrap" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={future.map(h => ({ hour: h.label, solar: h.totalSolarKw, grid: h.gridImportKwh }))} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-2)' }} interval={23} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-2)' }} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="solar" stroke="#f59e0b" fill="#f59e0b25" name="Solar (kW)" strokeWidth={2} />
              <Area type="monotone" dataKey="grid"  stroke="#ef4444" fill="#ef444425" name="Grid Import (kWh)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming steps table — next 16 steps = 4 hours */}
      <div className="card">
        <div className="card-title">Upcoming 4-Hour Horizon (next 16 steps)</div>
        <table className="horizon-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Solar (kW)</th>
              <th>Load (kW)</th>
              <th>P2P (kWh)</th>
              <th>Grid (kWh)</th>
              <th>Independence</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(h => (
              <tr key={h.step} style={{ background: h.isStress ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
                <td style={{ fontFamily: 'var(--mono)', color: h.isStress ? 'var(--red)' : 'var(--text-1)' }}>{h.label}</td>
                <td style={{ color: '#f59e0b' }}>{h.totalSolarKw.toFixed(2)}</td>
                <td>{h.totalLoadKw.toFixed(2)}</td>
                <td className="positive">{h.sharedLocallyKwh.toFixed(3)}</td>
                <td className={h.gridImportKwh > 1 ? 'negative' : 'positive'}>{h.gridImportKwh.toFixed(3)}</td>
                <td className={h.isStress ? 'negative' : 'positive'}>{h.independenceScore}%</td>
                <td style={{ fontFamily: 'var(--mono)' }}>{(h.gridPrice * 100).toFixed(0)}¢</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Stress points */}
        {stressSteps.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>STRESS POINTS</div>
            {stressSteps.slice(0, 8).map(h => (
              <div key={h.step} className="stress-point">
                <span className="stress-hour">{h.label}</span>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                  Independence {h.independenceScore}% · Grid import {h.gridImportKwh.toFixed(3)} kWh · {(h.gridPrice * 100).toFixed(0)}¢/kWh
                </div>
              </div>
            ))}
            {stressSteps.length > 8 && (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 6 }}>
                …and {stressSteps.length - 8} more stress steps
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
