const connectDB = require('./db/db')
const express = require('express');
const app = express();
const userroutes = require('./routes/user.routes')
const menuroutes = require('./routes/menu.routes')
const offerroutes = require('./routes/offer.routes')
const priceroutes = require('./routes/prices.routes')
const sessionroutes = require('./routes/session.routes')
const caferoutes = require('./routes/cafe.routes')
const invoiceroutes = require('./routes/invoice.routes')
const membershiproutes = require('./routes/membership.routes')
const adminroutes = require('./routes/admin.routes')
const notificationroutes = require('./routes/notification.routes')
const whatsappofferroutes = require('./routes/whatsappOffer.routes')
const { startOverdueSessionWatcher } = require('./services/notification.service')
const { startWhatsappOfferWorker } = require('./workers/whatsappOffer.worker')
const cors = require('cors');
const cookieParser = require("cookie-parser");

app.use(
  cors({ 
    // "http://localhost:5173"
    origin: [
            "https://crazy-kids-psi.vercel.app",
      "https://pos.sosiyo.com"
    ],
    credentials: true,
  })
);
app.use(cookieParser())

connectDB();

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use('/api/users', userroutes);
app.use('/api/menu', menuroutes)
app.use('/api/offers', offerroutes)
app.use('/api/price', priceroutes)
app.use('/api/session', sessionroutes)
app.use('/api/cafe', caferoutes)
app.use('/api/invoice', invoiceroutes)
app.use('/api/memberships', membershiproutes)
app.use('/api/admin', adminroutes)
app.use('/api/notifications', notificationroutes)
app.use('/api/whatsapp-offers', whatsappofferroutes)

app.listen(5000, () => {
  console.log("server is running on port 5000")
  startOverdueSessionWatcher();
  try {
    startWhatsappOfferWorker();
  } catch (error) {
    // Missing/unreachable REDIS_URL shouldn't take the whole API down —
    // only offer-broadcast sending is affected until it's configured.
    console.error("[app] WhatsApp offer worker not started:", error.message);
  }
})
