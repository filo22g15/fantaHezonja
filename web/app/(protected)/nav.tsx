'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Contratti', match: (p: string) => p === '/' },
  { href: '/squadre', label: 'Squadre', match: (p: string) => p.startsWith('/squadre') || p.startsWith('/squadra') },
  { href: '/recap', label: 'Recap', match: (p: string) => p.startsWith('/recap') },
  { href: '/bacheca', label: 'Bacheca', match: (p: string) => p.startsWith('/bacheca') },
  { href: '/trade', label: 'Trade', match: (p: string) => p.startsWith('/trade') },
];

export default function Nav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin
    ? [...LINKS, { href: '/admin', label: 'Utenti', match: (p: string) => p.startsWith('/admin') }]
    : LINKS;
  return (
    <nav>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={l.match(pathname) ? 'on' : ''}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
