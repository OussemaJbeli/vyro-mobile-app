/** Injectable clock. Tests and the execution engine replace it to control time. */
let nowFn: () => Date = () => new Date();

export const now = (): Date => nowFn();

/** Test/dev only: fix or restore the clock. */
export function setClock(fn: (() => Date) | null) {
  nowFn = fn ?? (() => new Date());
}
