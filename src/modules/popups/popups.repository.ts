import { Collection, Db } from 'mongodb';
import { PopupDocument, PopupStatus } from '../../types/index.js';

export class PopupsRepository {
  private collection: Collection<PopupDocument>;

  constructor(db: Db) {
    this.collection = db.collection('popups');
  }

  async findAll(): Promise<PopupDocument[]> {
    return this.collection.find().sort({ createdAt: -1 }).toArray();
  }

  async findById(id: string): Promise<PopupDocument | null> {
    return this.collection.findOne({ _id: id });
  }

  async findActive(): Promise<PopupDocument[]> {
    return this.collection.find({ status: 'ACTIVE' }).toArray();
  }

  async findByStatus(status: PopupStatus): Promise<PopupDocument[]> {
    return this.collection.find({ status }).toArray();
  }

  async create(popup: PopupDocument): Promise<string> {
    await this.collection.insertOne(popup, { writeConcern: { w: 'majority' } });
    return popup._id;
  }

  async update(id: string, data: Partial<PopupDocument>): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id },
      { $set: { ...data, updatedAt: new Date() } },
      { writeConcern: { w: 'majority' } }
    );
    return result.matchedCount === 1;
  }

  async updateStatus(id: string, status: PopupStatus): Promise<boolean> {
    const updateData: Partial<PopupDocument> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'ENDED') {
      updateData.endedAt = new Date();
    }

    const result = await this.collection.updateOne(
      { _id: id },
      { $set: updateData },
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
