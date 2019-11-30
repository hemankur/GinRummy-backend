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
let p1initial: any;
let p2initial: any;
let topCard: any;
let removedCard: any;
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
let p1: any;
let p1Socket: any;
let p2: any;
let p2Socket: any;
let P1Cards = [];
let P2Cards = [];
let remainingDeck = [];

io.of('/games').on('connection', (socket) => {
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
                    if (!p1) {
                        p1 = decoded.name;
                        p1Socket = socket;
                    } else {
                        p2 = decoded.name;
                        p2Socket = socket;
                        createGame(p1Socket, p2Socket);
                    }
                    await socket.join(room);
                    socket.id = Math.random();
                    SOCKET_LIST[socket.id] = socket;
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
        if (socket === p1Socket) {
            console.log('p1');
            for (let i = 0; i < P1Cards.length; i++) {
                if (P1Cards[i].suit === data.suit && P1Cards[i].value === data.value) {
                    P1Cards.splice(i, 1);
                    removedCard = data;
                    myDeck.addToBottom(data);
                }
            }
        } else {
            for (let i = 0; i < P2Cards.length; i++) {
                if (P2Cards[i].suit === data.suit && P2Cards[i].value === data.value) {
                    P2Cards.splice(i, 1);
                    removedCard = data;
                    myDeck.addToBottom(data);
                }
            }
        }
        console.log(myDeck);
    });


    socket.on('topCard', (data) => {
       if (socket === p1Socket) {
           P1Cards.push(topCard);
           topCard = myDeck.draw();
       } else {
           
           P2Cards.push(topCard);
           topCard = myDeck.draw();
       }
    });
});

function initData(socket1, socket2) {
    let cards: any;
    P1Cards = p1initial;
    P2Cards = p2initial;
    cards = P1Cards;
    let data = {
        message: 'initData',
        cards: cards,
        topCard: topCard
    };
    socket1.emit('initData', data);

    cards = P2Cards;
    data = {
        message: 'initData',
        cards: cards,
        topCard: topCard
    };
    socket2.emit('initData', data);
    dataUpdate(socket1, socket2);
}

function dataUpdate(socket1, socket2) {
    let data1 = {
        cards: P1Cards,
        topCard: topCard,
        removedCard: removedCard
    };
    let data2 = {
        cards: P2Cards,
        topCard: topCard,
        removedCard: removedCard
    };

    setTimeout(() => {
        socket1.emit('dataUpdate', data1);
        socket2.emit('dataUpdate', data2);
        dataUpdate(socket1, socket2);

    }, 1000);
}

function createGame(socket1, socket2) {
    p1initial = myDeck.drawRandom(10);
    p2initial = myDeck.drawRandom(10);
    topCard = myDeck.draw();
    initData(socket1, socket2);
}

/*setInterval(() => {
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

}, 1000 / 25); // 25 FPS*/

