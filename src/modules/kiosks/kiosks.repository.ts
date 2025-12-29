import { Collection, Db } from 'mongodb';
import { KioskDocument } from '../../types/index.js';

export class KiosksRepository {
  private collection: Collection<KioskDocument>;

  constructor(db: Db) {
    this.collection = db.collection('kiosks');
  }

  async findAll(): Promise<KioskDocument[]> {
    return this.collection.find().sort({ name: 1 }).toArray();
  }

  async findById(id: string): Promise<KioskDocument | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByStore(storeId: string): Promise<KioskDocument[]> {
    return this.collection.find({ 'store.id': storeId }).toArray();
  }

  async findByCountry(countryCode: string): Promise<KioskDocument[]> {
    return this.collection.find({ 'country.code': countryCode }).toArray();
  }

  async create(kiosk: KioskDocument): Promise<string> {
    await this.collection.insertOne(kiosk, { writeConcern: { w: 'majority' } });
    return kiosk._id;
  }

  async update(id: string, data: Partial<KioskDocument>): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id },
      { $set: { ...data, updatedAt: new Date() } },
      { writeConcern: { w: 'majority' } }
    );
    return result.matchedCount === 1;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne(
      { _id: id },
      { writeConcern: { w: 'majority' } }
    );
    return result.deletedCount === 1;
  }
}
