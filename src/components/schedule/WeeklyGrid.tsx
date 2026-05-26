'use client';

import type { Appointment, TreatmentCode } from '@/types/database';

// ── 그리드 상수 ─────────────────────────────────────────────
const SLOT_HEIGHT = 52;          // px / 30분 슬롯
const GRID_START  = 8 * 60 + 30; // 8:30 (분 단위)
const GRID_END    = 18 * 60;     // 18:00
const NUM_SLOTS   = (GRID_END - GRID_START) / 30; // 19슬롯

const DAY_KO = ['월', '화', '수', '목', '금'];

// 시간 레이블 생성 (8:30, 9:00 … 18:00)
const TIME_LABELS = Array.from({ length: NUM_SLOTS + 1 }, (_, i) => {
  const total = GRID_START + i * 30;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
});

// 블록 타입별 기본 색상 (처방코드 없는 경우)
const BLOCK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  '환자치료': { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  '병동블록': { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  '경과기록': { bg: '#ede9fe', border: '#8b5cf6', text: '#4c1d95' },
  '평가':     { bg: '#d1fae5', border: '#10b981', text: '#064e3b' },
};

// ── 타입 ────────────────────────────────────────────────────
export type AppointmentRow = Appointment & {
  patient: { id: string; name: string } | null;
  therapist: { id: string; name: string } | null;
};

interface LayoutItem {
  appt: AppointmentRow;
  col: number;
  numCols: number;
}

// ── 겹침 레이아웃 계산 ───────────────────────────────────────
function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function computeLayout(appts: AppointmentRow[]): LayoutItem[] {
  if (!appts.length) return [];

  const sorted = [...appts].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time));
  const colEnds: number[] = [];
  const assigned: { appt: AppointmentRow; col: number }[] = [];

  for (const appt of sorted) {
    const start = timeToMin(appt.start_time);
    const end   = start + appt.duration_min;
    let col = colEnds.findIndex(e => e <= start);
    if (col === -1) { col = colEnds.length; colEnds.push(end); }
    else             { colEnds[col] = end; }
    assigned.push({ appt, col });
  }

  const numCols = colEnds.length;
  return assigned.map(a => ({ ...a, numCols }));
}

// ── WeeklyGrid 컴포넌트 ──────────────────────────────────────
interface Props {
  appointments: AppointmentRow[];
  treatmentCodes: TreatmentCode[];
  weekDates: Date[];   // [월, 화, 수, 목, 금]
  loading?: boolean;
}

export default function WeeklyGrid({ appointments, treatmentCodes, weekDates, loading }: Props) {
  const codeMap = Object.fromEntries(treatmentCodes.map(c => [c.code, c]));
  const gridHeight = NUM_SLOTS * SLOT_HEIGHT;
  const today = new Date().toDateString();

  return (
    <div className="flex flex-col min-w-[700px]">
      {/* ── 날짜 헤더 (sticky) ── */}
      <div className="flex bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="w-16 shrink-0 border-r border-gray-100" />
        {weekDates.map((date, i) => {
          const isToday = date.toDateString() === today;
          return (
            <div key={i} className="flex-1 text-center py-2 border-r border-gray-100 last:border-r-0">
              <div className={`text-xs font-medium mb-0.5 ${isToday ? 'text-blue-500' : 'text-gray-400'}`}>
                {DAY_KO[i]}
              </div>
              <div className="flex items-center justify-center">
                <span
                  className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 그리드 본체 ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20 text-gray-400 text-sm">
          불러오는 중…
        </div>
      ) : (
        <div className="flex">
          {/* 시간 레이블 */}
          <div className="w-16 shrink-0 relative border-r border-gray-100" style={{ height: gridHeight }}>
            {TIME_LABELS.map((label, i) => (
              <div
                key={i}
                className="absolute right-2 text-[10px] text-gray-400 select-none"
                style={{ top: i * SLOT_HEIGHT - 7 }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* 요일 컬럼들 */}
          {weekDates.map((date, dayIdx) => {
            const dow     = dayIdx + 1; // 1=월 … 5=금
            const dateStr = date.toISOString().split('T')[0];
            const isToday = date.toDateString() === today;

            const dayAppts = appointments.filter(
              a => a.day_of_week === dow || a.date === dateStr
            );
            const layout = computeLayout(dayAppts);

            return (
              <div
                key={dayIdx}
                className={`flex-1 relative border-r border-gray-100 last:border-r-0 ${
                  isToday ? 'bg-blue-50/30' : 'bg-white'
                }`}
                style={{ height: gridHeight }}
              >
                {/* 그리드 라인 */}
                {Array.from({ length: NUM_SLOTS }, (_, i) => (
                  <div
                    key={i}
                    className={`absolute inset-x-0 border-t ${
                      i % 2 === 0 ? 'border-gray-100' : 'border-gray-50'
                    }`}
                    style={{ top: i * SLOT_HEIGHT }}
                  />
                ))}
                {/* 정시 강조선 */}
                {Array.from({ length: NUM_SLOTS }, (_, i) => (
                  i % 2 === 0 && (
                    <div
                      key={`hour-${i}`}
                      className="absolute inset-x-0 border-t border-gray-200"
                      style={{ top: i * SLOT_HEIGHT }}
                    />
                  )
                ))}

                {/* 예약 블록들 */}
                {layout.map(({ appt, col, numCols }) => {
                  const startMin = timeToMin(appt.start_time);
                  const top      = ((startMin - GRID_START) / 30) * SLOT_HEIGHT;
                  const height   = Math.max((appt.duration_min / 30) * SLOT_HEIGHT - 2, 20);
                  const widthPct = 100 / numCols;
                  const leftPct  = (col / numCols) * 100;

                  // 색상 결정
                  let bgColor     = BLOCK_COLORS['환자치료'].bg;
                  let borderColor = BLOCK_COLORS['환자치료'].border;
                  let textColor   = BLOCK_COLORS['환자치료'].text;

                  if (appt.treatment_code && codeMap[appt.treatment_code]) {
                    const hex = codeMap[appt.treatment_code].color_hex;
                    bgColor     = `#${hex}55`;
                    borderColor = `#${hex}`;
                    textColor   = '#374151';
                  } else if (BLOCK_COLORS[appt.block_type]) {
                    bgColor     = BLOCK_COLORS[appt.block_type].bg;
                    borderColor = BLOCK_COLORS[appt.block_type].border;
                    textColor   = BLOCK_COLORS[appt.block_type].text;
                  }

                  const isSmall = height < 40;

                  return (
                    <div
                      key={appt.id}
                      title={`${appt.patient?.name ?? appt.block_type} — ${appt.therapist?.name ?? ''} (${appt.start_time}, ${appt.duration_min}분)`}
                      className="absolute rounded overflow-hidden cursor-pointer transition-all hover:brightness-95 hover:shadow-md"
                      style={{
                        top: top + 1,
                        height,
                        left:  `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: bgColor,
                        borderLeft: `3px solid ${borderColor}`,
                        zIndex: 2,
                      }}
                    >
                      <div className="px-1.5 py-0.5 h-full flex flex-col justify-start overflow-hidden">
                        {/* 처방코드 뱃지 */}
                        {appt.treatment_code && codeMap[appt.treatment_code] && !isSmall && (
                          <span
                            className="inline-block text-[9px] font-bold px-1 rounded mb-0.5 self-start leading-tight"
                            style={{ backgroundColor: borderColor, color: 'white' }}
                          >
                            {appt.treatment_code}
                          </span>
                        )}
                        {/* 환자/블록명 */}
                        <span
                          className="text-[11px] font-semibold leading-tight truncate"
                          style={{ color: textColor }}
                        >
                          {appt.patient?.name ?? appt.block_type}
                        </span>
                        {/* 치료사 이름 */}
                        {!isSmall && appt.therapist?.name && (
                          <span className="text-[10px] text-gray-500 truncate leading-tight">
                            {appt.therapist.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* 예약 없는 날 안내 (비어있는 경우) */}
                {dayAppts.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-gray-200 select-none">—</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
