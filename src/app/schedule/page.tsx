'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import WeeklyGrid, { type AppointmentRow } from '@/components/schedule/WeeklyGrid';
import type { Room, TreatmentCode } from '@/types/database';

// ── 날짜 유틸 ────────────────────────────────────────────────
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=일 … 6=토
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function SchedulePage() {
  const router = useRouter();

  const [userEmail,       setUserEmail]       = useState<string>('');
  const [rooms,           setRooms]           = useState<Room[]>([]);
  const [selectedRoomId,  setSelectedRoomId]  = useState<string>('');
  const [appointments,    setAppointments]    = useState<AppointmentRow[]>([]);
  const [treatmentCodes,  setTreatmentCodes]  = useState<TreatmentCode[]>([]);
  const [weekStart,       setWeekStart]       = useState<Date>(() => getMondayOfWeek(new Date()));
  const [initLoading,     setInitLoading]     = useState(true);
  const [apptLoading,     setApptLoading]     = useState(false);
  const [loggingOut,      setLoggingOut]      = useState(false);

  // 주간 날짜 배열 [월 ~ 금]
  const weekDates = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  // ── 초기 데이터 로드 (인증 확인 + 기준정보) ──
  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setUserEmail(user.email ?? '');

      const [roomsRes, codesRes] = await Promise.all([
        supabase.from('rooms').select('*').order('name'),
        supabase.from('treatment_codes').select('*'),
      ]);

      const roomList = (roomsRes.data ?? []) as Room[];
      setRooms(roomList);
      setTreatmentCodes((codesRes.data ?? []) as TreatmentCode[]);

      if (roomList.length > 0) setSelectedRoomId(roomList[0].id);
      setInitLoading(false);
    })();
  }, [router]);

  // ── 예약 로드 (치료실 변경 시) ──
  const loadAppointments = useCallback(async (roomId: string) => {
    if (!roomId) return;
    setApptLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:patients ( id, name ),
        therapist:therapists ( id, name )
      `)
      .eq('room_id', roomId)
      .order('start_time');

    if (!error) setAppointments((data ?? []) as AppointmentRow[]);
    setApptLoading(false);
  }, []);

  useEffect(() => {
    loadAppointments(selectedRoomId);
  }, [selectedRoomId, loadAppointments]);

  // ── 로그아웃 ──
  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  };

  // ── 주 이동 ──
  const prevWeek  = () => setWeekStart(d => addDays(d, -7));
  const nextWeek  = () => setWeekStart(d => addDays(d, +7));
  const goToToday = () => setWeekStart(getMondayOfWeek(new Date()));

  const isCurrentWeek =
    getMondayOfWeek(new Date()).toDateString() === weekStart.toDateString();

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  // ── 초기 로딩 ──
  if (initLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">불러오는 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── 헤더 ── */}
      <header className="bg-blue-700 text-white shadow-md shrink-0">
        <div className="max-w-full px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold leading-tight">🏥 재활치료실 통합 스케줄러</h1>
            <p className="text-blue-300 text-xs mt-0.5">작업치료실 · 운동치료실</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-blue-200 hidden sm:block">{userEmail}</span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs border border-blue-400 text-blue-100 px-3 py-1.5 rounded hover:bg-blue-600 hover:border-blue-500 transition-colors disabled:opacity-50"
            >
              {loggingOut ? '…' : '로그아웃'}
            </button>
          </div>
        </div>
      </header>

      {/* ── 치료실 탭 ── */}
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="flex px-2">
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                selectedRoomId === room.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {room.name === '작업치료실' ? '🖐 작업치료실' : '🏃 운동치료실'}
            </button>
          ))}
        </div>
      </div>

      {/* ── 주 네비게이션 ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 shrink-0">
        <button
          onClick={prevWeek}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="이전 주"
        >
          ‹
        </button>
        <button
          onClick={nextWeek}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="다음 주"
        >
          ›
        </button>
        <button
          onClick={goToToday}
          disabled={isCurrentWeek}
          className={`text-xs px-2.5 py-1 border rounded transition-colors ${
            isCurrentWeek
              ? 'border-gray-200 text-gray-300 cursor-default'
              : 'border-blue-300 text-blue-600 hover:bg-blue-50'
          }`}
        >
          오늘
        </button>
        <span className="text-sm font-medium text-gray-700 ml-1">
          {fmtDate(weekDates[0])} — {fmtDate(weekDates[4])}
        </span>
        {selectedRoom && (
          <span className="ml-auto text-xs text-gray-400 hidden sm:block">
            {selectedRoom.name}
          </span>
        )}
      </div>

      {/* ── 그리드 영역 (스크롤) ── */}
      <div className="flex-1 overflow-auto">
        <WeeklyGrid
          appointments={appointments}
          treatmentCodes={treatmentCodes}
          weekDates={weekDates}
          loading={apptLoading}
        />
      </div>
    </div>
  );
}
