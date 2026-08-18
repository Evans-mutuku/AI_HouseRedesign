import { useId, useState } from 'react';
import { Eye, EyeOff, Lock } from '../Icon.jsx';

// Form primitives. A field is always label + control + (optional) hint or
// error, wired together by id so screen readers announce the whole thing.

const controlBase =
  'w-full rounded-[10px] border bg-canvas px-3.5 text-sm text-ink placeholder:text-faint ' +
  'transition-colors duration-200 focus:outline-none focus:border-ink';

export function Field({ label, hint, error, htmlFor, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  error,
  icon: IconLeft = null,
  id,
  className = '',
  ...rest
}) {
  const generated = useId();
  const inputId = id || generated;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <div className="relative">
        {IconLeft && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
            <IconLeft size={17} />
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          className={[
            controlBase,
            'h-11',
            IconLeft ? 'pl-10' : '',
            error ? 'border-danger/50' : 'border-line',
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
      </div>
    </Field>
  );
}

export function PasswordInput({ label, hint, error, id, className = '', ...rest }) {
  const generated = useId();
  const inputId = id || generated;
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
          <Lock size={17} />
        </span>
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? 'true' : undefined}
          className={[
            controlBase,
            'h-11 pl-10 pr-11',
            error ? 'border-danger/50' : 'border-line',
          ].join(' ')}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </Field>
  );
}

export function TextArea({ label, hint, error, id, rows = 3, className = '', ...rest }) {
  const generated = useId();
  const inputId = id || generated;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        className={[
          controlBase,
          'resize-none py-3 leading-relaxed',
          error ? 'border-danger/50' : 'border-line',
        ].join(' ')}
        {...rest}
      />
    </Field>
  );
}

/** A row of mutually exclusive pills - style, budget, filters. */
export function ChipGroup({ options, value, onChange, allowClear = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const val = typeof option === 'string' ? option : option.value;
        const label = typeof option === 'string' ? option : option.label;
        const active = value === val;
        return (
          <button
            key={val}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(allowClear && active ? '' : val)}
            className={[
              'rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-200',
              active
                ? 'border-ink bg-ink text-canvas'
                : 'border-line text-ink-2 hover:border-line-2 hover:bg-surface',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented control - for short, ordered choices like budget tiers. */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-[10px] border border-line bg-sunken p-1"
    >
      {options.map((option) => {
        const val = typeof option === 'string' ? option : option.value;
        const text = typeof option === 'string' ? option : option.label;
        const active = value === val;
        return (
          <button
            key={val}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(val)}
            className={[
              'rounded-[7px] px-3.5 py-1.5 text-sm transition-colors duration-200',
              active
                ? 'bg-canvas text-ink shadow-[0_1px_2px_rgba(20,19,15,0.08)]'
                : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
