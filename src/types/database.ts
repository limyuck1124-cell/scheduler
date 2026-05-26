// 재활치료실 통합 스케줄러 — 데이터베이스 타입 정의

export type Room = {
  id: string;
  name: string; // 작업치료실 | 운동치료실
};

export type Therapist = {
  id: string;
  name: string;
  room_id: string;
};

export type Patient = {
  id: string;
  name: string; // 동명이인은 a/b 접미사 포함 (예: 서용복a)
  memo: string | null;
  created_at: string;
};

export type TreatmentCode = {
  code: string; // C | A | C/A | S | COM | D
  label: string;
  default_minutes: number;
  color_hex: string;
};

export type BlockType = '환자치료' | '병동블록' | '경과기록' | '평가';
export type PatientType = '병동' | '외래';

export type Appointment = {
  id: string;
  room_id: string;
  patient_id: string | null;       // 블록이면 null
  therapist_id: string;
  day_of_week: number | null;      // 1=월 … 5=금. 토요일이면 null
  date: string | null;             // 토요일 등 날짜 기반. 평일이면 null
  start_time: string;              // HH:MM 형식
  duration_min: number;
  treatment_code: string | null;   // 작업치료실만 사용
  patient_type: PatientType | null;
  block_type: BlockType;
  note: string | null;
  created_at: string;
  updated_at: string;
};

// JOIN 결과 타입 (UI에서 사용)
export type AppointmentWithRelations = Appointment & {
  room: Room;
  patient: Patient | null;
  therapist: Therapist;
  treatment_code_info: TreatmentCode | null;
};

// Supabase 전체 DB 타입
export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: Room;
        Insert: Omit<Room, 'id'> & { id?: string };
        Update: Partial<Room>;
      };
      therapists: {
        Row: Therapist;
        Insert: Omit<Therapist, 'id'> & { id?: string };
        Update: Partial<Therapist>;
      };
      patients: {
        Row: Patient;
        Insert: Omit<Patient, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Patient>;
      };
      treatment_codes: {
        Row: TreatmentCode;
        Insert: TreatmentCode;
        Update: Partial<TreatmentCode>;
      };
      appointments: {
        Row: Appointment;
        Insert: Omit<Appointment, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<Appointment, 'id' | 'created_at'>>;
      };
    };
  };
};
