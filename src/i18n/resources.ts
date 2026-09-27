import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';
import enExecution from './locales/en/execution.json';
import enEquipment from './locales/en/equipment.json';
import enExercises from './locales/en/exercises.json';
import enGoals from './locales/en/goals.json';
import enHome from './locales/en/home.json';
import enNav from './locales/en/nav.json';
import enOnboarding from './locales/en/onboarding.json';
import enPlaceholder from './locales/en/placeholder.json';
import enPlan from './locales/en/plan.json';
import enProgress from './locales/en/progress.json';
import enRunning from './locales/en/running.json';
import enSeed from './locales/en/seed.json';
import enSettings from './locales/en/settings.json';
import enStatus from './locales/en/status.json';
import enTrain from './locales/en/train.json';
import frCommon from './locales/fr/common.json';
import frErrors from './locales/fr/errors.json';
import frExecution from './locales/fr/execution.json';
import frEquipment from './locales/fr/equipment.json';
import frExercises from './locales/fr/exercises.json';
import frGoals from './locales/fr/goals.json';
import frHome from './locales/fr/home.json';
import frNav from './locales/fr/nav.json';
import frOnboarding from './locales/fr/onboarding.json';
import frPlaceholder from './locales/fr/placeholder.json';
import frPlan from './locales/fr/plan.json';
import frProgress from './locales/fr/progress.json';
import frRunning from './locales/fr/running.json';
import frSeed from './locales/fr/seed.json';
import frSettings from './locales/fr/settings.json';
import frStatus from './locales/fr/status.json';
import frTrain from './locales/fr/train.json';

/**
 * One namespace per feature (step 06). Later steps add their namespace here
 * (train, plan, progress, …) in both languages; the parity test enforces matching keys.
 */
export const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    status: enStatus,
    placeholder: enPlaceholder,
    home: enHome,
    execution: enExecution,
    settings: enSettings,
    errors: enErrors,
    seed: enSeed,
    onboarding: enOnboarding,
    goals: enGoals,
    equipment: enEquipment,
    exercises: enExercises,
    train: enTrain,
    running: enRunning,
    plan: enPlan,
    progress: enProgress,
  },
  fr: {
    common: frCommon,
    nav: frNav,
    status: frStatus,
    placeholder: frPlaceholder,
    home: frHome,
    execution: frExecution,
    settings: frSettings,
    errors: frErrors,
    seed: frSeed,
    onboarding: frOnboarding,
    goals: frGoals,
    equipment: frEquipment,
    exercises: frExercises,
    train: frTrain,
    running: frRunning,
    plan: frPlan,
    progress: frProgress,
  },
} as const;

export type Language = keyof typeof resources;
export const languages = Object.keys(resources) as Language[];
export const namespaces = Object.keys(resources.en) as (keyof (typeof resources)['en'])[];
