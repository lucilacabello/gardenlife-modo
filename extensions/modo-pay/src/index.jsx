// extensions/modo-pay/src/index.jsx
import {reactExtension, BlockStack, Text, Button, Link, useCheckout} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.checkout.block.render', () => <ModoPay />);

function ModoPay() {
  const checkout = useCheckout();
  const amount = Number(checkout?.totalAmount?.amount ?? 0).toFixed(2);

  // ✅ ahora va al proxy de Shopify, no a Vercel directo
  const href = `/apps/modo/start.html?amount=${amount}`;

  return (
    <BlockStack spacing="tight">
      <Text size="medium" emphasis="bold">MODO y Apps Bancarias</Text>
      <Text appearance="subdued">Desktop: QR para escanear.</Text>
      <Text appearance="subdued">Mobile: te llevamos a tu app bancaria/MODO.</Text>
      <Link to={href} target="_blank">
        <Button kind="primary" accessibilityLabel="Pagar con MODO">Pagar con MODO</Button>
      </Link>
    </BlockStack>
  );
}

