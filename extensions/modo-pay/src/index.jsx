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

  // Total en número seguro
  const rawTotal = Number(checkout?.totalAmount?.amount ?? 0);
  const amount = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;

  // Validaciones
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

  const hasShippingSelection = Array.isArray(deliveryGroups)
    ? deliveryGroups.some(g => g?.selectedDeliveryOption?.handle)
    : false;

  // Detectar retiro (busco “retiro”/“pick up” en título)
  const selectedGroup = Array.isArray(deliveryGroups)
    ? deliveryGroups.find(g => g?.selectedDeliveryOption?.handle)
    : null;

  const optTitle = (selectedGroup?.selectedDeliveryOption?.title || '').toLowerCase();
  const isPickup =
    optTitle.includes('retiro') ||
    optTitle.includes('pickup') ||
    optTitle.includes('retirar');

  // Readiness: email + (envío o retiro) + si es envío, dirección completa
  const isReady = hasEmail && hasShippingSelection && (isPickup || hasAddress);

  // TIP: si usás JS, cambiá esto a const missing = [];
  const missing: string[] = [];
  if (!hasEmail) missing.push('Ingresá tu email.');
  if (!hasShippingSelection) missing.push('Elegí un método de envío o retiro.');
  if (!isPickup && !hasAddress) missing.push('Completá la dirección de envío.');

  // Contexto para start.html (incluye flag de retiro)
  const ctx = btoa(
    JSON.stringify({
      customer: { email: email?.address || '' },
      shipping_address: isPickup
        ? {
            first_name: sa.firstName || '',
            last_name:  sa.lastName || '',
            address1:   'RETIRO EN TIENDA',
            city:       sa.city || '',
            zip:        sa.postalCode || '',
            province:   sa.provinceCode || sa.province || '',
            country:    sa.countryCode || 'AR',
            phone:      sa.phone || '',
          }
        : {
            first_name: sa.firstName || '',
            last_name:  sa.lastName || '',
            address1:   sa.address1 || '',
            address2:   sa.address2 || '',
            city:       sa.city || '',
            zip:        sa.postalCode || '',
            province:   sa.provinceCode || sa.province || '',
            country:    sa.countryCode || '',
            phone:      sa.phone || '',
          },
      is_pickup: isPickup,
    })
  );

  // App Proxy — mismo dominio de la tienda (evita CORS)
const href = `/start.html?amount=${amount.toFixed(2)}&ctx=${encodeURIComponent(ctx)}`;
  return (
    <BlockStack spacing="tight">
      <Text size="medium" emphasis="bold">
        MODO y Apps Bancarias
      </Text>

      {!isReady && (
        <>
          <Banner status="critical" title="Faltan datos para pagar con MODO">
            <ul style={{ marginLeft: 16 }}>
              {missing.map(m => <li key={m}>{m}</li>)}
            </ul>
          </Banner>
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
