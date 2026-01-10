-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "authorId" TEXT NOT NULL DEFAULT 'unknown';

-- CreateIndex
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");
