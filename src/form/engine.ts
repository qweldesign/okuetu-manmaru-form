// スキーマを解釈する小さなエンジン。React に依存しないので、
// 単体テストやサーバー側（PHP）への移植の参考にできる。
import type {
  Condition,
  Errors,
  Field,
  FieldValue,
  InputField,
  Payload,
  RangeValue,
  RowValue,
  Schema,
  Step,
  SummaryEntry,
  Values,
} from './types.ts';

export const isRange = (v: FieldValue | undefined): v is RangeValue =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && 'min' in v && 'max' in v;

export const asStrings = (v: FieldValue | undefined): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export const asRows = (v: FieldValue | undefined): RowValue[] =>
  Array.isArray(v) ? v.filter((x): x is RowValue => typeof x === 'object' && x !== null) : [];

export const asString = (v: FieldValue | undefined): string => (typeof v === 'string' ? v : '');

export function isFilled(v: FieldValue | undefined): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'boolean') return v;
  if (isRange(v)) return v.min.trim() !== '' || v.max.trim() !== '';
  return v.trim() !== '';
}

export function evalCond(c: Condition | undefined, v: Values): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => evalCond(x, v));
  if ('any' in c) return c.any.some((x) => evalCond(x, v));
  if ('not' in c) return !evalCond(c.not, v);
  const val = v[c.field];
  if ('includes' in c) return asStrings(val).includes(c.includes);
  if ('only' in c) {
    const arr = asStrings(val);
    return arr.length === 1 && arr[0] === c.only;
  }
  if ('equals' in c) return val === c.equals;
  if ('in' in c) return typeof val === 'string' && c.in.includes(val);
  return isFilled(val) === c.filled;
}

export const isRequired = (f: { required?: boolean | Condition }, eff: Values): boolean =>
  f.required === true || (typeof f.required === 'object' && evalCond(f.required, eff));

function walk(fields: Field[], eff: Values, parentVisible: boolean, cb: (f: Field, visible: boolean) => void): void {
  for (const f of fields) {
    const visible = parentVisible && evalCond(f.show, eff);
    cb(f, visible);
    if (f.type === 'section') walk(f.fields, eff, visible, cb);
  }
}

/**
 * 非表示になった項目の値を取り除いた「有効な値」を求める。
 * 非表示項目に残った古い値が他の条件に影響しないよう、結果が安定するまで繰り返す。
 * 同じ id の項目が複数のステップにある場合（例：ワークステイとまんまるハウスの日程）は、
 * どれか1つでも表示されていれば値を残す。
 */
export function effectiveValues(schema: Schema, values: Values): Values {
  let eff: Values = { ...values };
  for (let i = 0; i < 8; i++) {
    const next: Values = { ...values };
    const visibleIds = new Set<string>();
    const hiddenIds = new Set<string>();
    for (const step of schema.steps) {
      const stepVisible = evalCond(step.show, eff);
      walk(step.fields, eff, stepVisible, (f, visible) => {
        (visible ? visibleIds : hiddenIds).add(f.id);
      });
    }
    for (const id of hiddenIds) if (!visibleIds.has(id)) delete next[id];
    const prevKeys = Object.keys(eff);
    const same = Object.keys(next).length === prevKeys.length && prevKeys.every((k) => k in next);
    eff = next;
    if (same) break;
  }
  return eff;
}

export function initialValues(schema: Schema): Values {
  const v: Values = {};
  const init = (fields: Field[]): void => {
    for (const f of fields) {
      switch (f.type) {
        case 'section':
          init(f.fields);
          break;
        case 'note':
          break;
        case 'checks':
          v[f.id] = [];
          break;
        case 'repeater':
          v[f.id] = Array.from({ length: f.min ?? 0 }, (_, i) => (i === 0 && f.firstRow ? { ...f.firstRow } : {}));
          break;
        case 'checkbox':
          v[f.id] = false;
          break;
        case 'range':
          v[f.id] = { min: '', max: '' };
          break;
        case 'radio':
          v[f.id] = f.defaultValue ?? '';
          break;
        default:
          v[f.id] = '';
      }
    }
  };
  schema.steps.forEach((s) => init(s.fields));
  return v;
}

function requiredMessage(f: InputField): string {
  if (f.requiredMessage) return f.requiredMessage;
  if (f.type === 'checks' || f.type === 'radio' || f.type === 'select') return '選択してください';
  if (f.type === 'checkbox') return 'チェックしてください';
  return '入力してください';
}

export function checkValue(f: InputField, v: FieldValue | undefined, eff: Values): string | null {
  if (!isFilled(v)) return isRequired(f, eff) ? requiredMessage(f) : null;
  const s = asString(v);
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'メールアドレスの形式を確認してください';
  if (f.type === 'tel' && !/^[0-9０-９\-－ー+()（） ]{10,}$/.test(s)) return '電話番号を確認してください（例：0779-67-1117）';
  if (f.type === 'birthdate') {
    const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s);
    if (!m) return '8桁の数字で入力してください（例：19900501）';
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(y, mo - 1, d);
    const valid = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
    if (!valid || date > new Date()) return '日付を確認してください';
  }
  if (f.type === 'number') {
    const n = Number(s);
    if (Number.isNaN(n)) return '数字で入力してください';
    if (f.min != null && n < f.min) return `${f.min}以上で入力してください`;
    if (f.max != null && n > f.max) return `${f.max}以下で入力してください`;
  }
  if (f.type === 'range' && isRange(v)) {
    const { min, max } = v;
    if ([min, max].some((x) => x !== '' && Number.isNaN(Number(x)))) return '数字で入力してください';
    if (min !== '' && max !== '' && Number(min) > Number(max)) return '下限が上限より大きくなっています';
  }
  return null;
}

function validateFields(fields: Field[], eff: Values, values: Values, errs: Errors): void {
  for (const f of fields) {
    if (!evalCond(f.show, eff) || f.type === 'note') continue;
    if (f.type === 'section') {
      validateFields(f.fields, eff, values, errs);
      continue;
    }
    if (f.type === 'repeater') {
      const rows = asRows(values[f.id]);
      rows.forEach((row, i) => {
        for (const sf of f.fields) {
          if (!evalCond(sf.show, eff)) continue;
          const e = checkValue(sf, row[sf.id], eff);
          if (e) errs[`${f.id}.${i}.${sf.id}`] = e;
        }
      });
      if (rows.length < (f.min ?? 0)) errs[f.id] = `${f.min}件以上入力してください`;
      continue;
    }
    const e = checkValue(f, values[f.id], eff);
    if (e) errs[f.id] = e;
  }
}

export function validateStep(step: Step, eff: Values, values: Values): Errors {
  const errs: Errors = {};
  validateFields(step.fields, eff, values, errs);
  for (const r of step.rules ?? []) {
    if (r.type === 'oneOf' && !r.fields.some((id) => isFilled(eff[id]))) {
      for (const id of r.fields) if (!errs[id]) errs[id] = r.message;
    }
    if (r.type === 'dateOrder') {
      const a = asString(eff[r.from]);
      const b = asString(eff[r.to]);
      if (a && b && a > b && !errs[r.to]) errs[r.to] = r.message;
    }
  }
  return errs;
}

const optionLabel = (f: InputField, v: string): string =>
  ('options' in f ? f.options.find((o) => o.value === v)?.label : undefined) ?? v;

export function formatValue(f: InputField, v: FieldValue): string {
  const s = asString(v);
  switch (f.type) {
    case 'checks':
      return asStrings(v).map((x) => optionLabel(f, x)).join('、');
    case 'radio':
    case 'select':
      return optionLabel(f, s);
    case 'checkbox':
      return 'はい';
    case 'range':
      return isRange(v) ? `${v.min || '（指定なし）'} 〜 ${v.max || '（指定なし）'} ${f.unit}` : '';
    case 'number':
      return f.unit ? `${s}${f.unit}` : s;
    case 'birthdate': {
      const [y, m, d] = s.split('/');
      return d ? `${y}年${Number(m)}月${Number(d)}日` : s;
    }
    case 'date': {
      const [y, m, d] = s.split('-');
      return `${y}年${Number(m)}月${Number(d)}日`;
    }
    case 'month': {
      const [y, m] = s.split('-');
      return `${y}年${Number(m)}月`;
    }
    case 'datetime-local': {
      const [date, time] = s.split('T');
      const [y, m, d] = date.split('-');
      return `${y}年${Number(m)}月${Number(d)}日 ${time}`;
    }
    default:
      return s;
  }
}

function* allFields(fields: Field[]): Generator<Field> {
  for (const f of fields) {
    yield f;
    if (f.type === 'section') yield* allFields(f.fields);
  }
}

/**
 * 行を追加できる項目の1行目を、ほかの項目の入力に追従させる（例：代表者のお名前を参加者1人目に入れる）。
 * 1行目の値が空か、元の項目の直前の値と同じ（＝利用者が書き換えていない）ときだけ追従する。
 */
export function syncFirstRows(schema: Schema, prev: Values, next: Values): Values {
  let out = next;
  for (const step of schema.steps) {
    for (const f of allFields(step.fields)) {
      if (f.type !== 'repeater' || !f.firstRowFrom) continue;
      const rows = asRows(out[f.id]);
      if (!rows.length) continue;
      let first = rows[0];
      for (const [sub, src] of Object.entries(f.firstRowFrom)) {
        const before = asString(prev[src]);
        const after = asString(out[src]);
        const current = first[sub] ?? '';
        if (before !== after && (current === '' || current === before)) first = { ...first, [sub]: after };
      }
      if (first !== rows[0]) out = { ...out, [f.id]: [first, ...rows.slice(1)] };
    }
  }
  return out;
}

/** 確認画面用：表示中で入力済みの項目だけを、見出しのまとまりごとに取り出す */
export function summarize(fields: Field[], eff: Values, values: Values): SummaryEntry[] {
  const out: SummaryEntry[] = [];
  for (const f of fields) {
    if (!evalCond(f.show, eff) || f.type === 'note') continue;
    if (f.type === 'section') {
      const items = summarize(f.fields, eff, values);
      if (items.length) out.push({ heading: f.label, items });
      continue;
    }
    if (f.type === 'repeater') {
      asRows(values[f.id]).forEach((row, i) => {
        const parts = f.fields
          .filter((sf) => evalCond(sf.show, eff) && isFilled(row[sf.id]))
          .map((sf) => `${sf.label}：${formatValue(sf, row[sf.id])}`);
        if (parts.length) out.push({ label: `${f.rowLabel} ${i + 1}`, text: parts.join(' ／ ') });
      });
      continue;
    }
    const v = values[f.id];
    if (v !== undefined && isFilled(v)) out.push({ label: f.label, text: formatValue(f, v) });
  }
  return out;
}

/** 送信用：表示中で入力済みの値だけを集める（空の行は除く） */
export function buildPayload(eff: Values): Payload {
  const data: Values = {};
  for (const [k, v] of Object.entries(eff)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
      const rows = asRows(v).filter((row) => Object.values(row).some((x) => x.trim() !== ''));
      if (rows.length) data[k] = rows;
    } else if (isFilled(v)) {
      data[k] = v;
    }
  }
  return { submittedAt: new Date().toISOString(), data };
}
