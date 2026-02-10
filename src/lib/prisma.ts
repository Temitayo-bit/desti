import { PrismaClient } from "@/generated/prisma/client";

// Prevent multiple Prisma Client instances in development (hot-reload)
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
