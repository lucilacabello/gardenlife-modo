module.exports = (req, res) => {
  res.status(200).json({
    message: 'API funcionando correctamente',
    query: req.query
  });
};
