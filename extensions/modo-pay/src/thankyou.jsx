import {
  reactExtension,
  BlockStack,
  Banner,
  Button,
  Text,
  useOrder,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.thank-you.block.render", () => <ModoThankYou />);

function ModoThankYou() {
  let amount = "0.00";
  try {
    const order = useOrder();
    const raw = String(order?.totalAmount?.amount ?? "0").replace(",", ".");
    const n = Number(raw);
    amount = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  } catch (e) {
    console.warn("useOrder fallback:", e);
  }

  const modoURL = `https://gardenlife.com.ar/apps/modo/start.html?mode=ty&amount=${amount}`;

  const openModo = () => {
    try {
      window.open(modoURL, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error("Error al abrir MODO:", e);
    }
  };

  return (
    <BlockStack spacing="loose">
      <Banner title="¿Pagaste con MODO (QR)?">
        <Text>
          Si elegiste <strong>MODO</strong> como medio manual, abrí el QR para completar el pago.<br/>
          Monto detectado: <strong>${amount}</strong>.
        </Text>
      </Banner>
      <Button kind="primary" onPress={openModo}>
        Abrir QR de MODO
      </Button>
    </BlockStack>
  );
}
