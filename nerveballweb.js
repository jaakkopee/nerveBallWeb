//this is a quick rewrite

//first some globals

var radiusTable = [48, 36, 24, 18, 12, 9, 6];
var level = 1;
var maxBalls = 4;
var maxSpeed = 3;
var playerWon = false;
var cnvWidth = 800;
var cnvHeight = 800;
var balls = [];
var showLevelUpText = true;
var playLevelUpSound = false;
var playerRanOutOfTime = false;
var timeGain = false;

function Ball(x, y, radiusIndex, color, target){
    this.x = x;
    this.y = y;
    this.radiusIndex = radiusIndex;
    if (this.radiusIndex > radiusTable.length-1){
        this.radiusIndex = radiusTable.length-1;
    }
    this.radius = radiusTable[this.radiusIndex];
    this.color = color;
    this.target = target;
    this.speedX = Math.random(-5, 5);
    this.speedY = Math.random(-5, 5);
    this.na = target;
    this.weights =[];
    this.inputs = [];

    this.addInput = function(input){
        this.inputs.push(input);
        this.weights.push(Math.random()*2-1);
    }

    this.removeInput = function(input){
        var index = this.inputs.indexOf(input);
        this.inputs.splice(index, 1);
        this.weights.splice(index, 1);
    }

    this.update = function(){
        //first calculate the weighted sum of inputs. A basic perceptron.
        for (var i = 0; i < this.inputs.length; i++){
            this.na += this.inputs[i].na * this.weights[i];
        }
        
        //sigmoid function
        this.na = 1/(1+Math.exp(-this.na));

        //backpropagation
        for (var i = 0; i < this.inputs.length; i++){
            var target = this.target;
            var error = target - this.na;
            var lr = 0.001;
            var delta = error * lr;
            this.weights[i] += delta;
        }

        //ball movement calculations
        var angle = Math.atan2(this.speedY, this.speedX);
        var speed = Math.sqrt(this.speedX*this.speedX + this.speedY*this.speedY);
        speed = 1.01*speed*Math.abs(this.na)+0.5;

        var signx = Math.sign(this.speedX);
        var signy = Math.sign(this.speedY);
        var newAngle = angle + this.na*0.01;
        this.speedX = speed*Math.cos(newAngle)+signx*0.00012;
        this.speedY = speed*Math.sin(newAngle)+signy*0.00012;
        this.speedX = Math.min(Math.max(this.speedX, -maxSpeed), maxSpeed);
        this.speedY = Math.min(Math.max(this.speedY, -maxSpeed), maxSpeed);

        //check for collisions with walls
        if (this.x > width-this.radius || this.x < this.radius){
            this.speedX *= -1;
            var signSX = Math.sign(this.speedX);
            this.x += signSX*speed*1.5;

            if (this.x > width-this.radius){
                this.x = width-this.radius;
            }
            if (this.x < this.radius){
                this.x = this.radius;
            }
            for (var i = 0; i < this.inputs.length; i++){
                this.weights[i] += 0.000002;
            }
        }
        if (this.y > cnvHeight-this.radius || this.y < this.radius){
            this.speedY *= -1;
            var signSY = Math.sign(this.speedY);
            this.y += signSY*speed*1.5;

            if (this.y > cnvHeight-this.radius){
                this.y = cnvHeight-this.radius;
            }
            if (this.y < this.radius){
                this.y = this.radius;
            }
            for (var i = 0; i < this.inputs.length; i++){
                this.weights[i] += 0.000002;
            }
        }
        //check for collisions with other balls
        for (var ii = 0; ii < balls.length; ii++){
            if (balls[ii] == this){
                continue;
            }

            var overlap = Math.sqrt(Math.pow(this.x-balls[ii].x, 2) + Math.pow(this.y-balls[ii].y, 2));
            if (overlap <= this.radius + balls[ii].radius){
                var angle = Math.atan2(this.y-balls[ii].y, this.x-balls[ii].x); 
                this.speedX += Math.cos(angle);
                this.speedY += Math.sin(angle);
                balls[ii].speedX -= Math.cos(angle);
                balls[ii].speedY -= Math.sin(angle);
            }
        }
        //and finally update the position
        this.x += this.speedX;
        this.y += this.speedY;    
    }//update
} // Ball

function levelUp(){

    playLevelUpSound = true;
    level++;
    if (level > 10){
        playerWon = true;
        player.stop();
        return;
    }

    maxBalls = level*4;
    maxSpeed = 3+0.75*(level-1);
    showLevelUpText = true;
    setTimeout(function(){
        showLevelUpText = false;
    }, 10000);

    if (level < 6){
        balls.push(new Ball(cnvWidth/2, cnvHeight/2, 0, 0, Math.random()*10-5));
    } else if (level < 10){
        balls.push(new Ball(cnvWidth/2, cnvHeight/2, 0, 0, Math.random()*10-5));
        balls.push(new Ball(cnvWidth/2, cnvHeight/2, 0, 0, Math.random()*10-5));
        //connect the new balls to each other
        balls[0].addInput(balls[1]);
        balls[1].addInput(balls[0]);
    } else {
        // 3 balls
        balls.push(new Ball(cnvWidth/2, cnvHeight/2, 0, 0, Math.random()*10-5));
        balls.push(new Ball(cnvWidth/2, cnvHeight/2, 0, 0, Math.random()*10-5));
        balls.push(new Ball(cnvWidth/2, cnvHeight/2, 0, 0, Math.random()*10-5));
        //connect the new balls each to each other
        for (var i = 0; i < balls.length; i++){
            for (var j = 0; j < balls.length; j++){
                if (i != j){
                    balls[i].addInput(balls[j]);
                    balls[j].addInput(balls[i]);
                }
            }
        }

    }
}

function splitBall(index){
    if (balls.length >= maxBalls){
        balls.splice(index, 1);
        return;
    }

    var ball = balls[index];

    //calculate the score
    var ballSpeed = Math.sqrt(ball.speedX*ball.speedX + ball.speedY*ball.speedY);
    player.updateScore(ballSpeed*1000 - ball.radius*10);

    //if the ball is too small, just remove it
    if (ball.radiusIndex >= radiusTable.length-1){
        balls.splice(index, 1);
        player.time += 500;//add 5 seconds
        timeGain = true;
        return;
    }

    var newBall1, newBall2;

    //create two new balls
    newBall1 = new Ball(ball.x, ball.y, ball.radiusIndex+1, ball.color, Math.random()*10-5);
    newBall2 = new Ball(ball.x, ball.y, ball.radiusIndex+1, ball.color, Math.random()*10-5);

    //remove the old ball
    balls.splice(index, 1);
    
    //remove inputs from other balls
    for (var i = 0; i < balls.length; i++){
        balls[i].removeInput(ball);
    }
    
    //add the inputs
    newBall1.addInput(newBall2);
    newBall2.addInput(newBall1);

    for (var i = 0; i < balls.length; i++){
        balls[i].addInput(newBall1);
        balls[i].addInput(newBall2);
        newBall1.addInput(balls[i]);
        newBall2.addInput(balls[i]);
    }

    //add the new balls
    balls.push(newBall1);
    balls.push(newBall2);
}

function Player(){
    this.score = 0;
    this.lastSplitScore = 0;
    this.time = 12000; //2 minutes for starters
    var tcInterval;
    this.start = function(){
        tcInterval = setInterval(function(){
            player.time--;
            if (player.time <= 0){
                playerRanOutOfTime = true;
                this.stop();
            }
        }, 10);
    }

    this.stop = function(){
        clearInterval(tcInterval);
    }

    this.updateScore = function(newScore){
        this.lastSplitScore = newScore;
        this.score += newScore;
    }
}

// create player
var player = new Player();
// create a ball into the balls-array
balls.push(new Ball(cnvWidth/2, cnvHeight/2, 0, 0, Math.random()*10-5));
// the first ball has no inputs
// the network is fully connected, as you can see in the levelUp and splitBall functions
