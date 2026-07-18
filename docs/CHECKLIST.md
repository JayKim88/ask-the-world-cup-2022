# Ask the World Cup 2022 — 빌드 체크리스트

> 단일 소스는 [PRD.md](PRD.md). 이 파일은 **빌드 순서 + 진행 추적**만 담당(§N = 커밋 태그).
> 커밋 컨벤션: `<type>(<scope>): <subject> [§N]` · scope = `infra`·`seed`·`nl2sql`·`safety`·`exec`·`ui`·`chart`·`bracket`·`eval`

## Phase B — 툴체인 (§1)
- [ ] `[§1]` Next 16(App Router)+React 19+TS+Tailwind 4 스캐폴딩
- [ ] `[§1]` kit eslint 템플릿(flat config) 적용 + prettier + `.nvmrc`(22)
- [ ] `[§1]` lint/typecheck/build/test 스크립트 + vitest
- [ ] `[§1]` `.env.example` (API_FOOTBALL_KEY·SUPABASE·TEXT2SQL_MODEL)
- [ ] `[§1]` shadcn/ui 초기화 (컴포넌트 필요 시점에)

## 데이터 (§2)
- [ ] `[§2]` 전용 격리 Supabase 프로젝트 생성 + 스키마(5테이블) + read-only role 하드닝
- [ ] `[§2]` API-Football 시딩 스크립트 (fixtures·statistics·events·players·standings → Supabase, 2일 배치)
- [ ] `[§2]` `next_match_id`·`winner_team_id`(pen>et>ft) 시딩 시 구성

## NL→SQL 파이프라인 (§3)
- [ ] `[§3]` 스키마 컨텍스트 주입 프롬프트 + `generateObject`(Zod: `{sql, explanation}`)
- [ ] `[§3]` 응답 status enum(`planned`/`clarify`/`rejected`/`error`) + never-500 wrapper

## 안전성 (§4)
- [ ] `[§4]` AST 검증기(`libpg_query`) — 단일 SELECT/WITH만 통과
- [ ] `[§4]` 실행 래퍼: read-only role + `statement_timeout` + 강제 LIMIT, RPC는 `SECURITY INVOKER`

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
- [ ] `[§7]` 안전성 수동 테스트(인젝션·비용공격 → role/timeout 차단 확인)
- [ ] `[§7]` Vercel 배포
- [ ] `[§7]` 제품 README(reader-facing) 작성 — Phase D

## Phase 2 확장 (별도 트랙, 본 프로젝트 완주 후)
- [ ] semantic-layer 방식 병행 + 동일 gold set으로 raw SQL vs semantic 비교
