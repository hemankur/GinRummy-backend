const express = require('express');
const router = express.Router();
import bcrypt = require('bcrypt');
const auth = require('../AuthController');
const jwt = require('jsonwebtoken');
const connection = require('../lib/database');
router.get('/', (req, res) => {
    res.send('Router users');
});

/**
 * POST Request for users.
 */
router.post('/create', async (req, res) => {
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

router.post('/login', async (req, res) => {
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
                        const accessToken = auth.generateAccessToken(user);
                        const iat = jwt.decode(accessToken).iat;
                        let sql = 'update users set token = ? where username = ? ';
                        let params = [iat, user.name];
                        connection.query(sql, params, (err) => {
                            if (err) {
                                console.log(err);
                            }
                        });
                        const age = 3600 * 24 * 7;
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
/*router.post('/logout', (req, res) => {
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
});*/

/**
 * GET request to return user data
 */
router.get('/:username', auth.authenticateToken, (req, res) => {
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

module.exports = router;
