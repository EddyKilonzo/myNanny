import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async approveProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (!user.profile) {
      await this.prisma
        .$executeRaw`INSERT INTO "Profile" ("id","userId","isComplete") VALUES (gen_random_uuid(), ${userId}, true)`;
    } else if (
      !(user.profile as unknown as { isComplete?: boolean })?.isComplete
    ) {
      await this.prisma
        .$executeRaw`UPDATE "Profile" SET "isComplete" = true WHERE "userId" = ${userId}`;
    }

    await this.prisma
      .$executeRaw`UPDATE "User" SET "approvedAt" = NOW() WHERE "id" = ${userId}`;
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async activateAfterPayment(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: 'ACTIVE' },
    });
  }
}
