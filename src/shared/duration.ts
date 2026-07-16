type DurationParts = {
  hours: number;
  minutes: number;
  seconds: number;
};

export function formatClockDuration(ms: number): string {
  const { hours, minutes, seconds } = getDurationParts(ms);
  const minuteSecond = `${padTime(minutes)}:${padTime(seconds)}`;
  return hours > 0 ? `${hours}:${minuteSecond}` : minuteSecond;
}

export function formatCompactDuration(ms: number): string {
  const { hours, minutes, seconds } = getDurationParts(ms);
  if (hours > 0) return `${hours}h${padTime(minutes)}m${padTime(seconds)}s`;
  if (minutes > 0) return `${minutes}m${padTime(seconds)}s`;
  return `${seconds}s`;
}

export function formatReadableDuration(ms: number): string {
  const { hours, minutes, seconds } = getDurationParts(ms);
  if (hours > 0) return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
  if (minutes > 0) return `${minutes} 分钟`;
  return `${seconds} 秒`;
}

function getDurationParts(ms: number): DurationParts {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function padTime(value: number): string {
  return value.toString().padStart(2, "0");
}
