import { useState } from 'react';
import { DEFAULT_SIM, DEFAULT_SUMMARY, HOUSES } from '../simulation';

export default function Collaboration() {
  const [filter, setFilter] = useState<'all' | 'active'>('active');

  const hours = filter === 'active'
    ? DEFAULT_SIM.filter(h => h.sharedLocallyKwh > 0)
    : DEFAULT_SIM;

  const s = DEFAULT_SUMMARY;

  return (
    <>
      <div className="page-title">P2P Collaboration Feed</div>
      <div className="page-sub">Step-by-step energy transactions · how surplus flows between households and what each receives back</div>

      {/* Summary row */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card green">
          <div className="stat-label">Total P2P Shared (72h)</div>
          <div className="stat-value" style={{ color: 'var(--green)', fontSize: '1.6rem' }}>{s.totalSharedKwh} kWh</div>
          <div className="stat-delta">across {DEFAULT_SIM.filter(h => h.sharedLocallyKwh > 0).length} active steps</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Grid Import Saved</div>
          <div className="stat-value" style={{ color: 'var(--teal)', fontSize: '1.6rem' }}>{s.gridSavedKwh} kWh</div>
          <div className="stat-delta">vs each house buying from grid</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Community Revenue</div>
          <div className="stat-value" style={{ color: 'var(--amber)', fontSize: '1.6rem' }}>${s.perHouse.reduce((a, h) => a + h.totalRevenue, 0).toFixed(2)}</div>
          <div className="stat-delta">earned by sellers from P2P</div>
        </div>
      </div>

      {/* Per-house receipt summary */}
      <div className="section-label" style={{ marginBottom: 12 }}>72-Hour Account Statement — What Each House Received Back</div>
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {s.perHouse.map((ph, i) => {
          const house = HOUSES[i];
          return (
            <div key={ph.id} className="card" style={{ borderLeft: `3px solid ${house.color}` }}>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.82rem', color: house.color, marginBottom: 8 }}>
                {house.name}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem', lineHeight: 2, color: 'var(--text-2)' }}>
                {ph.totalSentKwh > 0 && (
                  <div>↑ Exported <strong style={{ color: 'var(--green)' }}>{ph.totalSentKwh} kWh</strong> → earned <strong style={{ color: 'var(--amber)' }}>${ph.totalRevenue}</strong></div>
                )}
                {ph.totalReceivedKwh > 0 && (
                  <div>↓ Received <strong style={{ color: 'var(--teal)' }}>{ph.totalReceivedKwh} kWh</strong> from community</div>
                )}
                <div>Grid cost paid: <strong style={{ color: 'var(--text-1)' }}>${ph.netCost.toFixed(2)}</strong></div>
                <div>Without P2P: <strong style={{ color: 'var(--text-3)' }}>${ph.costNoP2P.toFixed(2)}</strong></div>
                <div style={{ color: ph.p2pSaved >= 0 ? 'var(--green)' : 'var(--text-2)', marginTop: 4 }}>
                  Net benefit: <strong>{ph.p2pSaved >= 0 ? '+' : ''}${ph.p2pSaved}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['active', 'all'] as const).map(f => (
          <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
            {f === 'active' ? 'P2P Active Steps' : 'All 288 Steps'}
          </button>
        ))}
      </div>

      {/* Step-by-step transaction cards */}
      {hours.map(h => {
        const sellers = h.houses.filter(hh => hh.p2pSentKwh > 0);
        const buyers  = h.houses.filter(hh => hh.p2pReceivedKwh > 0);
        const hasActivity = h.sharedLocallyKwh > 0;

        return (
          <div key={h.step} className="feed-card" style={{
            borderLeft: `3px solid ${hasActivity ? 'var(--teal)' : 'var(--border)'}`,
            marginBottom: 10,
          }}>
            <div className="feed-header" style={{ marginBottom: hasActivity ? 10 : 0 }}>
              <span className="feed-hour" style={{ minWidth: 72 }}>{h.label}</span>
              {hasActivity ? (
                <>
                  <span className="badge badge-green">P2P ACTIVE</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginLeft: 'auto' }}>
                    α={h.alpha.toFixed(2)} · {h.sharedLocallyKwh} kWh shared · ${h.communityPrice.toFixed(3)}/kWh community
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                  No P2P exchange · grid price ${h.gridPrice.toFixed(3)}/kWh
                </span>
              )}
            </div>

            {hasActivity && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Sellers */}
                <div>
                  <div style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Sellers → Pool</div>
                  {sellers.map(seller => {
                    const house = HOUSES.find(hc => hc.id === seller.houseId)!;
                    return (
                      <div key={seller.houseId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>
                        <span style={{ color: house.color }}>{house.name}</span>
                        <span>
                          <strong style={{ color: 'var(--green)' }}>+{seller.p2pSentKwh.toFixed(3)} kWh</strong>
                          <span style={{ color: 'var(--amber)', marginLeft: 8 }}>${seller.p2pRevenue.toFixed(4)}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Buyers */}
                <div>
                  <div style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Pool → Buyers</div>
                  {buyers.map(buyer => {
                    const house = HOUSES.find(hc => hc.id === buyer.houseId)!;
                    const saved = +(buyer.costNoP2P - buyer.netCost).toFixed(4);
                    return (
                      <div key={buyer.houseId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>
                        <span style={{ color: house.color }}>{house.name}</span>
                        <span>
                          <strong style={{ color: 'var(--teal)' }}>{buyer.p2pReceivedKwh.toFixed(3)} kWh</strong>
                          {buyer.gridImportKwh > 0 && <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>+{buyer.gridImportKwh.toFixed(3)} grid</span>}
                          <span style={{ color: 'var(--green)', marginLeft: 8 }}>saved ${saved}</span>
                        </span>
                      </div>
                    );
                  })}
                  {buyers.length === 0 && (
                    <div style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>
                      Surplus → grid sell {h.gridSellKwh.toFixed(3)} kWh
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
