import { Collection, Db } from 'mongodb';
import { ConfigDocument } from '../../types/index.js';

export class ConfigRepository {
  private collection: Collection<ConfigDocument>;

  constructor(db: Db) {
    this.collection = db.collection('config');
  }

  async findAll(): Promise<ConfigDocument[]> {
    return this.collection.find().toArray();
  }

  async findById(id: string): Promise<ConfigDocument | null> {
    return this.collection.findOne({ _id: id });
  }

  async upsert(id: string, data: Partial<ConfigDocument>, updatedBy: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
          updatedBy,
        },
        $setOnInsert: { _id: id },
      },
      { upsert: true, writeConcern: { w: 'majority' } }
    );
    return result.acknowledged;
  }
}
