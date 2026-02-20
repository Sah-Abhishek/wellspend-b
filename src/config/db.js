import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../generated/prisma/client.ts';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Check your .env file.');
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export default prisma;
