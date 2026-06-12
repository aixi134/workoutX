import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { WorkoutXClient, WorkoutXApiError } from "@/lib/workoutx/client";
import type { WorkoutXExercise, WorkoutXResponse, WorkoutXUsage } from "@/lib/workoutx/types";
import { addChineseDetails, addChineseLabels } from "@/lib/i18n/exercise";
import {
  buildExerciseCacheKey,
  filterExercisesLocal,
  normalizeEquipmentLabel,
  normalizeExerciseQuery,
  type ExerciseSearchInput,
  type NormalizedExerciseSearch,
} from "./normalizer";

export type ExerciseSearchResult = {
  exercises: WorkoutXExercise[];
  normalized: NormalizedExerciseSearch;
  cacheHit: boolean;
  source: "cache" | "workoutx";
  usage?: WorkoutXUsage;
};

type ExercisePageFetcher = (params: { limit: number; offset: number }) => Promise<WorkoutXResponse<WorkoutXExercise[]>>;

export async function searchExercises(
  input: ExerciseSearchInput,
  client = new WorkoutXClient(),
): Promise<ExerciseSearchResult> {
  const normalized = normalizeExerciseQuery(input);
  const cacheKey = buildExerciseCacheKey(normalized);
  const cached = await prisma.exerciseQueryCache.findUnique({ where: { cacheKey } });

  if (cached && cached.expiresAt > new Date()) {
    const cachedExercises = await prisma.exercise.findMany({ where: { id: { in: cached.exerciseIds } } });
    const byId = new Map(cachedExercises.map((exercise) => [exercise.id, dbExerciseToWorkoutX(exercise)]));
    return {
      exercises: (cached.exerciseIds.map((id) => byId.get(id)).filter(Boolean) as WorkoutXExercise[]).map(addChineseLabels),
      normalized,
      cacheHit: true,
      source: "cache",
      usage: (cached.rateLimit as WorkoutXUsage | null) ?? undefined,
    };
  }

  const response = await fetchCandidatesFromWorkoutX(normalized, client);
  const filtered = response.data.slice(0, normalized.limit);
  await persistExercises(filtered);
  const displayExercises = filtered.map(addChineseLabels);

  const expiresAt = new Date(Date.now() + getQueryCacheTtlHours() * 60 * 60 * 1000);
  await prisma.exerciseQueryCache.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      params: normalized as unknown as Prisma.InputJsonValue,
      exerciseIds: filtered.map((exercise) => exercise.id),
      rateLimit: response.usage as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
    update: {
      params: normalized as unknown as Prisma.InputJsonValue,
      exerciseIds: filtered.map((exercise) => exercise.id),
      rateLimit: response.usage as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
  });

  return {
    exercises: displayExercises,
    normalized,
    cacheHit: false,
    source: "workoutx",
    usage: response.usage,
  };
}

export async function getExerciseById(id: string, client = new WorkoutXClient()) {
  const cached = await prisma.exercise.findUnique({ where: { id } });
  if (cached) return { exercise: await addChineseDetails(dbExerciseToWorkoutX(cached)), source: "cache" as const };

  const response = await client.getExercise(id);
  await persistExercises([response.data]);
  return { exercise: await addChineseDetails(canonicalizeExercise(response.data)), source: "workoutx" as const, usage: response.usage };
}

export async function getEquipmentVocabulary(client = new WorkoutXClient()) {
  try {
    const response = await client.equipmentList();
    return { equipment: response.data, usage: response.usage, source: "workoutx" as const };
  } catch (error) {
    if (error instanceof WorkoutXApiError) throw error;
    throw error;
  }
}

async function fetchCandidatesFromWorkoutX(normalized: NormalizedExerciseSearch, client: WorkoutXClient) {
  if (normalized.name) {
    const response = await client.byName(normalized.name);
    return { data: filterExercisesLocal(asExerciseArray(response.data).map(canonicalizeExercise), normalized), usage: response.usage };
  }

  const strategies = buildFreeEndpointStrategies(normalized, client);
  let lastUsage: WorkoutXUsage | undefined;
  const candidates: WorkoutXExercise[] = [];
  const seen = new Set<string>();
  const maxPages = hasMultipleFilters(normalized) ? 6 : 1;

  for (const strategy of strategies) {
    for (let page = 0; page < maxPages; page += 1) {
      const response = await strategy({ limit: 10, offset: normalized.offset + page * 10 });
      lastUsage = response.usage;
      const pageData = asExerciseArray(response.data).map(canonicalizeExercise);
      for (const exercise of filterExercisesLocal(pageData, normalized)) {
        if (seen.has(exercise.id)) continue;
        seen.add(exercise.id);
        candidates.push(exercise);
      }
      if (candidates.length >= normalized.limit) return { data: candidates, usage: lastUsage };
      if (pageData.length < 10) break;
    }
  }

  return { data: candidates, usage: lastUsage };
}

function buildFreeEndpointStrategies(normalized: NormalizedExerciseSearch, client: WorkoutXClient): ExercisePageFetcher[] {
  const strategies: ExercisePageFetcher[] = [];
  const add = (key: string, fetcher: ExercisePageFetcher) => {
    if (strategies.some((item) => String(item) === key)) return;
    Object.defineProperty(fetcher, "toString", { value: () => key });
    strategies.push(fetcher);
  };

  if (normalized.target) add(`target:${normalized.target}`, (params) => client.byTarget(normalized.target!, params));
  if (normalized.bodyPart) add(`bodyPart:${normalized.bodyPart}`, (params) => client.byBodyPart(normalized.bodyPart!, params));
  if (normalized.equipment) add(`equipment:${normalized.equipment}`, (params) => client.byEquipment(normalized.equipment!, params));
  if (!strategies.length) add("all", (params) => client.listExercises(params));
  return strategies;
}

async function persistExercises(exercises: WorkoutXExercise[]) {
  for (const rawExercise of exercises) {
    const exercise = canonicalizeExercise(rawExercise);
    await prisma.exercise.upsert({
      where: { id: exercise.id },
      create: exerciseToPrisma(exercise),
      update: exerciseToPrisma(exercise),
    });
  }
}

function exerciseToPrisma(exercise: WorkoutXExercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    bodyPart: canonicalValue(exercise.bodyPart),
    target: canonicalValue(exercise.target),
    equipment: normalizeEquipmentLabel(exercise.equipment) ?? canonicalValue(exercise.equipment),
    gifUrl: exercise.gifUrl ?? null,
    instructions: (exercise.instructions ?? []) as Prisma.InputJsonValue,
    secondaryMuscles: exercise.secondaryMuscles ?? [],
    raw: exercise as unknown as Prisma.InputJsonValue,
    cachedAt: new Date(),
  };
}

function dbExerciseToWorkoutX(exercise: {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string | null;
  instructions: Prisma.JsonValue | null;
  secondaryMuscles: string[];
  raw: Prisma.JsonValue | null;
}): WorkoutXExercise {
  const raw = typeof exercise.raw === "object" && exercise.raw !== null && !Array.isArray(exercise.raw) ? exercise.raw : {};
  return {
    ...(raw as Record<string, unknown>),
    id: exercise.id,
    name: exercise.name,
    bodyPart: exercise.bodyPart,
    target: exercise.target,
    equipment: exercise.equipment,
    gifUrl: exercise.gifUrl,
    instructions: Array.isArray(exercise.instructions) ? (exercise.instructions as string[]) : [],
    secondaryMuscles: exercise.secondaryMuscles,
  };
}

function canonicalizeExercise(exercise: WorkoutXExercise): WorkoutXExercise {
  return {
    ...exercise,
    bodyPart: canonicalValue(exercise.bodyPart),
    target: canonicalValue(exercise.target),
    equipment: normalizeEquipmentLabel(exercise.equipment) ?? canonicalValue(exercise.equipment),
    instructions: exercise.instructions ?? [],
    secondaryMuscles: exercise.secondaryMuscles ?? [],
  };
}

function asExerciseArray(value: unknown): WorkoutXExercise[] {
  return Array.isArray(value) ? (value as WorkoutXExercise[]) : [];
}

function hasMultipleFilters(search: NormalizedExerciseSearch) {
  return [search.bodyPart, search.target, search.equipment, search.name].filter(Boolean).length > 1;
}

function canonicalValue(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[\s_-]+/g, " ") ?? "";
}

function getQueryCacheTtlHours() {
  const value = Number.parseInt(process.env.QUERY_CACHE_TTL_HOURS ?? "24", 10);
  return Number.isFinite(value) && value > 0 ? value : 24;
}
