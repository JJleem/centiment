-- review_analysis 에 reviews.id 참조 컬럼 추가
-- 기존 행은 NULL (이미 분석된 것, 증분 추적 불가)
ALTER TABLE review_analysis
  ADD COLUMN review_id UUID REFERENCES reviews(id) ON DELETE CASCADE;

CREATE INDEX idx_analysis_review_id ON review_analysis (review_id);
