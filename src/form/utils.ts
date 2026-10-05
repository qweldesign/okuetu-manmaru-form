/** 条件付きでクラス名をつなぐ */
export const cx = (...xs: (string | false | null | undefined)[]): string => xs.filter(Boolean).join(' ');

/** エラーのキー（例: companions.0.name）から DOM の id を作る */
export const domIdOf = (key: string): string => `mf-${key.replace(/\./g, '-')}`;

/** 生年月日（YYYY/MM/DD）の自動整形 */
export function formatBirthdate(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 8);
  if (digits.length > 6) {
    return digits.slice(0, 4) + '/' + digits.slice(4, 6) + '/' + digits.slice(6);
  }
  if (digits.length > 4) {
    return digits.slice(0, 4) + '/' + digits.slice(4);
  }
  return digits;
}
