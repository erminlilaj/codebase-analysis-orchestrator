-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'claimed', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repoPath" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DependencyLink" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "DependencyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisBundle" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleFile" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "BundleFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisJob" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "claimedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisAnswer" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rawOutput" TEXT NOT NULL,
    "parsed" JSONB NOT NULL DEFAULT '{}',
    "modelId" TEXT,
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Export" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_language_idx" ON "Project"("language");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "SourceFile_projectId_idx" ON "SourceFile"("projectId");

-- CreateIndex
CREATE INDEX "SourceFile_language_idx" ON "SourceFile"("language");

-- CreateIndex
CREATE UNIQUE INDEX "SourceFile_projectId_relativePath_key" ON "SourceFile"("projectId", "relativePath");

-- CreateIndex
CREATE INDEX "DependencyLink_sourceId_idx" ON "DependencyLink"("sourceId");

-- CreateIndex
CREATE INDEX "DependencyLink_targetId_idx" ON "DependencyLink"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "DependencyLink_sourceId_targetId_type_key" ON "DependencyLink"("sourceId", "targetId", "type");

-- CreateIndex
CREATE INDEX "AnalysisBundle_projectId_idx" ON "AnalysisBundle"("projectId");

-- CreateIndex
CREATE INDEX "BundleFile_bundleId_idx" ON "BundleFile"("bundleId");

-- CreateIndex
CREATE INDEX "BundleFile_fileId_idx" ON "BundleFile"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleFile_bundleId_fileId_role_key" ON "BundleFile"("bundleId", "fileId", "role");

-- CreateIndex
CREATE INDEX "Question_createdAt_idx" ON "Question"("createdAt");

-- CreateIndex
CREATE INDEX "AnalysisRun_projectId_idx" ON "AnalysisRun"("projectId");

-- CreateIndex
CREATE INDEX "AnalysisRun_status_idx" ON "AnalysisRun"("status");

-- CreateIndex
CREATE INDEX "AnalysisRun_createdAt_idx" ON "AnalysisRun"("createdAt");

-- CreateIndex
CREATE INDEX "AnalysisJob_status_priority_createdAt_idx" ON "AnalysisJob"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "AnalysisJob_runId_idx" ON "AnalysisJob"("runId");

-- CreateIndex
CREATE INDEX "AnalysisJob_bundleId_idx" ON "AnalysisJob"("bundleId");

-- CreateIndex
CREATE INDEX "AnalysisJob_claimedAt_idx" ON "AnalysisJob"("claimedAt");

-- CreateIndex
CREATE INDEX "AnalysisJob_providerId_idx" ON "AnalysisJob"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisAnswer_jobId_key" ON "AnalysisAnswer"("jobId");

-- CreateIndex
CREATE INDEX "AnalysisAnswer_createdAt_idx" ON "AnalysisAnswer"("createdAt");

-- CreateIndex
CREATE INDEX "Export_projectId_idx" ON "Export"("projectId");

-- CreateIndex
CREATE INDEX "Export_format_idx" ON "Export"("format");

-- CreateIndex
CREATE INDEX "Export_createdAt_idx" ON "Export"("createdAt");

-- AddForeignKey
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyLink" ADD CONSTRAINT "DependencyLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyLink" ADD CONSTRAINT "DependencyLink_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisBundle" ADD CONSTRAINT "AnalysisBundle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleFile" ADD CONSTRAINT "BundleFile_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "AnalysisBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleFile" ADD CONSTRAINT "BundleFile_main_fk" FOREIGN KEY ("fileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleFile" ADD CONSTRAINT "BundleFile_context_fk" FOREIGN KEY ("fileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "AnalysisBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisAnswer" ADD CONSTRAINT "AnalysisAnswer_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
