import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import type { WorkoutXExercise } from "@/lib/workoutx/types";
import { resolveOpenAIBaseURL } from "@/lib/ai/provider";

export type LocalizedExercise = WorkoutXExercise & {
  nameZh?: string | null;
  descriptionZh?: string | null;
  instructionsZh?: string[] | null;
  bodyPartZh?: string | null;
  targetZh?: string | null;
  equipmentZh?: string | null;
  difficultyZh?: string | null;
  categoryZh?: string | null;
  mechanicZh?: string | null;
  forceZh?: string | null;
  intensityZh?: string | null;
  jointFocusZh?: string | null;
  movementTagsZh?: string[] | null;
};

const BODY_PART_ZH: Record<string, string> = {
  back: "背部",
  cardio: "心肺",
  chest: "胸部",
  "lower arms": "前臂",
  "lower legs": "小腿",
  neck: "颈部",
  shoulders: "肩部",
  "upper arms": "上臂",
  "upper legs": "大腿/臀腿",
  waist: "腰腹/核心",
};

const EQUIPMENT_ZH: Record<string, string> = {
  assisted: "辅助器械",
  band: "弹力带",
  barbell: "杠铃",
  "body weight": "自重/徒手",
  "bosu ball": "波速球",
  cable: "绳索/龙门架",
  dumbbell: "哑铃",
  "elliptical machine": "椭圆机",
  "ez barbell": "曲杆杠铃",
  hammer: "锤式器械",
  kettlebell: "壶铃",
  "leverage machine": "固定器械",
  "medicine ball": "药球",
  "olympic barbell": "奥杆",
  "resistance band": "阻力带",
  roller: "滚轴",
  rope: "绳索",
  "smith machine": "史密斯机",
  "stability ball": "瑜伽球",
  "stationary bike": "固定单车",
  weighted: "负重",
  "wheel roller": "健腹轮",
};

const TARGET_ZH: Record<string, string> = {
  abductors: "髋外展肌",
  abs: "腹肌",
  adductors: "大腿内侧/内收肌",
  biceps: "肱二头肌",
  calves: "小腿肌群",
  "cardiovascular system": "心肺系统",
  delts: "三角肌",
  forearms: "前臂肌群",
  glutes: "臀肌",
  hamstrings: "腘绳肌",
  lats: "背阔肌",
  "levator scapulae": "颈部肌群",
  pectorals: "胸肌",
  quads: "股四头肌",
  spine: "下背/竖脊肌",
  traps: "斜方肌",
  triceps: "肱三头肌",
  "upper back": "上背部",
};

const SIMPLE_ZH: Record<string, string> = {
  beginner: "新手",
  intermediate: "中级",
  advanced: "进阶",
  strength: "力量训练",
  cardio: "有氧",
  stretching: "拉伸",
  compound: "复合动作",
  isolation: "孤立动作",
  push: "推",
  pull: "拉",
  static: "静态",
  moderate: "中等",
  gentle: "轻柔",
  vigorous: "较高",
  shoulder: "肩关节",
  elbow: "肘关节",
  knee: "膝关节",
  hip: "髋关节",
  ankle: "踝关节",
  spine: "脊柱",
  "lumbar spine": "腰椎",
};

const TAG_ZH: Record<string, string> = {
  "beginner-friendly": "新手友好",
  "controlled-movement": "动作可控",
  "joint-friendly": "关节友好",
  "minimal-equipment": "少器械",
  "low-intensity": "低强度",
};

export function addChineseLabels<T extends WorkoutXExercise>(exercise: T): T & LocalizedExercise {
  return {
    ...exercise,
    bodyPartZh: lookup(BODY_PART_ZH, exercise.bodyPart),
    targetZh: lookup(TARGET_ZH, exercise.target),
    equipmentZh: lookup(EQUIPMENT_ZH, exercise.equipment),
    difficultyZh: lookup(SIMPLE_ZH, stringField(exercise.difficulty)),
    categoryZh: lookup(SIMPLE_ZH, stringField(exercise.category)),
    mechanicZh: lookup(SIMPLE_ZH, stringField(exercise.mechanic)),
    forceZh: lookup(SIMPLE_ZH, stringField(exercise.force)),
    intensityZh: lookup(SIMPLE_ZH, stringField(exercise.intensity_level)),
    jointFocusZh: lookup(SIMPLE_ZH, stringField(exercise.joint_focus)),
    movementTagsZh: Array.isArray(exercise.movement_tags)
      ? exercise.movement_tags.map((tag) => lookup(TAG_ZH, String(tag)) ?? String(tag))
      : undefined,
  };
}

export async function addChineseDetails(exercise: WorkoutXExercise): Promise<LocalizedExercise> {
  const labeled = addChineseLabels(exercise);
  if (process.env.TRANSLATE_EXERCISES === "false" || !process.env.OPENAI_API_KEY) return labeled;

  const cached = await prisma.exerciseTranslationCache.findUnique({
    where: { exerciseId_locale: { exerciseId: exercise.id, locale: "zh-CN" } },
  });
  if (cached) {
    return {
      ...labeled,
      nameZh: cached.name,
      descriptionZh: cached.description,
      instructionsZh: cached.instructions,
    };
  }

  try {
    const translated = await translateWithOpenAI(exercise);
    await prisma.exerciseTranslationCache.upsert({
      where: { exerciseId_locale: { exerciseId: exercise.id, locale: "zh-CN" } },
      create: {
        exerciseId: exercise.id,
        locale: "zh-CN",
        provider: "openai",
        model: translated.model,
        name: translated.nameZh,
        description: translated.descriptionZh,
        instructions: translated.instructionsZh,
        raw: translated.raw,
      },
      update: {
        provider: "openai",
        model: translated.model,
        name: translated.nameZh,
        description: translated.descriptionZh,
        instructions: translated.instructionsZh,
        raw: translated.raw,
      },
    });
    return { ...labeled, ...translated };
  } catch {
    return labeled;
  }
}

async function translateWithOpenAI(exercise: WorkoutXExercise) {
  const model = process.env.OPENAI_TRANSLATION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.5";
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    ...(resolveOpenAIBaseURL() ? { baseURL: resolveOpenAIBaseURL() } : {}),
  });
  const payload = {
    name: exercise.name,
    description: stringField(exercise.description),
    instructions: Array.isArray(exercise.instructions) ? exercise.instructions : [],
  };
  const prompt = `把下面健身动作内容翻译成简洁自然的简体中文。保留专业性，不要添加原文没有的医学承诺。只返回 JSON：{"nameZh":string,"descriptionZh":string,"instructionsZh":string[]}\n${JSON.stringify(payload)}`;

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const outputText = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(outputText) as { nameZh?: string; descriptionZh?: string; instructionsZh?: string[] };
  return {
    model,
    nameZh: parsed.nameZh || exercise.name,
    descriptionZh: parsed.descriptionZh || stringField(exercise.description),
    instructionsZh: Array.isArray(parsed.instructionsZh) ? parsed.instructionsZh : exercise.instructions ?? [],
    raw: { outputText },
  };
}

function lookup(map: Record<string, string>, value: string | null | undefined) {
  const key = value?.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  return key ? map[key] : undefined;
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
