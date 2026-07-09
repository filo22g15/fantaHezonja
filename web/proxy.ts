// Next 16: il "middleware" è ora "proxy" (runtime nodejs, non edge).
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // tutto tranne asset statici e immagini
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
