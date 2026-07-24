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
- [x] **1일차** (2026-07-20): teams(32)·players(878)·matches(64)·**대진표 링크** / match_stats·goals **28/64** → 한도 도달 ⏸
- [x] **2일차** (2026-07-21): stats/goals **완주** — match_stats **128행(64/64)** · goals **198행(58/64, 나머지 6경기는 실제 0-0 무득점)**
- [x] 데이터 검증: et 누적(결승 3-3)·재귀 CTE 대진표·**골수 정합**(스코어합=골행수)·**자책골 크레딧**(수혜팀) 통과
- [x] **선수 백필 완주** — `players/squads`가 현재 스쿼드라 2022 득점자 79명 누락(지루 등) 발견 → seed.ts **자가치유 백필**(orphan만 `players?id&season=2022`, 팀은 로컬 도출). **79/79 완료**, orphan 0, players 957
- [x] **승부차기 골 오염 수정** — events의 `comments="Penalty Shootout"` 킥이 골로 집계돼 득점왕 부풀림 발견 → seed 필터에 제외 추가, 5개 경기 재시딩. **검증: Mbappé 8·Messi 7·총 172골 = 공식 일치**
- [x] `.db` 완주 후 git 커밋 (배포에 딸려감) — 아래 `fix(seed)`

## NL→SQL 파이프라인 (§3) ✅
- [x] `[§3]` 스키마 컨텍스트 주입 프롬프트 + `generateText`+`Output.object`(Zod, v7) — provider-neutral BYOK(Gemini 기본)
- [x] `[§3]` 응답 status enum(`planned`/`clarify`/`rejected`/`error`) + never-500 wrapper
- [~] `[§3]` 라이브 검증(generateText 실호출) — BYOK 키 필요, §5 UI 연결 시 확정

## 안전성 (§4) ✅
- [x] `[§4]` AST 검증기(`node-sql-parser`, **postgres 문법 = statement 분류기**) — 단일 SELECT/WITH만 통과. sqlite 방언은 `PARTITION BY` 없는 윈도우 함수 파싱 못 해 postgres 채택
- [x] `[§4]` 실행 래퍼: SQLite **읽기전용 open**(`{readonly:true}`, 싱글톤) + **`iterate()` 지연소비 행 상한 1000**(무한 재귀 CTE 종료) — `safeQuery` never-500. better-sqlite3 `interrupt()` 부재로 인프로세스 타임아웃 대신 행 상한
- [x] `[§4]` 라이브 검증: 실제 `db/worldcup.db`로 유효 실행·INSERT/DROP/UPDATE/멀티 거부·bad column→error 확인

## 실행 + UI (§5) ✅
- [x] `[§5]` Server Action(`askAction`) → orchestrator `ask()`(§3 answer → §4 safeQuery) → 단일 discriminated 결과. 입력 untrusted 검증(trim·길이·키)
- [x] `[§5]` BYOK — `ApiKeyDialog`(native `<dialog>`) + `useApiKey`(useSyncExternalStore, localStorage, 서버 미저장) + 모델 선택
- [x] `[§5]` `QueryContainer`(상태 단독소유)·`QueryInput`(예시칩·⌘Enter)·`SqlViewer`·`ResultsTable`(위치배열·truncate 배지)
- [x] `[§5]` LLM 라이브 검증 — **Claude 키로 전체 플로우 성공**(질문→SQL→검증→실행→테이블). Gemini 무료 티어는 계정별 `limit:0` 가능 → 멀티프로바이더 BYOK로 우회 확인
- [x] `[§5]` 모델 ID 견고화 — 배포용 안정 모델(`gemini-2.0-flash` 기본) + 무효/deprecated 저장값 자동교체(`isKnownModel`)

## 시각화 (§6) ✅
- [x] `[§6]` `ChartView` — 결과 shape 감지 라우팅(`chooseChart`: scalar/bar/line/pie/table). LLM `viz_hint`는 shape 호환 시만 채택, 테이블 항상 폴백. Recharts + 차트/테이블 토글. 프롬프트에 viz_hint 지침 추가
- [x] `[§6]` `BracketTree` — **D3 인터랙티브 대진표** (`/bracket`). 순수 레이아웃(`layoutBracket`, next_match_id 트리·테스트) + D3 렌더(엘보 커넥터·승자 녹색 강조·호버 stroke+상세 title·컬럼별 페이드인). 공유 `lib/db.ts` readonly 커넥션(execute와 재사용). 헤드리스 검증: 16박스·14커넥터·에러0

## eval + 배포 (§7)
- [x] `[§7]` gold set **15문항**(`eval/gold-set.json`, `order_sensitive` 태깅) — §3.1 기반, 전부 `safeQuery` 통과 검증
- [x] `[§7]` execution-match eval 스크립트(`pnpm eval`, temperature=0) + 순수 비교 로직(`lib/eval/compare.ts`, 테스트). 실행엔 서버측 키(EVAL_API_KEY) 필요
- [ ] `[§7]` 안전성 수동 테스트(인젝션·비용공격 → 읽기전용 open·쿼리 타임아웃 차단 확인)
- [ ] `[§7]` Vercel 배포
- [ ] `[§7]` 제품 README(reader-facing) 작성 — Phase D

## Phase 2 확장 (별도 트랙, 본 프로젝트 완주 후)
- [ ] semantic-layer 방식 병행 + 동일 gold set으로 raw SQL vs semantic 비교
