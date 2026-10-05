import type { Errors, RepeaterField, RowValue, Values } from '../form/types.ts';
import { evalCond, isRequired } from '../form/engine.ts';
import { domIdOf } from '../form/utils.ts';
import { Control } from './Control.tsx';

interface RepeaterProps {
  f: RepeaterField;
  rows: RowValue[];
  setRows: (rows: RowValue[]) => void;
  eff: Values;
  errors: Errors;
}

export function Repeater({ f, rows, setRows, eff, errors }: RepeaterProps) {
  const domId = domIdOf(f.id);
  const min = f.min ?? 0;
  const max = f.max ?? 99;
  const update = (i: number, key: string, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));

  return (
    <fieldset id={domId} tabIndex={-1} className="col-span-full flex flex-col gap-3 outline-none">
      <legend className="mb-1.5 font-bold">{f.label}</legend>
      {f.hint && <p className="text-sm leading-relaxed text-muted">{f.hint}</p>}

      {rows.map((row, i) => (
        <div key={i} className="rounded-[20px] border-[1.5px] border-dashed border-line px-4.5 pt-4 pb-5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="font-round font-bold">
              {f.rowLabel} {i + 1}
              {i === 0 && f.firstRowLabel && <span className="ml-1 text-sm font-normal text-muted">（{f.firstRowLabel}）</span>}
            </span>
            {i >= min && (
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="px-0.5 py-1 text-sm text-accent underline underline-offset-3"
              >
                {f.rowLabel} {i + 1} を削除
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-x-4.5 gap-y-5">
            {f.fields
              .filter((sf) => evalCond(sf.show, eff))
              .map((sf) => {
                const key = `${f.id}.${i}.${sf.id}`;
                return (
                  <Control
                    key={sf.id}
                    f={{ ...sf, width: 'half' }}
                    value={row[sf.id]}
                    onChange={(v) => update(i, sf.id, typeof v === 'string' ? v : '')}
                    error={errors[key]}
                    domId={domIdOf(key)}
                    required={isRequired(sf, eff)}
                  />
                );
              })}
          </div>
        </div>
      ))}

      {rows.length < max && (
        <button
          type="button"
          onClick={() => setRows([...rows, {}])}
          className="self-start rounded-full border-[1.5px] border-accent px-5 py-2.5 font-bold text-accent hover:bg-accent-soft"
        >
          ＋ {f.addLabel}
        </button>
      )}
      {errors[f.id] && <p className="text-sm font-bold text-danger">{errors[f.id]}</p>}
    </fieldset>
  );
}
