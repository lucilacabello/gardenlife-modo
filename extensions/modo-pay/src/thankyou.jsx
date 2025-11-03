import {
  reactExtension,
  BlockStack,
  Banner,
  Button,
  Text,
  useExtensionApi,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.thank-you.block.render", () => <ModoThankYou />);

function fmt(n) {
  try {
    return Number(n).toFixed(2);
  } catch {
    return "0.00";
  }
}

function ModoThankYou() {
  const api = useExtensionApi();

  // Tomamos el total del checkout; en Thank-You suele estar disponible.
  const raw = String(api?.checkout?.totalAmount?.amount ?? "0").replace(",", ".");
  const amountNum = Number(raw);
  const amount = Number.isFinite(amountNum) && amountNum > 0 ? fmt(amountNum) : "0.00";

  // Obtener el orderId del checkout completado para fallback
  const orderId = api?.checkout?.order?.id ?? "";

  const url = `https://gardenlife.com.ar/apps/modo/start.html?mode=ty&amount=${encodeURIComponent(amount)}&orderId=${encodeURIComponent(orderId)}`;

  return (
    <BlockStack spacing="loose">
      <Banner title="Pago con MODO (QR)" status="info">
        <Text>
          Si elegiste MODO como medio de pago manual, abrí el QR para completar el pago.
        </Text>
        <Text>
          Monto detectado: $ {amount}
        </Text>
      </Banner>
      <Button kind="primary" to={url}>
        Abrir QR de MODO
      </Button>
    </BlockStack>
  );
}
