import { StatusBadge, RiskBadge } from './badges.jsx';

export default function DocumentList({ documents, selectedId, onSelect, onDelete }) {
  return (
    <div className="doc-list">
      <div className="doc-list-header">
        <h2>Documents</h2>
        <span className="count">{documents.length}</span>
      </div>
      {documents.length === 0 && <p className="empty">No documents yet. Upload one to begin.</p>}
      <ul>
        {documents.map((d) => (
          <li
            key={d.documentId}
            className={`doc-item ${selectedId === d.documentId ? 'active' : ''}`}
            onClick={() => onSelect(d.documentId)}
          >
            <div className="doc-item-main">
              <div className="doc-name" title={d.originalName}>{d.originalName || d.documentId}</div>
              <div className="doc-sub">
                <StatusBadge status={d.status} stage={d.stage} />
                {d.status === 'completed' && <RiskBadge score={d.riskScore} conflicts={d.conflictCount} />}
                {d.provider && <span className={`provider ${d.provider}`}>{d.provider}</span>}
              </div>
            </div>
            <button
              className="icon-btn"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(d.documentId);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
