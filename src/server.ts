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

app.use(cookieParser());
app.use(users);

let server = https.createServer({
    key: fs.readFileSync('src/localhost.key'),
    cert: fs.readFileSync('src/localhost.crt')
}, app).listen(55555);

app.get('/', function (req, res) {
    res.header('Content-type', 'text/html');
    return res.end('<h1>Hello, Secure World!!</h1>');
});


let SOCKET_LIST = {};
let PLAYER_LIST = {};
let PLAYER_COUNT = 0;
let Deck = require('card-deck');
const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'Jack', 'Queen', 'King', 'Ace'];
let cards = [];
for (let suit of suits) {
    for (let value of values) {
        cards.push({suit: suit, value: value});
    }
}
let myDeck = new Deck(cards);
myDeck = myDeck.shuffle();
let playerOneCards = myDeck.drawRandom(10);
let playerTwoCards = myDeck.drawRandom(10);
let Player = (id, name, cards, room) => {
    let self = {
        name: name,
        id: id,
        cards: cards,
        room: room
    };
    // @ts-ignore
    self.updatePosition = () => {
        /*console.log('test');*/
    };
    return self;
};

let io = require('socket.io')(server);
let socketCookieParser = require('socket.io-cookie');
io.use(socketCookieParser);

const gameRooms = [1, 2, 3, 4, 5];
let P1Cards = [];
let P2Cards = [];
let remainingDeck = [];
io.of('/games').on('connection', (socket) => {
    initData(socket);
    dataUpdate(socket);
    socket.emit("welcome", {message: "Welcome to the games area", data: gameRooms});

    socket.on("joinRoom", (room) => {
        if (gameRooms.includes(room)) {
            const token = socket.handshake.headers['cookie'].access_token;
            if (token === undefined) {
                return socket.emit('err', 'undefined token');
            }
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (async (err, decoded) => {
                if (err) {
                    console.log(err);
                    PLAYER_COUNT--;
                    return socket.emit('err', err);
                } else {
                    await socket.join(room);
                    socket.id = Math.random();
                    SOCKET_LIST[socket.id] = socket;
                    console.log(Object.keys(PLAYER_LIST).length);
                    if (Object.keys(PLAYER_LIST).length === 2) {
                        await io.of('/games').in(room).emit('newState', {
                            message: 'update',
                        });
                    }
                    return io.of('/games').in(room).emit("newUser", {
                        message: "A new user has joined the room " + room,
                    });
                }
            }));
        } else {
            return socket.emit("err", "Invalid room");
        }
    });

    socket.on('disconnect', (data) => {

    });

    socket.on('move', (data) => {
        console.log(data);
        P1Cards.pop();
        P2Cards.pop();
    });
});

function initData(socket) {
    P1Cards = playerOneCards;
    P2Cards = playerTwoCards;
    let data = {
        message: 'initData',
        p1: playerOneCards,
        p2: playerTwoCards,
        remaining: myDeck
    };

    socket.emit('initData', data);
}

function dataUpdate(socket) {
    let data = {
        p1: P1Cards,
        p2: P2Cards,
        remaining: myDeck
    };

    setTimeout(() => {
        socket.emit('dataUpdate', data);
        dataUpdate(socket);

    }, 1000);
}

setInterval(() => {
    var pack = [];
    for (var i in PLAYER_LIST) {
        var player = PLAYER_LIST[i];
        player.updatePosition();
        pack.push({
            x: player.x,
            y: player.y,
            number: player.number
        });
    }
    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i];
        socket.emit('newPositions', pack);
    }

}, 1000 / 25); // 25 FPS

