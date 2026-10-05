import { cx } from '../form/utils.ts';

interface ProgressProps {
  labels: string[];
  current: number;
  onJump: (index: number) => void;
}

/** 入力の進み具合。丸が線でつながっていく */
export function Progress({ labels, current, onJump }: ProgressProps) {
  const inset = `calc(100% / ${labels.length} / 2)`;
  return (
    <nav aria-label="入力の進み具合" className="mt-8 mb-9 sm:mb-5">
      <ol className="relative flex">
        <li aria-hidden="true" className="absolute top-4 h-0.5 bg-line sm:top-5.5" style={{ left: inset, right: inset }} />
        {labels.map((label, i) => {
          const state = i < current ? 'done' : i === current ? 'now' : 'todo';
          const inner = (
            <>
              <span
                aria-hidden="true"
                className={cx(
                  'relative z-10 grid size-8.5 place-items-center rounded-full border-2 font-round text-sm font-bold transition sm:size-11 sm:text-base motion-reduce:transition-none',
                  state === 'done' && 'border-accent bg-accent-soft text-accent',
                  state === 'now' && 'scale-110 border-accent bg-accent text-accent-ink ring-5 ring-sun-soft',
                  state === 'todo' && 'border-line bg-surface text-muted',
                )}
              >
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span
                className={cx(
                  'text-xs whitespace-nowrap',
                  state === 'now' ? 'absolute top-11 font-bold text-ink sm:static' : 'hidden text-muted sm:block',
                )}
              >
                {label}
              </span>
            </>
          );
          return (
            <li key={label} aria-current={state === 'now' ? 'step' : undefined} className="relative flex flex-1 justify-center">
              {state === 'done' ? (
                <button
                  type="button"
                  onClick={() => onJump(i)}
                  aria-label={`${label}に戻る`}
                  className="flex flex-col items-center gap-1.5 rounded-lg"
                >
                  {inner}
                </button>
              ) : (
                <span className="flex flex-col items-center gap-1.5">{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
