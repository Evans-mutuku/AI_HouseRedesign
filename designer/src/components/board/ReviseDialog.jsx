import { useState } from 'react';

import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { TextArea, TextInput, ChipGroup } from '../ui/Field.jsx';
import { Banner } from '../ui/Surface.jsx';
import RegionPicker from './RegionPicker.jsx';
import Icon from '../Icon.jsx';
import { formatMoney, parseMoneyToCents } from '../../lib/format.js';

/**
 * Ask for a change. This is the revision flow - the thing that turns a one-shot
 * generator into a design conversation.
 *
 * The suggestions are there because "what would you like to change?" in front of
 * an empty box is a harder question than it looks; a starting phrase people can
 * edit gets far better instructions than a blank field.
 */

const SUGGESTIONS = [
  'Make the walls a deeper, moodier tone',
  'Keep the sofa I already own',
  'More plants and greenery',
  'Warmer lighting throughout',
  'Less furniture - open it up',
  'A brighter, more coastal feel',
];

export default function ReviseDialog({
  open,
  onClose,
  onSubmit,
  beforeUrl,
  currentBudgetCents,
  currency = 'USD',
  submitting = false,
  error = '',
}) {
  const [instruction, setInstruction] = useState('');
  const [budget, setBudget] = useState('');
  const [region, setRegion] = useState(null);
  const [showRegion, setShowRegion] = useState(false);

  const close = () => {
    if (submitting) return;
    setInstruction('');
    setBudget('');
    setRegion(null);
    setShowRegion(false);
    onClose?.();
  };

  const submit = () => {
    const budgetCents = parseMoneyToCents(budget);
    onSubmit?.({
      instruction: instruction.trim(),
      budget: budgetCents ? budgetCents / 100 : undefined,
      currency,
      region,
    });
  };

  const canSubmit = instruction.trim().length > 2 || Boolean(region) || Boolean(parseMoneyToCents(budget));

  return (
    <Modal
      open={open}
      onClose={close}
      title="Ask for a change"
      description="This keeps everything you did not mention and adds a new revision to this room - your previous versions stay."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button
            icon={Icon.Sparkle}
            loading={submitting}
            disabled={!canSubmit || submitting}
            onClick={submit}
          >
            Generate revision
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Banner tone="danger">{error}</Banner>}

        <TextArea
          label="What should change?"
          rows={3}
          maxLength={600}
          autoFocus
          placeholder="e.g. keep the sofa but make the walls darker and swap the rug for something flatter"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />

        <div>
          <p className="mb-2 text-xs text-muted">Or start from one of these:</p>
          <ChipGroup
            options={SUGGESTIONS.map((s) => ({ value: s, label: s }))}
            value={instruction}
            allowClear
            onChange={setInstruction}
          />
        </div>

        <TextInput
          label={`New budget (optional, ${currency})`}
          type="text"
          inputMode="decimal"
          placeholder={
            currentBudgetCents ? formatMoney(currentBudgetCents, currency) : 'e.g. 2400'
          }
          hint="Leave blank to keep the budget you already set."
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />

        {beforeUrl && (
          <div>
            {!showRegion ? (
              <Button
                variant="secondary"
                size="sm"
                icon={Icon.Compare}
                full
                onClick={() => setShowRegion(true)}
              >
                Change just one area of the room
              </Button>
            ) : (
              <>
                <p className="mb-2 text-sm font-medium text-ink">Area to change</p>
                <RegionPicker src={beforeUrl} value={region} onChange={setRegion} />
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
