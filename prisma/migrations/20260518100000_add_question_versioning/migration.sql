-- AlterTable
ALTER TABLE "Question" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "AnalysisJob" ADD COLUMN "questionVersion" INTEGER NOT NULL DEFAULT 1;
