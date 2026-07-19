const STAGE_LABEL = {
  queued: 'Queued',
  ocr: 'OCR (Textract)',
  comprehend: 'NLP (Comprehend)',
  llm: 'LLM (Bedrock)',
  persist: 'Saving',
  done: 'Done',
  error: 'Error',
};

export function StatusBadge({ status, stage }) {
  if (status === 'processing') {
    return (
      <span className="badge processing">
        <span className="spinner" /> {STAGE_LABEL[stage] || 'Processing'}
      </span>
    );
  }
  const cls = { queued: 'queued', completed: 'completed', failed: 'failed' }[status] || 'queued';
  const label = { queued: 'Queued', completed: 'Completed', failed: 'Failed' }[status] || status;
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function riskTier(score = 0) {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'high';
  if (score > 0) return 'medium';
  return 'clear';
}

export function RiskBadge({ score = 0, conflicts = 0 }) {
  const tier = riskTier(score);
  const label = tier === 'clear' ? 'No conflicts' : `${conflicts} conflict${conflicts === 1 ? '' : 's'} · risk ${score}`;
  return <span className={`badge risk ${tier}`}>{label}</span>;
}

export function SeverityBadge({ severity }) {
  return <span className={`sev ${severity}`}>{severity}</span>;
}
