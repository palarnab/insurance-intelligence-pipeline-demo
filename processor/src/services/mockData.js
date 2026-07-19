// Deterministic mock implementations of Textract / Comprehend / Bedrock so the
// entire pipeline runs end-to-end without AWS credentials (USE_MOCK).
//
// The mock "LLM" is NOT random: it parses the Textract key/value pairs and OCR
// text and applies real conflict-detection logic (claim > coverage, out-of-term
// loss dates, mismatched identifiers, impossible date ranges). This keeps the
// offline demo faithful to what the real Bedrock model returns.

const CLEAN_AUTO_POLICY = {
  text: [
    'ACME MUTUAL INSURANCE COMPANY',
    'PERSONAL AUTOMOBILE POLICY DECLARATIONS',
    'Policy Number: POL-AUTO-8812',
    'Policy Type: Personal Auto - Owner',
    'Named Insured: Jordan A. Rivera',
    'Mailing Address: 148 Maple Street, Springfield, IL 62704',
    'Policy Effective Date: 01/01/2026',
    'Policy Expiration Date: 01/01/2027',
    'Vehicle: 2022 Toyota Camry LE  VIN: 4T1BF1FK5CU512345',
    'Bodily Injury Liability Limit: $100,000 each person / $300,000 each accident',
    'Property Damage Coverage Amount: $50,000',
    'Collision Deductible: $500',
    'Comprehensive Deductible: $250',
    'Annual Premium: $1,240.00',
    'Agent: R. Patel  License #IL-99231',
  ].join('\n'),
  keyValues: [
    { key: 'Policy Number', value: 'POL-AUTO-8812' },
    { key: 'Named Insured', value: 'Jordan A. Rivera' },
    { key: 'Policy Effective Date', value: '01/01/2026' },
    { key: 'Policy Expiration Date', value: '01/01/2027' },
    { key: 'Coverage Amount', value: '$50,000' },
    { key: 'Annual Premium', value: '$1,240.00' },
  ],
};

const CONFLICTING_HOME_CLAIM = {
  text: [
    'ACME MUTUAL INSURANCE COMPANY',
    'HOMEOWNERS PROPERTY LOSS CLAIM FORM',
    'Policy Number: POL-HOME-9901',
    'Claim Number: CLM-1044',
    'Named Insured: Dana Whitmore',
    'Claimant Name: Dana Whitmoore',
    'Insured Property Address: 77 Birchwood Lane, Peoria, IL 61604',
    'Policy Effective Date: 03/01/2025',
    'Policy Expiration Date: 03/01/2026',
    'Date of Loss: 04/15/2026',
    'Cause of Loss: Water damage from burst supply pipe',
    'Dwelling Coverage Amount: $50,000',
    'Amount Claimed: $85,000',
    'Adjuster Notes: Referenced policy POL-HOME-9910 in system of record.',
    'Annual Premium: $2,310.00',
  ].join('\n'),
  keyValues: [
    { key: 'Policy Number', value: 'POL-HOME-9901' },
    { key: 'Claim Number', value: 'CLM-1044' },
    { key: 'Named Insured', value: 'Dana Whitmore' },
    { key: 'Claimant Name', value: 'Dana Whitmoore' },
    { key: 'Policy Effective Date', value: '03/01/2025' },
    { key: 'Policy Expiration Date', value: '03/01/2026' },
    { key: 'Date of Loss', value: '04/15/2026' },
    { key: 'Coverage Amount', value: '$50,000' },
    { key: 'Amount Claimed', value: '$85,000' },
    { key: 'Annual Premium', value: '$2,310.00' },
  ],
};

const CONFLICTING_COMMERCIAL_POLICY = {
  text: [
    'ACME MUTUAL INSURANCE COMPANY',
    'COMMERCIAL PROPERTY POLICY DECLARATIONS',
    'Policy Number: POL-COMM-4420',
    'Named Insured: Northwind Logistics LLC',
    'Insured Premises: 9400 Industrial Parkway, Joliet, IL 60431',
    'Policy Effective Date: 06/01/2026',
    'Policy Expiration Date: 05/01/2026',
    'Building Coverage Amount: $2,000,000',
    'Business Interruption Limit: $500,000',
    'Annual Premium: $18,750.00',
    'Authorized Signature: On behalf of Northwind Logistic LLC',
    'Policy Number (endorsement): POL-COMM-4402',
  ].join('\n'),
  keyValues: [
    { key: 'Policy Number', value: 'POL-COMM-4420' },
    { key: 'Named Insured', value: 'Northwind Logistics LLC' },
    { key: 'Policy Effective Date', value: '06/01/2026' },
    { key: 'Policy Expiration Date', value: '05/01/2026' },
    { key: 'Coverage Amount', value: '$2,000,000' },
    { key: 'Annual Premium', value: '$18,750.00' },
  ],
};

const CLEAN_LIFE_POLICY = {
  text: [
    'ACME MUTUAL LIFE ASSURANCE COMPANY',
    'TERM LIFE INSURANCE POLICY DECLARATIONS',
    'Policy Number: POL-LIFE-3301',
    'Plan: 20-Year Level Term Life',
    'Named Insured: Priya S. Nandakumar',
    'Insured Date of Birth: 06/22/1988',
    'Mailing Address: 2210 Lakeview Terrace, Naperville, IL 60540',
    'Policy Effective Date: 02/01/2026',
    'Policy Expiration Date: 02/01/2046',
    'Death Benefit Coverage Amount: $500,000',
    'Primary Beneficiary: Arjun Nandakumar (Spouse)',
    'Annual Premium: $684.00',
    'Agent: L. Marchetti  License #IL-77420',
  ].join('\n'),
  keyValues: [
    { key: 'Policy Number', value: 'POL-LIFE-3301' },
    { key: 'Named Insured', value: 'Priya S. Nandakumar' },
    { key: 'Policy Effective Date', value: '02/01/2026' },
    { key: 'Policy Expiration Date', value: '02/01/2046' },
    { key: 'Coverage Amount', value: '$500,000' },
    { key: 'Annual Premium', value: '$684.00' },
  ],
};

const CONFLICTING_HEALTH_CLAIM = {
  text: [
    'ACME MUTUAL HEALTH PLANS, INC.',
    'MAJOR MEDICAL EXPENSE CLAIM FORM',
    'Policy Number: POL-HLTH-7725',
    'Claim Number: CLM-2087',
    'Named Insured: Marcus D. Halloway',
    'Claimant Name: Marcus D. Hallowday',
    'Member ID: AMH-4471902',
    'Policy Effective Date: 01/01/2026',
    'Policy Expiration Date: 12/31/2026',
    'Date of Service: 05/09/2026',
    'Provider Name: Riverside Regional Medical Center',
    'Annual Benefit Coverage Amount: $25,000',
    'Amount Claimed: $42,000',
    'Examiner Notes: Policy of record listed as POL-HLTH-7752 in the eligibility system.',
    'Annual Premium: $6,540.00',
  ].join('\n'),
  keyValues: [
    { key: 'Policy Number', value: 'POL-HLTH-7725' },
    { key: 'Claim Number', value: 'CLM-2087' },
    { key: 'Named Insured', value: 'Marcus D. Halloway' },
    { key: 'Claimant Name', value: 'Marcus D. Hallowday' },
    { key: 'Policy Effective Date', value: '01/01/2026' },
    { key: 'Policy Expiration Date', value: '12/31/2026' },
    { key: 'Coverage Amount', value: '$25,000' },
    { key: 'Amount Claimed', value: '$42,000' },
    { key: 'Annual Premium', value: '$6,540.00' },
  ],
};

const CONFLICTING_UMBRELLA_POLICY = {
  text: [
    'ACME MUTUAL INSURANCE COMPANY',
    'PERSONAL UMBRELLA LIABILITY POLICY DECLARATIONS',
    'Policy Number: POL-UMB-6600',
    'Named Insured: Rivera Family Trust',
    'Trustee: Jordan A. Rivera',
    'Mailing Address: 148 Maple Street, Springfield, IL 62704',
    'Policy Effective Date: 07/01/2026',
    'Policy Expiration Date: 04/01/2026',
    'Each Occurrence Coverage Amount: $1,000,000',
    'Aggregate Limit: $1,000,000',
    'Annual Premium: $465.00',
    'Authorized Signature: On behalf of Rivera Family Trst',
    'Policy Number (endorsement): POL-UMB-6060',
  ].join('\n'),
  keyValues: [
    { key: 'Policy Number', value: 'POL-UMB-6600' },
    { key: 'Named Insured', value: 'Rivera Family Trust' },
    { key: 'Policy Effective Date', value: '07/01/2026' },
    { key: 'Policy Expiration Date', value: '04/01/2026' },
    { key: 'Coverage Amount', value: '$1,000,000' },
    { key: 'Annual Premium', value: '$465.00' },
  ],
};

function pickTemplate(originalName = '') {
  const n = originalName.toLowerCase();
  if (n.includes('life')) return CLEAN_LIFE_POLICY;
  if (n.includes('health') || n.includes('medical') || n.includes('hlth')) return CONFLICTING_HEALTH_CLAIM;
  if (n.includes('umbrella') || n.includes('umb')) return CONFLICTING_UMBRELLA_POLICY;
  if (n.includes('clean') || (n.includes('auto') && !n.includes('conflict'))) return CLEAN_AUTO_POLICY;
  if (n.includes('claim') || n.includes('home')) return CONFLICTING_HOME_CLAIM;
  if (n.includes('commercial') || n.includes('comm') || n.includes('policy')) return CONFLICTING_COMMERCIAL_POLICY;
  return CONFLICTING_HOME_CLAIM;
}

export function mockOcrForDocument(originalName) {
  const tpl = pickTemplate(originalName);
  const lines = tpl.text.split('\n');
  return {
    text: tpl.text,
    lineCount: lines.length,
    keyValues: tpl.keyValues,
    rawBlockCount: lines.length * 6 + tpl.keyValues.length * 3,
  };
}

export function mockComprehend(text = '') {
  const entities = [];
  const push = (re, type) => {
    const m = text.match(re);
    if (m) entities.push({ text: m[1] || m[0], type, score: 0.98 });
  };
  push(/Named Insured:\s*(.+)/, 'PERSON');
  push(/Policy Number:\s*(\S+)/, 'OTHER');
  push(/\$[\d,]+(?:\.\d{2})?/, 'QUANTITY');
  push(/\b\d{2}\/\d{2}\/\d{4}\b/, 'DATE');
  push(/([A-Z][a-z]+,\s*[A-Z]{2}\s*\d{5})/, 'LOCATION');

  const containsAddress = /\d+\s+\w+\s+(Street|St|Ave|Avenue|Road|Rd)/i.test(text);
  return {
    dominantLanguage: 'en',
    sentiment: 'NEUTRAL',
    entities,
    piiEntities: containsAddress
      ? [{ type: 'ADDRESS', score: 0.97 }, { type: 'NAME', score: 0.99 }]
      : [{ type: 'NAME', score: 0.99 }],
    keyPhrases: ['policy declarations', 'coverage amount', 'named insured', 'annual premium'].filter(() => true),
    containsPii: true,
  };
}

// ----- mock "LLM" conflict detection ---------------------------------------
const toNumber = (s) => (s ? Number(String(s).replace(/[^0-9.]/g, '')) : NaN);
const toDate = (s) => {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
};

function kvMap(keyValues = []) {
  const map = {};
  for (const { key, value } of keyValues) map[key.toLowerCase().replace(/[^a-z]/g, '')] = value;
  return map;
}

export function mockBedrock({ text = '', keyValues = [] }) {
  const m = kvMap(keyValues);
  const conflicts = [];

  const coverage = toNumber(m.coverageamount);
  const claim = toNumber(m.amountclaimed);
  if (!Number.isNaN(coverage) && !Number.isNaN(claim) && claim > coverage) {
    conflicts.push({
      field: 'Amount Claimed',
      type: 'coverage_violation',
      severity: 'critical',
      description: `Claimed amount ($${claim.toLocaleString()}) exceeds the coverage limit ($${coverage.toLocaleString()}).`,
      evidence: [`Coverage Amount: ${m.coverageamount}`, `Amount Claimed: ${m.amountclaimed}`],
    });
  }

  const eff = toDate(m.policyeffectivedate);
  const exp = toDate(m.policyexpirationdate);
  const loss = toDate(m.dateofloss);
  if (eff && exp && exp <= eff) {
    conflicts.push({
      field: 'Policy Expiration Date',
      type: 'date_inconsistency',
      severity: 'high',
      description: 'Policy expiration date is on or before the effective date, which is impossible.',
      evidence: [`Effective: ${m.policyeffectivedate}`, `Expiration: ${m.policyexpirationdate}`],
    });
  }
  if (loss && eff && exp && (loss < eff || loss > exp)) {
    conflicts.push({
      field: 'Date of Loss',
      type: 'coverage_date_violation',
      severity: 'high',
      description: 'Date of loss falls outside the policy coverage period.',
      evidence: [`Date of Loss: ${m.dateofloss}`, `Coverage: ${m.policyeffectivedate} - ${m.policyexpirationdate}`],
    });
  }

  const policyNumbers = [...text.matchAll(/POL-[A-Z]+-\d+/g)].map((x) => x[0]);
  const distinct = [...new Set(policyNumbers)];
  if (distinct.length > 1) {
    conflicts.push({
      field: 'Policy Number',
      type: 'identifier_mismatch',
      severity: 'high',
      description: `Multiple different policy numbers appear in the document: ${distinct.join(', ')}.`,
      evidence: distinct,
    });
  }

  const insured = m.namedinsured;
  const claimant = m.claimantname;
  if (insured && claimant && insured.trim().toLowerCase() !== claimant.trim().toLowerCase()) {
    conflicts.push({
      field: 'Claimant Name',
      type: 'name_mismatch',
      severity: 'medium',
      description: `Named insured ("${insured}") does not match claimant ("${claimant}"). Possible typo or unauthorized claimant.`,
      evidence: [`Named Insured: ${insured}`, `Claimant Name: ${claimant}`],
    });
  }

  const sigMatch = text.match(/on behalf of\s+(.+)/i);
  if (insured && sigMatch) {
    const sig = sigMatch[1].trim().replace(/\.$/, '');
    if (sig.toLowerCase() !== insured.trim().toLowerCase()) {
      conflicts.push({
        field: 'Authorized Signature',
        type: 'name_mismatch',
        severity: 'low',
        description: `Signature entity ("${sig}") differs from the named insured ("${insured}").`,
        evidence: [`Named Insured: ${insured}`, `Signature: ${sig}`],
      });
    }
  }

  const documentType = /term life|life insurance/i.test(text)
    ? 'Term Life Policy Declarations'
    : /major medical|health plan/i.test(text)
      ? 'Major Medical Claim Form'
      : /umbrella/i.test(text)
        ? 'Personal Umbrella Declarations'
        : /claim/i.test(text)
          ? 'Homeowners Claim Form'
          : /commercial/i.test(text)
            ? 'Commercial Property Declarations'
            : 'Automobile Policy Declarations';

  const summary = conflicts.length === 0
    ? `${documentType} parsed cleanly. No internal conflicts detected across identifiers, dates, or coverage limits.`
    : `${documentType} contains ${conflicts.length} conflict(s). Highest severity: ${conflicts
        .map((c) => c.severity)
        .sort((a, b) => severityWeight(b) - severityWeight(a))[0]}. Manual review recommended.`;

  return {
    documentType,
    policyNumber: distinct[0] || m.policynumber || null,
    insuredName: insured || null,
    effectiveDate: m.policyeffectivedate || null,
    expirationDate: m.policyexpirationdate || null,
    coverageAmount: m.coverageamount || null,
    premium: m.annualpremium || null,
    claimNumber: m.claimnumber || null,
    claimAmount: m.amountclaimed || null,
    conflicts,
    summary,
  };
}

export function severityWeight(s) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[s] || 0;
}
