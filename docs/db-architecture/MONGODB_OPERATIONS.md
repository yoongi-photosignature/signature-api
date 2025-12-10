# PhotoSignature MongoDB Operations Guide

> **Version:** 8.0
> **Last Updated:** 2025-12-10

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

---

## Read/Write Concern

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

---

## Replica Set Requirement

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

## Data Sync Strategy

### stores → devices Country Sync

`devices.country` is a copy of `stores.country`. When stores are updated, devices must be synced as well.

**Sync Trigger (API Server):**

```javascript
// Sync devices when stores are updated
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
| `country` | `country` | Yes |
| `name` | `store.name` | Yes |
| `_id` | `store.id` | No (immutable) |
