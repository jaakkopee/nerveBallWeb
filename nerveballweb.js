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
var collisionMargin = -6;
var maxBalls = 4;
var player_level = 1;
var player_points = 0;
var player_time = 120000;//2 minutes
var player_lastSplitPoints = 0;
var levelUpText = false;
var levelUpSound = false;
var speedCoeff = 0.1;

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

function nbhelper_getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function nbhelper_getX(angle) {
    return Math.cos(angle);
}

function nbhelper_getY(angle) {
    return Math.sin(angle);
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
    checkCollision();
    checkWallCollision();
    //get total activation
    var total_activation = 0.0;
    for (var j = 0; j < ball_amount; j++) {
        total_activation += Math.abs(ball_na[j]);
    }

    //avg over ball amount
    total_activation = total_activation / ball_amount;
    //modulate ball speed with total neural activation
    ball_x_speed[i] = nbhelper_getX(ball_direction[i]) * total_activation * speedCoeff;
    ball_y_speed[i] = nbhelper_getY(ball_direction[i]) * total_activation * speedCoeff;
    ball_x[i] += ball_x_speed[i];
    ball_y[i] += ball_y_speed[i];

    //modulate ball direction with neural activation
    for (var j = 0; j < ball_amount; j++) {
        ball_direction[i] += ball_na[j] * 0.000125;
    }  
    ball_x_speed[i] = nbhelper_getX(ball_direction[i]);
    ball_y_speed[i] = nbhelper_getY(ball_direction[i]);

    ball_x[i] += ball_x_speed[i];
    ball_y[i] += ball_y_speed[i];
}


function countActivations() {
    for (var i = 0; i < ball_amount; i++) {
        for (var j = 0; j < ball_amount; j++) {
            ball_na[i] += scaleActivationSigmoid(ball_na[j])*weights[i][j];
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
    var lr = 0.000333;
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


function checkCollision() {
    for (var i = 0; i < ball_amount; i++) {
        for (var j = 0; j < ball_amount; j++) {
            if (i != j) {
                var distance = nbhelper_getDistance(ball_x[i], ball_y[i], ball_x[j], ball_y[j]);
                if (distance < ball_size[i] / 2 + ball_size[j] / 2 + collisionMargin) {
                    
                    // Calculate the angle of collision
                    var angle = nbhelper_getAngle(ball_x[i], ball_y[i], ball_x[j], ball_y[j]);
                    
                    // Calculate the new direction for each ball
                    ball_direction[i] = angle;
                    ball_direction[j] = angle + Math.PI;
                    
                    // Update the speed based on the new direction
                    ball_x_speed[i] = nbhelper_getX(ball_direction[i]);
                    ball_y_speed[i] = nbhelper_getY(ball_direction[i]);
                    ball_x_speed[j] = nbhelper_getX(ball_direction[j]);
                    ball_y_speed[j] = nbhelper_getY(ball_direction[j]);

                    // Move the balls away from each other
                    ball_x[i] += ball_size[i] / 2 * nbhelper_getX(angle) * 1.28;
                    ball_y[i] += ball_size[i] / 2 * nbhelper_getY(angle) * 1.28;
                    ball_x[j] += ball_size[j] / 2 * nbhelper_getX(angle + Math.PI) * 1.28;
                    ball_y[j] += ball_size[j] / 2 * nbhelper_getY(angle + Math.PI) * 1.28;
                    
                }
            }
        }
    }
}


function checkWallCollision() {
    for (var i = 0; i < ball_amount; i++) {
        // Check for collision with left and right walls
        if (ball_x[i] - ball_size[i] / 2 < 10) {
            // Ball hits the left wall
            ball_direction[i] = Math.PI - ball_direction[i];
            ball_x_speed[i] = nbhelper_getX(ball_direction[i]);
            ball_y_speed[i] = nbhelper_getY(ball_direction[i]);
            ball_x[i] = 10 + ball_size[i] / 2; // Reposition the ball
        } else if (ball_x[i] + ball_size[i] / 2 > canvas_width - 10) {
            // Ball hits the right wall
            ball_direction[i] = Math.PI - ball_direction[i];
            ball_x_speed[i] = nbhelper_getX(ball_direction[i]);
            ball_y_speed[i] = nbhelper_getY(ball_direction[i]);
            ball_x[i] = canvas_width - 10 - ball_size[i] / 2; // Reposition the ball
        }

        // Check for collision with top and bottom walls
        if (ball_y[i] - ball_size[i] / 2 < 10) {
            // Ball hits the top wall
            ball_direction[i] = -ball_direction[i];
            ball_x_speed[i] = nbhelper_getX(ball_direction[i]);
            ball_y_speed[i] = nbhelper_getY(ball_direction[i]);
            ball_y[i] = 10 + ball_size[i] / 2; // Reposition the ball
        } else if (ball_y[i] + ball_size[i] / 2 > canvas_height - 10) {
            // Ball hits the bottom wall
            ball_direction[i] = -ball_direction[i];
            ball_x_speed[i] = nbhelper_getX(ball_direction[i]);
            ball_y_speed[i] = nbhelper_getY(ball_direction[i]);
            ball_y[i] = canvas_height - 10 - ball_size[i] / 2; // Reposition the ball
        }
    }
}

function deleteBall(i) {
    //add points
    player_lastSplitPoints = 32768 - ball_size[i]*256 + Math.abs(ball_x_speed[i]) * Math.abs(ball_y_speed[i]) * 1024;
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
        levelUpSound = true;
        
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
        secondsToBigBall = 30*player_level;
        speedCoeff += 0.05
        displayPoints();
        displayBallAmount();
        displayLevel();
        displayTime();
        return;
    }
    if (ball_amount == 0 && player_level == 2) {
        levelUpText = true;
        levelUpSound = true;

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
        secondsToBigBall = 30*player_level;
        speedCoeff += 0.05
        displayPoints();
        displayBallAmount();
        displayLevel();
        displayTime();
        return;
    }
    if (ball_amount == 0 && player_level == 3) {
        levelUpText = true;
        levelUpSound = true;

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
        secondsToBigBall = 30*player_level;
        speedCoeff += 0.05
        displayPoints();
        displayBallAmount();
        displayLevel();
        displayTime();
        return;
    }
    if (ball_amount == 0 && player_level == 4) {
        levelUpText = true;
        levelUpSound = true;

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
        secondsToBigBall = 30*player_level;
        speedCoeff += 0.05
        displayPoints();
        displayBallAmount();
        displayLevel();
        displayTime();
        return;
    }
    if (ball_amount == 0 && player_level == 5) {
        levelUpText = true;
        levelUpSound = true;

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
        secondsToBigBall = 30*player_level;
        speedCoeff += 0.05
        displayPoints();
        displayBallAmount();
        displayLevel();
        displayTime();
        return;
    }
    if (ball_amount == 0 && player_level == 6) {
        levelUpText = true;
        levelUpSound = true;

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
        secondsToBigBall = 30*player_level;
        speedCoeff += 0.05
        displayPoints();
        displayBallAmount();
        displayLevel();
        displayTime();
        return;
    }
    if (ball_amount == 0 && player_level == 7) {
        levelUpText = true;
        levelUpSound = true;

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
        secondsToBigBall = 30*player_level;
        speedCoeff += 0.05
        displayPoints();
        displayBallAmount();
        displayLevel();
        displayTime();
        return;
    }
    if (ball_amount == 0 && player_level == 8) {
        levelUpText = true;
        levelUpSound = true;

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
        secondsToBigBall = 30*player_level;
        speedCoeff += 0.05
        displayPoints();
        displayBallAmount();
        displayLevel();
        displayTime();
        return;
    }
    if (ball_amount == 0 && player_level == 9) {
        levelUpText = true;
        levelUpSound = true;

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
        secondsToBigBall = 30*player_level;
        speedCoeff += 0.05
        displayPoints();
        displayBallAmount();
        displayLevel();
        displayTime();
        return;
    }
    if (ball_amount == 0 && player_level == 10) {
        levelUpText = true;
        levelUpSound = true;

        setTimeout(function() {
            levelUpText = false;
        }
        , 6000);

        lane = 2;
        displayPoints();
        displayBallAmount();
        displayLevel();
        displayTime();
        return;
    }   

}

function splitBall(i) {
    var oldSize = ball_size[i];
    var oldColor = ball_color[i];

    if (ball_size[i] == 11) {
        for (var j = 0; j < ball_amount; j++) {
            ball_na[j] += 10;
            for (var k = 0; k < ball_amount; k++) {
                weights[j][k] += 2.0;
            }
        }
        deleteBall(i);
        addToTime(20000);
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

//audio department
let nbaudio_ballsplit01;
let nbaudio_scoregain01;
let nbaudio_timegain01;
let nbaudio_bgmusic01;
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

