import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { config } from '../config.js';
import { log } from '../logger.js';
import { mockBedrock } from './mockData.js';

let client;
function getClient() {
  if (!client) client = new BedrockRuntimeClient({ region: config.aws.region });
  return client;
}

const SYSTEM_PROMPT = `You are an insurance document intelligence engine. You read OCR'd insurance
documents (policies, declarations pages, claim forms, endorsements) and you do two jobs:
1. Extract the key structured fields.
2. Detect CONFLICTS and INCONSISTENCIES: internal contradictions, values that violate the
   policy's own rules, impossible dates, mismatched identifiers, claim amounts exceeding
   coverage limits, name/address mismatches, expired coverage on a claimed loss date, etc.

Respond with ONLY a single minified JSON object (no markdown, no prose) using exactly this shape:
{
  "documentType": string,
  "policyNumber": string|null,
  "insuredName": string|null,
  "effectiveDate": string|null,
  "expirationDate": string|null,
  "coverageAmount": string|null,
  "premium": string|null,
  "claimNumber": string|null,
  "claimAmount": string|null,
  "conflicts": [
    { "field": string, "type": string, "severity": "low"|"medium"|"high"|"critical",
      "description": string, "evidence": [string] }
  ],
  "summary": string
}
Use null for fields not present. If there are no conflicts, return an empty conflicts array.`;

function buildUserPrompt({ text, keyValues, comprehend }) {
  const kv = (keyValues || []).map((p) => `- ${p.key}: ${p.value}`).join('\n') || '(none extracted)';
  const entities = (comprehend?.entities || [])
    .map((e) => `${e.text} (${e.type})`)
    .slice(0, 25)
    .join(', ') || '(none)';
  return `DOCUMENT OCR TEXT:\n"""\n${text || '(empty)'}\n"""\n\n` +
    `TEXTRACT KEY/VALUE PAIRS:\n${kv}\n\n` +
    `COMPREHEND ENTITIES: ${entities}\n\n` +
    `Analyze the document and return the JSON described in your instructions.`;
}

function extractJson(str) {
  if (!str) throw new Error('Empty model response');
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model response');
  return JSON.parse(str.slice(start, end + 1));
}

export async function runLlmAnalysis({ text, keyValues, comprehend }) {
  if (config.useMock) {
    return mockBedrock({ text, keyValues });
  }

  const body = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [{ type: 'text', text: buildUserPrompt({ text, keyValues, comprehend }) }] }],
  };

  log.info(`Bedrock InvokeModel modelId=${config.aws.bedrockModelId}`);
  const resp = await getClient().send(
    new InvokeModelCommand({
      modelId: config.aws.bedrockModelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    })
  );

  const decoded = JSON.parse(new TextDecoder().decode(resp.body));
  const modelText = decoded?.content?.map((c) => c.text).join('') || '';
  const parsed = extractJson(modelText);

  parsed.conflicts = Array.isArray(parsed.conflicts) ? parsed.conflicts : [];
  log.info(`Bedrock analysis complete: ${parsed.conflicts.length} conflict(s) found`);
  return parsed;
}
