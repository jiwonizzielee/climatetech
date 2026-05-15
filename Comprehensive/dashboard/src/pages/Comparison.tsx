import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { DEFAULT_SIM, DEFAULT_SUMMARY, HOUSES, N_STEPS } from '../simulation';

const TT = { contentStyle: { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8 }, labelStyle: { color: 'var(--text-2)' } };

function CompareBar({ label, withP2P, noP2P, unit, better }: {
  label: string; withP2P: number; noP2P: number; unit: string; better: 'lower' | 'higher';
}) {
  const max = Math.max(withP2P, noP2P, 0.001);
  const p2pWins = better === 'lower' ? withP2P <= noP2P : withP2P >= noP2P;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontFamily: 'var(--mono)', marginBottom: 6 }}>{label}</div>
      <div className="compare-bar-wrap">
        <div className="compare-bar-label">With P2P</div>
        <div className="compare-bar-track">
          <div className="compare-bar-fill" style={{ width: `${(withP2P / max) * 100}%`, background: p2pWins ? 'var(--teal)' : 'var(--red)' }} />
        </div>
        <div className="compare-bar-val" style={{ color: p2pWins ? 'var(--teal)' : 'var(--red)', fontFamily: 'var(--mono)' }}>{withP2P.toFixed(2)} {unit}</div>
      </div>
      <div className="compare-bar-wrap">
        <div className="compare-bar-label">No P2P</div>
        <div className="compare-bar-track">
          <div className="compare-bar-fill" style={{ width: `${(noP2P / max) * 100}%`, background: 'var(--text-3)' }} />
        </div>
        <div className="compare-bar-val" style={{ fontFamily: 'var(--mono)' }}>{noP2P.toFixed(2)} {unit}</div>
      </div>
    </div>
  );
}

export default function Comparison() {
  const s = DEFAULT_SUMMARY;

  // 72h grid import chart: with P2P vs without
  const gridChart = DEFAULT_SIM.map(h => ({
    hour: h.label,
    withP2P: h.gridImportKwh,
    noP2P:   h.gridImportNoP2PKwh,
  }));

  // Independence comparison
  const indepChart = DEFAULT_SIM.map(h => ({
    hour: h.label,
    withP2P: h.independenceScore,
    noP2P:   h.independenceNoP2P,
  }));

  // Per-house summary chart data
  const houseBarData = s.perHouse.map((ph, i) => ({
    name: HOUSES[i].name.split(' ')[0],
    withP2P: Math.max(0, ph.netCost),
    noP2P:   ph.costNoP2P,
    saved:   ph.p2pSaved,
  }));

  const costSavedPct = s.totalCostWithoutP2P > 0
    ? +((s.moneySaved / s.totalCostWithoutP2P) * 100).toFixed(1)
    : 0;
  const gridSavedPct = s.totalGridNoP2PKwh > 0
    ? +((s.gridSavedKwh / s.totalGridNoP2PKwh) * 100).toFixed(1)
    : 0;

  const avgIndepNoP2P = +(DEFAULT_SIM.reduce((a, h) => a + h.independenceNoP2P, 0) / N_STEPS).toFixed(1);

  return (
    <>
      <div className="page-title">P2P vs No-P2P Comparison</div>
      <div className="page-sub">KineticKin community sharing vs each household buying independently from the grid · 72h</div>

      {/* Headline savings */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="stat-card green">
          <div className="stat-label">Cost Saved via P2P</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>${s.moneySaved}</div>
          <div className="stat-delta">{costSavedPct}% reduction · ${s.totalCostWithP2P} vs ${s.totalCostWithoutP2P}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Grid Import Reduced</div>
          <div className="stat-value" style={{ color: 'var(--teal)' }}>{s.gridSavedKwh} kWh</div>
          <div className="stat-delta">{gridSavedPct}% reduction · {s.totalGridKwh} vs {s.totalGridNoP2PKwh} kWh</div>
        </div>
      </div>

      {/* 72h grid import chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">72h Grid Import — With P2P vs Without</div>
        <div className="chart-wrap" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gridChart} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-2)' }} interval={23} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-2)' }} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="withP2P" stroke="var(--teal)"   dot={false} strokeWidth={2.5} name="With P2P (kWh)" />
              <Line type="monotone" dataKey="noP2P"   stroke="var(--text-3)" dot={false} strokeWidth={1.5} strokeDasharray="5 3" name="No P2P (kWh)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Independence chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Independence Score — With P2P vs Without</div>
        <div className="chart-wrap" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={indepChart} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-2)' }} interval={23} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-2)' }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip {...TT} formatter={(v) => [`${v}%`, '']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="withP2P" stroke="var(--teal)"   dot={false} strokeWidth={2.5} name="With P2P" />
              <Line type="monotone" dataKey="noP2P"   stroke="var(--text-3)" dot={false} strokeWidth={1.5} strokeDasharray="5 3" name="No P2P" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-house bar chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Grid Cost Per Household — With P2P vs Without (72h total)</div>
        <div className="chart-wrap" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={houseBarData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-2)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-2)' }} tickFormatter={v => `$${v}`} />
              <Tooltip {...TT} formatter={(v) => [`$${(+(v ?? 0)).toFixed(3)}`, '']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="withP2P" name="With P2P ($)" fill="var(--teal)"   radius={[4,4,0,0]} />
              <Bar dataKey="noP2P"   name="No P2P ($)"  fill="var(--text-3)"  radius={[4,4,0,0]} opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed compare bars */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Community Metrics Comparison</div>
        <CompareBar label="Total grid cost ($)"       withP2P={s.totalCostWithP2P}  noP2P={s.totalCostWithoutP2P} unit="$"   better="lower" />
        <CompareBar label="Total grid import (kWh)"  withP2P={s.totalGridKwh}       noP2P={s.totalGridNoP2PKwh}   unit="kWh" better="lower" />
        <CompareBar label="P2P energy shared (kWh)"  withP2P={s.totalSharedKwh}     noP2P={0}                     unit="kWh" better="higher" />
        <CompareBar label="Avg independence (%)"     withP2P={s.avgIndependence}    noP2P={avgIndepNoP2P}         unit="%" better="higher" />
      </div>

      {/* Per-house breakdown table */}
      <div className="card">
        <div className="card-title">Per-Household P2P Benefit</div>
        <table className="horizon-table">
          <thead>
            <tr>
              <th>Household</th>
              <th>Role</th>
              <th>P2P Sent</th>
              <th>P2P Received</th>
              <th>Revenue Earned</th>
              <th>Cost with P2P</th>
              <th>Cost without P2P</th>
              <th>Net Benefit</th>
            </tr>
          </thead>
          <tbody>
            {s.perHouse.map((ph, i) => (
              <tr key={ph.id}>
                <td style={{ color: HOUSES[i].color, fontFamily: 'var(--mono)', fontWeight: 700 }}>{ph.name}</td>
                <td style={{ color: 'var(--text-3)' }}>
                  {ph.sellerSteps > ph.buyerSteps ? 'Seller' : ph.buyerSteps > ph.sellerSteps ? 'Buyer' : 'Mixed'}
                </td>
                <td className="positive">{ph.totalSentKwh} kWh</td>
                <td style={{ color: 'var(--teal)' }}>{ph.totalReceivedKwh} kWh</td>
                <td style={{ color: 'var(--amber)' }}>${ph.totalRevenue}</td>
                <td style={{ fontFamily: 'var(--mono)' }}>${ph.netCost}</td>
                <td style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>${ph.costNoP2P}</td>
                <td className={ph.p2pSaved >= 0 ? 'positive' : 'negative'} style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>
                  {ph.p2pSaved >= 0 ? '+' : ''}${ph.p2pSaved}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
