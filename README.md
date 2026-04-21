# Centiment

> Supercent 모바일 게임 리뷰 감성 분석 대시보드

iOS · Android 리뷰를 자동 수집하고 Claude AI로 분석해 게임별·플랫폼별·국가별 인사이트를 제공하는 내부 분석 툴입니다.

---
<br/>
<img width="1470" height="799" alt="image" src="https://github.com/user-attachments/assets/31906365-a5ed-4802-b8cf-e87a1ebf09e6" />
<br/>
<img width="1470" height="800" alt="image" src="https://github.com/user-attachments/assets/73f6f2c5-bda8-4c72-a278-55cf60e819f6" />
<br/>
<img width="1470" height="800" alt="image" src="https://github.com/user-attachments/assets/299d6c15-ff45-4005-a58e-04e27798b148" />
<br/>
<img width="1470" height="803" alt="image" src="https://github.com/user-attachments/assets/fd4958b7-8cb6-4535-be4a-85b7a958b988" />
<br/>

## 주요 기능

### 홈 대시보드
- **2컬럼 레이아웃** — 게임 그리드(좌) + sticky 분석 패널(우)
- **주간 요약 카드** — 최근 7일 긍정률 TOP 3 / BOTTOM 3 자동 집계
- **미분석 게임 일괄 분석** — 예상 API 비용 확인 후 순차 실행
- **게임 간 비교 진입** — 분석된 게임 2~3개 선택 → `/cross` 이동
- **비교 · 분석 히스토리** — 최근 기록 한눈에 확인

### 결과 페이지 (`/result?game=…`)
- **AI 인사이트** — iOS · Android 각각 Sonnet 3문장 요약
- **카테고리별 세부 인사이트** — 상위 3개 카테고리 Haiku 한 줄 요약 (DB 캐싱)
- **버전 릴리즈 알림** — 연속 버전 간 긍정률 ±10%p 이상 자동 감지
- **셀링포인트 추출** — 긍정 리뷰 키워드 TOP 10 (마케팅 카피 소재)
- **국가별 감성 분포** — EN · KO · JA · DE 로케일별 시각화
- **버전별 · 월별 트렌드 차트**
- **분석 이력 타임라인** — 날짜별 분석 실행 이력
- **리뷰 원문 검색** — 키워드 하이라이트, 플랫폼·감성·카테고리 복합 필터
- **CSV 내보내기** — 전체 리뷰 스프레드시트 다운로드

### 게임 간 비교 (`/cross?g1=…&g2=…&g3=…`)
- **최대 3개 게임 동시 비교** — 감성·카테고리·키워드 N열 레이아웃 자동 전환
- **Sonnet AI 인사이트** — 비교 결과 한 문장 요약, DB 영구 캐싱
- **비교 히스토리 저장** — 과거 비교 기록 재접근 가능
- **재분석 버튼** — 수동 인사이트 재생성

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), React Server Components, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Supabase (PostgreSQL) |
| AI | Claude Haiku 4.5 (분류), Claude Sonnet 4.6 (요약·비교) |
| 데이터 수집 | iTunes MZStore API (iOS), google-play-scraper (Android) |
| 배포 | Vercel |

---

## AI 분석 파이프라인

```
리뷰 수집 (4 로케일 × 40건/플랫폼)
    ↓
Haiku — 배치 분류 (20건 단위)
    sentiment · category · keywords · lang
    ↓
Sonnet — 전체 요약 + 이슈 목록 (1회)
    3문장 요약 · 구체적 이슈 최대 8개
    ↓
Haiku — 카테고리별 인사이트 (상위 3개, DB 캐싱)
    ↓
대시보드 표시
```

- **증분 분석** — `review_id` FK로 분석 완료 리뷰 추적, 신규 리뷰만 처리
- **비용 효율** — 재분석 시 새 리뷰만 Haiku 호출, Sonnet은 전체 집계 기반 1회

---

## 환경 변수

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

---

## DB 테이블

| 테이블 | 역할 |
|--------|------|
| `reviews` | 리뷰 원문 + lang + version. `UNIQUE(app_id, platform, content, review_date, lang)` |
| `review_analysis` | AI 분류 결과. `review_id → reviews.id` FK로 증분 분석 지원 |
| `cross_comparison_history` | 게임 간 비교 AI 인사이트 영구 저장 |
| `category_insights` | 카테고리별 Haiku 인사이트 캐싱 |

---

## 로컬 실행

```bash
npm install
npm run dev
```

---

## 지원 게임

Supercent 26개 타이틀 (`lib/presets.ts` 기준)  
Snake Clash!, Pizza Ready!, Burger Please!, Outlets Rush, Downhill Racer 외 21개

---

## 관련 프로젝트

**[Centinel](https://github.com/JJleem/centinel)** — Google Play · App Store Top 200 트렌드 분석 + 광고 소재 자동 생성

> Centiment(내부 감성 분석) + Centinel(외부 시장 트렌드) 통합이 장기 로드맵입니다.

---

Made by [임재준](https://github.com/JJleem)
