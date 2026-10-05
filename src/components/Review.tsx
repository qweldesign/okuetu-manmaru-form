import type { Ref } from 'react';
import type { Step, SummaryEntry, Values } from '../form/types.ts';
import { summarize } from '../form/engine.ts';
import { actionsRow, btnGhost, btnPrimary, panelHeading, textLink } from '../form/styles.ts';

interface ReviewProps {
  steps: Step[];
  eff: Values;
  values: Values;
  headingRef: Ref<HTMLHeadingElement>;
  sending: boolean;
  sendError: string | null;
  onEdit: (index: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}

function Pair({ label, text }: { label: string; text: string }) {
  return (
    <div className="grid gap-x-4 gap-y-1 py-2 sm:grid-cols-[12em_1fr]">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="wrap-break-word whitespace-pre-wrap">{text}</dd>
    </div>
  );
}

function Entries({ items }: { items: SummaryEntry[] }) {
  return items.map((it, k) =>
    'heading' in it ? (
      <div key={k} className="my-2 border-l-3 border-accent-soft pl-3.5">
        <dt className="mt-1.5 font-bold text-accent">{it.heading}</dt>
        <dd>
          <dl>
            <Entries items={it.items} />
          </dl>
        </dd>
      </div>
    ) : (
      <Pair key={k} label={it.label} text={it.text} />
    ),
  );
}

export function Review({ steps, eff, values, headingRef, sending, sendError, onEdit, onBack, onSubmit }: ReviewProps) {
  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className={panelHeading}>
        入力内容の確認
      </h2>
      <p className="mt-1.5 mb-6 text-muted">内容を確かめて、よろしければ送信してください。</p>

      {steps.map((s, i) => {
        const items = summarize(s.fields, eff, values);
        if (!items.length) return null;
        return (
          <section key={s.id} className="mt-6 border-t border-line pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="mb-2 font-round text-lg font-bold">{s.title}</h3>
              <button type="button" onClick={() => onEdit(i)} className={textLink}>
                「{s.short}」を修正する
              </button>
            </div>
            <dl>
              <Entries items={items} />
            </dl>
          </section>
        );
      })}

      {sendError && (
        <p role="alert" className="mt-6 rounded-[14px] bg-danger-soft px-4 py-3 font-bold text-danger">
          {sendError}。時間をおいて再度お試しいただくか、お電話でご連絡ください。
        </p>
      )}

      <div className={actionsRow}>
        <button type="button" onClick={onBack} className={btnGhost}>
          入力に戻る
        </button>
        <button type="button" onClick={onSubmit} disabled={sending} className={btnPrimary}>
          {sending ? '送信しています…' : 'この内容で送信する'}
        </button>
      </div>
    </div>
  );
}
