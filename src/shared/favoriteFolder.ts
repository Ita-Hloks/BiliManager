export type FavoriteVideo = {
  id: string;
  bvid: string;
  link: string;
  title: string;
  coverUrl: string;
  uploader: string;
};

export type FavoriteFolderResult = {
  folderId: string;
  videos: FavoriteVideo[];
};
