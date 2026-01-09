import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const raw = configService.get<string>('DATABASE_URL');

    if (!raw) {
      throw new Error(
        'DATABASE_URL is missing. Please set it in your .env file.',
      );
    }

    const connectionString = raw
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/\?schema=[^&]+/g, '')
      .replace(/&schema=[^&]+/g, '');

    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
