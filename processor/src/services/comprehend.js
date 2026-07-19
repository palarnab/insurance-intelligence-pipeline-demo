import {
  ComprehendClient,
  DetectEntitiesCommand,
  DetectPiiEntitiesCommand,
  DetectKeyPhrasesCommand,
  DetectSentimentCommand,
  DetectDominantLanguageCommand,
} from '@aws-sdk/client-comprehend';
import { config } from '../config.js';
import { log } from '../logger.js';
import { mockComprehend } from './mockData.js';

let client;
function getClient() {
  if (!client) client = new ComprehendClient({ region: config.aws.region });
  return client;
}

// Comprehend sync APIs accept up to 5000 UTF-8 bytes per call.
const MAX_BYTES = 4800;
function clamp(text) {
  const buf = Buffer.from(text || '', 'utf8');
  if (buf.length <= MAX_BYTES) return text || '';
  return buf.subarray(0, MAX_BYTES).toString('utf8');
}

export async function runComprehend(rawText) {
  if (config.useMock) {
    return mockComprehend(rawText);
  }

  const text = clamp(rawText);
  if (!text.trim()) {
    return { dominantLanguage: 'en', sentiment: 'NEUTRAL', entities: [], piiEntities: [], keyPhrases: [], containsPii: false };
  }

  const c = getClient();

  const langResp = await c.send(new DetectDominantLanguageCommand({ Text: text })).catch(() => null);
  const dominantLanguage = langResp?.Languages?.[0]?.LanguageCode || 'en';

  const [entitiesResp, piiResp, keyPhrasesResp, sentimentResp] = await Promise.all([
    c.send(new DetectEntitiesCommand({ Text: text, LanguageCode: dominantLanguage })),
    c.send(new DetectPiiEntitiesCommand({ Text: text, LanguageCode: dominantLanguage })),
    c.send(new DetectKeyPhrasesCommand({ Text: text, LanguageCode: dominantLanguage })),
    c.send(new DetectSentimentCommand({ Text: text, LanguageCode: dominantLanguage })),
  ]);

  const entities = (entitiesResp.Entities || [])
    .map((e) => ({ text: e.Text, type: e.Type, score: Number((e.Score || 0).toFixed(3)) }))
    .slice(0, 40);

  const piiEntities = (piiResp.Entities || [])
    .map((e) => ({ type: e.Type, score: Number((e.Score || 0).toFixed(3)) }))
    .slice(0, 40);

  const keyPhrases = (keyPhrasesResp.KeyPhrases || []).map((k) => k.Text).slice(0, 25);

  const result = {
    dominantLanguage,
    sentiment: sentimentResp.Sentiment || 'NEUTRAL',
    entities,
    piiEntities,
    keyPhrases,
    containsPii: piiEntities.length > 0,
  };

  log.info(`Comprehend: ${entities.length} entities, ${piiEntities.length} PII, sentiment=${result.sentiment}`);
  return result;
}
