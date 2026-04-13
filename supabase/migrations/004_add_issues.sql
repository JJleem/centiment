-- review_analysis 에 이슈 목록 컬럼 추가
-- summary와 동일하게 app_id+platform 단위로 모든 row에 동일값 저장
ALTER TABLE review_analysis
  ADD COLUMN issues TEXT[] NOT NULL DEFAULT '{}';
