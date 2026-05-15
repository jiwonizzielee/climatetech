import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { DEFAULT_SIM, HOUSES } from '../simulation';
import type { HourHouseResult } from '../simulation';

const TT = { contentStyle: { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8 }, labelStyle: { color: 'var(--text-2)' } };

const ROLE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  seller:   { label: 'SELLER',   color: 'var(--green)',  bg: 'rgba(34,197,94,0.12)' },
  buyer:    { label: 'BUYER',    color: 'var(--amber)',  bg: 'rgba(245,158,11,0.12)' },
  balanced: { label: 'BALANCED', color: 'var(--text-2)', bg: 'rgba(148,163,184,0.08)' },
};

function HouseCard({ hr, house }: { hr: HourHouseResult; house: typeof HOUSES[0] }) {
  const rs = ROLE_STYLE[hr.role];
  const batteryPct = house.hasBattery ? Math.round((hr.socAfter / house.batteryMaxKwh) * 100) : null;

  return (
    <div className="card" style={{ borderTop: `2px solid ${house.color}` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.85rem', color: house.color }}>{house.name}</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{house.type}</div>
        </div>
        <div style={{ background: rs.bg, color: rs.color, fontFamily: 'var(--mono)', fontSize: '0.62rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.08em', alignSelf: 'flex-start' }}>
          {rs.label}
        </div>
      </div>

      {/* Energy snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[
          { l: 'Solar', v: `${hr.solarKw.toFixed(2)} kW`, c: '#f59e0b' },
          { l: 'Load',  v: `${hr.loadKw.toFixed(2)} kW`,  c: 'var(--text-2)' },
          { l: 'Net',   v: `${hr.initialNetKwh >= 0 ? '+' : ''}${hr.initialNetKwh.toFixed(3)} kWh`, c: hr.initialNetKwh >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--bg-2)', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
            <div style={{ fontSize: '0.82rem', fontFamily: 'var(--mono)', fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Battery row */}
      {batteryPct !== null && (
        <div style={{ marginBottom: 10, background: 'var(--bg-2)', borderRadius: 6, padding: '6px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.62rem', fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>BATTERY SOC</span>
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--mono)', color: 'var(--green)', fontWeight: 700 }}>
              {hr.socBefore.toFixed(1)} → {hr.socAfter.toFixed(1)} kWh
              {hr.batteryDeltaKwh !== 0 && <span style={{ color: hr.batteryDeltaKwh > 0 ? 'var(--teal)' : 'var(--amber)', marginLeft: 6 }}>
                ({hr.batteryDeltaKwh > 0 ? '+' : ''}{hr.batteryDeltaKwh.toFixed(2)})
              </span>}
            </span>
          </div>
          <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${batteryPct}%`, background: batteryPct > 50 ? 'var(--green)' : batteryPct > 20 ? 'var(--amber)' : 'var(--red)', borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      {/* P2P exchange */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <div style={{ background: 'var(--bg-2)', borderRadius: 6, padding: '6px 8px' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>P2P SENT</div>
          <div style={{ fontSize: '0.82rem', fontFamily: 'var(--mono)', fontWeight: 700, color: hr.p2pSentKwh > 0 ? 'var(--green)' : 'var(--text-3)' }}>
            {hr.p2pSentKwh > 0 ? `↑ ${hr.p2pSentKwh.toFixed(3)} kWh` : '—'}
          </div>
        </div>
        <div style={{ background: 'var(--bg-2)', borderRadius: 6, padding: '6px 8px' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>P2P RECEIVED</div>
          <div style={{ fontSize: '0.82rem', fontFamily: 'var(--mono)', fontWeight: 700, color: hr.p2pReceivedKwh > 0 ? 'var(--teal)' : 'var(--text-3)' }}>
            {hr.p2pReceivedKwh > 0 ? `↓ ${hr.p2pReceivedKwh.toFixed(3)} kWh` : '—'}
          </div>
        </div>
      </div>

      {/* Grid import + feedback */}
      <div style={{ padding: '8px 10px', background: hr.role === 'seller' ? 'rgba(34,197,94,0.08)' : hr.gridImportKwh > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(0,212,184,0.08)', borderRadius: 6, fontFamily: 'var(--mono)', fontSize: '0.68rem', lineHeight: 1.7 }}>
        {hr.role === 'seller' && (
          <>
            <div style={{ color: 'var(--green)', fontWeight: 700 }}>↑ Exported {hr.p2pSentKwh.toFixed(3)} kWh to community</div>
            <div style={{ color: 'var(--text-2)' }}>Earned <strong style={{ color: 'var(--amber)' }}>${hr.p2pRevenue.toFixed(4)}</strong> at community price</div>
          </>
        )}
        {hr.role === 'buyer' && (
          <>
            <div style={{ color: 'var(--teal)', fontWeight: 700 }}>↓ Received {hr.p2pReceivedKwh.toFixed(3)} kWh from community</div>
            <div style={{ color: 'var(--text-2)' }}>
              Grid: <strong style={{ color: hr.gridImportKwh > 0 ? 'var(--red)' : 'var(--text-2)' }}>{hr.gridImportKwh.toFixed(3)} kWh</strong>
              {' '}· Cost <strong style={{ color: 'var(--text-1)' }}>${hr.gridCost.toFixed(4)}</strong>
              {' '}· Saved <strong style={{ color: 'var(--green)' }}>${(hr.costNoP2P - hr.netCost).toFixed(4)}</strong> vs no-P2P
            </div>
          </>
        )}
        {hr.role === 'balanced' && (
          <div style={{ color: 'var(--text-2)' }}>Self-sufficient this step · no grid interaction</div>
        )}
      </div>
    </div>
  );
}

// 72h chart data (288 steps, sampled every step)
const chartData = DEFAULT_SIM.map(h => ({
  hour: h.label,
  h1Solar: h.houses[0].solarKw,
  h3Solar: h.houses[2].solarKw,
  p2p: h.sharedLocallyKwh,
  grid: h.gridImportKwh,
  totalLoad: h.totalLoadKw,
  independence: h.independenceScore,
}));

export default function Timeline() {
  const [step, setStep] = useState(40); // D1 10:00
  const hr = DEFAULT_SIM[step];

  return (
    <>
      <div className="page-title">Step-by-Step Timeline</div>
      <div className="page-sub">Scrub through 72h of 15-min P2P simulation · see each household's exact role and feedback</div>

      {/* Step scrubber */}
      <div className="card scrubber" style={{ marginBottom: 20, gap: 14 }}>
        <span style={{ color: 'var(--text-3)', fontSize: '0.72rem', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>STEP</span>
        <input type="range" min={0} max={287} value={step} onChange={e => setStep(+e.target.value)} style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--teal)', minWidth: 70 }}>
          {hr.label}
        </span>
      </div>

      {/* Community snapshot for selected step */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { l: 'Community Solar', v: `${hr.totalSolarKw.toFixed(2)} kW`,         c: '#f59e0b' },
          { l: 'P2P Shared',      v: `${hr.sharedLocallyKwh.toFixed(3)} kWh`,    c: 'var(--teal)' },
          { l: 'Grid Import',     v: `${hr.gridImportKwh.toFixed(3)} kWh`,        c: hr.gridImportKwh > 1 ? 'var(--red)' : 'var(--green)' },
          { l: 'Independence',    v: `${hr.independenceScore}%`,                   c: 'var(--teal)' },
        ].map(s => (
          <div className="stat-card" key={s.l}>
            <div className="stat-label">{s.l}</div>
            <div className="stat-value" style={{ color: s.c, fontSize: '1.5rem' }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* 3 house cards */}
      <div className="section-label" style={{ marginBottom: 12 }}>Household Status — {hr.label}</div>
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {hr.houses.map((hhr, i) => (
          <HouseCard key={hhr.houseId} hr={hhr} house={HOUSES[i]} />
        ))}
      </div>

      {/* P2P exchange summary card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">P2P Exchange — {hr.label}</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--text-3)', lineHeight: 2 }}>
            <div>Grid Price <strong style={{ color: 'var(--text-1)' }}>${hr.gridPrice.toFixed(3)}/kWh</strong></div>
            <div>Community Price <strong style={{ color: 'var(--teal)' }}>${hr.communityPrice.toFixed(3)}/kWh</strong></div>
            <div>Clean Factor <strong style={{ color: 'var(--green)' }}>{hr.cleanFactor}×</strong></div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            {/* Visual flow */}
            {hr.houses.filter(h => h.p2pSentKwh > 0).map(seller => {
              const house = HOUSES.find(h => h.id === seller.houseId)!;
              return (
                <div key={seller.houseId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>
                  <span style={{ color: house.color, fontWeight: 700, minWidth: 90 }}>{house.name}</span>
                  <span style={{ color: 'var(--green)' }}>→ {seller.p2pSentKwh.toFixed(3)} kWh →</span>
                  <span style={{ color: 'var(--teal)' }}>Community Pool</span>
                  <span style={{ color: 'var(--amber)', marginLeft: 6 }}>+${seller.p2pRevenue.toFixed(4)}</span>
                </div>
              );
            })}
            {hr.houses.filter(h => h.p2pReceivedKwh > 0).map(buyer => {
              const house = HOUSES.find(h => h.id === buyer.houseId)!;
              return (
                <div key={buyer.houseId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>
                  <span style={{ color: 'var(--teal)' }}>Community Pool</span>
                  <span style={{ color: 'var(--teal)' }}>→ {buyer.p2pReceivedKwh.toFixed(3)} kWh →</span>
                  <span style={{ color: house.color, fontWeight: 700, minWidth: 90 }}>{house.name}</span>
                  <span style={{ color: 'var(--green)', marginLeft: 6 }}>saved ${(buyer.costNoP2P - buyer.netCost).toFixed(4)}</span>
                </div>
              );
            })}
            {hr.sharedLocallyKwh === 0 && (
              <div style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>No P2P exchange this step</div>
            )}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--text-3)', lineHeight: 2 }}>
            <div>α (fairness) <strong style={{ color: 'var(--text-1)' }}>{hr.alpha.toFixed(3)}</strong></div>
            <div>Shared <strong style={{ color: 'var(--green)' }}>{hr.sharedLocallyKwh.toFixed(3)} kWh</strong></div>
            <div>Grid saved <strong style={{ color: 'var(--amber)' }}>{hr.gridImportNoP2PKwh - hr.gridImportKwh > 0 ? (hr.gridImportNoP2PKwh - hr.gridImportKwh).toFixed(3) : '0'} kWh</strong></div>
          </div>
        </div>
      </div>

      {/* 72h chart */}
      <div className="card">
        <div className="card-title">72-Hour P2P Energy Flow</div>
        <div className="chart-wrap" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-2)' }} interval={23} />
              <YAxis yAxisId="kw" tick={{ fontSize: 10, fill: 'var(--text-2)' }} />
              <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-2)' }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="kw" dataKey="h1Solar" stackId="sol" fill="#00d4b840" stroke="#00d4b8" strokeWidth={0} name="H1 Solar" />
              <Bar yAxisId="kw" dataKey="h3Solar" stackId="sol" fill="#8b5cf640" stroke="#8b5cf6" strokeWidth={0} name="H3 Solar" />
              <Bar yAxisId="kw" dataKey="p2p"    fill="#22c55e40" stroke="#22c55e" strokeWidth={0} name="P2P Shared" />
              <Bar yAxisId="kw" dataKey="grid"   fill="#ef444440" stroke="#ef4444" strokeWidth={0} name="Grid Import" />
              <Line yAxisId="kw" type="monotone" dataKey="totalLoad" stroke="#94a3b8" dot={false} strokeDasharray="4 2" strokeWidth={1.5} name="Total Load" />
              <Line yAxisId="pct" type="monotone" dataKey="independence" stroke="var(--teal)" dot={false} strokeWidth={2} name="Independence %" />
              <ReferenceLine yAxisId="kw" x={hr.label} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeDasharray="3 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
