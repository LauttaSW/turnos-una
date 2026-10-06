'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Props = {
  notificationKey: string;
  children: React.ReactNode;
  className: string;
  role: 'alert' | 'status';
  href?: string;
};

/** Hides a notice after 15 seconds, and only shows it again when its content changes. */
export function AdminTimedNotice({
  notificationKey,
  children,
  className,
  role,
  href,
}: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timeoutId = window.setTimeout(() => setVisible(false), 15_000);
    return () => window.clearTimeout(timeoutId);
  }, [notificationKey]);

  if (!visible) return null;

  if (href) {
    return (
      <Link href={href} role={role} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <div role={role} className={className}>
      {children}
    </div>
  );
}
