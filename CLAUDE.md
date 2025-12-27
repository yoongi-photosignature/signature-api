## Git Branch Guidelines
Git Flow variant strategy:

```
main (production - stable releases only)
  └── dev (development integration)
        ├── feat/*     - New features
        ├── fix/*      - Bug fixes
        ├── refactor/* - Code refactoring
        ├── docs/*     - Documentation
        └── chore/*    - Miscellaneous (config, dependencies, etc.)
```

### Sync with Remote
`main` and `dev` must always be synced with `origin/main` and `origin/dev`.

**Before creating a branch:**
```bash
git checkout dev && git pull origin dev
git checkout -b feat/<name>
```

**Before merging to dev (Squash Merge):**
```bash
# 1. Sync dev with remote
git checkout dev && git pull origin dev

# 2. Rebase feature branch onto latest dev
git checkout feat/<name>
git rebase dev

# 3. Squash merge feature into dev
git checkout dev
git merge --squash feat/<name>
git commit
# Commit message format: see "Squash Commit Message Guide" below

# 4. Push to remote
git push origin dev
```

**Merging dev to main (Release):**
```bash
# 1. Sync main with remote
git checkout main && git pull origin main

# 2. Squash merge dev into main
git merge --squash dev
git commit -m "release: vX.X.X - 주요 변경사항 요약"

# 3. Tag and push
git tag vX.X.X
git push origin main --tags
```

### Squash Commit Message Guide
When running `git merge --squash`, Git collects all commit messages in `.git/SQUASH_MSG`.
Use this to write a meaningful summary commit:

**Format:**
```
<type>: <description> (<branch-name>)

변경 내용:
- <summary of commit 1>
- <summary of commit 2>
- ...
```

**Example (feat/camera branch with 5 commits):**
```
feat: 카메라 기능 추가 (feat/camera)

변경 내용:
- EDSDK 연결 및 초기화 구현
- 촬영 API 엔드포인트 추가
- 라이브뷰 스트리밍 지원
- 카메라 설정 저장/불러오기
- Mock 카메라 구현
```

### Workflow
1. Sync dev and create feature branch
2. Complete work on feature branch
3. Sync, rebase, and **squash merge** back to `dev`
4. When `dev` is stable, **squash merge** to `main` with version tag

---

# Signature API - Project Guide

## Project Overview
A REST API server that acts as a middleware layer between PhotoSignature kiosks and MongoDB Atlas. This service manages connection pooling for ~1000 kiosks, handles CRUD operations for sales transactions, stores, devices, popups, and exchange rates.


### How It Works (Big Picture)

```
┌───────────────────────────────────┐      ┌────────────────────────────────────────┐
│            Kiosk PC               │      │         Kiosk Web Application          │
│     THIS PROJECT ↓                │      │  https://photosignature-kiosk.web.app  │
│  ┌─────────────────────────────┐  │      │            (Firebase Hosting)          │
│  │ ★ Signature Launcher        │  │      │                  (UI)                  │
│  │  ┌───────────┐ ┌──────────┐ │  │      │                                        │
│  │  │ Electron  │ │ FastAPI  │ │  │      │                                        │
│  │  │ (Wrapper) │ │ Backend  │ │◀─┼──────┼──────────────── REST API ──────────────│
│  │  └───────────┘ │(Hardware)│ │  │      │                                        │
│  │       │        └──────────┘ │  │      └────────────────────────────────────────┘
│  │       │ opens chrome --kiosk│  │                          │
│  │       └─────────────────────┼──┼──────────────────────────┘
│  └─────────────────────────────┘  │
└───────────────────────────────────┘
                 │
                 │ HTTPS
                 ▼
   ┌─────────────────────────┐
   │    GCP API Gateway      │
   └─────────────────────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │     Signature API       │
   │    (GCP Cloud Run)      │
   └─────────────────────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │        MongoDB          │
   └─────────────────────────┘
```

### Terminology

| Term | Description |
|------|-------------|
| **Signature Launcher** | Kiosk launcher application. Electron app wrapping FastAPI backend for hardware control. Opens Kiosk Web Application in `chrome --kiosk` mode. Communicates with Signature API server. |
| **Kiosk Web Application** | https://photosignature-kiosk.web.app (Firebase Hosting). UI layer of the kiosk. Sends hardware API requests to Signature Launcher. |
| **Kiosk** | Combined system of "Signature Launcher + Kiosk Web Application". Handles photo capture, printing, and payment. Launcher controls hardware; Kiosk Web Application provides user-facing UI. |
| **Signature API** | Backend API server connected to MongoDB. Runs on GCP Cloud Run behind GCP API Gateway. Receives requests from Signature Launcher for recording payments, metrics, etc. |

### Data Flow

1. User interacts with **Kiosk Web Application** (UI)
2. Kiosk Web Application sends hardware requests to **Signature Launcher** (localhost API)
3. Signature Launcher controls hardware (camera, printer, payment terminal)
4. Signature Launcher sends data to **Signature API** (via GCP API Gateway)
5. Signature API persists data to **MongoDB**


### Architecture
```
Kiosks (1000+) → GCP API Gateway (x-api-key 인증) → Cloud Run → MongoDB Atlas
                                                        ↓
                                                Firebase RTDB (real-time status)
```

### Security Layer
- **인증**: GCP API Gateway에서 `x-api-key` 헤더로 처리
- **Rate Limiting**: API Gateway 레벨에서 설정 가능
- **HTTPS**: API Gateway에서 TLS 종료

### Core Responsibilities
- **Connection Management**: Pooled MongoDB connections (min 10, max 100 per server)
- **Sales Transactions**: Record and query sales data with Decimal128 precision
- **Settlement Reports**: Aggregation queries for domestic/overseas settlements
- **Store/Device Sync**: Maintain consistency between stores and devices collections
- **Exchange Rate Handling**: Cache and serve exchange rates with fallback strategy

### Collections Managed
| Collection | Purpose |
|------------|---------|
| `sales` | Transaction records (5-year retention) |
| `stores` | Store master data |
| `devices` | Device static information |
| `popups` | Event/character management |
| `exchangeRates` | Rate audit trail |
| `config` | System configuration |

### Documentation
- **Start here**: `docs/INDEX.md` - 전체 문서 인덱스
- **DB specs**: `docs/db-architecture/INDEX.md` - 데이터베이스 명세
- **Data collection**: `docs/photosignature-data-collection-design.md` - 데이터 수집 설계

**Rules:**
- 작업 시 관련 문서가 필요하면 `docs/INDEX.md`를 먼저 읽고 필요한 문서 참고
- 새 문서 작성 시 반드시 `docs/INDEX.md` 업데이트

---

## Git Workflow Rules
- 새 작업 요청 시 반드시 새 브랜치에서 작업 시작 (main에서 직접 작업 금지)
- 브랜치 생성: `git checkout dev && git pull origin dev && git checkout -b feat/<작업명>`

---

## Agent Usage Rules

### 필수 호출 규칙
1. **security-threat-auditor**: 새 API 엔드포인트 구현 완료 후 자동 실행
2. **test-coverage-generator**: 새 기능 구현 완료 후 자동으로 테스트 코드 작성
3. **todo-tracker**: 3개 이상의 작업 진행 시 사용

### 호출 시점
- 코드 구현 완료 → security-threat-auditor → test-coverage-generator 순서로 실행
- 사용자가 명시적으로 "테스트 안 해도 돼" 라고 하지 않는 한 테스트 작성
- 보안 점검 없이 커밋하지 않음
