# PhotoSignature MongoDB Schema v4

> ⚠️ **v5로 대체됨. MONGODB_SCHEMA_V5.md 참조**

> **Created:** 2025-12-10
> **Project:** PhotoSignature New System
> **Version:** 4.0 (v3 Review Applied)

## Overview

Photo kiosk management system database schema designed for MongoDB.
- **729 devices** across multiple countries
- **Write-heavy** workload (sales transactions)
- **Read: monthly settlement** and analytics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    729 Kiosk Devices                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌───────────────────┐ ┌───────────┐ ┌─────────────────────────┐
│ Firebase RTDB     │ │  MongoDB  │ │ Firestore               │
│ (Real-time)       │ │  (Main)   │ │ (Design Assets)         │
├───────────────────┤ ├───────────┤ ├─────────────────────────┤
│ • Online status   │ │ • Sales   │ │ • Frame designs         │
│ • Paper quantity  │ │ • Stores  │ │ • Background images     │
│ • Today's sales   │ │ • Popups  │ │ • Designer management   │
│ • Exchange rates  │ │ • Devices │ │                         │
│   (cached)        │ │           │ │                         │
└───────────────────┘ └───────────┘ └─────────────────────────┘
     Blaze Plan          $57/mo          Already in use
     (~$5-20/mo)
```

### Why 3 Databases?

| DB | Role | Reason |
|----|------|--------|
| MongoDB | Sales, settlement, aggregation | Aggregation Pipeline, flexible schema |
| Firebase RTDB | Real-time status | WebSocket-based, frontend subscription |
| Firestore | Design assets | Already in use, designer page integration |

---

## Collections

### 1. `sales` - Sales Transactions (Core)

The main collection for all sales data. Exchange rate is calculated by kiosk at transaction time.

```javascript
{
  _id: ObjectId,

  // Date & Time
  date: ISODate("2025-01-15"),              // Sale date (for indexing)
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
  amount: 500,                              // Original amount (local currency)
  currency: "JPY",                          // Currency code
  exchangeRate: 9.12,                       // Rate at transaction time
  amountKRW: 4560,                          // Converted to KRW
  rateDate: ISODate("2025-01-15"),          // v4: Changed to ISODate for consistency
  rateSource: "FIREBASE",                   // v4: "FIREBASE" | "CACHED" (for audit)

  // Payment
  payment: {
    type: "CARD",                           // "CASH" | "CARD"
    receiptNo: "R20250115001",              // PG receipt number only
    pgProvider: "NICE"                      // PG provider name
  },

  // Transaction Status
  status: "COMPLETED",                      // "COMPLETED" | "CANCELLED" | "REFUNDED"
  cancelledAt: null,                        // Cancellation timestamp
  cancelReason: null,                       // Cancellation reason
  cancelledBy: null,                        // v4: Who cancelled (email or system)

  // Discounts
  discount: {
    roulette: 1000,                         // Roulette discount amount
    coupon: 0,
    couponCode: null
  },

  // Product
  product: {
    type: "PHOTO",                          // "PHOTO" | "BEAUTY" | "AR" | "FORTUNE"
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

    // Revenue split (varies per popup)
    revenue: {
      storeRate: 0.30,
      corpRate: 0.50,
      licenseRate: 0.20,
      // Calculated amounts
      storeAmount: 1500,
      corpAmount: 2500,
      licenseAmount: 1000
    }
  },

  // Service usage
  services: {
    beauty: { used: true, fee: 500 },
    ar: { used: false, fee: 0 }
  },

  createdAt: ISODate("2025-01-15T14:30:00Z"),
  updatedAt: ISODate("2025-01-15T14:30:00Z")
}
```

**Indexes:**
```javascript
// Date + Store (most common query)
db.sales.createIndex({ date: 1, "store.id": 1 })

// Date + Country (domestic/overseas filtering)
db.sales.createIndex({ date: 1, "country.code": 1 })

// Date + Country + Popup (overseas popup sales)
db.sales.createIndex({ date: 1, "country.code": 1, "popup.id": 1 })

// Popup ID for $in queries (active popup lookup)
db.sales.createIndex({ "popup.id": 1, date: 1 })

// Product type (Beauty/AR sales)
db.sales.createIndex({ date: 1, "product.type": 1 })

// Status for cancelled/refunded queries
db.sales.createIndex({ status: 1, date: 1 })

// Group-level reporting
db.sales.createIndex({ "store.groupId": 1, date: 1 })
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
  // v4: Each store has its own rate (no isCustomRate flag)
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
db.stores.createIndex({ "group.id": 1 })
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
db.devices.createIndex({ "country.code": 1 })
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
  status: "ACTIVE",                         // "ACTIVE" | "ENDED" | "SCHEDULED"
  period: {
    start: ISODate("2025-01-01"),
    end: ISODate("2025-03-31")              // Planned end (actual end is manual)
  },
  endedAt: null,                            // v4: Actual end timestamp (when status → ENDED)

  // Target regions
  // Use ["ALL"] for all countries instead of empty array
  countries: ["ALL"],                       // ["ALL"] | ["KOR", "JPN", "VNM"]

  // Revenue config (varies per popup)
  revenueConfig: {
    storeRate: 0.30,
    corpRate: 0.50,
    licenseRate: 0.20
  },

  // Discount config (varies per event)
  discountConfig: {
    type: "ROULETTE",                       // "ROULETTE" | "COUPON" | "FIXED" | "NONE"
    rouletteRates: [0, 0.1, 0.2, 0.3],
    maxDiscount: 2000
  },

  // Pricing (can vary per popup)
  pricing: {
    "3CUT": { price: 4000, printCount: 1 },
    "4CUT": { price: 5000, printCount: 2 },
    "6CUT": { price: 6000, printCount: 2 }
  },

  createdAt: ISODate("2025-01-01"),
  updatedAt: ISODate("2025-01-15")
}
```

**Indexes:**
```javascript
db.popups.createIndex({ status: 1 })
db.popups.createIndex({ "character.id": 1 })
db.popups.createIndex({ "period.end": 1, status: 1 })
db.popups.createIndex({ countries: 1, status: 1 })    // v4: For country-specific popup queries
```

---

### 5. `exchangeRates` - Exchange Rates (Reference/Audit)

Rates are fetched by server and cached to Firebase RTDB. This collection is for audit trail.

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
    "AR": "AR",
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
2. **Cache Validity:** Accept cached rate up to 7 days old
3. **Fallback:** If cache > 7 days, reject overseas transactions (require network)
4. **Audit:** Store `rateSource: "CACHED"` in sales document when using cached rate

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

---

## Common Queries

### 1. Monthly Sales by Store

```javascript
db.sales.aggregate([
  { $match: {
    date: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
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
    date: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
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
    date: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
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
    date: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
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

// Step 2: Query sales with $in (uses popup.id index)
db.sales.aggregate([
  { $match: {
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

### 6. Cancelled/Refunded Transactions

```javascript
db.sales.find({
  date: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
  status: { $in: ["CANCELLED", "REFUNDED"] }
}).sort({ cancelledAt: -1 })
```

### 7. Character Sales Ranking

```javascript
db.sales.aggregate([
  { $match: {
    date: { $gte: ISODate("2025-01-01") },
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

## Cost Estimation

| Item | Specification | Monthly Cost |
|------|--------------|--------------|
| MongoDB Atlas M10 | 10GB, 1500 connections | $57 |
| Firebase RTDB (Blaze) | 729 devices, ~1GB | $5~20 |
| Firestore | Already in use | - |
| **Total** | | **~$77/month** |

---

## Index Summary

### sales Collection (7 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ date: 1, "store.id": 1 }` | Daily sales by store | Compound |
| `{ date: 1, "country.code": 1 }` | Domestic/overseas filter | Compound |
| `{ date: 1, "country.code": 1, "popup.id": 1 }` | Overseas popup sales | Compound |
| `{ "popup.id": 1, date: 1 }` | Active popup lookup ($in) | Compound |
| `{ date: 1, "product.type": 1 }` | Beauty/AR sales | Compound |
| `{ status: 1, date: 1 }` | Cancelled/refunded | Compound |
| `{ "store.groupId": 1, date: 1 }` | Group-level reporting | Compound |

### stores Collection (2 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ "country.code": 1 }` | Stores by country | Single |
| `{ "group.id": 1 }` | Stores by group | Single |

### devices Collection (2 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ "store.id": 1 }` | Devices by store | Single |
| `{ "country.code": 1 }` | Overseas device filter | Single |

### popups Collection (4 indexes)

| Index | Purpose | Type |
|-------|---------|------|
| `{ status: 1 }` | Active popup filter | Single |
| `{ "character.id": 1 }` | Character lookup | Single |
| `{ "period.end": 1, status: 1 }` | Expiring popups | Compound |
| `{ countries: 1, status: 1 }` | Country-specific popups (v4) | Compound |

### Total Index Count: 15

| Collection | Index Count |
|------------|-------------|
| sales | 7 |
| stores | 2 |
| devices | 2 |
| popups | 4 |
| **Total** | **15** |

### Index Storage Estimate

| Index Count | Additional Storage |
|------------|-------------------|
| 15 indexes total | ~3GB |
| M10 capacity | 10GB |
| **Available** | **~7GB for data** |

---

## Data Retention Policy

> **TODO:** Policy to be finalized later

| Data | Retention Period | Method |
|------|-----------------|--------|
| Sales (sales) | 5 years | TTL Index or archiving |
| Device logs | 1 year | Auto-delete TBD |
| Exchange rates | 3 years | Quarterly cleanup |

**To be reviewed:**
- [ ] Legal retention requirements (tax, audit)
- [ ] Cold storage (S3/GCS) vs TTL delete
- [ ] Archive queryability requirements

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

### Breaking Changes from v3

| v3 | v4 | Reason |
|----|----|--------|
| `sales.rateDate: string` | `ISODate` | Type consistency |
| `sales.country.currency` | Removed | Duplicate of sales.currency |
| - | `sales.rateSource` added | Audit for cached rates |
| - | `sales.cancelledBy` added | Audit trail |
| - | `popups.endedAt` added | Track actual end time |
| `stores.settlement.isCustomRate` | Removed | Each store has own rate |
| 3 popups indexes | 4 popups indexes | Added countries+status |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-10 | v1.0 | Initial schema design |
| 2025-12-10 | v2.0 | Review applied: removed popup.isActive, added status field, exchange rate caching, security improvements |
| 2025-12-10 | v3.0 | Added updatedAt, device country, group index, offline rate policy, config audit fields, ALL countries |
| 2025-12-10 | v4.0 | Removed currency duplication, added rateSource/cancelledBy/endedAt, removed isCustomRate, fixed rateDate type, added popups countries index |
