var getUserMedia = require('getusermedia');
var Seriously = require('./lib/seriously');
window.Seriously = Seriously;
require('./lib/sources/seriously.camera.js');
require('./lib/effects/seriously.edge.js');
require('./lib/effects/seriously.tvglitch.js');
require('./lib/effects/seriously.hue-saturation.js');

var random = require('expact-random');

//var pModel = require('./lib/model_pca_20_svm');
//var clm = require('./lib/clmtrackr');
//var ctrack = new clm.tracker({useWebGL: false});
//ctrack.init(pModel);

var seriously = new Seriously();

var videoSource = document.getElementById('video');
var target = seriously.target('#target');

var invasion = {
  tv: seriously.effect('tvglitch'),
  blackwhite: seriously.effect('hue-saturation')
};
invasion.blackwhite.saturation = -1;
invasion.tv.source = invasion.blackwhite;
invasion.tv.distortion = 0.03;
invasion.tv.verticalSync = 0;
invasion.tv.scanlines = 0.1;
invasion.tv.lineSync = 0.03;
invasion.tv.frameSharpness = 10.67;
invasion.tv.frameShape = 0;
invasion.tv.frameLimit = 0;
invasion.tv.bars = 0.03;

function resize() {
  target.width = videoSource.videoWidth;
  target.height = videoSource.videoHeight;

  //ctrack.start(videoSource);
}

getUserMedia({video: true}, function (err, stream) {
  if (window.webkitURL) {
    videoSource.src = window.webkitURL.createObjectURL(stream);
  } else {
    videoSource.src = stream;
  }

  videoSource.play();
  if (videoSource.videoWidth) {
    resize();
  }

  videoSource.onloadedmetadata = videoSource.onplay = resize;
  invasion.blackwhite.source = videoSource;
  //invasion.tv.source = videoSource;
  //target.source = videoSource;
  target.source = invasion.tv;
  //target.source = color.source;
});

/*
function draw() {
  window.requestAnimationFrame(draw);
  var positions = ctrack.getCurrentPosition();
  //console.log(positions);
}
draw();
*/

seriously.go();

var aimEl = document.getElementById('crosshair');
var canvasEle = document.getElementById('target');

var zooms = [
  '100%',
  '120%',
  '150%',
  '100%',
  '100%',
];

var crosshairs = [
  'Aim.png',
  'Aim_4.png',
  'Aim_5.png',
  'Aim_6.png',
];
function swap() {
  aimEl.src = crosshairs[random.randomInt(0, crosshairs.length - 1)];
  canvasEle.style.width = zooms[random.randomInt(0, zooms.length - 1)];

  window.setTimeout(swap, random.randomInt(1000, 5000));
}

swap();

//console.log('go');


