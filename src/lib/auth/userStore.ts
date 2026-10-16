import { getDb } from '@/lib/db/client';
import { contextEngine } from '@/lib/memory/contextEngine';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  callsign: string;
  preferredTone: string;
  workHours: string;
  focusAreas: string;
  createdAt: string;
}

export class UserStore {
  private collectionName = 'users';

  private async getCollection() {
    const db = await getDb();
    return db.collection(this.collectionName);
  }

  async createUser(params: {
    name: string;
    email: string;
    password: string;
    callsign?: string;
    preferredTone?: string;
    workHours?: string;
    focusAreas?: string;
  }): Promise<Omit<UserProfile, 'passwordHash'>> {
    const coll = await this.getCollection();
    const cleanEmail = params.email.toLowerCase().trim();
    const existing = await coll.findOne({ email: cleanEmail });
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const callsign = params.callsign || 'Sir';
    const preferredTone = params.preferredTone || 'Concise technical documents with structured tables';
    const workHours = params.workHours || '09:00 - 13:00 Focus Block';
    const focusAreas = params.focusAreas || 'AI Systems & Autonomous Agents';
    const now = new Date().toISOString();

    const user: UserProfile = {
      id,
      name: params.name,
      email: cleanEmail,
      passwordHash: Buffer.from(params.password).toString('base64'),
      callsign,
      preferredTone,
      workHours,
      focusAreas,
      createdAt: now,
    };

    await coll.insertOne(user);

    // Seed Initial Onboarding Preferences into Personal Context Engine with 100% confidence
    await contextEngine.saveOrUpdateMemory({
      userId: id,
      content: `User prefers to be addressed as "${callsign}".`,
      category: 'profile',
      type: 'explicit',
      confidence: 1.0,
      sourceInteraction: 'Onboarding Personalization Protocol',
    });

    await contextEngine.saveOrUpdateMemory({
      userId: id,
      content: `User communication tone preference: "${preferredTone}".`,
      category: 'preference',
      type: 'explicit',
      confidence: 1.0,
      sourceInteraction: 'Onboarding Personalization Protocol',
    });

    await contextEngine.saveOrUpdateMemory({
      userId: id,
      content: `User scheduled work focus hours: "${workHours}".`,
      category: 'scheduling',
      type: 'explicit',
      confidence: 1.0,
      sourceInteraction: 'Onboarding Personalization Protocol',
    });

    await contextEngine.saveOrUpdateMemory({
      userId: id,
      content: `Primary areas of technical interest: "${focusAreas}".`,
      category: 'project',
      type: 'explicit',
      confidence: 1.0,
      sourceInteraction: 'Onboarding Personalization Protocol',
    });

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async authenticate(email: string, password: string): Promise<Omit<UserProfile, 'passwordHash'>> {
    const coll = await this.getCollection();
    const cleanEmail = email.toLowerCase().trim();
    const user = await coll.findOne({ email: cleanEmail });
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const encoded = Buffer.from(password).toString('base64');
    if (user.passwordHash !== encoded) {
      throw new Error('Invalid email or password.');
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async getUserById(id: string): Promise<Omit<UserProfile, 'passwordHash'> | null> {
    const coll = await this.getCollection();
    const user = await coll.findOne({ id });
    if (!user) return null;

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async getPrimaryUser(): Promise<Omit<UserProfile, 'passwordHash'> | null> {
    const coll = await this.getCollection();
    const user = await coll.findOne({});
    if (!user) return null;

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}

export const userStore = new UserStore();
