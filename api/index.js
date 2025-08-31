module.exports = (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Si es una solicitud OPTIONS, responder inmediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Obtener la ruta y los parámetros
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const orderId = url.searchParams.get('orderId');
  const amount = url.searchParams.get('amount') || '50.00';
  const mock = url.searchParams.get('mock');
  
  console.log('Solicitud recibida:', req.url, 'Path:', path);
  
  // Manejar diferentes rutas
  if (path === '/modo/qr' || path === '/apps/modo/qr') {
    // Si es una solicitud de prueba o no se proporciona orderId, devolver datos de prueba
    if (mock === '1' || !orderId) {
      console.log('Devolviendo datos de prueba (mock)');
      return res.status(200).json({
        id: `mock-${orderId || 'default'}`,
        qr: '0002010102122653...DCE5',
        deeplink: 'https://www.modo.com.ar/pagar/',
        created_at: new Date().toISOString(),
        expiration_at: 600000,
        expiration_date: new Date(Date.now() + 600000).toISOString()
      });
    }
    
    // Para simplificar, siempre devolvemos datos de mock
    return res.status(200).json({
      id: `mock-${orderId}`,
      qr: '0002010102122653...DCE5',
      deeplink: 'https://www.modo.com.ar/pagar/',
      created_at: new Date().toISOString(),
      expiration_at: 600000,
      expiration_date: new Date(Date.now() + 600000).toISOString()
    });
  } 
  // Si la ruta es /test, devolver datos de prueba
  else if (path === '/test') {
    return res.status(200).json({
      message: 'API funcionando correctamente',
      query: Object.fromEntries(url.searchParams)
    });
  }
  // Ruta por defecto
  else {
    return res.status(200).json({
      message: 'API de MODO funcionando',
      endpoints: {
        test: '/test',
        modo: '/modo/qr?orderId=TEST123&mock=1',
        apps: '/apps/modo/qr?orderId=TEST123&mock=1'
      },
      requestedPath: path
    });
  }
};
