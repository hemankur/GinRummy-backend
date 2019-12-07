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
    private melds: [];

    constructor(id, player1, player2, player1Name, player2Name) {
        this.id = id;
        this.player1 = player1;
        this.player2 = player2;
        this.player1Name = player1Name;
        this.player2Name = player2Name;
        this.deck = myDeck;
        this.state = 1;
        this.melds = [];
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
            let result;
            let score = 0;
            console.log(game.p1Cards.length);
            console.log(game.p2Cards.length);
            if (game.p1Cards.length === 0) {
                for (let card of game.p2Cards) {
                    if (card.value === 'Ace') {
                        score++;
                    } else if (card.value === 'Jack') {
                        score += 11;
                    } else if (card.value === 'Queen') {
                        score += 12;
                    } else if (card.value === 'King') {
                        score += 13;
                    } else {
                        score += card.value;
                    }
                }
                result = 'Player 1 won with ' + score + ' points';
                io.sockets.to(game.player1).emit('result', {message: 'You won!'});
                io.sockets.to(game.player2).emit('result', {message: 'Sorry, you lost :('});
                console.log(result);
            }
            if (game.p2Cards.length === 0) {
                for (let card of game.p1Cards) {
                    if (card.value === 'Ace') {
                        score++;
                    } else if (card.value === 'Jack') {
                        score += 11;
                    } else if (card.value === 'Queen') {
                        score += 12;
                    } else if (card.value === 'King') {
                        score += 13;
                    } else {
                        score += card.value;
                    }
                }
                result = 'Player 2 won with ' + score + ' points';
                io.sockets.to(game.player2).emit('result', {message: 'You won!'});
                io.sockets.to(game.player1).emit('result', {message: 'Sorry, you lost :('});
                console.log(result);
            }
            io.sockets.to(game.player1).emit('updateGame', {
                cards: game.p1Cards,
                top: game.topCard,
                state: game.state,
                melds: game.melds,
                result: result
            });
            io.sockets.to(game.player2).emit('updateGame', {
                cards: game.p2Cards,
                top: game.topCard,
                state: game.state,
                melds: game.melds,
                result: result
            });
        }
    }
    setTimeout(() => {
        update(gameID);
    }, 2000);

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

    socket.on('gin', (data) => {
        let meld1 = data.meld1;
        let meld2 = data.meld2;
        let meld3 = data.meld3;

        if (!((meld1.length === 3 || meld1.length === 4) && (meld2.length === 3 || meld2.length === 4) && (meld3.length === 3 || meld3.length === 4) && ((meld1.length + meld2.length + meld3.length) === 10))) {
            socket.emit('result', {message: 'invalid melds'});
            return;
        } else {
            if (checkMeld(meld1) && checkMeld(meld2) && checkMeld(meld3)) {
                socket.emit('result', {message: 'You won!'});
            } else {
                socket.emit('result', {message: 'Sorry, Try Again!'});
            }
        }
    });

    socket.on('createMeld', (data) => {
        for (let game of GAMES) {
            if (game.id === data.gameID) {
                if (checkMeld(data.meld)) {
                    game.melds.push(data.meld);
                    if (socket.id === game.player1) {
                        for (let card of data.meld) {
                            for (let i = 0; i < game.p1Cards.length; i++) {
                                if (game.p1Cards[i].suit === card.suit && game.p1Cards[i].value === card.value) {
                                    game.p1Cards.splice(i, 1);
                                }
                            }
                        }
                    } else if (socket.id === game.player2) {
                        for (let card of data.meld) {
                            for (let i = 0; i < game.p2Cards.length; i++) {
                                if (game.p2Cards[i].suit === card.suit && game.p2Cards[i].value === card.value) {
                                    game.p2Cards.splice(i, 1);
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    socket.on('layoff', (data) => {
        let index = data.data.meld - 1;
        for (let game of GAMES) {
            if (game.id === data.gameID) {
                game.melds[index].push(data.data.card);
                if (socket.id === game.player1) {
                    for (let i = 0; i < game.p1Cards.length; i++) {
                        if (game.p1Cards[i].suit === data.data.card.suit && game.p1Cards[i].value === data.data.card.value) {
                            game.p1Cards.splice(i, 1);
                        }
                    }
                } else if (socket.id === game.player2) {
                    for (let i = 0; i < game.p2Cards.length; i++) {
                        if (game.p2Cards[i].suit === data.data.card.suit && game.p2Cards[i].value === data.data.card.value) {
                            game.p2Cards.splice(i, 1);
                        }
                    }
                }
            }
        }
    });

    socket.on('disconnect', () => {
        // reconnect
    });
})
;


function checkMeld(meld: any): boolean {
    if (meld.length === 3) {
        if ((meld[0].value === meld[1].value) && (meld[1].value === meld[2].value)) {
            return true;
        } else {
            if ((meld[0].suit === meld[1].suit) && (meld[1].suit === meld[2].suit)) {
                // check for sequence
                if ((meld[0].value === 'Ace' && meld[1].value === 2 && meld[2].value === 3) ||
                    (meld[0].value === 9 && meld[1].value === 10 && meld[2].value === 'Jack') ||
                    (meld[0].value === 10 && meld[1].value === 'Jack' && meld[2].value === 'Queen') ||
                    (meld[0].value === 'Jack' && meld[1].value === 'Queen' && meld[2].value === 'King') ||
                    (meld[0].value === 'Queen' && meld[1].value === 'King' && meld[2].value === 'Ace')) {
                    return true;
                } else if ((meld[2].value === meld[1].value + 1) && (meld[1].value === meld[0].value + 1)) {
                    return true;
                }
            }
        }
    } else if (meld.length === 4) {
        if ((meld[0].value === meld[1].value) && (meld[1].value === meld[2].value) && (meld[2].value === meld[3].value)) {
            return true;
        } else {
            if ((meld[0].suit === meld[1].suit) && (meld[1].suit === meld[2].suit) && (meld[2].suit === meld[3].suit)) {
                // check for sequence
                if ((meld[0].value === 'Ace' && meld[1].value === 2 && meld[2].value === 3 && meld[3].value === 4) ||
                    (meld[0].value === 'Jack' && meld[1].value === 'Queen' && meld[2].value === 'King' && meld[3].value === 'Ace') ||
                    (meld[0].value === 10 && meld[1].value === 'Jack' && meld[2].value === 'Queen' && meld[3].value === 'King') ||
                    (meld[0].value === 9 && meld[1].value === 10 && meld[2].value === 'Jack' && meld[3].value === 'Queen') ||
                    (meld[0].value === 8 && meld[1].value === 9 && meld[2].value === 10 && meld[3].value === 'Jack')) {
                    return true;
                } else if ((meld[3].value === meld[2].value + 1) && (meld[2].value === meld[1].value + 1) && (meld[1].value === meld[0].value + 1)) {
                    return true;
                }
            }
        }
    }
}
