/*Andrew Waugaman, Elodie Hilbert, Mingqian Fu
This is the server side code for our battleship website. It contains models for users,
boards, and leaderboard entries and it has methods to securely create or log in to accounts,
add or interact with friends, validating that the user has a valid cookie and session, playing
the game itself, and adding to or retrieving the leaderboard.*/

const mongoose = require('mongoose');
const express = require('express');
const parser = require('body-parser');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { request } = require('http');
const connection_string = 'mongodb+srv://andrewwaugaman:6kfTqr6fE0qV8Mu9@chatty.l3vkslu.mongodb.net/messages';
const port = 80;

mongoose.connect(connection_string, { useNewUrlParser: true });
mongoose.connection.on( 'error', () => {
    console.log('there is a problem');
});

var Schema = mongoose.Schema;

//This schema represents a user of battleship.
var user = new Schema({
    username: String,
    salt: String,
    hash: String,
    //If waiting is true it means the user is waiting to find another player to play against.
    waiting: Boolean,
    //The ID of the current board the player is playing on if they are playing on one.
    curBoardID: String,
    //A history of the user's battles that keeps track of the opponent, the winner, and the score of the user. Not currently used.
    //battlehistory: [{opponent: String, won: Boolean, score: Number}],
    //Keeps track of the number of wins against a player
    wins: Number,
    //A list of friends the user has. Inviting being true means the friend is inviting the user to play a game against them.
    friends: [{username: String, inviting: Boolean}],
    //A list of friend requests the user has recieved.
    requests: [{username: String}],
    //The username of the friend the user is inviting if they're inviting someone.
    inviting: String,
    //The username of the friend the user is joining if they're joining someone.
    joining: String
});
var UserMessage = mongoose.model('UserMessage', user);

//This schema represents a board that either has a game going or finished at some point.
var board = new Schema({
    //For each oceanGrid spot, 1=empty, 2=ship, 3=empty and shot, 4=ship and shot
    //For each targetGrid spot, 1=empty, 2=empty and shot, 3=ship and shot
    oceanGrid_1: [{type: Number, min: 1, max: 4}],
    targetGrid_1: [{type: Number, min: 1, max: 3}],
    oceanGrid_2: [{type: Number, min: 1, max: 4}],
    targetGrid_2: [{type: Number, min: 1, max: 3}],
    //Username of each player
    user1Name: String,
    user2Name: String,
    //Number of ships remaining for each player
    ships1: Number,
    ships2: Number,
    //Score for each player
    score1: Number,
    score2: Number,
    //For turn, 1 means it's player 1's turn, 2 means it's player 2's turn, and 0 means the game ended.
    turn: Number,
    //Keeps track of whether one of the players left prematurely.
    left: Boolean,
    //Keeps track of if the two players are friends
    friend: Boolean
});
var BoardMessage = mongoose.model('BoardMessage', board);

//This schema represents an entry on the leaderboard.
var leaderboardEntry = new Schema({
    username: String,
    score: Number,
    //0 means normal game, 1 means vs AI
    mode: Number,
    //Determines which place on the leaderboard the entry is in
    place: Number
});
var LeaderboardEntryMessage = mongoose.model('LeaderboardEntryMessage', leaderboardEntry);

let sessions = {};

//Adds a session to the current user.
//Param user: The current user.
//Returns: The user's session ID.
function addSession(user) {
    let sessionID = Math.floor(Math.random() * 10000);
    let sessionStart = Date.now();
    sessions[user] = {'sid': sessionID, 'start': sessionStart};
    return sessionID;
}

//Checks if the user has a valid session.
//Param user: The current user.
//Param sessionID: The user's session ID.
//Returns: True if the user has a valid session, false otherwise.
function doesUserHaveSession(user, sessionID) {
    let entry = sessions[user];
    if (entry != undefined) {
        return entry.sid == sessionID;
    }
    return false;
}

const SESSION_LENGTH = 3000000;

//Cleans up expired sessions, triggers every 2 seconds.
function cleanupSessions() {
    let currentTime = Date.now();
    for (var i=0; i<sessions.length; i++) {
        let sess = Object.keys(sessions)[i];
        if (sess.start + SESSION_LENGTH < currentTime) {
            console.log('removing session for user: ' + i);
            delete sessions[i];
        }
    }
}

setInterval(cleanupSessions, 2000);

//Cleans up games that aren't being played, triggers every hour.
async function cleanupGames() {
    var boards = await BoardMessage.find({}).exec();
    var i = 0;
    while (i < boards.length){
        p1 = await UserMessage.findOne({username: boards[i].user1Name}).exec();
        p2 = await UserMessage.findOne({username: boards[i].user2Name}).exec();
        if (p1 != null && p2 != null){
            if (p1.curBoardID != boards[i]._id && p2.curBoardID != boards[i]._id){
                await BoardMessage.deleteOne({_id: boards[i]._id}).exec();
                boards.splice(i, 1);
            } else {
                i++;
            }
        } else {
            i++;
        }
    }
    console.log("Boards cleared.");
}

setInterval(cleanupGames, 3600000);

//Checks if the user has a valid session and cookie.
function authenticate(req, res, next) {
    let c = req.cookies;
    if (c != undefined && c.login != undefined && c.login.username != undefined) {
        let result = doesUserHaveSession(c.login.username, c.login.sid);
        console.log(result);
        if (result == true) {
            next();
        }
    }
}

const app = express();
app.use(cookieParser());
app.use('/index.html', express.static('public_html/index.html'));
app.use('/game.html',authenticate);
app.use('/home.html',authenticate);
app.use(express.static('public_html'));
app.use( parser.text({type: '*/*'}) );

//Refreshes the user's cookie time, returning false if they don't have a valid cookie and session which generally leads to a login page redirect.
function updateSession(req, res){
    let c = req.cookies;
    if (c != undefined && c.login != undefined && c.login.username != undefined) {
        let result = doesUserHaveSession(c.login.username, c.login.sid);
        if (result == true) {
            res.cookie("login", {username: c.login.username, sid: c.login.sid}, {maxAge: 3000000});
            return true;
        }
    }
    return false;
}

//Places a player's ships on the board after they find another player to start playing against.
//Param positions: The x and y coordinates of the player's ships on the board.
app.post('/placeships', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var username = req.cookies.login.username;
    var userQuery = await UserMessage.findOne({username: username}).exec();
    if (userQuery == null){
        res.end("User not found.");
        return;
    }
    var battle = await BoardMessage.findOne({_id: userQuery.curBoardID}).exec();
    if (battle == null){
        res.end("Game not found.");
        return;
    } else {
        var player1 = battle.user1Name == username;
        var body = await JSON.parse(req.body);
        var positions = body["positions"];
        for (var i=0; i<positions.length; i++){
            var x = (Number) (positions[i]["x"]);
            var y = (Number) (positions[i]["y"]);
            if (player1){
                if (battle.oceanGrid_1[(y*10+x)] != 1){
                    console.log(username + " ship placement failed.");
                    res.end("P1 ship placement failed.");
                    return;
                }
                battle.oceanGrid_1[(y*10+x)] = 2;
                battle.ships1++;
            } else {
                if (battle.oceanGrid_2[(y*10+x)] != 1){
                    console.log(username + " ship placement failed.");
                    res.end("P2 ship placement failed.");
                    return;
                }
                battle.oceanGrid_2[(y*10+x)] = 2;
                battle.ships2++;
            }
        }
        battle.save();
        res.end("Success.");
    }
});

//Checks if the user is in a valid game and if it's their turn, then makes a move.
//If they miss their score lowers and if they hit the game checks if it's over.
//Param x: The x coordinate the user is shooting at.
//Param y: The y coordinate the user is shooting at.
app.post('/move', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var username = req.cookies.login.username;
    let userQuery = await UserMessage.findOne({username: username}).exec();
    if (userQuery == null){
        res.end("User not found.");
        return;
    }
    var battle = await BoardMessage.findOne({_id: userQuery.curBoardID}).exec();
    if (battle == null){
        res.end("Game not found.");
        return;
    } else {
        var player1 = battle.user1Name == username;
        if (player1 && battle.turn != 1 || !player1 && battle.turn != 2){
            res.end("Not your turn.");
            return;
        }
        var body = JSON.parse(req.body);
        var x = (Number) (body["x"]);
        var y = (Number) (body["y"]);
        if (player1){
            var space = (battle.oceanGrid_2)[(y*10+x)];
            if (space == 1){
                (battle.targetGrid_1)[(y*10+x)] = 2;
                (battle.oceanGrid_2)[(y*10+x)] = 3;
                battle.turn = 2;
                battle.score1 -= 10000;
                battle.save();
                res.end("Miss.");
                return;
            } else if (space == 2){
                (battle.targetGrid_1)[(y*10+x)] = 3;
                (battle.oceanGrid_2)[(y*10+x)] = 4;
                battle.ships2--;
                if (battle.ships2 == 0){
                    battle.turn = 0;
                } else {
                    battle.turn = 2;
                }
                battle.save();
                res.end("Hit!");
                return;
            } else {
                console.log("P1 move failed.");
                res.end("P1 move failed.");
                return;
            }
        } else {
            var space = (battle.oceanGrid_1)[(y*10+x)];
            if (space == 1){
                (battle.targetGrid_2)[(y*10+x)] = 2;
                (battle.oceanGrid_1)[(y*10+x)] = 3;
                battle.turn = 1;
                battle.score2 -= 10000;
                battle.save();
                res.end("Miss.");
                return;
            } else if (space == 2){
                (battle.targetGrid_2)[(y*10+x)] = 3;
                (battle.oceanGrid_1)[(y*10+x)] = 4;
                battle.ships1--;
                if (battle.ships1 == 0){
                    battle.turn = 0;
                } else {
                    battle.turn = 1;
                }
                battle.save();
                res.end("Hit!");
                return;
            } else {
                console.log("P2 move failed.");
                res.end("P2 move failed.");
                return;
            }
        }
    }
});

//Sends the current board to the player whose client requested it.
app.get('/gamestate', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var username = req.cookies.login.username;
    var userQuery = await UserMessage.findOne({username: username}).exec();
    if (userQuery == null){
        res.end("User not found.");
        return;
    }
    var battle = await BoardMessage.findOne({_id: userQuery.curBoardID}).exec();
    if (battle == null){
        res.end("Game not found.");
        return;
    } else {
        var player1 = battle.user1Name == username;
        var ready = (battle.ships1 > 0 && battle.ships2 > 0);
        if (player1){
            var response = {turn: (battle.turn == 1 && ready), board: battle.oceanGrid_1, enemy: battle.targetGrid_1,
                gameOver: (battle.turn == 0), score: battle.score1, left: battle.left, opponent: battle.user2Name};
            res.end(JSON.stringify(response));
        } else {
            var response = {turn: (battle.turn == 2 && ready), board: battle.oceanGrid_2, enemy: battle.targetGrid_2,
                gameOver: (battle.turn == 0), score: battle.score2, left: battle.left, opponent: battle.user1Name};
            res.end(JSON.stringify(response));
        }
    }
});

//Checks if there is a valid player waiting to start a game based on if the user is inviting/joining a friend or just looking
//for anyone and if there is a valid player a new board is created and both players enter the game.
app.get('/findgame', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var p1 = await UserMessage.findOne({username: req.cookies.login.username}).exec();
    if (p1 == null){
        console.log(":(");
        res.end("Cookie or user not found.");
        return;
    } else if (p1.waiting == false && p1.curBoardID != null){
            res.end("Found game.");
            return;
    }
    if (p1.inviting != null){
        var opponent = await UserMessage.findOne({'username': p1.inviting, 'waiting': true, 'curBoardID': null, 'joining': req.cookies.login.username}).exec();
    } else if (p1.joining != null){
        var opponent = await UserMessage.findOne({'username': p1.joining, 'waiting': true, 'curBoardID': null, 'inviting': req.cookies.login.username}).exec();
    } else {
        var opponent = await UserMessage.findOne({'username': {'$ne': p1.username}, 'waiting': true, 'curBoardID': null}).exec();
    }
    if (opponent != null){
        var friend = false;
        for (var i=0; i<p1.friends.length; i++){
            if (p1.friends[i].username == opponent.username){
                friend = true;
            }
        }
        p1.joining = null;
        p1.waiting = false;
        if (p1.inviting != null){
            var invitingQuery = await UserMessage.findOne({username: p1.inviting}).exec();
            for (var i=0; i<invitingQuery.friends.length; i++){
                if (invitingQuery.friends[i].username == req.cookies.login.username){
                    invitingQuery.friends[i].inviting = false;
                }
            }
            invitingQuery.save();
        }
        p1.inviting = null;
        opponent.joining = null;
        opponent.waiting = false;
        if (opponent.inviting != null){
            invitingQuery = await UserMessage.findOne({username: opponent.inviting}).exec();
            for (var i=0; i<invitingQuery.friends.length; i++){
                if (invitingQuery.friends[i].username == opponent.username){
                    invitingQuery.friends[i].inviting = false;
                }
            }
            invitingQuery.save();
        }
        opponent.inviting = null;
        var baseGrid = [];
        for (var i=0; i<100; i++){
            baseGrid[i] = 1;
        }
        var battle = new BoardMessage({user1Name: req.cookies.login.username, user2Name: opponent.username, turn: 1, ships1: 0, ships2: 0, score1: 1000000,
            score2: 1000000, oceanGrid_1: baseGrid, oceanGrid_2: baseGrid, targetGrid_1: baseGrid, targetGrid_2: baseGrid, left: false, friend: friend});
        opponent.curBoardID = battle._id;
        p1.curBoardID = battle._id;
        opponent.save();
        p1.save();
        battle.save();
        res.end("Found game.");
    } else {
        p1.waiting = true;
        p1.save();
        res.end("Waiting.");
    }
});

//Updates various variables in the user schema to reflect the fact that they are no longer
//looking for a game so they can't enter a game they won't immediately play. Only called
//if the user closes the game page while waiting for a game.
app.post('/stopfinding', async (req, res) => {
    if (req.cookies == null){
        return;
    }
    var p1 = await UserMessage.findOne({username: req.cookies.login.username}).exec();
    if (p1 == null){
        console.log("oops");
        return;
    }
    if (p1.waiting){
        p1.joining = null;
        p1.waiting = false;
        if (p1.inviting != null){
            var invitingQuery = await UserMessage.findOne({username: p1.inviting}).exec();
            for (var i=0; i<invitingQuery.friends.length; i++){
                if (invitingQuery.friends[i].username == req.cookies.login.username){
                    invitingQuery.friends[i].inviting = false;
                }
            }
            invitingQuery.save();
        }
        p1.inviting = null;
        p1.save();
    }
    res.end("Success");
});

//Checks if the user has found a game.
app.get('/ingame', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var p1 = await UserMessage.findOne({username: req.cookies.login.username}).exec();
    if (p1 == null){
        res.end("Cookie or user not found.");
        return;
    }
    if (p1.curBoardID != null){
        res.end("In game.");
    } else {
        res.end("Not in game.");
    }
});

//Ends the game the user is currently in early, allowing them to find a new one. Unless something went wrong
//with the game, a loss is added to the user's battle history to discourage doing this much.
app.post('/leavegame', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var username = req.cookies.login.username;
    var userQuery = await UserMessage.findOne({username: username}).exec();
    if (userQuery == null){
        res.end("User not found.");
        return;
    }
    var battle = await BoardMessage.findOne({_id: userQuery.curBoardID}).exec();
    if (battle == null){
        res.end("Game not found.");
        userQuery.curBoardID = null;
        userQuery.save();
        return;
    }
    var player1 = battle.user1Name == username;
    var opponentQuery = null;
    if (player1){
        var opponentQuery = await UserMessage.findOne({username: battle.user2Name}).exec();
    } else {
        var opponentQuery = await UserMessage.findOne({username: battle.user1Name}).exec();
    }
    if (opponentQuery == null){
        res.end("Opponent not found.");
        userQuery.curBoardID = null;
        userQuery.save();
        battle.left = true;
        battle.turn = 0;
        battle.save();
        return;
    } else {
        var opponent = opponentQuery.username;
    }
    if (battle.turn != 0){
        battle.left = true;
        battle.turn = 0;
        //userQuery.battlehistory.push({opponent: opponent, won: false, score: 0});
    }
    userQuery.curBoardID = null;
    userQuery.save();
    battle.save();
    res.end("Left game.");
});

//Ends a finished game, allowing the user to enter a new game. If nothing went wrong, the user won,
//and they weren't playing against a friend, a new leaderboard entry is created and the leaderboard is updated.
app.post('/endgame/', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var username = req.cookies.login.username;
    let userQuery = await UserMessage.findOne({username: username}).exec();
    if (userQuery == null){
        res.end("Player not found.");
        return;
    }
    var battle = await BoardMessage.findOne({_id: userQuery.curBoardID}).exec();
    if (battle == null){
        res.end("Game not found.");
        userQuery.curBoardID = null;
        userQuery.save();
        return;
    }
    var player1 = battle.user1Name == username;
    var opponentQuery = null;
    var score = 0;
    if (player1){
        var opponentQuery = await UserMessage.findOne({username: battle.user2Name}).exec();
        score = battle.score1;
        lost = battle.ships1 == 0;
    } else {
        var opponentQuery = await UserMessage.findOne({username: battle.user1Name}).exec();
        score = battle.score2;
        lost = battle.ships2 == 0;
    }
    if (opponentQuery == null){
        userQuery.curBoardID = null;
        userQuery.save();
        res.end("Opponent not found.");
        return;
    } else {
        var opponent = opponentQuery.username;
    }
    if (battle.left || lost){
        //userQuery.battlehistory.push({opponent: opponent, won: (!lost), score: 0});
        userQuery.curBoardID = null;
        userQuery.save();
    } else {
        //userQuery.battlehistory.push({opponent: opponent, won: true, score: score});
        userQuery.wins++;
        userQuery.curBoardID = null;
        userQuery.save();
        if (!battle.friend){
            var leaderboardEntryVar = new LeaderboardEntryMessage({
                username: username,
                score: score,
                mode: 0,
                place: null
            });
            updateLeaderboard(0, leaderboardEntryVar, score);
        }
    }
    res.end("Game ended.");
});

//Adds a game against the AI to the user's battle history and the leaderboard if they won.
app.post('/submitaiscore/', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var username = req.cookies.login.username;
    var body = JSON.parse(req.body);
    let userQuery = await UserMessage.findOne({username: username}).exec();
    if (userQuery == null){
        res.end("Player not found.");
        return;
    }
    //userQuery.battlehistory.push({opponent: "AI", won: body.won, score: body.score});
    userQuery.curBoardID = null;
    userQuery.save();
    if (body.won){
        var leaderboardEntryVar = new LeaderboardEntryMessage({
            username: username,
            score: body.score,
            mode: 1,
            place: null
        });
        updateLeaderboard(1, leaderboardEntryVar, body.score);
    }
    res.end("Game ended.");
});

//Updates the leaderboard by finding the new entry's place in the leaderboard and moving each entry after back by one.
//If there is a tie in scores between the new entry and an old entry, the new entry goes after.
//Param mode: 0 if it's a normal game, 1 if it's an AI game.
//Param entry: The entry to add to the leaderboard.
//Param score: The score of the entry being added.
async function updateLeaderboard(mode, entry, score){
    var firstPlace = await LeaderboardEntryMessage.findOne({mode: mode, place: 1});
    var place = 1;
    if (firstPlace == null){
        entry.place = 1;
        entry.save();
        return;
    }
    var curScore = firstPlace.score;
    var leaderboard = await LeaderboardEntryMessage.find({mode: mode}).sort({place: 1});
    while (curScore >= score && place < leaderboard.length){
        curScore = leaderboard[place].score;
        place++;
    }
    if (curScore >= score){
        entry.place = place+1;
        entry.save();
    } else {
        entry.place = place;
        entry.save();
        place--;
        while (place < leaderboard.length){
            leaderboard[place].place++;
            leaderboard[place].save();
            place++;
        }
    }
}

//Sends the requesting client the leaderboard of one of the game modes.
app.get('/leaderboard/:mode', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var mode = req.params.mode
    var leaderboard = null;
    if (mode != 2){
        leaderboard = await LeaderboardEntryMessage.find({mode: mode}).sort({place: 1});
    } else {
        leaderboard = await UserMessage.find({}).sort({wins: -1});
    }
    res.end(JSON.stringify(leaderboard));
});

let loginUser = '';

//Adds a new user to the database of users.
app.post('/add/user/', async (req, res) => {
    var body = JSON.parse(req.body);
    var username = body["username"];
    var password = body["password"];
    let query = UserMessage.find({username: username}).exec();
    query.then( (results) => {
        if (results.length > 0 || username == "AI"){
            res.end("Username taken.");
        } else {
            let newSalt = Math.floor((Math.random() * 1000000));
            let toHash = password + newSalt;
            var hash = crypto.createHash('sha3-256');
            let data = hash.update(toHash, 'utf-8');
            let newHash = data.digest('hex');
            var newUser = new UserMessage( {
                username: username,
                waiting: false,
                curBoardID: null,
                salt: newSalt,
                hash: newHash,
                //battlehistory: [],
                wins: 0,
                friends: [],
                requests: [],
                inviting: null,
                joining: null
            });
            let sid = addSession(username);
            res.cookie("login", {username: username, sid: sid}, {maxAge: 3000000});
            newUser.save().then( (doc) => {
                res.end('Account created.');
            });
        }
    }).catch( (error) => {
        res.end("Account creation failed.");
    });
});

//Attempts to login with the username and password givin in the parameters.
app.get('/account/login/:username/:password', (req, res) => {
    let u = req.params.username;
    let p = req.params.password;
    loginUser = u;
    let p1 = UserMessage.find({username: u}).exec();
    p1.then( (results) => {
        if (results.length == 1) {
            let existingSalt = results[0].salt;
            let toHash = p + existingSalt;
            var hash = crypto.createHash('sha3-256');
            let data = hash.update(toHash, 'utf-8');
            let newHash = data.digest('hex');
            if (newHash == results[0].hash) {
                let sid = addSession(u);
                res.cookie("login", {username: u, sid: sid}, {maxAge: 3000000});
                res.end('SUCCESS');
            } else {
                res.end('failed');
            }
        }
    });
    p1.catch( (error) => {
        res.end('failed');
    });
});

//Sends a friend request to the user whose username is sent in the body.
//Param tf: Stands for target friend, the username of the friend who's being added.
app.post('/sendrequest/', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var user = req.cookies.login.username;
    var body = JSON.parse(req.body);
    var tf = body["tf"];
    if (tf == user){
        res.end("You can't friend yourself.");
        return;
    }
    let query = UserMessage.find({username: tf}).exec();
    query.then( (results) => {
        if (results.length > 0){
            for (var i=0; i<results[0].requests.length; i++){
                if (results[0].requests[i].username == user){
                    res.end("Request already sent.");
                    return;
                }
            }
            for (var i=0; i<results[0].friends.length; i++){
                if (results[0].friends[i].username == user){
                    res.end("User already friended.");
                    return;
                }
            }
            results[0].requests.push({username: user});
            results[0].save();
            res.end("SUCCESS");
        } else {
            res.end("Not found")
        }
    }).catch( (error) => {
        res.end(error);
    });
});

//Accepts a friend request from the user whose username is sent in the body.
//Param tf: Stands for target friend, the username of the friend whose request is being accepted.
app.post('/accept/', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var user = req.cookies.login.username;
    var body = JSON.parse(req.body);
    var tf = body["tf"];
    let query = UserMessage.find({username: tf}).exec();
    query.then( (results) => {
        if (results.length > 0){
            let p1 = UserMessage.find({username: user}).exec();
            p1.then( (data) => {
                results[0].friends.push({username: data[0].username, inviting: false});
                data[0].friends.push({username: tf, inviting: false});
                var i = 0;
                var numRequests = data[0].requests.length;
                while (i<numRequests){
                    if (data[0].requests[i].username == tf){
                        data[0].requests.splice(i, 1);
                        numRequests--;
                    } else {
                        i++;
                    }
                }
                data[0].save();
                results[0].save();
            });
            res.end("SUCCESS");
        } else {
            res.end("Not found");
        }
    }).catch( (error) => {
        res.end(error);
    });
});

//Rejects a friend request from the user whose username is sent in the body.
//Param tf: Stands for target friend, the username of the friend whose request is being rejected.
app.post('/reject/', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var user = req.cookies.login.username;
    var body = JSON.parse(req.body);
    var tf = body["tf"];
    let query = UserMessage.find({username: tf}).exec();
    query.then( (results) => {
        if (results.length > 0){
            let p1 = UserMessage.find({username: user}).exec();
            p1.then( (data) => {
                var i = 0;
                var numRequests = p1.requests.length;
                while (i<numRequests){
                    if (p1.requests[i].username == results[0].username){
                        p1.requests.splice(i, 1);
                        numRequests--;
                    } else {
                        i++;
                    }
                }
                data[0].save();
                results[0].save();
            });
            res.end("SUCCESS");
        } else {
            res.end("Not found");
        }
    }).catch( (error) => {
        res.end(error);
    });
});

//Invites a friend of the user to join the user in a game.
//Param tf: Stands for target friend, the username of the friend who's being invitied to the game.
app.post('/invite', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var user = req.cookies.login.username;
    var body = JSON.parse(req.body);
    var tf = body["tf"];
    let query = UserMessage.find({username: tf}).exec();
    query.then( (results) => {
        if (results.length > 0){
            let p1 = UserMessage.find({username: user}).exec();
            p1.then( async (data) => {
                if (data[0].inviting != null){
                    var invitingQuery = await UserMessage.findOne({username: data[0].inviting}).exec();
                    for (var i=0; i<invitingQuery.friends.length; i++){
                        if (invitingQuery.friends[i].username == user){
                            invitingQuery.friends[i].inviting = false;
                        }
                    }
                    invitingQuery.save();
                }
                data[0].inviting = tf;
                for (var i=0; i<results[0].friends.length; i++){
                    if (results[0].friends[i].username == user){
                        results[0].friends[i].inviting = true;
                    }
                }
                results[0].save();
                data[0].save();
            });
            res.end("SUCCESS");
        } else {
            res.end("Not found");
        }
    }).catch( (error) => {
        res.end(error);
    });
});

//Joins a friend who's inviting the user to a game.
//Param tf: Stands for target friend, the username of the friend who's being joined.
app.post('/join', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var user = req.cookies.login.username;
    var body = JSON.parse(req.body);
    var tf = body["tf"];
    let query = UserMessage.find({username: tf}).exec();
    query.then( (results) => {
        if (results.length > 0){
            let p1 = UserMessage.find({username: user}).exec();
            p1.then( (data) => {
                if (results[0].inviting == user && results[0].curBoardID == null){
                    data[0].joining = tf;
                }
                data[0].save();
            });
            res.end("SUCCESS");
        } else {
            res.end("Not found");
        }
    }).catch( (error) => {
        res.end(error);
    });
});

//Removes a friend from the user whose username is sent in the body.
//Param tf: Stands for target friend, the username of the friend who's being removed from the user's friend list.
app.post('/unfriend', async (req, res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var user = req.cookies.login.username;
    var body = JSON.parse(req.body);
    var tf = body["tf"];
    let query = UserMessage.find({username: tf}).exec();
    query.then( (results) => {
        if (results.length > 0){
            let p1 = UserMessage.find({username: user}).exec();
            p1.then( (data) => {
                var i = 0;
                while (i<results[0].friends.length){
                    if (results[0].friends[i].username == user){
                        results[0].friends.splice(i, 1);
                    } else {
                        i++;
                    }
                }
                i = 0;
                while (i<data[0].friends.length){
                    if (data[0].friends[i].username == tf){
                        data[0].friends.splice(i, 1);
                    } else {
                        i++;
                    }
                }
                if (data[0].inviting == tf){
                    data[0].inviting = null;
                }
                if (data[0].joining == tf){
                    data[0].joining = null;
                }
                if (results[0].inviting == user){
                    results[0].inviting = null;
                }
                if (results[0].joining == user){
                    results[0].joining = null;
                }
                data[0].save();
                results[0].save();
            });
            res.end("SUCCESS");
        } else {
            res.end("Not found");
        }
    }).catch( (error) => {
        res.end(error);
    });
});

//Gets a list of the friends of the current user.
app.get('/friends', async (req,res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var user = req.cookies.login.username;
    let query = UserMessage.find({username: user}).exec();
    query.then( (results) => {
        if (results != null){
            friendInfo = [];
            for (var i=0; i<results[0].friends.length; i++){
                friendInfo[i] = {username: results[0].friends[i].username, inviting: results[0].friends[i].inviting};
            }
            res.end(JSON.stringify(friendInfo));
        }
    }).catch( (err) => {
        res.end(err);
    });
});

//Gets a list of the friend requests that have been sent to the current user.
app.get('/friendrequests', async (req,res) => {
    if (!updateSession(req, res)){
        res.end("login");
        return;
    }
    var user = req.cookies.login.username;
    let query = UserMessage.find({username: user}).exec();
    query.then( (results) => {
        if (results != null){
            res.end(JSON.stringify(results[0].requests));
        }
    }).catch( (err) => {
        res.end(err);
    });
});

//Resets a ton of things, used for debugging.
app.get('/clear', async (req, res) => {
    var users = await UserMessage.find({}).exec();
    for (var i=0; i<users.length; i++){
        console.log(users[i]);
        users[i].waiting = false;
        users[i].curBoardID = null;
        users[i].wins = 0;
        users[i].friends = [];
        users[i].requests = [];
        users[i].inviting = null;
        users[i].joining = null;
        users[i].save();
    }
    BoardMessage.deleteMany({}).exec();
    LeaderboardEntryMessage.deleteMany({}).exec();
    res.end("A");
});


//This function generates 10 random leaderboard entries of each mode along with 10 random users
//to artificially populate the leaderboard so we don't have to play a ton of games to do so. It
//also deletes all the current leaderboard entries. This function is called once daily.
async function populateLeaderboard(){
    await LeaderboardEntryMessage.deleteMany({});
    await UserMessage.deleteMany({hash: null});
    var titles = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
    for (var i=0; i<10; i++){
        var mockUser = new UserMessage( {
            username: "John the " + titles[i],
            waiting: false,
            curBoardID: null,
            //Makes it impossible to log in as a mock user
            salt: 1,
            hash: null,
            //battlehistory: [],
            wins: Math.floor(Math.random()*10),
            friends: [],
            requests: [],
            inviting: null,
            joining: null
        });
        mockUser.save();
        var score = Math.floor((Math.random()*80)+21)*10000;
        var mockEntry1 = new LeaderboardEntryMessage({
            username: "John the " + titles[i],
            score: score,
            mode: 0,
            place: null
        });
        await updateLeaderboard(0, mockEntry1, score);
        var score = Math.floor((Math.random()*80)+21)*10000;
        var mockEntry2 = new LeaderboardEntryMessage({
            username: "John the " + titles[i],
            score: score,
            mode: 1,
            place: null
        });
        await updateLeaderboard(1, mockEntry2, score);
    }
}

populateLeaderboard();
setInterval(populateLeaderboard, 86400000);

app.listen(port, () =>
  console.log('App listening at http://137.184.226.226:80:'));
