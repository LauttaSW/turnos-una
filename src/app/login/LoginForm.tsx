'use client';

import { useState, type FormEvent } from 'react';
import { login } from './actions';

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await login(new FormData(event.currentTarget));
    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    window.location.assign(result.destination ?? '/admin');
  }

  return (
    <>
      {error && (
        <p role="alert" className="mt-6 rounded-md border border-[#E3B3B3] bg-[#FBEAEA] px-4 py-3 text-sm text-[#8C3B3B]">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#2B2320]">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="vos@ejemplo.com" className="mt-1.5 w-full rounded-md border border-[#E2D6CF] bg-white px-3.5 py-2.5 text-sm text-[#2B2320] outline-none transition focus:border-[#9B3B54] focus:ring-2 focus:ring-[#9B3B54]/20" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[#2B2320]">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" className="mt-1.5 w-full rounded-md border border-[#E2D6CF] bg-white px-3.5 py-2.5 text-sm text-[#2B2320] outline-none transition focus:border-[#9B3B54] focus:ring-2 focus:ring-[#9B3B54]/20" />
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-[#9B3B54] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#7A2E43] focus:outline-none focus:ring-2 focus:ring-[#9B3B54]/40 focus:ring-offset-2 disabled:opacity-70">
          {isSubmitting ? 'Ingresando…' : 'Entrar'}
        </button>
      </form>
    </>
  );
}
