# 테스트 가이드

## 개요

이 프로젝트는 5개 API 모듈에 대한 포괄적인 테스트 스위트를 제공합니다:

- **exchange-rates**: 환율 조회 API (7개 테스트)
- **popups**: 팝업 관리 API (20개 테스트)
- **stores**: 매장 관리 API (17개 테스트)
- **devices**: 기기 관리 API (18개 테스트)
- **config**: 설정 관리 API (14개 테스트)

**총 76개의 테스트 케이스**가 작성되어 있으며, 모든 테스트가 통과합니다.

## 테스트 프레임워크

- **Vitest**: 빠르고 현대적인 테스트 프레임워크
- **MongoDB Memory Server**: 인메모리 MongoDB로 빠른 테스트 실행
- **Fastify inject**: HTTP 요청 시뮬레이션

## 테스트 실행

### 전체 테스트 실행

```bash
npm test
```

### 특정 모듈 테스트

```bash
npm test -- tests/modules/exchange-rates.test.ts
npm test -- tests/modules/popups.test.ts
npm test -- tests/modules/stores.test.ts
npm test -- tests/modules/devices.test.ts
npm test -- tests/modules/config.test.ts
```

### Watch 모드

```bash
npm run test:watch
```

### UI 모드

```bash
npm run test:ui
```

## 테스트 커버리지

각 모듈별로 다음 시나리오를 테스트합니다:

### 1. Exchange Rates API (환율 조회)

- ✅ 최신 환율 조회 (성공/실패)
- ✅ 여러 환율 데이터 중 최신 선택
- ✅ 특정 날짜 환율 조회
- ✅ 존재하지 않는 날짜 처리
- ✅ 잘못된 날짜 형식 처리

### 2. Popups API (팝업 관리)

- ✅ 전체 팝업 목록 조회
- ✅ 상태별 필터링 (SCHEDULED, ACTIVE, ENDED)
- ✅ 활성 팝업 조회
- ✅ 팝업 상세 조회
- ✅ 팝업 생성 (기본, 캐릭터, 할인 설정)
- ✅ 팝업 수정 (이름, 기간)
- ✅ 팝업 상태 변경
- ✅ 팝업 삭제
- ✅ 404 에러 처리

### 3. Stores API (매장 관리)

- ✅ 전체 매장 목록 조회
- ✅ 국가별 필터링
- ✅ 그룹별 필터링
- ✅ 매장 상세 조회
- ✅ 매장 생성 (기본, owner 없이, devices 없이)
- ✅ 매장 수정 (이름, 정산 정보, 기기 목록, 점주 정보)
- ✅ 매장 삭제
- ✅ 404 에러 처리

### 4. Devices API (기기 관리)

- ✅ 전체 기기 목록 조회
- ✅ 매장별 필터링
- ✅ 국가별 필터링
- ✅ 기기 상세 조회
- ✅ 기기 등록 (기본, hddSerial 없이, 다양한 programType)
- ✅ 기기 수정 (이름, HDD 시리얼, 매장, 프로그램 타입, 국가)
- ✅ 기기 삭제
- ✅ 404 에러 처리

### 5. Config API (설정 관리)

- ✅ 전체 설정 조회
- ✅ 특정 설정 조회
- ✅ 설정 수정 (upsert)
- ✅ 환율 API 설정 관리
- ✅ Feature flags 관리
- ✅ 부분 수정 지원
- ✅ 자동 updatedAt 갱신
- ✅ 복잡한 중첩 객체 저장
- ✅ 404 에러 처리

## 테스트 구조

### 디렉토리 구조

```
tests/
├── setup.ts                    # 전역 테스트 설정
├── helpers/
│   └── test-app.ts            # Fastify 앱 + MongoDB 헬퍼
└── modules/
    ├── exchange-rates.test.ts
    ├── popups.test.ts
    ├── stores.test.ts
    ├── devices.test.ts
    └── config.test.ts
```

### 테스트 패턴

각 테스트는 AAA (Arrange-Act-Assert) 패턴을 따릅니다:

```typescript
it('테스트 설명', async () => {
  // Arrange: 테스트 데이터 준비
  const testData = { ... };

  // Act: API 호출
  const response = await context.app.inject({
    method: 'GET',
    url: '/api/endpoint',
  });

  // Assert: 결과 검증
  expect(response.statusCode).toBe(200);
  expect(body.data).toBeDefined();
});
```

## 중요 참고사항

### 스키마 검증

- `serverFeeRate`: 0-1 범위 (예: 0.30 = 30%)
- `revenueConfig` rates: 0-1 범위 (예: 0.60 = 60%)
- 날짜 형식: ISO 8601 (YYYY-MM-DD)

### MongoDB Memory Server

각 테스트는 독립적인 인메모리 MongoDB 인스턴스를 사용하여 다음을 보장합니다:

- 테스트 간 격리
- 빠른 실행 속도
- 외부 의존성 없음

### 에러 처리 테스트

모든 모듈에서 다음 에러 케이스를 테스트합니다:

- 404: 리소스를 찾을 수 없음
- 400: 잘못된 요청/스키마 검증 실패
- 500: 서버 내부 오류

## 향후 개선사항

- [ ] 커버리지 리포트 생성
- [ ] E2E 테스트 추가
- [ ] 성능 테스트 추가
- [ ] CI/CD 파이프라인 통합
