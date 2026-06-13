const connectDB = require('./db/db')
const express = require('express');
const app = express();
const userroutes = require('./routes/user.routes')
const menuroutes = require('./routes/menu.routes')
const offerroutes = require('./routes/offer.routes')
const priceroutes = require('./routes/prices.routes')
const sessionroutes = require('./routes/session.routes')
const cors = require('cors');
const cookieParser = require("cookie-parser");

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(cookieParser())

connectDB();



app.use(express.json());
app.use('/users', userroutes);
app.use('/menu',menuroutes)
app.use('/offers',offerroutes)
app.use('/price',priceroutes)
app.use('/session',sessionroutes)



app.listen(3000,() => {
    console.log("server is running on port 3000")
})