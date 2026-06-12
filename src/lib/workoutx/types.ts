export type WorkoutXExercise = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl?: string | null;
  instructions?: string[] | null;
  secondaryMuscles?: string[] | null;
  [key: string]: unknown;
};

export type WorkoutXUsage = {
  plan?: string | null;
  rateLimitLimit?: string | null;
  rateLimitRemaining?: string | null;
  quotaLimit?: string | null;
  quotaRemaining?: string | null;
  quotaReset?: string | null;
};

export type WorkoutXResponse<T> = {
  data: T;
  usage: WorkoutXUsage;
};
