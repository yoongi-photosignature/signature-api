import { Collection, Db, ObjectId, Decimal128 } from 'mongodb';
import { SaleDocument } from '../../types/index.js';

export class SalesRepository {
  private collection: Collection<SaleDocument>;

  constructor(db: Db) {
    this.collection = db.collection('sales');
  }

  async create(sale: Omit<SaleDocument, '_id'>): Promise<ObjectId> {
    const result = await this.collection.insertOne(
      sale as SaleDocument,
      { writeConcern: { w: 'majority' } }
    );
    return result.insertedId;
  }

  async findById(id: string): Promise<SaleDocument | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  async updateRefund(
    id: string,
    refundData: {
      status: 'REFUNDED';
      refundedAt: Date;
      refundReason: string;
      refundedBy: string;
      refundSnapshot: {
        originalAmount: Decimal128;
        originalAmountKRW: Decimal128;
        originalStatus: string;
      };
      updatedAt: Date;
    }
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: new ObjectId(id), status: 'COMPLETED' },
      { $set: refundData },
      { writeConcern: { w: 'majority' } }
    );
    return result.modifiedCount === 1;
  }
}
