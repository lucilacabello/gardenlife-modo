import {
  reactExtension,
  BlockStack,
  Banner,
  Button,
  Text,
  useExtensionApi,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.thank-you.block.render", () => <ModoThankYou />);

function ModoThankYou() {
  const api = useExtensionApi();

  // Intentamos leer orderId y total desde el API del surface (sin hooks no soportados)
  const orderId =
    (api?.checkout && api.checkout.order && api.checkout.order.id) ||
    ""; // puede venir como GID

  const rawAmount =
    (api?.checkout && api.checkout.totalAmount && api.checkout.totalAmount.amount) ||
    "";

  let amount = "";
  try {
    const n = Number(String(rawAmount).replace(",", "."));
    amount = Number.isFinite(n) && n > 0 ? n.toFixed(2) : "";
  } catch {
    amount = "";
  }

  const base = "https://gardenlife.com.ar/apps/modo/start.html?mode=ty";
  const url =
    base +
    (orderId ? `&orderId=${encodeURIComponent(orderId)}` : "") +
    (amount "");

  return (
    <BlockStack spacing="loose">
      <Banner title="Pago con MODO (QR)">
        <Text>
          Si elegiste MODO como medio de pago manual, podés abrir el QR para
          finalizar el pago. Si ya pagaste, ignorá este mensaje.
        </Text>
      </Banner>
      <Button kind="primary" to={url}>
        Abrir QR de MODO
      </Button>
    </BlockStack>
  );
}
