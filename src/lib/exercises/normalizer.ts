export type ExerciseSearchInput = {
  query?: string | null;
  bodyPart?: string | null;
  target?: string | null;
  equipment?: string | null;
  limit?: number | null;
  offset?: number | null;
};

export type NormalizedExerciseSearch = {
  query?: string;
  name?: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  limit: number;
  offset: number;
};

export const DEFAULT_EQUIPMENT_VOCABULARY = [
  "assisted",
  "band",
  "barbell",
  "body weight",
  "bosu ball",
  "cable",
  "dumbbell",
  "elliptical machine",
  "ez barbell",
  "hammer",
  "kettlebell",
  "leverage machine",
  "medicine ball",
  "olympic barbell",
  "resistance band",
  "roller",
  "rope",
  "skierg machine",
  "sled machine",
  "smith machine",
  "stability ball",
  "stationary bike",
  "stepmill machine",
  "tire",
  "trap bar",
  "upper body ergometer",
  "weighted",
  "wheel roller",
];

const EQUIPMENT_SYNONYMS: Record<string, string> = {
  哑铃: "dumbbell",
  dumbbell: "dumbbell",
  dumbbells: "dumbbell",
  杠铃: "barbell",
  barbell: "barbell",
  自重: "body weight",
  徒手: "body weight",
  无器械: "body weight",
  体重: "body weight",
  bodyweight: "body weight",
  "body weight": "body weight",
  壶铃: "kettlebell",
  kettlebell: "kettlebell",
  弹力带: "resistance band",
  阻力带: "resistance band",
  resistanceband: "resistance band",
  "resistance band": "resistance band",
  绳索: "cable",
  龙门架: "cable",
  cable: "cable",
  史密斯: "smith machine",
  smith: "smith machine",
  "smith machine": "smith machine",
  瑜伽球: "stability ball",
  健身球: "stability ball",
  "stability ball": "stability ball",
  药球: "medicine ball",
  "medicine ball": "medicine ball",
  跑步机: "treadmill",
  单车: "stationary bike",
  "stationary bike": "stationary bike",
};

const BODY_PART_SYNONYMS: Record<string, string> = {
  胸: "chest",
  胸部: "chest",
  胸肌: "chest",
  chest: "chest",
  背: "back",
  背部: "back",
  back: "back",
  肩: "shoulders",
  肩部: "shoulders",
  shoulders: "shoulders",
  手臂: "upper arms",
  上臂: "upper arms",
  二头: "upper arms",
  三头: "upper arms",
  "upper arms": "upper arms",
  前臂: "lower arms",
  小臂: "lower arms",
  "lower arms": "lower arms",
  腿: "upper legs",
  大腿: "upper legs",
  臀腿: "upper legs",
  "upper legs": "upper legs",
  小腿: "lower legs",
  "lower legs": "lower legs",
  腰: "waist",
  腹: "waist",
  核心: "waist",
  腹肌: "waist",
  waist: "waist",
  脖子: "neck",
  颈部: "neck",
  neck: "neck",
  有氧: "cardio",
  心肺: "cardio",
  cardio: "cardio",
};

const TARGET_SYNONYMS: Record<string, string> = {
  外展肌: "abductors",
  髋外展肌: "abductors",
  abductors: "abductors",
  腹肌: "abs",
  腹直肌: "abs",
  腹斜肌: "abs",
  abs: "abs",
  内收肌: "adductors",
  大腿内侧: "adductors",
  adductors: "adductors",
  二头: "biceps",
  肱二头: "biceps",
  biceps: "biceps",
  三头: "triceps",
  肱三头: "triceps",
  triceps: "triceps",
  胸肌: "pectorals",
  pectorals: "pectorals",
  臀: "glutes",
  臀肌: "glutes",
  glutes: "glutes",
  股四头: "quads",
  quads: "quads",
  腘绳肌: "hamstrings",
  hamstrings: "hamstrings",
  小腿: "calves",
  calves: "calves",
  背阔肌: "lats",
  lats: "lats",
  上背: "upper back",
  上背部: "upper back",
  "upper back": "upper back",
  三角肌: "delts",
  delts: "delts",
  前臂: "forearms",
  小臂: "forearms",
  forearms: "forearms",
  斜方肌: "traps",
  traps: "traps",
  下背: "spine",
  下背部: "spine",
  竖脊肌: "spine",
  spine: "spine",
};

export function normalizeExerciseQuery(input: ExerciseSearchInput): NormalizedExerciseSearch {
  const rawQuery = compact(input.query);
  const normalized: NormalizedExerciseSearch = {
    limit: clamp(input.limit ?? 10, 1, 10),
    offset: Math.max(input.offset ?? 0, 0),
  };

  const explicitEquipment = normalizeByMap(input.equipment, EQUIPMENT_SYNONYMS);
  const explicitBodyPart = normalizeByMap(input.bodyPart, BODY_PART_SYNONYMS);
  const explicitTarget = normalizeByMap(input.target, TARGET_SYNONYMS);

  const inferredEquipment = inferFromText(rawQuery, EQUIPMENT_SYNONYMS);
  const inferredBodyPart = inferFromText(rawQuery, BODY_PART_SYNONYMS);
  const inferredTarget = inferFromText(rawQuery, TARGET_SYNONYMS);

  normalized.equipment = explicitEquipment ?? inferredEquipment;
  normalized.bodyPart = explicitBodyPart ?? inferredBodyPart;
  normalized.target = explicitTarget ?? inferredTarget;

  if (rawQuery) {
    normalized.query = rawQuery;
    const stripped = stripKnownTerms(rawQuery, [EQUIPMENT_SYNONYMS, BODY_PART_SYNONYMS, TARGET_SYNONYMS]);
    if (stripped && !normalized.bodyPart && !normalized.target && !normalized.equipment) {
      normalized.name = stripped;
    }
  }

  return normalized;
}

export function buildExerciseCacheKey(search: NormalizedExerciseSearch) {
  return JSON.stringify({
    bodyPart: search.bodyPart ?? null,
    target: search.target ?? null,
    equipment: search.equipment ?? null,
    name: search.name ?? null,
    query: search.query ?? null,
    limit: search.limit,
    offset: search.offset,
  });
}

export function filterExercisesLocal<T extends { name: string; bodyPart: string; target: string; equipment: string }>(
  exercises: T[],
  search: NormalizedExerciseSearch,
): T[] {
  return exercises.filter((exercise) => {
    if (search.bodyPart && norm(exercise.bodyPart) !== norm(search.bodyPart)) return false;
    if (search.target && norm(exercise.target) !== norm(search.target)) return false;
    if (search.equipment && norm(exercise.equipment) !== norm(search.equipment)) return false;
    if (search.name && !norm(exercise.name).includes(norm(search.name))) return false;
    return true;
  });
}

export function normalizeEquipmentLabel(value: string | null | undefined) {
  return normalizeByMap(value, EQUIPMENT_SYNONYMS) ?? compact(value)?.toLowerCase();
}

export function matchEquipmentVocabulary(value: string, vocabulary: string[]) {
  const normalized = normalizeEquipmentLabel(value);
  if (!normalized) return undefined;
  const exact = vocabulary.find((item) => norm(item) === norm(normalized));
  if (exact) return exact;
  return vocabulary.find((item) => norm(item).includes(norm(normalized)) || norm(normalized).includes(norm(item)));
}

function normalizeByMap(value: string | null | undefined, map: Record<string, string>) {
  const cleaned = compact(value);
  if (!cleaned) return undefined;
  const lowered = cleaned.toLowerCase();
  return map[cleaned] ?? map[lowered] ?? map[lowered.replace(/\s+/g, "")];
}

function inferFromText(text: string | undefined, map: Record<string, string>) {
  if (!text) return undefined;
  const lowered = text.toLowerCase();
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  for (const [key, value] of entries) {
    if (lowered.includes(key.toLowerCase())) return value;
  }
  return undefined;
}

function stripKnownTerms(text: string, maps: Record<string, string>[]) {
  let output = text;
  for (const map of maps) {
    for (const key of Object.keys(map).sort((a, b) => b.length - a.length)) {
      output = output.replace(new RegExp(escapeRegExp(key), "gi"), " ");
    }
  }
  output = output.replace(/[，。,.!！?？、]/g, " ").replace(/\s+/g, " ").trim();
  const stopWords = ["在家", "练", "训练", "动作", "用", "使用", "想", "我要", "需要", "适合", "查询", "推荐"];
  for (const word of stopWords) output = output.replaceAll(word, " ");
  return output.replace(/\s+/g, " ").trim();
}

function compact(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") || undefined;
}

function norm(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
