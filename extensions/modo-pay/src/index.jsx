import {
  reactExtension,
  BlockStack,
  Text,
  Button,
  Banner,
  useExtensionApi,
  useEmail,
  useShippingAddress,
  useDeliveryGroups,
  useCartLines,
  useBuyerJourneyIntercept,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.checkout.block.render', () => <ModoPay />);

function ModoPay() {
  const { checkout } = useExtensionApi();
  const { email } = useEmail();
  const { shippingAddress } = useShippingAddress();
  const { deliveryGroups } = useDeliveryGroups();
  const cartLines = useCartLines();

  const PROXY_BASE = "/apps/modo";

  const now = new Date();
  const promo = now >= new Date('2025-11-30T00:00:00-03:00') && now <= new Date('2025-12-02T23:59:59-03:00');
  const REINTEGRO = 20;
  const btnLabel = promo ? `Pagar con MODO — ${REINTEGRO}% de reintegro` : 'Pagar con MODO';

  const rawTotal = Number(checkout?.totalAmount?.amount ?? 0);
  const amount = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;

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

  useBuyerJourneyIntercept(({ canBlockProgress, setBlocking }) => {
    if (!canBlockProgress) return;
    if (!isReady || !isPayable) {
      setBlocking({
        reason: 'Completá los datos antes de pagar con MODO',
        errors: missing.map(m => ({ message: m })),
      });
    } else {
      setBlocking(false);
    }
  });

  const items = (cartLines ?? []).map(l => {
    const gid = l?.merchandise?.id || '';
    const variant_id = Number(gid.split('/').pop());
    return { variant_id, quantity: l?.quantity ?? 1 };
  }).filter(it => Number.isFinite(it.variant_id) && it.variant_id > 0);

  const shipping_address = isPickup
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
      };

  async function handlePay() {
    const ctx = (() => {
      const payload = {
        customer: { email: email?.address || '' },
        shipping_address,
        is_pickup: isPickup,
        items,
      };
      return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    })();

    let draftId = null;
    try {
      const resp = await fetch(`${PROXY_BASE}/shopify/draft-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: 'Pago con MODO',
          tags: ['modo','qr'],
          lineItems: items.length ? items : [{ title: 'Pago MODO', price: amount, quantity: 1 }],
          customer: { email: email?.address || '' },
          shipping_address,
          shipping_line: isPickup ? { title: 'Retiro en tienda', price: 0 } : undefined,
        })
      });
      const j = await resp.json();
      if (resp.ok && j?.draft_id) draftId = j.draft_id;
    } catch {}

    const href =
      `${PROXY_BASE}/start.html?amount=${encodeURIComponent(Math.max(0, amount || 0).toFixed(2))}` +
      `${draftId ? `&draft_id=${encodeURIComponent(draftId)}` : ''}` +
      `&ctx=${encodeURIComponent(ctx)}`;

    const nav = typeof navigate === 'function' ? navigate : (url) => { (window.top || window).location.href = url; };
    nav(href);
  }

  return (
    <BlockStack spacing="tight">
      <Text size="medium" emphasis="bold">MODO y Apps Bancarias</Text>
      {promo && (
        <Banner status="info" title="Promo Cyber Monday">
          Pagá con MODO y recibí {REINTEGRO}% de reintegro.
        </Banner>
      )}
      {!canPay ? (
        <>
          <Banner status="critical" title="Faltan datos para pagar con MODO">
            <ul style={{ marginLeft: 16 }}>{missing.map(m => <li key={m}>{m}</li>)}</ul>
          </Banner>
          <Button kind="primary" disabled>{btnLabel}</Button>
        </>
      ) : (
        <Button kind="primary" onPress={handlePay}>{btnLabel}</Button>
      )}
    </BlockStack>
  );
}
