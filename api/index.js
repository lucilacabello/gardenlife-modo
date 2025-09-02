import {
  reactExtension,
  Button,
  Modal,
  Image,
  useApi,
} from "@shopify/ui-extensions-react/checkout";
import React from "react";

export default reactExtension(
  "purchase.checkout.payment-methods.render-after",
  () => <ModoPay />
);

function ModoPay() {
  const api = useApi();

  const [open, setOpen] = React.useState(false);
  const [qrSrc, setQrSrc] = React.useState<string | null>(null);
  const [paymentId, setPaymentId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onPayWithModo() {
    setError(null);
    try {
      // 1) Tomar el total del checkout
      const amount = api.cost.totalAmount.amount;

      // 2) Llamar a TU App Proxy (debe apuntar a Vercel /api/modo/qr)
      const res = await fetch(`/apps/modo/qr?amount=${amount}`, { method: "GET" });
      const data = await res.json();

      if (!res.ok || !data?.qrBase64 || !data?.paymentId) {
        throw new Error(data?.error || "INIT_FAIL");
      }

      // 3) Mostrar QR en modal
      setQrSrc(`data:image/png;base64,${data.qrBase64}`);
      setPaymentId(data.paymentId);
      setOpen(true);

      // 4) Empezar polling de estado
      startPolling(data.paymentId);
    } catch (e) {
      setError("No pudimos iniciar MODO. Intentá nuevamente.");
    }
  }

  function startPolling(id: string) {
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/apps/modo/status/${id}`);
        const s = await r.json(); // { status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'EXPIRED' }

        if (s?.status === "APPROVED") {
          clearInterval(iv);
          setOpen(false);
          // MVP: el usuario finaliza con "Pay now".
          // (Para automatizar 100% la orden se necesita Payments App.)
        }
        if (s?.status === "REJECTED" || s?.status === "EXPIRED") {
          clearInterval(iv);
          setOpen(false);
          setError("El pago fue rechazado o expiró. Probá nuevamente.");
        }
      } catch {
        // silencio, reintenta en el próximo tick
      }
    }, 2000);
  }

  return (
    <>
      {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}

      <Button onPress={onPayWithModo}>Pagar con MODO</Button>

      {open && (
        <Modal title="Escaneá con MODO" onClose={() => setOpen(false)}>
          {qrSrc ? <Image source={qrSrc} alt="QR MODO" /> : "Generando QR…"}
        </Modal>
      )}
    </>
  );
}

    </>
  );
}
