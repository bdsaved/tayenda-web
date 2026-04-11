import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../lib/db/schema';
import * as bcrypt from 'bcryptjs';

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    throw new Error('Missing required database environment variables');
}

const connectionString = `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}`;
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

async function seed() {
    console.log('Seeding database...');

    try {
        // Create admin user
        const passwordHash = await bcrypt.hash('8-18Zfyd9;YYAe', 10);

        const [adminUser] = await db.insert(schema.users).values({
            username: 'rflmwcom',
            email: 'admin@tayenda.com',
            password_hash: passwordHash,
            full_name: 'Rflmwcom Admin',
            role: 'admin',
            is_active: true,
        }).onConflictDoNothing().returning();

        if (adminUser) {
            console.log('✓ Admin user created:', adminUser.username);
        } else {
            console.log('⚠ Admin user already exists');
        }

        console.log('\nSeeding complete!');
        console.log('\nYou can now login with:');
        console.log('Username: rflmwcom');
        console.log('Password: 8-18Zfyd9;YYAe');

    } catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    } finally {
        await client.end();
    }
}

seed();
