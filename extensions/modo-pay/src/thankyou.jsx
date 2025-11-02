import {
  reactExtension,
  BlockStack,
  Text,
  Button,
  Banner,
  useExtensionApi,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.thank-you.block.render', () => <ModoThankYou />);

function ModoThankYou() {
  const api = useExtensionApi();
  const PROXY_BASE = "/apps/modo";

  // Nombre del método de pago elegido en la orden
  const paymentTitle = String(
    api?.checkout?.paymentMethods?.[0]?.name ||
    api?.checkout?.paymentMethod?.name ||
    ''
  ).toLowerCase();

  const looksLikeModo = paymentTitle.includes('modo') || paymentTitle.includes('qr');

  // Total mostrado en Thank-You
  const total = Number(api?.checkout?.totalAmount?.amount ?? 0);
  const amount = Number.isFinite(total) && total > 0 ? total : 0;

  // Contexto mínimo
  const ctx = btoa(unescape(encodeURIComponent(JSON.stringify({
    source: 'thankyou',
    payment_method: paymentTitle || '',
  }))));

  const href = `${PROXY_BASE}/start.html?mode=ty&amount=${encodeURIComponent(amount.toFixed(2))}&ctx=${encodeURIComponent(ctx)}`;

  if (!looksLikeModo) {
    return (
      <BlockStack spacing="tight">
        <Text size="medium" emphasis="bold">¿Pagaste con MODO (QR)?</Text>
        <Banner status="info">
          Si elegiste MODO como método manual, abrí el QR para completar el pago.
        </Banner>
        <Button kind="primary" to={href}>Abrir QR de MODO</Button>
      </BlockStack>
    );
  }

  return (
    <BlockStack spacing="tight">
      <Text size="medium" emphasis="bold">Finalizá tu pago con MODO</Text>
      <Banner status="success">
        Tu pedido fue creado. Generá tu QR para pagar con MODO. Al finalizar volverás a esta página.
      </Banner>
      <Button kind="primary" to={href}>Abrir QR de MODO</Button>
    </BlockStack>
  );
}
