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

  // Obtenemos solo el orderId, para dejar que start.html consulte monto correcto
  const orderId =
    (api?.checkout && api.checkout.order && api.checkout.order.id) || ""; // Puede venir como GID

  const base = "https://gardenlife.com.ar/apps/modo/start.html?mode=ty";

  // URL sin parámetro amount, solo orderId para consulta backend
  const url = orderId ? `${base}&orderId=${encodeURIComponent(orderId)}` : base;

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
