import { fontDisplay, fontSans } from '@/lib/fonts';
import { canCancelAppointment, formatLong, normalizeTime } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { cancelAppointmentByToken } from './actions';
import { CancelConfirmButton } from './CancelConfirmButton';

type TokenAppointment = {
  id: string;
  date_range_id: string;
  appointment_date: string;
  appointment_time: string;
  client_first_name: string;
  status:
    | 'pending'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'cancelled_by_client'
    | 'cancelled';
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={`${fontSans.className} flex min-h-screen items-center justify-center bg-[#FAF6F1] px-6 py-12`}
    >
      <div className="w-full max-w-sm rounded-lg border border-[#E8DED7] bg-white p-6 text-center">
        {children}
      </div>
    </main>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h1 className={`${fontDisplay.className} text-xl text-[#2B2320]`}>
        {title}
      </h1>
      <p className="mt-2 text-sm text-[#8A7D77]">{text}</p>
    </>
  );
}

export default async function CancelarPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { token } = await params;
  const { success, error: errorParam } = await searchParams;

  const supabase = await createClient();

  const { data } = await supabase
    .rpc('get_appointment_by_cancel_token', { p_token: token })
    .maybeSingle<TokenAppointment>();

  if (!data) {
    return (
      <Shell>
        <Message
          title="Link no válido"
          text="Este link de cancelación no es válido."
        />
      </Shell>
    );
  }

  if (data.status === 'cancelled' || data.status === 'cancelled_by_client') {
    return (
      <Shell>
        <Message
          title={success ? 'Turno cancelado' : 'Turno ya cancelado'}
          text={
            success
              ? 'Tu turno fue cancelado con éxito.'
              : 'Este turno ya había sido cancelado.'
          }
        />
      </Shell>
    );
  }

  if (data.status !== 'pending' && data.status !== 'confirmed') {
    return (
      <Shell>
        <Message
          title="Este turno ya no se puede cancelar"
          text="El turno ya fue atendido, así que no está disponible para cancelar online."
        />
      </Shell>
    );
  }

  const cancellable = canCancelAppointment(
    data.appointment_date,
    data.appointment_time
  );

  if (!cancellable) {
    return (
      <Shell>
        <Message
          title="Ya pasó el plazo"
          text="Los turnos se pueden cancelar online hasta 1 día antes. Para cancelar este turno, contactanos directamente."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className={`${fontDisplay.className} text-xl text-[#2B2320]`}>
        Cancelar turno
      </h1>
      <p className="mt-2 text-sm text-[#4A423E]">
        Hola {data.client_first_name}, tu turno es el{' '}
        {formatLong(data.appointment_date)} a las{' '}
        {normalizeTime(data.appointment_time)} hs.
      </p>
      <p className="mt-1 text-sm text-[#8A7D77]">
        ¿Confirmás que querés cancelarlo?
      </p>

      {errorParam && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-[#E3B3B3] bg-[#FBEAEA] px-4 py-3 text-left text-sm text-[#8C3B3B]"
        >
          {errorParam}
        </p>
      )}

      <div className="mt-6">
        <CancelConfirmButton action={cancelAppointmentByToken.bind(null, token)} />
      </div>
    </Shell>
  );
}
