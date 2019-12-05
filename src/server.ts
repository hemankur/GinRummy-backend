let fs = require('fs'),
    https = require('https'),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express();
require('crypto');
require('dotenv').config();

const jwt = require('jsonwebtoken');

let cors = require('cors');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use(cors({
    origin: 'https://localhost:4200',
    credentials: true
}));

let cookieParser = require('cookie-parser');
let users = require('./lib/users');
let games = require('./lib/games');

app.use(cookieParser());
app.use(users);
app.use(games);

let server = https.createServer({
    key: fs.readFileSync('src/localhost.key'),
    cert: fs.readFileSync('src/localhost.crt')
}, app).listen(55555);

app.get('/', function (req, res) {
    res.header('Content-type', 'text/html');
    return res.end('<h1>Hello, Secure World!!</h1>');
});

import mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASS,
    database: 'rummy',
    port: 3306
});

let Deck = require('card-deck');
const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'Jack', 'Queen', 'King', 'Ace'];
let cards = [];
for (let suit of suits) {
    for (let value of values) {
        cards.push({suit: suit, value: value});
    }
}
let GAMES = [];
let myDeck = new Deck(cards);
myDeck = myDeck.shuffle();

class Game {
    private readonly id: string;
    private player1: string;
    private player2: string;
    private player1Name: string;
    private player2Name: string;
    private deck: any;
    private p1Cards: any;
    private p2Cards: any;
    private topCard: any;
    private state: number;

    constructor(id, player1, player2, player1Name, player2Name) {
        this.id = id;
        this.player1 = player1;
        this.player2 = player2;
        this.player1Name = player1Name;
        this.player2Name = player2Name;
        this.deck = myDeck;
        this.state = 1;
    }

    deal() {
        this.deck.shuffle();
        this.p1Cards = this.deck.drawRandom(10);
        this.p2Cards = this.deck.drawRandom(10);
        this.topCard = this.deck.drawRandom(1);
    }

    sendData() {
        io.sockets.to(this.player1).emit('initData', {cards: this.p1Cards, top: this.topCard});
        io.sockets.to(this.player2).emit('initData', {cards: this.p2Cards, top: this.topCard});
    }
}

let io = require('socket.io')(server);
let socketCookieParser = require('socket.io-cookie');
io.use(socketCookieParser);

function startGame(gameID, players) {
    /*console.log(io.sockets.clients(players[0]).nickname);*/
    let ns = io.of("/");
    let player1 = ns.connected[players[0]];
    let player2 = ns.connected[players[1]];
    let game = new Game(gameID, players[0], players[1], player1.nickname, player2.nickname);
    game.deal();
    game.sendData();
    GAMES.push(game);
}

function update(gameID) {
    for (let game of GAMES) {
        if (game.id === gameID) {
            io.sockets.to(game.player1).emit('updateGame', {cards: game.p1Cards, top: game.topCard});
            io.sockets.to(game.player2).emit('updateGame', {cards: game.p2Cards, top: game.topCard});
        }
    }
    setTimeout(() => {
        update(gameID);
    }, 1000);

}

io.on('connection', (socket) => {
    socket.on('init', (data) => {
        socket.nickname = data.username;
        update(data.gameID);
        let sql = 'select * from games where gameID = ?';
        let params = [data.gameID];
        connection.query(sql, params, (err, row) => {
            if (err) {
                socket.emit('err', err);
            } else {
                if (row[0].player1 === data.username || row[0].player2 === data.username) {
                    socket.join(data.gameID);
                    let players = io.sockets.adapter.rooms[data.gameID].sockets;
                    /*console.log(io.sockets.adapter.rooms[data.gameID].sockets);*/
                    if (Object.keys(players).length >= 2) {
                        if (row[0].status === 'ready') {
                            io.sockets.in(data.gameID).emit('initData', {data: 'test'});
                            startGame(data.gameID, Object.keys(players));
                            let sql = 'update games set status = ? where gameID = ?';
                            let params = ['playing', data.gameID];
                            connection.query(sql, params, (err) => {
                                if (err) {
                                    console.log(err);
                                    socket.emit('err', err);
                                }
                            });
                        }
                    }
                }
            }
        });
    });

    socket.on('move', (data) => {
        for (let game of GAMES) {
            if (game.id === data.gameID) {
                if (socket.id === game.player1 && game.state === 2) {
                    for (let i = 0; i < game.p1Cards.length; i++) {
                        if (game.p1Cards[i].suit === data.card.suit && game.p1Cards[i].value === data.card.value) {
                            game.p1Cards.splice(i, 1);
                            game.deck.addToBottom(game.topCard);
                            game.topCard = data.card;
                            game.deck.addToBottom(data.card);
                        }
                    }
                    game.state = 3;
                } else if (socket.id === game.player2 && game.state === 4) {
                    for (let i = 0; i < game.p2Cards.length; i++) {
                        if (game.p2Cards[i].suit === data.card.suit && game.p2Cards[i].value === data.card.value) {
                            game.p2Cards.splice(i, 1);
                            game.deck.addToBottom(game.topCard);
                            game.topCard = data.card;
                            game.deck.addToBottom(data.card);
                        }
                    }
                    game.state = 1;

                }
            }
        }
    });


    socket.on('topCard', (data) => {
        for (let game of GAMES) {
            if (game.id === data.gameID) {
                if (socket.id === game.player1 && game.state === 1) {
                    game.p1Cards.push(game.topCard);
                    game.topCard = game.deck.draw();
                    game.state = 2;
                } else if (socket.id === game.player2 && game.state === 3) {
                    game.p2Cards.push(game.topCard);
                    game.topCard = game.deck.draw();
                    game.state = 4;
                }
            }
        }
    });

    socket.on('newCard', (data) => {
        for (let game of GAMES) {
            if (game.id === data.gameID) {
                if (socket.id === game.player1 && game.state === 1) {
                    game.p1Cards.push(game.deck.draw());
                    game.state = 2;
                } else if (socket.id === game.player2 && game.state === 3) {
                    game.p2Cards.push(game.deck.draw());
                    game.state = 4;
                }
            }
        }
    });

    socket.on('myreconnect', (data) => {
        for (let game of GAMES) {
            if (game.id === data.gameID) {
                if (game.player1Name === socket.nickname) {
                    game.player1 = socket.id;
                } else if (game.player2Name === socket.nickname) {
                    game.player2 = socket.id;
                }
            }
        }
    });

    socket.on('disconnect', () => {
        // reconnect
    });
});
