import express = require('express');

require('dotenv').config();
const jwt = require('jsonwebtoken');

import mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASS,
    database: 'rummy',
    port: 3306
});

let app = module.exports = express();

let bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

let cors = require('cors');
app.use(cors({
    origin: 'https://localhost:4200',
    credentials: true
}));

/**
 * Create new game
 */
app.post('/api/games/create/', (req, res) => {
    let gameID = req.body.gameID;
    res.header("Access-Control-Allow-Origin", "https://localhost:4200");
    let sql = 'insert into games (gameID) values (?)';
    let params = [gameID];
    connection.query(sql, params, (err, row) => {
        if (err) {
            console.log(err);
            res.json({
                message: err,
                status: false
            });
            return;
        } else {
            res.json({
                message: 'success',
                status: true
            });
        }
    });
});

/**
 * Get list of all games
 */
app.get('/api/games/', (req, res) => {
    let sql = 'select gameID from games';
    let params = [];
    connection.query(sql, params, (err, rows) => {
        if (err) {
            console.log(err);
            res.json({
                message: err,
                status: false
            });
            return;
        } else {
            res.json({
                message: 'success',
                games: rows
            });
        }
    });
});

/**
 * POST request to fetch game data
 */
app.post('/api/games/data/', (req, res) => {
    let sql = 'select * from games where gameID = ?';
    let params = [req.body.gameID];
    connection.query(sql, params, (err, rows) => {
        if (err) {
            console.log(err);
            res.json({
                message: err,
                status: false
            });
            return;
        } else {
            res.json({
                message: 'success',
                games: rows
            });
        }
    });
});

/**
 * Join a  game
 */
app.post('/api/games/join/', (req, res) => {
    let gameID = req.body.gameID;
    res.header("Access-Control-Allow-Origin", "https://localhost:4200");
    let sql = 'select * from games where gameID  = ?';
    let params = [gameID];
    connection.query(sql, params, (err, row) => {
        if (err) {
            console.log(err);
            res.json({
                message: err,
                status: false
            });
            return;
        } else if (req.body.username === row[0].player1 || req.body.username === row[0].player2) {
            res.json({
                message: 'success',
                status: true
            });
        } else {
            if (row[0].player1) {
                if (row[0].player2) {
                    res.json({
                        message: 'room full',
                        status: false
                    });
                    return;
                } else {
                    let sql = 'update games set player2 = ?, status = ? where gameID = ?';
                    let params = [req.body.username, 'ready', req.body.gameID];
                    connection.query(sql, params, (err, row) => {
                        if (err) {
                            res.json({
                                message: err,
                                status: false
                            });
                            return;
                        } else {
                            res.json({
                                message: 'success',
                                status: true,
                                data: row
                            });
                            return;
                        }
                    });
                }
            } else {
                let sql = 'update games set player1 = ? where gameID = ?';
                let params = [req.body.username, req.body.gameID];
                connection.query(sql, params, (err, row) => {
                    if (err) {
                        res.json({
                            message: err,
                            status: false
                        });
                        return;
                    } else {
                        res.json({
                            message: 'success',
                            status: true,
                            data: row
                        });
                        return;
                    }
                });
            }
        }
    });
});
