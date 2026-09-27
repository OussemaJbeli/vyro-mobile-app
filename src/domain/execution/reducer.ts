import { Draft } from './internal';
import { deriveOutcome } from './outcome';
import { runSummary } from './summary';
import {
  adjustInterval,
  closeRunning,
  nextInterval,
  repeatInterval,
  settleRunning,
} from './running';
import {
  addExercise,
  addSet,
  adjustRest,
  closeStrength,
  completeSet,
  editSet,
  endRest,
  jumpTo,
  reorder,
  settleStrength,
  skipExercise,
  skipSet,
  startWorkTimer,
  substitute,
} from './strength';
import { activeMs, pausedMs } from './time';
import { type Event, type ExecState, type Transition } from './types';

/** Events still accepted while paused. Everything else waits for RESUME. */
const WHILE_PAUSED = new Set<Event['type']>([
  'RESUME',
  'EDIT_SET',
  'FINISH',
  'FINISH_EARLY',
  'ABANDON',
  'TICK',
]);

/**
 * The execution reducer (AD-11): pure and deterministic, `now` is part of every event.
 * Clock-derived work (rest expiry, timed sets, interval auto-advance) is settled first,
 * so any event, including a TICK after a kill, sees where the user should be.
 */
export function reduce(state: ExecState, event: Event): Transition {
  const d = new Draft(state, event.now);
  if (state.lifecycle === 'completed' || state.lifecycle === 'abandoned') return d.done();
  if (state.lifecycle === 'paused' && !WHILE_PAUSED.has(event.type)) return d.done();

  settle(d);

  switch (event.type) {
    case 'TICK':
      break;
    case 'SKIP_COUNTDOWN':
      // Runs start with a 3-2-1 countdown: the clock begins at startedAt (in the future).
      if (state.lifecycle === 'active' && event.now < state.startedAt) {
        d.update({
          startedAt: event.now,
          current: state.current ? { ...state.current, startedAt: event.now } : null,
        });
      }
      break;
    case 'COMPLETE_SET':
      completeSet(d, event);
      break;
    case 'EDIT_SET':
      editSet(d, event.setId, event);
      break;
    case 'SKIP_SET':
      skipSet(d);
      break;
    case 'ADD_SET':
      addSet(d, event.id);
      break;
    case 'SKIP_EXERCISE':
      skipExercise(d);
      break;
    case 'SUBSTITUTE_EXERCISE':
      substitute(d, event.exerciseId, event.tracking, event.reason, event.exerciseIndex);
      break;
    case 'JUMP_TO_EXERCISE':
      jumpTo(d, event.index);
      break;
    case 'REORDER_REMAINING':
      reorder(d, event.order);
      break;
    case 'ADD_EXERCISE':
      addExercise(d, event);
      break;
    case 'SET_CIRCUIT':
      if (state.circuit !== event.on) d.update({ circuit: event.on });
      break;
    case 'REST_SKIP':
      endRest(d);
      break;
    case 'REST_ADJUST':
      adjustRest(d, event.deltaMs);
      settle(d);
      break;
    case 'START_WORK_TIMER':
      startWorkTimer(d);
      break;
    case 'STOP_WORK_TIMER':
      if (d.state.workTimer) completeSet(d, {});
      break;
    case 'INTERVAL_NEXT':
      nextInterval(d);
      break;
    case 'INTERVAL_REPEAT':
      repeatInterval(d, event.id);
      break;
    case 'INTERVAL_ADJUST_SPEED':
      adjustInterval(d, { speedKmh: event.speedKmh });
      break;
    case 'INTERVAL_ADJUST_INCLINE':
      adjustInterval(d, { inclinePercent: event.inclinePercent });
      break;
    case 'INTERVAL_ADJUST_DURATION':
      adjustInterval(d, { deltaSeconds: event.deltaSeconds });
      settle(d);
      break;
    case 'PAUSE':
      if (state.lifecycle === 'active') {
        d.update({ lifecycle: 'paused', pausedAt: Math.max(event.now, state.startedAt) });
        d.effect({ kind: 'keepAwake', on: false });
      }
      break;
    case 'RESUME':
      if (state.pausedAt !== null) {
        d.update({
          lifecycle: 'active',
          pausedAt: null,
          accumulatedPauseMs: state.accumulatedPauseMs + Math.max(0, event.now - state.pausedAt),
        });
        d.effect({ kind: 'keepAwake', on: true });
      }
      break;
    case 'FINISH':
    case 'FINISH_EARLY':
      finish(d);
      break;
    case 'ABANDON':
      d.update({ lifecycle: 'abandoned', rest: null, workTimer: null });
      d.change({ kind: 'abandon', endedAt: event.now });
      d.effect({ kind: 'keepAwake', on: false });
      break;
  }
  return d.done();
}

function settle(d: Draft) {
  if (d.state.kind === 'running') settleRunning(d);
  else settleStrength(d);
}

function finish(d: Draft) {
  if (d.state.kind === 'running') closeRunning(d);
  else closeStrength(d);
  const active = activeMs(d.state, d.now);
  const paused = pausedMs(d.state, d.now);
  d.update({ lifecycle: 'completed' });
  d.change({
    kind: 'complete',
    outcome: deriveOutcome(d.state),
    distanceKm: d.state.kind === 'running' ? roundKm(runSummary(d.state).distanceKm) : null,
    endedAt: d.now,
    activeSeconds: Math.round(active / 1000),
    pausedSeconds: Math.round(paused / 1000),
  });
  d.effect({ kind: 'haptic', style: 'success' });
  d.effect({ kind: 'keepAwake', on: false });
}

const roundKm = (km: number) => Math.round(km * 1000) / 1000;
