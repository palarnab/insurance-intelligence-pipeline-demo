import fs from 'node:fs/promises';
import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';
import { PDFDocument } from 'pdf-lib';
import { config } from '../config.js';
import { log } from '../logger.js';
import { mockOcrForDocument } from './mockData.js';

let client;
function getClient() {
  if (!client) client = new TextractClient({ region: config.aws.region });
  return client;
}

// Rebuild plain text (LINE blocks) and KEY/VALUE form pairs from Textract's
// flat block graph.
function parseAnalyzeDocument(blocks) {
  const byId = new Map(blocks.map((b) => [b.Id, b]));

  const textOf = (block) => {
    if (!block.Relationships) return '';
    const parts = [];
    for (const rel of block.Relationships) {
      if (rel.Type !== 'CHILD') continue;
      for (const childId of rel.Ids) {
        const child = byId.get(childId);
        if (!child) continue;
        if (child.BlockType === 'WORD') parts.push(child.Text);
        else if (child.BlockType === 'SELECTION_ELEMENT' && child.SelectionStatus === 'SELECTED') {
          parts.push('[X]');
        }
      }
    }
    return parts.join(' ');
  };

  const lines = blocks.filter((b) => b.BlockType === 'LINE').map((b) => b.Text).filter(Boolean);

  const keyValues = [];
  for (const block of blocks) {
    if (block.BlockType !== 'KEY_VALUE_SET' || !block.EntityTypes?.includes('KEY')) continue;
    const key = textOf(block);
    let value = '';
    const valueRel = block.Relationships?.find((r) => r.Type === 'VALUE');
    if (valueRel) {
      for (const valueId of valueRel.Ids) {
        const valueBlock = byId.get(valueId);
        if (valueBlock) value += textOf(valueBlock);
      }
    }
    if (key) keyValues.push({ key: key.trim(), value: value.trim() });
  }

  return {
    text: lines.join('\n'),
    lineCount: lines.length,
    keyValues,
    rawBlockCount: blocks.length,
  };
}

export async function runOcr({ storagePath, mimeType, originalName }) {
  if (config.useMock) {
    return mockOcrForDocument(originalName);
  }

  const bytes = await fs.readFile(storagePath);

  // Synchronous Textract (AnalyzeDocument with inline Bytes) only accepts a
  // single-page document. Multi-page PDFs are split locally and each page is
  // analyzed in turn, then the block graphs are merged (Textract block Ids are
  // unique per response, so relationships stay intact after concatenation).
  const pages = await splitPdfPages(bytes, mimeType);
  log.info(
    `Textract AnalyzeDocument on ${originalName} (${bytes.length} bytes, ${mimeType}, ${pages.length} page${pages.length === 1 ? '' : 's'})`
  );

  const allBlocks = [];
  for (let i = 0; i < pages.length; i++) {
    const resp = await getClient().send(
      new AnalyzeDocumentCommand({
        Document: { Bytes: pages[i] },
        FeatureTypes: ['FORMS'],
      })
    );
    if (Array.isArray(resp.Blocks)) allBlocks.push(...resp.Blocks);
    if (pages.length > 1) log.info(`  page ${i + 1}/${pages.length}: ${resp.Blocks?.length || 0} blocks`);
  }

  const parsed = parseAnalyzeDocument(allBlocks);
  log.info(`Textract returned ${parsed.rawBlockCount} blocks, ${parsed.lineCount} lines, ${parsed.keyValues.length} key/value pairs`);
  return parsed;
}

// Returns an array of single-page document byte buffers. Non-PDF documents
// (JPEG/PNG/single-page TIFF) and single-page PDFs are returned unchanged.
async function splitPdfPages(bytes, mimeType) {
  const isPdf = (mimeType || '').includes('pdf');
  if (!isPdf) return [bytes];

  let src;
  try {
    src = await PDFDocument.load(bytes);
  } catch (err) {
    // If it can't be parsed as a PDF, let Textract handle the original bytes.
    log.warn(`Could not parse PDF for page splitting (${err.message}); sending as-is.`);
    return [bytes];
  }

  const pageCount = src.getPageCount();
  if (pageCount <= 1) return [bytes];

  const pages = [];
  for (let i = 0; i < pageCount; i++) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(src, [i]);
    single.addPage(copied);
    pages.push(Buffer.from(await single.save()));
  }
  return pages;
}
