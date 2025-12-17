import { Collection, Db } from 'mongodb';
import { ExchangeRateDocument } from '../../types/index.js';

export class ExchangeRatesRepository {
  private collection: Collection<ExchangeRateDocument>;

  constructor(db: Db) {
    this.collection = db.collection('exchangeRates');
  }

  async findLatest(): Promise<ExchangeRateDocument | null> {
    return this.collection.findOne(
      {},
      { sort: { _id: -1 } }
    );
  }

  async findByDate(date: string): Promise<ExchangeRateDocument | null> {
    return this.collection.findOne({ _id: date });
  }
}
