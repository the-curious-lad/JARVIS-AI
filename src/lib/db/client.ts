import { MongoClient, Db } from 'mongodb';
import fs from 'fs';
import path from 'path';

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

// Embedded persistent fallback store for development & offline testing
class FileStoreCollection {
  private name: string;
  private filePath: string;

  constructor(name: string) {
    this.name = name;
    const dataDir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        // Ignore if directory already exists
      }
    }
    this.filePath = path.join(dataDir, `${name}.json`);
  }

  private readAll(): any[] {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch {
      return [];
    }
    return [];
  }

  private writeAll(items: any[]): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Error saving to collection ${this.name}:`, err);
    }
  }

  async find(query: Record<string, any> = {}): Promise<any[]> {
    const items = this.readAll();
    return items.filter((item) => {
      for (const [key, value] of Object.entries(query)) {
        if (item[key] !== value) return false;
      }
      return true;
    });
  }

  async findOne(query: Record<string, any>): Promise<any | null> {
    const items = await this.find(query);
    return items[0] || null;
  }

  async insertOne(doc: any): Promise<{ insertedId: string; acknowledged: boolean }> {
    const items = this.readAll();
    const id = doc.id || doc._id || `id_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newDoc = { ...doc, id, _id: id };
    items.push(newDoc);
    this.writeAll(items);
    return { insertedId: id, acknowledged: true };
  }

  async updateOne(filter: Record<string, any>, update: Record<string, any>): Promise<{ matchedCount: number; modifiedCount: number }> {
    const items = this.readAll();
    let matched = 0;
    let modified = 0;

    const updatedItems = items.map((item) => {
      let matches = true;
      for (const [k, v] of Object.entries(filter)) {
        if (item[k] !== v) {
          matches = false;
          break;
        }
      }

      if (matches && matched === 0) {
        matched++;
        modified++;
        const setValues = update.$set || update;
        return { ...item, ...setValues };
      }
      return item;
    });

    if (matched > 0) {
      this.writeAll(updatedItems);
    }

    return { matchedCount: matched, modifiedCount: modified };
  }

  async updateMany(filter: Record<string, any>, update: Record<string, any>): Promise<{ matchedCount: number; modifiedCount: number }> {
    const items = this.readAll();
    let matched = 0;
    let modified = 0;

    const updatedItems = items.map((item) => {
      let matches = true;
      for (const [k, v] of Object.entries(filter)) {
        if (item[k] !== v) {
          matches = false;
          break;
        }
      }

      if (matches) {
        matched++;
        modified++;
        const setValues = update.$set || update;
        return { ...item, ...setValues };
      }
      return item;
    });

    if (matched > 0) {
      this.writeAll(updatedItems);
    }

    return { matchedCount: matched, modifiedCount: modified };
  }

  async deleteOne(filter: Record<string, any>): Promise<{ deletedCount: number }> {
    const items = this.readAll();
    const index = items.findIndex((item) => {
      for (const [k, v] of Object.entries(filter)) {
        if (item[k] !== v) return false;
      }
      return true;
    });

    if (index !== -1) {
      items.splice(index, 1);
      this.writeAll(items);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(filter: Record<string, any>): Promise<{ deletedCount: number }> {
    const items = this.readAll();
    const remaining = items.filter((item) => {
      for (const [k, v] of Object.entries(filter)) {
        if (item[k] !== v) return true;
      }
      return false;
    });
    const deletedCount = items.length - remaining.length;
    this.writeAll(remaining);
    return { deletedCount };
  }
}

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'jarvis';

  if (uri && uri.startsWith('mongodb')) {
    try {
      if (!mongoClient) {
        mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
        await mongoClient.connect();
      }
      mongoDb = mongoClient.db(dbName);
      return {
        isAtlas: true,
        collection: (name: string) => {
          const raw = mongoDb!.collection(name);
          return {
            find: async (query: any = {}) => await raw.find(query).toArray(),
            findOne: async (query: any) => await raw.findOne(query),
            insertOne: async (doc: any) => await raw.insertOne(doc),
            updateOne: async (filter: any, update: any) => await raw.updateOne(filter, update),
            updateMany: async (filter: any, update: any) => await raw.updateMany(filter, update),
            deleteOne: async (filter: any) => await raw.deleteOne(filter),
            deleteMany: async (filter: any) => await raw.deleteMany(filter),
          };
        },
      };
    } catch (err) {
      console.warn('MongoDB Atlas connection failed. Falling back to local embedded store:', err);
    }
  }

  // Fallback to file-backed embedded store
  return {
    isAtlas: false,
    collection: (name: string) => new FileStoreCollection(name),
  };
}
