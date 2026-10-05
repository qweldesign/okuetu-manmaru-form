import type { Payload } from './types.ts';

/**
 * 問い合わせを送信する。
 * プロトタイプのため、いまは少し待って成功を返すだけ。送信先が決まったらここを実装する。
 */
export async function submitInquiry(payload: Payload): Promise<void> {
  void payload;
  await new Promise((resolve) => setTimeout(resolve, 600));
}
