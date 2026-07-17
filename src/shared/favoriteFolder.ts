export type FavoriteVideo = {
  id: string;
  bvid: string;
  title: string;
  coverUrl: string;
  uploader: string;
};

export type FavoriteFolderResult = {
  folderId: string;
  videos: FavoriteVideo[];
};
