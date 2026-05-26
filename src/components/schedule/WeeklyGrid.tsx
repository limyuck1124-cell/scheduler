'use client';

import type { Appointment, Therapist, Room, TreatmentCode } from '@/types/database';

// ── 상수 ────────────────────────────────────────────────────
const SLOT_MIN   = 30;
const GRID_START = 8 * 60 + 30;  // 08:30
const GRID_END   = 17 * 60 + 30; // 17:30
const LUNCH_S    = 12 * 60 + 30; // 12:30
const LUNCH_E    = 13 * 60 + 30; // 13:30
const LUNCH_N    = (LUNCH_E - LUNCH_S) / SLOT_MIN; // 점심 슬롯 수 (2)
const AFTER_LUNCH_SLOTS = (GRID_END - LUNCH_E) / SLOT_MIN; // 토요일 오후 슬롯 수 (8)

const TIME_SLOTS: number[] = [];
for (let m = GRID_START; m < GRID_END; m += SLOT_MIN) TIME_SLOTS.push(m);

const DAY_KO = ['월', '화', '수', '목', '금', '토'];

function fmtTime(min: number) {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}
function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ── 타입 ────────────────────────────────────────────────────
export type AppointmentRow = Appointment & {
  patient:   { id: string; name: string } | null;
  therapist: { id: string; name: string } | null;
};

type CellData = { appt: AppointmentRow; rowspan: number } | 'skip' | null;

// ── 셀 맵 구축 ───────────────────────────────────────────────
function buildCellMap(appts: AppointmentRow[], weekDates: Date[]) {
  const map = new Map<string, CellData>();

  for (const appt of appts) {
    let dayIdx = appt.day_of_week != null
      ? appt.day_of_week - 1
      : weekDates.findIndex(d => d.toISOString().slice(0, 10) === appt.date);
    if (dayIdx < 0 || dayIdx > 5) continue;

    const startMin = toMin(appt.start_time);
    if (startMin >= LUNCH_S && startMin < LUNCH_E) continue; // 점심 중 예약 무시

    const slotIdx = TIME_SLOTS.indexOf(startMin);
    if (slotIdx === -1) continue;

    // 점심에 걸치면 잘라냄
    const endMin    = Math.min(startMin + appt.duration_min, LUNCH_S);
    const rowspan   = Math.max(1, Math.ceil((endMin - startMin) / SLOT_MIN));
    const key       = `${dayIdx}-${appt.therapist_id}-${slotIdx}`;

    if (!map.has(key)) {
      map.set(key, { appt, rowspan });
      for (let i = 1; i < rowspan; i++) {
        const sk = `${dayIdx}-${appt.therapist_id}-${slotIdx + i}`;
        if (!map.has(sk)) map.set(sk, 'skip');
      }
    }
  }
  return map;
}

// ── Props ────────────────────────────────────────────────────
interface Props {
  appointments:       AppointmentRow[];
  therapists:         (Therapist & { room: Room })[];
  treatmentCodes:     TreatmentCode[];
  rooms:              Room[];
  weekDates:          Date[];
  loading?:           boolean;
  onCellClick?:       (dayIdx: number, therapistId: string, slotMin: number) => void;
  onAppointmentClick?:(appt: AppointmentRow) => void;
}

// 치료실 색상
const ROOM_STYLE: Record<string, { day: string; room: string; th: string; cellBg: string }> = {
  '작업치료실': { day: '#047857', room: '#059669', th: '#a7f3d0', cellBg: '#f0fdf4' },
  '운동치료실': { day: '#0369a1', room: '#0284c7', th: '#bae6fd', cellBg: '#f0f9ff' },
};
const DEFAULT_STYLE = { day: '#6b7280', room: '#9ca3af', th: '#e5e7eb', cellBg: '#f9fafb' };

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function WeeklyGrid({
  appointments, therapists, treatmentCodes, rooms, weekDates, loading,
  onCellClick, onAppointmentClick,
}: Props) {
  const codeMap = Object.fromEntries(treatmentCodes.map(c => [c.code, c]));

  // 치료실 순서: 작업 → 운동
  const sortedRooms = [...rooms].sort(a =>
    a.name === '작업치료실' ? -1 : 1
  );

  // 치료사: 치료실 순 → 이름 순
  const sortedTherapists = sortedRooms.flatMap(room =>
    therapists
      .filter(t => t.room_id === room.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  );

  const totalCols  = sortedTherapists.length;
  const cellMap    = buildCellMap(appointments, weekDates);
  const today      = new Date().toDateString();

  // 헤더 높이
  const H1 = 32, H2 = 26, H3 = 30;
  const ROW_H = 38;
  const TIME_W = 52;
  const COL_W  = 84;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
        불러오는 중…
      </div>
    );
  }

  // 테이블 최소 너비: 시간열 + 5일 × 치료사수 × 컬럼너비
  const tableMinWidth = TIME_W + weekDates.length * Math.max(totalCols, 1) * COL_W;

  return (
    <div className="overflow-auto">
      <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11, minWidth: tableMinWidth }}>

        <thead>
          {/* ── 요일 헤더 ── */}
          <tr>
            <th
              rowSpan={3}
              style={{
                position: 'sticky', top: 0, left: 0, zIndex: 40,
                background: '#f3f4f6', border: '1px solid #d1d5db',
                textAlign: 'center', fontWeight: 700, color: '#374151',
                width: TIME_W, minWidth: TIME_W,
                height: H1 + H2 + H3,
              }}
            >
              시간
            </th>
            {weekDates.map((date, i) => {
              const isToday = date.toDateString() === today;
              const bg = isToday ? '#b45309' : '#d97706';
              return (
                <th
                  key={i}
                  colSpan={totalCols}
                  style={{
                    position: 'sticky', top: 0, zIndex: 30,
                    background: bg, border: '1px solid #92400e',
                    textAlign: 'center', fontWeight: 700, color: 'white',
                    height: H1,
                  }}
                >
                  {DAY_KO[i]}&nbsp;({date.getMonth() + 1}/{date.getDate()})
                </th>
              );
            })}
          </tr>

          {/* ── 치료실 헤더 ── */}
          <tr>
            {weekDates.flatMap((_, di) =>
              sortedRooms.map(room => {
                const tCnt  = sortedTherapists.filter(t => t.room_id === room.id).length;
                const style = ROOM_STYLE[room.name] ?? DEFAULT_STYLE;
                return (
                  <th
                    key={`${di}-${room.id}`}
                    colSpan={tCnt}
                    style={{
                      position: 'sticky', top: H1, zIndex: 30,
                      background: style.room, border: '1px solid rgba(0,0,0,.15)',
                      textAlign: 'center', fontWeight: 600, color: 'white',
                      height: H2,
                    }}
                  >
                    {room.name}
                  </th>
                );
              })
            )}
          </tr>

          {/* ── 치료사 헤더 ── */}
          <tr>
            {weekDates.flatMap((_, di) =>
              sortedTherapists.map(t => {
                const style = ROOM_STYLE[t.room?.name ?? ''] ?? DEFAULT_STYLE;
                return (
                  <th
                    key={`${di}-${t.id}`}
                    style={{
                      position: 'sticky', top: H1 + H2, zIndex: 30,
                      background: style.th, border: '1px solid rgba(0,0,0,.1)',
                      textAlign: 'center', fontWeight: 600, color: '#1f2937',
                      width: COL_W, minWidth: COL_W,
                      height: H3,
                    }}
                  >
                    {t.name}
                  </th>
                );
              })
            )}
          </tr>
        </thead>

        <tbody>
          {TIME_SLOTS.map((slotMin, si) => {
            const isLunch      = slotMin >= LUNCH_S && slotMin < LUNCH_E;
            const isLunchStart = slotMin === LUNCH_S;
            const isHour       = slotMin % 60 === 0;

            // 점심 두 번째 슬롯은 rowspan 으로 커버됨 → 빈 행만
            if (isLunch && !isLunchStart) return <tr key={si} />;

            return (
              <tr key={si}>
                {/* 시간 레이블 */}
                <td
                  rowSpan={isLunchStart ? LUNCH_N : 1}
                  style={{
                    position: 'sticky', left: 0, zIndex: 10,
                    background: isLunch ? '#f3f4f6' : (isHour ? '#f8fafc' : 'white'),
                    border: '1px solid #e5e7eb',
                    borderTop: isHour ? '1px solid #9ca3af' : '1px solid #e5e7eb',
                    textAlign: 'center', color: '#6b7280', fontWeight: 500,
                    height: isLunchStart ? ROW_H * LUNCH_N : ROW_H,
                    verticalAlign: 'middle',
                  }}
                >
                  {fmtTime(slotMin)}
                </td>

                {/* 점심 셀 */}
                {isLunchStart && weekDates.map((date, di) => {
                  const isToday = date.toDateString() === today;
                  return (
                    <td
                      key={di}
                      colSpan={totalCols}
                      rowSpan={LUNCH_N}
                      style={{
                        background: isToday ? '#fef9c3' : '#f3f4f6',
                        border: '1px solid #d1d5db',
                        textAlign: 'center', fontWeight: 600,
                        color: '#9ca3af', letterSpacing: '0.1em',
                        verticalAlign: 'middle',
                        height: ROW_H * LUNCH_N,
                      }}
                    >
                      점심시간
                    </td>
                  );
                })}

                {/* 일반 예약 셀 */}
                {!isLunch && weekDates.flatMap((date, di) => {
                  const isToday = date.toDateString() === today;
                  const isSat   = di === weekDates.length - 1;
                  const isSatPm = isSat && slotMin >= LUNCH_E;

                  // 토요일 오후: 첫 슬롯에서 전체 병합, 나머지 스킵
                  if (isSatPm) {
                    if (slotMin === LUNCH_E) {
                      return [
                        <td
                          key="sat-pm"
                          colSpan={totalCols}
                          rowSpan={AFTER_LUNCH_SLOTS}
                          style={{
                            background: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            textAlign: 'center',
                            fontWeight: 600,
                            color: '#d1d5db',
                            letterSpacing: '0.12em',
                            verticalAlign: 'middle',
                            height: ROW_H * AFTER_LUNCH_SLOTS,
                            fontSize: 11,
                          }}
                        >
                          오전 근무
                        </td>,
                      ];
                    }
                    return [];
                  }

                  return sortedTherapists.map(t => {
                    const key  = `${di}-${t.id}-${si}`;
                    const cell = cellMap.get(key) ?? null;
                    if (cell === 'skip') return null;

                    const todayBg = isToday ? '#fefce8' : 'white';
                    const hourBorderTop = isHour ? '1px solid #d1d5db' : '1px solid #f3f4f6';

                    if (!cell) {
                      return (
                        <td
                          key={key}
                          onClick={() => onCellClick?.(di, t.id, slotMin)}
                          style={{
                            background: todayBg,
                            border: '1px solid #f3f4f6',
                            borderTop: hourBorderTop,
                            height: ROW_H,
                            cursor: onCellClick ? 'cell' : 'default',
                          }}
                        />
                      );
                    }

                    const { appt, rowspan } = cell;
                    const code   = appt.treatment_code ? codeMap[appt.treatment_code] : null;
                    const isBlock = appt.block_type !== '환자치료';
                    const name   = appt.patient?.name ?? appt.block_type;

                    // 셀 배경: 처방코드 색을 진하게 (50%), 블록은 주황
                    let bg = '#e0f2fe'; // 운동치료실 기본
                    let borderColor = '#7dd3fc';
                    if (code) {
                      bg = `#${code.color_hex}60`;
                      borderColor = `#${code.color_hex}`;
                    } else if (isBlock) {
                      bg = '#fef3c7';
                      borderColor = '#f59e0b';
                    } else if (t.room?.name === '작업치료실') {
                      bg = '#dcfce7';
                      borderColor = '#86efac';
                    }

                    // 처방코드 뱃지 텍스트 색상 (배경이 밝으면 어둡게)
                    const badgeBg = code ? `#${code.color_hex}` : (isBlock ? '#f59e0b' : null);

                    return (
                      <td
                        key={key}
                        rowSpan={rowspan}
                        title={`${name}  ${appt.start_time} (${appt.duration_min}분)`}
                        onClick={() => onAppointmentClick?.(appt)}
                        style={{
                          background: bg,
                          border: `1px solid ${borderColor}`,
                          borderTop: isHour ? `1px solid ${borderColor}` : `1px solid ${borderColor}88`,
                          padding: '2px 4px',
                          verticalAlign: 'top',
                          height: ROW_H * rowspan,
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          height: '100%',
                        }}>
                          {/* 환자/블록 이름 */}
                          <div style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: '#1e293b',
                            lineHeight: 1.25,
                            overflow: 'hidden',
                            wordBreak: 'keep-all',
                            textAlign: 'center',
                          }}>
                            {name}
                          </div>
                          {/* 처방코드 뱃지 */}
                          {badgeBg && (
                            <div style={{
                              background: badgeBg,
                              color: '#1e293b',
                              padding: '0px 5px',
                              borderRadius: 3,
                              fontSize: 12,
                              fontWeight: 800,
                              letterSpacing: '0.03em',
                              lineHeight: '18px',
                            }}>
                              {code ? appt.treatment_code : appt.block_type}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  });
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
