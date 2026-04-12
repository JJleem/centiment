-- reviews 테이블에 언어 컬럼 추가
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'en';

-- 기존 UNIQUE 제약 재설정 (lang 포함)
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS uq_review;
ALTER TABLE reviews ADD CONSTRAINT uq_review UNIQUE (app_id, platform, content, review_date, lang);
