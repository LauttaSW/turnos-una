import { fontDisplay } from '@/lib/fonts';
import { createClient } from '@/lib/supabase/server';

export default async function AdminHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="max-w-4xl">
      <h1 className={`${fontDisplay.className} text-3xl text-[#2B2320]`}>
        Hola{user?.email ? `, ${user.email}` : ''}
      </h1>
      <p className="mt-2 text-sm text-[#8A7D77]">
        Este es tu panel de administración. Elegí una sección del menú para
        empezar.
      </p>
    </div>
  );
}
