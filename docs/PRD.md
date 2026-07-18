# Ask the World Cup 2022 — PRD (제품 요구사항 문서)

> **작성일**: 2026-07-18
> **목적**: 자연어 질문을 SQL로 변환해 2022 FIFA 카타르 월드컵 데이터를 탐색하는 학습 + 데모 겸용 미니 프로젝트. text-to-sql·구조화 LLM 출력·SQL 안전성 검증·정확도 eval 루프 실습이 1차 목표이며, 동시에 공유 가능한 배포형 데모로 완성한다.
> **개발 기간**: 목표 2일 (AI 코딩 어시스턴트 활용) — **초과 허용**. 스코프를 시간에 맞춰 자르지 않고, 완성도를 우선한다.
> **관리 형태**: 코드 스캐폴딩 없이 기획 문서 우선 확정. 착수는 별도 승인 후.

---

## 0. 한 장 요약

| 항목 | 내용 |
|---|---|
| 무엇 | 자연어 질문 → LLM이 SQL 생성 → 검증 → 실행 → 결과(테이블+차트) 표시하는 2022 월드컵 데이터 탐색 웹앱 |
| 도메인 | 2022 FIFA 카타르 월드컵 (32팀·64경기, 완결) — 팀·조·경기 결과·**경기 통계(점유율·슈팅·카드·코너·파울·패스)**·골(득점자·어시스트)·선수·토너먼트 대진표 |
| 학습 목표 | 스키마-그라운딩 프롬프팅 · 구조화 출력(Zod) · SQL 안전성 검증 · 정확도 eval 루프 · 재귀 CTE |
| 데모 목표 | BYOK(브라우저 저장 API Key) + Supabase 공개 read-only DB로 누구나 접속해 바로 써볼 수 있는 배포형 데모 |
| 시각화 | 기본 차트(막대/선/파이) + **D3 시그니처 시각화**(인터랙티브 토너먼트 대진표 트리 — 호버 시 경기 상세, 전환 애니메이션) |
| 스택 | Next.js(App Router) + TypeScript + Tailwind/shadcn + Vercel AI SDK + Zod + Supabase(Postgres) |
| 개발 기간 | 목표 2일, 초과 허용 |

---

## 1. 학습 목표

| 연습 대상 | 구체적으로 |
|---|---|
| 스키마-그라운딩 프롬프팅 | 월드컵 스키마를 컨텍스트로 주입해 LLM이 그 스키마에 맞는 SQL만 생성 |
| 구조화 출력 검증 | `generateObject` + Zod로 `{ sql, explanation }` 강제 |
| 안전성 검증 계층 | (1차) 앱: **AST 파서로 단일 SELECT/WITH만 통과** — (2차·진짜 방어선) DB: **격리 프로젝트 + SELECT 전용 read-only role + `statement_timeout` + 강제 LIMIT** (§4.1) |
| 정확도 eval 루프 | gold SQL 세트 대비 execution-match 정확도 측정 |
| 재귀 CTE | 토너먼트 대진표를 `next_match_id` 자기참조로 모델링 → "이 팀이 최종적으로 어디까지 진출했는가"를 재귀 CTE로 추적 |

---

## 2. 스코프

### Required
- [ ] API-Football로 2022 WC 스냅샷 시딩 (팀·경기·통계·이벤트·선수) — §3
- [ ] **전용 격리 Supabase 프로젝트** 생성 + 스키마 + read-only role 하드닝(SELECT 전용, `default_transaction_read_only`, `statement_timeout`, `search_path`) (§4.1)
- [ ] NL → SQL 생성 (Vercel AI SDK `generateObject`, Zod: `{ sql, explanation }`)
- [ ] SQL 안전성 검증기 — **AST 파서(`libpg_query`)로 단일 SELECT/WITH만 통과** (§4.1)
- [ ] 쿼리 실행 + 결과 반환
- [ ] BYOK UI — 설정 모달, 브라우저 로컬 저장만, 서버 미저장
- [ ] 질의 입력 + SQL 뷰어 + 결과 테이블 (§6 UI 구성)
- [ ] 기본 차트(막대/선/파이) — 결과 shape에 따라 자동 선택
- [ ] D3 시그니처 시각화 — 인터랙티브 토너먼트 대진표 트리 (재귀 CTE 결과 렌더링, 호버로 경기 상세)
- [ ] gold SQL 세트 15~20문항 (§3.1 질문 뱅크 기반)
- [ ] eval 스크립트 — execution-match 정확도 산출
- [ ] Vercel 배포 (데모 공유의 전제조건)
- [ ] 안전성 수동 테스트 (인젝션·비용 공격 케이스 → read-only role + timeout에서 차단 확인)

### Optional (여력 되면)
- [ ] 멀티 모델 비교 eval (GPT-4.1 / Gemini / Claude 정확도 비교표)
- [ ] 쿼리 설명 확장 — SQL 각 절(WHERE/JOIN/GROUP BY)을 자연어로 풀이
- [ ] 오답 케이스 자동 재시도(self-correction) 실험
- [ ] 커스텀 도메인

### Phase 2 확장 (본 프로젝트 완료 후, 별도 학습 단계)
- [ ] **Semantic-layer 방식 병행 구현** — LLM이 raw SQL이 아니라 **제약된 쿼리 플랜**(정의된 metric/dimension enum)을 뱉고, 결정적 컴파일러가 SQL을 생성하는 방식 (레퍼런스 `nl_to_plan_llm.py` 패턴). 프로덕션 분석 제품의 표준 접근을 손으로 익히는 목적.
  - 재사용: **같은 Supabase DB + 같은 §3.1 질문 뱅크 + 같은 eval 하버스**를 그대로 씀 → 코드만 NL→plan→SQL 경로 추가
  - **결과물 = 직접 비교**: 동일 질문 세트로 `raw SQL` vs `semantic layer` 정확도·실패패턴을 나란히 측정 → 두 접근의 트레이드오프(표현력 vs 신뢰성)를 데이터로 체감. text-to-sql을 "양쪽 다" 이해했다는 학습/포트폴리오 증거
  - 스코프 주의: 본 프로젝트(raw SQL) 완주가 먼저. semantic layer는 그 위에 얹는 별도 트랙 (동시 진행 금지 — 학습 순서상 raw SQL로 SQL 감각을 먼저 다진 뒤가 효과적)

---

## 3. 데이터 소스 & 스키마

**소스**: [API-Football](https://www.api-football.com/) (api-sports.io) **단독** — `league=1, season=2022`. 스파이크(2026-07-18)로 **무료 티어에서 아래를 전부 실측 확정**:

| 엔드포인트 | 실측 내용 |
|---|---|
| `fixtures?league=1&season=2022` | **64경기 전부 완료**. 라운드(Group Stage 1~3·Round of 16·Quarter-finals·Semi-finals·3rd Place·Final)·스코어(halftime·fulltime·extratime·penalty)·경기장·도시·**심판**(64/64) |
| `fixtures/statistics?fixture=` | 팀별 **점유율·슈팅(총/유효/블록/박스내외)·코너·파울·오프사이드·옐로/레드카드·GK세이브·패스(총/정확도)** |
| `fixtures/events?fixture=` | 골 이벤트 — **득점자 player_id + 어시스트 player_id** + 분 + 유형(Normal/Penalty/Own Goal) |
| `players` / `standings` | 선수(id·이름·포지션·등번호) / 조(A~H) 배정 |

> **왜 2022인가** (2026 아님): API-Football 무료 티어는 시즌이 2022~2024로 열려 있어 **상세 통계가 전부 무료**다(2026은 유료 잠금 — 실측 확인). 또 골 이벤트가 **player_id로 연결**돼 이름 매칭 없이 정확하고, 어시스트·심판까지 포함된다. 대회도 완결(아르헨티나 우승)이라 대진표가 100% 채워진다. → 학습/데모에 필요한 데이터 풍부함·정합성·완결성 모두 2022가 우월.

실시간 연동이 아닌 **스냅샷 시딩** — 시딩 스크립트가 위 엔드포인트를 1회 호출해 Supabase에 적재(무료 100 req/day, 총 ~200요청이라 2일 배치). 이후 앱은 런타임에 API-Football을 호출하지 않음(사용자 질의는 Supabase에만). eval 재현성(같은 gold set이 항상 같은 답) 확보에도 스냅샷이 유리.

**스키마** (API-Football 실측 구조 기반):

```
teams        (id, name, code, group_letter, ...)          -- standings에서 group_letter
matches      (id, round[group|ro16|qf|sf|third_place|final],
              group_letter?, home_team_id, away_team_id,
              ht_home, ht_away,                            -- 전반 → "역전패" 류 질문 재료
              ft_home, ft_away,                            -- 정규 90분
              et_home?, et_away?, pen_home?, pen_away?,    -- 연장·승부차기 (녹아웃)
              winner_team_id?,                             -- 재귀 CTE 순회 기준 (pen>et>ft로 판정)
              venue, city, referee, kickoff_at, next_match_id)  -- next_match_id = 자기참조 FK
match_stats  (id, match_id, team_id,
              possession, shots_total, shots_on, shots_off, shots_blocked,
              corners, fouls, offsides, yellow_cards, red_cards,
              gk_saves, passes_total, passes_pct)          -- fixtures/statistics에서
goals        (id, match_id, team_id, scorer_player_id, assist_player_id?,
              minute, detail[normal|penalty|owngoal])      -- fixtures/events에서, player_id 연결
players      (id, team_id, name, position, shirt_number)
```

> `next_match_id`는 API에 명시적으로 없으므로 시딩 스크립트에서 대진표 구조로 구성한다 (16강→...→결승 고정 포맷).
>
> `winner_team_id`는 녹아웃 승자를 명시적으로 저장한다 — 재귀 CTE가 "승자" 기준으로 순회하는데, 승부차기로 결정된 경기는 정규 스코어만으론 승자를 못 정하기 때문. 시딩 시 **`pen`(승부차기) > `et`(연장) > `ft`(정규) 순으로 계산**해 채운다.
>
> 조별 순위는 테이블로 저장하지 않는다 — 매번 `matches`에서 GROUP BY + 윈도우 함수로 승점·득실차를 계산하게 해서 학습 포인트로 남긴다. (조 배정 글자 A~H만 `teams.group_letter`에 시딩; 순위는 사용자가 계산)

### 3.1 질문 뱅크 (gold set 소스 겸 품질 테스트 세트)

이 목록은 두 용도로 재사용한다: ① `eval/gold-set.json`의 초안(§2 Required의 execution-match 정확도 측정용) ② **구현 중·후 품질 테스트 세트** — 프롬프트·모델·스키마를 바꿀 때마다 이 목록을 다시 돌려 회귀를 잡고, 배포 전 스모크 테스트로도 그대로 쓴다. 모든 질문은 §3 실측 데이터로 답변 가능함을 확인함.

> gold set의 각 항목은 `order_sensitive` 플래그를 갖는다(§5 채점 규칙). "TOP N"·"순위"·"가장 많은/큰" 류는 `true`(순서까지 정답), 나머지는 `false`(집합 비교). 이 태깅이 없으면 순서 틀린 TOP-N이 오답인데 통과하는 거짓 정확도가 나온다.

| 패턴 | 예시 질문 | 답하는 데이터 | 난이도 |
|---|---|---|---|
| 단순 필터 | "8강에 진출한 팀 목록" | matches(round) | 쉬움 |
| 단순 필터 | "승부차기까지 간 경기만 보여줘" | matches(penalty) | 쉬움 |
| 단순 필터 | "D. Orsato 심판이 맡은 경기" | matches(referee) | 쉬움 |
| JOIN | "각 경기의 홈·원정팀과 최종 스코어" | matches + teams | 쉬움 |
| JOIN | "결승전에 출전한 두 팀은?" | matches(round=Final) | 쉬움 |
| 집계 | "팀별 총 득점" | goals GROUP BY team | 쉬움 |
| 집계 | "득점왕 TOP 10" | goals(scorer_player_id) + players | 보통 |
| 집계 | "어시스트 많은 선수 TOP 10" | goals(assist_player_id) + players | 보통 |
| 집계 | "카드를 가장 많이 받은 팀 TOP 5" | match_stats(yellow/red) | 보통 |
| 집계 | "평균 점유율이 가장 높은 팀" | match_stats(possession) | 보통 |
| 집계 | "심판별 평균 파울 수" | matches(referee) + match_stats(fouls) | 보통 |
| 집계 | "한 경기 3골(해트트릭) 넣은 선수" | goals GROUP BY match,player | 보통 |
| 서브쿼리 | "전반에 앞섰지만 최종 패배한 경기" | matches(ht vs ft) | 보통 |
| 서브쿼리 | "대회 평균 점유율보다 높았는데 진 경기" | match_stats + 서브쿼리 | 어려움 |
| 서브쿼리 | "슈팅 대비 득점 효율이 가장 좋은 팀" | match_stats(shots) + goals | 어려움 |
| 윈도우 함수 | "조별 순위 (승점·득실차)" | matches → RANK OVER PARTITION BY group | 어려움 |
| 윈도우 함수 | "각 조 1·2위 (16강 진출팀)" | 위 + 윈도우 필터 | 어려움 |
| 윈도우 함수 | "라운드별 최다 득점 팀" | goals + RANK OVER PARTITION BY round | 어려움 |
| 재귀 CTE | "아르헨티나의 우승까지 전체 경로" | 재귀 CTE(next_match_id·winner) → D3 대진표 | 어려움 |
| 재귀 CTE | "결승 진출 두 팀의 토너먼트 여정 비교" | 재귀 CTE | 어려움 |
| 복합 | "8강 진출 팀 중 조별리그 무패였던 팀" | 집계+필터 복합 | 매우 어려움 |
| 복합 | "자책골이 나온 경기와 그 선수·팀" | goals(detail=owngoal) | 어려움 |
| 복합 | "페널티킥으로만 득점한 선수" | goals(detail=penalty) | 어려움 |

**안전성 테스트 세트** (gold set과 별도 — `ErrorMessage`/검증기 동작 확인용, §7 DoD의 인젝션 케이스와 함께 실행):

| 질문 | 테스트 목적 |
|---|---|
| "가장 감동적인 경기 보여줘" | DB에 없는 주관적 개념 — 존재하지 않는 컬럼을 지어내지 않고 정중히 거부하는지 |
| "이 팀 이겼어?" (팀 미지정) | 컨텍스트 없는 모호한 질문 — 명확화 요청 또는 거부 처리 |
| "다음 경기 결과 예측해줘" | 조회가 아닌 예측/생성 영역 — SQL 스코프 밖임을 인지하는지 |
| `DROP TABLE matches` 등 인젝션 시도 | AST 검증기 + read-only role 양쪽에서 차단되는지 (§7 DoD) |

---

## 4. 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 14 (App Router) + TypeScript |
| 스타일링 | Tailwind CSS + shadcn/ui |
| DB | Supabase (Postgres), `@supabase/supabase-js` 직접 사용 — ORM 없음 (스키마가 단순해 마이그레이션 도구 없이도 충분). 보안은 §4.1 |
| 데이터 시딩 | API-Football (api-sports.io) — 1회성 스냅샷, `API_FOOTBALL_KEY` env var. tsx 스크립트 |
| LLM 호출 | Vercel AI SDK `generateObject` |
| 검증 | Zod + `libpg_query`(AST 파서, SQL 안전성 검증) |
| 모델 지정 | env var `TEXT2SQL_MODEL` — API Key는 BYOK로 클라이언트가 요청마다 전달, 서버 미저장 |
| 기본 차트 | Recharts |
| 시그니처 시각화 | D3.js `d3.tree()` 기반 인터랙티브 트리 — 호버 시 경기 상세, 라운드 전환 애니메이션 |
| eval | tsx 스크립트 |
| 배포 | Vercel (Required — 데모 공유의 전제조건) |

### 4.1 DB 보안

**위협 모델 재정의 (여기서 출발한다):** 이 데모의 데이터는 100% 공개된 월드컵 사실이다. → **기밀성(confidentiality)은 목표가 아니다** (누가 전체를 읽어가도 손해 0). 지켜야 하는 것은 셋뿐:

| 지킬 것 | 위협 | 맞는 방어 |
|---|---|---|
| **무결성** — 데모 데이터가 훼손되지 않을 것 | 변조·삭제 | 전용 read-only role (+ `default_transaction_read_only` 이중잠금) |
| **가용성** — 데모가 죽지 않을 것 | 비용 공격(DoS) | `statement_timeout` + 강제 `LIMIT` |
| **격리** — 이 DB가 다른 데이터로 가는 발판이 안 될 것 | 시스템/타 스키마 탐색, pivot | **전용 격리 프로젝트** + 최소 grant + `search_path` 잠금 |

학습 목표가 text-to-SQL이므로 "임의 SELECT 실행"은 없앨 수 없는 고정 제약이다. 그 전제 위에서 앱 검증기는 **우회 가능한 1차 보호**로 두고, 진짜 경계는 DB 권한·격리에 둔다.

**(1) 전용 격리 Supabase 프로젝트 — blast radius = 0** (가장 값싸고 강력한 한 방)
이 데모만을 위한 **독립 Supabase 프로젝트**에 올린다. 공개 데이터라 기밀성이 무의미한 점을 역이용 — 모든 방어가 뚫려도 훔칠 것도, 갈 곳도 없다. **AnswerRank 등 실데이터가 있는 프로젝트/조직과 절대 공유하지 않는다.**

**(2) DB role 하드닝**
```sql
-- 앱 접속용 전용 role
ALTER ROLE demo_readonly SET default_transaction_read_only = on;  -- 쓰기 이중 잠금
ALTER ROLE demo_readonly SET statement_timeout = '5s';           -- 비용 공격 차단
ALTER ROLE demo_readonly SET search_path = 'public';             -- 스키마 탐색 제한
-- public 5개 테이블에만 SELECT grant, 그 외(system/auth/기타 스키마) REVOKE
```
- 실행 래퍼에서 결과 행 강제 `LIMIT`(예: 1000) 적용
- SQL을 실행하는 RPC 함수는 반드시 **`SECURITY INVOKER`** (DEFINER면 소유자 권한으로 실행돼 role 제한·RLS가 우회됨)

**(3) 앱 검증기 — 정규식 키워드 차단이 아니라 AST 파서**
`DROP`·`;` 문자열 매칭은 주석(`/**/`)·인코딩·키워드 미사용 우회에 취약하다. 대신 **`libpg_query`(pgsql-parser)로 파싱해 "statement 정확히 1개 + 타입이 `SELECT`/`WITH`"만 통과**시킨다. 1차 방어라도 파서가 정규식보다 압도적으로 견고하다.

> ⚠ **RLS는 이 목적의 주 방어선이 아니다.** RLS는 "누가 어떤 행을 보느냐"를 나누는 도구(멀티테넌트 유저 격리)일 뿐, `pg_sleep()`·시스템 테이블 읽기·비용 공격을 막지 못한다. 이 데모는 모두가 같은 공개 데이터를 보므로 나눌 것도 없다 → **RLS는 불필요/보조. 방어의 핵심은 격리 프로젝트 + read-only role + timeout + AST 검증.**

---

## 5. 아키텍처 흐름

```
[최초 1회] 사용자가 설정 모달에서 API Key 입력 → 브라우저 로컬 저장
           (요청 시 Server Action으로 전송되나 서버에 저장하지 않음)

사용자 NL 질문
  → (클라이언트) 요청에 API Key 동봉
  → 스키마 컨텍스트 주입 프롬프트
  → LLM (generateObject, Zod: {sql, explanation})
  → 안전성 검증기 (AST 파서로 단일 SELECT/WITH만) — 앱 레벨 1차 방어(우회 가능, UX/비용 보호)
  → Supabase 실행 (전용 read-only role + statement_timeout + LIMIT) — DB 레벨 2차 방어(진짜 경계)
  → 결과 테이블 + 차트(자동 선택) 반환
  → 결과가 (team, round, next_match_id) 경로 형태면 D3 대진표 트리로 자동 분기

[별도 트랙] eval 스크립트
  gold set (question, gold_sql, order_sensitive)[]
  → 각 question에 대해 위 파이프라인 실행 (temperature=0, 서버 보유 테스트용 키)
  → 생성 SQL 실행 결과 vs gold SQL 실행 결과 비교 (execution match)
      · order_sensitive=false → 행 집합 비교 (순서 무시)
      · order_sensitive=true  → 행 순서까지 비교 (TOP-N·랭킹 질문)
      · 컬럼은 값 기준 비교 (컬럼명 불일치 허용, alias 차이 무시)
  → 정확도 % + 실패 케이스 로그

  ⚠ temperature=0이라도 완전 결정적이지 않음 — 정확도 수치는 단일 실행 기준의
    근사치로 보고, 프롬프트/모델 변경 회귀 감지 용도로 사용 (절대 벤치마크 아님)
```

---

## 6. UI 구성

**단일 페이지(SPA형)** 구조 — 화면 전환 없이 "질문→결과" 루프 하나로 완결.

| 컴포넌트 | 역할 |
|---|---|
| `ApiKeyDialog` | 설정 아이콘 클릭 시 오픈, API Key 입력 + 브라우저 로컬 저장 안내 |
| `QueryInput` | 텍스트 입력 + 예시 질문 칩 + 질문하기 버튼 |
| `QueryContainer` | SQL/결과/차트 오케스트레이션 |
| `SqlViewer` | 생성된 SQL + explanation 표시 |
| `ResultsTable` | 결과 테이블 |
| `ChartView` | 결과 shape 감지 → 기본 차트 or `BracketTree`로 자동 분기 |
| `BracketTree` | D3 인터랙티브 트리 — 재귀 CTE 결과(토너먼트 경로) 렌더링, 호버로 경기 상세 |
| `ErrorMessage` / `ResultSkeleton` | 에러/로딩 상태 |

### 와이어프레임 — 기본 상태 (질문 전)

```
┌──────────────────────────────────────────────────────┐
│  ⚽ Ask the World Cup 2022!                       ⚙    │
│  카타르 월드컵 데이터에 대해 질문해보세요                │
│                                                        │
│  ┌──────────────────────────────────────────┐ ┌─────┐ │
│  │ 데이터에 대해 질문해보세요...                │ │질문 │ │
│  └──────────────────────────────────────────┘ │하기 │ │
│                                                 └─────┘ │
│  [조별 순위]  [득점왕 TOP10]  [카드 많이 받은 팀]       │
│  [평균 점유율 높은데 진 경기]  [8강 진출 팀]            │
│  [아르헨티나의 우승 경로]                                │
└──────────────────────────────────────────────────────┘
```

### 와이어프레임 — 결과 상태 (윈도우 함수)

```
┌──────────────────────────────────────────────────────┐
│  생성된 SQL                                            │
│  ┌────────────────────────────────────────────────┐  │
│  │ SELECT team, RANK() OVER (PARTITION BY group ...  │  │
│  └────────────────────────────────────────────────┘  │
│  ▸ 조별로 승점·득실차 기준 순위를 매겼습니다...          │
│                                                        │
│  [테이블]  [차트]                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ group | team        | rank                       │  │
│  │ A     | Netherlands | 1                           │  │
│  │ A     | Senegal     | 2                           │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 와이어프레임 — 결과 상태 (재귀 CTE → D3 대진표 트리)

```
┌──────────────────────────────────────────────────────┐
│  생성된 SQL: WITH RECURSIVE path AS (... next_match_id) │
│  ▸ 아르헨티나가 우승까지 거친 경기를 추적했습니다        │
│                                                        │
│  [테이블]  [대진표 트리] ← 결과 shape 감지, 자동 전환    │
│                                                        │
│   16강 ──┐                                            │
│          ├── 8강 ──┐         (호버 시 경기 상세 툴팁,   │
│   16강 ──┘         ├── 4강 ──┐ 라운드 전환 애니메이션)  │
│   16강 ──┐         │         ├── 결승(승부차기 승)     │
│          ├── 8강 ──┘         │                        │
│   16강 ──┘                   │                        │
└──────────────────────────────────────────────────────┘
```

### 6.1 출력 표현 라우팅

**2단계 분리** — 스타일 결정은 AI가 아니라 **앱이 실제 결과 shape로** 한다:

```
① AI 단계: NL → generateObject → { sql, explanation, viz_hint? }
   (이 시점엔 쿼리 미실행 → LLM은 결과 행수·컬럼타입을 모름)
② 앱 단계: sql 실행 → 실제 결과(컬럼·타입·행수) 확인 → 출력 스타일 결정
```

`viz_hint`(선택)는 **제안일 뿐**, 앱이 실제 shape과 대조해 안 맞으면 무시하고 shape 기반으로 폴백한다. **테이블은 항상 폴백 가능한 기본값**.

| 결과 shape | 표현 |
|---|---|
| 1행 × 1값 (스칼라) | 큰 텍스트 / 스탯 카드 |
| 1행 × 여러 값 | 키-값 카드 or 단일행 테이블 |
| 여러 행 × (범주1 + 숫자1) | 테이블 + **막대** (순서형/날짜면 **선**) |
| 부분-전체 비율 | 테이블 + 파이 (남용 금지) |
| 범주2 × 숫자 (매트릭스) | 테이블 (선택적 히트맵) |
| 토너먼트 경로 (team·round·next_match_id) | **D3 BracketTree** |
| 숫자 없는 순수 목록 | 테이블만 |
| 0행 | "결과 없음" 안내 |
| 거부/답변불가 (status≠planned) | `ErrorMessage` |

> ⚠ **BracketTree 분기는 "LLM 출력 컬럼 shape 감지"에 의존하지 않는다.** LLM이 재귀 CTE 결과 컬럼명을 매번 다르게 쓰기 때문. 대진표 예시 칩은 **앱이 소유한 고정 쿼리**로 실행해 결과 shape을 예측 가능하게 하고, 자유 입력은 경로성 컬럼 감지 시 "대진표로 보기"를 **제안**만 하고 강제 전환하지 않는다.

---

## 7. 완료 기준 (DoD)

- gold set 15~20문항 중 execution-match 정확도가 산출됨 (`order_sensitive` 태깅 반영, temperature=0)
- SQL 인젝션/위험 쿼리(`DROP TABLE`, `; DELETE FROM ...`)가 앱 검증기 통과 시에도 **전용 read-only role에서 권한 부족으로 실패**함을 테스트로 확인 (진짜 방어선 검증)
- 비용 공격(예: 대형 CROSS JOIN)이 `statement_timeout`에 걸려 중단됨을 확인
- 실패 케이스(오답 SQL) 최소 1회 분석 + 기록
- BYOK 흐름 확인: API Key가 서버 로그/DB 어디에도 남지 않는지 점검
- 재귀 CTE 쿼리 결과가 D3 대진표 트리로 정확히 렌더링됨 (아르헨티나 우승 경로 수동 검증 1회, 승부차기 경기 포함 시 `winner_team_id` 기준으로 올바르게 순회, 호버 상세 정확성 확인)
- Vercel에 배포되어 외부에서 접속·질의 가능

---

## 8. 리스크 & 결정 로그

| 항목 | 결정/리스크 | 이유 |
|---|---|---|
| 개발 기간 | 목표 2일, 초과 허용 | 스코프를 일정에 맞춰 자르지 않고 완성도를 우선 |
| 도메인 = 2022 (2026 아님) | 스파이크로 확정 — API-Football 무료 티어는 2022~2024만 열림. 2026은 상세통계 유료 잠금·대회 미완(결승 7/19)·골이 이름매칭 | 2022는 통계(점유율·슈팅·카드·코너) 전부 무료 + 골이 player_id로 정합 + 어시스트·심판 포함 + 대회 완결(아르헨티나 우승). 데이터 풍부함·정합성·완결성 모두 우월 |
| 데이터 소스 = API-Football 단독 | 팀·경기·통계·이벤트·선수가 한 소스에 다 있음 | 단일 소스라 병합·정합성 리스크 없음. 골 이벤트에 player_id가 붙어 이름매칭 불필요(2026의 86% 문제 소멸) |
| 시딩 = 1회성 스냅샷 (~200 req, 2일 배치) | 무료 100 req/day | 앱은 런타임에 API 미호출(Supabase만). eval 재현성 확보. rate limit은 1회성 시딩엔 무관 |
| `next_match_id`/`winner_team_id` 구성 | API에 대진표 연결·승부차기 승자 판별이 명시적으로 없음 | 시딩 시 대진표 고정 포맷으로 next_match_id 구성, 승자는 `pen>et>ft`로 계산. 재귀 CTE flagship 생존 필수 |
| 위협 모델 = 기밀성 제외, 무결성·가용성·격리만 | 데이터가 100% 공개라 confidentiality가 목표가 아님 | 방어 설계의 출발점. 지킬 게 셋으로 좁혀져 과설계 없이 정확한 방어 선택 가능 |
| DB 방어 = 격리 프로젝트 + read-only role + timeout + AST 검증 (RLS 아님) | RLS는 행 필터일 뿐 비용공격·시스템테이블·`SECURITY DEFINER` 우회를 못 막음. 정규식 키워드 차단은 주석/인코딩 우회에 취약 | ①전용 격리 Supabase 프로젝트로 blast radius=0 ②role 하드닝(read-only·timeout·search_path) ③`libpg_query` AST로 단일 SELECT만 통과. 앱 검증기는 우회 가능한 1차 보호로 격하, RPC는 `SECURITY INVOKER` |
| eval 채점 = `order_sensitive` 태깅 + temperature=0 | 단순 집합 비교는 순서 틀린 TOP-N을 오답인데 통과시킴 | text-to-sql 채점은 순서 민감도 구분이 필요 (Spider도 단순 집합비교 안 씀). 단일 실행 수치는 회귀 감지용 근사치 |
| D3 인터랙티브 트리 | 호버 상세·전환 애니메이션 포함 | 재귀 CTE 결과를 데모에 걸맞은 완성도로 시각화 |
| ORM 미사용 (Prisma 생략) | Supabase 클라이언트 직접 사용 | 스키마가 단순해 마이그레이션 도구 없이도 충분 |
| Vercel 배포 Required | 데모 공유가 핵심 요구사항이므로 배포 자체가 선택사항일 수 없음 | — |
| 조별 순위 미저장 | 매번 쿼리로 계산 (조 배정 글자만 시딩) | 윈도우 함수 학습 포인트를 남기기 위함 |
| judge 모델 없이 execution match만 사용 | text-to-sql은 결과 집합 비교로 충분히 객관적 채점 가능 | LLM judge는 과설계 |
