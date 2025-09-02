import React from "react";
import {
  reactExtension,
  BlockStack,
  InlineStack,
  Button,
  Link,
  Text,
  Image,
  useApi,
  useSubscription,
  useTotalAmount,
} from "@shopify/ui-extensions-react/checkout";

// Render en PASO DE PAGO
export const PaymentMethods = reactExtension(
  "checkout.payment-methods.render",
  () => <ModoPay target="payment" />
);

// Render en THANK YOU (default export)
export default reactExtension(
  "purchase.thank-you.block.render",
  () => <ModoPay target="thankyou" />
);

function ModoPay({ target }) {
  const api = useApi();
  const thankYou = useSubscription(api.orderConfirmation);
  const total = useTotalAmount();

  // En Thank You solemos tener orderId; en Payment no.
  const orderId = target === "thankyou" ? (api?.order?.id ?? thankYou?.id ?? null) : null;

  // Usamos rutas relativas al dominio de la tienda (pasan por App Proxy)
  const [state, setState] = React.useState({
    loading: false,
    paymentId: null,
    qrBase64: null,
    status: null,
    error: null,
  });

  async function startPayment() {
    setState({ loading: true, paymentId: null, qrBase64: null, status: null, error: null });
    try {
      // total.amount viene en centavos
      const amount = Number(total?.amount ?? 0) / 100;
      const res = await fetch(`/apps/modo/qr?amount=${amount.toFixed(2)}&mock=1`, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();

      setState({
        loading: false,
        paymentId: payload?.paymentId ?? null,
        qrBase64: payload?.qrBase64 ?? null,
        status: "PENDING",
        error: null,
      });

      // Si viniera un deeplink y estás en mobile, podés intentar abrir la app
      if (payload?.deeplink && typeof window !== "undefined") {
        try { window.location.href = payload.deeplink; } catch {}
      }
    } catch (e) {
      setState({ loading: false, paymentId: null, qrBase64: null, status: null, error: "No pudimos iniciar MODO. Intentá nuevamente." });
    }
  }

  async function checkStatus() {
    if (!state.paymentId) {
      // Si no hay paymentId aún, generamos el QR primero
      return startPayment();
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/apps/modo/status/${state.paymentId}?mock=1`, { method: "GET" });
      const payload = await res.json().catch(() => ({}));
      const status = payload?.status ?? "PENDING";
      setState((s) => ({ ...s, loading: false, status }));
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: "No pudimos obtener el estado." }));
    }
  }

  return (
    <BlockStack spacing="tight">
      {target === "payment" && (
        <>
          <Text>💳 Pagar con MODO</Text>
          <InlineStack spacing="tight" blockAlignment="center">
            <Button onPress={startPayment} loading={state.loading}>
              Generar QR
            </Button>
            <Button onPress={checkStatus} loading={state.loading} kind="secondary">
              Actualizar estado
            </Button>
          </InlineStack>
        </>
      )}

      {target === "thankyou" && (
        <>
          <Text>📄 Estado de tu pago con MODO</Text>
          <InlineStack spacing="tight" blockAlignment="center">
            <Button onPress={startPayment} loading={state.loading}>
              Generar QR
            </Button>
            <Button onPress={checkStatus} loading={state.loading} kind="secondary">
              Actualizar estado
            </Button>
          </InlineStack>
        </>
      )}

      {state.error && <Text>❌ {state.error}</Text>}

      {state.qrBase64 && (
        <BlockStack spacing="tight">
          <Image source={state.qrBase64} description="QR MODO" />
          <Text appearance="subdued">ID: {state.paymentId}</Text>
        </BlockStack>
      )}

      {state.status && (
        <Text>
          Estado: <b>{state.status}</b>
        </Text>
      )}
    </BlockStack>
  );
}
