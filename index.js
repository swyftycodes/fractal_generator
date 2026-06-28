const canvas = document.getElementById("canvas");
const escape_time_canvas = document.getElementById("escape-time-canvas");

const escape_time_end_display = document.getElementById("escape-time-end-display");
const escape_time_mid_display = document.getElementById("escape-time-mid-display");

const ctx = canvas.getContext("2d");
const escape_time_ctx = escape_time_canvas.getContext("2d");


const julia_real_input = document.getElementById("julia-real-input");
const julia_imag_input = document.getElementById("julia-imag-input");
const iterations_input = document.getElementById("iterations-input");
const ppp_input = document.getElementById("ppp-input");
const overlay_input = document.getElementById("overlay-input");

// Disable antialiasing
ctx.imageSmoothingEnabled = false;
// Set context canvas width to the canvas element's actual width
ctx.canvas.width = canvas.clientWidth / 2;
ctx.canvas.height = canvas.clientHeight / 2;

escape_time_ctx.canvas.width = escape_time_canvas.clientWidth;
escape_time_ctx.canvas.height = escape_time_canvas.clientHeight;

// Important parameters (DO NOT SET DEFAULTS HERE, SET THEM IN THE HTML FORM!)
let max_iterations = 1;
let overlay = true;

let image_data = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);

// Slightly altered function from MDN docs https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
const getColorIndicesForCoord = (x, y, width) => {
  const red = y * (width * 4) + x * 4;
  return {
    red: red, 
    green: red + 1,
    blue: red + 2, 
    alpha: red + 3
  };
};

// Slightly altered from https://gist.github.com/mjackson/5311256
// Assumes h, s, v are between 0 and 1
function hsvToRgb(h, s, v) {
  var r, g, b;

  var i = Math.floor(h * 6);
  var f = h * 6 - i;
  var p = v * (1 - s);
  var q = v * (1 - f * s);
  var t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }

  return {
    red: Math.floor(r * 256),
    green: Math.floor(g * 256),
    blue: Math.floor(b * 256)
  }
}

class Camera {
  constructor() {
    this.zoom = 100;
    this.middle_re = 0;
    this.middle_im = 0;
  }

  // Convert physical coordinates to complex/world coordinates
  canvas_to_world_x(x) {
    return this.middle_re + (x - canvas.width / 2) / this.zoom;
  }

  canvas_to_world_y(y) {
    return this.middle_im - (y - canvas.height / 2) / this.zoom;
  }

  // Move the camera
  shift_real(amount) {
    this.middle_re += amount / this.zoom;
  }

  shift_imag(amount) {
    this.middle_im += amount / this.zoom;
  }
}

function check_point(c_re, c_im) {
  // Original Z values
  let z_re = 0;
  let z_im = 0;

  // Need to have a temporary variable to store the old z_re, as it z_re will get overwritten before computing z_im.
  let z_re_old = 0;

  for (let i = 0; i < max_iterations; i++) {
    z_re_old = z_re;

    // Using previously found formulae
    z_re = Math.abs(z_re)**2 - Math.abs(z_im)**2 + c_re;
    z_im = 2 * Math.abs(z_re_old) * Math.abs(z_im) + c_im;

    // Check if the modulus is greater than 2. Both sides of the modulus formula are squared to remove the need to compute square roots, which are slow.
    if (z_re**2 + z_im**2 > 4) {
      // Escaped, return escape time
      return i;
    }
  }

  // Escape not found within iteration count (cannot simply return false, as Javascript confuses false and 0 iterations)
  return -1;
}

const cam = new Camera();

function render() {
  let start_time = performance.now();

  // Define variables beforehand instead of creating them inside a loop, reducing object creation and garbage collection
  let point_re;
  let point_im;

  let escaped;
  let image_colour_indices;
  let pixel_colour;

  // Loop through every physical point
  for (let y = 0; y < ctx.canvas.height; y++) {
    for (let x = 0; x < ctx.canvas.width; x++) {
      // Find complex value of point
      point_re = cam.canvas_to_world_x(x);
      point_im = cam.canvas_to_world_y(y);

      // Check the point
      escaped = check_point(point_re, point_im);

      image_colour_indices = getColorIndicesForCoord(x, y, ctx.canvas.width);

      if (escaped == -1) {
        // Colour bounded pixels black
        image_data.data[image_colour_indices.red] = 0;
        image_data.data[image_colour_indices.green] = 0;
        image_data.data[image_colour_indices.blue] = 0;
        image_data.data[image_colour_indices.alpha] = 255;
      } else {
        // Maps the escape time to a hue from 0 to 0.8. 0.8 is used to remove the red colour from the end of the spectrum, as red is also the start of the spectrum.
        pixel_colour = hsvToRgb(escaped / max_iterations * 0.8, 1, 1);

        image_data.data[image_colour_indices.red] = pixel_colour.red;
        image_data.data[image_colour_indices.green] = pixel_colour.green;
        image_data.data[image_colour_indices.blue] = pixel_colour.blue;
        image_data.data[image_colour_indices.alpha] = 255;
      }
    }
  }

  ctx.putImageData(image_data, 0, 0);

  if (overlay == true) {
    ctx.globalAlpha = 0.5
    ctx.fillStyle = "white";
    ctx.fillRect(ctx.canvas.width / 2 - 1, 0, 1, ctx.canvas.height);
    ctx.fillRect(0, ctx.canvas.height / 2 - 1, ctx.canvas.width, 1);

    ctx.scale(3, 3);
    ctx.globalAlpha = 1
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 105, 16);

    ctx.fillStyle = "white";
    ctx.font = "5px Arial";
    ctx.fillText(`Draw time: ${performance.now() - start_time}`, 1, 5, 100);
    ctx.fillText(`Zoom: ${Math.round(cam.zoom)}`, 1, 10, 100);

    ctx.fillText(`Crosshair at: ${cam.middle_re.toFixed(10)} + ${cam.middle_im.toFixed(10)}i`, 1, 15, 100);
    ctx.scale(1/3, 1/3);
  }

  window.requestAnimationFrame(render);
}

window.addEventListener("keydown", (e) => {
  if (e.key == "a") {
    cam.shift_real(-5);
  } else if (e.key == "d") {
    cam.shift_real(5);
  }

  if (e.key == "w") {
    cam.shift_imag(5);
  } else if (e.key == "s") {
    cam.shift_imag(-5);
  }

  if (e.key == "i") {
    cam.zoom *= 1.2;
  } else if (e.key == "o") {
    cam.zoom *= 0.8;
  }
})

function update_params() {
  ctx.canvas.width = canvas.clientWidth / parseInt(ppp_input.value);
  ctx.canvas.height = canvas.clientHeight / parseInt(ppp_input.value);

  // Need to reset image_data after changing canvas size
  image_data = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
  max_iterations = parseInt(iterations_input.value);
  overlay = overlay_input.checked;

  for (let x = 0; x < max_iterations; x++) {
    const colour = hsvToRgb(x / max_iterations * 0.8, 1, 1);

    escape_time_ctx.fillStyle = `rgb(${colour.red}, ${colour.green}, ${colour.blue})`;
    escape_time_ctx.fillRect(x / max_iterations * escape_time_ctx.canvas.width, 0, escape_time_ctx.canvas.width, escape_time_ctx.canvas.height);
  }

  escape_time_mid_display.innerText = Math.ceil(max_iterations / 2);
  escape_time_end_display.innerText = max_iterations;
}

update_params();
render();