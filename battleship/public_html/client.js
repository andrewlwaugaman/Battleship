/*Andrew Waugaman, Elodie Hilbert, Mingqian Fu
This is the client side code for every part of our battleship website except for the AI games.
It includes functions for users to log in to and create accounts, add or interact with friends,
and interact with the game itself. It was separated from ai.js because there are a lot of very
different functions with identical seeming jobs to the user and identical names.*/

//Keeps track of if it's the player's turn.
var isTurn = false;
//Keeps track of the rotation the player's ship will be placed at.
var rotation = [1, 0];
//Keeps track of if the user is in a game or not.
var inGame = false;
//Keeps track of if the user has made a move between the last time an update gave their turn back and now.
var madeMove = false;
//Keeps track of the user's ship positions.
var shipPlaces = [];
//Keeps track of if the score has been sent to the leaderboard.
var scoreSubmitted = false;
//Keeps track of the current leaderboard mode.
var mode = 0;

//Gets the username and password from the login page and attempts to create a new account.
function addUser(){
    var params = {
        username: document.getElementById("cusername").value,
        password: document.getElementById("cpassword").value
    };
    fetch("http://137.184.226.226:80/add/user",{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
    }).then(async (res) => {
        var response = await res.text();
        console.log(response);
        if (response == "Account created."){
            window.location.href = './home.html';
        }
    }).catch(err => {
        console.log(err.message);
    });
}

//Gets the username and password from the login page and attempts to log in to an existing account.
function login(){
    var username = document.getElementById("lusername").value;
    var password = document.getElementById("lpassword").value;
    fetch("http://137.184.226.226:80/account/login/" + username + "/" + password, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }).then(async (res) => {
        var response = await res.text();
        if (response == "SUCCESS"){
            window.location.href = './home.html';
        } else if (response == 'failed'){
            alert('Incorrect username or password, please try again');
        }
    }).catch(err => {
        console.log(err.message);
    });
}

//Asks the server for the status of the currently active game and updates both boards and various variables accordingly.
function checkGameStatus(){
    if (inGame == true){
        setTimeout(checkGameStatus, 1000);
    }
    fetch("http://137.184.226.226:80/gamestate/", {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }).then(async (res) => {
        var response = await res.text();
        if (response != "User not found." && response != "Game not found." && response != "login"){
            var parsedResponse = await JSON.parse(response);
            var status = document.getElementById("game-status");
            if (parsedResponse.gameOver){
                inGame = false;
            }
            if (isTurn && !parsedResponse.turn){
                isTurn = false;
                madeMove = false;
            } else if (!isTurn && parsedResponse.turn){
                isTurn = true;
                status.innerHTML = "Your turn."
            }
            var score = parsedResponse.score;
            var scoretext = document.getElementById("scoretext");
            scoretext.innerText = "Score: " + score;
            var shipLocations = [];
            var ships = shipPlaces.length;
            for (var i=0; i<10; i++){
                for (var j=0; j<10; j++){
                    if (parsedResponse.board[(i*10+j)] == 3){
                        var square = document.getElementById("2square"+j+"-"+i);
                        square.className = "missed";
                    } else if (parsedResponse.board[(i*10+j)] == 4){
                        var square = document.getElementById("2square"+j+"-"+i);
                        square.className = "destroyed";
                        if (shipPlaces.length == 0){
                            shipLocations.push({x: j, y: i});
                        } else {
                            ships--;
                        }
                    } else if (parsedResponse.board[(i*10+j)] == 2){
                        var square = document.getElementById("2square"+j+"-"+i);
                        square.className = "ship";
                        if (shipPlaces.length == 0){
                            shipLocations.push({x: j, y: i});
                        }
                    }
                    if (parsedResponse.enemy[(i*10+j)] == 2){
                        var square = document.getElementById("1square"+j+"-"+i);
                        square.className = "missed";
                    } else if (parsedResponse.enemy[(i*10+j)] == 3){
                        var square = document.getElementById("1square"+j+"-"+i);
                        square.className = "destroyed";
                    }
                }
            }
            if (shipPlaces.length == 0){
                shipPlaces = shipLocations;
                if (isTurn){
                    status.innerHTML = "Your turn."
                } else {
                    status.innerHTML = "Opponent's turn."
                }
            }
            if (parsedResponse.gameOver && parsedResponse.left == false){
                inGame = false;
                if (ships == 0){
                    status.innerText = "Game over, you lost.";
                } else {
                    status.innerText = "Game over, you won!";
                }
            } else if (parsedResponse.left){
                status.innerText = "Opponent left.";
            } else {
                var square = document.getElementById("opponenttext");
                square.innerText = parsedResponse.opponent + " Board";
            }
        } else if (response == "login") {
            window.location.href = './index.html';
        } else {
            console.log(parsedResponse);
        }
    }).catch(err => {
        console.log(err.message);
    });
}

//Attempts to place a ship in a location decided by the user. If the placement is successful and it's the last ship, the player starts looking for a game.
//Param x: The x coordinate the user is trying to place the ship's start at.
//Param y: The y coordinate the user is trying to place the ship's start at.
function placeShip(x, y){
    if (shipQueue.isEmpty){
        return;
    }
    var placable = true;
    for (var iterator = 0; iterator < shipQueue.peek(); iterator++) {
        var xHighlight = (x+iterator*rotation[0]);
        var yHighlight = (y+iterator*rotation[1]);
        if (0 <= xHighlight && 9 >= xHighlight && 0 <= yHighlight && 9 >= yHighlight) {
            var square = document.getElementById("2square"+xHighlight+"-"+yHighlight);
            if (square.className != "shipplacehighlighted"){
                placable = false;
            }
        } else {
            placable = false;
        }
    }
    if (placable){
        for (var iterator = 0; iterator < shipQueue.peek(); iterator++) {
            var xHighlight = (x+iterator*rotation[0]);
            var yHighlight = (y+iterator*rotation[1]);
            if (0 <= xHighlight && 9 >= xHighlight && 0 <= yHighlight && 9 >= yHighlight) {
                var square = document.getElementById("2square"+xHighlight+"-"+yHighlight);
                if (square.className == "shipplacehighlighted"){
                    square.className = "ship";
                }
                shipPlaces.push({x: xHighlight, y: yHighlight});
            }
        }
        shipQueue.dequeue();
    }
    if (shipQueue.isEmpty){
        var status = document.getElementById("game-status");
        status.innerHTML = "Waiting for game..."
        waitForGame();
    }
}

//Highlights the spaces where a ship would be placed if the user clicks.
//Param x: The x coordinate the user would place the ship's start at.
//Param y: The y coordinate the user would place the ship's start at.
function highlightSpaces(x, y){
    if (shipQueue.isEmpty){
        return;
    }
    for (var row=0; row<10; row++) {
        for (var col=0; col<10; col++) {
            var square = document.getElementById("2square"+row+"-"+col);
            if (square.className == "shipplacehighlighted"){
                square.className = "unhighlighted";
            }
        }
    }
    for (var iterator = 0; iterator < shipQueue.peek(); iterator++) {
        var xHighlight = (x+iterator*rotation[0]);
        var yHighlight = (y+iterator*rotation[1]);
        if (0 <= xHighlight && 9 >= xHighlight && 0 <= yHighlight && 9 >= yHighlight) {
            var square = document.getElementById("2square"+xHighlight+"-"+yHighlight);
            if (square.className == "unhighlighted"){
                square.className = "shipplacehighlighted";
            }
        }
    }
}

//Highlights a space on the opponent's board if it's the user's turn to indicate where the user would fire at.
//Param x: The x coordinate the user would fire at.
//Param y: The y coordinate the user would fire at.
function highlightEnemySpace(x, y){
    for (var row=0; row<10; row++) {
        for (var col=0; col<10; col++) {
            var square = document.getElementById("1square"+row+"-"+col);
            if (square.className == "targetedhighlighted"){
                square.className = "unhighlighted";
            }
        }
    }
    var square = document.getElementById("1square"+x+"-"+y);
    if (square.className == "unhighlighted" && isTurn){
        square.className = "targetedhighlighted";
    }
}

//Fires a shell at the given coordinates on the opponent's board.
//Param x: The x coordinate the user fired at.
//Param y: The y coordinate the user fired at.
function makeMove(x, y){
    var square = document.getElementById("1square"+x+"-"+y);
    if (!isTurn || square.className != "targetedhighlighted" || !inGame){
        return;
    }
    isTurn = false;
    var status = document.getElementById("game-status");
    status.innerHTML = "Opponent's turn."
    fetch("http://137.184.226.226:80/move/", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({x: x, y: y})
    }).then(async (res) => {
        var response = await res.text();
        if (response == "Hit!" || response == "Miss."){
            square = document.getElementById("1square"+x+"-"+y);
            if (response == "Hit!"){
                square.className = "destroyed";
            } else {
                square.className = "missed";
            }
        } else if (response == "login") {
            window.location.href = './index.html';
        } else {
            console.log(parsedResponse);
        }
    }).catch(err => {
        console.log(err.message);
    });
}

//This rotates the orientation the player's ship will be placed at.
function rotate(){
    var xRot = rotation[1];
    var yRot = rotation[0]*-1;
    rotation[0] = xRot;
    rotation[1] = yRot;
}

//Assigns the appropriate functions to the AI and user boards.
function assignFunctions(){
    for (var i=0; i<10; i++){
        for (var j=0; j<10; j++){
            var element = document.getElementById("2square"+i+"-"+j);
            element.setAttribute("onclick", "javascript:placeShip("+i+", "+j+")");
            element.setAttribute("onmouseover", "javascript:highlightSpaces("+i+", "+j+")");
            element.className = "unhighlighted";
        }
    }
    for (var i=0; i<10; i++){
        for (var j=0; j<10; j++){
            var element = document.getElementById("1square"+i+"-"+j);
            element.setAttribute("onclick", "javascript:makeMove("+i+", "+j+")");
            element.setAttribute("onmouseover", "javascript:highlightEnemySpace("+i+", "+j+")");
            element.className = "unhighlighted";
        }
    }
    startPrep();
    getLeaderboard(0, 0);
}

//Asks the server if the user is currently in a game, checking the game status if they and giving them ships to place otherwise.
//Also adds an event listener to detect and handle the window closing.
function startPrep(){
    window.addEventListener('beforeunload', stopFinding());
    fetch("http://137.184.226.226:80/ingame/", {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }).then(async (res) => {
        var response = await res.text();
        if (response == "In game."){
            inGame = true;
            checkGameStatus();
        } else {
            shipQueue.enqueue(5);
            shipQueue.enqueue(4);
            shipQueue.enqueue(3);
            shipQueue.enqueue(3);
            shipQueue.enqueue(2);
        }
    }).catch(err => {
        console.log(err.message);
    });
}

//Asks the server once a second if they've found a game yet. If they have the client sends the user's ship positions to the server.
function waitForGame(){
    if (inGame == false){
        setTimeout(waitForGame, 1000);
        fetch("http://137.184.226.226:80/findgame/", {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(async (res) => {
            var response = await res.text();
            if (response == "Found game."){
                inGame = true;
            } else if (response == "login") {
                window.location.href = './index.html';
            } else {
                console.log(response);
            }
        }).catch(err => {
            console.log(err.message);
        });
    } else {
        fetch("http://137.184.226.226:80/placeships/", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({positions: shipPlaces})
        }).then(async (res) => {
            var response = await res.text();
            if (response != "Success."){
                if (response == "login") {
                    window.location.href = './index.html';
                } else {
                    console.log(parsedResponse);
                }
            } else {
                checkGameStatus();
            }
        }).catch(err => {
            console.log(err.message);
        });
    }
}

//Leaves the current game. If the score hasn't been submitted, it either sends a request to leavegame if the user
//left early or endgame if the game had actually ended.
function leaveGame(){
    if (!scoreSubmitted && shipPlaces.length == 17){
        if (inGame){
            inGame = false;
            fetch("http://137.184.226.226:80/leavegame/", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            }).then(async (res) => {
                var response = await res.text();
                console.log(response);
                window.location.href = './home.html';
            }).catch(err => {
                console.log(err.message);
            });
        } else {
            fetch("http://137.184.226.226:80/endgame/", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            }).then(async (res) => {
                var response = await res.text();
                console.log(response);
                window.location.href = './home.html';
            }).catch(err => {
                console.log(err.message);
            });
        }
    } else {
        fetch("http://137.184.226.226:80/stopfinding", {
            method: 'Post',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({override: true})
        });
        window.location.href = './home.html';
    }
    scoreSubmitted = true;
}

//Sends a request to the friend whose username is in the target-friend text field.
function sendRequest() {
    var targetFriend = document.getElementById("target-friend").value;
    fetch("http://137.184.226.226:80/sendrequest/",{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({tf: targetFriend})
    }).then(async (res) => {
        var response = await res.text();
        if (response == "SUCCESS"){
            alert("Request sent");
        } else if (response == "login") {
            window.location.href = './index.html';
        } else {
            alert("The player was not found");
        }
    }).catch(err => {
        console.log(err.message);
        alert("The player was not found");
    });
}

//Accepts a friend request from the user whose username is tf.
//Param tf: The requester's username.
function accept(tf) {
    fetch("http://137.184.226.226:80/accept/",{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({tf: tf})
    }).then(async (res) => {
        var response = await res.text();
        if (response == "SUCCESS"){
            alert("Request accepted.");
            getFriends();
        } else if (response == "login") {
            window.location.href = './index.html';
        } else {
            alert("Something went wrong");
        }
    }).catch(err => {
        console.log(err.message);
        alert("Something went wrong.");
    });
}

//Rejects a friend request from the user whose username is tf.
//Param tf: The requester's username.
function reject(tf) {
    fetch("http://137.184.226.226:80/reject/",{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({tf: tf})
    }).then(async (res) => {
        var response = await res.text();
        if (response == "SUCCESS"){
            alert("Request Rejected");
            getFriends();
        } else if (response == "login") {
            window.location.href = './index.html';
        } else {
            alert("The player was not found");
        }
    }).catch(err => {
        console.log(err.message);
        alert("The player was not found");
    });
}

//Invites a friend to play a game against the user and changes the window to game.html so the user can place their ships.
//Param tf: The username of the friend being invited.
function invite(tf) {
    fetch("http://137.184.226.226:80/invite/",{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({tf: tf})
    }).then(async (res) => {
        var response = await res.text();
        if (response == "SUCCESS"){
            window.location.href = './game.html';
        } else if (response == "login") {
            window.location.href = './index.html';
        } else {
            console.log(response);
        }
    }).catch(err => {
        console.log(err.message);
        alert("The player was not found");
    });
}

//Joins a friend who invited the user to a game and changes the window to game.html so the user can place their ships.
//Param tf: The username of the friend being invited.
function join(tf) {
    fetch("http://137.184.226.226:80/join/",{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({tf: tf})
    }).then(async (res) => {
        var response = await res.text();
        if (response == "SUCCESS"){
            window.location.href = './game.html';
        } else if (response == "login") {
            window.location.href = './index.html';
        } else {
            console.log(response);
        }
    }).catch(err => {
        console.log(err.message);
        alert("The player was not found");
    });
}

//Removes a friend from the user's friend list.
//Param tf: The username of the friend being unfriended.
function unfriend(tf) {
    fetch("http://137.184.226.226:80/unfriend/",{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({tf: tf})
    }).then(async (res) => {
        var response = await res.text();
        if (response == "SUCCESS"){
            getFriends();
        } else if (response == "login") {
            window.location.href = './index.html';
        } else {
            alert("The player was not found");
        }
    }).catch(err => {
        console.log(err.message);
        alert("The player was not found");
    });
}

//Gets a list of the friends of the user and friend requests sent to the user. Friend requests
//have buttons to accept or reject the request and friends have buttons to unfriend them and
//either invite them to a game or join them in a game depending on if the friend is already
//inviting the user to a game. Also adds an event listener to detect and handle the window closing.
function getFriends() {
    while (document.getElementById('friends-info').firstChild) {
        document.getElementById('friends-info').removeChild(document.getElementById('friends-info').firstChild);
    }
    while (document.getElementById('friend-requests-info').firstChild) {
        document.getElementById('friend-requests-info').removeChild(document.getElementById('friend-requests-info').firstChild);
    }
    fetch("http://137.184.226.226:80/friends", {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }).then(async (res) => {
        var response = await res.text();
        if (response != "login"){
            response = await JSON.parse(response);
            for (var i = 0; i < response.length; i++) {
                var friendContainer = document.createElement('div');
                friendContainer.className = 'friend-container';
                document.getElementById('friends-info').appendChild(friendContainer);
                var requestUsername = document.createElement('div');
                requestUsername.className = 'friend-name';
                requestUsername.innerHTML = response[i]["username"];
                friendContainer.appendChild(requestUsername);
                if (response[i]["inviting"]){
                    var joinButton = document.createElement('button');
                    joinButton.className = 'friend-button';
                    joinButton.innerHTML = "Join";
                    var click = "join('" + response[i]["username"] + "')";
                    joinButton.setAttribute("onclick", click);
                    friendContainer.appendChild(joinButton);
                } else {
                    var inviteButton = document.createElement('button');
                    inviteButton.className = 'friend-button';
                    inviteButton.innerHTML = "Invite";
                    var click = "invite('" + response[i]["username"] + "')";
                    inviteButton.setAttribute("onclick", click);
                    friendContainer.appendChild(inviteButton);
                }
                var unfriendButton = document.createElement('button');
                unfriendButton.className = 'friend-button';
                unfriendButton.innerHTML = "Unfriend";
                var click = "unfriend('" + response[i]["username"] + "')";
                unfriendButton.setAttribute("onclick", click);
                friendContainer.appendChild(unfriendButton);
            }
        } else {
            window.location.href = './index.html';
        }
    }).catch(err => {
        console.log(err.message);
    });
    fetch("http://137.184.226.226:80/friendrequests", {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }).then(async (res) => {
        var response = await res.text();
        if (response != "login"){
            response = await JSON.parse(response);
            for (var i = 0; i < response.length; i++) {
                var friendContainer = document.createElement('div');
                friendContainer.className = 'friend-container';
                document.getElementById('friend-requests-info').appendChild(friendContainer);
                var requestUsername = document.createElement('div');
                requestUsername.className = 'friend-name';
                requestUsername.innerHTML = response[i]["username"];
                friendContainer.appendChild(requestUsername);
                var acceptButton = document.createElement('button');
                acceptButton.className = 'friend-button';
                acceptButton.innerHTML = "Accept";
                var click = "accept('" + response[i]["username"] + "')";
                acceptButton.setAttribute("onclick", click);
                friendContainer.appendChild(acceptButton);
                var rejectButton = document.createElement('button');
                rejectButton.className = 'friend-button';
                rejectButton.innerHTML = "Reject";
                var click = "reject('" + response[i]["username"] + "')";
                rejectButton.setAttribute("onclick", click);
                friendContainer.appendChild(rejectButton);
            }
        } else {
            window.location.href = './index.html';
        }
    }).catch(err => {
        console.log(err.message);
    });
}

//This function gets the leaderboard for high scores against either other players or AI.
//Param firstToShow: The first place to show an entry for.
//Param mode: 0 if pvp leaderboard, 1 if pvAI.
function getLeaderboard(firstToShow, mode) {
    fetch("http://137.184.226.226:80/leaderboard/"+mode, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }).then(async (res) => {
        var response = await res.text();
        if (response != "login"){
            parsedResponse = JSON.parse(response);
            if (parsedResponse.length <= firstToShow || firstToShow < 0){
                return;
            }
            var option = document.getElementById("leaderboard-option");
            if (mode == 0){
                option.value = "PvP";
            } else {
                option.value = "PvAI";
            }
            var nextButton = document.getElementById('next-button');
            var click = "getLeaderboard(" + (firstToShow+10) + ", " + mode + ")";
            nextButton.setAttribute("onclick", click);
            var lastButton = document.getElementById('last-button');
            var click = "getLeaderboard(" + (firstToShow-10) + ", " + mode + ")";
            lastButton.setAttribute("onclick", click);
            var leaderboard = document.getElementById('leaderboard');
            while (document.getElementById('leaderboard').firstChild) {
                document.getElementById('leaderboard').removeChild(document.getElementById('leaderboard').firstChild);
            }
            var leaderboardRow = document.createElement('tr');
            var leaderboardUsername = document.createElement('td');
            var leaderboardPlace = document.createElement('td');
            var leaderboardScore = document.createElement('td');
            leaderboardUsername.innerText = "Username";
            leaderboardPlace.innerText = "Place";
            leaderboardScore.innerText = "Score";
            leaderboardRow.className = 'leaderboard-row';
            leaderboardUsername.className = 'leaderboard-entry';
            leaderboardPlace.className = 'leaderboard-entry';
            leaderboardScore.className = 'leaderboard-entry';
            leaderboardRow.appendChild(leaderboardUsername);
            leaderboardRow.appendChild(leaderboardPlace);
            leaderboardRow.appendChild(leaderboardScore);
            leaderboard.appendChild(leaderboardRow);
            for (var i=firstToShow; i<firstToShow+10; i++){
                leaderboardRow = document.createElement('tr');
                leaderboardUsername = document.createElement('td');
                if (i < parsedResponse.length){
                    leaderboardUsername.innerText = parsedResponse[i].username;
                } else {
                    leaderboardUsername.innerText = "n/a";
                }
                leaderboardPlace = document.createElement('td');
                if (i < parsedResponse.length){
                    leaderboardPlace.innerText = i+1;
                } else {
                    leaderboardPlace.innerText = "n/a";
                }
                leaderboardScore = document.createElement('td');
                if (i < parsedResponse.length){
                    leaderboardScore.innerText = parsedResponse[i].score;
                } else {
                    leaderboardScore.innerText = "n/a";
                }
                leaderboardRow.className = 'leaderboard-row';
                leaderboardUsername.className = 'leaderboard-entry';
                leaderboardPlace.className = 'leaderboard-entry';
                leaderboardScore.className = 'leaderboard-entry';
                leaderboardRow.appendChild(leaderboardUsername);
                leaderboardRow.appendChild(leaderboardPlace);
                leaderboardRow.appendChild(leaderboardScore);
                leaderboard.appendChild(leaderboardRow);
            }
        }
    }).catch(err => {
        console.log(err.message);
    });
}

//This function gets the leaderboard for number of wins that each player has over other non friend players.
//Param firstToShow: The first place to show an entry for.
function getPlayerLeaderboard(firstToShow) {
    fetch("http://137.184.226.226:80/leaderboard/2", {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }).then(async (res) => {
        var response = await res.text();
        if (response != "login"){
            parsedResponse = JSON.parse(response);
            if (parsedResponse.length <= firstToShow || firstToShow < 0){
                return;
            }
            var option = document.getElementById("leaderboard-option");
            option.value = "Player Wins";
            var nextButton = document.getElementById('next-button');
            var click = "getPlayerLeaderboard(" + (firstToShow+10) + ")";
            nextButton.setAttribute("onclick", click);
            var lastButton = document.getElementById('last-button');
            var click = "getPlayerLeaderboard(" + (firstToShow-10) + ")";
            lastButton.setAttribute("onclick", click);
            var leaderboard = document.getElementById('leaderboard');
            while (document.getElementById('leaderboard').firstChild) {
                document.getElementById('leaderboard').removeChild(document.getElementById('leaderboard').firstChild);
            }
            var leaderboardRow = document.createElement('tr');
            var leaderboardUsername = document.createElement('td');
            var leaderboardPlace = document.createElement('td');
            var leaderboardWins = document.createElement('td');
            leaderboardUsername.innerText = "Username";
            leaderboardPlace.innerText = "Place";
            leaderboardWins.innerText = "Wins";
            leaderboardRow.className = 'leaderboard-row';
            leaderboardUsername.className = 'leaderboard-entry';
            leaderboardPlace.className = 'leaderboard-entry';
            leaderboardWins.className = 'leaderboard-entry';
            leaderboardRow.appendChild(leaderboardUsername);
            leaderboardRow.appendChild(leaderboardPlace);
            leaderboardRow.appendChild(leaderboardWins);
            leaderboard.appendChild(leaderboardRow);
            for (var i=firstToShow; i<firstToShow+10; i++){
                leaderboardRow = document.createElement('tr');
                leaderboardUsername = document.createElement('td');
                if (i < parsedResponse.length){
                    leaderboardUsername.innerText = parsedResponse[i].username;
                } else {
                    leaderboardUsername.innerText = "n/a";
                }
                leaderboardPlace = document.createElement('td');
                if (i < parsedResponse.length){
                    leaderboardPlace.innerText = i+1;
                } else {
                    leaderboardPlace.innerText = "n/a";
                }
                leaderboardWins = document.createElement('td');
                if (i < parsedResponse.length){
                    leaderboardWins.innerText = parsedResponse[i].wins;
                } else {
                    leaderboardWins.innerText = "n/a";
                }
                leaderboardRow.className = 'leaderboard-row';
                leaderboardUsername.className = 'leaderboard-entry';
                leaderboardPlace.className = 'leaderboard-entry';
                leaderboardWins.className = 'leaderboard-entry';
                leaderboardRow.appendChild(leaderboardUsername);
                leaderboardRow.appendChild(leaderboardPlace);
                leaderboardRow.appendChild(leaderboardWins);
                leaderboard.appendChild(leaderboardRow);
            }
        }
    }).catch(err => {
        console.log(err.message);
    });
}

//This function just calls 2 other functions that need to be called when the home page is loaded.
function loadHome(){
    getLeaderboard(0, 0);
    getFriends();
}

//This function updates the leaderboard when the user looks at one of the other leaderboards.
function updateLeaderboard(){
    var option = document.getElementById("leaderboard-option").value;
    if (option == "PvP"){
        getLeaderboard(0, 0);
    } else if (option == "PvAI"){
        getLeaderboard(0, 1);
    } else {
        getPlayerLeaderboard(0);
    }
}

//Tells the server the user is no longer looking for a game, called if the user closes the window after placing their ships.
function stopFinding(){
    fetch("http://137.184.226.226:80/stopfinding", {
        method: 'Post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify()
    });
}

//This class represents a simple queue data structure.
class Queue {

    //Creates a new empty queue.
    constructor() {
        this.elements = {};
        this.head = 0;
        this.tail = 0;
    }

    //Adds an element to the end of the queue.
    //Param element: The element to be added.
    enqueue(element) {
        this.elements[this.tail] = element;
        this.tail++;
    }

    //Removes and returns an element from the beginning of the queue.
    //Returns: The element at the head of the queue.
    dequeue() {
        const item = this.elements[this.head];
        delete this.elements[this.head];
        this.head++;
        return item;
    }

    //Returns an element from the beginning of the queue.
    //Returns: The element at the head of the queue.
    peek() {
        return this.elements[this.head];
    }

    //Returns: the length of the queue.
    get length() {
        return this.tail - this.head;
    }

    //Returns: whether the queue is empty or not.
    get isEmpty() {
        return this.length === 0;
    }

}

//A queue of the user's ships to be placed.
var shipQueue = new Queue;
