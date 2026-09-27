import { type Database } from '../client';

import { measurementRepo, weightRepo } from './body';
import { equipmentRepo } from './equipment';
import { executionRepo } from './executions';
import { exerciseRepo } from './exercises';
import { goalRepo } from './goals';
import { aiRepo } from './ai';
import { exerciseMediaRepo } from './exerciseMedia';
import { notificationRepo } from './notifications';
import { photoRepo } from './photos';
import { profileRepo } from './profile';
import { scheduleRepo } from './schedule';
import { settingsRepo } from './settings';
import { templateRepo } from './templates';

/**
 * All repositories bound to one database. Convention: methods return data or throw
 * AppError (VALIDATION, NOT_FOUND, DB_*). Mutation hooks turn errors into toasts.
 */
export function createRepositories(db: Database) {
  return {
    profile: profileRepo(db),
    settings: settingsRepo(db),
    goals: goalRepo(db),
    equipment: equipmentRepo(db),
    exercises: exerciseRepo(db),
    templates: templateRepo(db),
    schedule: scheduleRepo(db),
    executions: executionRepo(db),
    weights: weightRepo(db),
    measurements: measurementRepo(db),
    photos: photoRepo(db),
    notifications: notificationRepo(db),
    exerciseMedia: exerciseMediaRepo(db),
    ai: aiRepo(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
export type { ExerciseDetail, ExerciseFilter } from './exercises';
export type { ExecutionDetail, HistoryFilter } from './executions';
export type { TemplateDetail, TemplateFilter, TemplateInput } from './templates';
export type { Page } from './base';
