# PhotoSignature Database Documentation Index

> **Version:** 8.0
> **Last Updated:** 2025-12-10

This directory contains the complete database specification for the PhotoSignature kiosk management system. Use this index to find the relevant document for your task.

---

## Document Reference Guide

### When to Read Each Document

| Task | Document to Read |
|------|------------------|
| Understanding system architecture | [DB_OVERVIEW.md](./DB_OVERVIEW.md) |
| Defining collection fields/types | [MONGODB_SCHEMA.md](./MONGODB_SCHEMA.md) |
| Creating/modifying indexes | [MONGODB_SCHEMA.md](./MONGODB_SCHEMA.md) |
| Setting up MongoDB connection | [MONGODB_OPERATIONS.md](./MONGODB_OPERATIONS.md) |
| Configuring monitoring/alerts | [MONGODB_OPERATIONS.md](./MONGODB_OPERATIONS.md) |
| Writing aggregation queries | [QUERY_GUIDE.md](./QUERY_GUIDE.md) |
| Settlement/refund calculations | [QUERY_GUIDE.md](./QUERY_GUIDE.md) |
| Firebase RTDB structure | [FIREBASE_RTDB.md](./FIREBASE_RTDB.md) |
| Exchange rate handling | [FIREBASE_RTDB.md](./FIREBASE_RTDB.md) |
| Security/PCI compliance | [SECURITY_MIGRATION.md](./SECURITY_MIGRATION.md) |
| Legacy migration mapping | [SECURITY_MIGRATION.md](./SECURITY_MIGRATION.md) |
| Version changelog | [SECURITY_MIGRATION.md](./SECURITY_MIGRATION.md) |

---

## Document Summaries

### 1. [DB_OVERVIEW.md](./DB_OVERVIEW.md)
**Purpose:** System architecture and high-level design decisions

**Key Contents:**
- Architecture diagram (Kiosk → API Server → MongoDB)
- 3-database strategy (MongoDB, Firebase RTDB, Firestore)
- Connection flow (1000 kiosks via API server pool)
- Cost estimation (~$77/month)

**Read when:** Starting a new feature, onboarding, understanding system design

---

### 2. [MONGODB_SCHEMA.md](./MONGODB_SCHEMA.md)
**Purpose:** Complete MongoDB collection definitions

**Key Contents:**
- Schema validation rules (JSON Schema)
- Collection structures:
  - `sales` - Transaction records (core)
  - `stores` - Store information
  - `devices` - Device static info
  - `popups` - Popup/event management
  - `exchangeRates` - Exchange rate audit
  - `config` - System configuration
- Index definitions (8 total indexes)
- Decimal128 usage for financial precision

**Read when:** CRUD operations, data modeling, API development

---

### 3. [MONGODB_OPERATIONS.md](./MONGODB_OPERATIONS.md)
**Purpose:** MongoDB operational configuration and maintenance

**Key Contents:**
- Connection pool settings (min 10, max 100 per server)
- Read/Write concern strategy
- Replica set requirements for transactions
- Atlas monitoring and alert thresholds
- Data retention policy (5 years for sales)
- stores → devices sync mechanism

**Read when:** DevOps tasks, performance tuning, data sync implementation

---

### 4. [QUERY_GUIDE.md](./QUERY_GUIDE.md)
**Purpose:** Common aggregation queries for business operations

**Key Contents:**
- Monthly sales by store/group
- Settlement reports (domestic/overseas)
- Active popup sales queries
- Refund settlement calculations
- Character sales ranking

**Read when:** Building reports, settlement features, analytics dashboards

---

### 5. [FIREBASE_RTDB.md](./FIREBASE_RTDB.md)
**Purpose:** Firebase Realtime Database structure and exchange rate handling

**Key Contents:**
- Device real-time status structure (online, paper, sales)
- Exchange rate cache structure
- Rate flow diagram (Server → Firebase → Kiosks)
- Offline policy (3-day cache validity)
- API fallback flow for expired cache
- rateSource values: FIREBASE | CACHED | API_FALLBACK

**Read when:** Real-time features, exchange rate implementation, offline handling

---

### 6. [SECURITY_MIGRATION.md](./SECURITY_MIGRATION.md)
**Purpose:** Security guidelines, migration notes, and version history

**Key Contents:**
- PCI DSS compliance (no card data storage)
- Payment data handling (PG receipt only)
- Legacy SQL Server → MongoDB mapping
- Breaking changes from v7 to v8
- Complete changelog (v1.0 ~ v8.0)

**Read when:** Security review, legacy migration, version upgrade

---

## Quick Reference

### Collections Overview

| Collection | Purpose | Primary Index |
|------------|---------|---------------|
| `sales` | All transactions | `timestamp + store.id` |
| `stores` | Store master data | `_id` (string) |
| `devices` | Device static info | `store.id` |
| `popups` | Events/characters | `status` |
| `exchangeRates` | Rate audit trail | `_id` (date string) |
| `config` | System settings | `_id` |

### Status Enums

| Field | Values |
|-------|--------|
| `sales.status` | COMPLETED, FAILED, REFUNDED |
| `popups.status` | SCHEDULED, ACTIVE, ENDED |
| `payment.type` | CASH, CARD |
| `product.type` | PHOTO, BEAUTY, AI, FORTUNE |
| `group.grade` | MASTER, HIGH, MID, LOW |

### Currency Support

| Code | Country | Decimal Places |
|------|---------|----------------|
| KRW | Korea | 0 |
| JPY | Japan | 0 |
| USD | USA | 2 |
| VND | Vietnam | 0 |
