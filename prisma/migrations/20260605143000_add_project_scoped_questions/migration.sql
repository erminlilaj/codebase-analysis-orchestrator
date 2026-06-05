ALTER TABLE "Question" ADD COLUMN "projectId" TEXT;

CREATE INDEX "Question_projectId_idx" ON "Question"("projectId");

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
