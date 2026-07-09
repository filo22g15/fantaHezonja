'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SignOut() {
  const router = useRouter();
  return (
    <button
      className="signout"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push('/login');
        router.refresh();
      }}
    >
      esci
    </button>
  );
}
