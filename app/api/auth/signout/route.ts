import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Server SignOut Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Server SignOut Exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
