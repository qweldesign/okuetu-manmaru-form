import { useEffect, useMemo, useRef, useState } from 'react';
import type { Errors, FieldValue, Payload, Values } from './form/types.ts';
import { PURPOSES, SCHEMA } from './form/schema.ts';
import { buildPayload, effectiveValues, evalCond, initialValues, syncFirstRows, validateStep } from './form/engine.ts';
import { ENABLE_VALIDATION } from './form/config.ts';
import { submitInquiry } from './form/submit.ts';
import { domIdOf } from './form/utils.ts';
import { actionsRow, btnGhost, btnPrimary, panelHeading } from './form/styles.ts';
import { FieldList } from './components/FieldList.tsx';
import { Progress } from './components/Progress.tsx';
import { Review } from './components/Review.tsx';
import { Done } from './components/Done.tsx';

type Phase = 'form' | 'confirm' | 'done';

/** ?type=workstay のように目的を指定してリンクされた場合は、最初から選択しておく */
function initialState(): Values {
  const v = initialValues(SCHEMA);
  const type = new URLSearchParams(window.location.search).get('type');
  if (type && PURPOSES.some((p) => p.value === type)) v.purpose = type;
  return v;
}

export default function App() {
  const [values, setValues] = useState<Values>(initialState);
  const [errors, setErrors] = useState<Errors>({});
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('form');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shouldFocusError = useRef(false);
  const hasMounted = useRef(false);

  const eff = useMemo(() => effectiveValues(SCHEMA, values), [values]);
  const steps = SCHEMA.steps.filter((s) => evalCond(s.show, eff));
  const idx = Math.min(pos, steps.length - 1);
  const step = steps[idx];

  // ステップや画面が切り替わったら、フォームの先頭へ戻して見出しにフォーカスする
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    rootRef.current?.scrollIntoView({ block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
  }, [idx, phase]);

  // 検証エラーを出したときは、最初のエラー項目へフォーカスする
  useEffect(() => {
    if (!shouldFocusError.current) return;
    shouldFocusError.current = false;
    const first = Object.keys(errors)[0];
    const el = first ? document.getElementById(domIdOf(first)) : null;
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'center' });
    }
  }, [errors]);

  const setVal = (id: string, v: FieldValue) => {
    setValues((prev) => syncFirstRows(SCHEMA, prev, { ...prev, [id]: v }));
    setErrors((prev) => {
      const keys = Object.keys(prev).filter((k) => k === id || k.startsWith(`${id}.`));
      if (!keys.length) return prev;
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  };

  const showErrors = (errs: Errors) => {
    shouldFocusError.current = true;
    setErrors(errs);
  };

  const next = () => {
    if (!ENABLE_VALIDATION) {
      setErrors({});
      if (idx < steps.length - 1) return setPos(idx + 1);
      return setPhase('confirm');
    }
    const errs = validateStep(step, eff, values);
    if (Object.keys(errs).length) return showErrors(errs);
    setErrors({});
    if (idx < steps.length - 1) return setPos(idx + 1);

    // 後のステップの回答で前のステップの必須が変わることがあるので、最後に全体を検証し直す
    for (let i = 0; i < steps.length; i++) {
      const e = validateStep(steps[i], eff, values);
      if (Object.keys(e).length) {
        setPos(i);
        return showErrors(e);
      }
    }
    setPhase('confirm');
  };

  const back = () => {
    setErrors({});
    setPos(Math.max(0, idx - 1));
  };

  const jump = (i: number) => {
    setErrors({});
    setSendError(null);
    setPhase('form');
    setPos(i);
  };

  const submit = async () => {
    const data = buildPayload(eff);
    setSending(true);
    setSendError(null);
    try {
      await submitInquiry(data);
      setPayload(data);
      setPhase('done');
    } catch (e) {
      setSendError(e instanceof Error ? e.message : '送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const restart = () => {
    setValues(initialValues(SCHEMA));
    setErrors({});
    setPos(0);
    setPayload(null);
    setPhase('form');
  };

  const labels = [...steps.map((s) => s.short), '確認'];
  const current = phase === 'form' ? idx : labels.length - 1;
  const errorCount = Object.keys(errors).length;

  return (
    <div ref={rootRef} className="mx-auto max-w-190 scroll-mt-4 px-5 pt-8 pb-14">
      <header>
        <p className="font-round text-[15px] font-bold text-accent">奥越前まんまるサイト</p>
        <h1 className="mt-1 mb-3 font-round text-[clamp(28px,6vw,38px)] leading-snug font-bold tracking-wide">
          お問い合わせ・ご相談
        </h1>
        <p className="max-w-[38em] text-muted">
          移住のご相談、ワークステイやまんまるハウスのご利用、サイトへのご質問を、このフォームでまとめて受け付けています。選んだ内容に合わせて、必要な質問だけが表示されます。
        </p>
      </header>

      {phase !== 'done' && <Progress labels={labels} current={current} onJump={jump} />}

      <main className={`${phase === 'done' ? 'mt-8 ' : ''}rounded-[28px] border border-line bg-surface p-[clamp(22px,5vw,40px)]`}>
        {phase === 'form' && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
          >
            <h2 ref={headingRef} tabIndex={-1} className={panelHeading}>
              {step.title}
            </h2>
            {step.lead && <p className="mt-1.5 mb-6 text-muted">{step.lead}</p>}
            {errorCount > 0 && (
              <p role="alert" className="mb-5 rounded-[14px] bg-danger-soft px-4 py-3 font-bold text-danger">
                入力内容を確認してください。{errorCount}か所に修正が必要です。
              </p>
            )}
            <div className="grid grid-cols-4 gap-x-4.5 gap-y-5.5">
              <FieldList fields={step.fields} eff={eff} values={values} setVal={setVal} errors={errors} />
            </div>
            <div className={actionsRow}>
              {idx > 0 && (
                <button type="button" onClick={back} className={btnGhost}>
                  前へ戻る
                </button>
              )}
              <button type="submit" className={btnPrimary}>
                {idx === steps.length - 1 ? '入力内容を確認する' : '次へ進む'}
              </button>
            </div>
          </form>
        )}

        {phase === 'confirm' && (
          <Review
            steps={steps}
            eff={eff}
            values={values}
            headingRef={headingRef}
            sending={sending}
            sendError={sendError}
            onEdit={jump}
            onBack={() => jump(steps.length - 1)}
            onSubmit={submit}
          />
        )}

        {phase === 'done' && payload && <Done payload={payload} headingRef={headingRef} onRestart={restart} />}
      </main>

      <footer className="mt-7 text-sm text-muted">
        フォームがうまく使えない場合は、お電話（0779-67-1117）またはメール（okuechizenmanmarusaito@gmail.com）でもご相談いただけます。
      </footer>
    </div>
  );
}
