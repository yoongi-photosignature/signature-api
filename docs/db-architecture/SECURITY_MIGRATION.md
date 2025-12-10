# PhotoSignature Security & Migration

> **Version:** 8.0
> **Last Updated:** 2025-12-10

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

## Migration Notes

### From Legacy (SQL Server)

| Legacy Table | MongoDB Collection | Notes |
|-------------|-------------------|-------|
| TB_MST001 | devices, stores | Split |
| TB_CAD001 | sales.payment | Embedded |
| TB_HIS003 | sales | Extended |
| TB_MST006 | popups | Restructured |
| TB_MST007 | exchangeRates | Changed to currency code |

---

## Breaking Changes from v7

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
