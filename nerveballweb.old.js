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
var collisionMargin = 5;
var hitMargin = 0;
var bounceFactor = 1.0;
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

var speedCoeff0; //total activation effect on speed
var speedCoeff1;  //individual activation effect on speed
var directionCoeff0; //total activation effect on direction
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
    var speedVectorLength = nbhelper_vectorLength(ball_x_speed[i], ball_y_speed[i]);
    ball_x_speed[i] += speedVectorLength * total_activation * speedCoeff0 + Math.abs(ball_na[i]) * speedCoeff1;
    ball_y_speed[i] += speedVectorLength * total_activation * speedCoeff0 + Math.abs(ball_na[i]) * speedCoeff1;
    

    ball_x[i] += ball_x_speed[i]
    ball_y[i] += ball_y_speed[i]

    //modulate ball direction with neural activation
    ball_direction[i] += total_activation * directionCoeff0 + ball_na[i] * directionCoeff1;
    if (ball_direction[i] < 0) {
        ball_direction[i] += 2*Math.PI;
    }
    if (ball_direction[i] > 2*Math.PI) {
        ball_direction[i] -= 2*Math.PI;
    }

    //update ball x and y speed
    speedVector = nbhelper_getVector(nbhelper_vectorLength(ball_x_speed[i], ball_y_speed[i]), ball_direction[i]);
    ball_x_speed[i] = speedVector[0];
    ball_y_speed[i] = speedVector[1];
    
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
            if (distance <= sumRadius + collisionMargin) {
                var direction1 = ball_direction[i];
                var direction2 = ball_direction[j];
                direction1 = Math.PI - direction1;
                direction2 = Math.PI - direction2;
                if (direction1 < 0) {
                    direction1 += 2*Math.PI;
                }
                if (direction2 < 0) {
                    direction2 += 2*Math.PI;
                }
                direction1 = direction1 % (2*Math.PI);
                direction2 = direction2 % (2*Math.PI);
                    
                ball_direction[i] = direction1;
                ball_direction[j] = direction2;
                speedVector1 = nbhelper_getVector(nbhelper_vectorLength(ball_x_speed[i], ball_y_speed[i]), direction1);
                speedVector2 = nbhelper_getVector(nbhelper_vectorLength(ball_x_speed[j], ball_y_speed[j]), direction2);
                ball_x_speed[i] = speedVector1[0]*bounceFactor;
                ball_y_speed[i] = speedVector1[1]*bounceFactor;
                ball_x_speed[j] = speedVector2[0]*bounceFactor;
                ball_y_speed[j] = speedVector2[1]*bounceFactor;

                var overlap = sumRadius - distance + collisionMargin;
                var angle = nbhelper_getAngle(ball_x[i], ball_y[i], ball_x[j], ball_y[j]);
                var overlapVector = nbhelper_getVector(overlap, angle);
                ball_x[i] += overlapVector[0];
                ball_y[i] += overlapVector[1];
                ball_x[j] -= overlapVector[0];
                ball_y[j] -= overlapVector[1];

                ball_x[i] += ball_x_speed[i]
                ball_y[i] += ball_y_speed[i]
                ball_x[j] += ball_x_speed[j];
                ball_y[j] += ball_y_speed[j];            
            }
        }
    }
}

function nbhelper_vectorLength(x, y) {
    return Math.sqrt(x * x + y * y);
}

function nbhelper_normalizeVector(x, y) {
    var length = nbhelper_vectorLength(x, y);
    return [x / length, y / length];
}

function nbhelper_getVector(length, angle) {
    return [length * Math.cos(angle), length * Math.sin(angle)];
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

function checkWallCollision(i) {
    var offset = 2; // Change this value as needed
    if (ball_x[i] < ball_size[i] / 2 + wallCollisionMargin) {
        ball_direction[i] = Math.PI - ball_direction[i];
        ball_x_speed[i] = nbhelper_getVector(nbhelper_vectorLength(ball_x_speed[i], ball_y_speed[i]), ball_direction[i])[0];
        ball_y_speed[i] = nbhelper_getVector(nbhelper_vectorLength(ball_x_speed[i], ball_y_speed[i]), ball_direction[i])[1];
        ball_x[i] = ball_size[i] / 2 + wallCollisionMargin + offset;
    }
    if (ball_x[i] > canvas_width - ball_size[i] / 2 - wallCollisionMargin) {
        ball_direction[i] = Math.PI - ball_direction[i];
        ball_x_speed[i] = nbhelper_getVector(nbhelper_vectorLength(ball_x_speed[i], ball_y_speed[i]), ball_direction[i])[0];
        ball_y_speed[i] = nbhelper_getVector(nbhelper_vectorLength(ball_x_speed[i], ball_y_speed[i]), ball_direction[i])[1];
        ball_x[i] = canvas_width - ball_size[i] / 2 - wallCollisionMargin - offset;
    }
    if (ball_y[i] < ball_size[i] / 2 + wallCollisionMargin) {
        ball_direction[i] = -ball_direction[i];
        ball_x_speed[i] = nbhelper_getVector(nbhelper_vectorLength(ball_x_speed[i], ball_y_speed[i]), ball_direction[i])[0];
        ball_y_speed[i] = nbhelper_getVector(nbhelper_vectorLength(ball_x_speed[i], ball_y_speed[i]), ball_direction[i])[1];
        ball_y[i] = ball_size[i] / 2 + wallCollisionMargin + offset;
    }
    if (ball_y[i] > canvas_height - ball_size[i] / 2 - wallCollisionMargin) {
        ball_direction[i] = -ball_direction[i];
        ball_x_speed[i] = nbhelper_getVector(nbhelper_vectorLength(ball_x_speed[i], ball_y_speed[i]), ball_direction[i])[0];
        ball_y_speed[i] = nbhelper_getVector(nbhelper_vectorLength(ball_x_speed[i], ball_y_speed[i]), ball_direction[i])[1];
        ball_y[i] = canvas_height - ball_size[i] / 2 - wallCollisionMargin - offset;
    }
}

function deleteBall(i) {
    //add points
    player_lastSplitPoints = 72000 - ball_size[i]*1600 + Math.abs(ball_x_speed[i]) * Math.abs(ball_y_speed[i]) * 2560;
    player_points += player_lastSplitPoints;

    //delete ball
    if (ball_amount > 0) {ball_amount -= 1;}
    console.log("Deleting ball " + i);
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

    displayPoints();
    displayTime();
    displayLevel();
    displayBallAmount();


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
    speedCoeff0 = 0.00001*player_level;
    speedCoeff1 = 0.000125*player_level;
    directionCoeff0 = 0.001*player_level;
    directionCoeff1 = 0.016*player_level;
    activationGain = 1.0;
    learningRate = 0.001;
}

function splitBall(i) {
    console.log("Splitting ball " + i);
    if (ball_size[i] == 11) {
        deleteBall(i);
        player_time += 5000;
        displayBallAmount();
        displayLevel();
        displayPoints();
        displayTime();
        return;
    }

    // Store the attributes of the ball being split
    var ballAttributes = {
        size: ball_size[i],
        color: ball_color[i],
        xSpeed: ball_x_speed[i],
        ySpeed: ball_y_speed[i],
        direction: ball_direction[i],
        na: ball_na[i],
        weights: weights[i]
    };

    // calculate new x and y for the new balls
    var angle1 = Math.random() * 2 * Math.PI;
    var angle2 = Math.random() * 2 * Math.PI;
    var vector1 = nbhelper_getVector(ball_size[i] / 2, angle1);
    var vector2 = nbhelper_getVector(ball_size[i] / 2, angle2);
    var x1 = ball_x[i] + vector1[0];
    var y1 = ball_y[i] + vector1[1];
    var x2 = ball_x[i] + vector2[0];
    var y2 = ball_y[i] + vector2[1];

    console.log("Splitting ball " + i + " into balls at " + x1 + ", " + y1 + " and " + x2 + ", " + y2);

    deleteBall(i);

    // Use the stored attributes when adding the new balls
    addBall({...ballAttributes, x: x1, y: y1});
    addBall({...ballAttributes, x: x2, y: y2});

    displayBallAmount();
    displayLevel();
    displayPoints();
    displayTime();
}


function addBall(ballAttributes) {
    if (ball_amount > maxBalls) {
        displayBallAmount();
        displayLevel();
        displayPoints();
        displayTime();
        return;
    }

    var newSize;
    var oldSize = ballAttributes.size;
    if (ballAttributes.size == 93) {
        newSize = 62;
        console.log("Ball size is 93, setting new size to 62");
    } else if (ballAttributes.size == 62) {
        newSize = 42;
        console.log("Ball size is 62, setting new size to 42");
    } else if (ballAttributes.size == 42) {
        newSize = 32;
        console.log("Ball size is 42, setting new size to 32");
    } else if (ballAttributes.size == 32) {
        newSize = 26;
        console.log("Ball size is 32, setting new size to 26");
    } else if (ballAttributes.size == 26) {
        newSize = 11;
        console.log("Ball size is 26, setting new size to 11");
    } else {
        newSize = 0;
        return;
    }

    ball_amount += 1;
    ball_na.push(ballAttributes.na);
    ball_x.push(ballAttributes.x);
    ball_y.push(ballAttributes.y);
    ball_x_speed.push(ballAttributes.xSpeed);
    ball_y_speed.push(ballAttributes.ySpeed);
    ball_direction.push(ballAttributes.direction);
    ball_size.push(newSize);
    ball_color.push(ballAttributes.color || 255);

    var newWeights = [];
    for (var i = 0; i < ball_amount; i++) {
        newWeights.push(1.0);
    }
    weights.push(newWeights);

    console.log("Added ball with size " + newSize);


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

