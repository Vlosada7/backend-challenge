import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InteractionsService } from './interactions.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

type FindPostForLike = (args: {
  where: { id: string };
  select: { id: true; authorId: true };
}) => Promise<{ id: string; authorId: string } | null>;

type UpdatePostLikesCount = (args: {
  where: { id: string };
  data: { likesCount: { increment: number } };
  select: { likesCount: true };
}) => Promise<{ likesCount: number }>;

type CreatePostLike = (args: {
  data: { postId: string; userId: string };
  select: { id: true };
}) => Promise<{ id: string }>;

type CreateOutboxEvent = (args: {
  data: {
    type: 'POST_LIKED';
    payload: { postId: string; actorUserId: string; recipientUserId: string };
  };
  select: { id: true };
}) => Promise<{ id: string }>;

type FindPostLikesCount = (args: {
  where: { id: string };
  select: { likesCount: true };
}) => Promise<{ likesCount: number } | null>;

type TxClient = {
  post: {
    findUnique: jest.MockedFunction<FindPostForLike>;
    update: jest.MockedFunction<UpdatePostLikesCount>;
  };
  postLike: {
    create: jest.MockedFunction<CreatePostLike>;
  };
  notificationOutbox: {
    create: jest.MockedFunction<CreateOutboxEvent>;
  };
};

type TransactionCallback = (tx: TxClient) => Promise<number>;
type TransactionFn = (cb: TransactionCallback) => Promise<number>;

type PrismaServiceMock = {
  $transaction: jest.MockedFunction<TransactionFn>;
  post: {
    findUnique: jest.MockedFunction<FindPostLikesCount>;
  };
};

function p2002UniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('InteractionsService', () => {
  let service: InteractionsService;

  let tx: TxClient;
  let prisma: PrismaServiceMock;

  beforeEach(() => {
    tx = {
      post: {
        findUnique: jest.fn<
          ReturnType<FindPostForLike>,
          Parameters<FindPostForLike>
        >(),
        update: jest.fn<
          ReturnType<UpdatePostLikesCount>,
          Parameters<UpdatePostLikesCount>
        >(),
      },
      postLike: {
        create: jest.fn<
          ReturnType<CreatePostLike>,
          Parameters<CreatePostLike>
        >(),
      },
      notificationOutbox: {
        create: jest.fn<
          ReturnType<CreateOutboxEvent>,
          Parameters<CreateOutboxEvent>
        >(),
      },
    };

    prisma = {
      $transaction: jest.fn<
        ReturnType<TransactionFn>,
        Parameters<TransactionFn>
      >(),
      post: {
        findUnique: jest.fn<
          ReturnType<FindPostLikesCount>,
          Parameters<FindPostLikesCount>
        >(),
      },
    };

    prisma.$transaction.mockImplementation(async (cb) => cb(tx));

    service = new InteractionsService(prisma as unknown as PrismaService);

    jest.clearAllMocks();
  });

  it('should create like, increment counter and enqueue outbox event (non-duplicated)', async () => {
    const postId = 'post_1';
    const userId = 'user_1';
    const authorId = 'author_1';

    tx.post.findUnique.mockResolvedValue({ id: postId, authorId });
    tx.postLike.create.mockResolvedValue({ id: 'like_1' });
    tx.post.update.mockResolvedValue({ likesCount: 1 });
    tx.notificationOutbox.create.mockResolvedValue({ id: 'outbox_1' });

    const result = await service.likePost(postId, userId);

    expect(result).toEqual({
      postId,
      userId,
      duplicated: false,
      likesCount: 1,
    });

    expect(tx.post.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.postLike.create).toHaveBeenCalledTimes(1);
    expect(tx.post.update).toHaveBeenCalledTimes(1);
    expect(tx.notificationOutbox.create).toHaveBeenCalledTimes(1);

    expect(tx.notificationOutbox.create).toHaveBeenCalledWith({
      data: {
        type: 'POST_LIKED',
        payload: {
          postId,
          actorUserId: userId,
          recipientUserId: authorId,
        },
      },
      select: { id: true },
    });
  });

  it('should be idempotent when like is duplicated (P2002)', async () => {
    const postId = 'post_1';
    const userId = 'user_1';
    const authorId = 'author_1';

    tx.post.findUnique.mockResolvedValue({ id: postId, authorId });
    tx.postLike.create.mockRejectedValue(p2002UniqueConstraintError());

    prisma.post.findUnique.mockResolvedValue({ likesCount: 7 });

    const result = await service.likePost(postId, userId);

    expect(result).toEqual({
      postId,
      userId,
      duplicated: true,
      likesCount: 7,
    });

    expect(tx.post.update).not.toHaveBeenCalled();
    expect(tx.notificationOutbox.create).not.toHaveBeenCalled();

    expect(prisma.post.findUnique).toHaveBeenCalledWith({
      where: { id: postId },
      select: { likesCount: true },
    });
  });

  it('should throw NotFoundException when post does not exist', async () => {
    tx.post.findUnique.mockResolvedValue(null);

    await expect(service.likePost('missing', 'user_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(tx.postLike.create).not.toHaveBeenCalled();
    expect(tx.post.update).not.toHaveBeenCalled();
    expect(tx.notificationOutbox.create).not.toHaveBeenCalled();
  });
});
