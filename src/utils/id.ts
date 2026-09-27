import { randomUUID } from 'expo-crypto';

/** UUID v4 string for every row id (AD-04). */
export const newId = (): string => randomUUID();
