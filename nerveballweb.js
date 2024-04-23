/*
nerveBall - a simple game made with p5.js
by Jaakko Prättälä 2024.
Licensed under GPL v3.
see LICENSE file for details.
*/

//globals
var lane = 0;
var canvas_width = 800;
var canvas_height = 800;
var mouse_x = 0;
var mouse_y = 0;
var mouse_down = false;
var mouse_down_x = 0;
var mouse_down_y = 0;
var timeStopped = false;
var gameOn = false;

//player variables
var player_points = 0;
var player_time = 120000;//2 minutes
var player_lastSplitPoints = 0;

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
    ball_size.push(100);
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
        total_activation += ball_na[j];
    }
    //absolute value
    if (total_activation < 0) {
        total_activation = -total_activation;
    }
    //avg over ball amount
    total_activation = total_activation / ball_amount;
    //modulate ball speed with total neural activation
    ball_x_speed[i] = nbhelper_getX(ball_direction[i]) * total_activation * 0.333;
    ball_y_speed[i] = nbhelper_getY(ball_direction[i]) * total_activation * 0.333;
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
                if (distance < ball_size[i] / 2 + ball_size[j] / 2) {
                    
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
    player_lastSplitPoints = 32768 - ball_size[i]*128 + ball_x_speed[i] * ball_y_speed[i] * 1024;
    player_points += player_lastSplitPoints;
    displayPoints();

    //delete ball
    ball_amount -= 1;
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
}

function splitBall(i) {
    var oldSize = ball_size[i];
    var oldColor = ball_color[i];

    if (oldSize < 10) {
        deleteBall(i);
        addToTime(60000);
        return;
    }
    addBall(i, oldSize, oldColor);
    addBall(i, oldSize, oldColor);
    deleteBall(i);
}

function addBall(i, oldSize, oldColor) {
    if (ball_amount >= 16) {
        return;
    }
    ball_amount += 1;
    ball_na.push(0.03);
    ball_x.push(ball_x[i]); // New ball is placed at the same x position as the old ball
    ball_y.push(ball_y[i]); // New ball is placed at the same y position as the old ball
    ball_x_speed.push(10);
    ball_y_speed.push(10);
    ball_direction.push(0);
    var newSize = 0;
    if (oldSize == 100) {
        newSize = 64;
    } else if (oldSize == 64) {
        newSize = 48;
    } else if (oldSize == 48) {
        newSize = 32;
    } else if (oldSize == 32) {
        newSize = 16;
    } else if (oldSize == 16) {
        newSize = 9;
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
}

function addBigBall() {
    //score penalty of 1000000 points
    player_lastSplitPoints = -1000000;
    player_points += player_lastSplitPoints;
    //time penalty of 1 minute
    player_time -= 60000;
    displayPoints();
    displayTime();
    ball_amount += 1;
    ball_na.push(0.03);
    ball_x.push(nbhelper_randomInt(50, canvas_width-50));
    ball_y.push(nbhelper_randomInt(50, canvas_height-50));
    ball_x_speed.push(10);
    ball_y_speed.push(10);
    ball_direction.push(0);
    ball_size.push(100);
    ball_color.push(255);
    weights.push([]);
    for (var j = 0; j < ball_amount; j++) {
        weights[ball_amount-1].push(1.0);
    }
    for (var j = 0; j < ball_amount; j++) {
        weights[j].push(1.0);
    }
}
var secondsToBigBall = 156;
setInterval(function() {
    if (timeStopped) {
        return;
    }
    if (gameOn) {
        secondsToBigBall--;
        if (lane == 0 && secondsToBigBall == 0) {
            addBigBall();
            secondsToBigBall = 156;
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
    totalscore = player_points + player_lastSplitPoints;
    document.getElementById("points").innerHTML = Math.round(totalscore) + " (" + Math.round(player_lastSplitPoints) + ")";
}

function addToTime(time) {
    player_time += time;
    displayTime();
}

function timeOut() {
    timeStopped = true;
    lane = 1;
}

//audio department
let nbaudio_ballsplit01;
let nbaudio_scoregain01;
let nbaudio_timegain01;
let nbaudio_bgmusic01;

function nbaudio_playSample_ballsplit01() {
    nbaudio_ballsplit01.play();
}

function nbaudio_playSample_scoregain01() {
    nbaudio_scoregain01.play();
}

function nbaudio_playSample_timegain01() {
    nbaudio_timegain01.play();
}

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

