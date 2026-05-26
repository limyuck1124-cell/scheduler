'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Appointment, Therapist, Room, TreatmentCode, Patient, BlockType, PatientType } from '@/types/database';
import type { AppointmentRow } from './WeeklyGrid';

// ── 상수 ────────────────────────────────────────────────────
const DAY_KO: Record<number, string> = { 1:'월', 2:'화', 3:'수', 4:'목', 5:'금', 6:'토' };
const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90];
const BLOCK_TYPES: Exclude<BlockType, '환자치료'>[] = ['병동블록', '경과기록', '평가'];

const TIME_SLOTS: string[] = [];
for (let h = 8; h <= 17; h++) {
  for (const m of [0, 30]) {
    if (h === 8 && m === 0) continue; // 8:00 제외
    if (h === 17 && m === 30) continue;
    TIME_SLOTS.push(`${h}:${String(m).padStart(2, '0')}`);
  }
}

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

  // 치료사 결정
  const therapistId = isEdit ? appt!.therapist_id : initData.therapistId;
  const therapist   = therapists.find(t => t.id === therapistId);
  const isJeob      = therapist?.room?.name === '작업치료실';

  // ── 폼 상태 ────────────────────────────────────────────────
  const [isBlock,       setIsBlock]       = useState(isEdit ? appt!.block_type !== '환자치료' : false);
  const [blockType,     setBlockType]     = useState<Exclude<BlockType, '환자치료'>>(
    isEdit && appt!.block_type !== '환자치료' ? appt!.block_type as Exclude<BlockType, '환자치료'> : '병동블록'
  );
  const [patientSearch, setPatientSearch] = useState('');
  const [patients,      setPatients]      = useState<Patient[]>([]);
  const [selectedPt,    setSelectedPt]    = useState<Patient | null>(null);
  const [patientType,   setPatientType]   = useState<PatientType>(
    isEdit && appt!.patient_type ? appt!.patient_type as PatientType : '병동'
  );
  const [dayOfWeek, setDayOfWeek]   = useState<number>(
    isEdit ? (appt!.day_of_week ?? 6) : (initData.dayIdx + 1)
  );
  const [startTime, setStartTime]   = useState<string>(
    isEdit ? appt!.start_time.slice(0, 5) : fmtTime(initData.slotMin)
  );
  const [durationMin, setDurationMin] = useState<number>(
    isEdit ? appt!.duration_min : 30
  );
  const [treatmentCode, setTreatmentCode] = useState<string>(
    isEdit && appt!.treatment_code ? appt!.treatment_code : ''
  );
  const [note, setNote] = useState<string>(isEdit ? (appt!.note ?? '') : '');

  const [conflict,  setConflict]  = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [searching,  setSearching]  = useState(false);
  const [creatingPt, setCreatingPt] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // 수정 모드: 기존 환자 로드
  useEffect(() => {
    if (isEdit && appt?.patient_id) {
      createClient()
        .from('patients')
        .select('*')
        .eq('id', appt.patient_id)
        .single()
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
      const { data } = await createClient()
        .from('patients')
        .select('*')
        .ilike('name', `%${q}%`)
        .order('name')
        .limit(20);
      setPatients((data ?? []) as Patient[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // ── 신규 환자 생성 ──────────────────────────────────────────
  const handleCreatePatient = useCallback(async () => {
    const name = patientSearch.trim();
    if (!name) return;
    setCreatingPt(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patientsTable = createClient().from('patients') as any;
    const { data, error } = await patientsTable.insert({ name }).select().single();
    setCreatingPt(false);
    if (!error && data) {
      setSelectedPt(data as Patient);
      setPatientSearch('');
      setPatients([]);
    }
  }, [patientSearch]);

  // ── 충돌 감지 ───────────────────────────────────────────────
  const checkConflict = useCallback(async (): Promise<string | null> => {
    const newStart = toMin(startTime);
    const newEnd   = newStart + durationMin;
    const isSaturday = dayOfWeek === 6;
    const satDate = weekDates[5]?.toISOString().slice(0, 10);

    const supabase = createClient();
    const base = supabase
      .from('appointments')
      .select('id, start_time, duration_min')
      .eq('therapist_id', therapistId);

    const q = isSaturday
      ? base.eq('date', satDate)
      : base.eq('day_of_week', dayOfWeek);

    const { data } = isEdit ? await q.neq('id', appt!.id) : await q;
    type ConflictRow = { id: string; start_time: string; duration_min: number };
    const rows = (data ?? []) as ConflictRow[];
    const conflicting = rows.find(a => {
      const s = toMin(a.start_time); const e = s + a.duration_min;
      return newStart < e && newEnd > s;
    });
    if (!conflicting) return null;
    return `${DAY_KO[dayOfWeek]}요일 ${conflicting.start_time.slice(0,5)}에 이미 예약이 있습니다`;
  }, [therapistId, dayOfWeek, startTime, durationMin, isEdit, appt, weekDates]);

  // ── 저장 ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isBlock && !selectedPt) {
      alert('환자를 선택하거나 블록 유형을 선택해주세요.');
      return;
    }
    setSaving(true);

    const conflict = await checkConflict();
    if (conflict) {
      const ok = window.confirm(`⚠️ ${conflict}\n\n그래도 저장하시겠습니까?`);
      if (!ok) { setSaving(false); return; }
    }

    const isSaturday = dayOfWeek === 6;
    const satDate = isSaturday
      ? (isEdit && appt!.date ? appt!.date : weekDates[5]?.toISOString().slice(0, 10) ?? null)
      : null;

    const payload: Omit<Appointment, 'id' | 'created_at' | 'updated_at'> = {
      room_id:        therapist!.room_id,
      therapist_id:   therapistId,
      patient_id:     isBlock ? null : (selectedPt?.id ?? null),
      day_of_week:    isSaturday ? null : dayOfWeek,
      date:           satDate,
      start_time:     startTime,
      duration_min:   durationMin,
      treatment_code: isJeob && !isBlock && treatmentCode ? treatmentCode : null,
      patient_type:   !isBlock ? patientType : null,
      block_type:     isBlock ? blockType : '환자치료',
      note:           note.trim() || null,
    };

    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apptTable = supabase.from('appointments') as any;
    if (isEdit) {
      await apptTable.update(payload).eq('id', appt!.id);
    } else {
      await apptTable.insert(payload);
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
    border: '1px solid #d1d5db', borderRadius: 6,
    outline: 'none', boxSizing: 'border-box',
  };

  const therapistRoomColor = isJeob ? '#059669' : '#0284c7';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-12"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 480, maxHeight: 'calc(100vh - 64px)' }}
      >
        {/* ── 헤더 ── */}
        <div className="bg-blue-700 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-sm">{isEdit ? '예약 수정' : '새 예약'}</h2>
            <p className="text-blue-200 text-xs mt-0.5">
              <span
                className="font-semibold"
                style={{ color: therapist?.room?.name === '작업치료실' ? '#6ee7b7' : '#93c5fd' }}
              >
                {therapist?.name}
              </span>
              {' · '}
              {DAY_KO[dayOfWeek]}요일 {startTime}
            </p>
          </div>
          <button onClick={onClose} className="text-blue-300 hover:text-white text-lg">✕</button>
        </div>

        {/* ── 본문 (스크롤) ── */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">

          {/* 예약 유형 토글 */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
            {(['환자치료', '블록'] as const).map(type => (
              <button
                key={type}
                onClick={() => setIsBlock(type === '블록')}
                className="flex-1 py-2 font-medium transition-colors"
                style={{
                  background: (isBlock ? type === '블록' : type === '환자치료') ? '#1d4ed8' : '#f9fafb',
                  color:      (isBlock ? type === '블록' : type === '환자치료') ? 'white' : '#6b7280',
                }}
              >
                {type === '환자치료' ? '👤 환자 치료' : '🚫 블록'}
              </button>
            ))}
          </div>

          {/* 환자 치료 모드 */}
          {!isBlock && (
            <div>
              <label style={labelStyle}>환자</label>
              {selectedPt ? (
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {selectedPt.name.slice(0, 1)}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">{selectedPt.name}</span>
                  <button
                    onClick={() => { setSelectedPt(null); setPatientSearch(''); setTimeout(() => searchRef.current?.focus(), 50); }}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    변경
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    ref={searchRef}
                    type="text"
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    placeholder="환자 이름 검색..."
                    style={inputStyle}
                    autoFocus={!isEdit}
                  />
                  {searching && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {/* 검색 결과 목록 */}
                  {patients.length > 0 && (
                    <ul className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-auto">
                      {patients.map(p => (
                        <li key={p.id}>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
                            onClick={() => { setSelectedPt(p); setPatientSearch(''); setPatients([]); }}
                          >
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {p.name.slice(0, 1)}
                            </span>
                            {p.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* 검색 결과 없음 → 신규 환자 등록 */}
                  {patientSearch.trim() && !searching && patients.length === 0 && (
                    <div className="mt-2 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <span className="text-amber-600 text-xs flex-1">
                        <strong>"{patientSearch.trim()}"</strong> 환자가 없습니다
                      </span>
                      <button
                        onClick={handleCreatePatient}
                        disabled={creatingPt}
                        className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 shrink-0"
                      >
                        {creatingPt ? '등록 중…' : '+ 신규 환자 등록'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 환자 유형 */}
              <div className="mt-3">
                <label style={labelStyle}>환자 유형</label>
                <div className="flex gap-2">
                  {(['병동', '외래'] as const).map(pt => (
                    <button
                      key={pt}
                      onClick={() => setPatientType(pt)}
                      className="px-4 py-1.5 rounded-full text-xs font-medium border transition-colors"
                      style={{
                        background:   patientType === pt ? therapistRoomColor : 'white',
                        color:        patientType === pt ? 'white' : '#6b7280',
                        borderColor:  patientType === pt ? therapistRoomColor : '#d1d5db',
                      }}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 블록 모드 */}
          {isBlock && (
            <div>
              <label style={labelStyle}>블록 유형</label>
              <div className="flex gap-2 flex-wrap">
                {BLOCK_TYPES.map(bt => (
                  <button
                    key={bt}
                    onClick={() => setBlockType(bt)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={{
                      background:  blockType === bt ? '#f59e0b' : 'white',
                      color:       blockType === bt ? 'white' : '#6b7280',
                      borderColor: blockType === bt ? '#f59e0b' : '#d1d5db',
                    }}
                  >
                    {bt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 요일 · 시간 · 치료 시간 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label style={labelStyle}>요일</label>
              <select
                value={dayOfWeek}
                onChange={e => setDayOfWeek(Number(e.target.value))}
                style={inputStyle}
              >
                {[1,2,3,4,5,6].map(d => (
                  <option key={d} value={d}>{DAY_KO[d]}요일</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>시작 시간</label>
              <select
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                style={inputStyle}
              >
                {TIME_SLOTS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>치료 시간</label>
              <select
                value={durationMin}
                onChange={e => setDurationMin(Number(e.target.value))}
                style={inputStyle}
              >
                {DURATION_OPTIONS.map(d => (
                  <option key={d} value={d}>{d}분</option>
                ))}
              </select>
            </div>
          </div>

          {/* 처방코드 (작업치료실 + 환자치료 모드) */}
          {isJeob && !isBlock && (
            <div>
              <label style={labelStyle}>처방코드</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setTreatmentCode('')}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                  style={{
                    background:  !treatmentCode ? '#6b7280' : 'white',
                    color:       !treatmentCode ? 'white' : '#6b7280',
                    borderColor: !treatmentCode ? '#6b7280' : '#d1d5db',
                  }}
                >
                  없음
                </button>
                {treatmentCodes.map(tc => (
                  <button
                    key={tc.code}
                    onClick={() => setTreatmentCode(tc.code)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={{
                      background:  treatmentCode === tc.code ? `#${tc.color_hex}` : 'white',
                      color:       treatmentCode === tc.code ? '#1f2937' : '#6b7280',
                      borderColor: treatmentCode === tc.code ? `#${tc.color_hex}` : '#d1d5db',
                    }}
                  >
                    {tc.code}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label style={labelStyle}>메모 (선택)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="메모 입력..."
              rows={2}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>

          {/* 충돌 경고 */}
          {conflict && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5 text-sm text-amber-800 flex items-start gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <span>{conflict}</span>
            </div>
          )}
        </div>

        {/* ── 하단 버튼 ── */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center gap-2 shrink-0 bg-gray-50">
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting ? '삭제 중…' : '🗑 삭제'}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-xs font-bold rounded-lg text-white transition-colors disabled:opacity-50"
            style={{ background: saving ? '#93c5fd' : '#1d4ed8' }}
          >
            {saving ? '저장 중…' : (isEdit ? '수정 저장' : '예약 등록')}
          </button>
        </div>
      </div>
    </div>
  );
}
