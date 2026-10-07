import type { Errors, Payload } from './types.ts';

/** 送信先。ビルドしたページと同じ場所に置いた api/ を使う（開発時は Vite が PHP の開発サーバーへ中継する） */
const ENDPOINT = './api/send.php';

/** 送信の失敗。サーバーの入力チェックで弾かれた場合は、項目ごとのエラーを持つ */
export class SubmitError extends Error {
  readonly fieldErrors: Errors;

  constructor(message: string, fieldErrors: Errors = {}) {
    super(message);
    this.name = 'SubmitError';
    this.fieldErrors = fieldErrors;
  }
}

/** 画面に出す失敗の文言（文末の句点は、表示側で補う） */
const MESSAGES: Record<number, string> = {
  400: '送信データを読み取れませんでした',
  403: '送信元を確認できませんでした',
  415: '送信データを読み取れませんでした',
  422: '入力内容に不備があります',
};

/** 問い合わせを送信する。成功時は何も返さず、失敗時は SubmitError を投げる */
export async function submitInquiry(payload: Payload): Promise<void> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new SubmitError('通信できませんでした');
  }
  if (res.ok) return;

  const body: unknown = await res.json().catch(() => null);
  const fieldErrors =
    res.status === 422 && body && typeof body === 'object' && 'errors' in body ? (body.errors as Errors) : {};
  throw new SubmitError(MESSAGES[res.status] ?? '送信できませんでした', fieldErrors);
}
