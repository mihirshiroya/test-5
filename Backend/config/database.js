const { PrismaClient } = require('@prisma/client');
const { invalidateUser } = require('../utils/cache');

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  errorFormat: 'pretty',
});

// Any write to a user row drops that user's cached auth record, so changes
// like deactivation, role updates or email verification take effect on the
// very next request, no matter which controller performed the write.
const invalidatingUserWrite = async ({ args, query }) => {
  const result = await query(args);
  await invalidateUser(result?.id ?? args?.where?.id);
  return result;
};

const prisma = basePrisma.$extends({
  query: {
    user: {
      update: invalidatingUserWrite,
      upsert: invalidatingUserWrite,
      delete: invalidatingUserWrite,
    },
  },
});

process.on('beforeExit', async () => {
  await basePrisma.$disconnect();
});

process.on('SIGINT', async () => {
  await basePrisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await basePrisma.$disconnect();
  process.exit(0);
});

module.exports = prisma;
