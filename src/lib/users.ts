import express = require('express');
import bcrypt = require('bcrypt');
import mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'xqyy4:8w4GRz6r)%BtJG',
    database: 'rummy',
    port: 3306
});

let app = module.exports = express();

let bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

let cors = require('cors');
app.use(cors());

app.get('/api/users/', (req, res) => {


    connection.query('SELECT * FROM users', (err, rows, fields) => {
        if (err) {
            console.log(err);
        }
        res.json({
            data: rows
        });
    });
});
/**
 * POST Request for users.
 */
app.post('/api/user/create/', async (req, res) => {
    let errors = [];
    if (!req.body.username) {
        errors.push("Invalid 'username'");
    }
    if (!req.body.password) {
        errors.push("Invalid 'password'");
    }

    if (errors.length) {
        res.status(400).json({error: errors.join(',')});
        return;
    }

    let plaintextPassword = req.body.password;
    let salt = await bcrypt.genSalt();
    let hashedPassword = await bcrypt.hash(plaintextPassword, salt);

    console.log(req.body.username);
    console.log(salt);
    console.log(hashedPassword);

    let sql = 'insert into users (username, password) values (?, ?)';
    let params = [req.body.username, hashedPassword];

    connection.query(sql, params, (err, rows, fields) => {
        if (err) {
            console.log(err);
        }
        res.json({
            data: rows
        });
    });
});

app.post('/api/user/login/', async (req, res) => {
    let errors = [];
    if (!req.body.username) {
        errors.push("'username' not specified");
    }
    if (!req.body.password) {
        errors.push("'password' not specified");
    }

    let username = req.body.username;
    let password = req.body.password;

    let sql = 'select * from users where username = ?';
    let params = [username];

    connection.query(sql, params, async (err, rows, fields) => {
        if (err) {
            console.log(err);
        } else {
            if (rows[0].username.toLowerCase() === username.toLowerCase()) {
                bcrypt.compare(password, rows[0].password, function (err, res) {
                    if (err) {
                        console.log(err);
                    }
                    console.log(res);
                });
            }
        }
    });

    if (errors.length) {
        res.status(400).json({error: 'invalid username or password'});
        return;
    }
});
