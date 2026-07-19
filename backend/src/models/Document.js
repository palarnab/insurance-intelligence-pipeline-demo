import mongoose from 'mongoose';

const ConflictSchema = new mongoose.Schema(
  {
    field: String,
    type: String, // e.g. "amount_mismatch", "date_inconsistency", "coverage_violation"
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    description: String,
    evidence: [String],
  },
  { _id: false }
);

// Explicit sub-schemas avoid Mongoose's "type" keyword ambiguity for inline
// object array definitions.
const KeyValueSchema = new mongoose.Schema({ key: String, value: String }, { _id: false });
const EntitySchema = new mongoose.Schema({ text: String, type: String, score: Number }, { _id: false });
const PiiSchema = new mongoose.Schema({ type: String, score: Number }, { _id: false });

const DocumentSchema = new mongoose.Schema(
  {
    documentId: { type: String, required: true, unique: true, index: true },
    originalName: String,
    mimeType: String,
    sizeBytes: Number,
    storagePath: String,

    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    stage: {
      type: String,
      enum: ['queued', 'ocr', 'comprehend', 'llm', 'persist', 'done', 'error'],
      default: 'queued',
    },
    jobId: String,
    provider: { type: String, enum: ['aws', 'mock'], default: 'mock' },

    // Stage 1 - Textract OCR
    ocr: {
      text: String,
      lineCount: Number,
      keyValues: [KeyValueSchema],
      rawBlockCount: Number,
    },

    // Stage 2 - Comprehend analysis
    comprehend: {
      dominantLanguage: String,
      sentiment: String,
      entities: [EntitySchema],
      piiEntities: [PiiSchema],
      keyPhrases: [String],
      containsPii: Boolean,
    },

    // Stage 3 - Bedrock (Claude Sonnet 4.5) structured extraction + conflict detection
    extraction: {
      documentType: String,
      policyNumber: String,
      insuredName: String,
      effectiveDate: String,
      expirationDate: String,
      coverageAmount: String,
      premium: String,
      claimNumber: String,
      claimAmount: String,
      fields: mongoose.Schema.Types.Mixed,
    },
    conflicts: [ConflictSchema],
    riskScore: Number, // 0-100 aggregate risk from detected conflicts
    summary: String,

    error: String,
    timings: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const DocumentModel = mongoose.model('Document', DocumentSchema);
