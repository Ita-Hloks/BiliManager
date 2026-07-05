import type { DurationPoint, HitRatePoint, RecentVideo, StatsPeriod } from "./types";

// Popup 里的统计和最近播放目前只做视觉 demo，不能在这里接真实存储或后台接口。
export const PERIOD_LABEL: Record<StatsPeriod, string> = {
  "7d": "近7天",
  month: "本月",
  year: "本年",
};

export const DURATION_DATA: Record<StatsPeriod, DurationPoint[]> = {
  "7d": [
    { label: "一", minutes: 42 },
    { label: "二", minutes: 65 },
    { label: "三", minutes: 38 },
    { label: "四", minutes: 90 },
    { label: "五", minutes: 54 },
    { label: "六", minutes: 120 },
    { label: "日", minutes: 78 },
  ],
  month: [
    { label: "1周", minutes: 320 },
    { label: "2周", minutes: 410 },
    { label: "3周", minutes: 275 },
    { label: "4周", minutes: 390 },
  ],
  year: [
    { label: "1月", minutes: 620 },
    { label: "2月", minutes: 540 },
    { label: "3月", minutes: 780 },
    { label: "4月", minutes: 910 },
    { label: "5月", minutes: 860 },
    { label: "6月", minutes: 1040 },
    { label: "7月", minutes: 700 },
    { label: "8月", minutes: 660 },
    { label: "9月", minutes: 880 },
    { label: "10月", minutes: 950 },
    { label: "11月", minutes: 1120 },
    { label: "12月", minutes: 1005 },
  ],
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
