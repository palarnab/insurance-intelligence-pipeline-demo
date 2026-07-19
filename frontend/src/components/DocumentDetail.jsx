import { useState } from 'react';
import { StatusBadge, RiskBadge, SeverityBadge, riskTier } from './badges.jsx';

export default function DocumentDetail({ document: doc }) {
  const [tab, setTab] = useState('overview');

  if (!doc) {
    return (
      <div className="detail empty-detail">
        <div className="empty-illustration">🔍</div>
        <p>Select a document to see extracted fields, detected conflicts and NLP analysis.</p>
      </div>
    );
  }

  const conflicts = doc.conflicts || [];
  const isProcessing = doc.status === 'processing' || doc.status === 'queued';

  return (
    <div className="detail">
      <div className="detail-header">
        <div>
          <h2 title={doc.originalName}>{doc.originalName || doc.documentId}</h2>
          <div className="detail-meta">
            <StatusBadge status={doc.status} stage={doc.stage} />
            {doc.status === 'completed' && <RiskBadge score={doc.riskScore} conflicts={conflicts.length} />}
            {doc.provider && <span className={`provider ${doc.provider}`}>via {doc.provider}</span>}
          </div>
        </div>
      </div>

      {isProcessing && <PipelineProgress stage={doc.stage} />}
      {doc.status === 'failed' && <div className="banner error">Processing failed: {doc.error}</div>}

      <nav className="tabs">
        {['overview', 'conflicts', 'ocr', 'nlp'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'nlp' ? 'NLP' : t[0].toUpperCase() + t.slice(1)}
            {t === 'conflicts' && conflicts.length > 0 && <span className="tab-count">{conflicts.length}</span>}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === 'overview' && <Overview doc={doc} conflicts={conflicts} />}
        {tab === 'conflicts' && <Conflicts conflicts={conflicts} />}
        {tab === 'ocr' && <Ocr ocr={doc.ocr} />}
        {tab === 'nlp' && <Nlp comprehend={doc.comprehend} />}
      </div>
    </div>
  );
}

function PipelineProgress({ stage }) {
  const steps = [
    { key: 'ocr', label: 'Textract OCR' },
    { key: 'comprehend', label: 'Comprehend NLP' },
    { key: 'llm', label: 'Bedrock LLM' },
    { key: 'done', label: 'Complete' },
  ];
  const order = ['queued', 'ocr', 'comprehend', 'llm', 'persist', 'done'];
  const current = order.indexOf(stage);
  return (
    <div className="pipeline">
      {steps.map((s) => {
        const idx = order.indexOf(s.key);
        const state = current > idx ? 'done' : current === idx ? 'active' : 'todo';
        return (
          <div key={s.key} className={`pipe-step ${state}`}>
            <span className="pipe-dot" />
            <span>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Overview({ doc, conflicts }) {
  const e = doc.extraction || {};
  const fields = [
    ['Document type', e.documentType],
    ['Policy number', e.policyNumber],
    ['Insured name', e.insuredName],
    ['Effective date', e.effectiveDate],
    ['Expiration date', e.expirationDate],
    ['Coverage amount', e.coverageAmount],
    ['Premium', e.premium],
    ['Claim number', e.claimNumber],
    ['Claim amount', e.claimAmount],
  ].filter(([, v]) => v);

  return (
    <div className="overview">
      {doc.summary && (
        <div className={`summary-card ${riskTier(doc.riskScore)}`}>
          <h3>Analyst summary</h3>
          <p>{doc.summary}</p>
        </div>
      )}
      <div className="field-grid">
        {fields.length === 0 && <p className="empty">No structured fields extracted yet.</p>}
        {fields.map(([k, v]) => (
          <div className="field" key={k}>
            <span className="field-key">{k}</span>
            <span className="field-val">{v}</span>
          </div>
        ))}
      </div>
      {conflicts.length > 0 && (
        <div className="conflict-preview">
          <h3>Top conflicts</h3>
          {conflicts.slice(0, 3).map((c, i) => (
            <div key={i} className="conflict-line">
              <SeverityBadge severity={c.severity} /> {c.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Conflicts({ conflicts }) {
  if (!conflicts.length) return <p className="empty ok">No conflicts detected. Document is internally consistent.</p>;
  return (
    <div className="conflicts">
      {conflicts.map((c, i) => (
        <div key={i} className={`conflict-card ${c.severity}`}>
          <div className="conflict-top">
            <SeverityBadge severity={c.severity} />
            <span className="conflict-field">{c.field}</span>
            <span className="conflict-type">{c.type}</span>
          </div>
          <p className="conflict-desc">{c.description}</p>
          {c.evidence?.length > 0 && (
            <ul className="evidence">
              {c.evidence.map((ev, j) => (
                <li key={j}><code>{ev}</code></li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function Ocr({ ocr }) {
  if (!ocr?.text) return <p className="empty">OCR output not available yet.</p>;
  return (
    <div className="ocr">
      <div className="ocr-stats">
        <span>{ocr.lineCount} lines</span>
        <span>{ocr.keyValues?.length || 0} key/value pairs</span>
        <span>{ocr.rawBlockCount} blocks</span>
      </div>
      {ocr.keyValues?.length > 0 && (
        <div className="kv-table">
          {ocr.keyValues.map((kv, i) => (
            <div className="kv-row" key={i}>
              <span className="kv-key">{kv.key}</span>
              <span className="kv-val">{kv.value}</span>
            </div>
          ))}
        </div>
      )}
      <pre className="ocr-text">{ocr.text}</pre>
    </div>
  );
}

function Nlp({ comprehend: c }) {
  if (!c) return <p className="empty">NLP analysis not available yet.</p>;
  return (
    <div className="nlp">
      <div className="nlp-row">
        <span className="chip">Language: {c.dominantLanguage}</span>
        <span className="chip">Sentiment: {c.sentiment}</span>
        <span className={`chip ${c.containsPii ? 'warn' : ''}`}>
          {c.containsPii ? 'PII detected' : 'No PII'}
        </span>
      </div>

      {c.piiEntities?.length > 0 && (
        <>
          <h4>PII entities</h4>
          <div className="tag-cloud">
            {c.piiEntities.map((p, i) => (
              <span key={i} className="tag pii">{p.type} <em>{Math.round(p.score * 100)}%</em></span>
            ))}
          </div>
        </>
      )}

      <h4>Entities</h4>
      <div className="tag-cloud">
        {(c.entities || []).map((e, i) => (
          <span key={i} className="tag">{e.text} <em>{e.type}</em></span>
        ))}
        {(!c.entities || c.entities.length === 0) && <p className="empty">None</p>}
      </div>

      {c.keyPhrases?.length > 0 && (
        <>
          <h4>Key phrases</h4>
          <div className="tag-cloud">
            {c.keyPhrases.map((k, i) => (
              <span key={i} className="tag subtle">{k}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
