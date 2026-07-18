@AGENTS.md
@docs/CHECKLIST.md

# Ask the World Cup 2022 — 작업 규칙

> 이 repo의 **자기완결적** 작업 규칙 (standalone deliverable — 상위 저장소에 의존하지 않음). 상세 스펙·결정은 [PRD](docs/PRD.md), 빌드 순서·진행은 [CHECKLIST](docs/CHECKLIST.md).

## 이게 뭔가
자연어 질문 → LLM이 **raw SQL** 생성 → 검증 → read-only Postgres 실행 → 테이블/차트/D3 대진표. 2022 카타르 월드컵 데이터로 **text-to-SQL을 손으로 익히는** 학습 프로젝트. (semantic layer가 아니라 raw SQL은 **의도된 선택** — PRD 참조. semantic layer 병행은 Phase 2 확장.)

## 작업 규율 (커밋 전 항상)
- **DoD 게이트** — 커밋 제안 전 모두 green: `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`
- 타입 이스케이프(`any`/`as any`) 0 · 디버그 코드(`console.log`) 0
- **사용자 승인 없이 `git commit` 금지. `--no-verify` 금지.**
- **커밋 컨벤션**: `<type>(<scope>): <subject> [§N]`
  - type: `feat｜fix｜refactor｜test｜chore｜docs｜style｜perf`
  - scope: `infra｜seed｜nl2sql｜safety｜exec｜ui｜chart｜bracket｜eval` (CHECKLIST 상단)
  - subject: 영어·명령형·≤50자 · `[§N]`은 CHECKLIST criterion (메타/툴링은 `[§-]`)
- **semantic-unit 커밋** — 한 커밋 = 한 단위. bulk dump 금지

## 제품 불변식 (`app/`·`src/` 코드 쓸 때 항상)

1. **LLM 출력은 untrusted.** 생성된 모든 SQL은 실행 전 **AST 검증기**(단일 SELECT/WITH만)를 통과해야 함. 검증 안 된 SQL을 실행하지 말 것.
2. **진짜 방어선은 DB.** 전용 read-only role + `statement_timeout` + 강제 LIMIT, SQL 실행 RPC는 반드시 `SECURITY INVOKER`. 앱 검증기는 우회 가능한 1차 보호일 뿐 (PRD §4.1).
3. **BYOK.** 사용자의 LLM API 키는 브라우저 저장 + 요청마다 전달. **서버에 저장·로깅 절대 금지.**
4. **모든 LLM 출력은 Zod 통과** (`{ sql, explanation }`). raw 모델 텍스트를 신뢰하지 말 것. 응답은 status enum(`planned`/`clarify`/`rejected`/`error`)로 분기.
5. **모델은 env var로** (`TEXT2SQL_MODEL`). 모델·프로바이더명을 하드코딩하지 말 것.
6. **데이터는 1회성 스냅샷 시딩** (API-Football → Supabase). 앱은 **런타임에 API-Football을 호출하지 않음** — 사용자 질의는 Supabase에만.
7. **출력 스타일은 앱이 실제 결과 shape로 결정** (LLM이 아님). 테이블이 항상 폴백. (텍스트/막대/선/파이/BracketTree 분기 — PRD §6.1)
8. **격리 Supabase 프로젝트.** 이 데모 전용 프로젝트만 사용, 실데이터 프로젝트와 절대 공유 안 함.

## 스택
Next **16**(App Router) · React 19 · TS(strict) · Tailwind 4 · Vercel AI SDK(`generateObject`) · Zod · `libpg_query`(AST) · Supabase(`@supabase/supabase-js`) · Recharts · D3 · vitest
> ⚠ Next 16은 훈련 데이터 이후 breaking change 있음 — 코드 전에 `node_modules/next/dist/docs/` 확인 (AGENTS.md).
