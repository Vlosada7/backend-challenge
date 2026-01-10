import { NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostResponseDto } from './dto/post-response.dto';

type PostDb = {
  id: string;
  content: string;
  authorId: string;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  sharesCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type CreatePost = (args: {
  data: { content: string; authorId: string };
}) => Promise<PostDb>;

type GetAllPosts = (args: {
  orderBy: { createdAt: 'desc' };
}) => Promise<PostDb[]>;

type FindById = (args: { where: { id: string } }) => Promise<PostDb | null>;

type PrismaServiceMock = {
  post: {
    create: jest.MockedFunction<CreatePost>;
    findMany: jest.MockedFunction<GetAllPosts>;
    findUnique: jest.MockedFunction<FindById>;
  };
};

describe('PostsService', () => {
  let service: PostsService;
  let prisma: PrismaServiceMock;

  beforeEach(() => {
    prisma = {
      post: {
        create: jest.fn<ReturnType<CreatePost>, Parameters<CreatePost>>(),
        findMany: jest.fn<ReturnType<GetAllPosts>, Parameters<GetAllPosts>>(),
        findUnique: jest.fn<ReturnType<FindById>, Parameters<FindById>>(),
      },
    };

    service = new PostsService(prisma as unknown as PrismaService);

    jest.clearAllMocks();
  });

  it('create() should create a post and return PostResponseDto (dates as ISO strings)', async () => {
    const dto: CreatePostDto = { content: 'Hello Debook!' };
    const authorId = 'author_1';

    const createdAt = new Date('2026-01-10T10:00:00.000Z');
    const updatedAt = new Date('2026-01-10T10:00:00.000Z');

    const dbPost: PostDb = {
      id: 'post_1',
      content: dto.content,
      authorId,
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      sharesCount: 0,
      createdAt,
      updatedAt,
    };

    prisma.post.create.mockResolvedValue(dbPost);

    const result = await service.create(dto, authorId);

    expect(prisma.post.create).toHaveBeenCalledTimes(1);
    expect(prisma.post.create).toHaveBeenCalledWith({
      data: { content: dto.content, authorId },
    });

    expect(result).toEqual<PostResponseDto>({
      id: 'post_1',
      content: dto.content,
      authorId,
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      sharesCount: 0,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('getAll() should fetch posts ordered by createdAt desc and map to PostResponseDto[]', async () => {
    const t1 = new Date('2026-01-10T10:00:00.000Z');
    const t2 = new Date('2026-01-10T11:00:00.000Z');

    const dbPosts: PostDb[] = [
      {
        id: 'post_new',
        content: 'new',
        authorId: 'a2',
        likesCount: 2,
        commentsCount: 3,
        viewsCount: 4,
        sharesCount: 5,
        createdAt: t2,
        updatedAt: t2,
      },
      {
        id: 'post_old',
        content: 'old',
        authorId: 'a1',
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        sharesCount: 0,
        createdAt: t1,
        updatedAt: t1,
      },
    ];

    prisma.post.findMany.mockResolvedValue(dbPosts);

    const result = await service.getAll();

    expect(prisma.post.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.post.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });

    expect(result).toEqual<PostResponseDto[]>([
      {
        id: 'post_new',
        content: 'new',
        authorId: 'a2',
        likesCount: 2,
        commentsCount: 3,
        viewsCount: 4,
        sharesCount: 5,
        createdAt: t2.toISOString(),
        updatedAt: t2.toISOString(),
      },
      {
        id: 'post_old',
        content: 'old',
        authorId: 'a1',
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        sharesCount: 0,
        createdAt: t1.toISOString(),
        updatedAt: t1.toISOString(),
      },
    ]);
  });

  it('findById() should return a mapped PostResponseDto when post exists', async () => {
    const id = 'post_1';
    const createdAt = new Date('2026-01-10T10:00:00.000Z');
    const updatedAt = new Date('2026-01-10T10:05:00.000Z');

    const dbPost: PostDb = {
      id,
      content: 'hello',
      authorId: 'author_1',
      likesCount: 1,
      commentsCount: 2,
      viewsCount: 3,
      sharesCount: 4,
      createdAt,
      updatedAt,
    };

    prisma.post.findUnique.mockResolvedValue(dbPost);

    const result = await service.findById(id);

    expect(prisma.post.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.post.findUnique).toHaveBeenCalledWith({
      where: { id },
    });

    expect(result).toEqual<PostResponseDto>({
      id,
      content: 'hello',
      authorId: 'author_1',
      likesCount: 1,
      commentsCount: 2,
      viewsCount: 3,
      sharesCount: 4,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('findById() should throw NotFoundException when post does not exist', async () => {
    prisma.post.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.post.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.post.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing' },
    });
  });
});
