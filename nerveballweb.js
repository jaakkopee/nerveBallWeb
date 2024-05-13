/*
    nerveBall is an online ball game in which the trajectories of the balls are modulated by a neural network.
    Copyright (C) 2024 Jaakko Prättälä

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/* globals */

var lane = 4; //0 = game, 1 = time out, 2 = level up, 3 = sir robin, 4 = start screen
var canvas_width = 800;
var canvas_height = 800;
var mouse_x = 0;
var mouse_y = 0;
var mouse_down = false;
var mouse_down_x = 0;
var mouse_down_y = 0;
var timeStopped = false;
var gameOn = false;
var theBigBall = false;
var secondsToBigBall = 30;
var collisionMargin = 0;
var bounceFactor = 1.5;
var wallCollisionMargin = 5;
var maxBalls = 4;
var player_level = 1;
var player_points = 0;
var player_time = 120000;//2 minutes
var player_lastSplitPoints = 0;
var levelUpText = false;
var playLevelUpSound = false;


//neural network parameters
var activationGain; //neural activation gain
var learningRate; //backpropagation learning rate

var speedCoeff0 = 0.001; //total activation effect on speed
var speedCoeff1; //individual activation effect on speed
var directionCoeff0 = 0.001 //total activation effect on direction
var directionCoeff1; //individual activation effect on direction
var DEBUG = false;

setLevelAttributes();

//current ball amount
var ball_amount = 1
//ball neural activation array
var ball_na = [];
for (var i = 0; i < ball_amount; i++) {
    ball_na.push(0.03);
}
//ball x position
var ball_x = [];
for (var i = 0; i < ball_amount; i++) {
    ball_x.push(nbhelper_randomInt(50, canvas_width-50));
}
//ball y position
var ball_y = [];
for (var i = 0; i < ball_amount; i++) {
    ball_y.push(nbhelper_randomInt(50, canvas_height-50));
}
//ball x speed
var ball_x_speed = [];
for (var i = 0; i < ball_amount; i++) {
    ball_x_speed.push(10);
}
//ball y speed
var ball_y_speed = [];
for (var i = 0; i < ball_amount; i++) {
    ball_y_speed.push(10);
}
//ball direction
var ball_direction = [];
for (var i = 0; i < ball_amount; i++) {
    ball_direction.push(0);
}
//ball size
var ball_size = [];
for (var i = 0; i < ball_amount; i++) {
    ball_size.push(93);
}
//ball color
var ball_color = [];
for (var i = 0; i < ball_amount; i++) {
    ball_color.push(255);
}
//weights (ball_amount x ball_amount)
var weights = [];
for (var i = 0; i < ball_amount; i++) {
    weights.push([]);
    for (var j = 0; j < ball_amount; j++) {
        weights[i].push(1.0);
    }
}

function nbhelper_randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function nbhelper_getAngle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

function nbhelper_getAngle(x, y){
    return Math.atan2(y, x);
}

function nbhelper_getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function nbhelper_getX(angle) {
    return Math.cos(angle);
}

function nbhelper_getY(angle) {
    return Math.sin(angle);
}

function nbhelper_getSpeed(x, y) {
    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
}

function getMousePos(evt) {
    var rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}
function scaleActivationSigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

function moveBall(i) {
    //check collision with other balls
    checkCollision(i);
    //check collision with walls
    checkWallCollision(i);

    //get total activation
    var total_activation = 0.0;
    for (var j = 0; j < ball_amount; j++) {
        total_activation += Math.abs(ball_na[j]);
    }
    //avg over ball amount
    total_activation = total_activation / ball_amount;

    var signx = 1;
    var signy = 1;
    if (ball_x_speed[i] < 0) {
        signx = -1;
    }
    if (ball_y_speed[i] < 0) {
        signy = -1;
    }

    //modulate ball speed with neural activation
    ball_x_speed[i] += (total_activation * speedCoeff0 + Math.abs(ball_na[i]) * speedCoeff1) * signx;
    ball_y_speed[i] += (total_activation * speedCoeff0 + Math.abs(ball_na[i]) * speedCoeff1) * signy;

    ball_x[i] += ball_x_speed[i]
    ball_y[i] += ball_y_speed[i]

    //modulate ball direction with neural activation
    ball_direction[i] += total_activation * directionCoeff0 + ball_na[i] * directionCoeff1;

    //update ball x and y speed
    ball_x_speed[i] = nbhelper_getX(ball_direction[i]);
    ball_y_speed[i] = nbhelper_getY(ball_direction[i]);
    
    ball_x[i] += ball_x_speed[i]
    ball_y[i] += ball_y_speed[i]

}


function countActivations() {
    for (var i = 0; i < ball_amount; i++) {
        for (var j = 0; j < ball_amount; j++) {
            ball_na[i] += activationGain * scaleActivationSigmoid(ball_na[j])*weights[i][j];
            if (ball_na[i] > 32) {
                ball_na[i] = 32;
            }
            if (ball_na[i] < -32) {
                ball_na[i] = -32;
            }
        }
    }
}

function backPropagate(ball_index) {
    var error = 0.0;
    var target = 0.0;
    var delta = 0.0;
    var lr = learningRate;
    for (var i = 0; i < ball_amount; i++) {
        error = target - ball_na[i];
        delta = error * lr;
        weights[i][ball_index] += delta;
    }
}

function updateMousePos(evt) {
    var mousePos = getMousePos(canvas, evt);
    mouse_x = mousePos.x;
    mouse_y = mousePos.y;
}

function updateMouseDown(evt) {
    mouse_down = true;
    var mousePos = getMousePos(canvas, evt);
    mouse_down_x = mousePos.x;
    mouse_down_y = mousePos.y;
    for (var i = 0; i < ball_amount; i++) {
        if (nbhelper_getDistance(mouse_down_x, mouse_down_y, ball_x[i], ball_y[i]) < ball_size[i] / 2 + 7) {
            splitBall(i);
        }
    }
}

function nbhelper_normalizeVector(x, y) {
    var length = nbhelper_length(x, y);
    return {x: x / length, y: y / length};
}

function checkCollision(i) {
    for (var j = 0; j < ball_amount; j++) {
        if (i!= j) {
            var distance = nbhelper_getDistance(ball_x[i], ball_y[i], ball_x[j], ball_y[j]);
            var sumRadius = ball_size[i] / 2 + ball_size[j] / 2;
            if (distance < sumRadius + collisionMargin) {
                var position1 = {x: ball_x[i], y: ball_y[i]};
                var position2 = {x: ball_x[j], y: ball_y[j]};
                var newPosition1 = {x: ball_x[i] + ball_x_speed[i], y: ball_y[i] + ball_y_speed[i]};
                var newPosition2 = {x: ball_x[j] + ball_x_speed[j], y: ball_y[j] + ball_y_speed[j]};
                var angle1 = nbhelper_getAngle(position1.x, position1.y, newPosition1.x, newPosition1.y);
                var angle2 = nbhelper_getAngle(position2.x, position2.y, newPosition2.x, newPosition2.y);
                // Invert angles
                angle1 = Math.PI - angle1;
                angle2 = Math.PI - angle2;
                newXSpeed1 = nbhelper_getX(angle1);
                newYSpeed1 = nbhelper_getY(angle1);
                newXSpeed2 = nbhelper_getX(angle2);
                newYSpeed2 = nbhelper_getY(angle2);
                //update speeds
                ball_x_speed[i] = newXSpeed1;
                ball_y_speed[i] = newYSpeed1;
                ball_x_speed[j] = newXSpeed2;
                ball_y_speed[j] = newYSpeed2;
                //move balls away from each other
                ball_x[i] += newXSpeed1;
                ball_y[i] += newYSpeed1;
                ball_x[j] += newXSpeed2;
                ball_y[j] += newYSpeed2;
            }
        }
    }
}

function nbhelper_getAngle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

function nbhelper_rotateVector(x, y, angle) {
    var newX = x * Math.cos(angle) - y * Math.sin(angle);
    var newY = x * Math.sin(angle) + y * Math.cos(angle);
    return [newX, newY];
}
 
// Helper function to calculate the dot product
function nbhelper_dotProduct(v1x, v1y, v2x, v2y) {
    return v1x * v2x + v1y * v2y;
}

// Helper function to calculate the magnitude of a vector
function nbhelper_length(x, y) {
    return Math.sqrt(x * x + y * y);
}



function checkWallCollision(i) {
    var offset = 2; // Change this value as needed
    if (ball_x[i] < ball_size[i] / 2 + wallCollisionMargin) {
        ball_direction[i] = Math.PI - ball_direction[i];
        ball_x_speed[i] = nbhelper_getX(ball_direction[i]);
        ball_y_speed[i] = nbhelper_getY(ball_direction[i]);
        ball_x[i] = ball_size[i] / 2 + wallCollisionMargin + offset;
    }
    if (ball_x[i] > canvas_width - ball_size[i] / 2 - wallCollisionMargin) {
        ball_direction[i] = Math.PI - ball_direction[i];
        ball_x_speed[i] = nbhelper_getX(ball_direction[i]);
        ball_y_speed[i] = nbhelper_getY(ball_direction[i]);
        ball_x[i] = canvas_width - ball_size[i] / 2 - wallCollisionMargin - offset;
    }
    if (ball_y[i] < ball_size[i] / 2 + wallCollisionMargin) {
        ball_direction[i] = -ball_direction[i];
        ball_x_speed[i] = nbhelper_getX(ball_direction[i]);
        ball_y_speed[i] = nbhelper_getY(ball_direction[i]);
        ball_y[i] = ball_size[i] / 2 + wallCollisionMargin + offset;
    }
    if (ball_y[i] > canvas_height - ball_size[i] / 2 - wallCollisionMargin) {
        ball_direction[i] = -ball_direction[i];
        ball_x_speed[i] = nbhelper_getX(ball_direction[i]);
        ball_y_speed[i] = nbhelper_getY(ball_direction[i]);
        ball_y[i] = canvas_height - ball_size[i] / 2 - wallCollisionMargin - offset;
    }
}
function deleteBall(i) {
    //add points
    player_lastSplitPoints = 72000 - ball_size[i]*1600 + Math.abs(ball_x_speed[i]) * Math.abs(ball_y_speed[i]) * 256000;
    player_points += player_lastSplitPoints;

    //delete ball
    if (ball_amount > 0) {ball_amount -= 1;}
    ball_na.splice(i, 1);
    ball_x.splice(i, 1);
    ball_y.splice(i, 1);
    ball_x_speed.splice(i, 1);
    ball_y_speed.splice(i, 1);
    ball_direction.splice(i, 1);
    ball_size.splice(i, 1);
    ball_color.splice(i, 1);
    weights.splice(i, 1);
    for (var j = 0; j < ball_amount; j++) {
        weights[j].splice(i, 1);
    }
    if (ball_amount == 0 && player_level == 1) {
        levelUpText = true;
        playLevelUpSound = true;
        
        setTimeout(function() {
            levelUpText = false;
        }
        , 6000);

        player_level += 1;
        maxBalls += 4;
        ball_amount = 1;
        ball_na = [0.3];
        ball_x = [200];
        ball_y = [200];
        ball_x_speed = [1];
        ball_y_speed = [1];
        ball_direction = [0.6];
        ball_size = [93];
        weights = [];
        for (var i = 0; i < ball_amount; i++) {
            weights.push([]);
            for (var j = 0; j < ball_amount; j++) {
                weights[i].push(1.0);
            }
        }
        
        setLevelAttributes();
        displayLotsOfText();

        return;
    }
    if (ball_amount == 0 && player_level == 2) {
        levelUpText = true;
        playLevelUpSound = true;

        setTimeout(function() {
            levelUpText = false;
        }
        , 6000);

        player_level += 1;
        maxBalls += 4;
        ball_amount = 1;
        ball_na = [0.3];
        ball_x = [200];
        ball_y = [200];
        ball_x_speed = [1];
        ball_y_speed = [1];
        ball_direction = [0.6];
        ball_size = [93];
        ball_color = [255];
        weights = [];
        for (var i = 0; i < ball_amount; i++) {
            weights.push([]);
            for (var j = 0; j < ball_amount; j++) {
                weights[i].push(1.0);
            }
        }
        setLevelAttributes();
        displayLotsOfText();

        return;
    }
    if (ball_amount == 0 && player_level == 3) {
        levelUpText = true;
        playLevelUpSound= true;

        setTimeout(function() {
            levelUpText = false;
        }
        , 6000);

        player_level += 1;
        maxBalls += 4;
        ball_amount = 1;
        ball_na = [0.3];
        ball_x = [200];
        ball_y = [200];
        ball_x_speed = [1];
        ball_y_speed = [1];
        ball_direction = [0.6];
        ball_size = [93];
        ball_color = [255];
        weights = [];
        for (var i = 0; i < ball_amount; i++) {
            weights.push([]);
            for (var j = 0; j < ball_amount; j++) {
                weights[i].push(1.0);
            }
        }
        setLevelAttributes();
        displayLotsOfText();

        return;
    }
    if (ball_amount == 0 && player_level == 4) {
        levelUpText = true;
        playLevelUpSound = true;

        setTimeout(function() {
            levelUpText = false;
        }
        , 6000);

        player_level += 1;
        maxBalls += 4;
        ball_amount = 1;
        ball_na = [0.3];
        ball_x = [200];
        ball_y = [200];
        ball_x_speed = [1];
        ball_y_speed = [1];
        ball_direction = [0.6];
        ball_size = [93];
        ball_color = [255];
        weights = [];
        for (var i = 0; i < ball_amount; i++) {
            weights.push([]);
            for (var j = 0; j < ball_amount; j++) {
                weights[i].push(1.0);
            }
        }
        setLevelAttributes();
        displayLotsOfText();

        return;
    }
    if (ball_amount == 0 && player_level == 5) {
        levelUpText = true;
        playLevelUpSound = true;

        setTimeout(function() {
            levelUpText = false;
        }
        , 6000);

        player_level += 1;
        maxBalls += 4;
        ball_amount = 2;
        ball_na = [0.3, 0.3];
        ball_x = [200, 600];
        ball_y = [200, 600];
        ball_x_speed = [0.1, 0.1];
        ball_y_speed = [0.1, 0.1];
        ball_direction = [0.6, 0.6];
        ball_size = [93, 93];
        ball_color = [255, 255];
        weights = [];
        for (var i = 0; i < ball_amount; i++) {
            weights.push([]);
            for (var j = 0; j < ball_amount; j++) {
                weights[i].push(1.0);
            }
        }
        setLevelAttributes();       
        displayLotsOfText();

        return;
    }
    if (ball_amount == 0 && player_level == 6) {
        levelUpText = true;
        playLevelUpSound = true;

        setTimeout(function() {
            levelUpText = false;
        }
        , 6000);

        player_level += 1;
        maxBalls += 4;
        ball_amount = 2;
        ball_na = [0.3, 0.3];
        ball_x = [200, 600];
        ball_y = [200, 600];
        ball_x_speed = [0.1, 0.1];
        ball_y_speed = [0.1, 0.1];
        ball_direction = [0.6, 0.6];
        ball_size = [93, 93];
        ball_color = [255, 255];
        weights = [];
        for (var i = 0; i < ball_amount; i++) {
            weights.push([]);
            for (var j = 0; j < ball_amount; j++) {
                weights[i].push(1.0);
            }
        }
        setLevelAttributes(); 
        displayLotsOfText();

        return;
    }
    if (ball_amount == 0 && player_level == 7) {
        levelUpText = true;
        playLevelUpSound = true;

        setTimeout(function() {
            levelUpText = false;
        }
        , 6000);

        player_level += 1;
        maxBalls += 4;
        ball_amount = 2;
        ball_na = [0.3, 0.3];
        ball_x = [200, 600];
        ball_y = [200, 600];
        ball_x_speed = [0.1, 0.1];
        ball_y_speed = [0.1, 0.1];
        ball_direction = [0.6, 0.6];
        ball_size = [93, 93];
        ball_color = [255, 255];
        weights = [];
        for (var i = 0; i < ball_amount; i++) {
            weights.push([]);
            for (var j = 0; j < ball_amount; j++) {
                weights[i].push(1.0);
            }
        }
        setLevelAttributes();
        displayLotsOfText();

        return;
    }
    if (ball_amount == 0 && player_level == 8) {
        levelUpText = true;
        playLevelUpSound = true;

        setTimeout(function() {
            levelUpText = false;
        }
        , 6000);

        player_level += 1;
        maxBalls += 4;
        ball_amount = 2;
        ball_na = [0.3, 0.3];
        ball_x = [200, 600];
        ball_y = [200, 600];
        ball_x_speed = [0.1, 0.1];
        ball_y_speed = [0.1, 0.1];
        ball_direction = [0.6, 0.6];
        ball_size = [93, 93];
        ball_color = [255, 255];
        weights = [];
        for (var i = 0; i < ball_amount; i++) {
            weights.push([]);
            for (var j = 0; j < ball_amount; j++) {
                weights[i].push(1.0);
            }
        }
        setLevelAttributes();
        
        displayLotsOfText();

        return;
    }
    if (ball_amount == 0 && player_level == 9) {
        levelUpText = true;
        playLevelUpSound = true;

        setTimeout(function() {
            levelUpText = false;
        }
        , 6000);

        player_level += 1;
        maxBalls += 4;
        ball_amount = 3;
        ball_na = [0.3, 0.3, 0.3];
        ball_x = [200, 600, 400];
        ball_y = [200, 600, 400];
        ball_x_speed = [0.1, 0.1, 0.1];
        ball_y_speed = [0.1, 0.1, 0.1];
        ball_direction = [0.6, 0.6, 0.6];
        ball_size = [93, 93, 93];
        ball_color = [255, 255, 255];
        weights = [];
        for (var i = 0; i < ball_amount; i++) {
            weights.push([]);
            for (var j = 0; j < ball_amount; j++) {
                weights[i].push(1.0);
            }
        }

        setLevelAttributes();

        displayLotsOfText();

        return;
    }
    if (ball_amount == 0 && player_level == 10) {
        levelUpText = true;
        playLevelUpSound = true;

        setTimeout(function() {
            levelUpText = false;
        }
        , 6000);

        lane = 2;

        displayLotsOfText();

        return;
    }   

}

function setLevelAttributes() {
    secondsToBigBall = 30*player_level;
    speedCoeff0 -= 0.0001*player_level;
    speedCoeff1 = 0.025*player_level;
    directionCoeff0 -= 0.0001*player_level;
    directionCoeff1 = 0.00032*player_level;
    activationGain = 0.156*player_level;
    learningRate = 0.00012*player_level;
}

function splitBall(i) {
    var oldSize = ball_size[i];
    var oldColor = ball_color[i];

    if (ball_size[i] == 11) {
        var dice = nbhelper_randomInt(-1, 1);
        for (var j = 0; j < ball_amount; j++) {
            ball_na[j] += 10.0 * dice;
            for (var k = 0; k < ball_amount; k++) {
                weights[j][k] += 0.3 * dice;
            }
        }
        deleteBall(i);
        addToTime(5000);
        displayBallAmount();
        displayLevel();
        displayPoints();
        displayTime();
        return;
    }
    addBall(i, oldSize, oldColor);
    addBall(i, oldSize, oldColor);
    deleteBall(i);
    displayBallAmount();
    displayLevel();
    displayPoints();
    displayTime();
}

function addBall(i, oldSize, oldColor) {
    if (ball_amount > maxBalls) {
        ball_amount == maxBalls;
        displayBallAmount();
        displayLevel();
        displayPoints();
        displayTime();
        return;
    }

    ball_amount += 1;
    ball_na.push(3);
    ball_x.push(ball_x[i]); // New ball is placed at the same x position as the old ball
    ball_y.push(ball_y[i]); // New ball is placed at the same y position as the old ball
    ball_x_speed.push(0);
    ball_y_speed.push(0);
    ball_direction.push(0);
    var newSize = 0;
    if (oldSize == 93) {
        newSize = 62;
    } else if (oldSize == 62) {
        newSize = 42;
    } else if (oldSize == 42) {
        newSize = 32;
    } else if (oldSize == 32) {
        newSize = 26;
    } else if (oldSize == 26) {
        newSize = 11;
    }
    ball_size.push(newSize);
    ball_color.push(oldColor);
    weights.push([]);
    for (var j = 0; j < ball_amount; j++) {
        weights[ball_amount-1].push(1.0);
    }
    for (var j = 0; j < ball_amount; j++) {
        weights[j].push(1.0);
    }
    //move ball away from each other
    ball_x[i] -= newSize + 10;
    ball_x[ball_amount-1] += newSize + 10;
    ball_y[i] -= newSize + 10;
    ball_y[ball_amount-1] += newSize + 10;
    displayBallAmount();
    displayLevel();
    displayPoints();
    displayTime();
}

function addBigBall() {
    theBigBall = true;
    //score penalty of 1000000 points
    player_lastSplitPoints = -1000000;
    player_points += player_lastSplitPoints;
    
    ball_amount += 1;
    ball_na.push(0.03);
    ball_x.push(nbhelper_randomInt(50, canvas_width-50));
    ball_y.push(nbhelper_randomInt(50, canvas_height-50));
    ball_x_speed.push(10);
    ball_y_speed.push(10);
    ball_direction.push(0);
    ball_size.push(93);
    ball_color.push(255);
    weights.push([]);
    for (var j = 0; j < ball_amount; j++) {
        weights[ball_amount-1].push(1.0);
    }
    for (var j = 0; j < ball_amount; j++) {
        weights[j].push(1.0);
    }
    displayPoints();
    displayTime();
    displayLevel();
    displayBallAmount();
}

setInterval(function() {
    if (timeStopped) {
        return;
    }
    if (gameOn) {
        secondsToBigBall--;
        if (lane == 0 && secondsToBigBall == 0) {
            addBigBall();
            secondsToBigBall = 30 * player_level;
        }
    }
}, 1000);

//timed loop for keeping track of player time
setInterval(function() {
    if (timeStopped) {
        return;
    }
    if (gameOn) {
        player_time -= 1000;
        displayTime();
        if (player_time <= 0) {
            timeOut();
        }
    }
}, 1000);

function displayTime() {
    var time = player_time / 1000;
    var minutes = Math.floor(time / 60);
    var seconds = time % 60;
    var timeString ="Time: " + minutes + ":" + (seconds < 10 ? "0" : "") + seconds + " Big Ball Spawn in: " + secondsToBigBall + "s";
    document.getElementById("time").innerHTML = timeString;
}

function displayPoints() {
    document.getElementById("points").innerHTML = Math.round(player_points) + " (" + Math.round(player_lastSplitPoints) + ")";
}

function displayLevel() {
    document.getElementById("level").innerHTML = "Max Balls: " + maxBalls + " Level: " + player_level;
}

function displayBallAmount() {
    document.getElementById("ballAmount").innerHTML = "Balls: " + ball_amount;
}

function displayActivationGain() {
    document.getElementById("activationGain").innerHTML = "Activation Gain: " + activationGain;
}

function displayLearningRate() {
    document.getElementById("learningRate").innerHTML = "Learning Rate: " + learningRate;
}

function displayTAEOBS() {
    document.getElementById("TAEOBS").innerHTML = "TotAct->Ball speed: " + speedCoeff0;
}

function displayIAEOBS() {
    document.getElementById("IAEOBS").innerHTML = "IndAct->Ball Speed: " + speedCoeff1;
}

function displayTAEOBD() {
    document.getElementById("TAEOBD").innerHTML = "TotAct->Ball Direction: " + directionCoeff0;
}

function displayIAEOBD() {
    document.getElementById("IAEOBD").innerHTML = "IndAct->Ball Direction: " + directionCoeff1;
}

function displayLotsOfText() { 
    displayPoints();
    displayBallAmount();
    displayLevel();
    displayTime();
    displayTAEOBS();
    displayIAEOBS();
    displayTAEOBD();
    displayIAEOBD();
    displayActivationGain();
    displayLearningRate();
}

function addToTime(time) {
    player_time += time;
    displayTime();
}

function timeOut() {
    timeStopped = true;
    lane = 1;
}

function sirRobinOut() {
    timeStopped = true;
    lane = 3; //sir robin
}

/* deprecated audio department
let nbaudio_ballsplit;
let nbaudio_scoregain;
let nbaudio_timegain;
let nbaudio_bgmusic;
let nbaudio_TheBigBall;
let nbaudio_levelUp;

function nbaudio_playSample_ballsplit() {
    nbaudio_ballsplit.play();
}

function nbaudio_playSample_scoregain() {
    nbaudio_scoregain.play();
}

function nbaudio_playSample_timegain() {
    nbaudio_timegain.play();
}

function nbaudio_playSample_TheBigBall() {
    nbaudio_TheBigBall.play();
}

function nbaudio_playSample_levelUp() {
    nbaudio_levelUp.play();
}

function nbaudio_playSample_bgmusic() {
    nbaudio_bgmusic.play();
}*/

//full screen
function goFullScreen() {
    var elem = document.documentElement;

    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { /* Firefox */
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE/Edge */
        elem.msRequestFullscreen();
    }
}

function exitFullScreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { /* Firefox */
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE/Edge */
        document.msExitFullscreen();
    }
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        goFullScreen();
    } else {
        exitFullScreen();
    }
}

