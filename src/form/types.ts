/** 表示条件・必須条件。JSON にそのまま書き出せる形にしてあり、サーバー側の検証でも同じ定義を使える */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { field: string; includes: string }
  | { field: string; only: string }
  | { field: string; equals: string }
  | { field: string; in: string[] }
  | { field: string; filled: boolean };

export interface Option {
  value: string;
  label: string;
  desc?: string;
  /** 選択肢の横に添える短い補足（例：オンライン相談も可） */
  badge?: string;
}

export interface RangeValue {
  min: string;
  max: string;
}

export type RowValue = Record<string, string>;
export type FieldValue = string | string[] | boolean | RangeValue | RowValue[];
export type Values = Record<string, FieldValue | undefined>;
export type Errors = Record<string, string>;

interface BaseField {
  id: string;
  label: string;
  show?: Condition;
  required?: boolean | Condition;
  requiredMessage?: string;
  hint?: string;
  width?: 'half' | 'quarter';
}

export interface TextField extends BaseField {
  type: 'text' | 'email' | 'tel' | 'date' | 'month' | 'datetime-local';
  autoComplete?: string;
}
export interface TextareaField extends BaseField {
  type: 'textarea';
  rows?: number;
}
export interface NumberField extends BaseField {
  type: 'number';
  unit?: string;
  min?: number;
  max?: number;
}
export interface SelectField extends BaseField {
  type: 'select';
  options: Option[];
}
export interface RadioField extends BaseField {
  type: 'radio';
  options: Option[];
  variant?: 'cards';
  /** 初期状態で選ばれている値 */
  defaultValue?: string;
}
export interface ChecksField extends BaseField {
  type: 'checks';
  options: Option[];
  variant?: 'cards';
}
export interface CheckboxField extends BaseField {
  type: 'checkbox';
}
/** 8桁の数字を入力すると YYYY/MM/DD に自動整形される */
export interface BirthdateField extends BaseField {
  type: 'birthdate';
}
export interface RangeField extends BaseField {
  type: 'range';
  unit: string;
}

/** 値を持つ入力項目 */
export type InputField =
  | TextField
  | TextareaField
  | NumberField
  | SelectField
  | RadioField
  | ChecksField
  | CheckboxField
  | BirthdateField
  | RangeField;

/** 行を追加・削除できる項目（同行者、候補日時など）。行の中身は文字列の値を持つ項目に限る */
export interface RepeaterField {
  type: 'repeater';
  id: string;
  label: string;
  show?: Condition;
  hint?: string;
  min?: number;
  max?: number;
  rowLabel: string;
  addLabel: string;
  /** 1行目の見出しに添える名前（例：代表者） */
  firstRowLabel?: string;
  /** 1行目の初期値 */
  firstRow?: RowValue;
  /** 1行目の項目を、ほかの項目の入力に追従させる（例：{ name: 'name' }）。利用者が書き換えたら追従をやめる */
  firstRowFrom?: Record<string, string>;
  fields: (TextField | TextareaField | SelectField | BirthdateField)[];
}

/** 見出し付きのまとまり。show が偽なら中身ごと非表示 */
export interface SectionField {
  type: 'section';
  id: string;
  label: string;
  show?: Condition;
  fields: Field[];
}

export interface NoteField {
  type: 'note';
  id: string;
  text: string;
  show?: Condition;
}

export type Field = InputField | RepeaterField | SectionField | NoteField;

export type Rule =
  | { type: 'oneOf'; fields: string[]; message: string }
  | { type: 'dateOrder'; from: string; to: string; message: string };

export interface Step {
  id: string;
  /** 進み具合の表示に使う短い名前 */
  short: string;
  title: string;
  lead?: string;
  show?: Condition;
  rules?: Rule[];
  fields: Field[];
}

export interface Schema {
  steps: Step[];
}

export interface SummaryItem {
  label: string;
  text: string;
}
export interface SummaryGroup {
  heading: string;
  items: SummaryEntry[];
}
export type SummaryEntry = SummaryItem | SummaryGroup;

export interface Payload {
  submittedAt: string;
  data: Values;
}
