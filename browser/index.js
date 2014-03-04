var getUserMedia = require('getusermedia');
var Seriously = require('./lib/seriously');
window.Seriously = Seriously;
require('./lib/sources/seriously.camera.js');
require('./lib/effects/seriously.edge.js');
require('./lib/effects/seriously.blend.js');
require('./lib/effects/seriously.tvglitch.js');
require('./lib/effects/seriously.hue-saturation.js');
//require('./lib/effects/seriously.color.js');

var seriously = new Seriously();

//var source = seriously.source('camera');
var videoSource = document.getElementById('video');
var target = seriously.target('#target');

var invasion = {
  blend: seriously.effect('blend'),
  tv: seriously.effect('tvglitch'),
  blackwhite: seriously.effect('hue-saturation')
};
//invasion.blend.top = chroma;
//invasion.blend.bottom = images.curtain;
//invasion.blackwhite.source = invasion.blend;
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

/*
var color = seriously.effect('color');
color.color = "#e50000";
color.source = invasion.tv;
*/
// Connect node in the right order
//edge.source = source;

function resize() {
  target.width = videoSource.videoWidth;
  target.height = videoSource.videoHeight;
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

seriously.go();

console.log('go');





