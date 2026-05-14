import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const SCENARIOS: Record<string, { description: string; solar: number; wind: number; demand: number; price: number }> = {
  default: { description: 'Typical clear day, normal demand', solar: 1.0, wind: 1.0, demand: 1.0, price: 1.0 },
  heat_wave: { description: 'High demand, reduced solar efficiency, grid price spikes', solar: 0.85, wind: 1.0, demand: 1.5, price: 1.4 },
  cloudy_calm: { description: 'Low generation — battery and grid connection critical', solar: 0.3, wind: 0.4, demand: 1.0, price: 1.0 },
  windy_night: { description: 'Strong overnight wind — store cheap energy ahead of demand', solar: 1.0, wind: 2.0, demand: 1.0, price: 1.0 },
};

function generateProfiles(solarF: number, windF: number, demandF: number) {
  return Array.from({ length: 24 }, (_, h) => {
    const solarPeak = h >= 6 && h <= 18 ? Math.exp(-0.5 * ((h - 12) / 3) ** 2) : 0;
    const solar = +(80 * solarPeak * solarF).toFixed(1);
    const windBase = 0.5 + 0.5 * Math.cos(Math.PI * (h - 12) / 12);
    const wind = +(50 * windBase * windF).toFixed(1);
    const morning = Math.exp(-0.5 * ((h - 8) / 1.5) ** 2);
    const evening = 1.2 * Math.exp(-0.5 * ((h - 19) / 1.5) ** 2);
    const demand = +(60 * (0.25 + morning + evening) * demandF).toFixed(1);
    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      solar,
      wind,
      demand,
      net: +(solar + wind - demand).toFixed(1),
    };
  });
}

export default function Scenarios() {
  const [selected, setSelected] = useState('default');
  const sc = SCENARIOS[selected];
  const profiles = generateProfiles(sc.solar, sc.wind, sc.demand);

  const totalSolar = profiles.reduce((s, r) => s + r.solar, 0).toFixed(0);
  const totalWind = profiles.reduce((s, r) => s + r.wind, 0).toFixed(0);
  const totalDemand = profiles.reduce((s, r) => s + r.demand, 0).toFixed(0);
  const surplus = profiles.filter((r) => r.net > 0).reduce((s, r) => s + r.net, 0).toFixed(0);
  const deficit = profiles.filter((r) => r.net < 0).reduce((s, r) => s + Math.abs(r.net), 0).toFixed(0);

  return (
    <>
      <div className="page-title">Scenarios</div>
      <div className="page-sub">Switch scenarios to re-preview generation &amp; demand profiles</div>

      <div className="scenario-grid" style={{ marginBottom: 20 }}>
        {Object.entries(SCENARIOS).map(([key, val]) => (
          <div
            key={key}
            className={`scenario-card${selected === key ? ' selected' : ''}`}
            onClick={() => setSelected(key)}
          >
            <div className="scenario-name">{key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</div>
            <div className="scenario-desc">{val.description}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--muted)' }}>
              <span>Solar ×{val.solar}</span>
              <span>Wind ×{val.wind}</span>
              <span>Demand ×{val.demand}</span>
              {val.price !== 1.0 && <span>Price ×{val.price}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Profile preview */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Generation &amp; Demand Preview — {selected.replace(/_/g, ' ')}</div>
        <div className="chart-wrap" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={profiles} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="solar" stroke="#f59e0b" fill="#f59e0b30" name="Solar (kW)" />
              <Area type="monotone" dataKey="wind" stroke="#06b6d4" fill="#06b6d430" name="Wind (kW)" />
              <Area type="monotone" dataKey="demand" stroke="#e2e8f0" fill="#e2e8f015" strokeDasharray="4 2" name="Demand (kW)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Net energy */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Net Energy Balance (generation − demand)</div>
        <div className="chart-wrap" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={profiles} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <Area
                type="monotone"
                dataKey="net"
                stroke="var(--green)"
                fill="rgba(34,197,94,0.15)"
                name="Net (kW)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4">
        {[
          { v: `${totalSolar} kWh`, l: 'Total solar potential', c: 'var(--amber)' },
          { v: `${totalWind} kWh`, l: 'Total wind potential', c: 'var(--cyan)' },
          { v: `${totalDemand} kWh`, l: 'Total demand', c: 'var(--text)' },
          { v: `+${surplus} / −${deficit}`, l: 'Surplus / deficit (kWh)', c: 'var(--green)' },
        ].map((s) => (
          <div key={s.l} className="card">
            <div className="stat-value" style={{ color: s.c, fontSize: '1.4rem' }}>{s.v}</div>
            <div className="stat-label">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20, borderColor: 'var(--green)' }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
          To run the full simulation for this scenario:
        </div>
        <code style={{ display: 'block', marginTop: 8, fontSize: '0.85rem', color: 'var(--green)' }}>
          python main.py --scenario {selected} --compare --reasoning --forecast
        </code>
      </div>
    </>
  );
}
