type SendWhatsAppResult = { ok: true } | { ok: false; error: string };

/**
 * Envía un mensaje de texto por WhatsApp a través de Evolution API.
 *
 * Nunca lanza: devuelve { ok: false, error } ante cualquier problema
 * (env vars faltantes, número inválido, timeout, respuesta no-2xx),
 * así el que llama decide qué hacer sin necesidad de try/catch —
 * pensado para el caso de uso real: notificar sin bloquear el flujo
 * principal si WhatsApp falla.
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<SendWhatsAppResult> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  if (!apiUrl || !apiKey || !instance) {
    return {
      ok: false,
      error:
        'Faltan variables de entorno de Evolution API (EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE)',
    };
  }

  // Evolution API espera el número solo con dígitos (código de país +
  // número, sin '+', espacios ni guiones). client_phone se guarda con
  // esos separadores para que sea legible en el admin, así que se
  // normaliza acá, en el borde del sistema que lo consume.
  const number = phone.replace(/\D/g, '');

  if (!number) {
    return { ok: false, error: `Número inválido, no quedaron dígitos: "${phone}"` };
  }

  const endpoint = `${apiUrl.replace(/\/+$/, '')}/message/sendText/${instance}`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({ number, text: message }),
    });
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `No se pudo conectar con Evolution API: ${err.message}`
          : 'No se pudo conectar con Evolution API',
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return {
      ok: false,
      error: `Evolution API respondió ${response.status}: ${body.slice(0, 300)}`,
    };
  }

  return { ok: true };
}
