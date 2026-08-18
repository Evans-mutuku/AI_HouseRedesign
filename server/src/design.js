// What we ask Claude, and how the render prompt is built.
//
// Three operations, deliberately separate:
//
//   readRoom(photo)          → the architectural inventory + the honest read of
//                              the space. Done ONCE per room and cached on
//                              rooms.architecture_json: a room's windows do not
//                              move between revisions, so neither should our
//                              record of them.
//
//   designRoom(...)          → the board: concept, palette, materials, a costed
//                              and phased plan, a floor plan. Takes the previous
//                              board plus an instruction when revising.
//
//   verifyRender(...)        → looks at what the image model actually produced
//                              and reports anything from the inventory that went
//                              missing.
//
// Splitting the vision read from the design work keeps each response small
// enough to come back as valid JSON reliably, and makes revisions cheap - a
// revision re-runs only the second call.

import { askForJson } from './claude.js';
import {
  SURVEY_SCHEMA,
  BOARD_SCHEMA,
  FLOORPLAN_SCHEMA,
  FIDELITY_SCHEMA,
} from './schemas.js';

/* ── 1. Reading the room ─────────────────────────────────────────────────── */

const ARCHITECTURE_TYPES = [
  'window',
  'door',
  'doorway',
  'archway',
  'fireplace',
  'staircase',
  'radiator',
  'beam',
  'column',
  'alcove',
  'built-in',
  'skylight',
  'stair rail',
  'vent',
];

const READ_SYSTEM =
  'You are a senior interior designer and a meticulous surveyor. You describe ' +
  'only what is actually visible in the photograph you are given. You never ' +
  'invent features, and you never omit a structural one.';

function readPrompt() {
  return `Survey this photograph of a real room. Two jobs: inventory the architecture, and read the space honestly.

ARCHITECTURE - this is the most important part of the task.
List EVERY permanent structural feature you can see. Use these types where they apply: ${ARCHITECTURE_TYPES.join(', ')}. Add others if you see them.
- One entry per distinct feature. If there are two windows of different sizes, that is two entries with count 1 each. If there are three identical windows in a row, that may be one entry with count 3.
- "location" must be precise and relative to the camera: "centred on the left wall", "far corner, right of the fireplace", "directly behind the sofa".
- "description" must name the things a renderer could get wrong: frame colour, glazing bars and how many panes, whether a door is panelled or flush, which way it opens, sill depth, what is visible through the glass, hearth material.
- Be exhaustive about openings. A window you fail to list is a window that will be erased from the redesign.

DO NOT list as architecture:
- Plain wall, ceiling, or floor surfaces. Those are exactly what the redesign repaints and refloors, and listing them here freezes them. Put anything structural about them ("sloped ceiling on the left", "boards run toward the camera") in fixedFeatures instead.
- Light fittings, curtains, blinds, rugs, furniture, or anything else that gets replaced or restyled.
- Sockets, switches, and thermostats.
This list is for openings and permanent masonry only - the things an image model erases and a person immediately notices are gone.

"fixedFeatures" - other immovable facts a render must respect: approximate ceiling height, floorboard direction, wall angles, a sloped ceiling, a step in the floor.

"annotations" - 3 to 6 observations pinned to the photo. "x" and "y" are the marker position as fractions of the image width and height, between 0 and 1, with 0,0 at the top left. "severity" is "issue" for a problem and "asset" for something already working that should be kept. Keep "note" to one sentence.

"currentAssessment" - two or three sentences on how the room actually reads right now: light, proportion, what is fighting what. Be specific to THIS room and honest.`;
}

/**
 * Survey the room. Cached on the room row - call once per uploaded photo.
 */
export async function readRoom({ base64, mediaType }) {
  const { parsed, model } = await askForJson({
    images: [{ base64, mediaType }],
    system: READ_SYSTEM,
    prompt: readPrompt(),
    schema: SURVEY_SCHEMA,
    effort: 'high',
    maxTokens: 6000,
    label: 'room survey',
  });
  return { survey: parsed, model };
}

/* ── 2. Designing ────────────────────────────────────────────────────────── */

const DESIGN_SYSTEM =
  'You are a senior interior designer. You work from what is actually in the ' +
  'photograph, you respect budgets to the cent, and you never propose removing ' +
  'or covering a structural feature.';

function money(cents, currency) {
  if (cents == null) return 'no fixed budget';
  return `${(cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  })}`;
}

function architectureBrief(survey) {
  const items = Array.isArray(survey?.architecture) ? survey.architecture : [];
  if (!items.length) return 'No structural inventory was recorded.';
  return items
    .map(
      (a) =>
        `- ${a.count > 1 ? `${a.count}× ` : ''}${a.type} (${a.id}): ${a.location}. ${a.description}`,
    )
    .join('\n');
}

function designPrompt({ survey, intents, previous, instruction, homePalette, taste }) {
  const { style, budgetCents, currency, note } = intents;
  const styleLine = style || 'choose the direction you think this room deserves';

  const revising = Boolean(previous);

  const budgetBlock =
    budgetCents == null
      ? `The user has not set a budget. Still cost every line item honestly in ${currency}, and let the total land where the design needs it to.`
      : `The user's budget is ${money(budgetCents, currency)} (${budgetCents} cents, ${currency}). This is a hard ceiling for the "full" phase. Cost every line item, keep the sum of all "add" and shopping items at or under the ceiling, and say plainly in budgetSummary.note if the direction had to be trimmed to fit.`;

  const revisionBlock = revising
    ? `
THIS IS A REVISION. Here is the board you produced last time:

${JSON.stringify(previous, null, 1).slice(0, 6000)}

The user has now asked for: "${instruction}"

Apply that change. Keep everything the user did not ask you to change - same palette entries, same items, same wording - unless the requested change genuinely forces a knock-on edit. Explain what moved in "revisionNote". Do not start over.
`
    : '';

  const homeBlock = homePalette
    ? `
This room is part of a whole-home project with an agreed palette. Carry it through so the house reads as one scheme; you may add at most one room-specific accent.
Agreed palette: ${JSON.stringify(homePalette)}
`
    : '';

  const tasteBlock = taste?.styles?.length
    ? `
This user has previously favourited boards in these styles: ${taste.styles.join(', ')}. Lean that way where it does not fight the room or the brief.
`
    : '';

  return `Design a redesign direction for the room in this photograph.

WHAT THE SURVEY FOUND
Room type: ${survey?.roomType || 'unknown'}
Current state: ${survey?.currentAssessment || 'n/a'}
Structural features that MUST survive the redesign:
${architectureBrief(survey)}
Other fixed facts: ${(survey?.fixedFeatures || []).join('; ') || 'none recorded'}

THE BRIEF
Style: ${styleLine}
${budgetBlock}
User's note: ${note || 'none'}
${revisionBlock}${homeBlock}${tasteBlock}
RULES

palette - 4 to 6 real hex colours, pulled from what the light in THIS room is doing. Give each a role.

plan - every meaningful piece in the room, plus what you would bring in.
- "key" is a short stable kebab-case slug of the item, e.g. "oak-credenza". It must be unique and must not change between revisions for the same object.
- "costCents" is 0 for "keep", "remove", and "move". For "add", it is your honest estimate in minor units of ${currency}.
- "effort": "easy" is a person alone in an hour; "moderate" is two people or a weekend; "trade" needs an electrician, plumber, or joiner.
- Never propose removing, covering, blocking, or building over any structural feature listed above. You may re-dress them - new curtains on a window, a repainted door - but they stay.

phase - this is what makes the plan usable, so be strict about it.
- "weekend": costs nothing or almost nothing. Rearranging, decluttering, rehanging, swapping a bulb. Someone could do it on Saturday and see a real difference.
- "month": the meaningful purchases, inside the budget ceiling.
- "full": the complete direction, including anything needing a trade.
Every plan and shopping item must carry a phase. Order "phases" weekend, month, full, and write a one-sentence summary for each describing what the room feels like once that phase is done.

budgetSummary - the four totals must be the actual sums of the costCents you assigned, in cents. "withinBudget" is false if totalCents exceeds the ceiling.

shoppingList - only things to buy, each matching a "key" from an "add" plan item where one exists. "searchQuery" is what you would type into a retailer's search box to find it: material, colour, form, approximate size. No brand names.

imageDirection - 400 to 700 characters describing ONLY what changes visually: wall colour and finish, flooring, the furniture and its materials and colours, textiles, lighting fixtures and their warmth, and decor. Name specific colours and materials. Do NOT mention the camera, the room's shape, the windows, or the doors - those are handled separately and are not yours to describe. Write it as instructions to a photo retoucher, not as a scene description.`;
}

/**
 * Produce a board. Pass `previous` + `instruction` to revise instead of
 * starting from scratch.
 */
export async function designRoom({
  base64,
  mediaType,
  survey,
  intents,
  previous = null,
  instruction = '',
  homePalette = null,
  taste = null,
}) {
  const { parsed, model } = await askForJson({
    images: [{ base64, mediaType }],
    system: DESIGN_SYSTEM,
    prompt: designPrompt({ survey, intents, previous, instruction, homePalette, taste }),
    schema: BOARD_SCHEMA,
    effort: 'high',
    maxTokens: 16000,
    label: 'design board',
  });
  return { board: parsed, model };
}

/* ── 2b. The floor plan ──────────────────────────────────────────────────── */

const FLOOR_SYSTEM =
  'You draw measured plan views of rooms. You infer dimensions from ' +
  'perspective, you place openings on the correct walls, and you never block a ' +
  'door or a window with furniture.';

/**
 * A plan view of the redesigned room, as normalised rectangles the client draws
 * as SVG. Separate from the board because the two schemas together exceed what
 * the API will compile into a sampling grammar - and because a failure here
 * should cost us the diagram, not the design.
 */
export async function planFloor({ base64, mediaType, survey, board }) {
  const keep = (board?.plan || [])
    .filter((p) => p.action === 'keep' || p.action === 'add' || p.action === 'move')
    .map((p) => p.item);

  const prompt = `Draw a plan view of this room as it will be AFTER the redesign.

The survey found these structural features:
${architectureBrief(survey)}
Other fixed facts: ${(survey?.fixedFeatures || []).join('; ') || 'none recorded'}

The redesigned room contains: ${keep.join(', ') || 'furnish it as the design implies'}

Layout intent: ${board?.layoutNotes || 'arrange it sensibly for the room'}

RULES
- Estimate the room's real dimensions in metres from the photograph's perspective. Mark "confidence" as "estimated" unless the photo actually shows a measurement.
- x, y, w, h are fractions of the room's width and length, between 0 and 1, with the origin at the top-left corner of the plan.
- "features" are the structural items above, placed against the wall they belong to. A window or door sits ON a wall, so its thin dimension should be about 0.02.
- "furniture" is the redesigned layout - the pieces being kept plus the ones being added. Give each its real footprint, not a uniform box.
- Nothing may sit in front of a door's swing or block a window.
- Leave a walkable route through the room, at least 0.7m wide in real terms.
- "cameraAt" is roughly where the photographer stood.`;

  const { parsed } = await askForJson({
    images: [{ base64, mediaType }],
    system: FLOOR_SYSTEM,
    prompt,
    schema: FLOORPLAN_SCHEMA,
    effort: 'medium',
    maxTokens: 4000,
    label: 'floor plan',
  });
  return parsed;
}

/* ── 3. The render prompt ────────────────────────────────────────────────── */

/**
 * Compose the instruction sent to the image model.
 *
 * This is built HERE, from the survey, rather than being written by Claude in
 * the board response. That is deliberate: the reason windows and doors were
 * getting erased is that "preserve the architecture" was a single clause buried
 * in a paragraph the design model wrote freehand, competing with a vivid
 * description of everything that should change. An image model asked to
 * reimagine a room will reimagine the walls too.
 *
 * So the preservation list is now deterministic, enumerated, and placed both
 * first and last - the two positions a model weights most - while the creative
 * direction is fenced into the middle and explicitly forbidden from touching
 * structure.
 */
export function buildImagePrompt({ survey, board, region = null }) {
  const features = Array.isArray(survey?.architecture) ? survey.architecture : [];

  const preserveLines = features.length
    ? features.map((f) => {
        const count = Number(f.count) > 1 ? `${f.count} ` : '';
        return `- ${count}${f.type}: ${f.location}. ${f.description}`.trim();
      })
    : ['- every window, door, and structural opening visible in the photograph'];

  const fixed = (survey?.fixedFeatures || []).filter(Boolean);

  const palette = (board?.palette || [])
    .map((c) => `${c.name} ${c.hex} (${c.role})`)
    .join('; ');

  const regionLine = region
    ? `\nEDIT ONLY THE MASKED REGION. Everything outside the mask must come through untouched, and the edited area must match the surrounding light, perspective, and grain so the seam is invisible.\n`
    : '';

  return `Edit this photograph of a real room. It is the same room, the same camera position, the same lens, and the same crop. This is a retouch, not a new picture.
${regionLine}
PRESERVE EXACTLY. Every item below is present in the source photograph and must be present in the output, in the same position, at the same size, in the same quantity:
${preserveLines.join('\n')}
${fixed.length ? `Also unchanged: ${fixed.join('; ')}.` : ''}
Keep all frames, sills, glazing bars, thresholds, and hardware. Keep whatever is visible through the glass. Keep the wall angles, the ceiling line, and the floor plane exactly where they are.

CHANGE ONLY THIS:
${board?.imageDirection || 'Restyle the furnishings, textiles, and finishes to a calm, contemporary scheme.'}

PALETTE: ${palette || 'as described above'}

The output must read as an unretouched photograph of this exact room after redecoration - same time of day, same daylight direction, natural shadows, realistic materials.

Do not remove, cover, block, curtain over, shrink, widen, or move any window, door, doorway, fireplace, or opening listed above. Do not add or remove walls. Do not change the camera angle, the framing, or the aspect ratio. Do not turn a window into a mirror, a painting, or a blank wall. If a piece of furniture would sit in front of a window or door, place it lower or elsewhere so the opening stays fully visible.`;
}

/* ── 4. Checking what came back ──────────────────────────────────────────── */

const VERIFY_SYSTEM =
  'You are a quality inspector comparing two photographs of the same room. ' +
  'You are strict, literal, and you do not give the benefit of the doubt.';

/**
 * Compare the render against the survey and report anything that went missing.
 * The before and after are sent together so the model can compare them
 * directly rather than judging the render in isolation.
 */
export async function verifyRender({ before, after, survey }) {
  const expected = (survey?.architecture || [])
    .map((f) => `- ${f.id} - ${f.count > 1 ? `${f.count} ` : ''}${f.type}, ${f.location}: ${f.description}`)
    .join('\n');

  const prompt = `The FIRST image is the original room. The SECOND image is an AI-edited redesign of that same room.

These structural features were surveyed in the original and must all still be present in the edit:
${expected || '- every window and door visible in the first image'}

Compare the two images. For each feature, decide whether it survived the edit.

"ok" is true only if every listed feature is still clearly visible, in the same place, at the same size, in the same quantity. A window that became a mirror, a painting, or blank wall counts as "removed". A door hidden behind new furniture counts as "covered". Be strict: if you are unsure whether a feature survived, treat it as missing. Keep "detail" to one short sentence naming what you actually see there now.`;

  const { parsed } = await askForJson({
    images: [before, after],
    system: VERIFY_SYSTEM,
    prompt,
    schema: FIDELITY_SCHEMA,
    effort: 'medium',
    maxTokens: 4000,
    label: 'render check',
  });
  return parsed;
}

/**
 * Strengthen the prompt for a second attempt, naming exactly what the checker
 * says went wrong. Being specific about the failure works far better than
 * simply re-running the same instruction and hoping.
 */
export function reinforceImagePrompt(basePrompt, fidelity) {
  const missing = (fidelity?.missing || []).filter(Boolean);
  if (!missing.length) return basePrompt;

  const complaints = missing
    .map((m) => `- The ${m.type} (${m.id}) was ${m.problem}. ${m.detail || ''}`.trim())
    .join('\n');

  return `${basePrompt}

CRITICAL - A PREVIOUS ATTEMPT FAILED. These features were lost and must be reinstated:
${complaints}

Render each of them exactly as it appears in the source photograph: same position, same size, same frame, same glazing, same view through it. Leave surrounding furniture clear of them. Getting these right matters more than any stylistic choice above - if a decorative decision conflicts with showing one of these features in full, drop the decoration.`;
}
