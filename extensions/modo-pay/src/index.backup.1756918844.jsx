import React from "react";
import {
  reactExtension,
  BlockStack,
  InlineStack,
  Button,
  Text,
  Image,
  useApi,
  useSubscription,
  useTotalAmount,
} from "@shopify/ui-extensions-react/checkout";

// SOLO Thank-you
export default reactExtension(
  "purchase.thank-you.block.render",
  () => <ModoPay />
);

function ModoPay() {
  const api = useApi();
  const thankYou = useSubscription(api.orderConfirmation);
  const total = useTotalAmount();

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
      const amount = Number(total?.amount ?? 0) / 100; // total en ARS
      const res = await fetch(`/apps/modo/qr?amount=${amount.toFixed(2)}&mock=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      setState({
        loading: false,
        paymentId: payload?.paymentId ?? null,
        qrBase64: payload?.qrBase64 ?? null,
        status: "PENDING",
        error: null,
      });
    } catch (e) {
      setState({ loading: false, paymentId: null, qrBase64: null, status: null, error: "No pudimos iniciar MODO. Intentá nuevamente." });
    }
  }

  async function checkStatus() {
    if (!state.paymentId) return startPayment();
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/apps/modo/status/${state.paymentId}?mock=1`);
      const payload = await res.json().catch(() => ({}));
      const status = payload?.status ?? "PENDING";
      setState((s) => ({ ...s, loading: false, status }));
    } catch {
      setState((s) => ({ ...s, loading: false, error: "No pudimos obtener el estado." }));
    }
  }

  return (
    <BlockStack spacing="tight">
      <Text>📄 Pago con MODO</Text>
      <InlineStack spacing="tight" blockAlignment="center">
        <Button onPress={startPayment} loading={state.loading}>Generar QR</Button>
        <Button onPress={checkStatus} loading={state.loading} kind="secondary">Actualizar estado</Button>
      </InlineStack>

      {state.error && <Text>❌ {state.error}</Text>}

      {state.qrBase64 && (
        <BlockStack spacing="tight">
          <Image source={state.qrBase64} description="QR MODO" />
          <Text appearance="subdued">ID: {state.paymentId}</Text>
        </BlockStack>
      )}

      {state.status && (
        <Text>Estado: <b>{state.status}</b></Text>
      )}
    </BlockStack>
  );
}
