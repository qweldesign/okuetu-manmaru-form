import type { ReactNode } from 'react';
import type { FieldValue, InputField } from '../form/types.ts';
import { asString, asStrings, isRange } from '../form/engine.ts';
import { cx, formatBirthdate } from '../form/utils.ts';

interface ControlProps {
  f: InputField;
  value: FieldValue | undefined;
  onChange: (v: FieldValue) => void;
  error?: string;
  domId: string;
  required: boolean;
}

const widthClass = {
  half: 'col-span-full sm:col-span-2',
  quarter: 'col-span-2 sm:col-span-1',
} as const;

const inputClass =
  'w-full min-h-12 rounded-xl border-[1.5px] border-line bg-bg px-3.5 py-2.5 transition-colors ' +
  'hover:border-muted focus:border-accent focus:bg-surface focus:outline-none focus:ring-3 focus:ring-accent-soft ' +
  'aria-invalid:border-danger aria-invalid:bg-danger-soft';

function ReqTag({ required }: { required: boolean }) {
  return required ? (
    <span className="rounded-full border border-sun bg-sun-soft px-2 py-1 text-xs leading-none font-bold">必須</span>
  ) : (
    <span className="rounded-full border border-line px-2 py-1 text-xs leading-none text-muted">任意</span>
  );
}

function Label({ text, required }: { text: string; required: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2 font-bold">
      {text}
      <ReqTag required={required} />
    </span>
  );
}

function Hint({ id, text }: { id?: string; text?: string }) {
  return text ? (
    <p id={id} className="text-sm leading-relaxed text-muted">
      {text}
    </p>
  ) : null;
}

function ErrorText({ id, message }: { id?: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm font-bold text-danger">
      {message}
    </p>
  ) : null;
}

function CheckMark({ square }: { square: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'mt-0.5 grid size-5 flex-none place-items-center border-2 border-muted transition-colors',
        'group-has-checked:border-accent group-has-checked:bg-accent',
        square ? 'rounded-md' : 'rounded-full',
      )}
    >
      <svg viewBox="0 0 12 12" className="invisible size-3 text-accent-ink group-has-checked:visible">
        <path d="M2.5 6.5l2.2 2.2L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Choice({
  type,
  name,
  value,
  checked,
  onToggle,
  label,
  desc,
  badge,
  card,
  inputProps,
  children,
}: {
  type: 'checkbox' | 'radio';
  name?: string;
  value?: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  label: ReactNode;
  desc?: string;
  badge?: string;
  card?: boolean;
  inputProps?: Record<string, string | undefined>;
  children?: ReactNode;
}) {
  return (
    <label
      className={cx(
        'group relative flex cursor-pointer items-start gap-2.5 border-[1.5px] border-line bg-surface leading-normal transition-colors',
        'hover:border-muted has-checked:border-accent has-checked:bg-accent-soft',
        'has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-sun',
        card ? 'rounded-3xl p-5' : 'rounded-full py-2.5 pr-4 pl-3',
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="sr-only"
        {...inputProps}
      />
      <CheckMark square={type === 'checkbox'} />
      <span className="flex flex-col">
        <span className={cx('flex flex-wrap items-center gap-x-2 gap-y-1', card && 'font-round text-lg font-bold')}>
          {label}
          {badge && (
            <span className="rounded-full bg-sun-soft px-2.5 py-0.5 font-body text-xs font-bold text-ink">{badge}</span>
          )}
        </span>
        {desc && <span className="text-sm text-muted">{desc}</span>}
      </span>
      {children}
    </label>
  );
}

export function Control({ f, value, onChange, error, domId, required }: ControlProps) {
  const hintId = f.hint ? `${domId}-hint` : undefined;
  const errId = error ? `${domId}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const width = f.width ? widthClass[f.width] : 'col-span-full';

  if (f.type === 'radio' || f.type === 'checks') {
    const multi = f.type === 'checks';
    const cards = f.variant === 'cards';
    const selected = asStrings(value);
    return (
      <fieldset id={domId} tabIndex={-1} aria-describedby={describedBy} className={cx(width, 'flex flex-col gap-1.5 outline-none')}>
        <legend className="mb-1.5">
          <Label text={f.label} required={required} />
        </legend>
        <Hint id={hintId} text={f.hint} />
        <div className={cards ? 'grid gap-3' : 'flex flex-wrap gap-2.5'}>
          {f.options.map((o) => {
            const checked = multi ? selected.includes(o.value) : value === o.value;
            return (
              <Choice
                key={o.value}
                type={multi ? 'checkbox' : 'radio'}
                name={domId}
                value={o.value}
                checked={checked}
                label={o.label}
                desc={o.desc}
                badge={o.badge}
                card={cards}
                onToggle={() => {
                  if (!multi) return onChange(o.value);
                  onChange(checked ? selected.filter((x) => x !== o.value) : [...selected, o.value]);
                }}
              />
            );
          })}
        </div>
        <ErrorText id={errId} message={error} />
      </fieldset>
    );
  }

  if (f.type === 'checkbox') {
    return (
      <div className={cx(width, 'flex flex-col gap-1.5')}>
        <div className="[&>label]:rounded-2xl">
          <Choice
            type="checkbox"
            checked={value === true}
            onToggle={(c) => onChange(c)}
            label={
              <>
                {f.label}
                {required && <ReqTag required />}
              </>
            }
            inputProps={{ id: domId, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy }}
          />
        </div>
        <ErrorText id={errId} message={error} />
      </div>
    );
  }

  if (f.type === 'range') {
    const v = isRange(value) ? value : { min: '', max: '' };
    return (
      <fieldset id={domId} tabIndex={-1} aria-describedby={describedBy} className={cx(width, 'flex flex-col gap-1.5 outline-none')}>
        <legend className="mb-1.5">
          <Label text={f.label} required={required} />
        </legend>
        <Hint id={hintId} text={f.hint} />
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            aria-label={`${f.label}の下限（${f.unit}）`}
            aria-invalid={error ? 'true' : undefined}
            value={v.min}
            onChange={(e) => onChange({ ...v, min: e.target.value })}
            className={cx(inputClass, 'max-w-36')}
          />
          <span className="text-muted">〜</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label={`${f.label}の上限（${f.unit}）`}
            aria-invalid={error ? 'true' : undefined}
            value={v.max}
            onChange={(e) => onChange({ ...v, max: e.target.value })}
            className={cx(inputClass, 'max-w-36')}
          />
          <span className="whitespace-nowrap text-muted">{f.unit}</span>
        </div>
        <ErrorText id={errId} message={error} />
      </fieldset>
    );
  }

  const common = {
    id: domId,
    'aria-invalid': error ? ('true' as const) : undefined,
    'aria-describedby': describedBy,
  };
  const text = asString(value);
  let input: ReactNode;

  if (f.type === 'textarea') {
    input = (
      <textarea
        {...common}
        rows={f.rows ?? 5}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputClass, 'resize-y leading-relaxed')}
      />
    );
  } else if (f.type === 'select') {
    input = (
      <select {...common} value={text} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">選択してください</option>
        {f.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (f.type === 'birthdate') {
    input = (
      <input
        {...common}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="19900501"
        maxLength={10}
        value={text}
        onChange={(e) => onChange(formatBirthdate(e.target.value))}
        className={cx(inputClass, 'max-w-48 tabular-nums tracking-wide')}
      />
    );
  } else if (f.type === 'number') {
    input = (
      <div className="flex items-center gap-2">
        <input
          {...common}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className={cx(inputClass, 'max-w-32')}
        />
        {f.unit && <span className="whitespace-nowrap text-muted">{f.unit}</span>}
      </div>
    );
  } else {
    input = (
      <input
        {...common}
        type={f.type}
        autoComplete={f.autoComplete}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    );
  }

  return (
    <div className={cx(width, 'flex flex-col gap-1.5')}>
      <label htmlFor={domId}>
        <Label text={f.label} required={required} />
      </label>
      {input}
      {/* 横並びの入力欄の高さがそろうよう、テキスト系の補足は入力欄の下に置く */}
      <Hint id={hintId} text={f.hint} />
      <ErrorText id={errId} message={error} />
    </div>
  );
}
