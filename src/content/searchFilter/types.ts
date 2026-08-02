export type SearchCard = {
  cardEl: HTMLElement;
  titleEl: HTMLElement;
  uploaderEl: HTMLElement | null;
  title: string;
  videoUrl: string;
  uploader: string;
  uploaderMid: string;
  dateEl: HTMLElement | null;
  tags: string[];
  viewCount: number | null;
  danmakuCount: number | null;
  thumbnailEl: HTMLElement;
  metadataEls: HTMLElement[];
  previewEls: HTMLElement[];
};

export type FilterResult = {
  reasons: string[];
  lowInteractionRate: number | null;
};
