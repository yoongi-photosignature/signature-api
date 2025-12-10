# PhotoSignature MongoDB Schema

> **작성일:** 2025-12-10
> **프로젝트:** PhotoSignature 신규 시스템

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
│ • Last seen       │ │ • Devices │ │                         │
└───────────────────┘ └───────────┘ └─────────────────────────┘
     Free~$5/mo         $57/mo          Already in use
```

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

  // Country & Currency
  country: {
    code: "JPN",                            // Country code (for filtering)
    name: "Japan",
    currency: "JPY"                         // Currency code (for exchange)
  },

  // Amount (calculated by kiosk at transaction time)
  amount: 500,                              // Original amount (local currency)
  currency: "JPY",
  exchangeRate: 9.12,                       // Rate at transaction time
  amountKRW: 4560,                          // Converted to KRW
  rateDate: "2025-01-15",                   // Rate date for audit

  // Payment
  payment: {
    type: "CARD",                           // "CASH" | "CARD"
    cardNo: "1234-****-****-5678",          // Masked
    receiptNo: "R20250115001"
  },

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
  popup: {
    id: "POPUP_KAKAO_2025",
    name: "Kakao Friends 2025",
    characterId: "RYAN",
    characterName: "Ryan",
    isActive: true,                         // For filtering active/ended popups

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

  createdAt: ISODate("2025-01-15T14:30:00Z")
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

// Active popup filtering
db.sales.createIndex({ "popup.isActive": 1, "popup.id": 1 })

// Product type (Beauty/AR sales)
db.sales.createIndex({ date: 1, "product.type": 1 })
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
  settlement: {
    serverFeeRate: 0.07,                    // 7% for Korea, 4% for overseas
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

  programType: "SIGNATURE",

  createdAt: ISODate("2024-01-01"),
  updatedAt: ISODate("2025-01-15")
}
```

**Firebase RTDB Structure (for real-time):**
```javascript
{
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
  }
}
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

  // Status management
  status: "ACTIVE",                         // "ACTIVE" | "ENDED" | "SCHEDULED"
  period: {
    start: ISODate("2025-01-01"),
    end: ISODate("2025-03-31")
  },

  // Target regions
  countries: ["KOR", "JPN", "VNM"],         // Empty array = all countries

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
```

---

### 5. `exchangeRates` - Exchange Rates

Rates are fetched daily by kiosks and cached locally.

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
  source: "exchangerate-api",
  fetchedAt: ISODate("2025-01-15T00:00:00Z")
}
```

---

### 6. `config` - System Configuration

```javascript
// Product types (rarely changes)
{
  _id: "productTypes",
  values: {
    "PHOTO": "Photo",
    "BEAUTY": "Beauty",
    "AR": "AR",
    "FORTUNE": "Fortune"
  }
}

// Country codes
{
  _id: "countries",
  values: {
    "KOR": { name: "Korea", currency: "KRW" },
    "JPN": { name: "Japan", currency: "JPY" },
    "VNM": { name: "Vietnam", currency: "VND" },
    "USA": { name: "USA", currency: "USD" }
  }
}

// Server fee defaults
{
  _id: "serverFees",
  domestic: 0.07,                           // 7% for Korea
  overseas: 0.04                            // 4% for overseas
}
```

**Note:** Frame types are managed in Firestore (designer page). MongoDB only stores `frameId` reference.

---

## Common Queries

### 1. Monthly Sales by Store

```javascript
db.sales.aggregate([
  { $match: {
    date: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") }
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

### 2. Settlement Report (Domestic)

```javascript
db.sales.aggregate([
  { $match: {
    date: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    "country.code": "KOR"
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
  { $addFields: {
    serverFee: { $multiply: ["$revenue", 0.07] }
  }}
])
```

### 3. Settlement Report (Overseas)

```javascript
db.sales.aggregate([
  { $match: {
    date: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    "country.code": { $ne: "KOR" }
  }},
  { $group: {
    _id: "$store.id",
    storeName: { $first: "$store.name" },
    country: { $first: "$country.code" },
    revenue: { $sum: "$amountKRW" }
  }},
  { $addFields: {
    serverFee: { $multiply: ["$revenue", 0.04] }
  }}
])
```

### 4. Monthly Beauty/AR Sales

```javascript
db.sales.aggregate([
  { $match: {
    date: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    "product.type": { $in: ["BEAUTY", "AR"] }
  }},
  { $group: {
    _id: {
      type: "$product.type",
      month: { $dateToString: { format: "%Y-%m", date: "$date" } }
    },
    totalSales: { $sum: "$amountKRW" }
  }}
])
```

### 5. Overseas Popup Sales (by Country & Character)

```javascript
db.sales.aggregate([
  { $match: {
    date: { $gte: ISODate("2025-01-01"), $lt: ISODate("2025-02-01") },
    "country.code": "JPN",
    "popup.characterId": "RYAN"
  }},
  { $group: {
    _id: {
      frameCategory: "$product.frameCategory",
      isAdditional: "$product.isAdditionalPrint"
    },
    price: { $first: "$amount" },
    salesCount: { $sum: 1 },
    totalSales: { $sum: "$amountKRW" }
  }},
  { $addFields: {
    royalty: { $multiply: ["$totalSales", 0.04] }
  }}
])
```

### 6. Active vs Ended Popup Sales

```javascript
// Active popups only
db.sales.aggregate([
  { $match: { "popup.isActive": true } },
  { $group: {
    _id: "$popup.id",
    popupName: { $first: "$popup.name" },
    totalSales: { $sum: "$amountKRW" }
  }}
])

// Ended popups
db.popups.find({ status: "ENDED" })
```

### 7. Character Sales Ranking

```javascript
db.sales.aggregate([
  { $match: {
    date: { $gte: ISODate("2025-01-01") },
    "popup.characterId": { $ne: null }
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

## Kiosk Exchange Rate Logic

```javascript
// Kiosk-side implementation (pseudocode)
class ExchangeRateCache {
  constructor() {
    this.rates = {};
    this.lastUpdate = null;
  }

  async getRate(currency) {
    // Use cached rate if already fetched today
    if (this.isToday(this.lastUpdate)) {
      return this.rates[currency] || 1;
    }

    // Fetch once per day
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/KRW');
      this.rates = response.rates;
      this.lastUpdate = new Date();

      // Save to MongoDB for reference
      await saveToExchangeRates(this.rates);
    } catch (e) {
      console.log("Rate fetch failed, using cached rate");
    }

    return this.rates[currency] || 1;
  }

  async calculateKRW(amount, currency) {
    if (currency === 'KRW') return amount;
    const rate = await this.getRate(currency);
    return Math.round(amount * rate);
  }
}

// Usage when saving sale
const sale = {
  amount: 500,
  currency: "JPY",
  exchangeRate: await rateCache.getRate("JPY"),
  amountKRW: await rateCache.calculateKRW(500, "JPY"),
  rateDate: new Date().toISOString().split('T')[0]
};
```

---

## Cost Estimation

| Item | Specification | Monthly Cost |
|------|--------------|--------------|
| MongoDB Atlas M10 | 10GB, 1500 connections | $57 |
| Firebase RTDB | Free tier (729 devices) | $0~5 |
| Firestore | Already in use | - |
| **Total** | | **~$60/month** |

---

## Index Cost Impact

| Index Count | Additional Storage | Recommendation |
|------------|-------------------|----------------|
| 5 indexes | +1.5~2GB | OK for M10 |
| 7 indexes | +2~3GB | Consider M20 |
| 10+ indexes | +4GB+ | Requires M20 |

- **Adding/removing indexes:** No cost, no downtime (background operation)
- **Write performance:** Slight decrease with more indexes
- **Read performance:** Significant improvement with proper indexes
