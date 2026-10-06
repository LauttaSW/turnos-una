'use client';

import { deleteDateRange } from './actions';

export function DeleteDateRangeButton({
  rangeId,
  title,
}: {
  rangeId: string;
  title: string;
}) {
  function confirmDelete(event: React.FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        `¿Eliminar "${title}"? Si hay turnos asociados, también se borrarán.`
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteDateRange} onSubmit={confirmDelete}>
      <input type="hidden" name="rangeId" value={rangeId} />
      <button
        type="submit"
        className="shrink-0 rounded-md border border-[#E8C9C9] bg-[#FBEAEA] px-3 py-1.5 text-xs font-medium text-[#8C3B3B] transition hover:border-[#D99A9A] hover:bg-[#F6DEDE] focus:outline-none focus:ring-2 focus:ring-[#C96B6B]/30"
      >
        Eliminar
      </button>
    </form>
  );
}
