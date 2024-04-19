
// nerveBall web version Jaakko Prättälä 2024, use as you wish.

//globals
var mode = 0;
var canvas_width = 800;
var canvas_height = 800;
var mouse_x = 0;
var mouse_y = 0;
var mouse_down = false;
var mouse_down_x = 0;
var mouse_down_y = 0;

//current ball amount
var ball_amount = 3
//ball neural activation array
var ball_na = [];
for (var i = 0; i < ball_amount; i++) {
    ball_na.push(0.03);
}
//ball x position
var ball_x = [];
for (var i = 0; i < ball_amount; i++) {
    ball_x.push(nbhelper_randomInt(0, canvas_width));
}
//ball y position
var ball_y = [];
for (var i = 0; i < ball_amount; i++) {
    ball_y.push(nbhelper_randomInt(0, canvas_height));
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
    ball_size.push(50);
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
    //modulate ball speed with neural activation
    for (var j = 0; j < ball_amount; j++) {
        ball_x_speed[i] += ball_na[j] * 0.00008;
        ball_y_speed[i] += ball_na[j] * 0.00008;
        if (ball_x_speed[i] > 10) {
            ball_x_speed[i] = 10;
        }
        if (ball_y_speed[i] > 10) {
            ball_y_speed[i] = 10;
        }
        if (ball_x_speed[i] < -10) {
            ball_x_speed[i] = -10;
        }
        if (ball_y_speed[i] < -10) {
            ball_y_speed[i] = -10;
        }
    }
    //modulate ball direction with neural activation
    for (var j = 0; j < ball_amount; j++) {
        ball_direction[i] += ball_na[j] * 0.00005;
    }  
    ball_x[i] = nbhelper_getX(ball_direction[i]);
    ball_y[i] = nbhelper_getY(ball_direction[i]);

    ball_x[i] += ball_x_speed[i];
    ball_y[i] += ball_y_speed[i];
}


function countActivations() {
    for (var i = 0; i < ball_amount; i++) {
        for (var j = 0; j < ball_amount; j++) {
            ball_na[i] += scaleActivationSigmoid(ball_na[j])*weights[i][j];
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
}

function checkCollision() {
    for (var i = 0; i < ball_amount; i++) {
        for (var j = 0; j < ball_amount; j++) {
            if (i != j) {
                if (nbhelper_getDistance(ball_x[i], ball_y[i], ball_x[j], ball_y[j]) < ball_size[i] + ball_size[j]) {
                    //change direction
                    ball_x_speed[i] *= -1;
                    ball_y_speed[i] *= -1;
                    ball_x_speed[j] *= -1;
                    ball_y_speed[j] *= -1;
                }
            }
        }
    }
}

//check collision with a wall
function checkWallCollision() {
    for (var i = 0; i < ball_amount; i++) {
        if (ball_x[i] < 0 || ball_x[i] > canvas_width) {
            ball_x_speed[i] *= -1;
        }
        if (ball_y[i] < 0 || ball_y[i] > canvas_height) {
            ball_y_speed[i] *= -1;
        }
    }
}


