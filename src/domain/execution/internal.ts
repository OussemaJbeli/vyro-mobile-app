import { activeMs } from './time';
import { type DbChange, type ExecState, type SideEffect, type Transition } from './types';

/** Mutable builder for one transition. The reducer never mutates the input state. */
export class Draft {
  state: ExecState;
  changes: DbChange[] = [];
  effects: SideEffect[] = [];
  caughtUp = 0;
  private dirty = false;

  constructor(
    private readonly base: ExecState,
    readonly now: number,
  ) {
    this.state = base;
  }

  /** Copy-on-write update of the top-level state. */
  update(patch: Partial<ExecState>) {
    this.state = { ...this.state, ...patch };
    this.dirty = true;
  }

  change(c: DbChange) {
    this.changes.push(c);
  }

  effect(e: SideEffect) {
    this.effects.push(e);
  }

  get active() {
    return activeMs(this.state, this.now);
  }

  done(): Transition {
    return {
      state: this.dirty ? this.state : this.base,
      changes: this.changes,
      effects: this.effects,
      caughtUp: this.caughtUp,
    };
  }
}

export const secs = (ms: number) => Math.max(0, Math.round(ms / 1000));
