import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

const MODO_USERNAME = process.env.MODO_USERNAME ?? "";
const MODO_PASSWORD = process.env.MODO_PASSWORD ?? "";
const MODO_PROCESSOR_CODE = process.env.MODO_PROCESSOR_CODE ?? "P1962";
const MODO_BASE_URL = 
  process.env.MODO_BASE_URL ?? "https://merchants.preprod.playdigital.com.ar";

/**
 * GET /apps/modo/qr?orderId=xxx&amount=12345
 * Devuelve siempre JSON: { ok: true, data } | { ok: false, error }
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId");
    const amount = url.searchParams.get("amount") || "50.00";
    const mock = url.searchParams.get("mock");

    // Si es una solicitud de prueba, devuelve datos de prueba
    if (mock === "1") {
      return json({ 
        ok: true, 
        data: {
          qr_url: "https://ejemplo.com/qr.png",
          deep_link: "modo://pay?token=123456"
        }
      }, { 
        status: 200, 
        headers: { ...noCache(), "Content-Type": "application/json; charset=utf-8" } 
      });
    }

    if (!orderId) {
      return json({ ok: false, error: "Falta orderId" }, { status: 400, headers: noCache() });
    }

    // Primero obtenemos el token de autenticación
    const tokenResponse = await fetch(`${MODO_BASE_URL}/v1/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey: MODO_USERNAME,
        apiSecret: MODO_PASSWORD
      })
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text().catch(() => "");
      return json(
        { ok: false, error: `MODO Auth ${tokenResponse.status}`, details: safeJson(text) },
        { status: 502, headers: noCache() }
      );
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.access_token;

    // Ahora creamos el payment request con el token
    const paymentResponse = await fetch(`${MODO_BASE_URL}/v2/payment-requests/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "GardenLife",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        "description": "Compra en GardenLife",
        "amount": Number(amount),
        "currency": "ARS",
        "cc_code": "CRI",
        "processor_code": MODO_PROCESSOR_CODE,
        "external_intention_id": String(orderId),
        "customer": {
          "full_name": "Cliente GardenLife",
          "email": "cliente@ejemplo.com",
          "identification": "DNI",
          "phone": "+541122334455"
        }
      })
    });

    if (!paymentResponse.ok) {
      const text = await paymentResponse.text().catch(() => "");
      return json(
        { 
          ok: false, 
          error: `MODO ${paymentResponse.status}`, 
          details: safeJson(text), 
          sent: {
            processorCode: MODO_PROCESSOR_CODE,
            externalId: String(orderId),
            amount: Number(amount)
          }
        },
        { status: 502, headers: noCache() }
      );
    }

    const data = await paymentResponse.json();
    return json({ ok: true, data }, { status: 200, headers: { ...noCache(), "Content-Type": "application/json; charset=utf-8" } });
  } catch (err: any) {
    return json({ ok: false, error: "EXCEPTION", details: err?.message ?? String(err) }, { status: 500, headers: noCache() });
  }
}

// Funciones auxiliares que parecen estar definidas en tu código original
function noCache() {
  return {
    "Cache-Control": "no-store, max-age=0, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  };
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return { message: text };
  }
}

