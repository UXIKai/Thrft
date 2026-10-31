import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.__thrftPrisma ||
  new PrismaClient({
    log: process.env.PRISMA_LOG === '1' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__thrftPrisma = prisma
}

export async function assertDatabase() {
  await prisma.$queryRaw`SELECT 1`
}
