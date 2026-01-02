-- v0.1: 비동기 파이프라인 지원

-- 상태 enum 확장
ALTER TYPE "MeetingStatus" ADD VALUE IF NOT EXISTS 'ASR_DONE';
ALTER TYPE "MeetingStatus" ADD VALUE IF NOT EXISTS 'SUMMARY_DONE';
ALTER TYPE "MeetingStatus" ADD VALUE IF NOT EXISTS 'MD_DONE';

-- transcripts 테이블에 updatedAt 추가
ALTER TABLE "transcripts" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- summaries 테이블 컬럼 추가
ALTER TABLE "summaries" ADD COLUMN IF NOT EXISTS "promptVersion" TEXT DEFAULT 'v0.1';
ALTER TABLE "summaries" ADD COLUMN IF NOT EXISTS "modelVersion" TEXT DEFAULT 'mock';

-- exports 테이블 생성
CREATE TABLE IF NOT EXISTS "exports" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "mdContent" TEXT NOT NULL,
    "mdObjectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- exports unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "exports_meetingId_key" ON "exports"("meetingId");

-- exports foreign key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'exports_meetingId_fkey'
    ) THEN
        ALTER TABLE "exports" ADD CONSTRAINT "exports_meetingId_fkey" 
        FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- summaries에서 mdContent 컬럼 제거 (exports로 이동)
ALTER TABLE "summaries" DROP COLUMN IF EXISTS "mdContent";

-- meetings에서 createdBy 컬럼 제거 (인증 없음)
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "createdBy";

-- glossaries 테이블 생성
CREATE TABLE IF NOT EXISTS "glossaries" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "term" TEXT NOT NULL,
    "preferredSpelling" TEXT NOT NULL,
    "aliases" JSONB,
    "description" TEXT,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "glossaries_pkey" PRIMARY KEY ("id")
);

-- glossaries unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "glossaries_orgId_term_key" ON "glossaries"("orgId", "term");

