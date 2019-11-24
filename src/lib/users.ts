import express = require('express');

require('dotenv').config();
const jwt = require('jsonwebtoken');


import bcrypt = require('bcrypt');
import mysql = require('mysql');
import {DB_PASS} from "../environments";

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: DB_PASS,
    database: 'rummy',
    port: 3306
});

let app = module.exports = express();

let bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

let cors = require('cors');
app.use(cors());

app.get('/api/users/', authenticateToken, (req, res) => {

    connection.query('SELECT * FROM users', (err, rows) => {
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


    let sql = 'insert into users (username, password) values (?, ?)';
    let params = [req.body.username, hashedPassword];

    connection.query(sql, params, (err, rows) => {
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
    let errorMessage = 'Invalid Username or Password';

    connection.query(sql, params, async (err, rows) => {
        if (err) {
            console.log(err);
        } else {
            if (rows.length === 0) {
                res.json({
                    error: errorMessage
                });
                return;
            } else if (rows[0].username.toLowerCase() === username.toLowerCase()) {
                bcrypt.compare(password, rows[0].password, function (err, result) {
                    if (err) {
                        console.log(err);
                    }
                    if (!result) {
                        res.json({
                            error: errorMessage
                        });
                        return;
                    } else {
                        const user = {name: rows[0].username};
                        const accessToken = generateAccessToken(user);
                        const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, {expiresIn: '7d'});
                        let sql = 'update users set token = ? where username = ? ';
                        let params = [refreshToken, user.name];
                        connection.query(sql, params, (err, rows) => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log(rows);
                            }
                        });
                        res.json({
                            message: 'success',
                            accessToken: accessToken,
                            refreshToken: refreshToken
                        });
                    }
                });
            }
        }
    });

    if (errors.length) {
        res.status(400).json({error: errors});
        return;
    }
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token === null) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next()
    });
}

function generateAccessToken(user) {
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1m'});
}
