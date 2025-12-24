0. 기본 설계 원칙

0.1 세션(Session) 중심 설계
	•	사진 1회 이용 흐름을 하나의 session_id로 묶는다.
	•	모든 데이터는 아래를 기준으로 연결된다.
	•	매출
	•	UX 이벤트
	•	성능 로그
	•	에러/크래시 로그

0.2 원본 이벤트 vs 집계 데이터
	•	events* : 모든 원본 이벤트 (append-only)
	•	agg* : 대시보드/리포트용 집계 데이터

원본은 짧게 보관, 집계는 장기 보관.

1. 비즈니스 지표 (Revenue / Product)

1.1 핵심 KPI
	•	총 매출 (Total Sales)
	•	세션 수
	•	출력 수량
	•	평균 객단가 (ARPU)
	•	결제 수단 비율 (Cash / Card)

1.2 이벤트 쿠폰 분석
	•	쿠폰 발행 수 / 사용 수
	•	쿠폰 사용률
	•	쿠폰별 매출 기여
	•	쿠폰 사용 시 ARPU 변화

1.3 프레임 / 컷수 / 캐릭터 선호도
	•	프레임 선택 비율
	•	컷수(3컷/4컷/6컷 등) 분포
	•	캐릭터 선택 비율
	•	옵션별 ARPU / 전환율

2. UX 지표 (Behavior / Funnel)

2.1 퍼널 분석
	•	단계별 전환율
	•	단계별 이탈율
	•	단계별 평균 소요 시간 / P95

2.2 화면 체류 시간
	•	화면별 평균 체류 시간
	•	P95 체류 시간
	•	특정 프레임/캐릭터에서 체류 증가 여부

2.3 인터랙션 이벤트
	•	클릭 / 드래그 / 핀치 / 선택
	•	뒤로 가기 / 재선택 반복
	•	과도한 클릭 = UX 문제 신호

3. 시스템 / 성능 / 크래시 지표

3.1 에러 & 크래시
	•	에러 발생 시간
	•	디바이스 ID
	•	선택된 옵션 스냅샷
	•	에러 메시지 / 스택트레이스
	•	에러 발생 전 UX 이벤트(브레드크럼)

3.2 성능 지표
	•	촬영 시간
	•	이미지 렌더링 시간
	•	필터 적용 시간
	•	출력 시간
	•	결제 응답 시간

지표:
	•	평균 / P95 / P99
	•	디바이스별 편차
	•	릴리즈 전후 비교

3.3 하드웨어 신뢰성
	•	프린터 실패율
	•	카메라 재시도 횟수
	•	결제 실패율
	•	용지 부족 빈도

4. MongoDB 컬렉션 설계

4.1 sessions (중심 컬렉션)
{
  _id: "session_id",
  kiosk_id: "D001",
  store_group_id: "G001",
  nation_code: "KOR",
  app_version: "1.2.3",
  started_at: ISODate(),
  ended_at: ISODate(),
  status: "COMPLETED",

  selections: {
    frame_type: "4CUT",
    cut_count: 4,
    character_id: "CHAR_001",
    bg_id: 3,
    filter_id: 2,
    qr_enabled: true
  },

  commerce: {
    payment_method: "CARD",
    unit_price: 6000,
    discount: { coupon: 1000, roulette: 0 },
    amount_paid: 5000,
    currency: "KRW"
  }
}

4.2 UX 이벤트 로그
events_ui {
  ts,
  session_id,
  kiosk_id,
  type: "SCREEN_ENTER | SCREEN_EXIT | CLICK | DRAG | PINCH",
  screen: "FRAME_SELECT",
  target,
  duration_ms
}

4.3 성능 로그
events_perf {
  ts,
  session_id,
  kiosk_id,
  task: "SHOOT | RENDER | PRINT | PAYMENT",
  duration_ms,
  ok
}

4.4 에러 로그
events_errors {
  ts,
  session_id,
  kiosk_id,
  severity,
  code,
  message,
  stacktrace,
  context
}

4.5 크래시 로그
crashes {
  ts,
  session_id,
  kiosk_id,
  app_version,
  error,
  breadcrumbs,
  perf_snapshot
}

6. 인덱스 & TTL 권장

인덱스
	•	sessions: { kiosk_id, started_at }
	•	events_ui: { session_id, ts }
	•	events_perf: { kiosk_id, ts }
	•	events_errors: { code, ts }

TTL
	•	events_ui / events_perf: 30~90일
	•	crashes: 90~180일
	•	agg_*: 장기 보관

7. 수집 우선순위 (ROI 기준)
	1.	sessions + 매출
	2.	SCREEN_ENTER / SCREEN_EXIT
	3.	에러 + 크래시(브레드크럼 포함)
	4.	성능 로그
	5.	집계 자동화

8. 핵심 결론
	•	MongoDB 단독으로 인터랙션 이벤트 대량 수집 가능
	•	세션 중심 설계가 모든 분석의 핵심
	•	원본 이벤트 + 집계 분리로 확장성과 비용을 동시에 확보
	•	현재 요구사항과 미래 확장을 모두 만족하는 구조