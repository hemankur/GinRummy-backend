let fs = require('fs'),
    https = require('https'),
    express = require('express'),
    app = express();
require('crypto');

let users = require('./lib/users');

app.use(users);

https.createServer({
    key: fs.readFileSync('src/localhost.key'),
    cert: fs.readFileSync('src/localhost.crt')
}, app).listen(55555);

app.get('/', function (req, res) {
    res.header('Content-type', 'text/html');
    return res.end('<h1>Hello, Secure World!!</h1>');
});
