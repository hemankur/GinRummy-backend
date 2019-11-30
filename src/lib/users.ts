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
    res.header("Access-Control-Allow-Origin", "https://localhost:4200");
    let errors = [];
    if (!req.body.username) {
        errors.push("'username' not specified");
    }
    if (!req.body.password) {
        errors.push("'password' not specified");
    }

    if (errors.length) {
        res.status(400).json({error: errors.join(',')});
        return;
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
                    message: errorMessage,
                    auth: false
                });
                return;
            } else if (rows[0].username.toLowerCase() === username.toLowerCase()) {
                bcrypt.compare(password, rows[0].password, function (err, result) {
                    if (err) {
                        console.log(err);
                    }
                    if (!result) {
                        res.json({
                            message: errorMessage,
                            auth: false
                        });
                        return;
                    } else {
                        const user = {name: rows[0].username};
                        const accessToken = generateAccessToken(user);
                        const iat = jwt.decode(accessToken).iat;
                        let sql = 'update users set token = ? where username = ? ';
                        let params = [iat, user.name];
                        connection.query(sql, params, (err) => {
                            if (err) {
                                console.log(err);
                            }
                        });
                        const age = 3600 * 60 * 24 * 7;
                        const options = {
                            maxAge: age,
                            httpOnly: true,
                            secure: true
                        };
                        res.cookie('access_token', accessToken, options);
                        res.json({message: 'success', auth: true});
                        res.end();
                    }
                });
            }
        }
    });
});

/**
 * Logout route
 */
app.post('/api/user/logout/', (req, res) => {
    let username = req.body.username;
    res.header("Access-Control-Allow-Origin", "https://localhost:4200");
    let sql = 'update users set token = ? where username = ?';
    let params = [null, username];
    connection.query(sql, params, (err, row) => {
        if (err) {
            console.log(err);
            res.json({
                message: err,
                status: false
            });
            return;
        } else {
            console.log(row);
            res.json({
                message: 'success',
                status: true
            });
        }
    });
});

/**
 * GET request to return user data
 */
app.get('/api/user/:username', authenticateToken, (req, res) => {
    res.header("Access-Control-Allow-Origin", "https://localhost:4200");
    let sql = 'SELECT username FROM users where username = ?';
    let params = [req.params.username];

    connection.query(sql, params, (err, rows) => {
        if (err) {
            console.log(err);
        } else {
            res.json({
                data: rows
            });
        }

    });
});

function authenticateToken(req, res, next) {
    res.header("Access-Control-Allow-Origin", "https://localhost:4200");
    const token = req.cookies.access_token;
    const decoded = jwt.decode(token);
    if (token === null) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        } else {
            let sql = 'select token from users where username = ?';
            let params = [decoded.name];
            connection.query(sql, params, (err, rows) => {
                if (rows[0].token === null) {
                    return res.sendStatus(403);
                } else {
                    req.user = user;
                    next()
                }
            });
        }
    });
}

function generateAccessToken(user) {
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1d'});
}



