/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";

type Exercise = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl?: string | null;
  instructions?: string[] | null;
  secondaryMuscles?: string[] | null;
  category?: string | null;
  difficulty?: string | null;
  mechanic?: string | null;
  force?: string | null;
  description?: string | null;
  joint_focus?: string | null;
  intensity_level?: string | null;
  movement_tags?: string[] | null;
  caloriesPerMinute?: number | null;
  met?: number | null;
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

type Usage = {
  plan?: string | null;
  rateLimitLimit?: string | null;
  rateLimitRemaining?: string | null;
  quotaLimit?: string | null;
  quotaRemaining?: string | null;
  quotaReset?: string | null;
};

type ExerciseSearchResponse = {
  exercises: Exercise[];
  normalized: Record<string, unknown>;
  cacheHit: boolean;
  source: "cache" | "workoutx";
  usage?: Usage;
};

type RecognitionCandidate = {
  equipment: string;
  confidence: number;
  reason?: string;
};

type RecognitionResponse = {
  id: string;
  provider: string;
  model: string;
  candidates: RecognitionCandidate[];
  fallback?: boolean;
  fallbackReason?: string;
};

type FocusPayload = { bodyFocus: string[]; targetFocus: string[] };

type PlanResponse = {
  plan: WeeklyPlan | null;
};

type WeeklyPlan = {
  id?: string;
  goal: string;
  level: string;
  daysPerWeek: number;
  sessionDuration: number;
  equipment: string[];
  days: PlanDay[];
};

type PlanDay = {
  id?: string;
  dayIndex: number;
  label: string;
  focus: string;
  items: PlanItem[];
};

type PlanItem = {
  id?: string;
  order: number;
  sets: number;
  reps: string;
  restSeconds: number;
  note?: string | null;
  exercise?: Exercise | null;
  exerciseSnapshot?: Partial<Exercise> | null;
};

const BODY_PART_OPTIONS = [
  ["", "不限部位"],
  ["neck", "颈部"],
  ["chest", "胸部"],
  ["back", "背部"],
  ["shoulders", "肩部"],
  ["upper arms", "上臂"],
  ["lower arms", "前臂"],
  ["upper legs", "大腿/臀腿"],
  ["lower legs", "小腿"],
  ["waist", "核心/腰腹"],
  ["cardio", "心肺"],
];

const EQUIPMENT_OPTIONS = [
  ["", "不限器材"],
  ["body weight", "自重/徒手"],
  ["dumbbell", "哑铃"],
  ["barbell", "杠铃"],
  ["kettlebell", "壶铃"],
  ["resistance band", "弹力带"],
  ["cable", "绳索/龙门架"],
  ["smith machine", "史密斯机"],
];

const MUSCLE_OPTIONS = [
  { id: "neck", label: "颈部", bodyPart: "neck", target: "" },
  { id: "pectorals", label: "胸肌", bodyPart: "chest", target: "pectorals" },
  { id: "traps", label: "斜方肌", bodyPart: "back", target: "traps" },
  { id: "lats", label: "背阔肌", bodyPart: "back", target: "lats" },
  { id: "upper-back", label: "上背", bodyPart: "back", target: "upper back" },
  { id: "lower-back", label: "下背", bodyPart: "back", target: "spine" },
  { id: "delts", label: "肩部", bodyPart: "shoulders", target: "delts" },
  { id: "biceps", label: "二头肌", bodyPart: "upper arms", target: "biceps" },
  { id: "triceps", label: "三头肌", bodyPart: "upper arms", target: "triceps" },
  { id: "abs", label: "腹直肌", bodyPart: "waist", target: "abs" },
  { id: "obliques", label: "腹斜肌", bodyPart: "waist", target: "abs" },
  { id: "glutes", label: "臀肌", bodyPart: "upper legs", target: "glutes" },
  { id: "quads", label: "股四头肌", bodyPart: "upper legs", target: "quads" },
  { id: "adductors", label: "大腿内侧", bodyPart: "upper legs", target: "adductors" },
  { id: "abductors", label: "髋外展肌", bodyPart: "upper legs", target: "abductors" },
  { id: "hamstrings", label: "腘绳肌", bodyPart: "upper legs", target: "hamstrings" },
  { id: "calves", label: "小腿", bodyPart: "lower legs", target: "calves" },
  { id: "forearms", label: "前臂", bodyPart: "lower arms", target: "forearms" },
];

const MUSCLE_GROUPS = [
  { title: "上肢推", ids: ["pectorals", "delts", "triceps"] },
  { title: "上肢拉", ids: ["traps", "lats", "upper-back", "lower-back", "biceps", "forearms"] },
  { title: "核心", ids: ["abs", "obliques"] },
  { title: "下肢", ids: ["glutes", "quads", "adductors", "abductors", "hamstrings", "calves"] },
];

const BODY_MAP_REGION_TO_MUSCLE: Record<"front" | "back", Record<string, string>> = {
  front: {
    neck: "neck",
    groin: "adductors",
    "upper-trapezius": "traps",
    "upper-pectoralis": "pectorals",
    "mid-lower-pectoralis": "pectorals",
    "anterior-deltoid": "delts",
    "lateral-deltoid": "delts",
    "long-head-bicep": "biceps",
    "short-head-bicep": "biceps",
    "wrist-extensors": "forearms",
    "wrist-flexors": "forearms",
    "upper-abdominals": "abs",
    "lower-abdominals": "abs",
    obliques: "obliques",
    "outer-quadricep": "quads",
    "rectus-femoris": "quads",
    "inner-quadricep": "quads",
    "inner-thigh": "adductors",
    gastrocnemius: "calves",
    soleus: "calves",
    tibialis: "calves",
  },
  back: {
    neck: "neck",
    "upper-trapezius": "traps",
    "traps-middle": "upper-back",
    "lower-trapezius": "upper-back",
    lats: "lats",
    lowerback: "lower-back",
    "posterior-deltoid": "delts",
    "lateral-deltoid": "delts",
    "medial-head-triceps": "triceps",
    "long-head-triceps": "triceps",
    "lateral-head-triceps": "triceps",
    "wrist-extensors": "forearms",
    "wrist-flexors": "forearms",
    "gluteus-maximus": "glutes",
    "gluteus-medius": "abductors",
    "inner-thigh": "adductors",
    "medial-hamstrings": "hamstrings",
    "lateral-hamstrings": "hamstrings",
    gastrocnemius: "calves",
    soleus: "calves",
  },
};

const BODY_MAP_UNMAPPED_REGIONS = ["feet", "hands", "body"];

const GOAL_LABEL: Record<string, string> = {
  muscle_gain: "增肌",
  strength: "力量",
  fat_loss: "减脂",
  endurance: "耐力",
  mobility: "灵活性",
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: "新手",
  intermediate: "中级",
  advanced: "进阶",
};

const PLAN_FOCUS_LABEL: Record<string, string> = {
  full_body: "全身",
  upper: "上肢",
  lower: "下肢",
  push: "推类",
  pull: "拉类",
  legs: "腿部",
  core: "核心",
  custom_focus: "自选肌群",
};

const DEFAULT_PLAN_NEED = "根据我的器材安排一周训练，优先动作标准、适合长期坚持";


export function WorkoutApp() {
  const [query, setQuery] = useState("在家用哑铃练胸");
  const [bodyPart, setBodyPart] = useState("");
  const [target, setTarget] = useState("");
  const [equipment, setEquipment] = useState("");
  const [exerciseResult, setExerciseResult] = useState<ExerciseSearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [recognition, setRecognition] = useState<RecognitionResponse | null>(null);
  const [recognitionLoading, setRecognitionLoading] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  const [goal, setGoal] = useState("muscle_gain");
  const [level, setLevel] = useState("intermediate");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [sessionDuration, setSessionDuration] = useState(45);
  const [planNeed, setPlanNeed] = useState(DEFAULT_PLAN_NEED);
  const [planEquipment, setPlanEquipment] = useState("body weight,dumbbell");
  const [selectedMuscleIds, setSelectedMuscleIds] = useState<string[]>([]);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("modal-open", Boolean(selectedExercise));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedExercise(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedExercise]);

  useEffect(() => {
    fetch("/api/plans/current")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PlanResponse | null) => {
        if (data?.plan) setPlan(data.plan);
      })
      .catch(() => undefined);
  }, []);

  const quotaText = useMemo(() => formatUsage(exerciseResult?.usage), [exerciseResult?.usage]);
  const selectedMuscles = useMemo(() => MUSCLE_OPTIONS.filter((item) => selectedMuscleIds.includes(item.id)), [selectedMuscleIds]);
  const recognizedEquipment = useMemo(
    () => recognition?.candidates.map((candidate) => candidate.equipment).filter(Boolean).slice(0, 3) ?? [],
    [recognition],
  );

  async function handleSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await runExerciseSearch({ query, bodyPart, target, equipment });
  }

  async function runExerciseSearch(params: { query?: string; bodyPart?: string; target?: string; equipment?: string }) {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const url = new URL("/api/exercises", window.location.origin);
      if (params.query) url.searchParams.set("query", params.query);
      if (params.bodyPart) url.searchParams.set("bodyPart", params.bodyPart);
      if (params.target) url.searchParams.set("target", params.target);
      if (params.equipment) url.searchParams.set("equipment", params.equipment);
      url.searchParams.set("limit", "10");
      const data = await fetchJson<ExerciseSearchResponse>(url.toString());
      setExerciseResult(data);
    } catch (error) {
      setSearchError(errorMessage(error));
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleRecognize() {
    if (!imageFile) return;
    setRecognitionLoading(true);
    setRecognitionError(null);
    try {
      const formData = new FormData();
      formData.set("image", imageFile);
      const data = await fetchJson<RecognitionResponse>("/api/ai/equipment-recognize", {
        method: "POST",
        body: formData,
      });
      setRecognition(data);
      const recognizedEquipment = data.candidates.map((candidate) => candidate.equipment).filter(Boolean).slice(0, 3);
      if (recognizedEquipment.length) {
        setEquipment(recognizedEquipment[0]);
        setPlanEquipment(recognizedEquipment.join(","));
      }
    } catch (error) {
      setRecognitionError(errorMessage(error));
    } finally {
      setRecognitionLoading(false);
    }
  }

  async function handleGeneratePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await generatePlan();
  }

  async function generatePlan(equipmentOverride?: string[]) {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const focusPayload = selectedFocusPayload();
      const data = await fetchJson<PlanResponse>("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          level,
          daysPerWeek,
          sessionDuration,
          need: planNeed,
          equipment: equipmentOverride?.length ? equipmentOverride : splitEquipment(planEquipment),
          ...focusPayload,
        }),
      });
      setPlan(data.plan);
    } catch (error) {
      setPlanError(errorMessage(error));
    } finally {
      setPlanLoading(false);
    }
  }

  async function openExerciseDetail(exercise: Exercise) {
    setSelectedExercise(exercise);
    setDetailLoading(true);
    try {
      const data = await fetchJson<{ exercise: Exercise }>(`/api/exercises/${encodeURIComponent(exercise.id)}`);
      setSelectedExercise(data.exercise);
    } catch {
      setSelectedExercise(exercise);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleMusclePick(muscleId: string) {
    const muscle = MUSCLE_OPTIONS.find((item) => item.id === muscleId);
    if (!muscle) return;
    const nextIds = selectedMuscleIds.includes(muscleId)
      ? selectedMuscleIds.filter((item) => item !== muscleId)
      : [...selectedMuscleIds, muscleId];
    setSelectedMuscleIds(nextIds);

    if (!nextIds.length) {
      setBodyPart("");
      setTarget("");
      setPlanNeed(DEFAULT_PLAN_NEED);
      return;
    }

    const activeMuscle = MUSCLE_OPTIONS.find((item) => item.id === nextIds.at(-1)) ?? muscle;
    const labels = MUSCLE_OPTIONS.filter((item) => nextIds.includes(item.id)).map((item) => item.label);
    setBodyPart(activeMuscle.bodyPart);
    setTarget(activeMuscle.target ?? "");
    setPlanNeed(`重点训练${labels.join("、")}，动作要适合我的器材`);
    const nextQuery = `${labels.join("、")} 动作`;
    setQuery(nextQuery);
    void runExerciseSearch({ query: nextQuery, bodyPart: activeMuscle.bodyPart, target: activeMuscle.target, equipment });
  }

  function selectedFocusPayload(ids = selectedMuscleIds): FocusPayload {
    const selected = MUSCLE_OPTIONS.filter((item) => ids.includes(item.id));
    return {
      bodyFocus: Array.from(new Set(selected.map((item) => item.bodyPart).filter(Boolean))),
      targetFocus: Array.from(new Set(selected.map((item) => item.target).filter(Boolean))) as string[],
    };
  }

  function applyRecognizedEquipment(candidate: RecognitionCandidate) {
    setEquipment(candidate.equipment);
    setPlanEquipment((current) => {
      const items = splitEquipment(current);
      return items.includes(candidate.equipment) ? current : [...items, candidate.equipment].join(",");
    });
    setQuery(`使用 ${candidate.equipment} 训练`);
    void runExerciseSearch({ query: `使用 ${candidate.equipment} 训练`, equipment: candidate.equipment, bodyPart, target });
  }

  return (
    <main className="app-shell">
      <nav className="top-tabs" aria-label="页面导航">
        <a href="#search">查动作</a>
        <a href="#recognize">识别器材</a>
        <a href="#plan">练计划</a>
      </nav>

      <section className="hero">
        <div className="hero-card">
          <p className="eyebrow">WorkoutX 动作库 · 中文教学 · 周计划</p>
          <h1>今天练什么？</h1>
          <p className="muted">输入目标或器材，直接看动图、步骤和训练计划。</p>
          <div className="meta-row">
            <span className="badge">API Key 仅服务端保存</span>
            <span className="badge">Free 模式每次最多 10 条</span>
            <span className="badge">训练计划本地规则生成</span>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat">
            <span className="muted">查询来源</span>
            <strong>{exerciseResult ? (exerciseResult.cacheHit ? "已缓存" : "已更新") : "输入即查"}</strong>
          </div>
          <div className="stat">
            <span className="muted">额度状态</span>
            <strong>{quotaText}</strong>
          </div>
          <div className="stat">
            <span className="muted">当前计划</span>
            <strong>{plan ? `${plan.daysPerWeek} 天/周` : "一键生成"}</strong>
          </div>
        </div>
      </section>

      <section className="grid">
        <div className="section-stack">
          <section className="panel" id="search">
            <div className="section-title"><span>01</span><h2>动作查询</h2></div>
            <form onSubmit={handleSearch}>
              <div className="form-grid">
                <label className="field full">
                  自然语言需求
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：在家用哑铃练胸" />
                </label>
                <label className="field">
                  部位
                  <select value={bodyPart} onChange={(event) => setBodyPart(event.target.value)}>
                    {BODY_PART_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  器材
                  <select value={equipment} onChange={(event) => setEquipment(event.target.value)}>
                    {EQUIPMENT_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="actions">
                <button className="primary" disabled={searchLoading} type="submit">
                  {searchLoading ? "查询中..." : "查询动作"}
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setBodyPart("");
                    setTarget("");
                    setEquipment("");
                    setSelectedMuscleIds([]);
                    setPlanNeed(DEFAULT_PLAN_NEED);
                  }}
                >
                  清空筛选
                </button>
              </div>
            </form>
            <MusclePicker
              selectedIds={selectedMuscleIds}
              onPick={handleMusclePick}
              onClear={() => {
                setSelectedMuscleIds([]);
                setBodyPart("");
                setTarget("");
                setPlanNeed(DEFAULT_PLAN_NEED);
              }}
            />
            {searchError ? <div className="alert">{searchError}</div> : null}
            {exerciseResult ? <ExerciseResults result={exerciseResult} onOpenExercise={openExerciseDetail} /> : null}
          </section>
        </div>

        <aside className="section-stack">
          <section className="panel" id="recognize">
            <div className="section-title"><span>02</span><h2>器材识别</h2></div>
            <div className="upload-box camera-box">
              <div className="camera-actions">
                <label className="camera-button primary">
                  拍照识别
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="camera-button secondary">
                  从相册选择
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/*"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              {imageFile ? <p className="selected-file">已选择：{imageFile.name}</p> : <p className="selected-file">手机上点“拍照识别”会调起后置摄像头。</p>}
              <button className="primary" type="button" disabled={!imageFile || recognitionLoading} onClick={handleRecognize}>
                {recognitionLoading ? "识别中..." : "开始识别器材"}
              </button>
            </div>
            {recognitionError ? <div className="alert">{recognitionError}</div> : null}
            {recognition ? (
              <div>
                <p className="muted" style={{ marginTop: 14 }}>
                  Provider：{recognition.provider} · Model：{recognition.model}
                  {recognition.fallback ? " · 已启用 fallback" : ""}
                </p>
                {recognition.fallback ? (
                  <div className="alert">OpenAI/兼容接口暂不可用，已返回 Mock 候选，原因：{recognition.fallbackReason}</div>
                ) : null}
                <div className="candidate-list">
                  {recognition.candidates.map((candidate) => (
                    <button className="chip" type="button" key={candidate.equipment} onClick={() => applyRecognizedEquipment(candidate)}>
                      {displayEquipmentName(candidate.equipment)} · {Math.round(candidate.confidence * 100)}%
                    </button>
                  ))}
                </div>
                <div className="quick-plan-card">
                  <strong>识别器材可直接参与计划</strong>
                  <p className="muted">
                    当前会使用：{recognizedEquipment.length ? recognizedEquipment.map(displayEquipmentName).join("、") : "暂无候选"}。再配合下方训练需求和已选肌肉生成周计划。
                  </p>
                  <div className="actions compact-actions">
                    <button
                      className="secondary"
                      type="button"
                      disabled={!recognizedEquipment.length || searchLoading}
                      onClick={() => {
                        const firstEquipment = recognizedEquipment[0];
                        void runExerciseSearch({ query: `使用 ${recognizedEquipment.join("、")} 训练`, equipment: firstEquipment, bodyPart, target });
                      }}
                    >
                      查这些器材动作
                    </button>
                    <button
                      className="primary"
                      type="button"
                      disabled={!recognizedEquipment.length || planLoading}
                      onClick={() => void generatePlan(recognizedEquipment)}
                    >
                      用这些器材生成计划
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="panel" id="plan">
            <div className="section-title"><span>03</span><h2>生成每周计划</h2></div>
            <div className="focus-summary">
              <div>
                <strong>{selectedMuscles.length ? "计划重点肌群" : "计划重点"}</strong>
                <p className="muted">
                  {selectedMuscles.length
                    ? "生成计划时会优先围绕这些肌肉选动作。"
                    : "先在“按肌肉查动作”里点选肌群，计划会自动带上重点部位。"}
                </p>
              </div>
              <div className="focus-chip-row">
                {selectedMuscles.length ? selectedMuscles.map((muscle) => <span className="focus-chip" key={muscle.id}>{muscle.label}</span>) : <span className="focus-chip empty">未选择</span>}
              </div>
            </div>
            <form onSubmit={handleGeneratePlan}>
              <div className="form-grid">
                <label className="field full">
                  训练需求
                  <input value={planNeed} onChange={(event) => setPlanNeed(event.target.value)} placeholder="例如：用刚拍到的哑铃练胸增肌" />
                </label>
                <label className="field">
                  目标
                  <select value={goal} onChange={(event) => setGoal(event.target.value)}>
                    {Object.entries(GOAL_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  等级
                  <select value={level} onChange={(event) => setLevel(event.target.value)}>
                    {Object.entries(LEVEL_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  每周天数
                  <input type="number" min={2} max={6} value={daysPerWeek} onChange={(event) => setDaysPerWeek(Number(event.target.value))} />
                </label>
                <label className="field">
                  单次时长（分钟）
                  <input
                    type="number"
                    min={20}
                    max={120}
                    value={sessionDuration}
                    onChange={(event) => setSessionDuration(Number(event.target.value))}
                  />
                </label>
                <label className="field full">
                  可用器材（逗号分隔）
                  <input value={planEquipment} onChange={(event) => setPlanEquipment(event.target.value)} placeholder="body weight,dumbbell" />
                </label>
              </div>
              <div className="actions">
                <button className="primary" disabled={planLoading} type="submit">
                  {planLoading ? "生成中..." : "生成并保存计划"}
                </button>
              </div>
            </form>
            {planError ? <div className="alert">{planError}</div> : null}
          </section>
        </aside>
      </section>

      {plan ? <PlanView plan={plan} onOpenExercise={openExerciseDetail} /> : null}

      {selectedExercise ? (
        <ExerciseDetailModal exercise={selectedExercise} loading={detailLoading} onClose={() => setSelectedExercise(null)} />
      ) : null}

      <p className="footer-note">
        本项目仅使用 WorkoutX Free 兼容端点，并通过 Postgres 缓存减少外部请求。真实运行前请复制 `.env.example` 为 `.env`，配置
        `WORKOUTX_API_KEY`、`DATABASE_URL` 和可选的 `OPENAI_API_KEY`。WorkoutX 原始数据为英文，中文教学由本服务翻译并缓存。
      </p>
    </main>
  );
}

function MusclePicker({
  selectedIds,
  onPick,
  onClear,
}: {
  selectedIds: string[];
  onPick: (id: string) => void;
  onClear: () => void;
}) {
  const selectedLabels = MUSCLE_OPTIONS.filter((item) => selectedIds.includes(item.id)).map((item) => item.label);

  return (
    <div className="muscle-picker" aria-label="按肌肉查询动作">
      <div className="picker-heading">
        <div>
          <strong>按人体图选择肌肉</strong>
          <p className="muted">点亮目标肌肉即可查询对应动作，并同步为计划重点。</p>
        </div>
        {selectedIds.length ? (
          <button className="mini-link" type="button" onClick={onClear}>
            清空肌肉
          </button>
        ) : null}
      </div>

      <div className="body-map-stage" aria-label="人体肌肉选择图">
        <div className="body-map-card">
          <span className="body-map-label">正面</span>
          <FrontBodyMap selectedIds={selectedIds} onPick={onPick} />
        </div>
        <div className="body-map-card">
          <span className="body-map-label">背面</span>
          <BackBodyMap selectedIds={selectedIds} onPick={onPick} />
        </div>
      </div>

      <div className="body-map-selected">
        <span>已选</span>
        <strong>{selectedLabels.length ? selectedLabels.join("、") : "点击上方肌肉区域"}</strong>
      </div>

      <div className="muscle-group-list">
        {MUSCLE_GROUPS.map((group) => (
          <div className="muscle-group" key={group.title}>
            <span className="muscle-group-title">{group.title}</span>
            <div className="muscle-chip-row">
              {group.ids.map((id) => {
                const muscle = MUSCLE_OPTIONS.find((item) => item.id === id);
                if (!muscle) return null;
                const active = selectedIds.includes(muscle.id);
                return (
                  <button
                    aria-pressed={active}
                    className={`muscle-chip${active ? " active" : ""}`}
                    key={muscle.id}
                    type="button"
                    onClick={() => onPick(muscle.id)}
                  >
                    <span>{muscle.label}</span>
                    <small>{lookupOptionLabel(BODY_PART_OPTIONS, muscle.bodyPart)}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FrontBodyMap({ selectedIds, onPick }: { selectedIds: string[]; onPick: (id: string) => void }) {
  return <SvgBodyMap view="front" src="/bodymaps/male-front.svg" selectedIds={selectedIds} onPick={onPick} />;
}

function BackBodyMap({ selectedIds, onPick }: { selectedIds: string[]; onPick: (id: string) => void }) {
  return <SvgBodyMap view="back" src="/bodymaps/male-back.svg" selectedIds={selectedIds} onPick={onPick} />;
}

function SvgBodyMap({
  view,
  src,
  selectedIds,
  onPick,
}: {
  view: "front" | "back";
  src: string;
  selectedIds: string[];
  onPick: (id: string) => void;
}) {
  const [svgText, setSvgText] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`无法加载人体图：${src}`))))
      .then((text) => {
        if (!cancelled) setSvgText(text);
      })
      .catch(() => {
        if (!cancelled) setSvgText("");
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const decoratedSvg = useMemo(() => decorateBodyMapSvg(svgText, view, selectedIds), [svgText, view, selectedIds]);

  function pickFromEventTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return;
    const region = target.closest<SVGGElement>("[data-muscle-id]");
    const muscleId = region?.dataset.muscleId;
    if (muscleId) onPick(muscleId);
  }

  function handleClick(event: ReactMouseEvent<HTMLDivElement>) {
    pickFromEventTarget(event.target);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    pickFromEventTarget(event.target);
  }

  if (!decoratedSvg) return <div className="body-map-loading">人体图加载中...</div>;

  return (
    <div
      className="body-map-inline"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      dangerouslySetInnerHTML={{ __html: decoratedSvg }}
    />
  );
}

function decorateBodyMapSvg(svgText: string, view: "front" | "back", selectedIds: string[]) {
  if (!svgText) return "";
  const mappedRegions = new Set(Object.keys(BODY_MAP_REGION_TO_MUSCLE[view]));
  let output = svgText
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/<svg\b([^>]*)>/i, `<svg$1 preserveAspectRatio="xMidYMid meet"><style id="workoutx-bodymap-style">${BODY_MAP_SVG_STYLE}</style>`);

  Object.entries(BODY_MAP_REGION_TO_MUSCLE[view]).forEach(([regionId, muscleId]) => {
    const muscle = MUSCLE_OPTIONS.find((item) => item.id === muscleId);
    const label = muscle?.label ?? muscleId;
    const selected = selectedIds.includes(muscleId);
    const openTagPattern = new RegExp(`<g([^>]*\\bid=["']${escapeRegExp(regionId)}["'][^>]*)>`, "gi");
    output = output.replace(openTagPattern, (match) => {
      let tag = match;
      tag = tag.replace(/\s(data-muscle-id|data-bodymap-region|role|tabindex|aria-label|aria-pressed)=("[^"]*"|'[^']*')/gi, "");
      tag = tag.replace(/class="([^"]*)"/i, (_classMatch, classValue: string) => {
        const classes = new Set(`${classValue} interactive ${selected ? "selected" : ""}`.split(/\s+/).filter(Boolean));
        return `class="${Array.from(classes).join(" ")}"`;
      });
      if (!/class="/i.test(tag)) tag = tag.replace(/^<g\b/i, `<g class="interactive${selected ? " selected" : ""}"`);
      return tag.replace(
        /^<g\b/i,
        `<g data-bodymap-region="${regionId}" data-muscle-id="${muscleId}" role="button" tabindex="0" aria-label="选择${label}" aria-pressed="${selected ? "true" : "false"}"`,
      );
    });
  });

  BODY_MAP_UNMAPPED_REGIONS.forEach((regionId) => {
    if (mappedRegions.has(regionId)) return;
    const openTagPattern = new RegExp(`<g([^>]*\\bid=["']${escapeRegExp(regionId)}["'][^>]*)>`, "gi");
    output = output.replace(openTagPattern, (match) => {
      let tag = match;
      tag = tag.replace(/\s(data-bodymap-region|aria-hidden)=("[^"]*"|'[^']*')/gi, "");
      tag = tag.replace(/class="([^"]*)"/i, (_classMatch, classValue: string) => {
        const classes = new Set(`${classValue} muted-region`.split(/\s+/).filter(Boolean));
        return `class="${Array.from(classes).join(" ")}"`;
      });
      if (!/class="/i.test(tag)) tag = tag.replace(/^<g\b/i, `<g class="muted-region"`);
      return tag.replace(/^<g\b/i, `<g data-bodymap-region="${regionId}" aria-hidden="true"`);
    });
  });

  return output;
}

const BODY_MAP_SVG_STYLE = `
  svg { width: 100%; height: auto; display: block; }
  .bodymap { color: #fbfffd; transition: color .16s ease, filter .16s ease; }
  .bodymap.interactive { cursor: pointer; pointer-events: auto; }
  .bodymap.interactive:hover, .bodymap.interactive:focus { color: #ffd6df; outline: none; }
  .bodymap.interactive.selected { color: #fb8da7; filter: drop-shadow(0 7px 12px rgba(251, 113, 133, .22)); }
  .bodymap.interactive.selected path[fill="currentColor"] { stroke: #3f425f; stroke-width: 1.2; }
  .bodymap.muted-region { color: #eef4f1; pointer-events: none; }
`;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ExerciseResults({ result, onOpenExercise }: { result: ExerciseSearchResponse; onOpenExercise: (exercise: Exercise) => void }) {
  return (
    <div>
      <div className="meta-row">
        <span className="badge">{result.cacheHit ? "缓存命中" : "WorkoutX 拉取"}</span>
        <span className="badge">{result.exercises.length} 个可学动作</span>
        <span className="badge">中文标签已处理</span>
      </div>
      <div className="exercise-list">
        {result.exercises.map((exercise) => (
          <article className="exercise-card" key={exercise.id}>
            <button className="exercise-thumb" type="button" onClick={() => onOpenExercise(exercise)} aria-label={`学习 ${exercise.name}`}>
              {exercise.gifUrl ? <img src={localGifUrl(exercise)} alt={exercise.name} /> : <div className="placeholder-gif">No GIF</div>}
              <span>点击学习</span>
            </button>
            <div className="exercise-card-body">
              <h3>{displayExerciseName(exercise)}</h3>
              <div className="meta-row">
                <span className="badge">{displayField(exercise.bodyPartZh, exercise.bodyPart)}</span>
                <span className="badge">{displayField(exercise.targetZh, exercise.target)}</span>
                <span className="badge">{displayField(exercise.equipmentZh, exercise.equipment)}</span>
              </div>
              {exercise.descriptionZh || exercise.description ? <p className="card-description">{exercise.descriptionZh ?? exercise.description}</p> : null}
              {(exercise.instructionsZh?.length ? exercise.instructionsZh : exercise.instructions)?.length ? (
                <ul>
                  {(exercise.instructionsZh?.length ? exercise.instructionsZh : exercise.instructions)?.slice(0, 2).map((instruction, index) => (
                    <li key={`${exercise.id}-${index}`}>{instruction}</li>
                  ))}
                </ul>
              ) : null}
              <button className="learn-link" type="button" onClick={() => onOpenExercise(exercise)}>
                打开动作教学 →
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PlanView({ plan, onOpenExercise }: { plan: WeeklyPlan; onOpenExercise: (exercise: Exercise) => void }) {
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2>当前每周计划</h2>
      <div className="meta-row">
        <span className="badge">目标：{GOAL_LABEL[plan.goal] ?? plan.goal}</span>
        <span className="badge">等级：{LEVEL_LABEL[plan.level] ?? plan.level}</span>
        <span className="badge">{plan.daysPerWeek} 天/周</span>
        <span className="badge">{plan.sessionDuration} 分钟/次</span>
        <span className="badge">器材：{plan.equipment.map(displayEquipmentName).join("、")}</span>
      </div>
      <div className="plan-list">
        {plan.days.map((day) => (
          <article className="plan-day" key={day.id ?? day.dayIndex}>
            <header>
              <h3>{day.label}</h3>
              <span className="badge">{displayPlanFocus(day.focus, day.label)}</span>
            </header>
            <ol className="plan-items">
              {day.items.map((item) => {
                const exercise = item.exercise ?? item.exerciseSnapshot;
                return (
                  <li className="plan-item plan-item-with-media" key={item.id ?? `${day.dayIndex}-${item.order}`}>
                    {hasExerciseGif(exercise) ? (
                      <button
                        className="plan-thumb"
                        type="button"
                        disabled={!isExercise(exercise)}
                        onClick={() => {
                          if (isExercise(exercise)) onOpenExercise(exercise);
                        }}
                        aria-label={`学习 ${displayExerciseName(exercise)}`}
                      >
                        <img src={localGifUrl(exercise)} alt={displayExerciseName(exercise)} />
                      </button>
                    ) : (
                      <div className="plan-thumb placeholder-gif">无图</div>
                    )}
                    <div className="plan-item-content">
                      <div className="plan-item-head">
                        <strong>{item.order}. {exercise ? displayExerciseName(exercise) : "待补充动作"}</strong>
                        {isExercise(exercise) ? (
                          <button className="mini-link" type="button" onClick={() => onOpenExercise(exercise)}>学习</button>
                        ) : null}
                      </div>
                      <div className="meta-row">
                        <span className="badge">{item.sets} 组</span>
                        <span className="badge">{item.reps}</span>
                        <span className="badge">休息 {item.restSeconds}s</span>
                        {exercise?.equipment ? <span className="badge">{displayField(exercise.equipmentZh, exercise.equipment)}</span> : null}
                      </div>
                      {item.note ? <p className="muted" style={{ margin: "8px 0 0" }}>{item.note}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExerciseDetailModal({ exercise, loading, onClose }: { exercise: Exercise; loading: boolean; onClose: () => void }) {
  const instructions = (exercise.instructionsZh?.length ? exercise.instructionsZh : exercise.instructions)?.filter(Boolean) ?? [];
  const secondaryMuscles = exercise.secondaryMuscles?.filter(Boolean) ?? [];
  const movementTags = (exercise.movementTagsZh?.length ? exercise.movementTagsZh : exercise.movement_tags)?.filter(Boolean) ?? [];
  const metadata = [
    ["部位", displayField(exercise.bodyPartZh, exercise.bodyPart)],
    ["目标", displayField(exercise.targetZh, exercise.target)],
    ["器材", displayField(exercise.equipmentZh, exercise.equipment)],
    ["难度", displayField(exercise.difficultyZh, exercise.difficulty)],
    ["类型", displayField(exercise.categoryZh, exercise.category)],
    ["动作模式", displayField(exercise.mechanicZh, exercise.mechanic)],
    ["发力", displayField(exercise.forceZh, exercise.force)],
    ["强度", displayField(exercise.intensityZh, exercise.intensity_level)],
    ["关节重点", displayField(exercise.jointFocusZh, exercise.joint_focus)],
    ["MET", exercise.met ? String(exercise.met) : undefined],
    ["热量", exercise.caloriesPerMinute ? `${exercise.caloriesPerMinute}/分钟` : undefined],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="exercise-modal" role="dialog" aria-modal="true" aria-label={`${exercise.name} 动作教学`} onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">动作教学 {loading ? "· 正在补全详情" : ""}</p>
            <h2>{displayExerciseName(exercise)}</h2>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="关闭动作详情">
            ×
          </button>
        </header>

        <div className="modal-content">
          <div className="learning-media-card">
            {exercise.gifUrl ? <img src={localGifUrl(exercise)} alt={`${exercise.name} 动作演示`} /> : <div className="placeholder-gif">暂无动图</div>}
            <div className="media-caption">循环观察轨迹：先看身体位置，再看关节移动，最后跟着节奏练。</div>
          </div>

          <div className="learning-main">
            <div className="detail-chip-grid">
              {metadata.slice(0, 6).map(([label, value]) => (
                <div className="detail-chip" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>

            {exercise.descriptionZh || exercise.description ? (
              <section className="learn-section">
                <h3>动作说明</h3>
                <p className="description-text">{exercise.descriptionZh ?? exercise.description}</p>
              </section>
            ) : null}

            <section className="learn-section">
              <h3>练习步骤</h3>
              {instructions.length ? (
                <ol className="step-list">
                  {instructions.map((instruction, index) => (
                    <li key={`${exercise.id}-step-${index}`}>
                      <span>{index + 1}</span>
                      <p>{instruction}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted">这个动作暂时没有分步骤文字，先参考上方动图完成动作轨迹学习。</p>
              )}
            </section>

            <section className="learn-section coach-card">
              <h3>训练提示</h3>
              <ul>
                <li>先用轻重量或徒手熟悉轨迹，确认没有疼痛后再增加强度。</li>
                <li>每次重复都保持可控速度，不要靠甩动完成动作。</li>
                <li>如果动作涉及左右侧，左右都按同样次数完成。</li>
              </ul>
            </section>

            {secondaryMuscles.length || movementTags.length || metadata.length > 6 ? (
              <section className="learn-section">
                <h3>更多信息</h3>
                <div className="meta-row">
                  {secondaryMuscles.map((muscle) => (
                    <span className="badge" key={`secondary-${muscle}`}>次要：{muscle}</span>
                  ))}
                  {movementTags.map((tag) => (
                    <span className="badge" key={`tag-${tag}`}>{tag}</span>
                  ))}
                  {metadata.slice(6).map(([label, value]) => (
                    <span className="badge" key={label}>{label}：{value}</span>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function isExercise(value: Partial<Exercise> | null | undefined): value is Exercise {
  return Boolean(value?.id && value.name && value.bodyPart && value.target && value.equipment);
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      throw new Error(data.message);
    }
    throw new Error(`请求失败：HTTP ${response.status}`);
  }
  return data as T;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

function formatUsage(usage?: Usage) {
  if (!usage) return "暂无";
  if (usage.quotaRemaining && usage.quotaLimit) return `${usage.quotaRemaining}/${usage.quotaLimit}`;
  if (usage.rateLimitRemaining && usage.rateLimitLimit) return `${usage.rateLimitRemaining}/${usage.rateLimitLimit}/min`;
  if (usage.plan) return usage.plan;
  return "已记录";
}

function splitEquipment(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasExerciseGif(exercise: Partial<Exercise> | null | undefined): exercise is Pick<Exercise, "id" | "gifUrl"> {
  return Boolean(exercise?.id && exercise.gifUrl);
}

function localGifUrl(exercise: Pick<Exercise, "id" | "gifUrl">) {
  if (!exercise.gifUrl) return "";
  return `/api/gifs/${encodeURIComponent(exercise.id)}.gif`;
}

function displayExerciseName(exercise: Partial<Exercise>) {
  return exercise.nameZh || exercise.name || "未命名动作";
}

function displayField(zh?: string | null, original?: string | null) {
  if (zh && original && zh.toLowerCase() !== original.toLowerCase()) return `${zh} · ${original}`;
  return zh || original || "-";
}

function displayPlanFocus(focus: string, label?: string) {
  if (focus === "custom_focus" && label?.includes("·")) return label.split("·").slice(1).join("·").trim();
  return PLAN_FOCUS_LABEL[focus] ?? focus;
}

function displayEquipmentName(value: string) {
  const label = lookupOptionLabel(EQUIPMENT_OPTIONS, value);
  return label && label !== value ? `${label} · ${value}` : value;
}

function lookupOptionLabel(options: string[][], value: string) {
  return options.find(([optionValue]) => optionValue === value)?.[1] ?? value;
}
