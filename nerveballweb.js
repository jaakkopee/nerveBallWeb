
// nerveBall web version Jaakko Prättälä 2024, use as you wish.

//globals
var canvas = createCanvas(800, 800);
var ctx = canvas.getContext("2d");
var canvas_width = canvas.width;
var canvas_height = canvas.height;
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
    ball_na.push(0);
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
    ball_x_speed.push(1);
}
//ball y speed
var ball_y_speed = [];
for (var i = 0; i < ball_amount; i++) {
    ball_y_speed.push(1);
}
//ball size
var ball_size = [];
for (var i = 0; i < ball_amount; i++) {
    ball_size.push(50);
}
//ball color
var ball_color = [];
for (var i = 0; i < ball_amount; i++) {
    ball_color.push(50);
}

//weights (ball_amount x ball_amount)
var weights = [];
for (var i = 0; i < ball_amount; i++) {
    weights.push([]);
    for (var j = 0; j < ball_amount; j++) {
        weights[i].push(0.001);
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

function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function createCanvas(width, height) {
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    document.body.appendChild(canvas);
    return canvas;
}

function moveBall(i) {
    ball_x[i] += ball_x_speed[i]*ball_na[i];
    ball_y[i] += ball_y_speed[i]*ball_na[i];
}

function drawBall(i) {
    ctx.beginPath();
    ctx.arc(ball_x[i], ball_y[i], ball_size[i], 0, 2 * Math.PI);
    ctx.fillStyle = ball_color[i];
    ctx.fill();
}

function countBallNA(ball_index) {
    var sum = 0;
    for (var i = 0; i < ball_amount; i++) {
        sum += ball_na[i] * weights[i][ball_index];
    }
    return sum;
}

function backPropagate(ball_index) {
    target = 0.0;
    error = target - ball_na[ball_index];
    delta = error * ball_na[ball_index];
    for (var i = 0; i < ball_amount; i++) {
        weights[i][ball_index] += delta;
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < ball_amount; i++) {
        countBallNA(i);
        moveBall(i);
        drawBall(i);
        backPropagate(i);
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

canvas.addEventListener('mousemove', updateMousePos, false);
canvas.addEventListener('mousedown', updateMouseDown, false);

setInterval(draw, 1000 / 60);
