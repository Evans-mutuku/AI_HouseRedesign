// JSON Schemas for the three model calls.
//
// These are passed as `output_config.format` so the API constrains generation
// to the shape rather than us hoping a prompt was followed. That replaces the
// old "return ONLY JSON, no markdown" plea plus fence-stripping, and it is the
// documented replacement for assistant prefill, which current models reject.
//
// Strict-mode rules: every property must appear in `required`, and every object
// must set `additionalProperties: false`. Optional-in-spirit fields are
// therefore declared required and allowed to be an empty string or array -
// validate.js still normalises whatever arrives.
//
// Two constraint families are deliberately absent:
//
//   • Range keywords (`minimum` / `maximum`) are rejected outright by the API's
//     schema validator.
//   • `pattern` is accepted but each regex is compiled into the sampling
//     grammar, and a board this size overflows the compiler ("the compiled
//     grammar is too large").
//
// Both live in validate.js instead, which has to run anyway: coordinates are
// clamped to 0–1, amounts to >= 0, hex values are regex-checked and dropped if
// malformed, and item keys are slugified and de-duplicated. `enum` is cheap and
// stays - it is what keeps phases and actions inside the vocabulary the UI
// groups by.

const str = { type: 'string' };
const num = { type: 'number' };
const int = { type: 'integer' };

/** Object helper that enforces the strict-mode requirements automatically. */
const obj = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const arrayOf = (items) => ({ type: 'array', items });

/* ── 1. The room survey ──────────────────────────────────────────────────── */

export const SURVEY_SCHEMA = obj({
  roomType: str,
  cameraView: str,
  currentAssessment: str,
  architecture: arrayOf(
    obj({
      id: str,
      type: str,
      count: int,
      location: str,
      description: str,
    }),
  ),
  fixedFeatures: arrayOf(str),
  annotations: arrayOf(
    obj({
      x: num,
      y: num,
      title: str,
      note: str,
      severity: { type: 'string', enum: ['issue', 'asset'] },
    }),
  ),
});

/* ── 2. The design board ─────────────────────────────────────────────────── */

const PHASE = { type: 'string', enum: ['weekend', 'month', 'full'] };
const unit = num; // clamped to 0–1 in validate.js

export const BOARD_SCHEMA = obj({
  roomType: str,
  designConcept: str,
  revisionNote: str,
  palette: arrayOf(
    obj({
      name: str,
      hex: str, // "#RRGGBB"; verified in validate.js
      role: str,
    }),
  ),
  lighting: str,
  materials: arrayOf(obj({ name: str, where: str })),
  plan: arrayOf(
    obj({
      key: str, // kebab-case slug; normalised in validate.js
      action: { type: 'string', enum: ['keep', 'remove', 'add', 'move'] },
      item: str,
      rationale: str,
      phase: PHASE,
      costCents: int,
      effort: { type: 'string', enum: ['easy', 'moderate', 'trade'] },
    }),
  ),
  phases: arrayOf(obj({ id: PHASE, title: str, summary: str })),
  budgetSummary: obj({
    currency: str,
    totalCents: int,
    weekendCents: int,
    monthCents: int,
    fullCents: int,
    withinBudget: { type: 'boolean' },
    note: str,
  }),
  layoutNotes: str,
  decor: arrayOf(obj({ item: str, note: str })),
  shoppingList: arrayOf(
    obj({
      key: str, // matches a plan item's key where one exists
      item: str,
      costCents: int,
      phase: PHASE,
      note: str,
      searchQuery: str,
    }),
  ),
  imageDirection: str,
});

/* ── 2b. The floor plan ──────────────────────────────────────────────────── */
//
// Asked for separately. The board and the plan view together compile to a
// grammar the API rejects as too large, and splitting them is better anyway:
// the plan view only needs the survey and the finished furniture list, so it is
// a small, focused call that can fail without costing us the board.

export const FLOORPLAN_SCHEMA = obj({
  widthM: num,
  lengthM: num,
  confidence: { type: 'string', enum: ['measured', 'estimated'] },
  cameraAt: obj({ x: unit, y: unit }),
  features: arrayOf(obj({ type: str, label: str, x: unit, y: unit, w: unit, h: unit })),
  furniture: arrayOf(obj({ name: str, x: unit, y: unit, w: unit, h: unit })),
});

/* ── 3. The render fidelity check ────────────────────────────────────────── */

export const FIDELITY_SCHEMA = obj({
  ok: { type: 'boolean' },
  missing: arrayOf(
    obj({
      id: str,
      type: str,
      problem: {
        type: 'string',
        enum: ['removed', 'covered', 'moved', 'resized', 'altered'],
      },
      detail: str,
    }),
  ),
  notes: str,
});
