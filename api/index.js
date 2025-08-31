module.exports = (req, res) => {
  res.status(200).json({
    message: 'API de MODO funcionando',
    endpoints: {
      test: '/test',
      modo: '/modo/qr?orderId=TEST123&mock=1'
    }
  });
};
