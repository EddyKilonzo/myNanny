import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { User, Profile } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a parent user
   * @param input - The input data for creating a parent user
   * @returns The created parent user
   */

  async createParent(input: CreateUserDto): Promise<User> {
    try {
      return await this.createUserWithRole(input, 'PARENT');
    } catch (e: unknown) {
      this.rethrow(e);
    }
  }

  /**
   * Create a nanny user
   * @param input - The input data for creating a nanny user
   * @returns The created nanny user
   */

  async createNanny(input: CreateUserDto): Promise<User> {
    try {
      return await this.createUserWithRole(input, 'NANNY');
    } catch (e: unknown) {
      this.rethrow(e);
    }
  }

  /**
   * Update background check status for a user (PENDING | PASSED | FAILED)
   */
  async setBackgroundStatus(
    userId: string,
    status: 'PENDING' | 'PASSED' | 'FAILED',
  ): Promise<User> {
    try {
      await this.prisma
        .$executeRaw`UPDATE "User" SET "backgroundStatus" = ${status} WHERE "id" = ${userId}`;
      const updated = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!updated) throw new NotFoundException('User not found');
      return updated;
    } catch (e: unknown) {
      this.rethrow(e);
    }
  }

  // Admin approval and payment activation moved to AdminService

  /**
   * Check if user can access interactive services
   * Requires: accountStatus ACTIVE, profile.isComplete true, backgroundStatus PASSED
   */
  async canAccessServices(userId: string): Promise<boolean> {
    try {
      type UserGate = {
        accountStatus: string;
        approvedAt: Date | null;
        backgroundStatus: string;
        profile: { isComplete: boolean } | null;
      } | null;
      const user = (await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          accountStatus: true,
          // approvedAt via raw select below to avoid type mismatch during evolution
          backgroundStatus: true,
          profile: true,
        },
      })) as UserGate;
      // fetch approvedAt separately to avoid select typing issue
      const { approvedAt } = (
        await this.prisma.$queryRawUnsafe<any>(
          'SELECT "approvedAt" FROM "User" WHERE "id" = $1',
          userId,
        )
      )?.[0] ?? { approvedAt: null };
      if (!user) throw new NotFoundException('User not found');
      const isActive = user.accountStatus === 'ACTIVE';
      const hasCompleteProfile = Boolean(user.profile?.isComplete);
      const bgPassed = user.backgroundStatus === 'PASSED';
      const adminApproved = Boolean(approvedAt);
      return isActive && hasCompleteProfile && bgPassed && adminApproved;
    } catch (e: unknown) {
      this.rethrow(e);
    }
  }

  private async createUserWithRole(
    input: CreateUserDto,
    role: 'PARENT' | 'NANNY',
  ): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          email: input.email,
          password: input.password,
          fullName: input.fullName,
          role,
          profile: input.profile
            ? {
                create: {
                  bio: input.profile.bio ?? undefined,
                  location: input.profile.location ?? undefined,
                  experience: input.profile.experience ?? undefined,
                },
              }
            : undefined,
        },
      });
    } catch (e: unknown) {
      this.rethrow(e);
    }
  }

  async getById(id: string): Promise<User & { profile: Profile | null }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: { profile: true },
      });
      if (!user) throw new NotFoundException('User not found');
      return user;
    } catch (e: unknown) {
      this.rethrow(e);
    }
  }

  async listParents(
    skip = 0,
    take = 20,
  ): Promise<(User & { profile: Profile | null })[]> {
    try {
      return await this.prisma.user.findMany({
        where: { role: 'PARENT' },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { profile: true },
      });
    } catch (e: unknown) {
      this.rethrow(e);
    }
  }

  async listNannies(
    skip = 0,
    take = 20,
  ): Promise<(User & { profile: Profile | null })[]> {
    try {
      return await this.prisma.user.findMany({
        where: { role: 'NANNY' },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { profile: true },
      });
    } catch (e: unknown) {
      this.rethrow(e);
    }
  }

  async updateUser(
    id: string,
    data: UpdateUserDto,
  ): Promise<User & { profile: Profile | null }> {
    try {
      const existing = await this.prisma.user.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('User not found');

      return await this.prisma.user.update({
        where: { id },
        data: {
          fullName: data.fullName ?? undefined,
          password: data.password ?? undefined,
          profile: data.profile
            ? {
                upsert: {
                  create: {
                    bio: data.profile.bio ?? undefined,
                    location: data.profile.location ?? undefined,
                    experience: data.profile.experience ?? undefined,
                  },
                  update: {
                    bio: data.profile.bio ?? undefined,
                    location: data.profile.location ?? undefined,
                    experience: data.profile.experience ?? undefined,
                  },
                },
              }
            : undefined,
        },
        include: { profile: true },
      });
    } catch (e: unknown) {
      this.rethrow(e);
    }
  }

  async setAccountActive(userId: string): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { accountStatus: 'ACTIVE' },
      });
    } catch (e: unknown) {
      this.rethrow(e);
    }
  }

  async suspend(userId: string): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { accountStatus: 'SUSPENDED' },
      });
    } catch (e: unknown) {
      this.rethrow(e);
    }
  }

  private rethrow(e: unknown): never {
    const err = e as { code?: string } | Error | undefined;
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
    }
    if (e instanceof NotFoundException || e instanceof ConflictException) {
      throw e;
    }
    throw new InternalServerErrorException('An unexpected error occurred');
  }
}
