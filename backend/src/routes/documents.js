import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { enqueueJob } from '../services/jobs.js';
import { DocumentModel } from '../models/Document.js';
import { log } from '../logger.js';

if (!existsSync(config.uploadDir)) mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname) || '';
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    if (config.allowedMimeTypes.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: ${config.allowedMimeTypes.join(', ')}`));
  },
});

export const documentsRouter = Router();

// POST /api/documents  -> accept upload, persist metadata, enqueue processing
documentsRouter.post('/', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded. Use multipart field "document".' });
    }

    const documentId = path.parse(req.file.filename).name;
    const doc = await DocumentModel.create({
      documentId,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      storagePath: req.file.path,
      status: 'queued',
      stage: 'queued',
    });

    const job = await enqueueJob('process-document', {
      documentId,
      storagePath: req.file.path,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    doc.jobId = String(job._id);
    await doc.save();

    log.info(`Enqueued document ${documentId} (${req.file.originalname}) as job ${job._id}`);
    return res.status(202).json({
      success: true,
      message: 'Document accepted and enqueued for intelligence processing.',
      documentId,
      jobId: String(job._id),
      status: 'queued',
    });
  } catch (err) {
    log.error('Ingress failure', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/documents -> list (newest first, lightweight projection)
documentsRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const docs = await DocumentModel.find({}, {
    documentId: 1, originalName: 1, mimeType: 1, status: 1, stage: 1,
    provider: 1, riskScore: 1, 'conflicts': 1, 'extraction.documentType': 1,
    createdAt: 1, updatedAt: 1,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const items = docs.map((d) => ({
    ...d,
    conflictCount: Array.isArray(d.conflicts) ? d.conflicts.length : 0,
    conflicts: undefined,
  }));

  res.json({ success: true, count: items.length, items });
});

// GET /api/documents/:id -> full detail
documentsRouter.get('/:id', async (req, res) => {
  const doc = await DocumentModel.findOne({ documentId: req.params.id }).lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });
  res.json({ success: true, document: doc });
});

// GET /api/documents/:id/file -> download / preview the original upload
documentsRouter.get('/:id/file', async (req, res) => {
  const doc = await DocumentModel.findOne({ documentId: req.params.id }).lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });
  if (!doc.storagePath || !existsSync(doc.storagePath)) {
    return res.status(404).json({ success: false, error: 'Original file not available' });
  }
  res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
  res.sendFile(path.resolve(doc.storagePath));
});

// DELETE /api/documents/:id -> remove record and stored file (demo housekeeping)
documentsRouter.delete('/:id', async (req, res) => {
  const doc = await DocumentModel.findOneAndDelete({ documentId: req.params.id });
  if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });
  if (doc.storagePath && existsSync(doc.storagePath)) {
    await fs.unlink(doc.storagePath).catch(() => {});
  }
  res.json({ success: true, deleted: req.params.id });
});
