# PhotoSignature Firebase Realtime Database

> **Version:** 8.0
> **Last Updated:** 2025-12-10

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

---

## Exchange Rate Flow

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

---

## Offline Exchange Rate Policy

When a kiosk cannot connect to Firebase RTDB:

1. **Local Cache:** Use the last successfully fetched exchange rate
2. **Cache Validity:** Accept cached rate up to **3 days** old
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

---

## Exchange Rate Fallback Flow

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

## MongoDB exchangeRates Collection

For audit trail and fallback purposes:

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

**Purpose:**
1. Audit trail - Track which exchange rate was applied when
2. Fallback - Use when exchange rate API is unavailable (within 3 days)
3. Settlement verification - Reference for dispute resolution
