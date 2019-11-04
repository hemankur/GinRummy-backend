import sqlite3 = require('sqlite3');

const DBSOURCE = 'db.sqlite';

function dbRun(db, command, params) {
    db.run(command, params, (err) => {
        if (err) {
            console.log(err);
        }
    });
}

let db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.log(err.message);
        throw err;
    } else {
        process.stdout.write('Connecting to the SQLite database... ');
        dbRun(db, `CREATE TABLE IF NOT EXISTS users (
            username TEXT UNIQUE,
            password TEXT
        )`, []);
    }
});

module.exports = db;
