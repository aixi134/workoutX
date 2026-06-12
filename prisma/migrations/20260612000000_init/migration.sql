-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "equipment" TEXT NOT NULL,
    "gifUrl" TEXT,
    "instructions" JSONB,
    "secondaryMuscles" TEXT[],
    "raw" JSONB,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseQueryCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "exerciseIds" TEXT[],
    "rateLimit" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseQueryCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentRecognition" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "candidates" JSONB NOT NULL,
    "rawOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentRecognition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "daysPerWeek" INTEGER NOT NULL,
    "sessionDuration" INTEGER NOT NULL,
    "equipment" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanDay" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "focus" TEXT NOT NULL,

    CONSTRAINT "PlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "order" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "note" TEXT,
    "exerciseSnapshot" JSONB,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exercise_bodyPart_idx" ON "Exercise"("bodyPart");

-- CreateIndex
CREATE INDEX "Exercise_target_idx" ON "Exercise"("target");

-- CreateIndex
CREATE INDEX "Exercise_equipment_idx" ON "Exercise"("equipment");

-- CreateIndex
CREATE INDEX "Exercise_name_idx" ON "Exercise"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseQueryCache_cacheKey_key" ON "ExerciseQueryCache"("cacheKey");

-- CreateIndex
CREATE INDEX "ExerciseQueryCache_expiresAt_idx" ON "ExerciseQueryCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlan_slug_key" ON "WeeklyPlan"("slug");

-- CreateIndex
CREATE INDEX "PlanDay_planId_idx" ON "PlanDay"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDay_planId_dayIndex_key" ON "PlanDay"("planId", "dayIndex");

-- CreateIndex
CREATE INDEX "PlanItem_dayId_idx" ON "PlanItem"("dayId");

-- CreateIndex
CREATE INDEX "PlanItem_exerciseId_idx" ON "PlanItem"("exerciseId");

-- AddForeignKey
ALTER TABLE "PlanDay" ADD CONSTRAINT "PlanDay_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WeeklyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "PlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

