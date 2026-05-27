'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Appointment, Therapist, Room, TreatmentCode, Patient, BlockType, PatientType } from '@/types/database';
import type { AppointmentRow } from './WeeklyGrid';

// ── 상수 ────────────────────────────────────────────────────
const DAY_KO: Record<number, string> = { 1:'월', 2:'화', 3:'수', 4:'목', 5:'금', 6:'토' };
const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90];
const BLOCK_TYPES: Exclude<BlockType, '환자치료'>[] = ['병동블록', '경과기록', '평가'];

const LUNCH_S_MIN = 12 * 60 + 30; // 12:30
const LUNCH_E_MIN = 13 * 60 + 30; // 13:30

const TIME_SLOTS: string[] = [];
for (let h = 8; h <= 17; h++) {
  for (const m of [0, 30]) {
    if (h === 8 && m === 0) continue;
    if (h === 17 && m === 30) continue;
    const min = h * 60 + m;
    if (min >= LUNCH_S_MIN && min < LUNCH_E_MIN) continue;
    TIME_SLOTS.push(`${h}:${String(m).padStart(2, '0')}`);
  }
}

const SAT_TIME_SLOTS = TIME_SLOTS.filter(t => {
  const [hh, mm] = t.split(':').map(Number);
  return hh * 60 + mm < LUNCH_S_MIN;
});

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fmtTime(min: number) {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

// ── 타입 ────────────────────────────────────────────────────
type TherapistFull = Therapist & { room: Room };

export type ModalInitData =
  | { mode: 'create'; dayIdx: number; therapistId: string; slotMin: number }
  | { mode: 'edit';   appointment: AppointmentRow };

interface Props {
  initData:       ModalInitData;
  therapists:     TherapistFull[];
  treatmentCodes: TreatmentCode[];
  weekDates:      Date[];
  onSaved:        () => void;
  onClose:        () => void;
}

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function AppointmentModal({
  initData, therapists, treatmentCodes, weekDates, onSaved, onClose,
}: Props) {
  const isEdit = initData.mode === 'edit';
  const appt   = isEdit ? initData.appointment : null;

  const therapistId = isEdit ? appt!.therapist_id : initData.therapistId;
  const therapist   = therapists.find(t => t.id === therapistId);
  const isJeob      = therapist?.room?.name === '작업치료실';

  // ── 폼 상태 ────────────────────────────────────────────────
  const [isBlock,      setIsBlock]      = useState(isEdit ? appt!.block_type !== '환자치료' : false);
  const [blockType,    setBlockType]    = useState<Exclude<BlockType, '환자치료'>>(
    isEdit && appt!.block_type !== '환자치료' ? appt!.block_type as Exclude<BlockType, '환자치료'> : '병동블록'
  );
  const [patientSearch, setPatientSearch] = useState('');
  const [patients,      setPatients]      = useState<Patient[]>([]);
  const [selectedPt,    setSelectedPt]    = useState<Patient | null>(null);
  const [patientType,   setPatientType]   = useState<PatientType>(
    isEdit && appt!.patient_type ? appt!.patient_type as PatientType : '병동'
  );
  const [dayOfWeek,   setDayOfWeek]   = useState<number>(
    isEdit ? (appt!.day_of_week ?? 6) : (initData.dayIdx + 1)
  );
  const [startTime,   setStartTime]   = useState<string>(
    isEdit ? appt!.start_time.slice(0, 5) : fmtTime(initData.slotMin)
  );
  const [durationMin, setDurationMin] = useState<number>(isEdit ? appt!.duration_min : 30);
  const [treatmentCode, setTreatmentCode] = useState<string>(
    isEdit && appt!.treatment_code ? appt!.treatment_code : ''
  );
  const [note,       setNote]       = useState<string>(isEdit ? (appt!.note ?? '') : '');
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [searching,  setSearching]  = useState(false);
  const [creatingPt, setCreatingPt] = useState(false);

  // 빈 슬롯 추천
  const [freeSlots, setFreeSlots] = useState<string[]>([]);

  // 반복 예약 (create 모드 전용)
  const [multiDay,     setMultiDay]     = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([dayOfWeek]);

  const searchRef = useRef<HTMLInputElement>(null);

  // ── 기존 환자 로드 (수정 모드) ──────────────────────────────
  useEffect(() => {
    if (isEdit && appt?.patient_id) {
      createClient().from('patients').select('*').eq('id', appt.patient_id).single()
        .then(({ data }) => { if (data) setSelectedPt(data as Patient); });
    }
  }, [isEdit, appt?.patient_id]);

  // ESC 닫기
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // 환자 검색 (디바운스)
  useEffect(() => {
    const q = patientSearch.trim();
    if (!q) { setPatients([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await createClient().from('patients').select('*')
        .ilike('name', `%${q}%`).order('name').limit(20);
      setPatients((data ?? []) as Patient[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // 빈 슬롯 계산 (단일 요일 + 신규 모드만)
  useEffect(() => {
    if (isEdit || multiDay) { setFreeSlots([]); return; }
    const daySlots = dayOfWeek === 6 ? SAT_TIME_SLOTS : TIME_SLOTS;
    const supabase = createClient();
    const base = supabase.from('appointments').select('start_time, duration_min').eq('therapist_id', therapistId);
    const q = dayOfWeek === 6
      ? base.eq('date', weekDates[5]?.toISOString().slice(0, 10) ?? '')
      : base.eq('day_of_week', dayOfWeek);

    q.then(({ data }) => {
      const existing = (data ?? []) as { start_time: string; duration_min: number }[];
      const occupied = new Set<string>();
      for (const a of existing) {
        const s = toMin(a.start_time.slice(0, 5));
        const e = s + a.duration_min;
        for (const slot of daySlots) {
          if (toMin(slot) >= s && toMin(slot) < e) occupied.add(slot);
        }
      }
      setFreeSlots(daySlots.filter(s => !occupied.has(s)));
    });
  }, [therapistId, dayOfWeek, weekDates, isEdit, multiDay]);

  // ── 신규 환자 생성 ──────────────────────────────────────────
  const handleCreatePatient = useCallback(async () => {
    const name = patientSearch.trim();
    if (!name) return;
    setCreatingPt(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (createClient().from('patients') as any).insert({ name }).select().single();
    setCreatingPt(false);
    if (!error && data) { setSelectedPt(data as Patient); setPatientSearch(''); setPatients([]); }
  }, [patientSearch]);

  // ── 충돌 감지 ───────────────────────────────────────────────
  const checkConflictForDay = useCallback(async (day: number): Promise<string | null> => {
    const s = toMin(startTime), e = s + durationMin;
    const isSat = day === 6;
    const base  = createClient().from('appointments')
      .select('id, start_time, duration_min').eq('therapist_id', therapistId);
    const q = isSat
      ? base.eq('date', weekDates[5]?.toISOString().slice(0, 10) ?? '')
      : base.eq('day_of_week', day);
    const { data } = isEdit ? await q.neq('id', appt!.id) : await q;
    type CR = { start_time: string; duration_min: number };
    const hit = (data ?? [] as CR[]).find((a: CR) => {
      const as2 = toMin(a.start_time); return s < as2 + a.duration_min && e > as2;
    });
    return hit ? `${DAY_KO[day]}요일 ${hit.start_time.slice(0,5)}에 이미 예약이 있습니다` : null;
  }, [therapistId, startTime, durationMin, isEdit, appt, weekDates]);

  // ── 저장 ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isBlock && !selectedPt) { alert('환자를 선택하거나 블록 유형을 선택해주세요.'); return; }
    if (multiDay && !isEdit && selectedDays.length === 0) { alert('요일을 하나 이상 선택해주세요.'); return; }
    setSaving(true);

    const days = (multiDay && !isEdit) ? selectedDays : [dayOfWeek];

    // 충돌 일괄 체크
    const conflicts: string[] = [];
    for (const d of days) {
      const c = await checkConflictForDay(d);
      if (c) conflicts.push(c);
    }
    if (conflicts.length > 0) {
      const ok = window.confirm(`⚠️ ${conflicts.join('\n')}\n\n그래도 저장하시겠습니까?`);
      if (!ok) { setSaving(false); return; }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apptTable = createClient().from('appointments') as any;

    for (const d of days) {
      const isSat   = d === 6;
      const satDate = isSat
        ? (isEdit && appt!.date ? appt!.date : weekDates[5]?.toISOString().slice(0, 10) ?? null)
        : null;
      const payload: Omit<Appointment, 'id' | 'created_at' | 'updated_at'> = {
        room_id:        therapist!.room_id,
        therapist_id:   therapistId,
        patient_id:     isBlock ? null : (selectedPt?.id ?? null),
        day_of_week:    isSat ? null : d,
        date:           satDate,
        start_time:     startTime,
        duration_min:   durationMin,
        treatment_code: isJeob && !isBlock && treatmentCode ? treatmentCode : null,
        patient_type:   !isBlock ? patientType : null,
        block_type:     isBlock ? blockType : '환자치료',
        note:           note.trim() || null,
      };
      isEdit ? await apptTable.update(payload).eq('id', appt!.id) : await apptTable.insert(payload);
    }
    setSaving(false);
    onSaved();
  };

  // ── 삭제 ────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm('이 예약을 삭제하시겠습니까?')) return;
    setDeleting(true);
    await createClient().from('appointments').delete().eq('id', appt!.id);
    setDeleting(false);
    onSaved();
  };

  // ── UI 헬퍼 ─────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', fontSize: 13,
    border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', boxSizing: 'border-box',
  };
  const roomColor = isJeob ? '#059669' : '#0284c7';
  const activeDaySlots = dayOfWeek === 6 ? SAT_TIME_SLOTS : TIME_SLOTS;

  // 헤더 요일 표시
  const headerDayText = (!isEdit && multiDay)
    ? (selectedDays.length > 0 ? selectedDays.map(d => DAY_KO[d]).join('·') + '요일' : '요일 선택 중')
    : `${DAY_KO[dayOfWeek]}요일`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-12"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full flex flex-col overflow-hidden"
           style={{ maxWidth: 480, maxHeight: 'calc(100vh - 64px)' }}>

        {/* ── 헤더 ── */}
        <div className="bg-blue-700 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-sm">{isEdit ? '예약 수정' : '새 예약'}</h2>
            <p className="text-blue-200 text-xs mt-0.5">
              <span className="font-semibold"
                style={{ color: isJeob ? '#6ee7b7' : '#93c5fd' }}>
                {therapist?.name}
              </span>
              {' · '}{headerDayText} {startTime}
            </p>
          </div>
          <button onClick={onClose} className="text-blue-300 hover:text-white text-lg">✕</button>
        </div>

        {/* ── 본문 ── */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">

          {/* 예약 유형 토글 */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
            {(['환자치료', '블록'] as const).map(type => (
              <button key={type} onClick={() => setIsBlock(type === '블록')}
                className="flex-1 py-2 font-medium transition-colors"
                style={{
                  background: (isBlock ? type === '블록' : type === '환자치료') ? '#1d4ed8' : '#f9fafb',
                  color:      (isBlock ? type === '블록' : type === '환자치료') ? 'white' : '#6b7280',
                }}>
                {type === '환자치료' ? '👤 환자 치료' : '🚫 블록'}
              </button>
            ))}
          </div>

          {/* 반복 예약 토글 (create 전용) */}
          {!isEdit && (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <span className="text-xs font-semibold text-gray-700">여러 요일 동시 등록</span>
                <span className="text-xs text-gray-400 ml-1.5">같은 시간에 여러 요일 한 번에</span>
              </div>
              <button
                onClick={() => { setMultiDay(v => { if (!v) setSelectedDays([dayOfWeek]); return !v; }); }}
                className="relative w-10 h-5 rounded-full transition-colors shrink-0"
                style={{ background: multiDay ? '#1d4ed8' : '#d1d5db' }}
              >
                <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                  style={{ left: multiDay ? '22px' : '2px' }} />
              </button>
            </div>
          )}

          {/* 환자 섹션 */}
          {!isBlock && (
            <div>
              <label style={labelStyle}>환자</label>
              {selectedPt ? (
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {selectedPt.name.slice(0,1)}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">{selectedPt.name}</span>
                  <button onClick={() => { setSelectedPt(null); setPatientSearch(''); setTimeout(() => searchRef.current?.focus(), 50); }}
                    className="text-xs text-blue-500 hover:text-blue-700">변경</button>
                </div>
              ) : (
                <div className="relative">
                  <input ref={searchRef} type="text" value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    placeholder="환자 이름 검색..." style={inputStyle} autoFocus={!isEdit} />
                  {searching && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {patients.length > 0 && (
                    <ul className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-auto">
                      {patients.map(p => (
                        <li key={p.id}>
                          <button className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
                            onClick={() => { setSelectedPt(p); setPatientSearch(''); setPatients([]); }}>
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {p.name.slice(0,1)}
                            </span>
                            {p.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {patientSearch.trim() && !searching && patients.length === 0 && (
                    <div className="mt-2 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <span className="text-amber-600 text-xs flex-1">
                        <strong>"{patientSearch.trim()}"</strong> 환자가 없습니다
                      </span>
                      <button onClick={handleCreatePatient} disabled={creatingPt}
                        className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 shrink-0">
                        {creatingPt ? '등록 중…' : '+ 신규 환자 등록'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3">
                <label style={labelStyle}>환자 유형</label>
                <div className="flex gap-2">
                  {(['병동', '외래'] as const).map(pt => (
                    <button key={pt} onClick={() => setPatientType(pt)}
                      className="px-4 py-1.5 rounded-full text-xs font-medium border transition-colors"
                      style={{
                        background:  patientType === pt ? roomColor : 'white',
                        color:       patientType === pt ? 'white' : '#6b7280',
                        borderColor: patientType === pt ? roomColor : '#d1d5db',
                      }}>
                      {pt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 블록 섹션 */}
          {isBlock && (
            <div>
              <label style={labelStyle}>블록 유형</label>
              <div className="flex gap-2 flex-wrap">
                {BLOCK_TYPES.map(bt => (
                  <button key={bt} onClick={() => setBlockType(bt)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={{
                      background:  blockType === bt ? '#f59e0b' : 'white',
                      color:       blockType === bt ? 'white' : '#6b7280',
                      borderColor: blockType === bt ? '#f59e0b' : '#d1d5db',
                    }}>
                    {bt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 요일 · 시간 선택 */}
          {multiDay && !isEdit ? (
            /* ── 반복 예약: 요일 체크박스 ── */
            <div className="space-y-3">
              <div>
                <label style={labelStyle}>요일 선택 <span className="normal-case font-normal text-gray-400">(여러 개 선택 가능)</span></label>
                <div className="flex gap-2">
                  {[1,2,3,4,5,6].map(d => {
                    const on = selectedDays.includes(d);
                    return (
                      <button key={d}
                        onClick={() => setSelectedDays(prev =>
                          prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
                        )}
                        className="w-10 h-10 rounded-lg text-sm font-bold border-2 transition-all"
                        style={{
                          background:  on ? '#1d4ed8' : 'white',
                          color:       on ? 'white' : (d === 6 ? '#d97706' : '#374151'),
                          borderColor: on ? '#1d4ed8' : (d === 6 ? '#fcd34d' : '#e5e7eb'),
                        }}>
                        {DAY_KO[d]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>시작 시간</label>
                  <select value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle}>
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>치료 시간</label>
                  <select value={durationMin} onChange={e => setDurationMin(Number(e.target.value))} style={inputStyle}>
                    {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}분</option>)}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* ── 단일 요일 ── */
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label style={labelStyle}>요일</label>
                <select value={dayOfWeek}
                  onChange={e => {
                    const d = Number(e.target.value);
                    setDayOfWeek(d);
                    if (d === 6 && toMin(startTime) >= LUNCH_S_MIN)
                      setStartTime(SAT_TIME_SLOTS[SAT_TIME_SLOTS.length - 1] ?? '12:00');
                  }}
                  style={inputStyle}>
                  {[1,2,3,4,5,6].map(d => <option key={d} value={d}>{DAY_KO[d]}요일</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>시작 시간</label>
                <select value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle}>
                  {activeDaySlots.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>치료 시간</label>
                <select value={durationMin} onChange={e => setDurationMin(Number(e.target.value))} style={inputStyle}>
                  {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}분</option>)}
                </select>
              </div>
            </div>
          )}

          {/* 빈 슬롯 추천 (단일 요일 + 신규 모드) */}
          {!isEdit && !multiDay && (
            <div>
              <label style={labelStyle}>빈 시간대</label>
              <div className="flex flex-wrap gap-1">
                {activeDaySlots.map(slot => {
                  const isFree = freeSlots.includes(slot);
                  const isSel  = slot === startTime;
                  return (
                    <button key={slot}
                      onClick={() => { if (isFree) setStartTime(slot); }}
                      disabled={!isFree}
                      style={{
                        padding: '3px 8px', borderRadius: 5, fontSize: 11,
                        fontWeight: isSel ? 700 : 500,
                        background: isSel ? '#1d4ed8' : isFree ? '#dcfce7' : '#f3f4f6',
                        color:      isSel ? 'white'   : isFree ? '#166534' : '#d1d5db',
                        border:     `1px solid ${isSel ? '#1d4ed8' : isFree ? '#86efac' : '#e5e7eb'}`,
                        cursor:     isFree ? 'pointer' : 'default',
                      }}>
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 처방코드 (작업치료실 + 환자치료) */}
          {isJeob && !isBlock && (
            <div>
              <label style={labelStyle}>처방코드</label>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setTreatmentCode('')}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                  style={{
                    background:  !treatmentCode ? '#6b7280' : 'white',
                    color:       !treatmentCode ? 'white' : '#6b7280',
                    borderColor: !treatmentCode ? '#6b7280' : '#d1d5db',
                  }}>
                  없음
                </button>
                {treatmentCodes.map(tc => (
                  <button key={tc.code} onClick={() => setTreatmentCode(tc.code)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={{
                      background:  treatmentCode === tc.code ? `#${tc.color_hex}` : 'white',
                      color:       treatmentCode === tc.code ? '#1f2937' : '#6b7280',
                      borderColor: treatmentCode === tc.code ? `#${tc.color_hex}` : '#d1d5db',
                    }}>
                    {tc.code}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label style={labelStyle}>메모 (선택)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="메모 입력..." rows={2}
              style={{ ...inputStyle, resize: 'none' }} />
          </div>
        </div>

        {/* ── 하단 버튼 ── */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center gap-2 shrink-0 bg-gray-50">
          {isEdit && (
            <button onClick={handleDelete} disabled={deleting}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
              {deleting ? '삭제 중…' : '🗑 삭제'}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors">
            취소
          </button>
          <button onClick={handleSave}
            disabled={saving || (multiDay && !isEdit && selectedDays.length === 0)}
            className="px-5 py-2 text-xs font-bold rounded-lg text-white transition-colors disabled:opacity-50"
            style={{ background: saving ? '#93c5fd' : '#1d4ed8' }}>
            {saving ? '저장 중…'
              : isEdit ? '수정 저장'
              : multiDay ? `${selectedDays.length}개 요일 등록`
              : '예약 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
