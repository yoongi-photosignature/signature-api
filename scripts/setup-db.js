/**
 * PhotoSignature MongoDB Setup Script
 *
 * Creates collections, schema validation, indexes, and initial config data.
 *
 * Usage:
 *   npm run setup           # Run setup
 *   npm run setup:dry-run   # Preview without executing
 */

import { MongoClient, Decimal128 } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const DRY_RUN = process.env.DRY_RUN === 'true';
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'photosignature';
const CERT_PATH = process.env.MONGODB_CERT_PATH;

// ============================================================
// Schema Validators
// ============================================================

const salesValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["timestamp", "sessionId", "transactionId", "store", "kiosk", "country", "amount", "currency", "amountKRW", "payment", "status", "product"],
    properties: {
      timestamp: { bsonType: "date" },
      sessionId: { bsonType: "string" },
      transactionId: { bsonType: "string" },
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
      kiosk: {
        bsonType: "object",
        required: ["id", "name"],
        properties: {
          id: { bsonType: "string" },
          name: { bsonType: "string" }
        }
      },
      country: {
        bsonType: "object",
        required: ["code", "name"],
        properties: {
          code: { bsonType: "string" },
          name: { bsonType: "string" }
        }
      },
      amount: { bsonType: "decimal" },
      currency: { enum: ["KRW", "JPY", "USD", "VND"] },
      amountKRW: { bsonType: "decimal" },
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
        required: ["type", "frameFormat", "frameDesign"],
        properties: {
          type: { enum: ["PHOTO", "BEAUTY", "AI", "FORTUNE"] },
          frameFormat: { enum: ["3CUT", "4CUT", "6CUT", "8CUT"] },
          frameDesign: { bsonType: "string" }
        }
      },
      discount: {
        bsonType: "object",
        properties: {
          roulette: { bsonType: "decimal" },
          coupon: { bsonType: "decimal" }
        }
      }
    }
  }
};

const storesValidator = {
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
          id: { bsonType: "string" },
          name: { bsonType: "string" },
          grade: { enum: ["MASTER", "HIGH", "MID", "LOW"] }
        }
      },
      country: {
        bsonType: "object",
        required: ["code", "name", "currency"],
        properties: {
          code: { bsonType: "string" },
          name: { bsonType: "string" },
          currency: { bsonType: "string" }
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
};

const popupsValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["_id", "name", "status", "period", "countries", "revenueConfig"],
    properties: {
      _id: { bsonType: "string" },
      name: { bsonType: "string" },
      status: { enum: ["SCHEDULED", "ACTIVE", "ENDED"] },
      period: {
        bsonType: "object",
        required: ["start", "end"],
        properties: {
          start: { bsonType: "date" },
          end: { bsonType: "date" }
        }
      },
      countries: {
        bsonType: "array",
        minItems: 1
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
};

const sessionsValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["sessionId", "kioskId", "storeId", "groupId", "countryCode", "kioskVersion", "launcherVersion", "startedAt", "status", "funnel", "selections", "behaviorSummary", "createdAt", "updatedAt"],
    properties: {
      sessionId: { bsonType: "string" },
      kioskId: { bsonType: "string" },
      storeId: { bsonType: "string" },
      groupId: { bsonType: "string" },
      countryCode: { bsonType: "string" },
      kioskVersion: { bsonType: "string" },
      launcherVersion: { bsonType: "string" },
      startedAt: { bsonType: "date" },
      endedAt: { bsonType: ["date", "null"] },
      durationMs: { bsonType: ["int", "long", "null"] },
      status: { enum: ["started", "in_progress", "completed", "abandoned", "timeout", "payment_failed", "error"] },
      funnel: { bsonType: "object" },
      exitContext: { bsonType: "object" },
      selections: { bsonType: "object" },
      payment: { bsonType: "object" },
      behaviorSummary: { bsonType: "object" },
      screenDurations: { bsonType: "object" },
      experiments: { bsonType: "object" },
      metadata: { bsonType: "object" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" }
    }
  }
};

// ============================================================
// Collection Definitions
// ============================================================

const collections = [
  {
    name: 'sales',
    validator: salesValidator,
    validationLevel: 'moderate',
    validationAction: 'error'
  },
  {
    name: 'stores',
    validator: storesValidator,
    validationLevel: 'moderate',
    validationAction: 'error'
  },
  {
    name: 'kiosks',
    validator: null // No strict validation for kiosks
  },
  {
    name: 'popups',
    validator: popupsValidator,
    validationLevel: 'moderate',
    validationAction: 'error'
  },
  {
    name: 'exchangeRates',
    validator: null
  },
  {
    name: 'config',
    validator: null
  },
  {
    name: 'sessions',
    validator: sessionsValidator,
    validationLevel: 'moderate',
    validationAction: 'warn'  // warn으로 설정하여 기존 데이터와 호환성 유지
  }
];

// ============================================================
// Index Definitions
// ============================================================

const indexes = [
  // sales indexes (4)
  { collection: 'sales', keys: { timestamp: 1, "store.id": 1 }, name: 'idx_sales_timestamp_store' },
  { collection: 'sales', keys: { timestamp: 1, "country.code": 1 }, name: 'idx_sales_timestamp_country' },
  { collection: 'sales', keys: { timestamp: 1, "country.code": 1, "popup.id": 1 }, name: 'idx_sales_timestamp_country_popup' },
  { collection: 'sales', keys: { "store.groupId": 1, timestamp: 1 }, name: 'idx_sales_group_timestamp' },

  // stores indexes (1)
  { collection: 'stores', keys: { "country.code": 1 }, name: 'idx_stores_country' },

  // kiosks indexes (1)
  { collection: 'kiosks', keys: { "store.id": 1 }, name: 'idx_kiosks_store' },

  // popups indexes (2)
  { collection: 'popups', keys: { status: 1 }, name: 'idx_popups_status' },
  { collection: 'popups', keys: { "character.id": 1 }, name: 'idx_popups_character' },

  // sessions indexes (4)
  { collection: 'sessions', keys: { sessionId: 1 }, name: 'idx_sessions_sessionId', unique: true },
  { collection: 'sessions', keys: { kioskId: 1, startedAt: -1 }, name: 'idx_sessions_kiosk_started' },
  { collection: 'sessions', keys: { storeId: 1, startedAt: -1 }, name: 'idx_sessions_store_started' },
  { collection: 'sessions', keys: { status: 1, startedAt: -1 }, name: 'idx_sessions_status_started' }
];

// ============================================================
// Initial Config Data
// ============================================================

const configData = [
  {
    _id: 'productTypes',
    values: {
      PHOTO: 'Photo',
      BEAUTY: 'Beauty',
      AI: 'AI',
      FORTUNE: 'Fortune'
    },
    updatedAt: new Date(),
    updatedBy: 'system@setup'
  },
  {
    _id: 'countries',
    values: {
      KOR: { name: 'Korea', currency: 'KRW' },
      JPN: { name: 'Japan', currency: 'JPY' },
      VNM: { name: 'Vietnam', currency: 'VND' },
      USA: { name: 'USA', currency: 'USD' }
    },
    updatedAt: new Date(),
    updatedBy: 'system@setup'
  },
  {
    _id: 'serverFees',
    domestic: 0.07,
    overseas: 0.04,
    updatedAt: new Date(),
    updatedBy: 'system@setup'
  },
  {
    _id: 'exchangeRateApi',
    provider: 'exchangerate-api',
    endpoint: 'https://api.exchangerate-api.com/v4/latest/KRW',
    updateFrequency: 'daily',
    lastUpdated: null,
    updatedAt: new Date(),
    updatedBy: 'system@setup'
  }
];

// ============================================================
// Setup Functions
// ============================================================

async function createCollections(db) {
  console.log('\n[1/3] Creating Collections...\n');

  const existingCollections = await db.listCollections().toArray();
  const existingNames = existingCollections.map(c => c.name);

  for (const col of collections) {
    if (existingNames.includes(col.name)) {
      console.log(`  [SKIP] ${col.name} - already exists`);

      // Update validator if exists
      if (col.validator) {
        if (DRY_RUN) {
          console.log(`  [DRY-RUN] Would update validator for ${col.name}`);
        } else {
          await db.command({
            collMod: col.name,
            validator: col.validator,
            validationLevel: col.validationLevel || 'moderate',
            validationAction: col.validationAction || 'error'
          });
          console.log(`  [UPDATE] ${col.name} - validator updated`);
        }
      }
    } else {
      if (DRY_RUN) {
        console.log(`  [DRY-RUN] Would create ${col.name}`);
      } else {
        const options = {};
        if (col.validator) {
          options.validator = col.validator;
          options.validationLevel = col.validationLevel || 'moderate';
          options.validationAction = col.validationAction || 'error';
        }
        await db.createCollection(col.name, options);
        console.log(`  [CREATE] ${col.name}`);
      }
    }
  }
}

async function createIndexes(db) {
  console.log('\n[2/3] Creating Indexes...\n');

  for (const idx of indexes) {
    const collection = db.collection(idx.collection);

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would create index ${idx.name} on ${idx.collection}`);
    } else {
      try {
        const indexOptions = { name: idx.name, background: true };
        if (idx.unique) indexOptions.unique = true;
        await collection.createIndex(idx.keys, indexOptions);
        console.log(`  [CREATE] ${idx.collection}.${idx.name}`);
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          console.log(`  [SKIP] ${idx.collection}.${idx.name} - already exists`);
        } else {
          throw err;
        }
      }
    }
  }

  console.log(`\n  Total: ${indexes.length} indexes`);
}

async function insertConfigData(db) {
  console.log('\n[3/3] Inserting Config Data...\n');

  const configCollection = db.collection('config');

  for (const doc of configData) {
    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would upsert config: ${doc._id}`);
    } else {
      const result = await configCollection.updateOne(
        { _id: doc._id },
        { $setOnInsert: doc },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        console.log(`  [CREATE] config.${doc._id}`);
      } else {
        console.log(`  [SKIP] config.${doc._id} - already exists`);
      }
    }
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('='.repeat(60));
  console.log('  PhotoSignature MongoDB Setup');
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\n[MODE] DRY-RUN - No changes will be made\n');
  }

  if (!MONGODB_URI) {
    console.error('\n[ERROR] MONGODB_URI not set. Create .env file from .env.example\n');
    process.exit(1);
  }

  console.log(`[DB] ${DB_NAME}`);
  console.log(`[URI] ${MONGODB_URI}`);

  // X.509 Certificate Authentication
  const certPath = CERT_PATH ? join(__dirname, CERT_PATH) : null;

  if (certPath && existsSync(certPath)) {
    console.log(`[AUTH] X.509 Certificate: ${certPath}`);
  } else if (certPath) {
    console.error(`\n[ERROR] Certificate file not found: ${certPath}\n`);
    process.exit(1);
  }

  const clientOptions = {
    tls: true,
    tlsCertificateKeyFile: certPath,
  };

  const client = new MongoClient(MONGODB_URI, clientOptions);

  try {
    await client.connect();
    console.log('\n[CONNECTED] MongoDB Atlas');

    const db = client.db(DB_NAME);

    await createCollections(db);
    await createIndexes(db);
    await insertConfigData(db);

    console.log('\n' + '='.repeat(60));
    console.log('  Setup Complete!');
    console.log('='.repeat(60));
    console.log(`
Summary:
  - Collections: ${collections.length}
  - Indexes: ${indexes.length}
  - Config docs: ${configData.length}
`);

  } catch (err) {
    console.error('\n[ERROR]', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
