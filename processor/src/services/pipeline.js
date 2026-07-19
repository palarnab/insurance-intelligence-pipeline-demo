import { runOcr } from './textract.js';
import { runComprehend } from './comprehend.js';
import { runLlmAnalysis } from './bedrock.js';
import { severityWeight } from './mockData.js';
import { config } from '../config.js';
import { log } from '../logger.js';

function computeRiskScore(conflicts = []) {
  if (!conflicts.length) return 0;
  // Weighted, saturating score in [0, 100].
  const raw = conflicts.reduce((sum, c) => sum + severityWeight(c.severity) * 18, 0);
  return Math.min(100, raw);
}

// Runs the three-stage intelligence pipeline for a single document.
// `onStage(stage, patch)` is invoked before each stage so the caller can
// persist incremental progress to MongoDB (drives the live frontend status).
export async function analyzeDocument(job, onStage) {
  const { storagePath, mimeType, originalName, documentId } = job;
  const timings = {};
  const provider = config.useMock ? 'mock' : 'aws';

  // --- Stage 1: OCR (Textract) ---
  await onStage('ocr', { provider });
  log.stage(documentId, 'ocr', 'starting Textract');
  let t = Date.now();
  const ocr = await runOcr({ storagePath, mimeType, originalName });
  timings.ocrMs = Date.now() - t;
  log.stage(documentId, 'ocr', `done in ${timings.ocrMs}ms (${ocr.lineCount} lines)`);

  // --- Stage 2: NLP analysis (Comprehend) ---
  await onStage('comprehend', { ocr });
  log.stage(documentId, 'comprehend', 'starting Comprehend');
  t = Date.now();
  const comprehend = await runComprehend(ocr.text);
  timings.comprehendMs = Date.now() - t;
  log.stage(documentId, 'comprehend', `done in ${timings.comprehendMs}ms`);

  // --- Stage 3: structured extraction + conflict detection (Bedrock) ---
  await onStage('llm', { comprehend });
  log.stage(documentId, 'llm', 'starting Bedrock (Claude Sonnet 4.5)');
  t = Date.now();
  const llm = await runLlmAnalysis({ text: ocr.text, keyValues: ocr.keyValues, comprehend });
  timings.llmMs = Date.now() - t;

  const conflicts = Array.isArray(llm.conflicts) ? llm.conflicts : [];
  const riskScore = computeRiskScore(conflicts);
  log.stage(documentId, 'llm', `done in ${timings.llmMs}ms (${conflicts.length} conflicts, risk=${riskScore})`);

  const { conflicts: _c, summary, ...extraction } = llm;

  return {
    provider,
    ocr,
    comprehend,
    extraction,
    conflicts,
    riskScore,
    summary: summary || '',
    timings,
  };
}
