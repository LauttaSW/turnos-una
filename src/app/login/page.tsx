import { fontDisplay, fontSans } from '@/lib/fonts';
import { login } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;

  return (
    <main
      className={`${fontSans.className} flex min-h-screen flex-col md:flex-row`}
    >
      {/* Panel de marca */}
      <div className="flex flex-col justify-between bg-[#7A2E43] px-8 py-10 text-[#F3E4E8] md:w-[42%] md:px-14 md:py-16">
        <span className={`${fontDisplay.className} text-xl`}>
          Nombre del salón
        </span>

        <div className="mt-10 md:mt-0">
          <h1
            className={`${fontDisplay.className} text-3xl leading-tight md:text-4xl`}
          >
            Gestioná los turnos de tu salón desde un solo lugar
          </h1>
          <p className="mt-4 max-w-sm text-sm text-[#E8C7D1]">
            Iniciá sesión para revisar solicitudes, confirmar horarios y
            organizar la semana.
          </p>
        </div>

        <p className="hidden text-xs text-[#D9A8B6] md:block">
          Panel interno — uso exclusivo del equipo
        </p>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center bg-[#FAF6F1] px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className={`${fontDisplay.className} text-2xl text-[#2B2320]`}>
            Iniciar sesión
          </h2>
          <p className="mt-1 text-sm text-[#8A7D77]">
            Ingresá con tu cuenta de administrador.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-6 rounded-md border border-[#E3B3B3] bg-[#FBEAEA] px-4 py-3 text-sm text-[#8C3B3B]"
            >
              {error}
            </p>
          )}

          <form action={login} className="mt-8 space-y-5">
            <input type="hidden" name="redirectTo" value={redirectTo ?? ''} />

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#2B2320]"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="vos@ejemplo.com"
                className="mt-1.5 w-full rounded-md border border-[#E2D6CF] bg-white px-3.5 py-2.5 text-sm text-[#2B2320] outline-none transition focus:border-[#9B3B54] focus:ring-2 focus:ring-[#9B3B54]/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#2B2320]"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-md border border-[#E2D6CF] bg-white px-3.5 py-2.5 text-sm text-[#2B2320] outline-none transition focus:border-[#9B3B54] focus:ring-2 focus:ring-[#9B3B54]/20"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-[#9B3B54] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#7A2E43] focus:outline-none focus:ring-2 focus:ring-[#9B3B54]/40 focus:ring-offset-2"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
