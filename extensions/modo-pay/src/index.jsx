import {
  reactExtension,
  BlockStack,
  Text,
  Button,
  Link,
  Banner,
  useCheckout,
  useEmail,
  useShippingAddress,
  useDeliveryGroups,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.checkout.block.render', () => <ModoPay />);

function ModoPay() {
  const checkout = useCheckout();
  const { email } = useEmail();
  const { shippingAddress } = useShippingAddress();
  const { deliveryGroups } = useDeliveryGroups();

  const amount = Number(checkout?.totalAmount?.amount ?? 0).toFixed(2);
  const href = `/apps/modo/start.html?amount=${amount}`;

  // --- Validaciones mínimas ---
  const hasEmail = !!email?.address;
  const sa = shippingAddress || {};
  const hasAddress =
    !!sa?.firstName &&
    !!sa?.lastName &&
    !!sa?.address1 &&
    !!sa?.city &&
    !!sa?.postalCode &&
    !!sa?.countryCode &&
    (!!sa?.provinceCode || !!sa?.province);

  const hasShippingSelection = (deliveryGroups || []).some(
    g => g?.selectedDeliveryOption?.handle
  );

  const isReady = hasEmail && hasAddress && hasShippingSelection;

  const missing = [];
  if (!hasEmail) missing.push('Ingresá tu email.');
  if (!hasAddress) missing.push('Completá la dirección de envío.');
  if (!hasShippingSelection) missing.push('Elegí un método de envío.');

  return (
    <BlockStack spacing="tight">
      <Text size="medium" emphasis="bold">MODO y Apps Bancarias</Text>

      {!isReady && (
        <>
          <Banner status="critical" title="Faltan datos para pagar con MODO">
            <ul style={{ marginLeft: 16 }}>
              {missing.map(m => <li key={m}>{m}</li>)}
            </ul>
          </Banner>
          {/* SIN Link: no hay manera de abrir el proxy */}
          <Button kind="primary" disabled>
            Pagar con MODO
          </Button>
        </>
      )}

      {isReady && (
        <Link to={href} target="_blank">
          <Button kind="primary">Pagar con MODO</Button>
        </Link>
      )}
    </BlockStack>
  );
}
