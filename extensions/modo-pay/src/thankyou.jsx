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

  const amountRaw = api?.checkout?.totalAmount?.amount;
  const raw = String(amountRaw ?? "0").replace(",", ".");
  const amountNum = Number(raw);
  const amount = Number.isFinite(amountNum) && amountNum > 0 ? fmt(amountNum) : "0.00";

  // Imprimir campos claves para diagnóstico sin stringify completo para evitar {}
  console.log('--- DIAGNOSTICO checkout ---');
  console.log('amountRaw:', amountRaw);
  console.log('checkout.totalAmount:', api?.checkout?.totalAmount);
  console.log('checkout.order:', api?.checkout?.order);
  console.log('checkout.order.id:', api?.checkout?.order?.id);
  console.log('checkout.order.orderNumber:', api?.checkout?.order?.orderNumber);
  console.log('checkout.order.name:', api?.checkout?.order?.name);

  // Intenta usar el orderNumber (número visible) o name (por si alguno existe)
  const orderIdentifier = api?.checkout?.order?.orderNumber ?? api?.checkout?.order?.name ?? "";

  const url = `https://gardenlife.com.ar/apps/modo/start.html?mode=ty&amount=${encodeURIComponent(amount)}&orderIdentifier=${encodeURIComponent(orderIdentifier)}`;

  return (
    <BlockStack spacing="loose">
      <Banner title="Pago con MODO (QR)" status="info">
        <Text>Si elegiste MODO como medio de pago manual, abrí el QR para completar el pago.</Text>
        <Text>Monto detectado: $ {amount}</Text>
      </Banner>
      <Button kind="primary" to={url}>
        Abrir QR de MODO
      </Button>
    </BlockStack>
  );
}
