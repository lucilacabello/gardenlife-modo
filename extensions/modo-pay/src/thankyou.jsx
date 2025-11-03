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

  // En Thank-You, orderId está disponible vía checkout.order.id (GID)
  const orderId = String(api?.checkout?.order?.id || "").trim();

  const startUrl = orderId
    ? `https://gardenlife.com.ar/apps/modo/start.html?orderId=${encodeURIComponent(orderId)}`
    : "https://gardenlife.com.ar/apps/modo/start.html";

  const openModo = () => {
    try { window.open(startUrl, "_blank", "noopener,noreferrer"); } catch {}
  };

  return (
    <BlockStack spacing="loose">
      <Banner title="Pago con MODO (QR)">
        <Text>
          Si elegiste MODO como medio manual, abrí el QR para finalizar el pago.
          Si ya pagaste, ignorá este mensaje.
        </Text>
      </Banner>
      <Button kind="primary" onPress={openModo}>
        Abrir QR de MODO
      </Button>
    </BlockStack>
  );
}
