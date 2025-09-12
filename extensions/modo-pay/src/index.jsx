import {
  reactExtension,
  BlockStack,
  Text,
  Button,
  Link,
  useTotalAmount,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.checkout.block.render', () => <ModoPay />);

function ModoPay() {
  const total = useTotalAmount();
  const amount = Number(total?.amount ?? 0).toFixed(2);

  // DEV hoy (Vercel):
  const href = `https://gardenlife-modo.vercel.app/apps/modo/start.html?amount=${amount}`;

  // PROD (cuando actives App Proxy):
  // const href = `https://${location.host}/apps/modo/start?amount=${amount}`;

  return (
    <BlockStack spacing="tight">
      <Text size="medium" emphasis="bold">MODO y Apps Bancarias</Text>
      <Text appearance="subdued">Te llevamos a la pantalla de MODO (QR/deeplink) para pagar.</Text>
      <Link to={href} external>
        <Button kind="primary">Pagar con MODO</Button>
      </Link>
    </BlockStack>
  );
}
