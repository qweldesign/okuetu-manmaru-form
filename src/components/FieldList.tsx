import type { Errors, Field, FieldValue, Values } from '../form/types.ts';
import { asRows, evalCond, isRequired } from '../form/engine.ts';
import { domIdOf } from '../form/utils.ts';
import { Control } from './Control.tsx';
import { Repeater } from './Repeater.tsx';

interface FieldListProps {
  fields: Field[];
  eff: Values;
  values: Values;
  setVal: (id: string, v: FieldValue) => void;
  errors: Errors;
}

export function FieldList({ fields, eff, values, setVal, errors }: FieldListProps) {
  return fields.map((f) => {
    if (!evalCond(f.show, eff)) return null;

    if (f.type === 'note') {
      return (
        <p key={f.id} className="col-span-full rounded-[14px] bg-accent-soft px-4 py-3 text-sm leading-relaxed">
          {f.text}
        </p>
      );
    }

    if (f.type === 'section') {
      return (
        <fieldset
          key={f.id}
          className="col-span-full animate-open border-l-3 border-accent py-1 pl-4.5 motion-reduce:animate-none"
        >
          <legend className="mb-3.5 font-round text-lg font-bold text-accent">{f.label}</legend>
          <div className="grid grid-cols-4 gap-x-4.5 gap-y-5.5">
            <FieldList fields={f.fields} eff={eff} values={values} setVal={setVal} errors={errors} />
          </div>
        </fieldset>
      );
    }

    if (f.type === 'repeater') {
      return (
        <Repeater
          key={f.id}
          f={f}
          rows={asRows(values[f.id])}
          setRows={(rows) => setVal(f.id, rows)}
          eff={eff}
          errors={errors}
        />
      );
    }

    return (
      <Control
        key={f.id}
        f={f}
        value={values[f.id]}
        onChange={(v) => setVal(f.id, v)}
        error={errors[f.id]}
        domId={domIdOf(f.id)}
        required={isRequired(f, eff)}
      />
    );
  });
}
