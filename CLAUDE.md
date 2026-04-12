# Centiment

collect → analyze → dashboard (단방향, 역방향 금지)

AI logic: app/api/reviews/analyze/route.ts 만

Prompts: lib/prompts/ 에만 (인라인 금지)

배치: 리뷰 20건 단위, 1건씩 호출 금지

전달: content + rating + version 만 (전체 객체 금지)

로그: 모든 Claude 호출 후 usage 콘솔 출력

모델: Haiku=분류, Sonnet=요약만

무시: node_modules .next public/ package-lock.json
