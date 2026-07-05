import type { HitRatePoint, RecentVideo, StatsPeriod } from "./types";

export const PERIOD_LABEL: Record<StatsPeriod, string> = {
  "7d": "近7天",
  month: "本月",
  year: "本年",
};

export const HIT_RATE_DATA: Record<StatsPeriod, HitRatePoint[]> = {
  "7d": [
    { label: "一", rate: 52 },
    { label: "二", rate: 61 },
    { label: "三", rate: 48 },
    { label: "四", rate: 73 },
    { label: "五", rate: 66 },
    { label: "六", rate: 80 },
    { label: "日", rate: 69 },
  ],
  month: [
    { label: "1周", rate: 58 },
    { label: "2周", rate: 64 },
    { label: "3周", rate: 55 },
    { label: "4周", rate: 71 },
  ],
  year: [
    { label: "1月", rate: 45 },
    { label: "2月", rate: 50 },
    { label: "3月", rate: 58 },
    { label: "4月", rate: 62 },
    { label: "5月", rate: 60 },
    { label: "6月", rate: 68 },
    { label: "7月", rate: 55 },
    { label: "8月", rate: 59 },
    { label: "9月", rate: 66 },
    { label: "10月", rate: 70 },
    { label: "11月", rate: 74 },
    { label: "12月", rate: 71 },
  ],
};

export const RECENT_VIDEOS: RecentVideo[] = [
  {
    id: "1",
    title: "我是标题！",
    matched: true,
    keyword: "标题",
  },
  {
    id: "2",
    title: "好，那么坏",
    matched: false,
  },
  {
    id: "3",
    title: "你说的对，但是BiliManger是一款基于 Manifest V3 的浏览器扩展",
    matched: true,
    keyword: "你说的对",
  },
];
