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

### Architecture
```
Kiosks (1000+) → API Server (connection pool) → MongoDB Atlas
                      ↓
              Firebase RTDB (real-time status)
```

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
See `docs/db-architecture/INDEX.md` for complete database specifications.
