export default function handler(req, res) {
  res
    .status(200)
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    .send('<b>OK</b> – gardenlife-modo up');
}
