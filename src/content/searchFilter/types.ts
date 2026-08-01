export type SearchCard = {
  cardEl: HTMLElement;
  titleEl: HTMLElement | null;
  uploaderEl: HTMLElement | null;
  title: string;
  videoUrl: string;
  uploader: string;
  uploaderMid: string;
  viewCount: number | null;
  danmakuCount: number | null;
  thumbnailEl: HTMLElement | null;
  metadataEls: HTMLElement[];
  previewEls: HTMLElement[];
};

export type FilterResult = {
  reasons: string[];
  regexErrors: string[];
  lowInteractionRate: number | null;
};
