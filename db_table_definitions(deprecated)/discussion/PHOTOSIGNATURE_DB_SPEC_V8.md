# PhotoSignature MongoDB Schema v8

> **Created:** 2025-12-10
> **Project:** PhotoSignature New System
> **Version:** 8.0 (v7 Review Applied)

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

### Why 3 Databases?

| DB | Role | Reason |
|----|------|--------|
| MongoDB | Sales, settlement, aggregation | Aggregation Pipeline, flexible schema |
| Firebase RTDB | Real-time status | WebSocket-based, frontend subscription |
| Firestore | Design assets | Already in use, designer page integration |

### Firestore Frame Management

Firestore의 frame 문서는 **soft delete** 방식 사용:
- 삭제 시 `deletedAt` 필드 추가 (실제 삭제 X)
- MongoDB의 `product.frameId`가 orphan 참조가 되는 것 방지
- 조회 시 `deletedAt == null` 조건으로 필터링

---

## Connection & Consistency Strategy

### Connection Pool (API Server → MongoDB)

Kiosks do not connect directly to MongoDB. They access it through API servers.

```javascript
// API Server MongoDB connection settings
const client = new MongoClient(uri, {
  maxPoolSize: 100,           // Max connections per server
  minPoolSize: 10,            // Min connections to maintain
  maxIdleTimeMS: 30000,       // Release idle connections after 30s
  waitQueueTimeoutMS: 10000,  // Connection wait timeout
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
});
```

**Connection Structure:**

| Component | Count | MongoDB Connections |
|-----------|-------|---------------------|
| Kiosks | 1000 ea | No direct connection (HTTP only) |
| API Servers | 2~3 ea | min 10, max 100 per server |
| **Total** | | **200~300** |
| M10 Limit | | 1,500 (sufficient headroom) |

**Why route through API Server?**
- Direct kiosk connection: 1000+ connections needed
- Via API server: 3 servers × 100 = max 300 connections
- Efficient connection pool reuse

### Read/Write Concern

```javascript
// Sales data write (critical data)
db.sales.insertOne(doc, { writeConcern: { w: "majority" } })

// Settlement data read (accuracy required)
db.sales.aggregate(pipeline, { readConcern: { level: "majority" } })

// General queries (use default)
db.sales.find(query)  // readConcern: "local" (default)
```

| Operation | Concern | Reason |
|-----------|---------|--------|
| Sales INSERT | `writeConcern: "majority"` | Prevent data loss |
| Settlement queries | `readConcern: "majority"` | Accurate aggregation required |
| General queries | Default (local) | Performance priority |

### Replica Set Requirement (v8)

MongoDB transactions (`session.withTransaction()`) require a **Replica Set** configuration.

**MongoDB Atlas M10:**
- Atlas M10+ clusters are **automatically configured as Replica Sets**
- No additional setup required for transactions
- 3-node replica set (1 primary + 2 secondaries) is the default

**Verification:**
```javascript
// Check replica set status in MongoDB shell
rs.status()

// Or via Atlas UI:
// Clusters → Your Cluster → Overview → "Replica Set" badge visible
```

**Why Replica Set for Transactions?**
- Transactions require write operations to be replicated to multiple nodes
- `writeConcern: "majority"` needs at least 2 nodes acknowledging the write
- Single-node deployments (Standalone) do not support multi-document transactions

**Note:** If using self-hosted MongoDB, ensure replica set is initialized before using transactions in Data Sync Strategy.

---

## Schema Validation

### sales Collection

```javascript
db.createCollection("sales", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["timestamp", "store", "device", "country", "amount", "currency", "amountKRW", "payment", "status", "product"],
      properties: {
        timestamp: { bsonType: "date" },
        store: {
          bsonType: "object",
          required: ["id", "name"],
          properties: {
            id: { bsonType: "string" },
            name: { bsonType: "string" },
            groupId: { bsonType: "string" },
            groupName: { bsonType: "string" }
          }
        },
        amount: { bsonType: "decimal", minimum: 0 },
        currency: { enum: ["KRW", "JPY", "USD", "VND"] },
        amountKRW: { bsonType: "decimal", minimum: 0 },
        status: { enum: ["COMPLETED", "FAILED", "REFUNDED"] },
        payment: {
          bsonType: "object",
          required: ["type"],
          properties: {
            type: { enum: ["CASH", "CARD"] }
          }
        },
        product: {
          bsonType: "object",
          required: ["type", "frameCategory"],
          properties: {
            type: { enum: ["PHOTO", "BEAUTY", "AI", "FORTUNE"] },
            frameCategory: { enum: ["3CUT", "4CUT", "6CUT", "8CUT"] }
          }
        },
        // v7: All monetary fields use Decimal128
        discount: {
          bsonType: "object",
          properties: {
            roulette: { bsonType: "decimal", minimum: 0 },
            coupon: { bsonType: "decimal", minimum: 0 }
          }
        }
      }
    }
  },
  validationLevel: "moderate",  // Existing docs validated only on update
  validationAction: "error"     // Reject on validation failure
})
```

### stores Collection

```javascript
db.createCollection("stores", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "name", "group", "country", "settlement"],
      properties: {
        _id: { bsonType: "string" },
        name: { bsonType: "string" },
        group: {
          bsonType: "object",
          required: ["id", "name", "grade"],
          properties: {
            grade: { enum: ["MASTER", "HIGH", "MID", "LOW"] }
          }
        },
        settlement: {
          bsonType: "object",
          required: ["serverFeeRate"],
          properties: {
            serverFeeRate: { bsonType: "number", minimum: 0, maximum: 1 }
          }
        }
      }
    }
  }
})
```

### popups Collection

```javascript
db.createCollection("popups", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "name", "status", "period", "countries", "revenueConfig"],
      properties: {
        status: { enum: ["SCHEDULED", "ACTIVE", "ENDED"] },
        countries: {
          bsonType: "array",
          minItems: 1,
          description: "Must contain at least one country code or 'ALL'"
        },
        revenueConfig: {
          bsonType: "object",
          required: ["storeRate", "corpRate", "licenseRate"],
          properties: {
            storeRate: { bsonType: "number", minimum: 0, maximum: 1 },
            corpRate: { bsonType: "number", minimum: 0, maximum: 1 },
            licenseRate: { bsonType: "number", minimum: 0, maximum: 1 }
          }
        }
      }
    }
  }
})
```

**Note:** `revenueConfig` rate 합계(storeRate + corpRate + licenseRate = 1.0) 검증은 애플리케이션 레벨에서 수행.

---

## Collections

### 1. `sales` - Sales Transactions (Core)

The main collection for all sales data. Exchange rate is calculated by kiosk at transaction time.

```javascript
{
  _id: ObjectId,

  // v5: timestamp only (date field removed)
  timestamp: ISODate("2025-01-15T14:30:00Z"),

  // Store (embedded for fast queries without joins)
  store: {
    id: "STORE_001",
    name: "Gangnam Store",
    groupId: "GROUP_GANGNAM",
    groupName: "Gangnam Branch"
  },

  // Device
  device: {
    id: "KIOSK_001",
    name: "Gangnam_Unit1"
  },

  // Country (for filtering, currency removed - use sales.currency instead)
  country: {
    code: "JPN",                            // Country code (for filtering)
    name: "Japan"
  },

  // Amount (calculated by kiosk at transaction time)
  // v7: All monetary fields use Decimal128
  amount: NumberDecimal("500"),             // Original amount (local currency)
  currency: "JPY",                          // Currency code
  exchangeRate: NumberDecimal("9.12"),      // Rate at transaction time
  amountKRW: NumberDecimal("4560"),         // Converted to KRW
  rateDate: ISODate("2025-01-15"),          // Rate date
  rateSource: "FIREBASE",                   // "FIREBASE" | "CACHED" (for audit)

  // Payment
  payment: {
    type: "CARD",                           // "CASH" | "CARD"
    receiptNo: "R20250115001",              // PG receipt number only
    pgProvider: "NICE"                      // PG provider name
  },

  // Transaction Status
  // v7: CANCELLED → FAILED (payment failure), REFUNDED (refund after payment)
  status: "COMPLETED",                      // "COMPLETED" | "FAILED" | "REFUNDED"
  failedAt: null,                           // Failure timestamp (for FAILED)
  failReason: null,                         // Failure reason (for FAILED)
  refundedAt: null,                         // Refund timestamp (for REFUNDED)
  refundReason: null,                       // Refund reason (for REFUNDED)
  refundedBy: null,                         // Who processed refund (email or system)

  // v8: Original data snapshot (stored only on refund)
  // Note: FAILED transactions don't need snapshot (payment never completed)
  refundSnapshot: null,                     // { originalAmount, originalAmountKRW, originalStatus }

  // Discounts (v7: All Decimal128)
  discount: {
    roulette: NumberDecimal("1000"),        // Roulette discount amount
    coupon: NumberDecimal("0"),
    couponCode: null
  },

  // Product
  product: {
    type: "PHOTO",                          // "PHOTO" | "BEAUTY" | "AI" | "FORTUNE"
    frameId: "251210_new_frame01",          // Reference to Firestore
    frameCategory: "4CUT",                  // "3CUT" | "4CUT" | "6CUT" etc.
    printCount: 2,
    isAdditionalPrint: false
  },

  // Popup/Character (if applicable)
  // NOTE: No isActive field - check popups.status instead
  popup: {
    id: "POPUP_KAKAO_2025",
    name: "Kakao Friends 2025",
    characterId: "RYAN",
    characterName: "Ryan",

    // Revenue split rates (varies per popup)
    // NOTE: Rate sum validation (storeRate + corpRate + licenseRate = 1.0) done at app level
    // v8: Amount fields removed - calculated at application level when needed
    revenue: {
      storeRate: 0.30,
      corpRate: 0.50,
      licenseRate: 0.20
    }
  },

  // Service usage (v8: ar → ai renamed)
  services: {
    beauty: { used: true, fee: NumberDecimal("500") },
    ai: { used: false, fee: NumberDecimal("0") }
  },

  createdAt: ISODate("2025-01-15T14:30:00Z"),
  updatedAt: ISODate("2025-01-15T14:30:00Z")
}
```

**Refund Snapshot Example:**
```javascript
// When transaction is refunded
{
  status: "REFUNDED",
  refundedAt: ISODate("2025-01-15T15:00:00Z"),
  refundReason: "Customer request",
  refundedBy: "admin@photosignature.com",
  refundSnapshot: {
    originalAmount: NumberDecimal("5000"),
    originalAmountKRW: NumberDecimal("5000"),
    originalStatus: "COMPLETED"              // v8: status before refund (for audit)
  }
}
```

**Failed Transaction Example:**
```javascript
// When payment fails
{
  status: "FAILED",
  failedAt: ISODate("2025-01-15T14:30:05Z"),
  failReason: "Card declined",
  // No snapshot needed - payment was never completed
  refundSnapshot: null
}
```

**Indexes:**
```javascript
// v7: Same as v6 - 4 indexes optimized for write-heavy workload
// Timestamp + Store (most common query)
db.sales.createIndex({ timestamp: 1, "store.id": 1 })

// Timestamp + Country (domestic/overseas filtering)
db.sales.createIndex({ timestamp: 1, "country.code": 1 })

// Timestamp + Country + Popup (popup sales - frequently used)
db.sales.createIndex({ timestamp: 1, "country.code": 1, "popup.id": 1 })

// Group-level reporting
db.sales.createIndex({ "store.groupId": 1, timestamp: 1 })
```

---

### 2. `stores` - Store Information

```javascript
{
  _id: "STORE_001",
  name: "Gangnam Store",

  group: {
    id: "GROUP_GANGNAM",
    name: "Gangnam Branch",
    grade: "MID"                            // MASTER | HIGH | MID | LOW
  },

  country: {
    code: "KOR",
    name: "Korea",
    currency: "KRW"
  },

  owner: {
    phone: "010-1234-5678"
  },

  // Settlement config
  // v5: Each store has its own rate (no isCustomRate flag)
  // Default rates (7% domestic, 4% overseas) are applied at store creation time
  settlement: {
    serverFeeRate: 0.07,                    // Store-specific rate
    vatEnabled: true
  },

  devices: ["KIOSK_001", "KIOSK_002"],      // Device list

  createdAt: ISODate("2024-01-01"),
  updatedAt: ISODate("2025-01-15")
}
```

**Indexes:**
```javascript
db.stores.createIndex({ "country.code": 1 })
```

---

### 3. `devices` - Device Information (Static Only)

Real-time status is managed in Firebase Realtime Database.

```javascript
{
  _id: "KIOSK_001",
  name: "Gangnam_Unit1",
  hddSerial: "ABC123",

  store: {
    id: "STORE_001",
    name: "Gangnam Store"
  },

  // Country info for direct filtering
  // v7: Synced from stores collection (see Data Sync Strategy)
  country: {
    code: "KOR",
    name: "Korea",
    currency: "KRW"
  },

  programType: "SIGNATURE",

  createdAt: ISODate("2024-01-01"),
  updatedAt: ISODate("2025-01-15")
}
```

**Indexes:**
```javascript
db.devices.createIndex({ "store.id": 1 })
```

---

### 4. `popups` - Popup/Character/Event Management

```javascript
{
  _id: "POPUP_KAKAO_2025",
  name: "Kakao Friends New Year Event",

  character: {
    id: "RYAN",
    name: "Ryan",
    code: "KAKAO_RYAN"
  },

  // Status management (source of truth for active/ended)
  // Admin manually controls status via management page
  // v7: All transitions allowed (SCHEDULED↔ACTIVE↔ENDED)
  status: "ACTIVE",                         // "ACTIVE" | "ENDED" | "SCHEDULED"
  period: {
    start: ISODate("2025-01-01"),
    end: ISODate("2025-03-31")              // Planned end (actual end is manual)
  },
  endedAt: null,                            // Actual end timestamp (when status → ENDED)

  // Target regions
  // Use ["ALL"] for all countries instead of empty array
  countries: ["ALL"],                       // ["ALL"] | ["KOR", "JPN", "VNM"]

  // Revenue config (varies per popup)
  // NOTE: Rate sum validation (storeRate + corpRate + licenseRate = 1.0) done at app level
  revenueConfig: {
    storeRate: 0.30,
    corpRate: 0.50,
    licenseRate: 0.20
  },

  // Discount config (varies per event)
  discountConfig: {
    type: "ROULETTE",                       // "ROULETTE" | "COUPON" | "FIXED" | "NONE"
    rouletteRates: [0, 0.1, 0.2, 0.3],
    maxDiscount: NumberDecimal("2000")      // v7: Decimal128
  },

  // Pricing (can vary per popup) - v8: currency added
  pricing: {
    currency: "KRW",                                    // v8: price currency
    "3CUT": { price: NumberDecimal("4000"), printCount: 1 },
    "4CUT": { price: NumberDecimal("5000"), printCount: 2 },
    "6CUT": { price: NumberDecimal("6000"), printCount: 2 }
  },

  createdAt: ISODate("2025-01-01"),
  updatedAt: ISODate("2025-01-15")
}
```

**Status Management:**
- `SCHEDULED`: Upcoming popup (before period.start)
- `ACTIVE`: Currently running popup
- `ENDED`: Ended popup (endedAt records actual end time)
- **Admin manually changes status via management page**
- **All transitions allowed** (including re-opening: ENDED → ACTIVE)

**Indexes:**
```javascript
db.popups.createIndex({ status: 1 })
db.popups.createIndex({ "character.id": 1 })
```

---

### 5. `exchangeRates` - Exchange Rates (Reference/Audit)

Rates are fetched by server and cached to Firebase RTDB. This collection is for audit trail and fallback.

**Purpose:**
1. Audit trail - Track which exchange rate was applied when
2. Fallback - Use when exchange rate API is unavailable (within 3 days)
3. Settlement verification - Reference for dispute resolution

```javascript
{
  _id: "2025-01-15",                         // Date
  baseCurrency: "KRW",
  rates: {
    "KRW": 1,
    "JPY": 9.12,                            // 1 JPY = 9.12 KRW
    "USD": 1450.5,
    "VND": 0.054
  },
  source: "exchangerate-api",               // API provider
  apiEndpoint: "https://api.exchangerate-api.com/v4/latest/KRW",
  fetchedAt: ISODate("2025-01-15T00:00:00Z")
}
```

---

### 6. `config` - System Configuration

```javascript
// Product types
{
  _id: "productTypes",
  values: {
    "PHOTO": "Photo",
    "BEAUTY": "Beauty",
    "AI": "AI",                               // v8: renamed from AR
    "FORTUNE": "Fortune"
  },
  updatedAt: ISODate("2025-01-15T10:00:00Z"),
  updatedBy: "admin@photosignature.com"
}

// Country codes
{
  _id: "countries",
  values: {
    "KOR": { name: "Korea", currency: "KRW" },
    "JPN": { name: "Japan", currency: "JPY" },
    "VNM": { name: "Vietnam", currency: "VND" },
    "USA": { name: "USA", currency: "USD" }
  },
  updatedAt: ISODate("2025-01-15T10:00:00Z"),
  updatedBy: "admin@photosignature.com"
}

// Server fee defaults (used at store creation time)
{
  _id: "serverFees",
  domestic: 0.07,                           // 7% for Korea
  overseas: 0.04,                           // 4% for overseas
  updatedAt: ISODate("2025-01-15T10:00:00Z"),
  updatedBy: "admin@photosignature.com"
}

// Exchange rate API config
{
  _id: "exchangeRateApi",
  provider: "exchangerate-api",
  endpoint: "https://api.exchangerate-api.com/v4/latest/KRW",
  updateFrequency: "daily",
  lastUpdated: ISODate("2025-01-15T00:00:00Z"),
  updatedAt: ISODate("2025-01-15T10:00:00Z"),
  updatedBy: "admin@photosignature.com"
}
```

**Note:** Frame types are managed in Firestore (designer page). MongoDB only stores `frameId` reference.

---

## Data Sync Strategy

### stores → devices Country Sync

`devices.country`는 `stores.country`의 복사본입니다. stores 변경 시 devices도 동기화해야 합니다.

**Sync Trigger (API Server):**

```javascript
// stores 업데이트 시 devices 동기화
async function updateStore(storeId, updateData) {
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      // 1. Update store
      await db.stores.updateOne(
        { _id: storeId },
        { $set: updateData },
        { session }
      );

      // 2. If country changed, sync to devices
      if (updateData.country) {
        await db.devices.updateMany(
          { "store.id": storeId },
          {
            $set: {
              country: updateData.country,
              updatedAt: new Date()
            }
          },
          { session }
        );
      }

      // 3. If store name changed, sync to devices
      if (updateData.name) {
        await db.devices.updateMany(
          { "store.id": storeId },
          {
            $set: {
              "store.name": updateData.name,
              updatedAt: new Date()
            }
          },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
}
```

**Sync Fields:**

| stores Field | devices Field | Sync Required |
|--------------|---------------|---------------|
| `country` | `country` | ✅ Yes |
| `name` | `store.name` | ✅ Yes |
| `_id` | `store.id` | ❌ No (immutable) |

---

## Firebase Realtime Database Structure

```javascript
{
  // Device real-time status
  "devices": {
    "KIOSK_001": {
      "online": true,
      "lastSeen": 1736945400000,
      "paperQty": 150,
      "paperAlert": false,
      "todaySales": {
        "date": "2025-01-15",
        "amount": 150000,
        "count": 30
      }
    }
  },

  // Exchange rates cache
  // Updated daily by server, subscribed by kiosks
  "exchangeRates": {
    "date": "2025-01-15",
    "baseCurrency": "KRW",
    "rates": {
      "KRW": 1,
      "JPY": 9.12,
      "USD": 1450.5,
      "VND": 0.054
    },
    "updatedAt": 1736899200000
  }
}
```

**Exchange Rate Flow:**
```
┌─────────────┐     Daily        ┌─────────────────┐
│   Server    │ ───────────────> │ Firebase RTDB   │
│ (Scheduler) │   Fetch API      │ /exchangeRates  │
└─────────────┘   + Cache        └────────┬────────┘
                                          │
                                   Real-time Subscribe
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              ┌──────────┐          ┌──────────┐          ┌──────────┐
              │ Kiosk 1  │          │ Kiosk 2  │   ...    │ Kiosk N  │
              └──────────┘          └──────────┘          └──────────┘
```

### Offline Exchange Rate Policy

When a kiosk cannot connect to Firebase RTDB:

1. **Local Cache:** Use the last successfully fetched exchange rate
2. **Cache Validity:** Accept cached rate up to **3 days** old (v6: reduced from 7 days)
3. **Fallback:** If cache > 3 days, reject overseas transactions (require network)
4. **Audit:** Store `rateSource: "CACHED"` in sales document when using cached rate

**Why 3 days instead of 7?**
- Minimizes exchange rate fluctuation risk (7 days can mean 5-10% difference during volatility)
- Prevents settlement disputes due to stale rates
- 3+ days offline indicates operational issues requiring attention

```javascript
// Kiosk local storage
{
  "exchangeRates": {
    "rates": { ... },
    "fetchedAt": 1736899200000,
    "source": "FIREBASE"        // "FIREBASE" | "CACHED"
  }
}
```

### Exchange Rate Fallback Flow (v8)

Kiosks do not connect directly to MongoDB. When cache expires, they query exchange rates through API server.

```
┌──────────┐                    ┌──────────────┐                ┌──────────┐
│  Kiosk   │                    │  API Server  │                │ MongoDB  │
└────┬─────┘                    └──────┬───────┘                └────┬─────┘
     │                                 │                              │
     │  1. Check Firebase RTDB         │                              │
     │  ─────────────────────────>     │                              │
     │  (cache > 3 days)               │                              │
     │                                 │                              │
     │  2. GET /api/exchange-rates     │                              │
     │  ─────────────────────────>     │                              │
     │                                 │  3. Query exchangeRates      │
     │                                 │  ─────────────────────────>  │
     │                                 │                              │
     │                                 │  4. Return rates             │
     │                                 │  <─────────────────────────  │
     │  5. Return rates                │                              │
     │  <─────────────────────────     │                              │
     │                                 │                              │
     │  6. Use rate, set rateSource: "API_FALLBACK"                   │
     │                                 │                              │
```

**rateSource Values:**
- `"FIREBASE"`: Real-time rate from Firebase RTDB
- `"CACHED"`: Local cached rate (within 3 days)
- `"API_FALLBACK"`: Rate from MongoDB via API server (when cache expired)

---

## Common Queries

### 1. Monthly Sales by Store

```javascript
db.sales.aggregate([
  { $match: {
    timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    status: "COMPLETED"
  }},
  { $group: {
    _id: "$store.id",
    storeName: { $first: "$store.name" },
    shootCount: { $sum: 1 },
    totalAmount: { $sum: "$amountKRW" },
    cashAmount: {
      $sum: { $cond: [{ $eq: ["$payment.type", "CASH"] }, "$amountKRW", 0] }
    },
    cardAmount: {
      $sum: { $cond: [{ $eq: ["$payment.type", "CARD"] }, "$amountKRW", 0] }
    },
    rouletteDiscount: { $sum: "$discount.roulette" },
    couponDiscount: { $sum: "$discount.coupon" }
  }},
  { $sort: { totalAmount: -1 } }
])
```

### 2. Monthly Sales by Group

```javascript
db.sales.aggregate([
  { $match: {
    timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    status: "COMPLETED"
  }},
  { $group: {
    _id: "$store.groupId",
    groupName: { $first: "$store.groupName" },
    storeCount: { $addToSet: "$store.id" },
    totalAmount: { $sum: "$amountKRW" },
    transactionCount: { $sum: 1 }
  }},
  { $addFields: {
    storeCount: { $size: "$storeCount" }
  }},
  { $sort: { totalAmount: -1 } }
])
```

### 3. Settlement Report (Domestic)

```javascript
db.sales.aggregate([
  { $match: {
    timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    "country.code": "KOR",
    status: "COMPLETED"
  }},
  { $group: {
    _id: "$store.id",
    storeName: { $first: "$store.name" },
    revenue: { $sum: "$amountKRW" },
    popupRevenue: {
      $sum: { $cond: [{ $ne: ["$popup", null] }, "$amountKRW", 0] }
    },
    popupCorpAmount: { $sum: "$popup.revenue.corpAmount" },
    popupStoreAmount: { $sum: "$popup.revenue.storeAmount" },
    beautyFee: { $sum: "$services.beauty.fee" }
  }},
  { $lookup: {
    from: "stores",
    localField: "_id",
    foreignField: "_id",
    as: "storeInfo"
  }},
  { $addFields: {
    serverFeeRate: { $arrayElemAt: ["$storeInfo.settlement.serverFeeRate", 0] }
  }},
  { $addFields: {
    serverFee: { $multiply: ["$revenue", "$serverFeeRate"] }
  }},
  { $project: { storeInfo: 0, serverFeeRate: 0 } }
])
```

### 4. Settlement Report (Overseas)

```javascript
db.sales.aggregate([
  { $match: {
    timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    "country.code": { $ne: "KOR" },
    status: "COMPLETED"
  }},
  { $group: {
    _id: "$store.id",
    storeName: { $first: "$store.name" },
    country: { $first: "$country.code" },
    revenue: { $sum: "$amountKRW" }
  }},
  { $lookup: {
    from: "stores",
    localField: "_id",
    foreignField: "_id",
    as: "storeInfo"
  }},
  { $addFields: {
    serverFeeRate: { $arrayElemAt: ["$storeInfo.settlement.serverFeeRate", 0] }
  }},
  { $addFields: {
    serverFee: { $multiply: ["$revenue", "$serverFeeRate"] }
  }},
  { $project: { storeInfo: 0, serverFeeRate: 0 } }
])
```

### 5. Active Popup Sales (Two-Step Query)

```javascript
// Step 1: Get active popup IDs from popups collection
const activePopups = await db.popups
  .find({ status: "ACTIVE" })
  .project({ _id: 1 })
  .toArray();

const activePopupIds = activePopups.map(p => p._id);

// Step 2: Query sales with $in (uses timestamp + country.code + popup.id index)
db.sales.aggregate([
  { $match: {
    timestamp: { $gte: ISODate("2025-01-01") },
    "country.code": "JPN",                    // Always use with country.code
    "popup.id": { $in: activePopupIds }
  }},
  { $group: {
    _id: "$popup.id",
    popupName: { $first: "$popup.name" },
    totalSales: { $sum: "$amountKRW" },
    count: { $sum: 1 }
  }}
])
```

### 6. Settlement with Refunds

Refund transactions are processed in settlement as follows:
- **Same month refund:** Excluded from that month's revenue
- **Post-closing refund:** Deducted from the month when refund was processed

```javascript
// Monthly settlement considering refunds
db.sales.aggregate([
  { $match: {
    "store.id": "STORE_001",
    $or: [
      // Completed transactions in target month
      {
        timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
        status: "COMPLETED"
      },
      // Refunded transactions in target month (regardless of original payment date)
      {
        refundedAt: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
        status: "REFUNDED"
      }
    ]
  }},
  { $group: {
    _id: "$store.id",
    // Sum of completed transactions
    completedAmount: {
      $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$amountKRW", 0] }
    },
    // Sum of refunded transactions (for deduction)
    refundedAmount: {
      $sum: { $cond: [{ $eq: ["$status", "REFUNDED"] }, "$refundSnapshot.originalAmountKRW", 0] }
    }
  }},
  { $addFields: {
    netAmount: { $subtract: ["$completedAmount", "$refundedAmount"] }
  }}
])
```

**Refund Settlement Policy:**
- Refunds are deducted based on `refundedAt` in that month's settlement
- Even if original payment date (`timestamp`) and refund date (`refundedAt`) are in different months, deduction happens in the refund month
- Uses `refundSnapshot.originalAmountKRW` to deduct the original amount

### 7. Failed/Refunded Transactions

```javascript
db.sales.find({
  timestamp: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
  status: { $in: ["FAILED", "REFUNDED"] }
}).sort({ timestamp: -1 })
```

### 8. Character Sales Ranking

```javascript
db.sales.aggregate([
  { $match: {
    timestamp: { $gte: ISODate("2025-01-01") },
    "popup.characterId": { $ne: null },
    status: "COMPLETED"
  }},
  { $group: {
    _id: "$popup.characterId",
    characterName: { $first: "$popup.characterName" },
    totalSales: { $sum: "$amountKRW" },
    count: { $sum: 1 }
  }},
  { $sort: { totalSales: -1 } },
  { $limit: 10 }
])
```

---

## Security Considerations

### Payment Data

```javascript
// NEVER store
cardNo: "1234-5678-9012-3456"

// Store only PG receipt
payment: {
  type: "CARD",
  receiptNo: "R20250115001",    // PG receipt only
  pgProvider: "NICE"
}
```

### PCI DSS Compliance

| Item | Implementation |
|------|----------------|
| Card number | Not stored (delegated to PG) |
| Sensitive data | Encrypted in transit (TLS) |
| Access control | MongoDB Atlas role-based access |
| Audit logs | Atlas Activity Feed |

---

## Monitoring & Alerts

### Atlas Basic Monitoring (No additional cost)

Utilizing built-in monitoring features available for M10+ clusters.

**Alert Configuration:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| Connections | 1000 connections | Warning |
| Storage usage | 9GB (90%) | Warning |
| CPU utilization | 80% | Warning |
| Query Targeting | 1000 scanned/returned ratio | Warning |

```javascript
// Alert configuration via Atlas UI or API
{
  "alertType": "CONNECTIONS_PERCENT",
  "threshold": 67,  // 1000/1500 = 67%
  "notifications": [{ "type": "EMAIL", "address": "admin@photosignature.com" }]
}
```

---

## Precision Note

### Decimal128 for Financial Data

All monetary fields use MongoDB `Decimal128` type for precise financial calculations.

**Why Decimal128?**
- JavaScript `Number` uses IEEE 754 floating point → precision errors
- `0.1 + 0.2 = 0.30000000000000004` in JavaScript
- Decimal128 provides 128-bit decimal precision → no floating point errors

**Decimal128 Fields (v8: Updated list):**

| Collection | Field | Description |
|------------|-------|-------------|
| sales | `amount` | Original amount in local currency |
| sales | `amountKRW` | Converted KRW amount |
| sales | `exchangeRate` | Exchange rate at transaction time |
| sales | `discount.roulette` | Roulette discount amount |
| sales | `discount.coupon` | Coupon discount amount |
| sales | `refundSnapshot.originalAmount` | Original amount before refund |
| sales | `refundSnapshot.originalAmountKRW` | Original KRW amount before refund |
| sales | `services.beauty.fee` | Beauty service fee |
| sales | `services.ai.fee` | AI service fee (v8: renamed from ar) |
| popups | `discountConfig.maxDiscount` | Maximum discount amount |
| popups | `pricing.*.price` | Frame prices |

**v8 Changes:**
- Removed `popup.revenue.storeAmount`, `corpAmount`, `licenseAmount` (calculated at app level)
- Renamed `services.ar.fee` → `services.ai.fee`

**Application Handling:**

```javascript
// 1. Saving: Convert to Decimal128
const { Decimal128 } = require('mongodb');
await db.sales.insertOne({
  amount: Decimal128.fromString("12.99"),
  amountKRW: Decimal128.fromString("18839.30"),
  exchangeRate: Decimal128.fromString("1450.50"),
  discount: {
    roulette: Decimal128.fromString("1000"),
    coupon: Decimal128.fromString("0")
  }
});

// 2. Reading: Convert to Number for display
const sale = await db.sales.findOne(...);
const displayAmount = Number(sale.amountKRW.toString());

// 3. Aggregation: MongoDB maintains Decimal128 precision
db.sales.aggregate([
  { $group: { _id: null, total: { $sum: "$amountKRW" } } }
]);
// → total is also Decimal128, precision maintained

// 4. Display formatting
displayAmount.toFixed(2)  // "18839.30"
```

**Currency Decimal Places:**

| Currency | Decimal Places | Example |
|----------|----------------|---------|
| KRW | 0 | 5000 |
| JPY | 0 | 500 |
| USD | 2 | 12.99 |
| VND | 0 | 50000 |

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

## Index Summary

### sales Collection (4 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ timestamp: 1, "store.id": 1 }` | Daily sales by store | Compound |
| `{ timestamp: 1, "country.code": 1 }` | Domestic/overseas filter | Compound |
| `{ timestamp: 1, "country.code": 1, "popup.id": 1 }` | Popup sales | Compound |
| `{ "store.groupId": 1, timestamp: 1 }` | Group-level reporting | Compound |

### stores Collection (1 index)

| Index | Purpose | Type |
|-------|---------|------|
| `{ "country.code": 1 }` | Stores by country | Single |

### devices Collection (1 index)

| Index | Purpose | Type |
|-------|---------|------|
| `{ "store.id": 1 }` | Devices by store | Single |

### popups Collection (2 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ status: 1 }` | Active popup filter | Single |
| `{ "character.id": 1 }` | Character lookup | Single |

### Total Index Count: 8 (optimized for write-heavy workload)

| Collection | Index Count |
|------------|-------------|
| sales | 4 |
| stores | 1 |
| devices | 1 |
| popups | 2 |
| **Total** | **8** |

### Index Storage Estimate

| Index Count | Additional Storage |
|------------|-------------------|
| 8 indexes total | ~1.6GB |
| M10 capacity | 10GB |
| **Available** | **~8.4GB for data** |

---

## Data Retention Policy

> **Note:** TTL Index not applied. Separate archiving process planned.

| Data | Retention Period | Method |
|------|-----------------|--------|
| Sales (sales) | 5 years | Separate archiving then delete |
| Device logs | 1 year | Separate archiving then delete |
| Exchange rates | 3 years | Quarterly cleanup |

**Future Considerations:**
- Archiving script for 5+ year old data
- Cold storage selection (S3/GCS)
- Query access for archived data

---

## Migration Notes

### From Legacy (SQL Server)

| Legacy Table | MongoDB Collection | Notes |
|-------------|-------------------|-------|
| TB_MST001 | devices, stores | Split |
| TB_CAD001 | sales.payment | Embedded |
| TB_HIS003 | sales | Extended |
| TB_MST006 | popups | Restructured |
| TB_MST007 | exchangeRates | Changed to currency code |

### Breaking Changes from v7

| v7 | v8 | Reason |
|----|----|--------|
| `refundSnapshot: { originalAmount, originalAmountKRW }` | `refundSnapshot: { originalAmount, originalAmountKRW, originalStatus }` | Added originalStatus for audit |
| `popup.revenue: { storeRate, corpRate, licenseRate, storeAmount, corpAmount, licenseAmount }` | `popup.revenue: { storeRate, corpRate, licenseRate }` | Amount fields removed (app calculates) |
| `services.ar` | `services.ai` | Renamed AR to AI |
| `product.type: "AR"` | `product.type: "AI"` | Renamed AR to AI |
| `popups.pricing: { "3CUT": {...} }` | `popups.pricing: { currency: "KRW", "3CUT": {...} }` | Added currency field |
| `rateSource: "FIREBASE" \| "CACHED"` | `rateSource: "FIREBASE" \| "CACHED" \| "API_FALLBACK"` | Added API fallback source |
| - | Replica Set requirement documented | Transactions require replica set |
| - | Refund settlement policy defined | Refunds deducted by refundedAt month |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-10 | v1.0 | Initial schema design |
| 2025-12-10 | v2.0 | Review applied: removed popup.isActive, added status field, exchange rate caching, security improvements |
| 2025-12-10 | v3.0 | Added updatedAt, device country, group index, offline rate policy, config audit fields, ALL countries |
| 2025-12-10 | v4.0 | Removed currency duplication, added rateSource/cancelledBy/endedAt, removed isCustomRate, fixed rateDate type, added popups countries index |
| 2025-12-10 | v5.0 | Removed date field (timestamp only), added Schema Validation, Connection Pool strategy, Read/Write Concern, Monitoring/Alert config |
| 2025-12-10 | v6.0 | Index optimization (timestamp first, removed duplicate popup.id index), exchange rate cache 7→3 days, added cancelSnapshot, discount validation, amountKRW precision note |
| 2025-12-10 | v7.0 | CANCELLED→FAILED/REFUNDED separation, all monetary fields Decimal128, stores→devices sync mechanism, Firestore deletedAt for frames |
| 2025-12-10 | v8.0 | Refund settlement policy, refundSnapshot.originalStatus, popup.revenue amounts removed, AR→AI rename, pricing.currency, exchange rate API fallback flow, Replica Set requirement |
