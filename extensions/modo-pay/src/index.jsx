import React, { useEffect, useState } from "react";
import {
  reactExtension,
  BlockStack,
  Text,
  Image,
  Button,
  useOrder,
} from "@shopify/ui-extensions-react/checkout";

// Elegí uno (o duplicá export para probar en ambos)
export default reactExtension("purchase.thank-you.block.render", () => <ModoPayBlock />);
// export default reactExtension("checkout.order-status.block.render", () => <ModoPayBlock />);

function ModoPayBlock() {
  const order = useOrder();
  const amount = Number(order?.currentTotalPrice?.amount || 0);
  const orderId = order?.id;

  const [data, setData] = useState(null);
  const [status, setStatus] = useState("PENDING");
  const [error, setError] = useState("");

  // ✅ Ahora por App Proxy (no llamamos a Vercel directo)
  const CHECKOUT_URL = "/apps/modo/checkout";
  const STATUS_URL = (id) => `/apps/modo/status/${id}`;

  useEffect(() => {
    const create = async () => {
      setError("");
      try {
        const r = await fetch(CHECKOUT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, orderId }),
        });
        const j = await r.json();
        if (!r.ok || !j?.id) throw new Error(j?.error || "CREATE_FAIL");
        setData(j);
      } catch (e) {
        setError(e.message || "Error creando intención");
      }
    };
    create();
  }, []);

  useEffect(() => {
    if (!data?.id) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(STATUS_URL(data.id));
        const j = await r.json();
        if (j?.status) setStatus(j.status);
      } catch (_e) {}
    }, 3500);
    return () => clearInterval(iv);
  }, [data?.id]);

  const accepted = status === "ACCEPTED";
  const rejected = status === "REJECTED";

  return (
    <BlockStack spacing="base">
      <Text size="medium" emphasis="bold">Pagar con MODO</Text>

      {error && <Text tone="critical">{String(error)}</Text>}

      {!accepted && !rejected && data?.qr && (
        <>
          <Image source={data.qr} description="QR de MODO" />
          {data?.deeplink && (
            <Button to={data.deeplink} kind="primary">Abrir en MODO</Button>
          )}
          <Text appearance="subdued">Escaneá el QR o abrí la app. Vence en ~10 min.</Text>
        </>
      )}

      {accepted && <Text tone="positive">✅ Pago acreditado con MODO</Text>}
      {rejected && <Text tone="critical">❌ Pago rechazado. Probá nuevamente.</Text>}
    </BlockStack>
  );
}
