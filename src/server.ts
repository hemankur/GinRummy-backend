let fs = require('fs'),
    https = require('https'),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express();
require('crypto');

let cors = require('cors');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors({
    origin: 'https://localhost:4200',
    credentials: true
}));

let cookieParser = require('cookie-parser');
let users = require('./lib/users');

app.use(cookieParser());
app.use(users);

https.createServer({
    key: fs.readFileSync('src/localhost.key'),
    cert: fs.readFileSync('src/localhost.crt')
}, app).listen(55555);

app.get('/', function (req, res) {
    res.header('Content-type', 'text/html');
    return res.end('<h1>Hello, Secure World!!</h1>');
});
