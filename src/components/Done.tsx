import type { Ref } from 'react';
import type { Payload } from '../form/types.ts';
import { ROUTES } from '../form/schema.ts';
import { asString } from '../form/engine.ts';
import { actionsRow, btnGhost, panelHeading } from '../form/styles.ts';

interface DoneProps {
  payload: Payload;
  headingRef: Ref<HTMLHeadingElement>;
  onRestart: () => void;
}

export function Done({ payload, headingRef, onRestart }: DoneProps) {
  const email = asString(payload.data.email);
  const route = ROUTES[asString(payload.data.purpose)];
  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className={panelHeading}>
        送信しました
      </h2>
      <p className="mt-3">お問い合わせありがとうございます。担当者から、通常3営業日以内にご連絡します。</p>
      {email && <p>確認のメールを {email} にお送りしました。</p>}

      {import.meta.env.DEV && (
        <>
          <section className="mt-6 border-t border-line pt-5">
            <h3 className="mb-2 font-round text-lg font-bold">通知先（開発時のみ表示）</h3>
            <p>{route ?? '（目的が未選択）'}</p>
          </section>
          <details className="mt-5">
            <summary className="cursor-pointer font-bold text-accent">送信データ（JSON）を見る</summary>
            <pre className="mt-2 overflow-x-auto rounded-[14px] bg-bg p-4 text-[13px] leading-relaxed">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </details>
        </>
      )}

      <div className={actionsRow}>
        <button type="button" onClick={onRestart} className={btnGhost}>
          最初から入力する
        </button>
      </div>
    </div>
  );
}
