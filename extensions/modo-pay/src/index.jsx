import React, { useEffect, useState } from "react";
import {
  reactExtension,
  BlockStack,
  Text,
  Image,
  Button,
  useOrder,
} from "@shopify/ui-extensions-react/checkout";

// Podés usar cualquiera de los dos puntos de inserción:
export default reactExtension("purchase.thank-you.block.render", () => <ModoPayBlock />);
// o: export default reactExtension("checkout.order-status.block.render", () => <ModoPayBlock />);

function ModoPayBlock() {
  const order = useOrder();
  const amount = Number(order?.currentTotalPrice?.amount || 0);
  const orderId = order?.id;

  const [data, setData] = useState(null);
  const [status, setStatus] = useState("PENDING");
  const [error, setError] = useState("");

  // Si configuraste App Proxy, podés llamar '/apps/modo/checkout'.
  // Si no, usa el dominio público de Vercel:
  const CHECKOUT_URL = "https://gardenlife-modo.vercel.app/api/modo/checkout";
  const STATUS_URL = (id) => `https://gardenlife-modo.vercel.app/api/modo/status/${id}`;

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
        if (!r.ok) throw new Error(j?.error || "CREATE_FAIL");
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
      } catch (e) {}
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
          <Text appearance="subdued">Escaneá el QR o abrí la app. Vence ~10 minutos.</Text>
        </>
      )}

      {accepted && <Text tone="positive">✅ Pago acreditado con MODO</Text>}
      {rejected && <Text tone="critical">❌ Pago rechazado. Probá nuevamente.</Text>}
    </BlockStack>
  );
}
