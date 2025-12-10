# 데이터베이스 아키텍처 의사결정 로그 v5

> ⚠️ **v6로 대체됨. DECISION_LOG_V6.md 참조**

> **작성일:** 2025-12-10
> **프로젝트:** PhotoSignature 신규 시스템
> **기반:** PHOTOSIGNATURE_DB_SPEC_V4.md → PHOTOSIGNATURE_DB_SPEC_V5.md

이 문서는 v5 스키마 개선을 위한 검토 과정과 결정 사항을 기록합니다.

---

## 1. 검토 배경

### v4 스키마 검토에서 발견된 이슈

| 이슈 | 영향 |
|------|------|
| `sales.date`와 `sales.timestamp` 중복 | 불필요한 저장 공간, 정합성 위험 |
| Schema Validation 없음 | 잘못된 데이터 입력 가능 |
| Connection Pool 전략 미정의 | 1000대 기기 연결 관리 불명확 |
| Read/Write Concern 미정의 | 데이터 일관성 수준 불명확 |
| Monitoring/Alert 미정의 | 운영 중 문제 감지 어려움 |
| popup.status 관리 방식 미명시 | 상태 전이 규칙 불명확 |

---

## 2. `sales.date` 필드 제거

### 문제점

v4에서 날짜 정보가 두 필드에 중복:

```javascript
// v4: 중복
date: ISODate("2025-01-15"),              // 날짜만
timestamp: ISODate("2025-01-15T14:30:00Z") // 전체
```

### 검토 옵션

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 현행 유지 | date + timestamp 둘 다 저장 | 인덱스 효율? | 중복, 정합성 위험 |
| B. timestamp만 | date 제거 | 단순화, 중복 제거 | - |

### 결정: Option B - `timestamp`만 유지

**근거:**
- MongoDB ISODate 인덱스는 날짜 범위 쿼리에 효율적
- `timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") }` 잘 동작
- 두 필드가 어긋날 위험 제거
- 저장 공간 절약

**인덱스 변경:**
```javascript
// v4
db.sales.createIndex({ date: 1, "store.id": 1 })

// v5
db.sales.createIndex({ timestamp: 1, "store.id": 1 })
```

---

## 3. Schema Validation 추가

### 배경

데이터 무결성 보장을 위해 MongoDB Schema Validation 도입.

### 결정: 주요 컬렉션에 Validation 적용

```javascript
// sales collection
db.createCollection("sales", {
  validator: {
    $jsonSchema: {
      required: ["timestamp", "store", "amount", "currency", "status"],
      properties: {
        status: { enum: ["COMPLETED", "CANCELLED", "REFUNDED"] },
        currency: { enum: ["KRW", "JPY", "USD", "VND"] },
        // ...
      }
    }
  },
  validationLevel: "moderate",  // 기존 문서는 업데이트 시에만 검증
  validationAction: "error"
})
```

**validationLevel 선택:**

| 옵션 | 설명 | 선택 |
|------|------|------|
| strict | 모든 INSERT/UPDATE에 검증 | - |
| moderate | 기존 문서는 UPDATE 시에만 검증 | ✅ |

**이유:** 기존 데이터 마이그레이션 시 유연성 확보

---

## 4. Connection Pool 전략

### 배경

1000대 키오스크의 MongoDB 연결 관리 필요.

### 문제점: 키오스크 직접 연결

| 구조 | 필요 연결 수 | M10 지원 |
|------|-------------|----------|
| 키오스크 → MongoDB 직접 | 1000+ | 1,500 (빠듯함) |

키오스크가 직접 연결하면 연결 수 관리가 어려움.

### 결정: API 서버 경유 구조

```
키오스크 (1000대) → HTTP → API 서버 (2~3대) → MongoDB
```

```javascript
// API Server의 Connection Pool
const client = new MongoClient(uri, {
  maxPoolSize: 100,           // 서버당 최대 연결
  minPoolSize: 10,            // 최소 유지 연결
  maxIdleTimeMS: 30000,       // 30초 유휴 시 초과분 해제
  waitQueueTimeoutMS: 10000,  // 연결 대기 타임아웃
});
```

**연결 계산:**

| 구성 | 연결 수 |
|------|--------|
| API 서버 2~3대 × max 100 | 200~300개 |
| M10 지원 | 1,500개 |
| **여유** | **1,200+** |

**이유:**
- 키오스크는 MongoDB에 직접 연결하지 않음 (HTTP 요청만)
- API 서버가 Connection Pool 관리
- 연결 수 대폭 감소 (1000+ → 200~300)

---

## 5. Read/Write Concern 전략

### 결정: 데이터 중요도별 Concern 분리

| 작업 | Concern | 이유 |
|------|---------|------|
| 매출 INSERT | `writeConcern: "majority"` | 데이터 손실 방지 |
| 정산 조회 | `readConcern: "majority"` | 정확한 집계 필요 |
| 일반 조회 | 기본값 (local) | 성능 우선 |

```javascript
// 매출 저장 (중요)
db.sales.insertOne(doc, { writeConcern: { w: "majority" } })

// 정산 집계 (정확성)
db.sales.aggregate(pipeline, { readConcern: { level: "majority" } })
```

**트레이드오프:**
- `majority`는 약간의 지연 발생
- 매출/정산은 정확성이 중요하므로 수용

---

## 6. Monitoring & Alert 설정

### 배경

운영 중 문제를 조기에 감지하기 위한 모니터링 필요.

### 결정: Atlas 기본 모니터링 활용 (추가 비용 없음)

**Alert 임계치:**

| 항목 | 임계치 | 근거 |
|------|--------|------|
| 연결 수 | 1000 (67%) | 1500 최대 중 여유분 확보 |
| 저장소 | 9GB (90%) | 10GB 중 1GB 여유 |
| CPU | 80% | 일반적 기준 |

**비용:**
- M10 이상에서 기본 모니터링 포함
- 추가 비용 없음

---

## 7. popup.status 관리 방식

### 결정: 관리자 수동 관리

```
SCHEDULED → ACTIVE → ENDED
           (수동)    (수동)
```

- **관리자가 관리페이지에서 직접 상태 변경**
- 자동 스케줄링 없음 (운영 유연성 확보)
- `endedAt`: 상태가 ENDED로 변경될 때 실제 종료 시점 기록

---

## 8. TTL Index 미적용

### 검토

TTL Index는 **문서 자체를 영구 삭제**함.

```javascript
// TTL Index: 5년 후 문서 완전 삭제
db.sales.createIndex({ createdAt: 1 }, { expireAfterSeconds: 157680000 })
```

### 결정: TTL 미적용, 별도 아카이빙

**이유:**
- 법적 요구사항 변경 가능성
- 삭제 전 아카이브 필요
- Bulk 작업으로 효율적 처리 가능

**TODO:**
- 아카이빙 스크립트 별도 개발
- S3/GCS Cold Storage 검토

---

## 9. 기기 수 기준 변경

### 변경

| v4 | v5 |
|----|----|
| 729대 | 1000대 |

**이유:**
- 향후 확장성 고려
- Connection Pool, Alert 임계치 등 1000대 기준으로 설계

---

## 10. 변경 사항 요약

### 스키마 변경

| 컬렉션 | 필드 | v4 | v5 | 이유 |
|--------|------|----|----|------|
| sales | date | 있음 | 제거 | timestamp와 중복 |
| - | Schema Validation | 없음 | 추가 | 데이터 무결성 |

### 인프라 변경

| 항목 | v4 | v5 |
|------|----|----|
| 기기 수 기준 | 729대 | 1000대 |
| Schema Validation | 없음 | 추가 |
| Connection Pool | 미정의 | 정의됨 |
| Read/Write Concern | 미정의 | 정의됨 |
| Monitoring Alert | 미정의 | 정의됨 |

### 인덱스 변경

| 변경 | 내용 |
|------|------|
| 필드명 변경 | `date` → `timestamp` (7개 인덱스) |
| 인덱스 수 | 15개 (변경 없음) |

### 정책 변경

| 정책 | v4 | v5 |
|------|----|----|
| Data Retention | TTL 검토 중 | TTL 미적용, 별도 아카이빙 |
| popup.status | 미명시 | 관리자 수동 관리 |

---

## 11. 비용 영향

| 항목 | v4 | v5 | 변화 |
|------|----|----|------|
| 인덱스 수 | 15개 | 15개 | 변화 없음 |
| 인덱스 저장 | ~3GB | ~3GB | 변화 없음 |
| Monitoring | 미정의 | 기본 | 추가 비용 없음 |
| 월 비용 | ~$77 | ~$77 | 변화 없음 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-10 | v5 의사결정 로그 작성 |
