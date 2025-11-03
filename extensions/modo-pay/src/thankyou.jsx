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
  const orderId = api?.checkout?.order?.id || "";
  const base = "https://gardenlife.com.ar/apps/modo/start.html?mode=ty";
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
