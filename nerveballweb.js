
function setup() {
  createCanvas(1000, 1000);
  background(0);
  noStroke();
  fill(255);
}

function draw() {
  background(0);
  for (var x = 0; x <= width; x += 50) {
    for (var y = 0; y <= height; y += 50) {
      ellipse(x, y, 25, 25);
    }
  }
}

