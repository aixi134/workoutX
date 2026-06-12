-- CreateTable
CREATE TABLE "ExerciseTranslationCache" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "instructions" TEXT[],
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseTranslationCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseTranslationCache_exerciseId_locale_key" ON "ExerciseTranslationCache"("exerciseId", "locale");

-- CreateIndex
CREATE INDEX "ExerciseTranslationCache_exerciseId_idx" ON "ExerciseTranslationCache"("exerciseId");
