import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertHasStringId(body: unknown): asserts body is { id: string } {
  if (!isRecord(body) || typeof body.id !== 'string') {
    throw new Error('Expected response body to have a string "id"');
  }
}

function assertIsPostResponse(body: unknown): asserts body is {
  id: string;
  likesCount: number;
} {
  if (!isRecord(body))
    throw new Error('Expected response body to be an object');
  if (typeof body.id !== 'string')
    throw new Error('Expected response body to have a string "id"');
  if (typeof body.likesCount !== 'number')
    throw new Error('Expected response body to have a number "likesCount"');
}

function assertIsLikeResponse(body: unknown): asserts body is {
  postId: string;
  userId: string;
  duplicated: boolean;
  likesCount: number;
} {
  if (!isRecord(body))
    throw new Error('Expected response body to be an object');
  if (typeof body.postId !== 'string')
    throw new Error('Expected response body to have a string "postId"');
  if (typeof body.userId !== 'string')
    throw new Error('Expected response body to have a string "userId"');
  if (typeof body.duplicated !== 'boolean')
    throw new Error('Expected response body to have a boolean "duplicated"');
  if (typeof body.likesCount !== 'number')
    throw new Error('Expected response body to have a number "likesCount"');
}

function stopAllSchedules(registry: SchedulerRegistry): void {
  for (const name of registry.getIntervals()) {
    registry.deleteInterval(name);
  }
  for (const name of registry.getTimeouts()) {
    registry.deleteTimeout(name);
  }
  for (const name of registry.getCronJobs().keys()) {
    registry.deleteCronJob(name);
  }
}

describe('Interactions E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let schedulerRegistry: SchedulerRegistry | null = null;

  beforeAll(async () => {
    jest.setTimeout(30_000);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    try {
      schedulerRegistry = app.get(SchedulerRegistry);
      if (schedulerRegistry) stopAllSchedules(schedulerRegistry);
    } catch {
      schedulerRegistry = null;
    }
  });

  afterEach(async () => {
    await prisma.postLike.deleteMany();
    await prisma.notificationOutbox.deleteMany();
    await prisma.post.deleteMany();
  });

  afterAll(async () => {
    if (schedulerRegistry) stopAllSchedules(schedulerRegistry);
    await app.close();
  });

  it('POST /posts/:id/like should be idempotent and update likesCount; should create outbox event', async () => {
    const authorId = 'author_e2e';
    const likerId = 'liker_e2e';

    const createPostRes = await request(app.getHttpServer())
      .post('/posts')
      .set('x-user-id', authorId)
      .send({ content: 'Hello from E2E!' })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    assertHasStringId(createPostRes.body);
    const postId = createPostRes.body.id;

    const like1Res = await request(app.getHttpServer())
      .post(`/posts/${postId}/like`)
      .set('x-user-id', likerId)
      .send()
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    assertIsLikeResponse(like1Res.body);
    expect(like1Res.body).toEqual({
      postId,
      userId: likerId,
      duplicated: false,
      likesCount: 1,
    });

    const like2Res = await request(app.getHttpServer())
      .post(`/posts/${postId}/like`)
      .set('x-user-id', likerId)
      .send()
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    assertIsLikeResponse(like2Res.body);
    expect(like2Res.body).toEqual({
      postId,
      userId: likerId,
      duplicated: true,
      likesCount: 1,
    });

    const getPostRes = await request(app.getHttpServer())
      .get(`/posts/${postId}`)
      .expect(200);

    assertIsPostResponse(getPostRes.body);
    expect(getPostRes.body.id).toBe(postId);
    expect(getPostRes.body.likesCount).toBe(1);

    const outboxEvent = await prisma.notificationOutbox.findFirst({
      where: { type: 'POST_LIKED' },
      orderBy: { createdAt: 'desc' },
      select: { type: true, status: true, payload: true },
    });

    expect(outboxEvent).not.toBeNull();
    expect(outboxEvent!.type).toBe('POST_LIKED');

    const payload = outboxEvent!.payload as unknown as {
      postId: string;
      actorUserId: string;
      recipientUserId: string;
    };

    expect(payload).toEqual({
      postId,
      actorUserId: likerId,
      recipientUserId: authorId,
    });
  });
});
