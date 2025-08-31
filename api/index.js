import React from "react";
import { reactExtension, Text, Button, useApi, useSubscription } from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.thank-you.block.render", () => <ModoPay />);

function ModoPay() {
  const api = useApi();
  const orderConfirmation = useSubscription(api.orderConfirmation);
  const orderId = orderConfirmation?.id ?? "TEST123"; // fallback para test

  const [state, setState] = React.useState({ loading: false, data: null, error: null });

  async function testFetch() {
    setState({ loading: true, data: null, error: null });
    try {
      // Opción 1 — vía App Proxy (no necesita CORS, requiere la app instalada):
      // usa SIEMPRE ruta relativa para que vaya al dominio de la tienda
      const res = await fetch(`/apps/modo/qr?orderId=${orderId}&mock=1`);

      // Opción 2 — directo a Vercel (sirve también en el Dev Console; necesita CORS, que ya pusiste):
      // const res = await fetch(`https://gardenlife-modo.vercel.app/apps/modo/qr?orderId=${orderId}&mock=1`);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setState({ loading: false, data: json, error: null });
      console.log("MODO ▶ respuesta:", json);
    } catch (err) {
      console.error("MODO ▶ error:", err);
      setState({ loading: false, data: null, error: String(err) });
    }
  }

  return (
    <>
      <Text>✅ Bloque MODO cargado (orderId: {orderId})</Text>
      <Button onPress={testFetch}>
        Probar fetch al backend
      </Button>
      {state.loading && <Text>⏳ Cargando...</Text>}
      {state.error && <Text>❌ Error: {state.error}</Text>}
      {state.data && (
        <Text>
          🔎 Mock ID: {state.data.id} • vence: {state.data.expiration_date}
        </Text>
      )}
    </>
  );
}
