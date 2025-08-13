const { validateMessage } = require('../utils/validateMessage');

const receiveMessage = (req, res) => {
  const { error, value } = validateMessage(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { phone, text, author } = value;

  // Emitir a todos los sockets conectados
  req.io.emit('smsReceived', {
    phone,
    body: text,
    author,
  });

  console.log('📤 Mensaje emitido a sockets:', { phone, text, author });

  return res.status(200).json({ success: true });
};

module.exports = { receiveMessage };
