export type SearchCard = {
  cardEl: HTMLElement;
  layoutEl: HTMLElement;
  titleEl: HTMLElement;
  uploaderEl: HTMLElement | null;
  title: string;
  videoUrl: string;
  uploader: string;
  uploaderMid: string;
  uploaderMatchesSearchKeyword: boolean;
  isUploaderVideoRecommendation: boolean;
  isCourse: boolean;
  dateEl: HTMLElement | null;
  viewCount: number | null;
  danmakuCount: number | null;
  thumbnailEl: HTMLElement;
  metadataEls: HTMLElement[];
  previewEls: HTMLElement[];
};

export type FilterResult = {
  reasons: string[];
  lowViewCountReason: string | null;
  lowInteractionRate: number | null;
};
