import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 시간 문자열(HH:MM)을 분으로 변환 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 분을 시간 문자열(HH:MM)로 변환 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 종료 시각 계산 */
export function getEndTime(startTime: string, durationMin: number): string {
  return minutesToTime(timeToMinutes(startTime) + durationMin);
}

/** 두 예약이 시간적으로 겹치는지 확인 */
export function hasTimeOverlap(
  start1: string, duration1: number,
  start2: string, duration2: number
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = s1 + duration1;
  const s2 = timeToMinutes(start2);
  const e2 = s2 + duration2;
  return s1 < e2 && s2 < e1;
}

/** 점심시간(12:30~13:30)과 겹치는지 확인 */
export function isLunchTimeConflict(startTime: string, durationMin: number): boolean {
  const LUNCH_START = 12 * 60 + 30; // 12:30
  const LUNCH_END   = 13 * 60 + 30; // 13:30
  const s = timeToMinutes(startTime);
  const e = s + durationMin;
  return s < LUNCH_END && e > LUNCH_START;
}

/** 요일 숫자 → 한국어 */
export const DAY_NAMES: Record<number, string> = {
  1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 7: '일',
};

/** 그리드 시간 슬롯 생성 (08:30 ~ 17:00, 30분 단위) */
export function getTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 17; h++) {
    for (const m of [0, 30]) {
      if (h === 8 && m === 0) continue; // 08:00 제외, 08:30부터
      if (h === 17 && m === 30) break;  // 17:30 제외, 17:00까지
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}
