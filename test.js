const Genyo = require('./index');
require('dotenv').config();

(async() => {
    const acc = new Genyo(process.env.USERID, process.env.PASSWORD);
    await acc.authenticate()
})()
