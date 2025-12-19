# Signature API 문서 인덱스

> PhotoSignature 키오스크 API 서버 문서 모음

---

## 빠른 링크

| 문서 | 용도 |
|------|------|
| [API Reference](./API_REFERENCE.md) | API 엔드포인트 명세 |
| [데이터 수집 설계](./photosignature-data-collection-design.md) | 세션/이벤트/성능/에러 수집 설계 (최신) |
| [구현 TODO](./TODO-data-collection.md) | 데이터 수집 구현 체크리스트 |
| [결제 정보 보관 가이드](./payment-data-retention-guide.md) | 결제 데이터 저장 기준 (PCI-DSS) |

---

## 문서 구조

```
docs/
├── INDEX.md                              ← 현재 문서
├── API_REFERENCE.md                      ← API 엔드포인트 명세
│
├── [데이터 수집 설계]
│   ├── photosignature-data-collection-design.md  ← 최종 설계 (프론트팀 전달용)
│   ├── TODO-data-collection.md                   ← 구현 체크리스트
│   ├── required_metrics.md                       ← 요구사항 정의
│   ├── photosignature-metrics-design.md          ← 초안 1
│   └── photosignature-metrics-design_1.md        ← 초안 2
│
├── [결제/보안]
│   └── payment-data-retention-guide.md           ← 결제 데이터 보관 기준
│
├── db-architecture/                      ← 데이터베이스 설계
│   ├── INDEX.md
│   ├── DB_OVERVIEW.md
│   ├── MONGODB_SCHEMA.md
│   ├── MONGODB_OPERATIONS.md
│   ├── QUERY_GUIDE.md
│   ├── FIREBASE_RTDB.md
│   └── SECURITY_MIGRATION.md
│
└── deployment/                           ← 배포/인프라
    └── GCP_SETUP.md
```

---

## 문서별 상세

### API

| 문서 | 설명 |
|------|------|
| [API_REFERENCE.md](./API_REFERENCE.md) | REST API 엔드포인트 명세, 요청/응답 스키마 |

### 데이터 수집 설계

| 문서 | 설명 | 상태 |
|------|------|------|
| [photosignature-data-collection-design.md](./photosignature-data-collection-design.md) | 세션/이벤트/성능/에러 수집 최종 설계안. 프론트엔드 구현 가이드 포함 | **최신** |
| [TODO-data-collection.md](./TODO-data-collection.md) | 데이터 수집 구현 체크리스트 (Phase 1~4) | **최신** |
| [required_metrics.md](./required_metrics.md) | 비즈니스 요구사항 정의, 수집해야 할 지표 목록 | 참고용 |
| [photosignature-metrics-design.md](./photosignature-metrics-design.md) | MongoDB 스키마 설계 초안 (kiosks 중심) | 참고용 |
| [photosignature-metrics-design_1.md](./photosignature-metrics-design_1.md) | 지표 설계 초안 (sessions/events/sales 중심) | 참고용 |

### 결제/보안

| 문서 | 설명 |
|------|------|
| [payment-data-retention-guide.md](./payment-data-retention-guide.md) | 결제 데이터 저장 기준, PCI-DSS 준수, 스키마 개선 제안 |

### 데이터베이스 아키텍처

| 문서 | 설명 |
|------|------|
| [db-architecture/INDEX.md](./db-architecture/INDEX.md) | DB 문서 인덱스 |
| [db-architecture/DB_OVERVIEW.md](./db-architecture/DB_OVERVIEW.md) | 전체 아키텍처 개요 |
| [db-architecture/MONGODB_SCHEMA.md](./db-architecture/MONGODB_SCHEMA.md) | MongoDB 컬렉션 스키마 정의 |
| [db-architecture/MONGODB_OPERATIONS.md](./db-architecture/MONGODB_OPERATIONS.md) | 연결 풀, 운영 설정 |
| [db-architecture/QUERY_GUIDE.md](./db-architecture/QUERY_GUIDE.md) | 집계 쿼리 예제 |
| [db-architecture/FIREBASE_RTDB.md](./db-architecture/FIREBASE_RTDB.md) | Firebase Realtime DB 구조 |
| [db-architecture/SECURITY_MIGRATION.md](./db-architecture/SECURITY_MIGRATION.md) | 보안 및 마이그레이션 가이드 |

### 배포/인프라

| 문서 | 설명 |
|------|------|
| [deployment/GCP_SETUP.md](./deployment/GCP_SETUP.md) | GCP Cloud Run, API Gateway 설정 |

---

## 읽는 순서 가이드

### 새로 합류한 개발자
1. [DB_OVERVIEW.md](./db-architecture/DB_OVERVIEW.md) - 전체 아키텍처 이해
2. [MONGODB_SCHEMA.md](./db-architecture/MONGODB_SCHEMA.md) - 현재 스키마 확인
3. [API_REFERENCE.md](./API_REFERENCE.md) - API 명세 확인

### 데이터 수집 구현 담당자
1. [photosignature-data-collection-design.md](./photosignature-data-collection-design.md) - 설계 이해
2. [TODO-data-collection.md](./TODO-data-collection.md) - 구현 체크리스트
3. [required_metrics.md](./required_metrics.md) - 요구사항 참고

### 배포 담당자
1. [GCP_SETUP.md](./deployment/GCP_SETUP.md) - 인프라 설정
2. [MONGODB_OPERATIONS.md](./db-architecture/MONGODB_OPERATIONS.md) - DB 운영

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-01-19 | 결제 정보 보관 가이드 추가 |
| 2025-01-19 | INDEX.md 생성, 데이터 수집 설계 문서 추가 |
