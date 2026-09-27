import {
  type PlannedSnapshot,
  type TemplateExercise,
  type TemplateInterval,
  type WorkoutTemplate,
} from '@/types/domain';

import { type Tracking } from './types';

type TemplateLike = Pick<WorkoutTemplate, 'id' | 'name' | 'type'> & {
  exercises: TemplateExercise[];
  intervals: TemplateInterval[];
};

/** Freezes a template into the planned snapshot stored with the execution (AD-07). */
export function buildSnapshot(
  template: TemplateLike,
  exercise: (id: string) => { name: string; tracking: Tracking } | undefined,
): PlannedSnapshot {
  return {
    schemaVersion: 1,
    templateId: template.id,
    name: template.name,
    type: template.type,
    exercises: [...template.exercises]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((e, orderIndex) => {
        const meta = exercise(e.exerciseId);
        return {
          exerciseId: e.exerciseId,
          name: meta?.name ?? e.exerciseId,
          tracking: meta?.tracking ?? 'weight_reps',
          orderIndex,
          sets: e.sets,
          targetReps: e.targetReps,
          targetDurationSeconds: e.targetDurationSeconds,
          targetWeightKg: e.targetWeightKg,
          restSeconds: e.restSeconds,
          notes: e.notes,
        };
      }),
    intervals: [...template.intervals]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((iv, orderIndex) => ({
        orderIndex,
        kind: iv.kind,
        durationSeconds: iv.durationSeconds,
        speedKmh: iv.speedKmh,
        inclinePercent: iv.inclinePercent,
        label: iv.label,
      })),
  };
}
