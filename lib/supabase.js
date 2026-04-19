import { createClient } from '@supabase/supabase-js';

// Vercel 환경변수에서 Supabase 접속 정보를 가져옵니다.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase 연결 오류: SUPABASE_URL 또는 SUPABASE_ANON_KEY 환경변수가 누락되었습니다.');
}

// 클라이언트 생성 및 내보내기 (이 모듈을 다른 api 함수에서 import하여 사용합니다)
export const supabase = supabaseUrl && supabaseKey 
    ? createClient(supabaseUrl, supabaseKey) 
    : null;
