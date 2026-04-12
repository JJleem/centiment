-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enum types ───────────────────────────────────────────────────────────────
CREATE TYPE platform AS ENUM ('ios', 'android');
CREATE TYPE sentiment AS ENUM ('positive', 'negative', 'neutral');
CREATE TYPE review_category AS ENUM (
  'gameplay', 'ui', 'performance', 'monetization', 'content', 'bug', 'other'
);

-- ─── reviews ──────────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      TEXT        NOT NULL,
  platform    platform    NOT NULL,
  version     TEXT,
  rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content     TEXT        NOT NULL,
  review_date TIMESTAMPTZ NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_review UNIQUE (app_id, platform, content, review_date)
);

CREATE INDEX idx_reviews_app_platform ON reviews (app_id, platform);
CREATE INDEX idx_reviews_fetched_at   ON reviews (fetched_at DESC);

-- ─── review_analysis ──────────────────────────────────────────────────────────
CREATE TABLE review_analysis (
  id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id     TEXT            NOT NULL,
  platform   platform        NOT NULL,
  version    TEXT,
  sentiment  sentiment       NOT NULL,
  category   review_category NOT NULL,
  keywords   TEXT[]          NOT NULL DEFAULT '{}',
  summary    TEXT            NOT NULL,
  created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analysis_app_platform ON review_analysis (app_id, platform);
CREATE INDEX idx_analysis_created_at   ON review_analysis (created_at DESC);
CREATE INDEX idx_analysis_sentiment    ON review_analysis (sentiment);
CREATE INDEX idx_analysis_category     ON review_analysis (category);
