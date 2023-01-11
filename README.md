# genyow

Quick Example on authenticating then getting the homepage

```js
const Genyo = require('./index');
require('dotenv').config();

(async() => {
    const acc = new Genyo(process.env.USERID, process.env.PASSWORD);
    await acc.authenticate()

    const homepage = acc.getHomepage()
    console.log(homepage) // { current: { list: [] }, expired: { count:  }, ...}
})()

```
