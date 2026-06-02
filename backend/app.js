const connectDB = require('./db/db')
const express = require('express');
const app = express();
const userroutes = require('./routes/user.routes')

connectDB();

app.use(express.json());
app.use('/users', userroutes);



app.listen(3000)