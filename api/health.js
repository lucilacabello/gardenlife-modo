module.exports = (req, res) => {
  console.log("[DEBUG][HEALTH] Nueva request recibida");
  console.log("Method:", req.method);
  console.log("Headers:", req.headers);
  console.log("Query:", req.query);

  res.status(200).json({ ok: true, msg: "Health OK", time: Date.now() });
};
