import {
  reactExtension,
  BlockStack,
  Text,
  Button,
  Link,     
  Banner,
  useExtensionApi,
  useEmail,
  useShippingAddress,
  useDeliveryGroups,
} from '@shopify/ui-extensions-react/checkout';
  
export default reactExtension('purchase.checkout.block.render', () => <ModoPay />);
  
function ModoPay() {
  const { checkout } = useExtensionApi();
  const { email } = useEmail();
  const { shippingAddress } = useShippingAddress();
  const { deliveryGroups } = useDeliveryGroups();
    
  // --- Config básica ---
  // Forzamos .myshopify.com para que el proxy siempre resuelva, aunque el checkout esté en dominio custom
  const SHOP_DOMAIN = checkout?.shop?.myshopifyDomain || 'gardenlife.myshopify.com';
const PROXY_BASE = '/apps/modo';
    
  // (Opcional) ventana de promo Cyber Monday
  const now = new Date();
  const promo = now >= new Date('2025-11-30T00:00:00-03:00') && now <= new Date('2025-12-02T23:59:59-03:00');
  const REINTEGRO = 20;
  const btnLabel = promo ? `Pagar con MODO v27 — ${REINTEGRO}% de reintegro` : 'Pagar con MODO v27';
  
  // --- Monto seguro ---
  const rawTotal = Number(checkout?.totalAmount?.amount ?? 0);
  const amount = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;
            
  // --- Validaciones de datos del checkout ---
  const hasEmail = !!email?.address;
  const sa = shippingAddress || {};
  
  const hasAddress =
    !!sa?.firstName && !!sa?.lastName && !!sa?.address1 &&
    !!sa?.city && !!sa?.postalCode && !!sa?.countryCode &&
    (!!sa?.provinceCode || !!sa?.province);
    
  const hasShippingSelection = Array.isArray(deliveryGroups)
    ? deliveryGroups.some(g => g?.selectedDeliveryOption?.handle)
    : false;
            
  const selectedGroup = Array.isArray(deliveryGroups)
    ? deliveryGroups.find(g => g?.selectedDeliveryOption?.handle)
    : null;
    
  const optTitle = (selectedGroup?.selectedDeliveryOption?.title || '').toLowerCase();
  const isPickup = optTitle.includes('retiro') || optTitle.includes('pickup') || optTitle.includes('retirar');
  
  const isReady = hasEmail && hasShippingSelection && (isPickup || hasAddress);
  const isPayable = amount > 0;
  const canPay = isReady && isPayable;
  
  const missing = [];
  if (!hasEmail) missing.push('Ingresá tu email.');
  if (!hasShippingSelection) missing.push('Elegí un método de envío o retiro.');
  if (!isPickup && !hasAddress) missing.push('Completá la dirección de envío.');
  if (!isPayable) missing.push('El total debe ser mayor a $0.');
  
  // --- Contexto para backend (UTF-8 safe Base64) ---
  const ctx = (() => {
    const payload = {
      customer: { email: email?.address || '' },
      shipping_address: isPickup
        ? {
            first_name: sa.firstName || '',
            last_name:  sa.lastName  || '',
            address1:   'RETIRO EN TIENDA',
            city:       sa.city || '',
            zip:        sa.postalCode || '',
            province:   sa.provinceCode || sa.province || '',
            country:    sa.countryCode || 'AR',
            phone:      sa.phone || '',
          }
        : {
            first_name: sa.firstName || '',
            last_name:  sa.lastName  || '',
            address1:   sa.address1  || '',
            address2:   sa.address2  || '',
            city:       sa.city || '',
            zip:        sa.postalCode || '',
            province:   sa.provinceCode || sa.province || '',
            country:    sa.countryCode || '',
            phone:      sa.phone || '',
          },
      is_pickup: isPickup,
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  })();
      
  // --- App Proxy: abrir dentro del mismo checkout ---
  const href = `${PROXY_BASE}/start?amount=${Math.max(0, amount || 0).toFixed(2)}&ctx=${encodeURIComponent(ctx)}`;
            
  return (
    <BlockStack spacing="tight">
      <Text size="medium" emphasis="bold">MODO y Apps Bancarias</Text>
            
      {promo && (
        <Banner status="info" title="Promo Cyber Monday">
          Pagá con MODO y recibí {REINTEGRO}% de reintegro. Válido por tiempo limitado.
        </Banner>
      )}
            
      {!canPay ? (
        <>
          <Banner status="critical" title="Faltan datos para pagar con MODO">
            <ul style={{ marginLeft: 16 }}> 
              {missing.map(m => <li key={m}>{m}</li>)}
            </ul>
          </Banner>
          <Button kind="primary" disabled>{btnLabel}</Button>
        </>
      ) : (
        <Link to={href}>
          <Button kind="primary">{btnLabel}</Button>
        </Link>
      )}
    </BlockStack>
  );
}

