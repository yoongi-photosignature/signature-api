import { Collection, Db } from 'mongodb';
import { DeviceDocument } from '../../types/index.js';

export class DevicesRepository {
  private collection: Collection<DeviceDocument>;

  constructor(db: Db) {
    this.collection = db.collection('devices');
  }

  async findAll(): Promise<DeviceDocument[]> {
    return this.collection.find().sort({ name: 1 }).toArray();
  }

  async findById(id: string): Promise<DeviceDocument | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByStore(storeId: string): Promise<DeviceDocument[]> {
    return this.collection.find({ 'store.id': storeId }).toArray();
  }

  async findByCountry(countryCode: string): Promise<DeviceDocument[]> {
    return this.collection.find({ 'country.code': countryCode }).toArray();
  }

  async create(device: DeviceDocument): Promise<string> {
    await this.collection.insertOne(device, { writeConcern: { w: 'majority' } });
    return device._id;
  }

  async update(id: string, data: Partial<DeviceDocument>): Promise<boolean> {
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
