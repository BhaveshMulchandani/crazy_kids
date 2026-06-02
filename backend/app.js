const connectDB = require('./db/db')
const express = require('express');
const app = express();
const userroutes = require('./routes/user.routes')
const cors = require('cors');

app.use(cors())

connectDB();



app.use(express.json());
app.use('/users', userroutes);



app.listen(3000,() => {
    console.log("server is running on port 3000")
})