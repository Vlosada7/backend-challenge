export type LikePostResponseDto = {
  postId: string;
  userId: string;
  duplicated: boolean;
  likesCount: number;
};
