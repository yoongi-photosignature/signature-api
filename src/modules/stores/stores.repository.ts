import { Collection, Db } from 'mongodb';
import { StoreDocument } from '../../types/index.js';

export class StoresRepository {
  private collection: Collection<StoreDocument>;

  constructor(db: Db) {
    this.collection = db.collection('stores');
  }

  async findAll(): Promise<StoreDocument[]> {
    return this.collection.find().sort({ name: 1 }).toArray();
  }

  async findById(id: string): Promise<StoreDocument | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByCountry(countryCode: string): Promise<StoreDocument[]> {
    return this.collection.find({ 'country.code': countryCode }).toArray();
  }

  async findByGroup(groupId: string): Promise<StoreDocument[]> {
    return this.collection.find({ 'group.id': groupId }).toArray();
  }

  async create(store: StoreDocument): Promise<string> {
    await this.collection.insertOne(store, { writeConcern: { w: 'majority' } });
    return store._id;
  }

  async update(id: string, data: Partial<StoreDocument>): Promise<boolean> {
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
