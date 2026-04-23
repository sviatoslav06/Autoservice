import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 12);

  await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@test.com',
      passwordHash,
      role: 'Admin',
    },
  });

  console.log('Admin created');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
