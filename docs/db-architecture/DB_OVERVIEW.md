# PhotoSignature Database Overview

> **Created:** 2025-12-10
> **Project:** PhotoSignature New System
> **Version:** 8.0

## Overview

Photo kiosk management system database schema designed for MongoDB.
- **1000 devices** (scalable)
- **Write-heavy** workload (sales transactions)
- **Read: monthly settlement** and analytics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    1000 Kiosk Devices                       │
│                (No direct MongoDB connection)               │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
┌───────────────────┐ ┌─────────────┐ ┌─────────────────────────┐
│ Firebase RTDB     │ │ API Server  │ │ Firestore               │
│ (Real-time)       │ │  (2~3 ea)   │ │ (Design Assets)         │
├───────────────────┤ ├──────┬──────┤ ├─────────────────────────┤
│ • Online status   │ │      │      │ │ • Frame designs         │
│ • Paper quantity  │ │      ▼      │ │ • Background images     │
│ • Today's sales   │ │ ┌─────────┐ │ │ • Designer management   │
│ • Exchange rates  │ │ │MongoDB  │ │ │                         │
│   (cached)        │ │ │ (Main)  │ │ │ ※ Use deletedAt for     │
│                   │ │ ├─────────┤ │ │   soft delete (frames)  │
│                   │ │ │• Sales  │ │ │                         │
│                   │ │ │• Stores │ │ │                         │
│                   │ │ │• Popups │ │ │                         │
│                   │ │ │• Devices│ │ │                         │
│                   │ │ └─────────┘ │ │                         │
└───────────────────┘ └─────────────┘ └─────────────────────────┘
     Blaze Plan           $57/mo           Already in use
     (~$5-20/mo)       (M10 Dedicated)
```

**Kiosk → MongoDB Connection Flow:**
```
┌──────────┐     HTTP      ┌──────────────┐   Connection   ┌──────────┐
│ Kiosk 1  │──────────────▶│              │     Pool       │          │
│ Kiosk 2  │──────────────▶│  API Server  │◀─────────────▶ │ MongoDB  │
│   ...    │──────────────▶│  (2~3 ea)    │  (200~300)     │   M10    │
│ Kiosk N  │──────────────▶│              │                │          │
└──────────┘               └──────────────┘                └──────────┘
   1000 ea                  Pool per server:               Max 1,500
 (no direct conn)           min 10, max 100               connections
```

## Why 3 Databases?

| DB | Role | Reason |
|----|------|--------|
| MongoDB | Sales, settlement, aggregation | Aggregation Pipeline, flexible schema |
| Firebase RTDB | Real-time status | WebSocket-based, frontend subscription |
| Firestore | Design assets | Already in use, designer page integration |

### Firestore Frame Management

Firestore frame documents use **soft delete** approach:
- When deleted, add `deletedAt` field (no actual deletion)
- Prevents orphan references in MongoDB's `product.frameId`
- Filter with `deletedAt == null` condition when querying

---

## Cost Estimation

| Item | Specification | Monthly Cost |
|------|--------------|--------------|
| MongoDB Atlas M10 | 10GB, 1500 connections | $57 |
| Firebase RTDB (Blaze) | 1000 devices, ~1GB | $5~20 |
| Firestore | Already in use | - |
| Atlas Monitoring | Basic (included) | $0 |
| **Total** | | **~$77/month** |

---

## Related Documents

- [MONGODB_SCHEMA.md](./MONGODB_SCHEMA.md) - Collection schemas and indexes
- [MONGODB_OPERATIONS.md](./MONGODB_OPERATIONS.md) - Connection, monitoring, retention
- [QUERY_GUIDE.md](./QUERY_GUIDE.md) - Common queries and data sync
- [FIREBASE_RTDB.md](./FIREBASE_RTDB.md) - Firebase structure and exchange rates
- [SECURITY_MIGRATION.md](./SECURITY_MIGRATION.md) - Security and migration notes
