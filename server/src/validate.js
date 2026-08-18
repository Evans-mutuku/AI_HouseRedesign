// Lightweight, dependency-free validation + normalization for what Claude
// returns. We are defensive: the model is instructed to return an exact shape,
// but we coerce and repair the obvious cases and reject only what is
// structurally unusable, so the client always gets a clean board.
//
// Two shapes are validated here: the room survey (validateSurvey) and the
// design board (validateBoard).

const VALID_ACTIONS = new Set(['keep', 'remove', 'add', 'move']);
const VALID_PHASES = ['weekend', 'month', 'full'];
const PHASE_SET = new Set(VALID_PHASES);
const VALID_EFFORT = new Set(['easy', 'moderate', 'trade']);
const VALID_SEVERITY = new Set(['issue', 'asset']);
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);
const int = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
/** Clamp to 0–1; used for every normalised coordinate. */
const unit = (v, fallback = 0) => Math.min(1, Math.max(0, num(v, fallback)));

/** Stable kebab-case key, used when the model forgets to supply one. */
function slug(text, index) {
  const base = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || `item-${index + 1}`;
}

/** Ensure every key in a list is unique, since the checklist is keyed by it. */
function uniqueKeys(items) {
  const seen = new Set();
  return items.map((item, i) => {
    let key = item.key || slug(item.item, i);
    if (seen.has(key)) {
      let n = 2;
      while (seen.has(`${key}-${n}`)) n += 1;
      key = `${key}-${n}`;
    }
    seen.add(key);
    return { ...item, key };
  });
}

const phaseOf = (v) => (PHASE_SET.has(str(v).toLowerCase()) ? str(v).toLowerCase() : 'month');

/* ── The room survey ─────────────────────────────────────────────────────── */

function normArchitecture(raw) {
  return arr(raw)
    .map((a, i) => ({
      id: str(a?.id) || `feature-${i + 1}`,
      type: str(a?.type).toLowerCase() || 'feature',
      count: Math.max(1, int(a?.count) || 1),
      location: str(a?.location),
      description: str(a?.description),
    }))
    .filter((a) => a.type && (a.location || a.description))
    .slice(0, 30);
}

function normAnnotations(raw) {
  return arr(raw)
    .map((a) => ({
      x: unit(a?.x, 0.5),
      y: unit(a?.y, 0.5),
      title: str(a?.title),
      note: str(a?.note),
      severity: VALID_SEVERITY.has(str(a?.severity)) ? str(a.severity) : 'issue',
    }))
    .filter((a) => a.title)
    .slice(0, 8);
}

export function validateSurvey(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new ValidationError('survey was not a JSON object');
  }
  const survey = {
    roomType: str(obj.roomType) || 'Room',
    cameraView: str(obj.cameraView),
    currentAssessment: str(obj.currentAssessment),
    architecture: normArchitecture(obj.architecture),
    fixedFeatures: arr(obj.fixedFeatures).map(str).filter(Boolean).slice(0, 12),
    annotations: normAnnotations(obj.annotations),
  };
  // The architecture list is the whole point of this call — a survey without
  // one would let the render prompt fall back to a vague "preserve everything",
  // which is exactly the failure mode we are engineering away.
  if (!survey.architecture.length) {
    throw new ValidationError('survey listed no architectural features');
  }
  return survey;
}

/* ── The design board ────────────────────────────────────────────────────── */

function normPalette(raw) {
  const palette = arr(raw)
    .map((c) => ({
      name: str(c?.name),
      hex: str(c?.hex).toLowerCase(),
      role: str(c?.role),
    }))
    .filter((c) => HEX_RE.test(c.hex));
  if (palette.length < 4) {
    throw new ValidationError(
      `palette must contain at least 4 valid hex colors (got ${palette.length})`,
    );
  }
  return palette.slice(0, 6);
}

function normPlan(raw) {
  const items = arr(raw)
    .map((f, i) => {
      const action = VALID_ACTIONS.has(str(f?.action).toLowerCase())
        ? str(f.action).toLowerCase()
        : 'add';
      return {
        key: str(f?.key),
        action,
        item: str(f?.item),
        rationale: str(f?.rationale),
        phase: phaseOf(f?.phase),
        // Only an "add" can cost anything; a kept or removed piece costing
        // money would quietly corrupt the budget totals.
        costCents: action === 'add' ? Math.max(0, int(f?.costCents)) : 0,
        effort: VALID_EFFORT.has(str(f?.effort)) ? str(f.effort) : 'moderate',
        _i: i,
      };
    })
    .filter((f) => f.item);
  return uniqueKeys(items).map(({ _i, ...rest }) => rest);
}

function normShopping(raw) {
  const items = arr(raw)
    .map((s, i) => ({
      key: str(s?.key),
      item: str(s?.item),
      costCents: Math.max(0, int(s?.costCents)),
      phase: phaseOf(s?.phase),
      note: str(s?.note),
      searchQuery: str(s?.searchQuery) || str(s?.item),
      _i: i,
    }))
    .filter((s) => s.item);
  return uniqueKeys(items).map(({ _i, ...rest }) => rest);
}

function normMaterials(raw) {
  return arr(raw)
    .map((m) => ({ name: str(m?.name), where: str(m?.where) }))
    .filter((m) => m.name);
}

function normDecor(raw) {
  // Loosely specified upstream; accept strings or {item,note} objects.
  return arr(raw)
    .map((d) => {
      if (typeof d === 'string') return { item: d.trim(), note: '' };
      return { item: str(d?.item), note: str(d?.note) };
    })
    .filter((d) => d.item);
}

function normPhases(raw, plan) {
  const given = new Map(
    arr(raw)
      .map((p) => [str(p?.id).toLowerCase(), p])
      .filter(([id]) => PHASE_SET.has(id)),
  );
  const fallbackTitles = {
    weekend: 'This weekend',
    month: 'This month',
    full: 'The full direction',
  };
  // Only surface phases that actually have work in them.
  const used = new Set(plan.map((p) => p.phase));
  return VALID_PHASES.filter((id) => used.has(id)).map((id) => ({
    id,
    title: str(given.get(id)?.title) || fallbackTitles[id],
    summary: str(given.get(id)?.summary),
  }));
}

/**
 * Recompute the budget from the line items rather than trusting the model's
 * arithmetic. The model is good at pricing a sofa and bad at adding up twenty
 * numbers, and a total that disagrees with the list it sits under destroys
 * confidence in the whole board.
 */
function computeBudget(raw, plan, shoppingList, budgetCents, currency) {
  // A shopping row that shares a key with an "add" plan row is the same
  // purchase described twice — count it once.
  const planKeys = new Set(plan.filter((p) => p.action === 'add').map((p) => p.key));
  const lines = [
    ...plan.filter((p) => p.action === 'add'),
    ...shoppingList.filter((s) => !planKeys.has(s.key)),
  ];

  const byPhase = { weekend: 0, month: 0, full: 0 };
  for (const line of lines) byPhase[line.phase] += line.costCents;
  const totalCents = byPhase.weekend + byPhase.month + byPhase.full;

  return {
    currency: str(raw?.currency).toUpperCase() || currency || 'USD',
    totalCents,
    weekendCents: byPhase.weekend,
    monthCents: byPhase.month,
    fullCents: byPhase.full,
    budgetCents: budgetCents ?? null,
    withinBudget: budgetCents == null ? true : totalCents <= budgetCents,
    overBy: budgetCents == null ? 0 : Math.max(0, totalCents - budgetCents),
    note: str(raw?.note),
  };
}

export function normalizeFloorPlan(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const features = arr(raw.features)
    .map((f) => ({
      type: str(f?.type).toLowerCase() || 'feature',
      label: str(f?.label),
      x: unit(f?.x),
      y: unit(f?.y),
      w: Math.min(1, Math.max(0.005, num(f?.w, 0.02))),
      h: Math.min(1, Math.max(0.005, num(f?.h, 0.02))),
    }))
    .slice(0, 30);

  const furniture = arr(raw.furniture)
    .map((f) => ({
      name: str(f?.name),
      x: unit(f?.x),
      y: unit(f?.y),
      w: Math.min(1, Math.max(0.02, num(f?.w, 0.1))),
      h: Math.min(1, Math.max(0.02, num(f?.h, 0.1))),
    }))
    .filter((f) => f.name)
    .slice(0, 30);

  if (!features.length && !furniture.length) return null;

  return {
    widthM: Math.max(0.5, num(raw.widthM, 4)),
    lengthM: Math.max(0.5, num(raw.lengthM, 5)),
    confidence: str(raw.confidence) === 'measured' ? 'measured' : 'estimated',
    cameraAt: raw.cameraAt
      ? { x: unit(raw.cameraAt.x, 0.5), y: unit(raw.cameraAt.y, 0.95) }
      : null,
    features,
    furniture,
  };
}

/**
 * Validate + normalize a board. `context` carries the budget the user set so
 * the totals can be checked against it.
 */
export function validateBoard(obj, context = {}) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new ValidationError('response was not a JSON object');
  }

  const plan = normPlan(obj.plan ?? obj.furniture);
  const shoppingList = normShopping(obj.shoppingList);

  const result = {
    roomType: str(obj.roomType),
    designConcept: str(obj.designConcept),
    revisionNote: str(obj.revisionNote),
    palette: normPalette(obj.palette),
    lighting: str(obj.lighting),
    materials: normMaterials(obj.materials),
    plan,
    phases: normPhases(obj.phases, plan),
    budget: computeBudget(
      obj.budgetSummary,
      plan,
      shoppingList,
      context.budgetCents ?? null,
      context.currency,
    ),
    layoutNotes: str(obj.layoutNotes),
    decor: normDecor(obj.decor),
    shoppingList,
    // Filled in by a second call; see worker.js.
    floorPlan: normalizeFloorPlan(obj.floorPlan),
    imageDirection: str(obj.imageDirection) || str(obj.imagePrompt),
  };

  if (!result.designConcept) {
    throw new ValidationError('designConcept is required');
  }
  if (!result.plan.length) {
    throw new ValidationError('plan must contain at least one item');
  }

  return result;
}

/** Normalize the render fidelity report. Never throws — it is advisory. */
export function normalizeFidelity(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const missing = arr(raw.missing)
    .map((m) => ({
      id: str(m?.id),
      type: str(m?.type),
      problem: str(m?.problem) || 'altered',
      detail: str(m?.detail),
    }))
    .filter((m) => m.id || m.type)
    .slice(0, 12);
  return {
    ok: missing.length === 0 && raw.ok !== false,
    missing,
    notes: str(raw.notes),
    checkedAt: new Date().toISOString(),
  };
}

export { ValidationError, VALID_PHASES };
