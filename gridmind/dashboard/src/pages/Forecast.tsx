import { useState, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { DEFAULT_SIM, HOUSES, INTERVAL_H } from '../simulation';
import type { HourResult } from '../simulation';

const TT = { contentStyle: { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8 }, labelStyle: { color: 'var(--text-2)' } };
const STRESS_THRESHOLD = 60;
const HORIZON_STEPS    = 96; // 24-hour look-ahead window

// ─── Recommendation engine ────────────────────────────────────────────────────

interface Rec {
  icon: string;
  title: string;
  detail: string;
  window: string;
  priority: 'high' | 'medium' | 'low';
}

function computeRecs(horizon: HourResult[], socPct: number): Rec[] {
  const recs: Rec[] = [];
  const h24 = horizon.slice(0, HORIZON_STEPS);

  // 1. Pre-charge battery before price spike
  const nextPeak = h24.find(h => h.gridPrice >= 0.35);
  const offPeakSlot = nextPeak
    ? h24.slice(0, h24.indexOf(nextPeak)).find(h => h.gridPrice <= 0.09)
    : h24.find(h => h.gridPrice <= 0.09);
  if (nextPeak && offPeakSlot && socPct < 75) {
    recs.push({
      icon: '🔋',
      title: 'Pre-Charge Battery',
      detail: `Grid price spikes to ${(nextPeak.gridPrice * 100).toFixed(0)}¢/kWh at ${nextPeak.label}. Charge now during off-peak (${(offPeakSlot.gridPrice * 100).toFixed(0)}¢/kWh at ${offPeakSlot.label}) to coast through the expensive hours without grid draw.`,
      window: offPeakSlot.label,
      priority: 'high',
    });
  }

  // 2. Pre-cool/heat — use solar surplus before peak pricing
  const surplusNow = h24.slice(0, 16).filter(h => h.sharedLocallyKwh > 0.05);
  if (nextPeak && surplusNow.length >= 2) {
    const lastSurplus = surplusNow[surplusNow.length - 1];
    recs.push({
      icon: '❄️',
      title: 'Pre-Cool Before Price Spike',
      detail: `Community solar surplus available until ${lastSurplus.label}. Run HVAC now using free P2P energy — houses can coast through the ${(nextPeak.gridPrice * 100).toFixed(0)}¢ peak at ${nextPeak.label} without active cooling load.`,
      window: `Now → ${lastSurplus.label}`,
      priority: 'high',
    });
  }

  // 3. Load shift → peak P2P sharing window
  const p2pSteps = h24.filter(h => h.sharedLocallyKwh > 0.05);
  if (p2pSteps.length > 0) {
    const peakP2P = p2pSteps.reduce((best, h) =>
      h.sharedLocallyKwh > best.sharedLocallyKwh ? h : best);
    recs.push({
      icon: '⚡',
      title: 'Shift Load to Solar Hours',
      detail: `P2P pool peaks at ${peakP2P.sharedLocallyKwh.toFixed(2)} kWh at ${peakP2P.label}. Run dishwasher, laundry, or other deferrable appliances then — community solar covers it instead of the grid.`,
      window: peakP2P.label,
      priority: 'medium',
    });
  }

  // 4. EV charge — cheapest upcoming grid window
  const evWindow = h24.reduce((best, h) =>
    h.gridPrice < best.gridPrice ? h : best);
  recs.push({
    icon: '🚗',
    title: 'EV Charge Window',
    detail: `Lowest grid rate in next 24h: ${(evWindow.gridPrice * 100).toFixed(0)}¢/kWh at ${evWindow.label}. Schedule EV charging then — estimated saving vs peak: ${((0.35 - evWindow.gridPrice) * 10).toFixed(2)}$ per 10 kWh.`,
    window: evWindow.label,
    priority: 'low',
  });

  // 5. Battery conservation — long low-solar stretch upcoming
  const noSolarSteps = h24.filter(h => h.totalSolarKw < 0.5).length;
  if (noSolarSteps > 60 && socPct > 35) {
    recs.push({
      icon: '🌙',
      title: 'Reserve Battery Overnight',
      detail: `${Math.round(noSolarSteps * INTERVAL_H)}h of low/no solar ahead. Holding battery discharge above 30% minimum reserve to guarantee morning availability for household loads.`,
      window: 'Now',
      priority: 'medium',
    });
  }

  return recs.slice(0, 4);
}

// ─── Agent briefing generator ─────────────────────────────────────────────────

function generateBriefing(horizon: HourResult[], socPct: number, nowLabel: string): string {
  const h24          = horizon.slice(0, HORIZON_STEPS);
  const solarSteps   = h24.filter(h => h.totalSolarKw > 1.0).length;
  const solarPct     = Math.round((solarSteps / HORIZON_STEPS) * 100);
  const nextSpike    = h24.find(h => h.gridPrice >= 0.35);
  const peakP2P      = h24.length > 0 ? h24.reduce((b, h) => h.sharedLocallyKwh > b.sharedLocallyKwh ? h : b) : null;
  const avgIndep     = Math.round(h24.reduce((a, h) => a + h.independenceScore, 0) / Math.max(h24.length, 1));
  const stressCount  = h24.filter(h => h.independenceScore < STRESS_THRESHOLD).length;

  const solarMsg  = solarPct > 30
    ? `Solar is expected for ~${solarPct}% of the next 24h — strong local generation window ahead.`
    : `Limited solar in the next 24h (${solarPct}% coverage). Community will lean on battery and grid.`;

  const spikeMsg  = nextSpike
    ? `⚠️ Grid price spikes to ${(nextSpike.gridPrice * 100).toFixed(0)}¢/kWh at ${nextSpike.label} — pre-charge recommended.`
    : `No price spikes detected in the next 24h. Grid conditions are stable.`;

  const battMsg   = socPct >= 70
    ? `Battery is healthy at ${socPct}%.`
    : socPct >= 30
    ? `Battery at ${socPct}% — watch discharge during the upcoming load peaks.`
    : `⚠️ Battery critically low at ${socPct}%. Pre-charging during off-peak is urgent.`;

  const p2pMsg    = peakP2P && peakP2P.sharedLocallyKwh > 0.05
    ? `Community P2P peaks at ${peakP2P.sharedLocallyKwh.toFixed(2)} kWh at ${peakP2P.label}. Run heavy appliances then — free neighbor energy available.`
    : `Minimal P2P sharing expected. Households should plan around grid and battery.`;

  const stressMsg = stressCount > 0
    ? `${stressCount} stress steps (independence < ${STRESS_THRESHOLD}%) detected — agent is adjusting strategy automatically.`
    : `No community stress periods forecast. Predicted avg independence: ${avgIndep}%.`;

  return `[${nowLabel}] ${solarMsg} ${spikeMsg} ${battMsg} ${p2pMsg} ${stressMsg}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Forecast() {
  const [currentStep, setCurrentStep] = useState(51); // D1 06:00 — solar day start

  const future   = DEFAULT_SIM.slice(currentStep);
  const stepHr   = DEFAULT_SIM[currentStep];
  const horizon  = future.slice(0, HORIZON_STEPS);

  const batteryHouse = stepHr.houses.find(h => HOUSES.find(hc => hc.hasBattery && hc.id === h.houseId));
  const socNow       = batteryHouse?.socAfter ?? 0;
  const socPct       = Math.round((socNow / 10) * 100);
  const stressSteps  = future.filter(h => h.independenceScore < STRESS_THRESHOLD);

  // ── P̂_net chart — P̂_net(t+n) = P̂_solar(t+n) − P̂_load(t+n) per house ──────
  const predictedNetChart = useMemo(() => horizon.map(h => ({
    label:      h.label,
    h1Net:      +(h.houses[0].solarKwh - h.houses[0].loadKwh).toFixed(3),
    h2Net:      +(h.houses[1].solarKwh - h.houses[1].loadKwh).toFixed(3),
    h3Net:      +(h.houses[2].solarKwh - h.houses[2].loadKwh).toFixed(3),
    communityNet: +(h.totalSolarKwh - h.totalLoadKwh).toFixed(3),
    independence: h.independenceScore,
    gridPrice:  +(h.gridPrice * 100).toFixed(0),
    p2p:        h.sharedLocallyKwh,
  })), [currentStep]);

  // ── Independence + grid price overlay chart ────────────────────────────────
  const forecastChart = useMemo(() => DEFAULT_SIM.map(h => ({
    label:        h.label,
    actual:       h.step < currentStep ? h.independenceScore : undefined,
    forecast:     h.step >= currentStep ? h.independenceScore : undefined,
    gridPriceCents: +(h.gridPrice * 100),
  })), [currentStep]);

  // ── Recommendations ────────────────────────────────────────────────────────
  const recs    = useMemo(() => computeRecs(horizon, socPct), [currentStep]);
  const briefing = useMemo(() => generateBriefing(horizon, socPct, stepHr.label), [currentStep]);

  const PRIORITY_COLOR: Record<string, string> = {
    high: 'var(--red)', medium: 'var(--amber)', low: 'var(--teal)',
  };
  const PRIORITY_BORDER: Record<string, string> = {
    high: '#ef444440', medium: '#f59e0b30', low: '#00d4b830',
  };

  return (
    <>
      <div className="page-title">Predictive Forecast</div>
      <div className="page-sub">
        P̂<sub>net</sub>(t+n) = P̂<sub>solar</sub>(t+n) − P̂<sub>load</sub>(t+n) · 24-hour rolling look-ahead · strategic agent recommendations
      </div>

      {/* Step scrubber */}
      <div className="card scrubber" style={{ marginBottom: 20, gap: 14 }}>
        <span style={{ color: 'var(--text-3)', fontSize: '0.72rem', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>NOW</span>
        <input type="range" min={0} max={191} value={currentStep} onChange={e => setCurrentStep(+e.target.value)} style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--teal)', minWidth: 80 }}>
          {stepHr.label}
        </span>
      </div>

      {/* Snapshot KPIs */}
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
          <div className="stat-label">Stress Steps (24h)</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: stressSteps.length > 0 ? 'var(--red)' : 'var(--green)' }}>
            {Math.min(stressSteps.length, HORIZON_STEPS)}
          </div>
          <div className="stat-delta">independence &lt; {STRESS_THRESHOLD}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Grid Price Now</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: stepHr.gridPrice >= 0.35 ? 'var(--red)' : stepHr.gridPrice > 0.15 ? 'var(--amber)' : 'var(--green)' }}>
            {(stepHr.gridPrice * 100).toFixed(0)}¢
          </div>
          <div className="stat-delta">community {(stepHr.communityPrice * 100).toFixed(0)}¢/kWh</div>
        </div>
      </div>

      {/* ── Agent Briefing ─────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid var(--teal)', background: 'var(--bg-2)' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem', color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
          🤖 KINETIC AGENT · 24-HOUR BRIEFING
        </div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: '0.88rem', color: 'var(--text-1)', lineHeight: 1.7 }}>
          {briefing}
        </div>
      </div>

      {/* ── Predicted Net Power chart ──────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          P̂<sub>net</sub>(t+n) = P̂<sub>solar</sub> − P̂<sub>load</sub> · Per Household · Next 24h
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
          Positive = surplus (seller) · Negative = deficit (buyer needs grid or P2P) · Zero line = balanced
        </div>
        <div className="chart-wrap" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={predictedNetChart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-2)' }} interval={11} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-2)' }} tickFormatter={v => `${v > 0 ? '+' : ''}${v}`} unit=" kWh" />
              <Tooltip {...TT} formatter={(v) => [`${+(v as number) > 0 ? '+' : ''}${v} kWh`, '']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
              <Line type="monotone" dataKey="h1Net" stroke="#00d4b8" dot={false} strokeWidth={2} name="HH1 P̂net" />
              <Line type="monotone" dataKey="h2Net" stroke="#f59e0b" dot={false} strokeWidth={2} name="HH2 P̂net" />
              <Line type="monotone" dataKey="h3Net" stroke="#8b5cf6" dot={false} strokeWidth={2} name="HH3 P̂net" />
              <Line type="monotone" dataKey="communityNet" stroke="rgba(255,255,255,0.4)" dot={false} strokeWidth={1.5} strokeDasharray="5 3" name="Community Net" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Grid price + P2P forecast overlay ─────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Price Spike & P2P Sharing — Next 24h</div>
        <div className="chart-wrap" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={predictedNetChart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-2)' }} interval={11} />
              <YAxis yAxisId="price" tick={{ fontSize: 10, fill: 'var(--text-2)' }} tickFormatter={v => `${v}¢`} />
              <YAxis yAxisId="kwh" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-2)' }} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="kwh" dataKey="p2p" fill="#00d4b840" stroke="#00d4b8" strokeWidth={0} name="P2P Shared (kWh)" />
              <Line yAxisId="price" type="stepAfter" dataKey="gridPrice" stroke="#ef4444" dot={false} strokeWidth={2} name="Grid Price (¢/kWh)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Independence score: actual + forecast ─────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Independence Score — Actual vs Forecast (72h)</div>
        <div className="chart-wrap" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecastChart} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-2)' }} interval={23} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-2)' }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip {...TT} formatter={(v) => [`${v}%`, '']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={STRESS_THRESHOLD} stroke="var(--red)" strokeDasharray="4 2" opacity={0.5} label={{ value: 'stress', position: 'insideTopLeft', fill: 'var(--red)', fontSize: 9 }} />
              <ReferenceLine x={stepHr.label} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="actual"   stroke="var(--teal)" dot={false} strokeWidth={2.5} name="Actual"   connectNulls={false} />
              <Line type="monotone" dataKey="forecast" stroke="var(--teal)" dot={false} strokeWidth={2}   strokeDasharray="6 3" name="Forecast" connectNulls={false} opacity={0.65} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Strategic Recommendations ─────────────────────────────────────── */}
      <div className="section-label" style={{ marginBottom: 14 }}>Strategic Recommendations · Rolling Horizon Optimization</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
        {recs.map((rec, i) => (
          <div key={i} className="card" style={{ borderLeft: `3px solid ${PRIORITY_COLOR[rec.priority]}`, background: PRIORITY_BORDER[rec.priority] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.2rem' }}>{rec.icon}</span>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.78rem', color: PRIORITY_COLOR[rec.priority] }}>
                  {rec.title}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text-3)', marginTop: 1 }}>
                  ACT AT: {rec.window} · {rec.priority.toUpperCase()} PRIORITY
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
              {rec.detail}
            </div>
          </div>
        ))}
      </div>

      {/* ── Per-house predicted net table ─────────────────────────────────── */}
      <div className="card">
        <div className="card-title">Upcoming 4-Hour Horizon · P̂<sub>net</sub> Per Household</div>
        <table className="horizon-table">
          <thead>
            <tr>
              <th>Step</th>
              <th style={{ color: '#00d4b8' }}>HH1 P̂net</th>
              <th style={{ color: '#f59e0b' }}>HH2 P̂net</th>
              <th style={{ color: '#8b5cf6' }}>HH3 P̂net</th>
              <th>P2P (kWh)</th>
              <th>Independence</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {future.slice(0, 16).map(h => {
              const isStress = h.independenceScore < STRESS_THRESHOLD;
              const nets = [
                +(h.houses[0].solarKwh - h.houses[0].loadKwh).toFixed(3),
                +(h.houses[1].solarKwh - h.houses[1].loadKwh).toFixed(3),
                +(h.houses[2].solarKwh - h.houses[2].loadKwh).toFixed(3),
              ];
              return (
                <tr key={h.step} style={{ background: isStress ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
                  <td style={{ fontFamily: 'var(--mono)', color: isStress ? 'var(--red)' : 'var(--text-1)' }}>{h.label}</td>
                  {nets.map((n, i) => (
                    <td key={i} style={{ fontFamily: 'var(--mono)', color: n >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {n >= 0 ? '+' : ''}{n}
                    </td>
                  ))}
                  <td className="positive">{h.sharedLocallyKwh.toFixed(3)}</td>
                  <td className={isStress ? 'negative' : 'positive'}>{h.independenceScore}%</td>
                  <td style={{ fontFamily: 'var(--mono)', color: h.gridPrice >= 0.35 ? 'var(--red)' : h.gridPrice > 0.15 ? 'var(--amber)' : 'var(--green)' }}>
                    {(h.gridPrice * 100).toFixed(0)}¢
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {stressSteps.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              STRESS POINTS DETECTED
            </div>
            {stressSteps.slice(0, 6).map(h => (
              <div key={h.step} className="stress-point">
                <span className="stress-hour">{h.label}</span>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                  Independence {h.independenceScore}% · Grid {h.gridImportKwh.toFixed(3)} kWh · {(h.gridPrice * 100).toFixed(0)}¢/kWh
                </div>
              </div>
            ))}
            {stressSteps.length > 6 && (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 6 }}>
                …and {stressSteps.length - 6} more stress steps ahead
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
