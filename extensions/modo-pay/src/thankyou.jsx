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

  const raw = String(api?.checkout?.totalAmount?.amount ?? "0").replace(",", ".");
  const amountNum = Number(raw);
  const amount = Number.isFinite(amountNum) && amountNum > 0 ? fmt(amountNum) : "0.00";

  // Log para debug completo del checkout
  console.log('API checkout data:', JSON.stringify(api.checkout));

  // Intenta leer orderNumber o nombre visible
  const orderNumber = api?.checkout?.order?.orderNumber ?? api?.checkout?.order?.name ?? "";

  console.log('ThankYou Modo - amount:', amount);
  console.log('ThankYou Modo - orderNumber:', orderNumber);

  const url = `https://gardenlife.com.ar/apps/modo/start.html?mode=ty&amount=${encodeURIComponent(amount)}&orderNumber=${encodeURIComponent(orderNumber)}`;

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
