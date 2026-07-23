import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다. .env.local 파일을 확인해주세요."
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다. .env.local 파일을 확인해주세요."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);