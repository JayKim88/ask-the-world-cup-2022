# Ask the World Cup 2022 — 빌드 체크리스트

> 단일 소스는 [PRD.md](PRD.md). 이 파일은 **빌드 순서 + 진행 추적**만 담당(§N = 커밋 태그).
> 커밋 컨벤션: `<type>(<scope>): <subject> [§N]` · scope = `infra`·`seed`·`nl2sql`·`safety`·`exec`·`ui`·`chart`·`bracket`·`eval`

## Phase B — 툴체인 (§1)
- [x] `[§1]` Next 16(App Router)+React 19+TS+Tailwind 4 스캐폴딩
- [x] `[§1]` kit eslint 템플릿(flat config) 적용 + prettier + `.nvmrc`(22)
- [x] `[§1]` lint/typecheck/build/test 스크립트 + vitest — 4 게이트 통과
- [x] `[§1]` `.env.example` (API_FOOTBALL_KEY·TEXT2SQL_MODEL)
- [ ] `[§1]` shadcn/ui 초기화 (컴포넌트 필요 시점에)

## 데이터 (§2) — Supabase→**SQLite** 전환
- [x] `[§2]` SQLite 스키마(`db/schema.sql`, 5테이블) + `better-sqlite3` 시더(`scripts/seed.ts`)
- [x] `[§2]` `next_match_id`(승자 경로 역산)·`winner_team_id`(API 플래그) 구성 — 대진표 링크 검증됨
- [x] `[§2]` rate-limit 대응(무료 10/min·100/day → 6.5s 스로틀 + 분당 429 재시도 + 재개)
- [~] `[§2]` 시딩 실행 → `db/worldcup.db` (아래 진행 상황)

### 시딩 진행 (배치)
- [x] **1일차** (2026-07-20): teams(32)·players(878)·matches(64)·**대진표 링크** 완비 / match_stats·goals **28/64경기** → 일일한도 도달, graceful 중단(⏸)
- [ ] **재개** (한도 리셋 후 `pnpm seed`): stats/goals **나머지 36경기** → `.db` 완주
- [x] 데이터 검증: **et 누적**(결승 3-3)·**재귀 CTE 대진표**(ARG ro16→final) 통과 / 자책골은 완주 후 재확인
- [ ] `.db` 완주 후 git 커밋 (배포에 딸려감)

## NL→SQL 파이프라인 (§3) ✅
- [x] `[§3]` 스키마 컨텍스트 주입 프롬프트 + `generateText`+`Output.object`(Zod, v7) — provider-neutral BYOK(Gemini 기본)
- [x] `[§3]` 응답 status enum(`planned`/`clarify`/`rejected`/`error`) + never-500 wrapper
- [~] `[§3]` 라이브 검증(generateText 실호출) — BYOK 키 필요, §5 UI 연결 시 확정

## 안전성 (§4) ✅
- [x] `[§4]` AST 검증기(`node-sql-parser`, **postgres 문법 = statement 분류기**) — 단일 SELECT/WITH만 통과. sqlite 방언은 `PARTITION BY` 없는 윈도우 함수 파싱 못 해 postgres 채택
- [x] `[§4]` 실행 래퍼: SQLite **읽기전용 open**(`{readonly:true}`, 싱글톤) + **`iterate()` 지연소비 행 상한 1000**(무한 재귀 CTE 종료) — `safeQuery` never-500. better-sqlite3 `interrupt()` 부재로 인프로세스 타임아웃 대신 행 상한
- [x] `[§4]` 라이브 검증: 실제 `db/worldcup.db`로 유효 실행·INSERT/DROP/UPDATE/멀티 거부·bad column→error 확인

## 실행 + UI (§5)
- [ ] `[§5]` 쿼리 실행 + 결과 반환
- [ ] `[§5]` BYOK `ApiKeyDialog`(브라우저 로컬 저장, 서버 미저장)
- [ ] `[§5]` `QueryInput`·`QueryContainer`·`SqlViewer`·`ResultsTable`·`TextType`

## 시각화 (§6)
- [ ] `[§6]` `ChartView` — 결과 shape 감지 라우팅(텍스트/테이블/막대/선/파이)
- [ ] `[§6]` `BracketTree` — D3 인터랙티브 대진표(호버 상세·전환 애니메이션)

## eval + 배포 (§7)
- [ ] `[§7]` gold set 15~20문항(`order_sensitive` 태깅) — §3.1 기반
- [ ] `[§7]` execution-match eval 스크립트(temperature=0)
- [ ] `[§7]` 안전성 수동 테스트(인젝션·비용공격 → 읽기전용 open·쿼리 타임아웃 차단 확인)
- [ ] `[§7]` Vercel 배포
- [ ] `[§7]` 제품 README(reader-facing) 작성 — Phase D

## Phase 2 확장 (별도 트랙, 본 프로젝트 완주 후)
- [ ] semantic-layer 방식 병행 + 동일 gold set으로 raw SQL vs semantic 비교
