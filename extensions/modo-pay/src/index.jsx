import {
  reactExtension,
  BlockStack,
  Text,
  Button,
  Link,
  useCheckout,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.checkout.block.render', () => <ModoPay />);

function ModoPay() {
  const checkout = useCheckout();
  const amount = Number(checkout?.totalAmount?.amount ?? 0).toFixed(2);

  // AHORA usamos el App Proxy (ruta relativa en Shopify)
  const href = `/apps/modo/start.html?amount=${amount}`;

  return (
    <BlockStack spacing="tight">
      <Text size="medium" emphasis="bold">MODO y Apps Bancarias</Text>
      <Text appearance="subdued">Desktop: vas a ver un QR para escanear con tu app.</Text>
      <Text appearance="subdued">Mobile: te llevamos a tu app bancaria/MODO para pagar.</Text>

      <Link to={href} target="_blank">
        <Button kind="primary" accessibilityLabel="Pagar con MODO">
          Pagar con MODO
        </Button>
      </Link>
    </BlockStack>
  );
}
