import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { loadResults, loadForecastLog } from '../data';
import type { SimulationResult, ForecastEntry } from '../types';

export default function Forecast() {
  const [results, setResults] = useState<SimulationResult | null>(null);
  const [forecasts, setForecasts] = useState<ForecastEntry[]>([]);
  const [selectedHour, setSelectedHour] = useState(0);

  useEffect(() => {
    loadResults().then(setResults);
    loadForecastLog().then((f) => {
      setForecasts(f);
      if (f.length > 0) setSelectedHour(f[0].hour);
    });
  }, []);

  const current = forecasts.find((f) => f.hour === selectedHour);
  const chartData = results?.hours.map((h) => ({
    hour: `${String(h.hour).padStart(2, '0')}:00`,
    solar: h.state.solar,
    wind: h.state.wind,
    demand: h.state.demand,
    net: +(h.state.solar + h.state.wind - h.state.demand).toFixed(2),
    price: +(h.state.price * 100).toFixed(2),
  })) ?? [];

  return (
    <>
      <div className="page-title">Forecast</div>
      <div className="page-sub">Short-horizon projections and upcoming stress points</div>

      {forecasts.length === 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--amber)' }}>
          <div style={{ color: 'var(--amber)', marginBottom: 8, fontWeight: 600 }}>No forecast data</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
            Run <code>python main.py --scenario default --forecast</code> to enable the Forecast Agent.<br />
            Showing simulation profiles below for reference.
          </p>
        </div>
      )}

      {/* Full 24h generation/demand chart */}
      {results && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">24-Hour Generation &amp; Demand Profile</div>
          <div className="chart-wrap" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval={2} />
                <YAxis yAxisId="kwh" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(v) => `${v}¢`} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="kwh" type="monotone" dataKey="solar" stroke="#f59e0b" dot={false} name="Solar (kW)" />
                <Line yAxisId="kwh" type="monotone" dataKey="wind" stroke="#06b6d4" dot={false} name="Wind (kW)" />
                <Line yAxisId="kwh" type="monotone" dataKey="demand" stroke="#e2e8f0" dot={false} strokeDasharray="4 2" name="Demand (kW)" />
                <Line yAxisId="price" type="monotone" dataKey="price" stroke="#ef4444" dot={false} name="Grid price (¢/kWh)" strokeDasharray="2 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {forecasts.length > 0 && (
        <>
          {/* Hour picker */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Forecast per hour</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {forecasts.map((f) => (
                <button
                  key={f.hour}
                  className={`btn ${selectedHour === f.hour ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setSelectedHour(f.hour)}
                >
                  {String(f.hour).padStart(2, '0')}:00
                </button>
              ))}
            </div>
          </div>

          {current && (
            <div className="grid-2" style={{ marginBottom: 20, alignItems: 'start' }}>
              {/* Summary + stress points */}
              <div>
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="card-title">Agent Forecast — Hour {String(current.hour).padStart(2, '0')}:00</div>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{current.summary || 'No summary available.'}</p>
                </div>
                <div className="card">
                  <div className="card-title">Stress Points</div>
                  {current.stress_points.length === 0 && (
                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No stress points identified.</p>
                  )}
                  {current.stress_points.map((sp, i) => (
                    <div key={i} className="stress-point">
                      <span className="stress-hour">{String(sp.hour).padStart(2, '0')}:00</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--amber)' }}>{sp.type}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{sp.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Horizon table */}
              <div className="card">
                <div className="card-title">Horizon Data</div>
                <table className="horizon-table">
                  <thead>
                    <tr>
                      <th>Hour</th>
                      <th>Solar</th>
                      <th>Wind</th>
                      <th>Demand</th>
                      <th>Net</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.horizon.map((h) => (
                      <tr key={h.hour}>
                        <td>{String(h.hour).padStart(2, '0')}:00</td>
                        <td>{h.solar.toFixed(1)}</td>
                        <td>{h.wind.toFixed(1)}</td>
                        <td>{h.demand.toFixed(1)}</td>
                        <td className={h.net_kwh >= 0 ? 'positive' : 'negative'}>
                          {h.net_kwh >= 0 ? '+' : ''}{h.net_kwh.toFixed(1)}
                        </td>
                        <td>${h.grid_price.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
