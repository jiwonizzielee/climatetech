import { useEffect, useState } from 'react';
import { loadResults } from '../data';
import type { SimulationResult, HourRecord } from '../types';

function FeedCard({ record, onApprove, onReject }: {
  record: HourRecord;
  onApprove: (h: number) => void;
  onReject: (h: number) => void;
}) {
  const { hour, decision } = record;
  const cls = decision.classification;
  const [responded, setResponded] = useState<'approved' | 'rejected' | null>(null);

  return (
    <div className={`feed-card ${cls}`}>
      <div className="feed-header">
        <span className="feed-hour">{String(hour).padStart(2, '0')}:00</span>
        <span className={`badge badge-${cls === 'routine' ? 'routine' : 'consequential'}`}>{cls}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: 'auto' }}>
          {decision.action.replace(/_/g, ' ')} · {decision.amount_kwh.toFixed(1)} kWh
        </span>
      </div>
      {decision.reasoning && (
        <div className="feed-body">{decision.reasoning}</div>
      )}
      {!decision.reasoning && (
        <div className="feed-body" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
          No agent explanation — run with <code>--reasoning</code> flag.
        </div>
      )}
      {cls === 'consequential' && (
        <>
          {decision.question && (
            <div className="feed-question">
              <strong>❓ Operator decision required:</strong><br />
              {decision.question}
            </div>
          )}
          {!responded ? (
            <div className="feed-actions">
              <button className="btn btn-approve" onClick={() => { setResponded('approved'); onApprove(hour); }}>
                ✓ Approve
              </button>
              <button className="btn btn-reject" onClick={() => { setResponded('rejected'); onReject(hour); }}>
                ✗ Reject
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: '0.8rem', color: responded === 'approved' ? 'var(--green)' : 'var(--red)' }}>
              {responded === 'approved' ? '✓ Decision approved' : '✗ Decision rejected'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Collaboration() {
  const [data, setData] = useState<SimulationResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'consequential' | 'routine'>('all');

  useEffect(() => { loadResults().then(setData); }, []);

  if (!data) return (
    <div className="empty">
      <h3>No simulation data</h3>
      <p>Run <code>python main.py --scenario default --reasoning</code> first.</p>
    </div>
  );

  const filtered = data.hours.filter((h) =>
    filter === 'all' ? true : h.decision.classification === filter
  );

  const consequentialCount = data.hours.filter((h) => h.decision.classification === 'consequential').length;
  const routineCount = data.hours.length - consequentialCount;

  return (
    <>
      <div className="page-title">Collaboration Feed</div>
      <div className="page-sub">Agent communications — routine explanations inline, consequential decisions as approve/reject cards</div>

      {/* Summary */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="stat-value">{data.hours.length}</div>
          <div className="stat-label">Total decisions</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ color: 'var(--green)' }}>{routineCount}</div>
          <div className="stat-label">Routine (auto-applied)</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ color: 'var(--red)' }}>{consequentialCount}</div>
          <div className="stat-label">Consequential (operator review)</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'consequential', 'routine'] as const).map((f) => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Feed */}
      {filtered.map((r) => (
        <FeedCard
          key={r.hour}
          record={r}
          onApprove={(h) => console.log('Approved hour', h)}
          onReject={(h) => console.log('Rejected hour', h)}
        />
      ))}
    </>
  );
}
