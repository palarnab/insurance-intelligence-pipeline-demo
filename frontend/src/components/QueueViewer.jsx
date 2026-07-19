const STAT_ORDER = [
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
];

function ago(dateStr) {
  if (!dateStr) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function QueueViewer({ queue, onSelectDocument }) {
  const stats = queue?.stats || {};
  const jobs = queue?.jobs || [];

  return (
    <div className="queue-viewer">
      <div className="doc-list-header">
        <h2>Job Queue</h2>
        <span className="count">MongoDB polling</span>
      </div>

      <div className="queue-stats">
        {STAT_ORDER.map(({ key, label }) => (
          <div key={key} className={`qstat ${key}`}>
            <span className="qstat-num">{stats[key] ?? 0}</span>
            <span className="qstat-label">{label}</span>
          </div>
        ))}
      </div>

      <ul className="job-list">
        {jobs.length === 0 && <li className="empty">No jobs yet.</li>}
        {jobs.map((j) => {
          const name = j.data?.originalName || j.data?.documentId || String(j._id).slice(-6);
          const when = j.completedAt || j.failedAt || j.startedAt || j.availableAt || j.createdAt;
          return (
            <li
              key={j._id}
              className={`job-row ${j.data?.documentId ? 'clickable' : ''}`}
              onClick={() => j.data?.documentId && onSelectDocument?.(j.data.documentId)}
              title={j.error || ''}
            >
              <span className={`job-status ${j.status}`}>{j.status}</span>
              <span className="job-name">{name}</span>
              <span className="job-meta">
                {j.attempts > 0 && (
                  <span className={`job-attempts ${j.attempts > 1 ? 'retry' : ''}`}>
                    try {j.attempts}/{j.maxAttempts}
                  </span>
                )}
                <span className="job-time">{ago(when)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
