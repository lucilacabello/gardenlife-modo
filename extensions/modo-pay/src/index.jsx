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

  const href = `/apps/modo/start.html?amount=${amount}`; // ahora pasa por App Proxy

  return (
    <BlockStack spacing="tight">
      <Text size="medium" emphasis="bold">MODO y Apps Bancarias</Text>
      <Link to={href} target="_blank">
        <Button kind="primary">Pagar con MODO</Button>
      </Link>
    </BlockStack>
  );
}
