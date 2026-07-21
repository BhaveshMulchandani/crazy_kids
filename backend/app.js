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
app.use('/users', userroutes);
app.use('/menu', menuroutes)
app.use('/offers', offerroutes)
app.use('/price', priceroutes)
app.use('/session', sessionroutes)
app.use('/cafe', caferoutes)
app.use('/invoice', invoiceroutes)
app.use('/memberships', membershiproutes)
app.use('/admin', adminroutes)
app.use('/notifications', notificationroutes)
app.use('/whatsapp-offers', whatsappofferroutes)

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
