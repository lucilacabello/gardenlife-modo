import {
  reactExtension,
  BlockStack,
  Text,
  Button,
  Banner,
  Modal,
  Spinner,
  InlineStack,
  useExtensionApi,
  useEmail,
  useShippingAddress,
  useDeliveryGroups,
  useToast,
  useBuyerJourneyIntercept,
} from '@shopify/ui-extensions-react/checkout';
import {useCallback, useEffect, useMemo, useState} from 'react';

export default reactExtension('purchase.checkout.block.render', () => <ModoPay />);

function ModoPay() {
  const { checkout } = useExtensionApi();
  const { email } = useEmail();
  const { shippingAddress } = useShippingAddress();
  const { deliveryGroups } = useDeliveryGroups();
  const { show } = useToast();

  // --- Config básica / textos
  const now = new Date();
  const promo = now >= new Date('2025-11-30T00:00:00-03:00') && now <= new Date('2025-12-02T23:59:59-03:00');
  const REINTEGRO = 20;
  const btnLabel = promo ? `Pagar con MODO — ${REINTEGRO}% de reintegro` : 'Pagar con MODO';

  // --- Monto seguro
  const rawTotal = Number(checkout?.totalAmount?.amount ?? 0);
  const amount = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;

  // --- Validaciones como el nativo
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

  const missing: string[] = [];
  if (!hasEmail) missing.push('Ingresá tu email.');
  if (!hasShippingSelection) missing.push('Elegí un método de envío o retiro.');
  if (!isPickup && !hasAddress) missing.push('Completá la dirección de envío.');
  if (!isPayable) missing.push('El total debe ser mayor a $0.');

  useBuyerJourneyIntercept(({canBlockProgress}) => {
    if (!canPay && canBlockProgress) {
      return {
        behavior: 'block',
        reason: 'Completa la información requerida para continuar con el pago.',
      };
    }
    return;
  });

  // --- Contexto para backend (UTF-8 safe Base64)
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
    // @ts-ignore
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  })();

  // ====== FLUJO MODAL ======
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);

  const startModo = useCallback(async () => {
    if (!canPay) {
      show('Completá los datos requeridos para pagar con MODO.');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/apps/modopay/start.json', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          amount: Number(Math.max(0, amount || 0).toFixed(2)),
          ctx,
          // mock: 1, // activar si querés simular
        }),
      });
      if (!res.ok) throw new Error('START_FAILED');
      const data = await res.json(); // { paymentId, svg, deeplink, draft_id }
      if (!data?.paymentId || !data?.svg) throw new Error('INVALID_START_PAYLOAD');

      setSvg(data.svg);
      setPaymentId(data.paymentId);
      setDraftId(data.draft_id || null);
      setOpen(true);
      setPolling(true);
    } catch (e) {
      show('No pudimos iniciar MODO. Reintentá en unos segundos.');
    } finally {
      setLoading(false);
    }
  }, [canPay, amount, ctx, show]);

  useEffect(() => {
    if (!polling || !paymentId) return;
    let stopped = false;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/apps/modopay/status/${paymentId}`);
        if (!r.ok) return;
        const s = await r.json(); // { status: 'INIT'|'PENDING'|'PAID'|'CANCELED' }
        if (s.status === 'PAID') {
          if (draftId) {
            const fin = await fetch(`/apps/modopay/finalize.json?draft_id=${draftId}`, { method: 'POST' });
            if (fin.ok) {
              const j = await fin.json(); // { ok: true, order_status_url }
              stopped = true;
              clearInterval(iv);
              setOpen(false);
              if (j?.order_status_url) {
                window.location.href = j.order_status_url;
                return;
              }
            }
          }
          stopped = true;
          clearInterval(iv);
          setOpen(false);
          show('Pago confirmado. Estamos generando tu pedido…');
        }
        if (s.status === 'CANCELED') {
          stopped = true;
          clearInterval(iv);
          setOpen(false);
          show('Pago cancelado.');
        }
      } catch {}
    }, 2000);
    return () => { if (!stopped) clearInterval(iv); };
  }, [polling, paymentId, draftId, show]);

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
        <Button kind="primary" onPress={startModo} disabled={loading}>
          {loading ? 'Preparando MODO…' : btnLabel}
        </Button>
      )}

      {open && (
        <Modal title="MODO — escaneá el QR" onClose={() => setOpen(false)}>
          <InlineStack spacing="tight" alignment="center">
            {!svg ? <Spinner /> : <div dangerouslySetInnerHTML={{ __html: svg }} />}
            <Text>Esperando confirmación…</Text>
          </InlineStack>
        </Modal>
      )}
    </BlockStack>
  );
}
