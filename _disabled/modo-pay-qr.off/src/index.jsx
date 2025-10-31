import React from "react";
import {
  reactExtension,
  BlockStack,
  Button,
  Image,
  Text,
  useApi,
  useSubscription,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.thank-you.block.render", () => <ModoPay />);
export const OrderStatus = reactExtension(
  "customer-account.order-status.block.render",
  () => <ModoPay />
);

function ModoPay() {
  const api = useApi();
  const thankYou = useSubscription(api.orderConfirmation);
  const orderId = api?.order?.id ?? thankYou?.id ?? null;
  const orderNumber = api?.order?.name ?? thankYou?.number ?? "";

  const [state, setState] = React.useState({ loading: true, data: null, error: null });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!orderId) return setState({ loading: false, data: null, error: "Sin ID de pedido" });

        const res = await fetch("/apps/modo/qr?orderId=" + encodeURIComponent(orderId));
        if (!res.ok) throw new Error("No se pudo obtener el QR");
        const data = await res.json();
        if (!cancelled) setState({ loading: false, data, error: null });
      } catch (e) {
        if (!cancelled) setState({ loading: false, data: null, error: e.message });
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  if (state.loading) return <Text>Generando QR de MODO…</Text>;
  if (state.error) return <Text appearance="critical">{state.error}</Text>;

  return (
    <BlockStack spacing="loose">
      <Text size="large" emphasis="bold">Pagá con MODO</Text>
      {state?.data?.qr && (
        <Image source={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(state.data.qr)}`} />
      )}
      <Button to={state?.data?.deeplink} target="_blank">Abrir MODO</Button>
      <Text size="small">Pedido #{orderNumber}</Text>
    </BlockStack>
  );
}

