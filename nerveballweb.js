
function setup() {
  createCanvas(1000, 1000);
  background(0);
  noStroke();
  fill(255);
}

function draw() {
  background(0);
  fill(random(255), random(255), random(255));
  for (var i=0; i<100; i+=1) {
    background(0);
    for (var j=0; j<100; j+=1) {
      ellipse(random(width), random(height), 10, 10);
    }
  }
}

