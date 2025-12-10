# PhotoSignature Query Guide

> **Version:** 8.0
> **Last Updated:** 2025-12-10

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
