-- Add key and language to Question
ALTER TABLE "Question" ADD COLUMN "key" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Question" ADD COLUMN "language" TEXT;

-- Remove the placeholder default now that the column exists
ALTER TABLE "Question" ALTER COLUMN "key" DROP DEFAULT;

-- Unique constraint on key
CREATE UNIQUE INDEX "Question_key_key" ON "Question"("key");

-- Index on language for fast lookup by language
CREATE INDEX "Question_language_idx" ON "Question"("language");

-- Drop the two ambiguous FK constraints on BundleFile and replace with one
ALTER TABLE "BundleFile" DROP CONSTRAINT "BundleFile_main_fk";
ALTER TABLE "BundleFile" DROP CONSTRAINT "BundleFile_context_fk";
ALTER TABLE "BundleFile" ADD CONSTRAINT "BundleFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
