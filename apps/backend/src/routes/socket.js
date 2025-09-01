const express = require('express');
const router = express.Router();


router.get('/', (req, res) => {
  const orgRoom = "org_bzrwcS0qiW57b8sx"; // o dinámico
  const data={
    sid: "CH97f450932...",
    body: "Hola desde backend"
  }
  console.log("🚀 Enviando smsSend:", data);
  req.io.emit("newMessage", data);
  
  res.json({ ok: true });
});
// routes/socketTest.js

router.get("/emit", (req, res) => {
  const orgRoom="org_bzrwcS0qiW57b8sx".toLowerCase()
req.io.to(orgRoom).emit("newMessage");
  res.json({ ok: true});
});



module.exports = router;
