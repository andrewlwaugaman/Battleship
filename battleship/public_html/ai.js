/*Andrew Waugaman, Elodie Hilbert, Mingqian Fu
This is the client side code for the AI game part of battleship. Unlike client.js, it only
includes functions related to the game but it was separated because they work differently
from the client.js versions. It also includes functions that determine how the AI acts on
top of the game functions from client.js.*/

//Keeps track of if it's the player's turn.
var isTurn = false;
//Keeps track of the rotation the player's ship will be placed at.
var rotation = [1, 0];
//Keeps track of the rotation the ai's ships will be placed at and the next place the ai will check for a ship after getting a hit.
var aiRotation = [1, 0];
//Keeps track of if the user is in a game or not.
var inGame = false;
//Keeps track of the user's ship positions.
var shipPlaces = [];
//Keeps track of the AI's ship positions.
var aiShipPlaces = [];
//Keeps track of the remaining spaces on the board the AI can shoot at.
var aiMoves = [];
//Keeps track of the AI's next move. Next being something other than null means the AI is shooting in a line
//until it misses, check not being null means it's checking around a place where it guessed a hit for more ships.
var aiNext = {next: null, check: null};
//Keeps track of the player's score.
var score = 1000000;
//Keeps track of if the player started a game and it ended.
var gameEnded = false;
//Keeps track of the number of ships the player has left.
var playerShips = 0;
//Keeps track of the number of ships the AI has left.
var aiShips = 0;
//Keeps track of if the score has been sent to the leaderboard.
var scoreSubmitted = false;

//Assigns the appropriate functions to the AI and user boards, then calls other setup functions.
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

//Tells the server that the user isn't looking for a game, places the AI ships, and gives the user their ships to place.
//AI ship placements are random.
function startPrep(){
    aiShipQueue.enqueue(5);
    aiShipQueue.enqueue(4);
    aiShipQueue.enqueue(3);
    aiShipQueue.enqueue(3);
    aiShipQueue.enqueue(2);
    while (aiShipQueue.isEmpty == false){
        var rotations = Math.floor(Math.random()*4);
        for (var i=0; i<rotations; i++){
            aiRotate();
        }
        aiPlaceShip();
    }
    for (var i=0; i<10; i++){
        for (var j=0; j<10; j++){
            aiMoves.push({x: i, y: j});
        }
    }
    shipQueue.enqueue(5);
    shipQueue.enqueue(4);
    shipQueue.enqueue(3);
    shipQueue.enqueue(3);
    shipQueue.enqueue(2);
}

//Generates a random position to place the AI's ship at and attempts to place it there, updating aiShips and aiShipPlaces in the process.
function aiPlaceShip(){
    if (aiShipQueue.isEmpty){
        return;
    }
    var placable = true;
    var x = Math.floor(Math.random()*10);
    var y = Math.floor(Math.random()*10);
    for (var iterator = 0; iterator < aiShipQueue.peek(); iterator++) {
        var curX = (x+iterator*aiRotation[0]);
        var curY = (y+iterator*aiRotation[1]);
        if (!(0 <= curX && 9 >= curX && 0 <= curY && 9 >= curY) || arrayIncludes({x: curX, y: curY}, aiShipPlaces)) {
            placable = false;
        }
    }
    if (placable){
        for (var iterator = 0; iterator < aiShipQueue.peek(); iterator++) {
            var curX = (x+iterator*aiRotation[0]);
            var curY = (y+iterator*aiRotation[1]);
            if (0 <= curX && 9 >= curX && 0 <= curY && 9 >= curY) {
                aiShipPlaces.push({x: curX, y: curY});
                aiShips++;
            }
        }
        aiShipQueue.dequeue();
    }
}

//Attempts to place a ship in a location decided by the user. If the placement is successful and it's the last ship, the AI takes it's first turn.
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
                    playerShips++;
                }
                shipPlaces.push({x: xHighlight, y: yHighlight});
            }
        }
        shipQueue.dequeue();
    }
    if (shipQueue.isEmpty){
        var status = document.getElementById("game-status");
        status.innerHTML = "Your turn.";
        inGame = true;
        aiMove();
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

//Highlights a space on the AI's board if it's the user's turn to indicate where the user would fire at.
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

//Fires a shell at the given coordinates on the AI's board.
//Param x: The x coordinate the user fired at.
//Param y: The y coordinate the user fired at.
function makeMove(x, y){
    var square = document.getElementById("1square"+x+"-"+y);
    if (!isTurn || square.className != "targetedhighlighted"){
        return;
    }
    isTurn = false;
    if (arrayIncludes({x: x, y: y}, aiShipPlaces)){
        square.className = "destroyed";
        aiShips--;
    } else {
        square.className = "missed";
        score -= 10000;
        var scoretext = document.getElementById("scoretext");
        scoretext.innerText = "Score: " + score;
    }
    if (aiShips == 0){
        gameEnded = true;
        var status = document.getElementById("game-status");
        status.innerText = "Game over, you won!";
    } else {
        aiMove();
    }
}

//Determines a place to shoot at based on a 3 step process using aiNext and then fires a shell.
function aiMove(){
    isTurn = true;
    //The first step of the process is checking aiNext.next, if it's not null the AI attempts to take a shot there.
    //If aiNext.next is out of bounds or it's already shot that position, it makes aiNext.next null and calls
    //aiMove() again. If it misses, aiNext.next becomes null. If it hits, aiNext.next is set to the next space
    //in the direction of the line it's shooting in.
    if (aiNext.next != null && arrayIncludes({x: aiNext.next.x, y: aiNext.next.y}, aiMoves)){
        var x = aiNext.next.x;
        var y = aiNext.next.y;
        if (x >= 0 && x <= 9 && y >= 0 && y <= 9 && arrayIncludes({x: x, y: y}, aiMoves)){
            var square = document.getElementById("2square"+x+"-"+y);
            if (arrayIncludes({x: x, y: y}, shipPlaces)){
                square.className = "destroyed";
                aiNext.next.x = x+aiRotation[0];
                aiNext.next.y = y+aiRotation[1];
                playerShips--;
                if (playerShips == 0){
                    isTurn = false;
                    gameEnded = true;
                    var status = document.getElementById("game-status");
                    status.innerText = "Game over, you lost.";
                }
            } else {
                square.className = "missed";
                aiNext.next = null;
                aiRotate();
            }
            var moveIndex = getIndex({x: x, y: y}, aiMoves);
            aiMoves.splice(moveIndex, 1);
            return;
        } else {
            aiNext.next = null;
            aiRotate();
            aiMove();
            return;
        }
    //The second step of the process is checking if aiNext.check is null. If it's not, it checks the next space around
    //where it managed to previously randomly guess a hit. If it gets a hit, it creates a new aiNext.next in the direction
    //it got the hit in. Otherwise, it calls aiRotate and will check the next adjacent space next turn. If a space is out of bounds
    //or the AI already shot at it, it rotates again and calls aiMove() again. If it rotates 8 times (for some reason 4 didn't always work),
    //aiNext.check will functionally be nullified and it will return to randomly guessing.
    } else if (aiNext.check != null && aiNext.check.repetitions < 8){
        var x = aiNext.check.x + aiRotation[0];
        var y = aiNext.check.y + aiRotation[1];
        if (x >= 0 && x <= 9 && y >= 0 && y <= 9 && arrayIncludes({x: x, y: y}, aiMoves)){
            var square = document.getElementById("2square"+x+"-"+y);
            if (arrayIncludes({x: x, y: y}, shipPlaces)){
                square.className = "destroyed";
                aiNext.next = {x: x+aiRotation[0], y: y+aiRotation[1]};
                aiNext.check.repetitions++;
                playerShips--;
                if (playerShips == 0){
                    isTurn = false;
                    gameEnded = true;
                    var status = document.getElementById("game-status");
                    status.innerText = "Game over, you lost.";
                }
            } else {
                square.className = "missed";
                aiNext.check.repetitions++;
                aiRotate();
            }
            var moveIndex = getIndex({x: x, y: y}, aiMoves);
            aiMoves.splice(moveIndex, 1);
            return;
        } else {
            aiNext.check.repetitions++;
            aiRotate();
            aiMove();
            return;
        }
    //The final step of the process involves just firing at a random space it hasn't fired at yet. If it hits,
    //aiNext.check is set to the space it fired at so it starts checking around that space next turn.
    } else {
        var moveIndex = Math.floor(Math.random()*aiMoves.length);
        var move = aiMoves[moveIndex];
        var x = move.x;
        var y = move.y;
        var square = document.getElementById("2square"+x+"-"+y);
        if (arrayIncludes({x: x, y: y}, shipPlaces)){
            square.className = "destroyed";
            playerShips--;
            if (playerShips == 0){
                isTurn = false;
                gameEnded = true;
                var status = document.getElementById("game-status");
                status.innerText = "Game over, you lost.";
            }
            aiNext.check = {x: x, y: y, repetitions: 0};
        } else {
            square.className = "missed";
        }
        aiMoves.splice(moveIndex, 1);
    }
}

//This rotates the orientation the player's ship will be placed at.
function rotate(){
    var xRot = rotation[1];
    var yRot = rotation[0]*-1;
    rotation[0] = xRot;
    rotation[1] = yRot;
}

//This rotates the orientation the AI's ship will be placed at and the direction the AI will check in.
function aiRotate(){
    var xRot = aiRotation[1];
    var yRot = aiRotation[0]*-1;
    aiRotation[0] = xRot;
    aiRotation[1] = yRot;
}

//This checks if an array includes an object containing coordinates equal to the object passed in.
//Param obj: The object the function is searching the list for.
//Param list: The list the function is searching through.
function arrayIncludes(obj, list){
    for (var i=0; i<list.length; i++){
        if (list[i].x == obj.x && list[i].y == obj.y){
            return true;
        }
    }
    return false;
}

//Gets the index of an object in a list if it appears in the list, returning -1 if it isn't in the list.
//Param obj: The object the function is searching the list for.
//Param list: The list the function is searching through.
function getIndex(obj, list){
    for (var i=0; i<list.length; i++){
        if (list[i].x == obj.x && list[i].y == obj.y){
            return i;
        }
    }
    return -1;
}

//Submits the score of the game and changes the window to home if the user left normally.
//Param noEscape: True if the user closed the window, prevents the window from changing to home if true.
//Named that way because it's true if the user tried closing the window to escape a bad game on their battle history.
function leaveGame(noEscape){
    if (gameEnded){
        if (!scoreSubmitted){
            if (playerShips > 0){
                fetch("http://137.184.226.226:80/submitaiscore/", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({score: score, won: true})
                }).then(async (res) => {
                    var response = await res.text();
                    if (response == "login" && !noEscape) {
                        window.location.href = './index.html';
                    } else {
                        console.log(parsedResponse);
                    }
                });
            } else {
                fetch("http://137.184.226.226:80/submitaiscore/", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({score: 0, won: false})
                }).then(async (res) => {
                    var response = await res.text();
                    if (response == "login" && !noEscape) {
                        window.location.href = './index.html';
                    } else {
                        console.log(parsedResponse);
                    }
                });;
            }
        }
        scoreSubmitted = true;
    }
    if (!noEscape){
        window.location.href = './home.html';
    }
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
//A queue of the AI's ships to be placed.
var aiShipQueue = new Queue;
