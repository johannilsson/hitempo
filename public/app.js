;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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






},{"./lib/effects/seriously.blend.js":2,"./lib/effects/seriously.edge.js":3,"./lib/effects/seriously.hue-saturation.js":4,"./lib/effects/seriously.tvglitch.js":5,"./lib/seriously":6,"./lib/sources/seriously.camera.js":7,"getusermedia":8}],2:[function(require,module,exports){
/* global define, require */
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		// Node/CommonJS
		factory(require('../seriously'));
	} else if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['seriously'], factory);
	} else {
		if (!root.Seriously) {
			root.Seriously = { plugin: function (name, opt) { this[name] = opt; } };
		}
		factory(root.Seriously);
	}
}(this, function (Seriously, undefined) {
	'use strict';

	/*
	todo: for prototype version, blend only handles two layers. this should handle multiple layers?
	todo: if transforms are used, do multiple passes and enable depth testing?
	todo: for now, only supporting float blend modes. Add complex ones
	todo: apply proper credit and license

	** Romain Dura | Romz
	** Blog: http://blog.mouaif.org
	** Post: http://blog.mouaif.org/?p=94

	*/
	var modes = {
		'normal': 'BlendNormal',
		'lighten': 'BlendLighten',
		'darken': 'BlendDarken',
		'multiply': 'BlendMultiply',
		'average': 'BlendAverage',
		'add': 'BlendAdd',
		'subtract': 'BlendSubtract',
		'difference': 'BlendDifference',
		'negation': 'BlendNegation',
		'exclusion': 'BlendExclusion',
		'screen': 'BlendScreen',
		'overlay': 'BlendOverlay',
		'softlight': 'BlendSoftLight',
		'hardlight': 'BlendHardLight',
		'colordodge': 'BlendColorDodge',
		'colorburn': 'BlendColorBurn',
		'lineardodge': 'BlendLinearDodge',
		'linearburn': 'BlendLinearBurn',
		'linearlight': 'BlendLinearLight',
		'vividlight': 'BlendVividLight',
		'pinlight': 'BlendPinLight',
		'hardmix': 'BlendHardMix',
		'reflect': 'BlendReflect',
		'glow': 'BlendGlow',
		'phoenix': 'BlendPhoenix'
	},
	nativeBlendModes = {
		normal: ['FUNC_ADD', 'SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA', 'SRC_ALPHA', 'DST_ALPHA']/*,
		add: ['FUNC_ADD', 'SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA', 'SRC_ALPHA', 'DST_ALPHA']*/
	},
	identity = new Float32Array([
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	]);

	Seriously.plugin('blend', function () {
		var topUniforms,
			bottomUniforms,
			topOpts = {
				clear: false
			};

		// custom resize method
		this.resize = function () {
			var width,
				height,
				mode = this.inputs.sizeMode,
				node,
				fn,
				i,
				bottom = this.inputs.bottom,
				top = this.inputs.top;

			if (mode === 'bottom' || mode === 'top') {
				node = this.inputs[mode];
				if (node) {
					width = node.width;
					height = node.height;
				} else {
					width = 1;
					height = 1;
				}
			} else {
				if (bottom) {
					if (top) {
						fn = (mode === 'union' ? Math.max : Math.min);
						width = fn(bottom.width, top.width);
						height = fn(bottom.height, top.height);
					} else {
						width = bottom.width;
						height = bottom.height;
					}
				} else if (top) {
					width = top.width;
					height = top.height;
				} else {
					width = 1;
					height = 1;
				}
			}

			if (this.width !== width || this.height !== height) {
				this.width = width;
				this.height = height;

				this.uniforms.resolution[0] = width;
				this.uniforms.resolution[1] = height;

				if (this.frameBuffer) {
					this.frameBuffer.resize(width, height);
				}

				this.emit('resize');
				this.setDirty();
			}

			if (topUniforms) {
				if (bottom) {
					bottomUniforms.resolution[0] = bottom.width;
					bottomUniforms.resolution[1] = bottom.height;
				}
				if (top) {
					topUniforms.resolution[0] = top.width;
					topUniforms.resolution[1] = top.height;
				}
			}

			for (i = 0; i < this.targets.length; i++) {
				this.targets[i].resize();
			}
		};

		return {
			shader: function (inputs, shaderSource) {
				var mode = inputs.mode || 'normal',
					node;
				mode = mode.toLowerCase();

				if (nativeBlendModes[mode]) {
					//todo: move this to an 'update' event for 'mode' input
					if (!topUniforms) {
						node = this.inputs.top;
						topUniforms = {
							resolution: [
								node && node.width || 1,
								node && node.height || 1
							],
							targetRes: this.uniforms.resolution,
							source: node,
							transform: node && node.cumulativeMatrix || identity,
							opacity: 1
						};

						node = this.inputs.bottom;
						bottomUniforms = {
							resolution: [
								node && node.width || 1,
								node && node.height || 1
							],
							targetRes: this.uniforms.resolution,
							source: node,
							transform: node && node.cumulativeMatrix || identity,
							opacity: 1
						};
					}

					shaderSource.vertex = [
						'precision mediump float;',

						'attribute vec4 position;',
						'attribute vec2 texCoord;',

						'uniform vec2 resolution;',
						'uniform vec2 targetRes;',
						'uniform mat4 transform;',

						'varying vec2 vTexCoord;',
						'varying vec4 vPosition;',

						'void main(void) {',
						// first convert to screen space
						'	vec4 screenPosition = vec4(position.xy * resolution / 2.0, position.z, position.w);',
						'	screenPosition = transform * screenPosition;',

						// convert back to OpenGL coords
						'	gl_Position.xy = screenPosition.xy * 2.0 / resolution;',
						'	gl_Position.z = screenPosition.z * 2.0 / (resolution.x / resolution.y);',
						'	gl_Position.xy *= resolution / targetRes;',
						'	gl_Position.w = screenPosition.w;',
						'	vTexCoord = texCoord;',
						'	vPosition = gl_Position;',
						'}\n'
					].join('\n');

					shaderSource.fragment = [
						'precision mediump float;',
						'varying vec2 vTexCoord;',
						'varying vec4 vPosition;',
						'uniform sampler2D source;',
						'uniform float opacity;',
						'void main(void) {',
						'	gl_FragColor = texture2D(source, vTexCoord);',
						'	gl_FragColor.a *= opacity;',
						'}'
					].join('\n');

					return shaderSource;
				}

				topUniforms = null;
				bottomUniforms = null;

				mode = modes[mode] || 'BlendNormal';
				shaderSource.fragment = '#define BlendFunction ' + mode + '\n' +
					'#ifdef GL_ES\n\n' +
					'precision mediump float;\n\n' +
					'#endif\n\n' +
					'\n' +
					'#define BlendLinearDodgef				BlendAddf\n' +
					'#define BlendLinearBurnf				BlendSubtractf\n' +
					'#define BlendAddf(base, blend)			min(base + blend, 1.0)\n' +
					'#define BlendSubtractf(base, blend)	max(base + blend - 1.0, 0.0)\n' +
					'#define BlendLightenf(base, blend)		max(blend, base)\n' +
					'#define BlendDarkenf(base, blend)		min(blend, base)\n' +
					'#define BlendLinearLightf(base, blend)	(blend < 0.5 ? BlendLinearBurnf(base, (2.0 * blend)) : BlendLinearDodgef(base, (2.0 * (blend - 0.5))))\n' +
					'#define BlendScreenf(base, blend)		(1.0 - ((1.0 - base) * (1.0 - blend)))\n' +
					'#define BlendOverlayf(base, blend)		(base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend)))\n' +
					'#define BlendSoftLightf(base, blend)	((blend < 0.5) ? (2.0 * base * blend + base * base * (1.0 - 2.0 * blend)) : (sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend)))\n' +
					'#define BlendColorDodgef(base, blend)	((blend == 1.0) ? blend : min(base / (1.0 - blend), 1.0))\n' +
					'#define BlendColorBurnf(base, blend)	((blend == 0.0) ? blend : max((1.0 - ((1.0 - base) / blend)), 0.0))\n' +
					'#define BlendVividLightf(base, blend)	((blend < 0.5) ? BlendColorBurnf(base, (2.0 * blend)) : BlendColorDodgef(base, (2.0 * (blend - 0.5))))\n' +
					'#define BlendPinLightf(base, blend)	((blend < 0.5) ? BlendDarkenf(base, (2.0 * blend)) : BlendLightenf(base, (2.0 *(blend - 0.5))))\n' +
					'#define BlendHardMixf(base, blend)		((BlendVividLightf(base, blend) < 0.5) ? 0.0 : 1.0)\n' +
					'#define BlendReflectf(base, blend)		((blend == 1.0) ? blend : min(base * base / (1.0 - blend), 1.0))\n' +
					/*
					** Vector3 blending modes
					*/

					// Component wise blending
					'#define Blend(base, blend, funcf)		vec3(funcf(base.r, blend.r), funcf(base.g, blend.g), funcf(base.b, blend.b))\n' +
					'#define BlendNormal(base, blend)		(blend)\n' +
					'#define BlendLighten					BlendLightenf\n' +
					'#define BlendDarken					BlendDarkenf\n' +
					'#define BlendMultiply(base, blend)		(base * blend)\n' +
					'#define BlendAverage(base, blend)		((base + blend) / 2.0)\n' +
					'#define BlendAdd(base, blend)			min(base + blend, vec3(1.0))\n' +
					'#define BlendSubtract(base, blend)	max(base + blend - vec3(1.0), vec3(0.0))\n' +
					'#define BlendDifference(base, blend)	abs(base - blend)\n' +
					'#define BlendNegation(base, blend)		(vec3(1.0) - abs(vec3(1.0) - base - blend))\n' +
					'#define BlendExclusion(base, blend)	(base + blend - 2.0 * base * blend)\n' +
					'#define BlendScreen(base, blend)		Blend(base, blend, BlendScreenf)\n' +
					'#define BlendOverlay(base, blend)		Blend(base, blend, BlendOverlayf)\n' +
					'#define BlendSoftLight(base, blend)	Blend(base, blend, BlendSoftLightf)\n' +
					'#define BlendHardLight(base, blend)	BlendOverlay(blend, base)\n' +
					'#define BlendColorDodge(base, blend)	Blend(base, blend, BlendColorDodgef)\n' +
					'#define BlendColorBurn(base, blend)	Blend(base, blend, BlendColorBurnf)\n' +
					'#define BlendLinearDodge				BlendAdd\n' +
					'#define BlendLinearBurn				BlendSubtract\n' +
					// Linear Light is another contrast-increasing mode
					// If the blend color is darker than midgray, Linear Light darkens the image by decreasing the brightness. If the blend color is lighter than midgray, the result is a brighter image due to increased brightness.
					'#define BlendLinearLight(base, blend)	Blend(base, blend, BlendLinearLightf)\n' +
					'#define BlendVividLight(base, blend)	Blend(base, blend, BlendVividLightf)\n' +
					'#define BlendPinLight(base, blend)		Blend(base, blend, BlendPinLightf)\n' +
					'#define BlendHardMix(base, blend)		Blend(base, blend, BlendHardMixf)\n' +
					'#define BlendReflect(base, blend)		Blend(base, blend, BlendReflectf)\n' +
					'#define BlendGlow(base, blend)			BlendReflect(blend, base)\n' +
					'#define BlendPhoenix(base, blend)		(min(base, blend) - max(base, blend) + vec3(1.0))\n' +
					//'#define BlendOpacity(base, blend, F, O)	(F(base, blend) * O + blend * (1.0 - O))\n' +
					'#define BlendOpacity(base, blend, BlendFn, Opacity, Alpha)	((BlendFn(base.rgb * blend.a * Opacity, blend.rgb * blend.a * Opacity) + base.rgb * base.a * (1.0 - blend.a * Opacity)) / Alpha)\n' +
					'\n' +
					'varying vec2 vTexCoord;\n' +
					'varying vec4 vPosition;\n' +
					'\n' +
					'uniform sampler2D top;\n' +
					'\n' +
					'uniform sampler2D bottom;\n' +
					'\n' +
					'uniform float opacity;\n' +
					'\n' +
					'void main(void) {\n' +
					'	vec3 color;\n' +
					'	vec4 topPixel = texture2D(top, vTexCoord);\n' +
					'	vec4 bottomPixel = texture2D(bottom, vTexCoord);\n' +

					'	float alpha = topPixel.a + bottomPixel.a * (1.0 - topPixel.a);\n' +
					'	if (alpha == 0.0) {\n' +
					'		color = vec3(0.0);\n' +
					'	} else {\n' +
					'		color = BlendOpacity(bottomPixel, topPixel, BlendFunction, opacity, alpha);\n' +
					'	}\n' +
					'	gl_FragColor = vec4(color, alpha);\n' +
					'}\n';

				return shaderSource;
			},
			draw: function (shader, model, uniforms, frameBuffer, draw) {
				if (nativeBlendModes[this.inputs.mode]) {
					if (this.inputs.bottom) {
						draw(shader, model, bottomUniforms, frameBuffer);
					}

					if (this.inputs.top) {
						draw(shader, model, topUniforms, frameBuffer, null, topOpts);
					}
				} else {
					draw(shader, model, uniforms, frameBuffer);
				}
			},
			inputs: {
				top: {
					type: 'image',
					uniform: 'top',
					update: function () {
						if (topUniforms) {
							topUniforms.source = this.inputs.top;
							topUniforms.transform = this.inputs.top.cumulativeMatrix || identity;
						}
						this.resize();
					}
				},
				bottom: {
					type: 'image',
					uniform: 'bottom',
					update: function () {
						if (bottomUniforms) {
							bottomUniforms.source = this.inputs.bottom;
							bottomUniforms.transform = this.inputs.bottom.cumulativeMatrix || identity;
						}
						this.resize();
					}
				},
				opacity: {
					type: 'number',
					uniform: 'opacity',
					defaultValue: 1,
					min: 0,
					max: 1,
					update: function (opacity) {
						if (topUniforms) {
							topUniforms.opacity = opacity;
						}
					}
				},
				sizeMode: {
					type: 'enum',
					defaultValue: 'bottom',
					options: [
						'bottom',
						'top',
						'union',
						'intersection'
					],
					update: function () {
						this.resize();
					}
				},
				mode: {
					type: 'enum',
					shaderDirty: true,
					defaultValue: 'normal',
					options: [
						['normal', 'Normal'],
						['lighten', 'Lighten'],
						['darken', 'Darken'],
						['multiply', 'Multiply'],
						['average', 'Average'],
						['add', 'Add'],
						['substract', 'Substract'],
						['difference', 'Difference'],
						['negation', 'Negation'],
						['exclusion', 'Exclusion'],
						['screen', 'Screen'],
						['overlay', 'Overlay'],
						['softlight', 'Soft Light'],
						['hardlight', 'Hard Light'],
						['colordodge', 'Color Dodge'],
						['colorburn', 'Color Burn'],
						['lineardodge', 'Linear Dodge'],
						['linearburn', 'Linear Burn'],
						['linearlight', 'Linear Light'],
						['vividlight', 'Vivid Light'],
						['pinlight', 'Pin Light'],
						['hardmix', 'Hard Mix'],
						['reflect', 'Reflect'],
						['glow', 'Glow'],
						['phoenix', 'Phoenix']
					]
				}
			}
		};
	},
	{
		inPlace: function () {
			return !!nativeBlendModes[this.inputs.mode];
		},
		description: 'Blend two layers',
		title: 'Blend'
	});
}));

},{"../seriously":6}],3:[function(require,module,exports){
/* global define, require */
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		// Node/CommonJS
		factory(require('../seriously'));
	} else if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['seriously'], factory);
	} else {
		if (!root.Seriously) {
			root.Seriously = { plugin: function (name, opt) { this[name] = opt; } };
		}
		factory(root.Seriously);
	}
}(this, function (Seriously, undefined) {
	'use strict';

	//	Adapted from http://rastergrid.com/blog/2011/01/frei-chen-edge-detector/
	var sqrt = Math.sqrt,
		i, j,
		flatMatrices = [],
		matrices,
		freiChenMatrixConstants,
		sobelMatrixConstants;

	//initialize shader matrix arrays
	function multiplyArray(factor, a) {
		var i;
		for (i = 0; i < a.length; i++) {
			a[i] *= factor;
		}
		return a;
	}

	matrices = [
		multiplyArray(1.0 / (2.0 * sqrt(2.0)), [ 1.0, sqrt(2.0), 1.0, 0.0, 0.0, 0.0, -1.0, -sqrt(2.0), -1.0 ]),
		multiplyArray(1.0 / (2.0 * sqrt(2.0)), [1.0, 0.0, -1.0, sqrt(2.0), 0.0, -sqrt(2.0), 1.0, 0.0, -1.0]),
		multiplyArray(1.0 / (2.0 * sqrt(2.0)), [0.0, -1.0, sqrt(2.0), 1.0, 0.0, -1.0, -sqrt(2.0), 1.0, 0.0]),
		multiplyArray(1.0 / (2.0 * sqrt(2.0)), [sqrt(2.0), -1.0, 0.0, -1.0, 0.0, 1.0, 0.0, 1.0, -sqrt(2.0)]),
		multiplyArray(1.0 / 2.0, [0.0, 1.0, 0.0, -1.0, 0.0, -1.0, 0.0, 1.0, 0.0]),
		multiplyArray(1.0 / 2.0, [-1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, -1.0]),
		multiplyArray(1.0 / 6.0, [1.0, -2.0, 1.0, -2.0, 4.0, -2.0, 1.0, -2.0, 1.0]),
		multiplyArray(1.0 / 6.0, [-2.0, 1.0, -2.0, 1.0, 4.0, 1.0, -2.0, 1.0, -2.0]),
		multiplyArray(1.0 / 3.0, [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0])
	];

	for (i = 0; i < matrices.length; i++) {
		for (j = 0; j < matrices[i].length; j++) {
			flatMatrices.push(matrices[i][j]);
		}
	}

	freiChenMatrixConstants = new Float32Array(flatMatrices);

	sobelMatrixConstants = new Float32Array([
		1.0, 2.0, 1.0, 0.0, 0.0, 0.0, -1.0, -2.0, -1.0,
		1.0, 0.0, -1.0, 2.0, 0.0, -2.0, 1.0, 0.0, -1.0
	]);

	Seriously.plugin('edge', {
		shader: function (inputs, shaderSource) {
			var defines;

			if (inputs.mode === 'sobel') {
				defines = '#define N_MATRICES 2\n' +
				'#define SOBEL\n';
			} else {
				//frei-chen
				defines = '#define N_MATRICES 9\n';
			}

			shaderSource.fragment = defines +
				'#ifdef GL_ES\n' +
				'precision mediump float;\n' +
				'#endif\n' +
				'\n' +
				'varying vec2 vTexCoord;\n' +
				'varying vec4 vPosition;\n' +
				'\n' +
				'uniform sampler2D source;\n' +
				'uniform float pixelWidth;\n' +
				'uniform float pixelHeight;\n' +
				'uniform mat3 G[9];\n' +
				'\n' +
				'void main(void) {\n' +
				'	mat3 I;\n' +
				'	float dp3, cnv[9];\n' +
				'	vec3 tc;\n' +

				// fetch the 3x3 neighbourhood and use the RGB vector's length as intensity value
				'	float fi = 0.0, fj = 0.0;\n' +
				'	for (int i = 0; i < 3; i++) {\n' +
				'		fj = 0.0;\n' +
				'		for (int j = 0; j < 3; j++) {\n' +
				'			I[i][j] = length( ' +
							'texture2D(source, ' +
								'vTexCoord + vec2((fi - 1.0) * pixelWidth, (fj - 1.0) * pixelHeight)' +
							').rgb );\n' +
				'			fj += 1.0;\n' +
				'		};\n' +
				'		fi += 1.0;\n' +
				'	};\n' +

				// calculate the convolution values for all the masks

				'	for (int i = 0; i < N_MATRICES; i++) {\n' +
				'		dp3 = dot(G[i][0], I[0]) + dot(G[i][1], I[1]) + dot(G[i][2], I[2]);\n' +
				'		cnv[i] = dp3 * dp3;\n' +
				'	};\n' +
				'\n' +

				//Sobel
				'#ifdef SOBEL\n' +
				'	tc = vec3(0.5 * sqrt(cnv[0]*cnv[0]+cnv[1]*cnv[1]));\n' +
				'#else\n' +

				//Frei-Chen
				// Line detector
				'	float M = (cnv[4] + cnv[5]) + (cnv[6] + cnv[7]);\n' +
				'	float S = (cnv[0] + cnv[1]) + (cnv[2] + cnv[3]) + (cnv[4] + cnv[5]) + (cnv[6] + cnv[7]) + cnv[8];\n' +
				'	tc = vec3(sqrt(M/S));\n' +
				'#endif\n' +

				'	gl_FragColor = vec4(tc, 1.0);\n' +
				'}\n';

			return shaderSource;
		},
		draw: function (shader, model, uniforms, frameBuffer, parent) {

			uniforms.pixelWidth = 1 / this.width;
			uniforms.pixelHeight = 1 / this.height;

			if (this.inputs.mode === 'sobel') {
				uniforms['G[0]'] = sobelMatrixConstants;
			} else {
				uniforms['G[0]'] = freiChenMatrixConstants;
			}

			parent(shader, model, uniforms, frameBuffer);
		},
		inputs: {
			source: {
				type: 'image',
				uniform: 'source'
			},
			mode: {
				type: 'enum',
				shaderDirty: true,
				defaultValue: 'sobel',
				options: [
					['sobel', 'Sobel'],
					['frei-chen', 'Frei-Chen']
				]
			}
		},
		description: 'Edge Detect',
		title: 'Edge Detect'
	});
}));

},{"../seriously":6}],4:[function(require,module,exports){
/* global define, require */
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		// Node/CommonJS
		factory(require('../seriously'));
	} else if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['seriously'], factory);
	} else {
		if (!root.Seriously) {
			root.Seriously = { plugin: function (name, opt) { this[name] = opt; } };
		}
		factory(root.Seriously);
	}
}(this, function (Seriously, undefined) {
	'use strict';

	//inspired by Evan Wallace (https://github.com/evanw/glfx.js)

	Seriously.plugin('hue-saturation', {
		commonShader: true,
		shader: function (inputs, shaderSource) {
			shaderSource.vertex = [
				'#ifdef GL_ES',
				'precision mediump float;',
				'#endif ',

				'attribute vec4 position;',
				'attribute vec2 texCoord;',

				'uniform vec2 resolution;',
				'uniform mat4 projection;',
				'uniform mat4 transform;',

				'uniform float hue;',
				'uniform float saturation;',

				'varying vec2 vTexCoord;',
				'varying vec4 vPosition;',

				'varying vec3 weights;',

				'void main(void) {',
				'	float angle = hue * 3.14159265358979323846264;',
				'	float s = sin(angle);',
				'	float c = cos(angle);',
				'	weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;',

				// first convert to screen space
				'	vec4 screenPosition = vec4(position.xy * resolution / 2.0, position.z, position.w);',
				'	screenPosition = transform * screenPosition;',

				// convert back to OpenGL coords
				'	gl_Position = screenPosition;',
				'	gl_Position.xy = screenPosition.xy * 2.0 / resolution;',
				'	gl_Position.z = screenPosition.z * 2.0 / (resolution.x / resolution.y);',
				'	vTexCoord = texCoord;',
				'	vPosition = gl_Position;',
				'}'
			].join('\n');
			shaderSource.fragment = [
				'#ifdef GL_ES\n',
				'precision mediump float;\n',
				'#endif\n',

				'varying vec2 vTexCoord;',
				'varying vec4 vPosition;',

				'varying vec3 weights;',

				'uniform sampler2D source;',
				'uniform float hue;',
				'uniform float saturation;',

				'void main(void) {',
				'	vec4 color = texture2D(source, vTexCoord);',

				//adjust hue
				'	float len = length(color.rgb);',
				'	color.rgb = vec3(' +
						'dot(color.rgb, weights.xyz), ' +
						'dot(color.rgb, weights.zxy), ' +
						'dot(color.rgb, weights.yzx) ' +
				');',

				//adjust saturation
				'	vec3 adjustment = (color.r + color.g + color.b) / 3.0 - color.rgb;',
				'	if (saturation > 0.0) {',
				'		adjustment *= (1.0 - 1.0 / (1.0 - saturation));',
				'	} else {',
				'		adjustment *= (-saturation);',
				'	}',
				'	color.rgb += adjustment;',

				'	gl_FragColor = color;',
				'}'
			].join('\n');
			return shaderSource;
		},
		inPlace: true,
		inputs: {
			source: {
				type: 'image',
				uniform: 'source'
			},
			hue: {
				type: 'number',
				uniform: 'hue',
				defaultValue: 0.4,
				min: -1,
				max: 1
			},
			saturation: {
				type: 'number',
				uniform: 'saturation',
				defaultValue: 0,
				min: -1,
				max: 1
			}
		},
		title: 'Hue/Saturation',
		description: 'Rotate hue and multiply saturation.'
	});
}));

},{"../seriously":6}],5:[function(require,module,exports){
/* global define, require */
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		// Node/CommonJS
		factory(require('../seriously'));
	} else if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['seriously'], factory);
	} else {
		if (!root.Seriously) {
			root.Seriously = { plugin: function (name, opt) { this[name] = opt; } };
		}
		factory(root.Seriously);
	}
}(this, function (Seriously, undefined) {
	'use strict';

	//particle parameters
	var minVelocity = 0.2,
		maxVelocity = 0.8,
		minSize = 0.02,
		maxSize = 0.3,
		particleCount = 20;

	Seriously.plugin('tvglitch', function () {
		var lastHeight,
			lastTime,
			particleBuffer,
			particleShader,
			particleFrameBuffer,
			gl;

		return {
			initialize: function (parent) {
				var i,
					sizeRange,
					velocityRange,
					particleVertex,
					particleFragment,
					particles;

				gl = this.gl;

				lastHeight = this.height;

				//initialize particles
				particles = [];
				sizeRange = maxSize - minSize;
				velocityRange = maxVelocity - minVelocity;
				for (i = 0; i < particleCount; i++) {
					particles.push(Math.random() * 2 - 1); //position
					particles.push(Math.random() * velocityRange + minVelocity); //velocity
					particles.push(Math.random() * sizeRange + minSize); //size
					particles.push(Math.random() * 0.2); //intensity
				}

				particleBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particles), gl.STATIC_DRAW);
				particleBuffer.itemSize = 4;
				particleBuffer.numItems = particleCount;

				particleVertex = '#ifdef GL_ES\n' +
				'precision mediump float;\n' +
				'#endif \n' +
				'\n' +
				'attribute vec4 particle;\n' +
				'\n' +
				'uniform float time;\n' +
				'uniform float height;\n' +
				'\n' +
				'varying float intensity;\n' +
				'\n' +
				'void main(void) {\n' +
				'	float y = particle.x + time * particle.y;\n' +
				'	y = fract((y + 1.0) / 2.0) * 4.0 - 2.0;\n' +
				'	intensity = particle.w;\n' +
				'	gl_Position = vec4(0.0, -y , 1.0, 2.0);\n' +
				//'	gl_Position = vec4(0.0, 1.0 , 1.0, 1.0);\n' +
				'	gl_PointSize = height * particle.z;\n' +
				'}\n';

				particleFragment = '#ifdef GL_ES\n\n' +
				'precision mediump float;\n\n' +
				'#endif\n\n' +
				'\n' +
				'varying float intensity;\n' +
				'\n' +
				'void main(void) {\n' +
				'	gl_FragColor = vec4(1.0);\n' +
				'	gl_FragColor.a = 2.0 * intensity * (1.0 - abs(gl_PointCoord.y - 0.5));\n' +
				'}\n';

				particleShader = new Seriously.util.ShaderProgram(gl, particleVertex, particleFragment);

				particleFrameBuffer = new Seriously.util.FrameBuffer(gl, 1, Math.max(1, this.height / 2));
				parent();
			},
			commonShader: true,
			shader: function (inputs, shaderSource) {
				//baseShader = this.baseShader;

				shaderSource.fragment = '#ifdef GL_ES\n\n' +
					'precision mediump float;\n\n' +
					'#endif\n\n' +
					'\n' +
					//'#define HardLight(top, bottom) (top < 0.5 ? (2.0 * top * bottom) : (1.0 - 2.0 * (1.0 - top) * (1.0 - bottom)))\n' +
					'#define HardLight(top, bottom)  (1.0 - 2.0 * (1.0 - top) * (1.0 - bottom))\n' +
					'\n' +
					'varying vec2 vTexCoord;\n' +
					'varying vec4 vPosition;\n' +
					'\n' +
					'uniform sampler2D source;\n' +
					'uniform sampler2D particles;\n' +
					'uniform float time;\n' +
					'uniform float scanlines;\n' +
					'uniform float lineSync;\n' +
					'uniform float lineHeight;\n' + //for scanlines and distortion
					'uniform float distortion;\n' +
					'uniform float vsync;\n' +
					'uniform float bars;\n' +
					'uniform float frameSharpness;\n' +
					'uniform float frameShape;\n' +
					'uniform float frameLimit;\n' +
					'uniform vec4 frameColor;\n' +
					'\n' +
					//todo: need much better pseudo-random number generator
					Seriously.util.shader.noiseHelpers +
					Seriously.util.shader.snoise2d +
					'\n' +
					'void main(void) {\n' +
					'	vec2 texCoord = vTexCoord;\n' +

						//distortion
					'	float drandom = snoise(vec2(time * 50.0, texCoord.y /lineHeight));\n' +
					'	float distortAmount = distortion * (drandom - 0.25) * 0.5;\n' +
						//line sync
					'	vec4 particleOffset = texture2D(particles, vec2(0.0, texCoord.y));\n' +
					'	distortAmount -= lineSync * (2.0 * particleOffset.a - 0.5);\n' +

					'	texCoord.x -= distortAmount;\n' +
					//'	texCoord.x = max(0.0, texCoord.x);\n' +
					//'	texCoord.x = min(1.0, texCoord.x);\n' +
					'	texCoord.x = mod(texCoord.x, 1.0);\n' +

						//vertical sync
					'	float roll;\n' +
					'	if (vsync != 0.0) {\n' +
					'		roll = fract(time / vsync);\n' +
					'		texCoord.y = mod(texCoord.y - roll, 1.0);\n' +
					'	}\n' +

					'	vec4 pixel = texture2D(source, texCoord);\n' +

						//horizontal bars
					'	float barsAmount = particleOffset.r;\n' +
					'	if (barsAmount > 0.0) {\n' +
					/*
					'		pixel = vec4(HardLight(pixel.r * bars, barsAmount),' +
								'HardLight(pixel.g * bars, barsAmount),' +
								'HardLight(pixel.b * bars, barsAmount),' +
								'pixel.a);\n' +
					*/
					'		pixel = vec4(pixel.r + bars * barsAmount,' +
								'pixel.g + bars * barsAmount,' +
								'pixel.b + bars * barsAmount,' +
								'pixel.a);\n' +
					'	}\n' +

					'	if (mod(texCoord.y / lineHeight, 2.0) < 1.0 ) {\n' +
					'		pixel.rgb *= (1.0 - scanlines);\n' +
					'	}\n' +

					'	float f = (1.0 - vPosition.x * vPosition.x) * (1.0 - vPosition.y * vPosition.y);\n' +
					'	float frame = clamp( frameSharpness * (pow(f, frameShape) - frameLimit), 0.0, 1.0);\n' +

					//'	gl_FragColor.r = vec4(1.0);\n' +

					'	gl_FragColor = mix(frameColor, pixel, frame); //vec4(vec3(particleOffset), 1.0);\n' +
					//'	gl_FragColor = vec4(particleOffset);\n' +
					//'	gl_FragColor.a = 1.0;\n' +
					'}\n';

				return shaderSource;
			},
			resize: function () {
				particleFrameBuffer.resize(1, Math.max(1, this.height / 2));
			},
			draw: function (shader, model, uniforms, frameBuffer, parent) {
				var doParticles = (lastTime !== this.inputs.time),
					vsyncPeriod;

				if (lastHeight !== this.height) {
					lastHeight = this.height;
					doParticles = true;
				}

				//todo: make this configurable?
				uniforms.lineHeight = 1 / this.height;

				if (this.inputs.verticalSync) {
					vsyncPeriod = 0.2 / this.inputs.verticalSync;
					uniforms.vsync = vsyncPeriod;
				} else {
					vsyncPeriod = 1;
					uniforms.vsync = 0;
				}
				uniforms.time = (this.inputs.time % (10000 * vsyncPeriod)) / 1000;
				uniforms.distortion = Math.random() * this.inputs.distortion;

				//render particle canvas and attach uniform
				//todo: this is a good spot for parallel processing. ParallelArray maybe?
				if (doParticles && (this.inputs.lineSync || this.inputs.bars)) {
					particleShader.use();
					gl.viewport(0, 0, 1, this.height / 2);
					gl.bindFramebuffer(gl.FRAMEBUFFER, particleFrameBuffer.frameBuffer);
					gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
					gl.enableVertexAttribArray(particleShader.location.particle);
					gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
					gl.vertexAttribPointer(particleShader.location.particle, particleBuffer.itemSize, gl.FLOAT, false, 0, 0);
					gl.enable(gl.BLEND);
					gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
					particleShader.time.set(uniforms.time);
					particleShader.height.set(this.height);
					gl.drawArrays(gl.POINTS, 0, particleCount);

					lastTime = this.inputs.time;
				}
				uniforms.particles = particleFrameBuffer.texture;

				parent(shader, model, uniforms, frameBuffer);
			},
			destroy: function () {
				particleBuffer = null;
				if (particleFrameBuffer) {
					particleFrameBuffer.destroy();
					particleFrameBuffer = null;
				}
			}
		};
	},
	{
		inPlace: false,
		inputs: {
			source: {
				type: 'image',
				uniform: 'source',
				shaderDirty: false
			},
			time: {
				type: 'number',
				defaultValue: 0
			},
			distortion: {
				type: 'number',
				defaultValue: 0.1,
				min: 0,
				max: 1
			},
			verticalSync: {
				type: 'number',
				defaultValue: 0.1,
				min: 0,
				max: 1
			},
			lineSync: {
				type: 'number',
				uniform: 'lineSync',
				defaultValue: 0.2,
				min: 0,
				max: 1
			},
			scanlines: {
				type: 'number',
				uniform: 'scanlines',
				defaultValue: 0.3,
				min: 0,
				max: 1
			},
			bars: {
				type: 'number',
				uniform: 'bars',
				defaultValue: 0,
				min: 0,
				max: 1
			},
			frameShape: {
				type: 'number',
				uniform: 'frameShape',
				min: 0,
				max: 2,
				defaultValue: 0.27
			},
			frameLimit: {
				type: 'number',
				uniform: 'frameLimit',
				min: -1,
				max: 1,
				defaultValue: 0.34
			},
			frameSharpness: {
				type: 'number',
				uniform: 'frameSharpness',
				min: 0,
				max: 40,
				defaultValue: 8.4
			},
			frameColor: {
				type: 'color',
				uniform: 'frameColor',
				defaultValue: [0, 0, 0, 1]
			}
		},
		title: 'TV Glitch'
	});
}));

},{"../seriously":6}],6:[function(require,module,exports){
/*jslint devel: true, bitwise: true, browser: true, white: true, nomen: true, plusplus: true, maxerr: 50, indent: 4, todo: true */
/*global Float32Array, Uint8Array, Uint16Array, WebGLTexture, HTMLInputElement, HTMLSelectElement, HTMLElement, WebGLFramebuffer, HTMLCanvasElement, WebGLRenderingContext, define, module, exports */
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like enviroments that support module.exports,
		// like Node.
		module.exports = factory(root);
	} else if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define('seriously', function () {
			var Seriously = factory(root);
			if (!root.Seriously) {
				root.Seriously = Seriously;
			}
			return Seriously;
		});
	} else if (typeof root.Seriously !== 'function') {
		// Browser globals
		root.Seriously = factory(root);
	}
}(this, function () {
	'use strict';

	//var document = window.document,
	//	console = window.console,

	/*
		Global environment variables
	*/
  var
	testContext,
	colorElement,
	incompatibility,
	seriousEffects = {},
	seriousTransforms = {},
	seriousSources = {},
	timeouts = [],
	allEffectsByHook = {},
	allTransformsByHook = {},
	allSourcesByHook = {
		canvas: [],
		image: [],
		video: []
	},
	identity,
	maxSeriouslyId = 0,
	nop = function () {},

	/*
		Global reference variables
	*/

	// http://www.w3.org/TR/css3-color/#svg-color
	colorNames = {
		transparent: [0, 0, 0, 0],
		black: [0, 0, 0, 1],
		red: [1, 0, 0, 1],
		green: [0, 1, 0, 1],
		blue: [0, 0, 1, 1],
		white: [1, 1, 1, 1]
	},

	vectorFields = ['x', 'y', 'z', 'w'],
	colorFields = ['r', 'g', 'b', 'a'],

	/*
		utility functions
	*/

	/*
	mat4 matrix functions borrowed from gl-matrix by toji
	https://github.com/toji/gl-matrix
	License: https://github.com/toji/gl-matrix/blob/master/LICENSE.md
	*/
	mat4 = {
		/*
		 * mat4.frustum
		 * Generates a frustum matrix with the given bounds
		 *
		 * Params:
		 * left, right - scalar, left and right bounds of the frustum
		 * bottom, top - scalar, bottom and top bounds of the frustum
		 * near, far - scalar, near and far bounds of the frustum
		 * dest - Optional, mat4 frustum matrix will be written into
		 *
		 * Returns:
		 * dest if specified, a new mat4 otherwise
		 */
		frustum: function (left, right, bottom, top, near, far, dest) {
			if(!dest) { dest = mat4.create(); }
			var rl = (right - left),
				tb = (top - bottom),
				fn = (far - near);
			dest[0] = (near*2) / rl;
			dest[1] = 0;
			dest[2] = 0;
			dest[3] = 0;
			dest[4] = 0;
			dest[5] = (near*2) / tb;
			dest[6] = 0;
			dest[7] = 0;
			dest[8] = (right + left) / rl;
			dest[9] = (top + bottom) / tb;
			dest[10] = -(far + near) / fn;
			dest[11] = -1;
			dest[12] = 0;
			dest[13] = 0;
			dest[14] = -(far*near*2) / fn;
			dest[15] = 0;
			return dest;
		},

		perspective: function (fovy, aspect, near, far, dest) {
			var top = near*Math.tan(fovy*Math.PI / 360.0),
				right = top*aspect;
			return mat4.frustum(-right, right, -top, top, near, far, dest);
		},
		multiply: function (dest, mat, mat2) {
			// Cache the matrix values (makes for huge speed increases!)
			var a00 = mat[0], a01 = mat[1], a02 = mat[2], a03 = mat[3],
				a10 = mat[4], a11 = mat[5], a12 = mat[6], a13 = mat[7],
				a20 = mat[8], a21 = mat[9], a22 = mat[10], a23 = mat[11],
				a30 = mat[12], a31 = mat[13], a32 = mat[14], a33 = mat[15],

			// Cache only the current line of the second matrix
			b0 = mat2[0], b1 = mat2[1], b2 = mat2[2], b3 = mat2[3];
			dest[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
			dest[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
			dest[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
			dest[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

			b0 = mat2[4];
			b1 = mat2[5];
			b2 = mat2[6];
			b3 = mat2[7];
			dest[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
			dest[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
			dest[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
			dest[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

			b0 = mat2[8];
			b1 = mat2[9];
			b2 = mat2[10];
			b3 = mat2[11];
			dest[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
			dest[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
			dest[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
			dest[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

			b0 = mat2[12];
			b1 = mat2[13];
			b2 = mat2[14];
			b3 = mat2[15];
			dest[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
			dest[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
			dest[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
			dest[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

			return dest;
		},
		identity: function (dest) {
			dest[0] = 1;
			dest[1] = 0;
			dest[2] = 0;
			dest[3] = 0;
			dest[4] = 0;
			dest[5] = 1;
			dest[6] = 0;
			dest[7] = 0;
			dest[8] = 0;
			dest[9] = 0;
			dest[10] = 1;
			dest[11] = 0;
			dest[12] = 0;
			dest[13] = 0;
			dest[14] = 0;
			dest[15] = 1;
			return dest;
		},
		copy: function (out, a) {
			out[0] = a[0];
			out[1] = a[1];
			out[2] = a[2];
			out[3] = a[3];
			out[4] = a[4];
			out[5] = a[5];
			out[6] = a[6];
			out[7] = a[7];
			out[8] = a[8];
			out[9] = a[9];
			out[10] = a[10];
			out[11] = a[11];
			out[12] = a[12];
			out[13] = a[13];
			out[14] = a[14];
			out[15] = a[15];
			return out;
		}
	},

	requestAnimationFrame = (function (){
		var lastTime = 0;
		return  window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				window.oRequestAnimationFrame ||
				window.msRequestAnimationFrame ||
				function (callback) {
					var currTime, timeToCall, id;

					function timeoutCallback() {
						callback(currTime + timeToCall);
					}

					currTime = new Date().getTime();
					timeToCall = Math.max(0, 16 - (currTime - lastTime));
					id = window.setTimeout(timeoutCallback, timeToCall);
					lastTime = currTime + timeToCall;
					return id;
				};
	}()),

	cancelAnimFrame = (function (){
		return  window.cancelAnimationFrame ||
				window.webkitCancelAnimationFrame ||
				window.mozCancelAnimationFrame ||
				window.oCancelAnimationFrame ||
				window.msCancelAnimationFrame ||
				function (id) {
					window.cancelTimeout(id);
				};
	}()),

	reservedNames = ['source', 'target', 'effect', 'effects', 'benchmark', 'incompatible',
		'util', 'ShaderProgram', 'inputValidators', 'save', 'load',
		'plugin', 'removePlugin', 'alias', 'removeAlias', 'stop', 'go',
		'destroy', 'isDestroyed'];

	function getElement(input, tags) {
		var element,
			tag;
		if (typeof input === 'string') {
			//element = document.getElementById(input) || document.getElementsByTagName(input)[0];
			element = document.querySelector(input);
		} else if (!input) {
			return false;
		}

		if (input.tagName) {
			element = input;
		}

		if (!element) {
			return input;
		}

		tag = element.tagName.toLowerCase();
		if (tags && tags.indexOf(tag) < 0) {
			return input;
		}

		return element;
	}

	function extend(dest, src) {
		var property,
			descriptor;

		//todo: are we sure this is safe?
		if (dest.prototype && src.prototype && dest.prototype !== src.prototype) {
			extend(dest.prototype, src.prototype);
		}

		for (property in src) {
			if (src.hasOwnProperty(property)) {
				descriptor = Object.getOwnPropertyDescriptor(src, property);

				if (descriptor.get || descriptor.set) {
					Object.defineProperty(dest, property, {
						configurable: true,
						enumerable: true,
						get: descriptor.get,
						set: descriptor.set
					});
				} else {
					dest[property] = src[property];
				}
			}
		}

		return dest;
	}

	//http://www.w3.org/TR/css3-color/#hsl-color
	function hslToRgb(h, s, l, a, out) {
		function hueToRgb(m1, m2, h) {
			h = h % 1;
			if (h < 0) {
				h += 1;
			}
			if (h < 1 / 6) {
				return m1 + (m2 - m1) * h * 6;
			}
			if (h < 1 / 2) {
				return m2;
			}
			if (h < 2 / 3) {
				return m1 + (m2 - m1) * (2/3 - h) * 6;
			}
			return m1;
		}

		var m1, m2;
		if (l < 0.5) {
			m2 = l * (s + 1);
		} else {
			m2 = l + s - l * s;
		}
		m1 = l * 2 - m2;

		if (!out) {
			out = [];
		}

		out[0] = hueToRgb(m1, m2, h + 1/3);
		out[1] = hueToRgb(m1, m2, h);
		out[2] = hueToRgb(m1, m2, h - 1/3);
		out[3] = a;

		return out;
	}

	/*
	faster than setTimeout(fn, 0);
	http://dbaron.org/log/20100309-faster-timeouts
	*/
	function setTimeoutZero(fn) {
		/*
		Workaround for postMessage bug in Firefox if the page is loaded from the file system
		https://bugzilla.mozilla.org/show_bug.cgi?id=740576
		Should run fine, but maybe a few milliseconds slower per frame.
		*/
		function timeoutFunction() {
			if (timeouts.length) {
				(timeouts.shift())();
			}
		}

		if (typeof fn !== 'function') {
			throw 'setTimeoutZero argument is not a function';
		}

		timeouts.push(fn);
		if (window.location.protocol === 'file:') {
			setTimeout(timeoutFunction, 0);
			return;
		}

		window.postMessage('seriously-timeout-message', window.location);
	}

	function isArrayLike(obj) {
		return Array.isArray(obj) ||
			(obj && obj.BYTES_PER_ELEMENT && 'length' in obj);
	}

	window.addEventListener('message', function (event) {
		if (event.source === window && event.data === 'seriously-timeout-message') {
			event.stopPropagation();
			if (timeouts.length > 0) {
				var fn = timeouts.shift();
				fn();
			}
		}
	}, true);

	function getTestContext() {
		var canvas;

		if (testContext || !window.WebGLRenderingContext) {
			return testContext;
		}

		canvas = document.createElement('canvas');
		try {
			testContext = canvas.getContext('webgl');
		} catch (webglError) {
		}

		if (!testContext) {
			try {
				testContext = canvas.getContext('experimental-webgl');
			} catch (expWebglError) {
			}
		}

		if (testContext) {
			canvas.addEventListener('webglcontextlost', function (event) {
				/*
				If/When context is lost, just clear testContext and create
				a new one the next time it's needed
				*/
				event.preventDefault();
				if (testContext && testContext.canvas === this) {
					testContext = undefined;
				}
			}, false);
		} else {
			console.log('Unable to access WebGL.');
		}

		return testContext;
	}

	function checkSource(source) {
		var element, canvas, ctx, texture;

		//todo: don't need to create a new array every time we do this
		element = getElement(source, ['img', 'canvas', 'video']);
		if (!element) {
			return false;
		}

		canvas = document.createElement('canvas');
		if (!canvas) {
			console.log('Browser does not support canvas or Seriously.js');
			return false;
		}

		ctx = getTestContext();

		if (ctx) {
			texture = ctx.createTexture();
			ctx.bindTexture(ctx.TEXTURE_2D, texture);

			try {
				ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, element);
			} catch (textureError) {
				if (textureError.code === window.DOMException.SECURITY_ERR) {
					console.log('Unable to access cross-domain image');
				} else {
					console.log('Error: ' + textureError.message);
				}
				ctx.deleteTexture(texture);
				return false;
			}
			ctx.deleteTexture(texture);
		} else {
			ctx = canvas.getContext('2d');
			try {
				ctx.drawImage(element, 0, 0);
				ctx.getImageData(0, 0, 1, 1);
			} catch (drawImageError) {
				if (drawImageError.code === window.DOMException.SECURITY_ERR) {
					console.log('Unable to access cross-domain image');
				} else {
					console.log('Error: ' + drawImageError.message);
				}
				return false;
			}
		}

		// This method will return a false positive for resources that aren't
		// actually images or haven't loaded yet

		return true;
	}

	function validateInputSpecs(effect) {
		var reserved = ['render', 'initialize', 'original', 'plugin', 'alias',
			'prototype', 'destroy', 'isDestroyed'],
			input,
			name;

		function nop(value) {
			return value;
		}

		for (name in effect.inputs) {
			if (effect.inputs.hasOwnProperty(name)) {
				if (reserved.indexOf(name) >= 0 || Object.prototype[name]) {
					throw 'Reserved effect input name: ' + name;
				}

				input = effect.inputs[name];

				if (isNaN(input.min)) {
					input.min = -Infinity;
				}

				if (isNaN(input.max)) {
					input.max = Infinity;
				}

				if (isNaN(input.minCount)) {
					input.minCount = -Infinity;
				}

				if (isNaN(input.maxCount)) {
					input.maxCount = Infinity;
				}

				if (isNaN(input.step)) {
					input.step = 0;
				}

				if (input.defaultValue === undefined || input.defaultValue === null) {
					if (input.type === 'number') {
						input.defaultValue = Math.min(Math.max(0, input.min), input.max);
					} else if (input.type === 'color') {
						input.defaultValue = [0, 0, 0, 0];
					} else if (input.type === 'enum') {
						if (input.options && input.options.length) {
							input.defaultValue = input.options[0];
						} else {
							input.defaultValue = '';
						}
					} else if (input.type === 'boolean') {
						input.defaultValue = false;
					} else {
						input.defaultValue = '';
					}
				}

				if (input.type === 'vector') {
					if (input.dimensions < 2) {
						input.dimensions = 2;
					} else if (input.dimensions > 4) {
						input.dimensions = 4;
					} else if (!input.dimensions || isNaN(input.dimensions)) {
						input.dimensions = 4;
					} else {
						input.dimensions = Math.round(input.dimensions);
					}
				} else {
					input.dimensions = 1;
				}

				input.shaderDirty = !!input.shaderDirty;

				if (typeof input.validate !== 'function') {
					input.validate = Seriously.inputValidators[input.type] || nop;
				}

				if (!effect.defaultImageInput && input.type === 'image') {
					effect.defaultImageInput = name;
				}
			}
		}
	}

	/*
		helper Classes
	*/

	function FrameBuffer(gl, width, height, options) {
		var frameBuffer,
			renderBuffer,
			tex,
			status,
			useFloat = options === true ? options : (options && options.useFloat);

		useFloat = false;//useFloat && !!gl.getExtension("OES_texture_float"); //useFloat is not ready!
		if (useFloat) {
			this.type = gl.FLOAT;
		} else {
			this.type = gl.UNSIGNED_BYTE;
		}

		frameBuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

		if (options && options.texture) {
			this.texture = options.texture;
			gl.bindTexture(gl.TEXTURE_2D, this.texture);
			this.ownTexture = false;
		} else {
			this.texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.texture);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			this.ownTexture = true;
		}

		try {
			if (this.type === gl.FLOAT) {
				tex = new Float32Array(width * height * 4);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, tex);
			} else {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
				this.type = gl.UNSIGNED_BYTE;
			}
		} catch (e) {
			// Null rejected
			this.type = gl.UNSIGNED_BYTE;
			tex = new Uint8Array(width * height * 4);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex);
		}

		renderBuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

		status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

		if (status === gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT) {
			throw('Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_ATTACHMENT');
		}

		if (status === gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT) {
			throw('Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT');
		}

		if (status === gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS) {
			throw('Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_DIMENSIONS');
		}

		if (status === gl.FRAMEBUFFER_UNSUPPORTED) {
			throw('Incomplete framebuffer: FRAMEBUFFER_UNSUPPORTED');
		}

		if (status !== gl.FRAMEBUFFER_COMPLETE) {
			throw('Incomplete framebuffer: ' + status);
		}

		//clean up
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		this.gl = gl;
		this.frameBuffer = frameBuffer;
		this.renderBuffer = renderBuffer;
		this.width = width;
		this.height = height;
	}

	FrameBuffer.prototype.resize = function (width, height) {
		var gl = this.gl;

		if (this.width === width && this.height === height) {
			return;
		}

		this.width = width;
		this.height = height;

		if (!gl) {
			return;
		}

		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderBuffer);

		//todo: handle float
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	};

	FrameBuffer.prototype.destroy = function () {
		var gl = this.gl;

		if (gl) {
			gl.deleteFramebuffer(this.frameBuffer);
			gl.deleteRenderbuffer(this.renderBuffer);
			if (this.ownTexture) {
				gl.deleteTexture(this.texture);
			}
		}

		delete this.frameBuffer;
		delete this.renderBuffer;
		delete this.texture;
		delete this.gl;
	};

	/* ShaderProgram - utility class for building and accessing WebGL shaders */

	function ShaderProgram(gl, vertexShaderSource, fragmentShaderSource) {
		var program, vertexShader, fragmentShader,
			programError = '',
			shaderError,
			i, l,
			obj;

		function compileShader(source, fragment) {
			var shader, i;
			if (fragment) {
				shader = gl.createShader(gl.FRAGMENT_SHADER);
			} else {
				shader = gl.createShader(gl.VERTEX_SHADER);
			}

			gl.shaderSource(shader, source);
			gl.compileShader(shader);

			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				source = source.split(/[\n\r]/);
				for (i = 0; i < source.length; i++) {
					source[i] = (i + 1) + ":\t" + source[i];
				}
				console.log(source.join('\n'));
				throw 'Shader error: ' + gl.getShaderInfoLog(shader);
			}

			return shader;
		}

		function makeShaderSetter(info, loc) {
			if (info.type === gl.SAMPLER_2D) {
				return function (value) {
					info.glTexture = gl['TEXTURE' + value];
					gl.uniform1i(loc, value);
				};
			}

			if (info.type === gl.BOOL|| info.type === gl.INT) {
				if (info.size > 1) {
					return function (value) {
						gl.uniform1iv(loc, value);
					};
				}

				return function (value) {
					gl.uniform1i(loc, value);
				};
			}

			if (info.type === gl.FLOAT) {
				if (info.size > 1) {
					return function (value) {
						gl.uniform1fv(loc, value);
					};
				}

				return function (value) {
					gl.uniform1f(loc, value);
				};
			}

			if (info.type === gl.FLOAT_VEC2) {
				return function (obj) {
					gl.uniform2f(loc, obj[0], obj[1]);
				};
			}

			if (info.type === gl.FLOAT_VEC3) {
				return function (obj) {
					gl.uniform3f(loc, obj[0], obj[1], obj[2]);
				};
			}

			if (info.type === gl.FLOAT_VEC4) {
				return function (obj) {
					gl.uniform4f(loc, obj[0], obj[1], obj[2], obj[3]);
				};
			}

			if (info.type === gl.FLOAT_MAT3) {
				return function (mat3) {
					gl.uniformMatrix3fv(loc, false, mat3);
				};
			}

			if (info.type === gl.FLOAT_MAT4) {
				return function (mat4) {
					gl.uniformMatrix4fv(loc, false, mat4);
				};
			}

			throw "Unknown shader uniform type: " + info.type;
		}

		function makeShaderGetter(loc) {
			return function () {
				return gl.getUniform(program, loc);
			};
		}

		vertexShader = compileShader(vertexShaderSource);
		fragmentShader = compileShader(fragmentShaderSource, true);

		program = gl.createProgram();
		gl.attachShader(program, vertexShader);
		shaderError = gl.getShaderInfoLog(vertexShader);
		if (shaderError) {
			programError += 'Vertex shader error: ' + shaderError + "\n";
		}
		gl.attachShader(program, fragmentShader);
		shaderError = gl.getShaderInfoLog(fragmentShader);
		if (shaderError) {
			programError += 'Fragment shader error: ' + shaderError + "\n";
		}
		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			programError += gl.getProgramInfoLog(program);
			gl.deleteProgram(program);
			gl.deleteShader(vertexShader);
			gl.deleteShader(fragmentShader);
			throw 'Could not initialise shader: ' + programError;
		}

		gl.useProgram(program);

		this.uniforms = {};

		l = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
		for (i = 0; i < l; ++i) {
			obj = {
				info: gl.getActiveUniform(program, i)
			};

			obj.name = obj.info.name;
			obj.loc = gl.getUniformLocation(program, obj.name);
			obj.set = makeShaderSetter(obj.info, obj.loc);
			obj.get = makeShaderGetter(obj.loc);
			this.uniforms[obj.name] = obj;

			if (!this[obj.name]) {
				//for convenience
				this[obj.name] = obj;
			}
		}

		this.attributes = {};
		this.location = {};
		l = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
		for (i = 0; i < l; ++i) {
			obj = {
				info: gl.getActiveAttrib(program, i)
			};

			obj.name = obj.info.name;
			obj.location = gl.getAttribLocation(program, obj.name);
			this.attributes[obj.name] = obj;
			this.location[obj.name] = obj.location;
		}

		this.gl = gl;
		this.program = program;

		this.destroy = function () {
			var i;

			if (gl) {
				gl.deleteProgram(program);
				gl.deleteShader(vertexShader);
				gl.deleteShader(fragmentShader);
			}

			for (i in this) {
				if (this.hasOwnProperty(i)) {
					delete this[i];
				}
			}

			program = null;
			vertexShader = null;
			fragmentShader = null;
		};
	}

	ShaderProgram.prototype.use = function () {
		this.gl.useProgram(this.program);
	};

	/*
		main class: Seriously
	*/

	function Seriously(options) {

		//if called without 'new', make a new object and return that
		if (window === this || !(this instanceof Seriously)) {
			return new Seriously(options);
		}

		//initialize object, private properties
		var id = ++maxSeriouslyId,
			seriously = this,
			nodes = [],
			nodesById = {},
			nodeId = 0,
			sources = [],
			targets = [],
			transforms = [],
			effects = [],
			aliases = {},
			preCallbacks = [],
			postCallbacks = [],
			glCanvas,
			gl,
			rectangleModel,
			commonShaders = {},
			baseShader,
			baseVertexShader, baseFragmentShader,
			Node, SourceNode, EffectNode, TransformNode, TargetNode,
			Effect, Source, Transform, Target,
			auto = false,
			isDestroyed = false,
			rafId;

		function makeGlModel(shape, gl) {
			var vertex, index, texCoord;

			if (!gl) {
				return false;
			}

			vertex = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, vertex);
			gl.bufferData(gl.ARRAY_BUFFER, shape.vertices, gl.STATIC_DRAW);
			vertex.size = 3;

			index = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, shape.indices, gl.STATIC_DRAW);

			texCoord = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, texCoord);
			gl.bufferData(gl.ARRAY_BUFFER, shape.coords, gl.STATIC_DRAW);
			texCoord.size = 2;

			return {
				vertex: vertex,
				index: index,
				texCoord: texCoord,
				length: shape.indices.length,
				mode: shape.mode || gl.TRIANGLES
			};
		}

		function buildRectangleModel(gl) {
			var shape = {};

			shape.vertices = new Float32Array([
				-1, -1, 0,
				1, -1, 0,
				1, 1, 0,
				-1, 1, 0
			]);

			shape.indices = new Uint16Array([
				0, 1, 2,
				0, 2, 3	// Front face
			]);

			shape.coords = new Float32Array([
				0, 0,
				1, 0,
				1, 1,
				0, 1
			]);

			return makeGlModel(shape, gl);
		}

		function attachContext(context) {
			var i, node;

			gl = context;
			glCanvas = context.canvas;

			rectangleModel = buildRectangleModel(gl);

			baseShader = new ShaderProgram(gl, baseVertexShader, baseFragmentShader);

			for (i = 0; i < effects.length; i++) {
				node = effects[i];
				node.gl = gl;
				node.initialize();
				node.buildShader();
			}

			for (i = 0; i < sources.length; i++) {
				node = sources[i];
				node.initialize();
			}

			for (i = 0; i < targets.length; i++) {
				node = targets[i];

				if (!node.model) {
					node.model = rectangleModel;
				}

				//todo: initialize frame buffer if not main canvas
			}
		}

		/*
		runs on every frame, as long as there are media sources (img, video, canvas, etc.) to check,
		dirty target nodes or pre/post callbacks to run. any sources that are updated are set to dirty,
		forcing all dependent nodes to render
		*/
		function renderDaemon() {
			var i, node, media,
				keepRunning = false;

			rafId = null;

			if (preCallbacks.length) {
				keepRunning = true;
				for (i = 0; i < preCallbacks.length; i++) {
					preCallbacks[i].call(seriously);
				}
			}

			if (sources && sources.length) {
				keepRunning = true;
				for (i = 0; i < sources.length; i++) {
					node = sources[i];

					media = node.source;
					if (node.lastRenderTime === undefined ||
							node.dirty ||
							media.currentTime !== undefined && node.lastRenderTime !== media.currentTime) {
						node.dirty = false;
						node.setDirty();
					}
				}
			}

			for (i = 0; i < targets.length; i++) {
				node = targets[i];
				if (node.auto && node.dirty) {
					node.render();
				}
			}

			if (postCallbacks.length) {
				keepRunning = true;
				for (i = 0; i < postCallbacks.length; i++) {
					postCallbacks[i].call(seriously);
				}
			}

			//rafId may have been set again by a callback or in target.setDirty()
			if (keepRunning && !rafId) {
				rafId = requestAnimationFrame(renderDaemon);
			}
		}

		function draw(shader, model, uniforms, frameBuffer, node, options) {
			var numTextures = 0,
				name, value, shaderUniform,
				width, height,
				nodeGl = (node && node.gl) || gl;

			if (!nodeGl) {
				return;
			}

			if (node) {
				width = options && options.width || node.width || nodeGl.canvas.width;
				height = options && options.height || node.height || nodeGl.canvas.height;
			} else {
				width = options && options.width || nodeGl.canvas.width;
				height = options && options.height || nodeGl.canvas.height;
			}

			shader.use();

			nodeGl.viewport(0, 0, width, height);

			nodeGl.bindFramebuffer(nodeGl.FRAMEBUFFER, frameBuffer);

			/* todo: do this all only once at the beginning, since we only have one model? */
			nodeGl.enableVertexAttribArray(shader.location.position);
			nodeGl.enableVertexAttribArray(shader.location.texCoord);

			if (model.texCoord) {
				nodeGl.bindBuffer(nodeGl.ARRAY_BUFFER, model.texCoord);
				nodeGl.vertexAttribPointer(shader.location.texCoord, model.texCoord.size, nodeGl.FLOAT, false, 0, 0);
			}

			nodeGl.bindBuffer(nodeGl.ARRAY_BUFFER, model.vertex);
			nodeGl.vertexAttribPointer(shader.location.position, model.vertex.size, nodeGl.FLOAT, false, 0, 0);

			nodeGl.bindBuffer(nodeGl.ELEMENT_ARRAY_BUFFER, model.index);

			//default for depth is disable
			if (options && options.depth) {
				gl.enable(gl.DEPTH_TEST);
			} else {
				gl.disable(gl.DEPTH_TEST);
			}

			//default for blend is enable
			if (!options || options.blend === undefined || options.blend) {
				gl.enable(gl.BLEND);
				gl.blendFunc(
					options && options.srcRGB || gl.ONE,
					options && options.dstRGB || gl.ONE_MINUS_SRC_ALPHA
				);

				/*
				gl.blendFuncSeparate(
					options && options.srcRGB || gl.ONE,
					options && options.dstRGB || gl.ONE_MINUS_SRC_ALPHA,
					options && options.srcAlpha || gl.SRC_ALPHA,
					options && options.dstAlpha || gl.DST_ALPHA
				);
				*/
				gl.blendEquation(options && options.blendEquation || gl.FUNC_ADD);
			} else {
				gl.disable(gl.BLEND);
			}

			/* set uniforms to current values */
			for (name in uniforms) {
				if (uniforms.hasOwnProperty(name)) {
					value = uniforms[name];
					shaderUniform = shader.uniforms[name];
					if (shaderUniform) {
						if (value instanceof WebGLTexture) {
							nodeGl.activeTexture(nodeGl.TEXTURE0 + numTextures);
							nodeGl.bindTexture(nodeGl.TEXTURE_2D, value);
							shaderUniform.set(numTextures);
							numTextures++;
						} else if (value instanceof SourceNode ||
								value instanceof EffectNode ||
								value instanceof TransformNode) {
							if (value.texture) {
								nodeGl.activeTexture(nodeGl.TEXTURE0 + numTextures);
								nodeGl.bindTexture(nodeGl.TEXTURE_2D, value.texture);
								shaderUniform.set(numTextures);
								numTextures++;
							}
						} else if(value !== undefined && value !== null) {
							shaderUniform.set(value);
						}
					}
				}
			}

			//default for clear is true
			if (!options || options.clear === undefined || options.clear) {
				nodeGl.clearColor(0.0, 0.0, 0.0, 0.0);
				nodeGl.clear(nodeGl.COLOR_BUFFER_BIT | nodeGl.DEPTH_BUFFER_BIT);
			}

			// draw!
			nodeGl.drawElements(model.mode, model.length, nodeGl.UNSIGNED_SHORT, 0);

			//to protect other 3D libraries that may not remember to turn their depth tests on
			gl.enable(gl.DEPTH_TEST);
		}

		function findInputNode(hook, source, options) {
			var node, i;

			if (typeof hook !== 'string' || !source && source !== 0) {
				if (!options || typeof options !== 'object') {
					options = source;
				}
				source = hook;
			}

			if (typeof hook !== 'string' || !seriousSources[hook]) {
				hook = null;
			}

			if (source instanceof SourceNode ||
					source instanceof EffectNode ||
					source instanceof TransformNode) {
				node = source;
			} else if (source instanceof Effect ||
					source instanceof Source ||
					source instanceof Transform) {
				node = nodesById[source.id];

				if (!node) {
					throw 'Cannot connect a foreign node';
				}
			} else {
				if (typeof source === 'string' && isNaN(source)) {
					source = getElement(source, ['canvas', 'img', 'video']);
				}

				for (i = 0; i < sources.length; i++) {
					node = sources[i];
					if ((!hook || hook === node.hook) && node.compare && node.compare(source, options)) {
						return node;
					}
				}

				node = new SourceNode(hook, source, options);
			}

			return node;
		}

		//trace back all sources to make sure we're not making a cyclical connection
		function traceSources(node, original) {
			var i,
				source,
				sources;

			if (!(node instanceof EffectNode) && !(node instanceof TransformNode)) {
				return false;
			}

			if (node === original) {
				return true;
			}

			sources = node.sources;

			for (i in sources) {
				if (sources.hasOwnProperty(i)) {
					source = sources[i];

					if (source === original || traceSources(source, original)) {
						return true;
					}
				}
			}

			return false;
		}

		Node = function () {
			this.ready = false;
			this.width = 1;
			this.height = 1;

			this.gl = gl;

			this.uniforms = {
				resolution: [this.width, this.height],
				transform: null
			};

			this.dirty = true;
			this.isDestroyed = false;

			this.seriously = seriously;

			this.listeners = {};

			this.id = nodeId;
			nodes.push(this);
			nodesById[nodeId] = this;
			nodeId++;
		};

		Node.prototype.setReady = function () {
			var i;

			if (!this.ready) {
				this.emit('ready');
				this.ready = true;
				if (this.targets) {
					for (i = 0; i < this.targets.length; i++) {
						this.targets[i].setReady();
					}
				}
			}
		};

		Node.prototype.setUnready = function () {
			var i;

			if (this.ready) {
				this.emit('unready');
				this.ready = false;
				if (this.targets) {
					for (i = 0; i < this.targets.length; i++) {
						this.targets[i].setUnready();
					}
				}
			}
		};

		Node.prototype.setDirty = function () {
			//loop through all targets calling setDirty (depth-first)
			var i;

			if (!this.dirty) {
				this.emit('dirty');
				this.dirty = true;
				if (this.targets) {
					for (i = 0; i < this.targets.length; i++) {
						this.targets[i].setDirty();
					}
				}
			}
		};

		Node.prototype.initFrameBuffer = function (useFloat) {
			if (gl) {
				this.frameBuffer = new FrameBuffer(gl, this.width, this.height, useFloat);
			}
		};

		Node.prototype.readPixels = function (x, y, width, height, dest) {

			if (!gl) {
				//todo: is this the best approach?
				throw 'Cannot read pixels until a canvas is connected';
			}

			//todo: check on x, y, width, height

			if (!this.frameBuffer) {
				this.initFrameBuffer();
			}

			//todo: should we render here?
			this.render();

			//todo: figure out formats and types
			if (dest === undefined) {
				dest = new Uint8Array(width * height * 4);
			} else if (!dest instanceof Uint8Array) {
				throw 'Incompatible array type';
			}

			gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer.frameBuffer); //todo: are we sure about this?
			gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, dest);

			return dest;
		};

		Node.prototype.resize = function () {
			var width,
				height;

			if (this.source) {
				width = this.source.width;
				height = this.source.height;
			} else if (this.sources && this.sources.source) {
				width = this.sources.source.width;
				height = this.sources.source.height;
			} else if (this.inputs && this.inputs.width) {
				width = this.inputs.width;
				height = this.inputs.height || width;
			} else if (this.inputs && this.inputs.height) {
				width = height = this.inputs.height;
			} else {
				//this node will be responsible for calculating its own size
				width = 1;
				height = 1;
			}

			width = Math.floor(width);
			height = Math.floor(height);

			if (this.width !== width || this.height !== height) {
				this.width = width;
				this.height = height;

				this.emit('resize');
				this.setDirty();
			}

			if (this.uniforms && this.uniforms.resolution) {
				this.uniforms.resolution[0] = width;
				this.uniforms.resolution[1] = height;
			}

			if (this.frameBuffer && this.frameBuffer.resize) {
				this.frameBuffer.resize(width, height);
			}
		};

		Node.prototype.on = function (eventName, callback) {
			var listeners,
				index = -1;

			if (!eventName || typeof callback !== 'function') {
				return;
			}

			listeners = this.listeners[eventName];
			if (listeners) {
				index = listeners.indexOf(callback);
			} else {
				listeners = this.listeners[eventName] = [];
			}

			if (index < 0) {
				listeners.push(callback);
			}
		};

		Node.prototype.off = function (eventName, callback) {
			var listeners,
				index = -1;

			if (!eventName || typeof callback !== 'function') {
				return;
			}

			listeners = this.listeners[eventName];
			if (listeners) {
				index = listeners.indexOf(callback);
				if (index >= 0) {
					listeners.splice(index, 1);
				}
			}
		};

		Node.prototype.emit = function (eventName) {
			var i,
				listeners = this.listeners[eventName];

			if (listeners && listeners.length) {
				for (i = 0; i < listeners.length; i++) {
					setTimeoutZero(listeners[i]);
				}
			}
		};

		Node.prototype.destroy = function () {
			var i,
				key;

			delete this.gl;
			delete this.seriously;

			//remove all listeners
			for (key in this.listeners) {
				if (this.listeners.hasOwnProperty(key)) {
					delete this.listeners[key];
				}
			}

			//clear out uniforms
			for (i in this.uniforms) {
				if (this.uniforms.hasOwnProperty(i)) {
					delete this.uniforms[i];
				}
			}

			//clear out list of targets and disconnect each
			if (this.targets) {
				delete this.targets;
			}

			//clear out frameBuffer
			if (this.frameBuffer && this.frameBuffer.destroy) {
				this.frameBuffer.destroy();
				delete this.frameBuffer;
			}

			//remove from main nodes index
			i = nodes.indexOf(this);
			if (i >= 0) {
				nodes.splice(i, 1);
			}
			delete nodesById[this.id];

			this.isDestroyed = true;
		};

		Effect = function (effectNode) {
			var name, me = effectNode;

			function arrayToHex(color) {
				var i, val, s = '#';
				for (i = 0; i < 4; i++) {
					val = Math.min(255, Math.round(color[i] * 255 || 0));
					s += val.toString(16);
				}
				return s;
			}

			function setInput(inputName, input) {
				var lookup, value, effectInput, i;

				effectInput = me.effect.inputs[inputName];

				lookup = me.inputElements[inputName];

				if (typeof input === 'string' && isNaN(input)) {
					if (effectInput.type === 'enum') {
						if (effectInput.options && effectInput.options.filter) {
							i = String(input).toLowerCase();
							value = effectInput.options.filter(function (e) {
								return (typeof e === 'string' && e.toLowerCase() === i) ||
									(e.length && typeof e[0] === 'string' && e[0].toLowerCase() === i);
							});

							value = value.length;
						}

						if (!value) {
							input = getElement(input, ['select']);
						}

					} else if (effectInput.type === 'number' || effectInput.type === 'boolean') {
						input = getElement(input, ['input', 'select']);
					} else if (effectInput.type === 'image') {
						input = getElement(input, ['canvas', 'img', 'video']);
					}
					//todo: color? date/time?
				}

				if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
					value = input.value;

					if (lookup && lookup.element !== input) {
						lookup.element.removeEventListener('change', lookup.listener, true);
						lookup.element.removeEventListener('input', lookup.listener, true);
						delete me.inputElements[inputName];
						lookup = null;
					}

					if (!lookup) {
						lookup = {
							element: input,
							listener: (function (name, element) {
								return function () {
									var oldValue, newValue;

									if (input.type === 'checkbox') {
										//special case for check box
										oldValue = input.checked;
									} else {
										oldValue = element.value;
									}
									newValue = me.setInput(name, oldValue);

									//special case for color type
									if (effectInput.type === 'color') {
										newValue = arrayToHex(newValue);
									}

									//if input validator changes our value, update HTML Element
									//todo: make this optional...somehow
									if (newValue !== oldValue) {
										element.value = newValue;
									}
								};
							}(inputName, input))
						};

						me.inputElements[inputName] = lookup;
						if (input.type === 'range') {
							input.addEventListener('input', lookup.listener, true);
							input.addEventListener('change', lookup.listener, true);
						} else {
							input.addEventListener('change', lookup.listener, true);
						}
					}

					if (lookup && input.type === 'checkbox') {
						value = input.checked;
					}
				} else {
					if (lookup) {
						lookup.element.removeEventListener('change', lookup.listener, true);
						lookup.element.removeEventListener('input', lookup.listener, true);
						delete me.inputElements[inputName];
					}
					value = input;
				}

				me.setInput(inputName, value);
				return me.inputs[inputName];
			}

			function makeImageSetter(inputName) {
				return function (value) {
					var val = setInput(inputName, value);
					return val && val.pub;
				};
			}

			function makeImageGetter(inputName) {
				return function () {
					var val = me.inputs[inputName];
					return val && val.pub;
				};
			}

			function makeSetter(inputName) {
				return function (value) {
					return setInput(inputName, value);
				};
			}

			function makeGetter(inputName) {
				return function () {
					return me.inputs[inputName];
				};
			}

			//priveleged publicly accessible methods/setters/getters
			//todo: provide an alternate method
			for (name in me.effect.inputs) {
				if (me.effect.inputs.hasOwnProperty(name)) {
					if (this[name] === undefined) {
						if (me.effect.inputs[name].type === 'image') {
							Object.defineProperty(this, name, {
								configurable: true,
								enumerable: true,
								get: makeImageGetter(name),
								set: makeImageSetter(name)
							});
						} else {
							Object.defineProperty(this, name, {
								configurable: true,
								enumerable: true,
								get: makeGetter(name),
								set: makeSetter(name)
							});
						}
					} else {
						//todo: this is temporary. get rid of it.
						throw 'Cannot overwrite Seriously.' + name;
					}
				}
			}

			Object.defineProperties(this, {
				inputs: {
					enumerable: true,
					configurable: true,
					get: function () {
						return {
							source: {
								type: 'image'
							}
						};
					}
				},
				original: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.source;
					}
				},
				width: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.width;
					}
				},
				height: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.height;
					}
				},
				id: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.id;
					}
				}
			});

			this.render = function () {
				me.render();
				return this;
			};

			this.readPixels = function (x, y, width, height, dest) {
				return me.readPixels(x, y, width, height, dest);
			};

			this.on = function (eventName, callback) {
				me.on(eventName, callback);
			};

			this.off = function (eventName, callback) {
				me.off(eventName, callback);
			};

			this.alias = function (inputName, aliasName) {
				me.alias(inputName, aliasName);
				return this;
			};

			this.matte = function (polygons) {
				me.matte(polygons);
			};

			this.destroy = function () {
				var i,
					descriptor;

				me.destroy();

				for (i in this) {
					if (this.hasOwnProperty(i) && i !== 'isDestroyed') {
						descriptor = Object.getOwnPropertyDescriptor(this, i);
						if (descriptor.get || descriptor.set ||
								typeof this[i] !== 'function') {
							delete this[i];
						} else {
							this[i] = nop;
						}
					}
				}
			};

			this.isDestroyed = function () {
				return me.isDestroyed;
			};

			this.isReady = function () {
				return me.ready;
			};
		};

		EffectNode = function (hook, options) {
			var key, name, input,
				hasImage = false;

			Node.call(this, options);

			this.effectRef = seriousEffects[hook];
			this.sources = {};
			this.targets = [];
			this.inputElements = {};
			this.dirty = true;
			this.shaderDirty = true;
			this.hook = hook;
			this.options = options;
			this.transform = null;

			if (this.effectRef.definition) {
				this.effect = this.effectRef.definition.call(this, options);
				/*
				todo: copy over inputs object separately in case some are specified
				in advance and some are specified in definition function
				*/
				for (key in this.effectRef) {
					if (this.effectRef.hasOwnProperty(key) && !this.effect[key]) {
						this.effect[key] = this.effectRef[key];
					}
				}
				if (this.effect.inputs !== this.effectRef.inputs) {
					validateInputSpecs(this.effect);
				}
			} else {
				this.effect = extend({}, this.effectRef);
			}

			//todo: set up frame buffer(s), inputs, transforms, stencils, draw method. allow plugin to override

			this.uniforms.transform = identity;
			this.inputs = {};
			for (name in this.effect.inputs) {
				if (this.effect.inputs.hasOwnProperty(name)) {
					input = this.effect.inputs[name];

					this.inputs[name] = input.defaultValue;
					if (input.uniform) {
						this.uniforms[input.uniform] = input.defaultValue;
					}
					if (input.type === 'image') {
						hasImage = true;
					}
				}
			}

			if (gl) {
				this.initialize();
				if (this.effect.commonShader) {
					//this effect is unlikely to need to be modified again
					//by changing parameters
					this.buildShader();
				}
			}

			this.ready = !hasImage;
			this.inPlace = this.effect.inPlace;

			this.pub = new Effect(this);

			effects.push(this);

			allEffectsByHook[hook].push(this);
		};

		extend(EffectNode, Node);

		EffectNode.prototype.initialize = function () {
			if (!this.initialized) {
				var that = this;

				this.baseShader = baseShader;

				if (this.shape) {
					this.model = makeGlModel(this.shape, this.gl);
				} else {
					this.model = rectangleModel;
				}

				if (typeof this.effect.initialize === 'function') {
					this.effect.initialize.call(this, function () {
						that.initFrameBuffer(true);
					}, gl);
				} else {
					this.initFrameBuffer(true);
				}

				if (this.frameBuffer) {
					this.texture = this.frameBuffer.texture;
				}

				this.initialized = true;
			}
		};

		EffectNode.prototype.resize = function () {
			var i;

			Node.prototype.resize.call(this);

			if (this.effect.resize) {
				this.effect.resize.call(this);
			}

			for (i = 0; i < this.targets.length; i++) {
				this.targets[i].resize();
			}
		};

		EffectNode.prototype.setReady = function () {
			var i,
				input,
				key;

			if (!this.ready) {
				for (key in this.effect.inputs) {
					if (this.effect.inputs.hasOwnProperty(key)) {
						input = this.effect.inputs[key];
						if (input.type === 'image' &&
								(!this.sources[key] || !this.sources[key].ready)) {
							return;
						}
					}
				}

				this.ready = true;
				this.emit('ready');
				if (this.targets) {
					for (i = 0; i < this.targets.length; i++) {
						this.targets[i].setReady();
					}
				}
			}
		};

		EffectNode.prototype.setUnready = function () {
			var i,
				input,
				key;

			if (this.ready) {
				for (key in this.effect.inputs) {
					if (this.effect.inputs.hasOwnProperty(key)) {
						input = this.effect.inputs[key];
						if (input.type === 'image' &&
								(!this.sources[key] || !this.sources[key].ready)) {
							this.ready = false;
							break;
						}
					}
				}

				if (!this.ready) {
					this.emit('unready');
					if (this.targets) {
						for (i = 0; i < this.targets.length; i++) {
							this.targets[i].setUnready();
						}
					}
				}
			}
		};


		EffectNode.prototype.setTarget = function (target) {
			var i;
			for (i = 0; i < this.targets.length; i++) {
				if (this.targets[i] === target) {
					return;
				}
			}

			this.targets.push(target);
		};

		EffectNode.prototype.removeTarget = function (target) {
			var i = this.targets && this.targets.indexOf(target);
			if (i >= 0) {
				this.targets.splice(i, 1);
			}
		};

		EffectNode.prototype.removeSource = function (source) {
			var i, pub = source && source.pub;

			for (i in this.inputs) {
				if (this.inputs.hasOwnProperty(i) &&
					(this.inputs[i] === source || this.inputs[i] === pub)) {
					this.inputs[i] = null;
				}
			}

			for (i in this.sources) {
				if (this.sources.hasOwnProperty(i) &&
					(this.sources[i] === source || this.sources[i] === pub)) {
					this.sources[i] = null;
				}
			}
		};

		EffectNode.prototype.buildShader = function () {
			var shader, effect = this.effect;
			if (this.shaderDirty) {
				if (effect.commonShader && commonShaders[this.hook]) {
					if (!this.shader) {
						commonShaders[this.hook].count++;
					}
					this.shader = commonShaders[this.hook].shader;
				} else if (effect.shader) {
					if (this.shader && !effect.commonShader) {
						this.shader.destroy();
					}
					shader = effect.shader.call(this, this.inputs, {
						vertex: baseVertexShader,
						fragment: baseFragmentShader
					}, Seriously.util);

					if (shader instanceof ShaderProgram) {
						this.shader = shader;
					} else if (shader && shader.vertex && shader.fragment) {
						this.shader = new ShaderProgram(gl, shader.vertex, shader.fragment);
					} else {
						this.shader = baseShader;
					}

					if (effect.commonShader) {
						commonShaders[this.hook] = {
							count: 1,
							shader: this.shader
						};
					}
				} else {
					this.shader = baseShader;
				}

				this.shaderDirty = false;
			}
		};

		EffectNode.prototype.render = function () {
			var i,
				frameBuffer,
				effect = this.effect,
				that = this,
				inPlace;

			function drawFn(shader, model, uniforms, frameBuffer, node, options) {
				draw(shader, model, uniforms, frameBuffer, node || that, options);
			}

			if (!this.initialized) {
				this.initialize();
			}

			if (this.shaderDirty) {
				this.buildShader();
			}

			if (this.dirty) {
				for (i in this.sources) {
					if (this.sources.hasOwnProperty(i) &&
						(!effect.requires || effect.requires.call(this, i, this.inputs))) {

						//todo: set source texture
						//sourcetexture = this.sources[i].render() || this.sources[i].texture

						inPlace = typeof this.inPlace === 'function' ? this.inPlace(i) : this.inPlace;
						this.sources[i].render(!inPlace);
					}
				}

				if (this.frameBuffer) {
					frameBuffer = this.frameBuffer.frameBuffer;
				}

				if (typeof effect.draw === 'function') {
					effect.draw.call(this, this.shader, this.model, this.uniforms, frameBuffer, drawFn);
					this.emit('render');
				} else if (frameBuffer) {
					draw(this.shader, this.model, this.uniforms, frameBuffer, this);
					this.emit('render');
				}

				this.dirty = false;
			}

			return this.texture;
		};

		EffectNode.prototype.setInput = function (name, value) {
			var input, uniform,
				sourceKeys,
				source;

			if (this.effect.inputs.hasOwnProperty(name)) {
				input = this.effect.inputs[name];
				if (input.type === 'image') {
					//&& !(value instanceof Effect) && !(value instanceof Source)) {

					if (value) {
						value = findInputNode(value);

						if (value !== this.sources[name]) {
							if (this.sources[name]) {
								this.sources[name].removeTarget(this);
							}

							if (traceSources(value, this)) {
								throw 'Attempt to make cyclical connection.';
							}

							this.sources[name] = value;
							value.setTarget(this);
						}
					} else {
						delete this.sources[name];
						value = false;
					}

					uniform = this.sources[name];

					sourceKeys = Object.keys(this.sources);
					if (this.inPlace === true && sourceKeys.length === 1) {
						source = this.sources[sourceKeys[0]];
						this.uniforms.transform = source && source.cumulativeMatrix || identity;
					} else {
						this.uniforms.transform = identity;
					}

					this.resize();
				} else {
					value = input.validate.call(this, value, input, this.inputs[name]);
					uniform = value;
				}

				if (this.inputs[name] === value && input.type !== 'color' && input.type !== 'vector') {
					return value;
				}

				this.inputs[name] = value;

				if (input.uniform) {
					this.uniforms[input.uniform] = uniform;
				}

				if (input.shaderDirty) {
					this.shaderDirty = true;
				}

				if (value && value.ready) {
					this.setReady();
				} else {
					this.setUnready();
				}

				this.setDirty();

				if (input.update) {
					input.update.call(this, value);
				}

				return value;
			}
		};

		EffectNode.prototype.alias = function (inputName, aliasName) {
			var that = this;

			if (reservedNames.indexOf(aliasName) >= 0) {
				throw aliasName + ' is a reserved name and cannot be used as an alias.';
			}

			if (this.effect.inputs.hasOwnProperty(inputName)) {
				if (!aliasName) {
					aliasName = inputName;
				}

				seriously.removeAlias(aliasName);

				aliases[aliasName] = {
					node: this,
					input: inputName
				};

				Object.defineProperty(seriously, aliasName, {
					configurable: true,
					enumerable: true,
					get: function () {
						return that.inputs[inputName];
					},
					set: function (value) {
						return that.setInput(inputName, value);
					}
				});
			}

			return this;
		};

		/*
		matte function to be assigned as a method to EffectNode and TargetNode
		*/
		EffectNode.prototype.matte = function (poly) {
			var polys,
				polygons = [],
				polygon,
				vertices = [],
				i, j, v,
				vert, prev,
				//triangles = [],
				shape = {};

			//detect whether it's multiple polygons or what
			function makePolygonsArray(poly) {
				if (!poly || !poly.length || !Array.isArray(poly)) {
					return [];
				}

				if (!Array.isArray(poly[0])) {
					return [poly];
				}

				if (Array.isArray(poly[0]) && !isNaN(poly[0][0])) {
					return [poly];
				}

				return poly;
			}

			function linesIntersect(a1, a2, b1, b2) {
				var ua_t, ub_t, u_b, ua, ub;
				ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
				ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x);
				u_b = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);
				if (u_b) {
					ua = ua_t / u_b;
					ub = ub_t / u_b;
					if (ua > 0 && ua <= 1 && ub > 0 && ub <= 1) {
						return {
							x: a1.x + ua * (a2.x - a1.x),
							y: a1.y + ua * (a2.y - a1.y)
						};
					}
				}
				return false;
			}

			function makeSimple(poly) {
				/*
				this uses a slow, naive approach to detecting line intersections.
				Use Bentley-Ottmann Algorithm
				see: http://softsurfer.com/Archive/algorithm_0108/algorithm_0108.htm#Bentley-Ottmann Algorithm
				see: https://github.com/tokumine/sweepline
				*/
				var i, j,
					edge1, edge2,
					intersect,
					intersections = [],
					newPoly,
					head, point,
					newPolygons,
					point1, point2;

				if (poly.simple) {
					return;
				}

				for (i = 0; i < poly.edges.length; i++) {
					edge1 = poly.edges[i];
					for (j = i + 1; j < poly.edges.length; j++) {
						edge2 = poly.edges[j];
						intersect = linesIntersect(edge1[0], edge1[1], edge2[0], edge2[1]);
						if (intersect) {
							intersect.edge1 = edge1;
							intersect.edge2 = edge2;
							intersections.push(intersect);
						}
					}
				}

				if (intersections.length) {
					newPolygons = [];

					for (i = 0; i < intersections.length; i++) {
						intersect = intersections[i];
						edge1 = intersect.edge1;
						edge2 = intersect.edge2;

						//make new points
						//todo: set ids for points
						point1 = {
							x: intersect.x,
							y: intersect.y,
							prev: edge1[0],
							next: edge2[1],
							id: vertices.length
						};
						poly.vertices.push(point1);
						vertices.push(point1);

						point2 = {
							x: intersect.x,
							y: intersect.y,
							prev: edge2[0],
							next: edge1[1],
							id: vertices.length
						};
						poly.vertices.push(point2);
						vertices.push(point1);

						//modify old points
						point1.prev.next = point1;
						point1.next.prev = point1;
						point2.prev.next = point2;
						point2.next.prev = point2;

						//don't bother modifying the old edges. we're just gonna throw them out
					}

					//make new polygons
					do {
						newPoly = {
							edges: [],
							vertices: [],
							simple: true
						};
						newPolygons.push(newPoly);
						point = poly.vertices[0];
						head = point;
						//while (point.next !== head && poly.vertices.length) {
						do {
							i = poly.vertices.indexOf(point);
							poly.vertices.splice(i, 1);
							newPoly.edges.push([point, point.next]);
							newPoly.vertices.push(point);
							point = point.next;
						} while (point !== head);
					} while (poly.vertices.length);

					//remove original polygon from list
					i = polygons.indexOf(poly);
					polygons.splice(i, 1);

					//add new polygons to list
					for (i = 0; i < newPolygons.length; i++) {
						polygons.push(newPolygons[i]);
					}
				} else {
					poly.simple = true;
				}
			}

			function clockWise(poly) {
				var p, q, n = poly.vertices.length,
					pv, qv, sum = 0;
				for (p = n - 1, q = 0; q < n; p = q, q++) {
					pv = poly.vertices[p];
					qv = poly.vertices[q];
					//sum += (next.x - v.x) * (next.y + v.y);
					//sum += (v.next.x + v.x) * (v.next.y - v.y);
					sum += pv.x * qv.y - qv.x * pv.y;
				}
				return sum > 0;
			}

			function triangulate(poly) {
				var v, points = poly.vertices,
					n, V = [], indices = [],
					nv, count, m, u, w,

					//todo: give these variables much better names
					a, b, c, s, t;

				function pointInTriangle(a, b, c, p) {
					var ax, ay, bx, by, cx, cy, apx, apy, bpx, bpy, cpx, cpy,
						cXap, bXcp, aXbp;

					ax = c.x - b.x;
					ay = c.y - b.y;
					bx = a.x - c.x;
					by = a.y - c.y;
					cx = b.x - a.x;
					cy = b.y - a.y;
					apx = p.x - a.x;
					apy = p.y - a.y;
					bpx = p.x - b.x;
					bpy = p.y - b.y;
					cpx = p.x - c.x;
					cpy = p.y - c.y;

					aXbp = ax * bpy - ay * bpx;
					cXap = cx * apy - cy * apx;
					bXcp = bx * cpy - by * cpx;

					return aXbp >= 0 && bXcp >=0 && cXap >=0;
				}

				function snip(u, v, w, n, V) {
					var p, a, b, c, point;
					a = points[V[u]];
					b = points[V[v]];
					c = points[V[w]];
					if (0 > (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) {
						return false;
					}
					for (p = 0; p < n; p++) {
						if (!(p === u || p === v || p === w)) {
							point = points[V[p]];
							if (pointInTriangle(a, b, c, point)) {
								return false;
							}
						}
					}
					return true;
				}

				//copy points
				//for (v = 0; v < poly.vertices.length; v++) {
				//	points.push(poly.vertices[v]);
				//}
				n = points.length;

				if (poly.clockWise) {
					for (v = 0; v < n; v++) {
						V[v] = v;
					}
				} else {
					for (v = 0; v < n; v++) {
						V[v] = (n - 1) - v;
					}
				}

				nv = n;
				count = 2 * nv;
				m = 0;
				v = nv - 1;
				while (nv > 2) {
					if ((count--) <= 0) {
						return indices;
					}

					u = v;
					if (nv <= u) {
						u = 0;
					}

					v = u + 1;
					if (nv <= v) {
						v = 0;
					}

					w = v + 1;
					if (nv < w) {
						w = 0;
					}

					if (snip(u, v, w, nv, V)) {
						a = V[u];
						b = V[v];
						c = V[w];
						if (poly.clockWise) {
							indices.push(points[a]);
							indices.push(points[b]);
							indices.push(points[c]);
						} else {
							indices.push(points[c]);
							indices.push(points[b]);
							indices.push(points[a]);
						}
						m++;
						for (s = v, t = v + 1; t < nv; s++, t++) {
							V[s] = V[t];
						}
						nv--;
						count = 2 * nv;
					}
				}

				polygon.indices = indices;
			}

			polys = makePolygonsArray(poly);

			for (i = 0; i < polys.length; i++) {
				poly = polys[i];
				prev = null;
				polygon = {
					vertices: [],
					edges: []
				};

				for (j = 0; j < poly.length; j++) {
					v = poly[j];
					if (typeof v ==='object' && !isNaN(v.x) && !isNaN(v.y)) {
						vert = {
							x: v.x,
							y: v.y,
							id: vertices.length
						};
					} else if (v.length >= 2 && !isNaN(v[0]) && !isNaN(v[1])) {
						vert = {
							x: v[0],
							y: v[1],
							id: vertices.length
						};
					}
					if (vert) {
						if (prev) {
							prev.next = vert;
							vert.prev = prev;
							vert.next = polygon.vertices[0];
							polygon.vertices[0].prev = vert;
						} else {
							polygon.head = vert;
							vert.next = vert;
							vert.prev = vert;
						}
						vertices.push(vert);
						polygon.vertices.push(vert);
						prev = vert;
					}
				}

				if (polygon.vertices.length > 2) {
					if (polygon.vertices.length === 3) {
						polygon.simple = true;
					}

					polygons.push(polygon);

					//save edges
					for (j = 0; j < polygon.vertices.length; j++) {
						vert = polygon.vertices[j];
						polygon.edges.push([
							vert, vert.next
						]);
					}
				}
			}

			for (i = polygons.length - 1; i >= 0; i--) {
				polygon = polygons[i];
				makeSimple(polygon);
			}

			for (i = 0; i < polygons.length; i++) {
				polygon = polygons[i];
				polygon.clockWise = clockWise(polygon);
				triangulate(polygon);
			}

			//build shape
			shape.vertices = [];
			shape.coords = [];
			for (i = 0; i < vertices.length; i++) {
				v = vertices[i];
				shape.vertices.push(v.x * 2 - 1);
				shape.vertices.push(v.y * -2 + 1);
				shape.vertices.push(-1);

				shape.coords.push(v.x);
				shape.coords.push(v.y * -1 + 1);
			}
			shape.vertices = new Float32Array(shape.vertices);
			shape.coords = new Float32Array(shape.coords);

			shape.indices = [];
			for (i = 0; i < polygons.length; i++) {
				polygon = polygons[i];
				for (j = 0; j < polygon.indices.length; j++) {
					v = polygon.indices[j];
					shape.indices.push(v.id);
					//shape.indices.push(v[1].id);
					//shape.indices.push(v[2].id);
				}
			}
			shape.indices = new Uint16Array(shape.indices);

			this.shape = shape;
			if (this.gl) {
				makeGlModel(shape, this.gl);
			}
		};

		EffectNode.prototype.destroy = function () {
			var i, key, item, hook = this.hook;

			//let effect destroy itself
			if (this.effect.destroy && typeof this.effect.destroy === 'function') {
				this.effect.destroy.call(this);
			}
			delete this.effect;

			//shader
			if (commonShaders[hook]) {
				commonShaders[hook].count--;
				if (!commonShaders[hook].count) {
					delete commonShaders[hook];
				}
			}
			if (this.shader && this.shader.destroy && this.shader !== baseShader && !commonShaders[hook]) {
				this.shader.destroy();
			}
			delete this.shader;

			//stop watching any input elements
			for (key in this.inputElements) {
				if (this.inputElements.hasOwnProperty(key)) {
					item = this.inputElements[key];
					item.element.removeEventListener('change', item.listener, true);
					item.element.removeEventListener('input', item.listener, true);
				}
			}

			//sources
			for (key in this.sources) {
				if (this.sources.hasOwnProperty(key)) {
					item = this.sources[key];
					if (item && item.removeTarget) {
						item.removeTarget(this);
					}
					delete this.sources[key];
				}
			}

			//targets
			while (this.targets.length) {
				item = this.targets.pop();
				if (item && item.removeSource) {
					item.removeSource(this);
				}
			}

			for (i in this) {
				if (this.hasOwnProperty(key) && key !== 'id') {
					delete this[key];
				}
			}

			//remove any aliases
			for (key in aliases) {
				if (aliases.hasOwnProperty(key)) {
					item = aliases[key];
					if (item.node === this) {
						seriously.removeAlias(key);
					}
				}
			}

			//remove self from master list of effects
			i = effects.indexOf(this);
			if (i >= 0) {
				effects.splice(i, 1);
			}

			i = allEffectsByHook[hook].indexOf(this);
			if (i >= 0) {
				allEffectsByHook[hook].splice(i, 1);
			}

			Node.prototype.destroy.call(this);
		};

		Source = function (sourceNode) {
			var me = sourceNode;

			//priveleged accessor methods
			Object.defineProperties(this, {
				original: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.source;
					}
				},
				id: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.id;
					}
				}
			});

			this.render = function () {
				me.render();
			};

			this.update = function () {
				me.setDirty();
			};

			this.readPixels = function (x, y, width, height, dest) {
				return me.readPixels(x, y, width, height, dest);
			};

			this.on = function (eventName, callback) {
				me.on(eventName, callback);
			};

			this.off = function (eventName, callback) {
				me.off(eventName, callback);
			};

			this.destroy = function () {
				var i,
					descriptor;

				me.destroy();

				for (i in this) {
					if (this.hasOwnProperty(i) && i !== 'isDestroyed') {
						descriptor = Object.getOwnPropertyDescriptor(this, i);
						if (descriptor.get || descriptor.set ||
								typeof this[i] !== 'function') {
							delete this[i];
						} else {
							this[i] = nop;
						}
					}
				}
			};

			this.isDestroyed = function () {
				return me.isDestroyed;
			};

			this.isReady = function () {
				return me.ready;
			};
		};

		/*
			possible sources: img, video, canvas (2d or 3d), texture, ImageData, array, typed array
		*/
		SourceNode = function (hook, source, options) {
			var opts = options || {},
				flip = opts.flip === undefined ? true : opts.flip,
				width = opts.width,
				height = opts.height,
				deferTexture = false,
				that = this,
				matchedType = false,
				key,
				plugin;

			function sourcePlugin(hook, source, options, force) {
				var plugin = seriousSources[hook];
				if (plugin.definition) {
					plugin = plugin.definition.call(that, source, options, force);
					if (plugin) {
						plugin = extend(extend({}, seriousSources[hook]), plugin);
					} else {
						return null;
					}
				}
				return plugin;
			}

			function compareSource(source) {
				return that.source === source;
			}

			function initializeVideo() {
				if (that.isDestroyed) {
					return;
				}

				if (source.videoWidth) {
					that.width = source.videoWidth;
					that.height = source.videoHeight;
					if (deferTexture) {
						that.setReady();
					}
				} else {
					//Workaround for Firefox bug https://bugzilla.mozilla.org/show_bug.cgi?id=926753
					deferTexture = true;
					setTimeout(initializeVideo, 50);
				}
			}

			Node.call(this);

			if (hook && typeof hook !== 'string' || !source && source !== 0) {
				if (!options || typeof options !== 'object') {
					options = source;
				}
				source = hook;
			}

			if (typeof source === 'string' && isNaN(source)) {
				source = getElement(source, ['canvas', 'img', 'video']);
			}

			// forced source type?
			if (typeof hook === 'string' && seriousSources[hook]) {
				plugin = sourcePlugin(hook, source, options, true);
				if (plugin) {
					this.hook = hook;
					matchedType = true;
					deferTexture = plugin.deferTexture;
					this.plugin = plugin;
					this.compare = plugin.compare;
					if (plugin.source) {
						source = plugin.source;
					}
				}
			}

			//todo: could probably stand to re-work and re-indent this whole block now that we have plugins
			if (!plugin && source instanceof HTMLElement) {
				if (source.tagName === 'CANVAS') {
					this.width = source.width;
					this.height = source.height;

					this.render = this.renderImageCanvas;
					matchedType = true;
					this.hook = 'canvas';
					this.compare = compareSource;
				} else if (source.tagName === 'IMG') {
					this.width = source.naturalWidth || 1;
					this.height = source.naturalHeight || 1;

					if (!source.complete || !source.naturalWidth) {
						deferTexture = true;

						source.addEventListener('load', function () {
							if (!that.isDestroyed) {
								that.width = source.naturalWidth;
								that.height = source.naturalHeight;
								that.setReady();
							}
						}, true);
					}

					this.render = this.renderImageCanvas;
					matchedType = true;
					this.hook = 'image';
					this.compare = compareSource;
				} else if (source.tagName === 'VIDEO') {
					if (source.readyState) {
						initializeVideo();
					} else {
						deferTexture = true;
						source.addEventListener('loadedmetadata', initializeVideo, true);
					}

					this.render = this.renderVideo;
					matchedType = true;
					this.hook = 'video';
					this.compare = compareSource;
				}
			} else if (!plugin && source instanceof WebGLTexture) {
				if (gl && !gl.isTexture(source)) {
					throw 'Not a valid WebGL texture.';
				}

				//different defaults
				if (!isNaN(width)) {
					if (isNaN(height)) {
						height = width;
					}
				} else if (!isNaN(height)) {
					width = height;
				}/* else {
					//todo: guess based on dimensions of target canvas
					//throw 'Must specify width and height when using a WebGL texture as a source';
				}*/

				this.width = width;
				this.height = height;

				if (opts.flip === undefined) {
					flip = false;
				}
				matchedType = true;

				this.texture = source;
				this.initialized = true;
				this.hook = 'texture';
				this.compare = compareSource;

				//todo: if WebGLTexture source is from a different context render it and copy it over
				this.render = function () {};
			} else if (!plugin) {
				for (key in seriousSources) {
					if (seriousSources.hasOwnProperty(key) && seriousSources[key]) {
						plugin = sourcePlugin(key, source, options, false);
						if (plugin) {
							this.hook = key;
							matchedType = true;
							deferTexture = plugin.deferTexture;
							this.plugin = plugin;
							this.compare = plugin.compare;
							if (plugin.source) {
								source = plugin.source;
							}

							break;
						}
					}
				}
			}

			if (!matchedType) {
				throw 'Unknown source type';
			}

			this.source = source;
			if (this.flip === undefined) {
				this.flip = flip;
			}

			this.targets = [];

			if (!deferTexture) {
				that.setReady();
			}

			this.pub = new Source(this);

			sources.push(this);
			allSourcesByHook[this.hook].push(this);

			if (sources.length && !rafId) {
				renderDaemon();
			}
		};

		extend(SourceNode, Node);

		SourceNode.prototype.initialize = function () {
			var texture;

			if (!gl || this.texture || !this.ready) {
				return;
			}

			texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.bindTexture(gl.TEXTURE_2D, null);

			this.texture = texture;
			this.initialized = true;
			this.allowRefresh = true;
			this.setDirty();
		};

		SourceNode.prototype.initFrameBuffer = function (useFloat) {
			if (gl) {
				this.frameBuffer = new FrameBuffer(gl, this.width, this.height, {
					texture: this.texture,
					useFloat: useFloat
				});
			}
		};

		SourceNode.prototype.setTarget = function (target) {
			var i;
			for (i = 0; i < this.targets.length; i++) {
				if (this.targets[i] === target) {
					return;
				}
			}

			this.targets.push(target);
		};

		SourceNode.prototype.removeTarget = function (target) {
			var i = this.targets && this.targets.indexOf(target);
			if (i >= 0) {
				this.targets.splice(i, 1);
			}
		};

		SourceNode.prototype.resize = function () {
			var i,
				target;

			this.uniforms.resolution[0] = this.width;
			this.uniforms.resolution[1] = this.height;

			if (this.framebuffer) {
				this.framebuffer.resize(this.width, this.height);
			}

			this.emit('resize');
			this.setDirty();

			if (this.targets) {
				for (i = 0; i < this.targets.length; i++) {
					target = this.targets[i];
					target.resize();
					if (target.setTransformDirty) {
						target.setTransformDirty();
					}
				}
			}
		};

		SourceNode.prototype.setReady = function () {
			var i;
			if (!this.ready) {
				this.ready = true;
				this.resize();
				this.initialize();

				this.emit('ready');
				if (this.targets) {
					for (i = 0; i < this.targets.length; i++) {
						this.targets[i].setReady();
					}
				}

			}
		};

		SourceNode.prototype.render = function () {
			var media = this.source;

			if (!gl || !media && media !== 0 || !this.ready) {
				return;
			}

			if (!this.initialized) {
				this.initialize();
			}

			if (!this.allowRefresh) {
				return;
			}

			if (this.plugin && this.plugin.render &&
					this.plugin.render.call(this, gl, draw, rectangleModel, baseShader)) {

				this.dirty = false;
				this.emit('render');
			}
		};

		SourceNode.prototype.renderVideo = function () {
			var video = this.source;

			if (!gl || !video || !video.videoHeight || !video.videoWidth || video.readyState < 2 || !this.ready) {
				return;
			}

			if (!this.initialized) {
				this.initialize();
			}

			if (!this.allowRefresh) {
				return;
			}

			if (this.dirty ||
				this.lastRenderFrame !== video.mozPresentedFrames ||
				this.lastRenderTime !== video.currentTime) {

				gl.bindTexture(gl.TEXTURE_2D, this.texture);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.flip);
				gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
				try {
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
				} catch (securityError) {
					if (securityError.code === window.DOMException.SECURITY_ERR) {
						this.allowRefresh = false;
						console.log('Unable to access cross-domain image');
					}
				}

				// Render a few extra times because the canvas takes a while to catch up
				if (Date.now() - 100 > this.lastRenderTimeStamp) {
					this.lastRenderTime = video.currentTime;
				}
				this.lastRenderFrame = video.mozPresentedFrames;
				this.lastRenderTimeStamp = Date.now();
				this.dirty = false;
				this.emit('render');
			}
		};

		SourceNode.prototype.renderImageCanvas = function () {
			var media = this.source;

			if (!gl || !media || !this.ready) {
				return;
			}

			if (!this.initialized) {
				this.initialize();
			}

			if (!this.allowRefresh) {
				return;
			}

			if (this.dirty) {
				gl.bindTexture(gl.TEXTURE_2D, this.texture);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.flip);
				gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
				try {
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
				} catch (securityError) {
					if (securityError.code === window.DOMException.SECURITY_ERR) {
						this.allowRefresh = false;
						console.log('Unable to access cross-domain image');
					}
				}

				this.lastRenderTime = Date.now() / 1000;
				this.dirty = false;
				this.emit('render');
			}
		};

		SourceNode.prototype.destroy = function () {
			var i, key, item;

			if (this.plugin && this.plugin.destroy) {
				this.plugin.destroy.call(this);
			}

			if (gl && this.texture) {
				gl.deleteTexture(this.texture);
			}

			//targets
			while (this.targets.length) {
				item = this.targets.pop();
				if (item && item.removeSource) {
					item.removeSource(this);
				}
			}

			//remove self from master list of sources
			i = sources.indexOf(this);
			if (i >= 0) {
				sources.splice(i, 1);
			}

			i = allSourcesByHook[this.hook].indexOf(this);
			if (i >= 0) {
				allSourcesByHook[this.hook].splice(i, 1);
			}

			for (key in this) {
				if (this.hasOwnProperty(key) && key !== 'id') {
					delete this[key];
				}
			}

			Node.prototype.destroy.call(this);
		};

		//todo: implement render for array and typed array

		Target = function (targetNode) {
			var me = targetNode;

			//priveleged accessor methods
			Object.defineProperties(this, {
				inputs: {
					enumerable: true,
					configurable: true,
					get: function () {
						return {
							source: {
								type: 'image'
							}
						};
					}
				},
				source: {
					enumerable: true,
					configurable: true,
					get: function () {
						if (me.source) {
							return me.source.pub;
						}
					},
					set: function (value) {
						me.setSource(value);
					}
				},
				original: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.target;
					}
				},
				width: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.width;
					},
					set: function (value) {
						if (!isNaN(value) && value >0 && me.width !== value) {
							me.width = me.desiredWidth = value;
							me.target.width = value;

							me.setTransformDirty();
							/*
							if (this.source && this.source.resize) {
								this.source.resize(value);

								//todo: for secondary webgl nodes, we need a new array
								//if (this.pixels && this.pixels.length !== (this.width * this.height * 4)) {
								//	delete this.pixels;
								//}
							}
							*/
						}
					}
				},
				height: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.height;
					},
					set: function (value) {
						if (!isNaN(value) && value >0 && me.height !== value) {
							me.height = me.desiredHeight = value;
							me.target.height = value;

							me.setTransformDirty();

							/*
							if (this.source && this.source.resize) {
								this.source.resize(undefined, value);

								//for secondary webgl nodes, we need a new array
								//if (this.pixels && this.pixels.length !== (this.width * this.height * 4)) {
								//	delete this.pixels;
								//}
							}
							*/
						}
					}
				},
				id: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.id;
					}
				}
			});

			this.render = function () {
				me.render();
			};

			this.readPixels = function (x, y, width, height, dest) {
				return me.readPixels(x, y, width, height, dest);
			};

			this.on = function (eventName, callback) {
				me.on(eventName, callback);
			};

			this.off = function (eventName, callback) {
				me.off(eventName, callback);
			};

			this.go = function (options) {
				me.go(options);
			};

			this.stop = function () {
				me.stop();
			};

			this.getTexture = function () {
				return me.frameBuffer.texture;
			};

			this.destroy = function () {
				var i,
					descriptor;

				me.destroy();

				for (i in this) {
					if (this.hasOwnProperty(i) && i !== 'isDestroyed') {
						descriptor = Object.getOwnPropertyDescriptor(this, i);
						if (descriptor.get || descriptor.set ||
								typeof this[i] !== 'function') {
							delete this[i];
						} else {
							this[i] = nop;
						}
					}
				}
			};

			this.isDestroyed = function () {
				return me.isDestroyed;
			};

			this.isReady = function () {
				return me.ready;
			};
		};

		/*
			possible targets: canvas (2d or 3d), gl render buffer (must be same canvas)
		*/
		TargetNode = function (target, options) {
			var opts = options || {},
				flip = opts.flip === undefined ? true : opts.flip,
				width = parseInt(opts.width, 10),
				height = parseInt(opts.height, 10),
				matchedType = false,
				i, element, elements, context,
				frameBuffer;

			Node.call(this, opts);

			this.renderToTexture = opts.renderToTexture;

			if (typeof target === 'string') {
				elements = document.querySelectorAll(target);

				for (i = 0; i < elements.length; i++) {
					element = elements[i];
					if (element.tagName === 'CANVAS') {
						break;
					}
				}

				if (i >= elements.length) {
					throw 'not a valid HTML element (must be image, video or canvas)';
				}

				target = element;
			} else if (target instanceof WebGLFramebuffer) {

				frameBuffer = target;

				if (opts instanceof HTMLCanvasElement) {
					target = opts;
				} else if (opts instanceof WebGLRenderingContext) {
					target = opts.canvas;
				} else if (opts.canvas instanceof HTMLCanvasElement) {
					target = opts.canvas;
				} else if (opts.context instanceof WebGLRenderingContext) {
					target = opts.context.canvas;
				} else {
					//todo: search all canvases for matching contexts?
					throw 'Must provide a canvas with WebGLFramebuffer target';
				}
			}

			if (target instanceof HTMLElement && target.tagName === 'CANVAS') {
				width = target.width;
				height = target.height;

				//todo: try to get a webgl context. if not, get a 2d context, and set up a different render function
				try {
					if (window.WebGLDebugUtils) {
						context = window.WebGLDebugUtils.makeDebugContext(target.getContext('webgl', {
							alpha: true,
							premultipliedAlpha: false,
							preserveDrawingBuffer: true,
							stencil: true
						}));
					} else {
						context = target.getContext('webgl', {
							alpha: true,
							premultipliedAlpha: false,
							preserveDrawingBuffer: true,
							stencil: true
						});
					}
				} catch (expError) {
				}

				if (!context) {
					try {
						context = target.getContext('experimental-webgl', {
							alpha: true,
							premultipliedAlpha: false,
							preserveDrawingBuffer: true,
							stencil: true
						});
					} catch (error) {
					}
				}

				if (!context) {
					context = target.getContext('2d');
					//todo: set up ImageData and alternative drawing method (or drawImage)
					this.render = this.render2D;
					this.use2D = true;
				} else if (!gl || gl === context) {
					//this is our main WebGL canvas
					if (!gl) {
						attachContext(context);
					}
					this.render = this.renderWebGL;
					if (opts.renderToTexture) {
						this.frameBuffer = new FrameBuffer(gl, width, height, false);
					} else {
						this.frameBuffer = {
							frameBuffer: frameBuffer || null
						};
					}
				} else if (context !== gl) {
					//set up alternative drawing method using ArrayBufferView
					this.gl = context;
					//this.pixels = new Uint8Array(width * height * 4);
					//todo: probably need another framebuffer for renderToTexture
					if (frameBuffer) {
						this.frameBuffer = {
							frameBuffer: frameBuffer
						};
					} else {
						this.frameBuffer = new FrameBuffer(this.gl, width, height, false);
					}
					this.shader = new ShaderProgram(this.gl, baseVertexShader, baseFragmentShader);
					this.model = buildRectangleModel.call(this, this.gl);

					this.texture = this.gl.createTexture();
					this.gl.bindTexture(gl.TEXTURE_2D, this.texture);
					this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
					this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
					this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

					this.render = this.renderSecondaryWebGL;
				} else {
					//todo: this should theoretically never happen
				}

				matchedType = true;
			}

			if (!matchedType) {
				throw 'Unknown target type';
			}

			this.target = target;
			this.transform = null;
			this.transformDirty = true;
			this.flip = flip;
			this.width = width;
			this.height = height;

			this.uniforms.resolution[0] = this.width;
			this.uniforms.resolution[1] = this.height;

			if (opts.auto !== undefined) {
				this.auto = opts.auto;
			} else {
				this.auto = auto;
			}
			this.frames = 0;

			this.pub = new Target(this);

			targets.push(this);
		};

		extend(TargetNode, Node);

		TargetNode.prototype.setSource = function (source) {
			var newSource;

			//todo: what if source is null/undefined/false

			newSource = findInputNode(source);

			//todo: check for cycles

			if (newSource !== this.source) {
				if (this.source) {
					this.source.removeTarget(this);
				}
				this.source = newSource;
				newSource.setTarget(this);

				if (newSource && newSource.ready) {
					this.setReady();
				} else {
					this.setUnready();
				}

				this.setDirty();
			}
		};

		TargetNode.prototype.setDirty = function () {
			this.dirty = true;

			if (this.auto && !rafId) {
				rafId = requestAnimationFrame(renderDaemon);
			}
		};

		TargetNode.prototype.resize = function () {
			//if target is a canvas, reset size to canvas size
			if (this.target instanceof HTMLCanvasElement &&
					(this.width !== this.target.width || this.height !== this.target.height)) {
				this.width = this.target.width;
				this.height = this.target.height;
				this.uniforms.resolution[0] = this.width;
				this.uniforms.resolution[1] = this.height;
				this.emit('resize');
				this.setTransformDirty();
			}

			if (this.source &&
				(this.source.width !== this.width || this.source.height !== this.height)) {
				if (!this.transform) {
					this.transform = new Float32Array(16);
				}
			}
		};

		TargetNode.prototype.setTransformDirty = function () {
			this.transformDirty = true;
			this.setDirty();
		};

		TargetNode.prototype.go = function () {
			this.auto = true;
			this.setDirty();
		};

		TargetNode.prototype.stop = function () {
			this.auto = false;
		};

		TargetNode.prototype.renderWebGL = function () {
			var matrix, x, y;

			this.resize();

			if (this.dirty) {
				if (!this.source) {
					return;
				}

				this.source.render();

				this.uniforms.source = this.source.texture;

				if (this.source.width === this.width && this.source.height === this.height) {
					this.uniforms.transform = this.source.cumulativeMatrix || identity;
				} else if (this.transformDirty) {
					matrix = this.transform;
					mat4.copy(matrix, this.source.cumulativeMatrix || identity);
					x = this.source.width / this.width;
					y = this.source.height / this.height;
					matrix[0] *= x;
					matrix[1] *= x;
					matrix[2] *= x;
					matrix[3] *= x;
					matrix[4] *= y;
					matrix[5] *= y;
					matrix[6] *= y;
					matrix[7] *= y;
					this.uniforms.transform = matrix;
					this.transformDirty = false;
				}

				draw(baseShader, rectangleModel, this.uniforms, this.frameBuffer.frameBuffer, this);

				this.emit('render');
				this.dirty = false;
			}
		};

		TargetNode.prototype.renderSecondaryWebGL = function () {
			if (this.dirty && this.source) {
				this.emit('render');
				this.source.render();

				var width = this.source.width,
					height = this.source.height;

				if (!this.pixels || this.pixels.length !== width * height * 4) {
					this.pixels = new Uint8Array(width * height * 4);
				}

				this.source.readPixels(0, 0, this.source.width, this.source.height, this.pixels);

				this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.pixels);

				this.uniforms.source = this.texture;
				draw(this.shader, this.model, this.uniforms, null, this);

				this.dirty = false;
			}
		};

		TargetNode.prototype.render2D = function () {
			//todo: make this actually do something?
		};

		TargetNode.prototype.removeSource = function (source) {
			if (this.source === source || this.source === source.pub) {
				this.source = null;
			}
		};

		TargetNode.prototype.destroy = function () {
			var i;

			//source
			if (this.source && this.source.removeTarget) {
				this.source.removeTarget(this);
			}
			delete this.source;
			delete this.target;
			delete this.pub;
			delete this.uniforms;
			delete this.pixels;
			delete this.auto;

			//remove self from master list of targets
			i = targets.indexOf(this);
			if (i >= 0) {
				targets.splice(i, 1);
			}

			//todo: if this.gl === gl, clear out context so we can start over

			Node.prototype.destroy.call(this);
		};

		Transform = function (transformNode) {
			var me = transformNode,
				self = this,
				key;

			function setInput(inputName, def, input) {
				var key, lookup, value;

				lookup = me.inputElements[inputName];

				//todo: there is some duplicate code with Effect here. Consolidate.
				if (typeof input === 'string' && isNaN(input)) {
					if (def.type === 'enum') {
						if (def.options && def.options.filter) {
							key = String(input).toLowerCase();

							//todo: possible memory leak on this function?
							value = def.options.filter(function (e) {
								return (typeof e === 'string' && e.toLowerCase() === key) ||
									(e.length && typeof e[0] === 'string' && e[0].toLowerCase() === key);
							});

							value = value.length;
						}

						if (!value) {
							input = getElement(input, ['select']);
						}

					} else if (def.type === 'number' || def.type === 'boolean') {
						input = getElement(input, ['input', 'select']);
					} else if (def.type === 'image') {
						input = getElement(input, ['canvas', 'img', 'video']);
					}
				}

				if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
					value = input.value;

					if (lookup && lookup.element !== input) {
						lookup.element.removeEventListener('change', lookup.listener, true);
						lookup.element.removeEventListener('input', lookup.listener, true);
						delete me.inputElements[inputName];
						lookup = null;
					}

					if (!lookup) {
						lookup = {
							element: input,
							listener: (function (name, element) {
								return function () {
									var oldValue, newValue;

									if (input.type === 'checkbox') {
										//special case for check box
										oldValue = input.checked;
									} else {
										oldValue = element.value;
									}

									if (def.set.call(me, oldValue)) {
										me.setTransformDirty();
									}

									newValue = def.get.call(me);

									//special case for color type
									/*
									no colors on transform nodes just yet. maybe later
									if (def.type === 'color') {
										newValue = arrayToHex(newValue);
									}
									*/

									//if input validator changes our value, update HTML Element
									//todo: make this optional...somehow
									if (newValue !== oldValue) {
										element.value = newValue;
									}
								};
							}(inputName, input))
						};

						me.inputElements[inputName] = lookup;
						if (input.type === 'range') {
							input.addEventListener('input', lookup.listener, true);
							input.addEventListener('change', lookup.listener, true);
						} else {
							input.addEventListener('change', lookup.listener, true);
						}
					}

					if (lookup && value.type === 'checkbox') {
						value = value.checked;
					}
				} else {
					if (lookup) {
						lookup.element.removeEventListener('change', lookup.listener, true);
						lookup.element.removeEventListener('input', lookup.listener, true);
						delete me.inputElements[inputName];
					}
					value = input;
				}

				if (def.set.call(me, value)) {
					me.setTransformDirty();
				}
			}

			function setProperty(name, def) {
				// todo: validate value passed to 'set'
				Object.defineProperty(self, name, {
					configurable: true,
					enumerable: true,
					get: function () {
						return def.get.call(me);
					},
					set: function (val) {
						setInput(name, def, val);
					}
				});
			}

			function makeMethod(method) {
				return function () {
					if (method.apply(me, arguments)) {
						me.setTransformDirty();
					}
				};
			}

			this.inputElements = {};

			//priveleged accessor methods
			Object.defineProperties(this, {
				id: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.id;
					}
				},
				source: {
					enumerable: true,
					configurable: true,
					get: function () {
						return me.source.pub;
					},
					set: function (source) {
						me.setSource(source);
					}
				}
			});

			// attach methods
			for (key in me.methods) {
				if (me.methods.hasOwnProperty(key)) {
					this[key] = makeMethod(me.methods[key].bind(me));
				}
			}

			for (key in me.inputs) {
				if (me.inputs.hasOwnProperty(key)) {
					setProperty(key, me.inputs[key]);
				}
			}

			this.update = function () {
				me.setDirty();
			};

			this.alias = function (inputName, aliasName) {
				me.alias(inputName, aliasName);
				return this;
			};

			this.on = function (eventName, callback) {
				me.on(eventName, callback);
			};

			this.off = function (eventName, callback) {
				me.off(eventName, callback);
			};

			this.destroy = function () {
				var i,
					descriptor;

				me.destroy();

				for (i in this) {
					if (this.hasOwnProperty(i) && i !== 'isDestroyed') {
						//todo: probably can simplify this if the only setter/getter is id
						descriptor = Object.getOwnPropertyDescriptor(this, i);
						if (descriptor.get || descriptor.set ||
								typeof this[i] !== 'function') {
							delete this[i];
						} else {
							this[i] = nop;
						}
					}
				}
			};

			this.isDestroyed = function () {
				return me.isDestroyed;
			};

			this.isReady = function () {
				return me.ready;
			};
		};

		TransformNode = function (hook, options) {
			var key,
				input;

			this.matrix = new Float32Array(16);
			this.cumulativeMatrix = new Float32Array(16);

			this.ready = false;
			this.width = 1;
			this.height = 1;

			this.seriously = seriously;

			this.transformRef = seriousTransforms[hook];
			this.hook = hook;
			this.id = nodeId;
			nodes.push(this);
			nodesById[nodeId] = this;
			nodeId++;

			this.options = options;
			this.sources = null;
			this.targets = [];
			this.inputElements = {};
			this.inputs = {};
			this.methods = {};
			this.listeners = {};

			this.texture = null;
			this.frameBuffer = null;
			this.uniforms = null;

			this.dirty = true;
			this.transformDirty = true;
			this.renderDirty = false;
			this.isDestroyed = false;
			this.transformed = false;

			if (this.transformRef.definition) {
				this.plugin = this.transformRef.definition.call(this, options);
				for (key in this.transformRef) {
					if (this.transformRef.hasOwnProperty(key) && !this.plugin[key]) {
						this.plugin[key] = this.transformRef[key];
					}
				}

				/*
				todo: validate method definitions, check against reserved names
				if (this.plugin.inputs !== this.transformRef.inputs) {
					validateInputSpecs(this.plugin);
				}
				*/
			} else {
				this.plugin = extend({}, this.transformRef);
			}

			for (key in this.plugin.inputs) {
				if (this.plugin.inputs.hasOwnProperty(key)) {
					input = this.plugin.inputs[key];

					if (input.method && typeof input.method === 'function') {
						this.methods[key] = input.method;
					} else if (typeof input.set === 'function' && typeof input.get === 'function') {
						this.inputs[key] = input;
					}
				}
			}

			this.pub = new Transform(this);

			transforms.push(this);

			allTransformsByHook[hook].push(this);
		};

		TransformNode.prototype.setDirty = function () {
			this.renderDirty = true;
			Node.prototype.setDirty.call(this);
		};

		TransformNode.prototype.setTransformDirty = function () {
			var i,
				target;
			this.transformDirty = true;
			this.dirty = true;
			this.renderDirty = true;
			for (i = 0; i < this.targets.length; i++) {
				target = this.targets[i];
				if (target.setTransformDirty) {
					target.setTransformDirty();
				} else {
					target.setDirty();
				}
			}
		};

		TransformNode.prototype.resize = function () {
			var i;

			Node.prototype.resize.call(this);

			if (this.plugin.resize) {
				this.plugin.resize.call(this);
			}

			for (i = 0; i < this.targets.length; i++) {
				this.targets[i].resize();
			}

			this.setTransformDirty();
		};

		TransformNode.prototype.setSource = function (source) {
			var newSource;

			//todo: what if source is null/undefined/false

			newSource = findInputNode(source);

			if (newSource === this.source) {
				return;
			}

			if (traceSources(newSource, this)) {
				throw 'Attempt to make cyclical connection.';
			}

			if (this.source) {
				this.source.removeTarget(this);
			}
			this.source = newSource;
			newSource.setTarget(this);

			if (newSource && newSource.ready) {
				this.setReady();
			} else {
				this.setUnready();
			}
			this.resize();
		};

		TransformNode.prototype.setTarget = function (target) {
			var i;
			for (i = 0; i < this.targets.length; i++) {
				if (this.targets[i] === target) {
					return;
				}
			}

			this.targets.push(target);
		};

		TransformNode.prototype.removeTarget = function (target) {
			var i = this.targets && this.targets.indexOf(target);
			if (i >= 0) {
				this.targets.splice(i, 1);
			}

			if (this.targets && this.targets.length) {
				this.resize();
			}
		};

		TransformNode.prototype.alias = function (inputName, aliasName) {
			var me = this,
				input,
				def;

			if (reservedNames.indexOf(aliasName) >= 0) {
				throw aliasName + ' is a reserved name and cannot be used as an alias.';
			}

			if (this.plugin.inputs.hasOwnProperty(inputName)) {
				if (!aliasName) {
					aliasName = inputName;
				}

				seriously.removeAlias(aliasName);

				input = this.inputs[inputName];
				if (input) {
					def = me.inputs[inputName];
					Object.defineProperty(seriously, aliasName, {
						configurable: true,
						enumerable: true,
						get: function () {
							return def.get.call(me);
						},
						set: function (val) {
							if (def.set.call(me, val)) {
								me.setTransformDirty();
							}
						}
					});
				} else {
					input = this.methods[inputName];
					if (input) {
						def = input;
						seriously[aliasName] = function () {
							if (def.apply(me, arguments)) {
								me.setTransformDirty();
							}
						};
					}
				}

				if (input) {
					aliases[aliasName] = {
						node: this,
						input: inputName
					};
				}
			}

			return this;
		};

		TransformNode.prototype.render = function (renderTransform) {
			if (!this.source) {
				if (this.transformDirty) {
					mat4.copy(this.cumulativeMatrix, this.matrix);
					this.transformDirty = false;
				}
				this.texture = null;
				this.dirty = false;

				return;
			}

			this.source.render();

			if (this.transformDirty) {
				if (this.transformed) {
					//use this.matrix
					if (this.source.cumulativeMatrix) {
						mat4.multiply(this.cumulativeMatrix, this.matrix, this.source.cumulativeMatrix);
					} else {
						mat4.copy(this.cumulativeMatrix, this.matrix);
					}
				} else {
					//copy source.cumulativeMatrix
					mat4.copy(this.cumulativeMatrix, this.source.cumulativeMatrix || identity);
				}

				this.transformDirty = false;
			}

			if (renderTransform && gl) {
				if (this.renderDirty) {
					if (!this.frameBuffer) {
						this.uniforms = {
							resolution: [this.width, this.height]
						};
						this.frameBuffer = new FrameBuffer(gl, this.width, this.height);
					}

					this.uniforms.source = this.source.texture;
					this.uniforms.transform = this.cumulativeMatrix || identity;
					draw(baseShader, rectangleModel, this.uniforms, this.frameBuffer.frameBuffer, this);

					this.renderDirty = false;
				}
				this.texture = this.frameBuffer.texture;
			} else if (this.source) {
				this.texture = this.source.texture;
			} else {
				this.texture = null;
			}

			this.dirty = false;

			return this.texture;
		};

		TransformNode.prototype.destroy = function () {
			var i, key, item, hook = this.hook;

			//let effect destroy itself
			if (this.plugin.destroy && typeof this.plugin.destroy === 'function') {
				this.plugin.destroy.call(this);
			}
			delete this.effect;

			//stop watching any input elements
			for (i in this.inputElements) {
				if (this.inputElements.hasOwnProperty(i)) {
					item = this.inputElements[i];
					item.element.removeEventListener('change', item.listener, true);
					item.element.removeEventListener('input', item.listener, true);
				}
			}

			//sources
			if (this.source) {
				this.source.removeTarget(this);
			}

			//targets
			while (this.targets.length) {
				item = this.targets.pop();
				if (item && item.removeSource) {
					item.removeSource(this);
				}
			}

			for (key in this) {
				if (this.hasOwnProperty(key) && key !== 'id') {
					delete this[key];
				}
			}

			//remove any aliases
			for (key in aliases) {
				if (aliases.hasOwnProperty(key)) {
					item = aliases[key];
					if (item.node === this) {
						seriously.removeAlias(key);
					}
				}
			}

			//remove self from master list of effects
			i = transforms.indexOf(this);
			if (i >= 0) {
				transforms.splice(i, 1);
			}

			i = allTransformsByHook[hook].indexOf(this);
			if (i >= 0) {
				allTransformsByHook[hook].splice(i, 1);
			}

			Node.prototype.destroy.call(this);
		};

		TransformNode.prototype.setReady = Node.prototype.setReady;
		TransformNode.prototype.setUnready = Node.prototype.setUnready;
		TransformNode.prototype.on = Node.prototype.on;
		TransformNode.prototype.off = Node.prototype.off;
		TransformNode.prototype.emit = Node.prototype.emit;

		/*
		Initialize Seriously object based on options
		*/

		if (options instanceof HTMLCanvasElement) {
			options = {
				canvas: options
			};
		} else {
			options = options || {};
		}

		if (options.canvas) {
		}

		/*
		priveleged methods
		*/
		this.effect = function (hook, options) {
			if (!seriousEffects[hook]) {
				throw 'Unknown effect: ' + hook;
			}

			var effectNode = new EffectNode(hook, options);
			return effectNode.pub;
		};

		this.source = function (hook, source, options) {
			var sourceNode = findInputNode(hook, source, options);
			return sourceNode.pub;
		};

		this.transform = function (hook, opts) {
			var transformNode;

			if (typeof hook !== 'string') {
				opts = hook;
				hook = false;
			}

			if (hook) {
				if (!seriousTransforms[hook]) {
					throw 'Unknown transforms: ' + hook;
				}
			} else {
				hook = options && options.defaultTransform || '2d';
				if (!seriousTransforms[hook]) {
					throw 'No transform specified';
				}
			}

			transformNode = new TransformNode(hook, opts);
			return transformNode.pub;
		};

		this.target = function (target, options) {
			var targetNode, i;

			for (i = 0; i < targets.length; i++) {
				if (targets[i] === target || targets[i].target === target) {
					if (!!(options && options.renderToTexture) === !!targets[i].renderToTexture) {
						return targets[i].pub;
					}
				}
			}

			targetNode = new TargetNode(target, options);

			return targetNode.pub;
		};

		this.aliases = function () {
			return Object.keys(aliases);
		};

		this.removeAlias = function (name) {
			if (aliases[name]) {
				delete this[name];
				delete aliases[name];
			}
		};

		this.go = function (pre, post) {
			var i;

			if (typeof pre === 'function' && preCallbacks.indexOf(pre) < 0) {
				preCallbacks.push(pre);
			}

			if (typeof post === 'function' && postCallbacks.indexOf(post) < 0) {
				postCallbacks.push(post);
			}

			auto = true;
			for (i = 0; i < targets.length; i++) {
				targets[i].go();
			}

			if (!rafId && (preCallbacks.length || postCallbacks.length)) {
				renderDaemon();
			}
		};

		this.stop = function () {
			preCallbacks.length = 0;
			postCallbacks.length = 0;
			cancelAnimFrame(rafId);
			rafId = null;
		};

		this.render = function () {
			var i;
			for (i = 0; i < targets.length; i++) {
				targets[i].render(options);
			}
		};

		this.destroy = function () {
			var i,
				node,
				descriptor;

			while (nodes.length) {
				node = nodes.shift();
				node.destroy();
			}

			if (baseShader) {
				baseShader.destroy();
				baseShader = null;
			}

			//clean up rectangleModel
			if (gl) {
				gl.deleteBuffer(rectangleModel.vertex);
				gl.deleteBuffer(rectangleModel.texCoord);
				gl.deleteBuffer(rectangleModel.index);
			}

			if (rectangleModel) {
				delete rectangleModel.vertex;
				delete rectangleModel.texCoord;
				delete rectangleModel.index;
			}

			for (i in this) {
				if (this.hasOwnProperty(i) && i !== 'isDestroyed') {
					descriptor = Object.getOwnPropertyDescriptor(this, i);
					if (descriptor.get || descriptor.set ||
							typeof this[i] !== 'function') {
						delete this[i];
					} else {
						this[i] = nop;
					}
				}
			}

			baseFragmentShader = null;
			baseVertexShader = null;
			rectangleModel = null;
			gl = null;
			seriously = null;
			sources = [];
			targets = [];
			effects = [];
			nodes = [];
			preCallbacks.length = 0;
			postCallbacks.length = 0;
			cancelAnimFrame(rafId);
			rafId = null;


			isDestroyed = true;
		};

		this.isDestroyed = function () {
			return isDestroyed;
		};

		this.incompatible = function (hook) {
			var key,
				plugin,
				failure = false;

			failure = Seriously.incompatible(hook);

			if (failure) {
				return failure;
			}

			if (!hook) {
				for (key in allEffectsByHook) {
					if (allEffectsByHook.hasOwnProperty(key) && allEffectsByHook[key].length) {
						plugin = seriousEffects[key];
						if (plugin && typeof plugin.compatible === 'function' &&
								!plugin.compatible.call(this)) {
							return 'plugin-' + key;
						}
					}
				}

				for (key in allSourcesByHook) {
					if (allSourcesByHook.hasOwnProperty(key) && allSourcesByHook[key].length) {
						plugin = seriousSources[key];
						if (plugin && typeof plugin.compatible === 'function' &&
								!plugin.compatible.call(this)) {
							return 'source-' + key;
						}
					}
				}
			}

			return false;
		};

		Object.defineProperties(this, {
			id: {
				enumerable: true,
				configurable: true,
				get: function () {
					return id;
				}
			}
		});

		//todo: load, save, find

		baseVertexShader = [
			'#ifdef GL_ES',
			'precision mediump float;',
			'#endif',

			'attribute vec4 position;',
			'attribute vec2 texCoord;',

			'uniform vec2 resolution;',
			'uniform mat4 transform;',

			'varying vec2 vTexCoord;',
			'varying vec4 vPosition;',

			'void main(void) {',
			// first convert to screen space
			'	vec4 screenPosition = vec4(position.xy * resolution / 2.0, position.z, position.w);',
			'	screenPosition = transform * screenPosition;',

			// convert back to OpenGL coords
			'	gl_Position.xy = screenPosition.xy * 2.0 / resolution;',
			'	gl_Position.z = screenPosition.z * 2.0 / (resolution.x / resolution.y);',
			'	gl_Position.w = screenPosition.w;',
			'	vTexCoord = texCoord;',
			'	vPosition = gl_Position;',
			'}\n'
		].join('\n');

		baseFragmentShader = [
			'#ifdef GL_ES',
			'precision mediump float;',
			'#endif',
			'varying vec2 vTexCoord;',
			'varying vec4 vPosition;',
			'uniform sampler2D source;',
			'void main(void) {',
			/*
			'	if (any(lessThan(vTexCoord, vec2(0.0))) || any(greaterThanEqual(vTexCoord, vec2(1.0)))) {',
			'		gl_FragColor = vec4(0.0);',
			'	} else {',
			*/
			'		gl_FragColor = texture2D(source, vTexCoord);',
			//'	}',
			'}'
		].join('\n');
	}

	Seriously.incompatible = function (hook) {
		var canvas, gl, plugin;

		if (incompatibility === undefined) {
			canvas = document.createElement('canvas');
			if (!canvas || !canvas.getContext) {
				incompatibility = 'canvas';
			} else if (!window.WebGLRenderingContext) {
				incompatibility = 'webgl';
			} else {
				gl = getTestContext();
				if (!gl) {
					incompatibility = 'context';
				}
			}
		}

		if (incompatibility) {
			return incompatibility;
		}

		if (hook) {
			plugin = seriousEffects[hook];
			if (plugin && typeof plugin.compatible === 'function' &&
				!plugin.compatible(gl)) {

				return 'plugin-' + hook;
			}

			plugin = seriousSources[hook];
			if (plugin && typeof plugin.compatible === 'function' &&
				!plugin.compatible(gl)) {

				return 'source-' + hook;
			}
		}

		return false;
	};

	Seriously.plugin = function (hook, definition, meta) {
		var effect;

		if (seriousEffects[hook]) {
			console.log('Effect [' + hook + '] already loaded');
			return;
		}

		if (meta === undefined && typeof definition === 'object') {
			meta = definition;
		}

		if (!meta) {
			return;
		}

		effect = extend({}, meta);

		if (typeof definition === 'function') {
			effect.definition = definition;
		}

		if (effect.inputs) {
			validateInputSpecs(effect);
		}

		if (!effect.title) {
			effect.title = hook;
		}

		/*
		if (typeof effect.requires !== 'function') {
			effect.requires = false;
		}
		*/

		seriousEffects[hook] = effect;
		allEffectsByHook[hook] = [];

		return effect;
	};

	Seriously.removePlugin = function (hook) {
		var all, effect, plugin;

		if (!hook) {
			return this;
		}

		plugin = seriousEffects[hook];

		if (!plugin) {
			return this;
		}

		all = allEffectsByHook[hook];
		if (all) {
			while (all.length) {
				effect = all.shift();
				effect.destroy();
			}
			delete allEffectsByHook[hook];
		}

		delete seriousEffects[hook];

		return this;
	};

	Seriously.source = function (hook, definition, meta) {
		var source;

		if (seriousSources[hook]) {
			console.log('Source [' + hook + '] already loaded');
			return;
		}

		if (meta === undefined && typeof definition === 'object') {
			meta = definition;
		}

		if (!meta && !definition) {
			return;
		}

		source = extend({}, meta);

		if (typeof definition === 'function') {
			source.definition = definition;
		}

		if (!source.title) {
			source.title = hook;
		}


		seriousSources[hook] = source;
		allSourcesByHook[hook] = [];

		return source;
	};

	Seriously.removeSource = function (hook) {
		var all, source, plugin;

		if (!hook) {
			return this;
		}

		plugin = seriousSources[hook];

		if (!plugin) {
			return this;
		}

		all = allSourcesByHook[hook];
		if (all) {
			while (all.length) {
				source = all.shift();
				source.destroy();
			}
			delete allSourcesByHook[hook];
		}

		delete seriousSources[hook];

		return this;
	};

	Seriously.transform = function (hook, definition, meta) {
		var transform;

		if (seriousTransforms[hook]) {
			console.log('Transform [' + hook + '] already loaded');
			return;
		}

		if (meta === undefined && typeof definition === 'object') {
			meta = definition;
		}

		if (!meta && !definition) {
			return;
		}

		transform = extend({}, meta);

		if (typeof definition === 'function') {
			transform.definition = definition;
		}

		/*
		todo: validate method definitions
		if (effect.inputs) {
			validateInputSpecs(effect);
		}
		*/

		if (!transform.title) {
			transform.title = hook;
		}


		seriousTransforms[hook] = transform;
		allTransformsByHook[hook] = [];

		return transform;
	};

	Seriously.removeTransform = function (hook) {
		var all, transform, plugin;

		if (!hook) {
			return this;
		}

		plugin = seriousTransforms[hook];

		if (!plugin) {
			return this;
		}

		all = allTransformsByHook[hook];
		if (all) {
			while (all.length) {
				transform = all.shift();
				transform.destroy();
			}
			delete allTransformsByHook[hook];
		}

		delete seriousTransforms[hook];

		return this;
	};

	//todo: validators should not allocate new objects/arrays if input is valid
	Seriously.inputValidators = {
		color: function (value, input, oldValue) {
			var s, a, i, computed, bg;

			a = oldValue || [];

			if (typeof value === 'string') {
				//todo: support percentages, decimals
				s = (/^(rgb|hsl)a?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*(\d+(\.\d*)?)\s*)?\)/i).exec(value);
				if (s && s.length) {
					if (s.length < 3) {
						a[0] = a[1] = a[2] = a[3] = 0;
						return a;
					}

					a[3] = 1;
					for (i = 0; i < 3; i++) {
						a[i] = parseFloat(s[i+2]) / 255;
					}
					if (!isNaN(s[6])) {
						a[3] = parseFloat(s[6]);
					}
					if (s[1].toLowerCase() === 'hsl') {
						return hslToRgb(a[0], a[1], a[2], a[3], a);
					}
					return a;
				}

				s = (/^#(([0-9a-fA-F]{3,8}))/).exec(value);
				if (s && s.length) {
					s = s[1];
					if (s.length === 3) {
						a[0] = parseInt(s[0], 16) / 15;
						a[1] = parseInt(s[1], 16) / 15;
						a[2] = parseInt(s[2], 16) / 15;
						a[3] = 1;
					} else if (s.length === 4) {
						a[0] = parseInt(s[0], 16) / 15;
						a[1] = parseInt(s[1], 16) / 15;
						a[2] = parseInt(s[2], 16) / 15;
						a[3] = parseInt(s[3], 16) / 15;
					} else if (s.length === 6) {
						a[0] = parseInt(s.substr(0, 2), 16) / 255;
						a[1] = parseInt(s.substr(2, 2), 16) / 255;
						a[2] = parseInt(s.substr(4, 2), 16) / 255;
						a[3] = 1;
					} else if (s.length === 8) {
						a[0] = parseInt(s.substr(0, 2), 16) / 255;
						a[1] = parseInt(s.substr(2, 2), 16) / 255;
						a[2] = parseInt(s.substr(4, 2), 16) / 255;
						a[3] = parseInt(s.substr(6, 2), 16) / 255;
					} else {
						a[0] = a[1] = a[2] = a[3] = 0;
					}
					return a;
				}

				s = colorNames[value.toLowerCase()];
				if (s) {
					for (i = 0; i < 4; i++) {
						a[i] = s[i];
					}
					return a;
				}

				if (!colorElement) {
					colorElement = document.createElement('a');
				}
				colorElement.style.backgroundColor = '';
				colorElement.style.backgroundColor = value;
				computed = window.getComputedStyle(colorElement);
				bg = computed.getPropertyValue('background-color') ||
					computed.getPropertyValue('backgroundColor') ||
					colorElement.style.backgroundColor;
				if (bg && bg !== value) {
					return Seriously.inputValidators.color(bg, input, oldValue);
				}

				a[0] = a[1] = a[2] = a[3] = 0;
				return a;
			}

			if (isArrayLike(value)) {
				a = value;
				if (a.length < 3) {
					a[0] = a[1] = a[2] = a[3] = 0;
					return a;
				}
				for (i = 0; i < 3; i++) {
					if (isNaN(a[i])) {
						a[0] = a[1] = a[2] = a[3] = 0;
						return a;
					}
				}
				if (a.length < 4) {
					a.push(1);
				}
				return a;
			}

			if (typeof value === 'number') {
				a[0] = a[1] = a[2] = value;
				a[3] = 1;
				return a;
			}

			if (typeof value === 'object') {
				for (i = 0; i < 4; i++) {
					s = colorFields[i];
					if (value[s] === null || isNaN(value[s])) {
						a[i] = i === 3 ? 1 : 0;
					} else {
						a[i] = value[s];
					}
				}
				return a;
			}

			a[0] = a[1] = a[2] = a[3] = 0;
			return a;
		},
		number: function (value, input) {
			if (isNaN(value)) {
				return input.defaultValue || 0;
			}

			value = parseFloat(value);

			if (value < input.min) {
				return input.min;
			}

			if (value > input.max) {
				return input.max;
			}

			if (input.step) {
				return Math.round(value / input.step) * input.step;
			}

			return value;
		},
		'enum': function (value, input) {
			var options = input.options || [],
				filtered;

			filtered = options.filter(function (opt) {
				return (isArrayLike(opt) && opt.length && opt[0] === value) || opt === value;
			});

			if (filtered.length) {
				return value;
			}

			return input.defaultValue || '';
		},
		vector: function (value, input, oldValue) {
			var a, i, s, n = input.dimensions || 4;

			a = oldValue || [];
			if (isArrayLike(value)) {
				for (i = 0; i < n; i++) {
					a[i] = value[i] || 0;
				}
				return a;
			}

			if (typeof value === 'object') {
				for (i = 0; i < n; i++) {
					s = vectorFields[i];
					if (value[s] === undefined) {
						s = colorFields[i];
					}
					a[i] = value[s] || 0;
				}
				return a;
			}

			value = parseFloat(value) || 0;
			for (i = 0; i < n; i++) {
				a[i] = value;
			}

			return a;
		},
		'boolean': function (value) {
			if (!value) {
				return false;
			}

			if (value && value.toLowerCase && value.toLowerCase() === 'false') {
				return false;
			}

			return true;
		},
		'string': function (value) {
			if (typeof value === 'string') {
				return value;
			}

			if (value !== 0 && !value) {
				return '';
			}

			if (value.toString) {
				return value.toString();
			}

			return String(value);
		}
		//todo: date/time
	};

	Seriously.prototype.effects = Seriously.effects = function () {
		var name,
			effect,
			manifest,
			effects = {},
			input,
			i;

		for (name in seriousEffects) {
			if (seriousEffects.hasOwnProperty(name)) {
				effect = seriousEffects[name];
				manifest = {
					title: effect.title || name,
					description: effect.description || '',
					inputs: {}
				};

				for (i in effect.inputs) {
					if (effect.inputs.hasOwnProperty(i)) {
						input = effect.inputs[i];
						manifest.inputs[i] = {
							type: input.type,
							defaultValue: input.defaultValue,
							step: input.step,
							min: input.min,
							max: input.max,
							minCount: input.minCount,
							maxCount: input.maxCount,
							dimensions: input.dimensions,
							title: input.title || i,
							description: input.description || '',
							options: input.options || []
						};
					}
				}

				effects[name] = manifest;
			}
		}

		return effects;
	};

	if (window.Float32Array) {
		identity = new Float32Array([
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		]);
	}

	//check for plugins loaded out of order
	if (window.Seriously) {
		if (typeof window.Seriously === 'object') {
			(function () {
				var i;
				for (i in window.Seriously) {
					if (window.Seriously.hasOwnProperty(i) &&
						i !== 'plugin' &&
						typeof window.Seriously[i] === 'object') {

						Seriously.plugin(i, window.Seriously[i]);
					}
				}
			}());
		}
	}

	//expose Seriously to the global object
	Seriously.util = {
		mat4: mat4,
		checkSource: checkSource,
		hslToRgb: hslToRgb,
		colors: colorNames,
		setTimeoutZero: setTimeoutZero,
		ShaderProgram: ShaderProgram,
		FrameBuffer: FrameBuffer,
		requestAnimationFrame: requestAnimationFrame,
		shader: {
			makeNoise: 'float makeNoise(float u, float v, float timer) {\n' +
						'	float x = u * v * mod(timer * 1000.0, 100.0);\n' +
						'	x = mod(x, 13.0) * mod(x, 127.0);\n' +
						'	float dx = mod(x, 0.01);\n' +
						'	return clamp(0.1 + dx * 100.0, 0.0, 1.0);\n' +
						'}\n',
			random: '#ifndef RANDOM\n' +
				'#define RANDOM\n' +
				'float random(vec2 n) {\n' +
				'	return 0.5 + 0.5 * fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);\n' +
				'}\n' +
				'#endif\n'
		}
	};

	/*
	Default transform - 2D
	Affine transforms
	- translate
	- rotate (degrees)
	- scale
	- skew

	todo: move this to a different file when we have a build tool
	*/
	Seriously.transform('2d', function (options) {
		var me = this,
			degrees = !(options && options.radians),

			centerX = 0,
			centerY = 0,
			scaleX = 1,
			scaleY = 1,
			translateX = 0,
			translateY = 0,
			rotation = 0,
			skewX = 0,
			skewY = 0;

		//todo: skew order
		//todo: invert?

		function recompute() {
			var matrix = me.matrix,
				angle,
				s, c,
				m00,
				m01,
				m02,
				m03,
				m10,
				m11,
				m12,
				m13;

			function translate(x, y) {
				matrix[12] = matrix[0] * x + matrix[4] * y + matrix[12];
				matrix[13] = matrix[1] * x + matrix[5] * y + matrix[13];
				matrix[14] = matrix[2] * x + matrix[6] * y + matrix[14];
				matrix[15] = matrix[3] * x + matrix[7] * y + matrix[15];
			}

			if (!translateX &&
					!translateY &&
					!rotation &&
					!skewX &&
					!skewY &&
					scaleX === 1 &&
					scaleY === 1
					) {
				me.transformed = false;
				return;
			}

			//calculate transformation matrix
			mat4.identity(matrix);

			translate(translateX + centerX, translateY + centerY);

			//skew
			if (skewX) {
				matrix[4] = skewX / me.width;
			}
			if (skewY) {
				matrix[1] = skewY / me.height;
			}

			if (rotation) {
				m00 = matrix[0];
				m01 = matrix[1];
				m02 = matrix[2];
				m03 = matrix[3];
				m10 = matrix[4];
				m11 = matrix[5];
				m12 = matrix[6];
				m13 = matrix[7];

				//rotate
				angle = -(degrees ? rotation * Math.PI / 180 : rotation);
				//...rotate
				s = Math.sin(angle);
				c = Math.cos(angle);
				matrix[0] = m00 * c + m10 * s;
				matrix[1] = m01 * c + m11 * s;
				matrix[2] = m02 * c + m12 * s;
				matrix[3] = m03 * c + m13 * s;
				matrix[4] = m10 * c - m00 * s;
				matrix[5] = m11 * c - m01 * s;
				matrix[6] = m12 * c - m02 * s;
				matrix[7] = m13 * c - m03 * s;
			}

			//scale
			if (scaleX !== 1) {
				matrix[0] *= scaleX;
				matrix[1] *= scaleX;
				matrix[2] *= scaleX;
				matrix[3] *= scaleX;
			}
			if (scaleY !== 1) {
				matrix[4] *= scaleY;
				matrix[5] *= scaleY;
				matrix[6] *= scaleY;
				matrix[7] *= scaleY;
			}

			translate(-centerX, -centerY);

			me.transformed = true;
		}

		return {
			inputs: {
				reset: {
					method: function () {
						centerX = 0;
						centerY = 0;
						scaleX = 1;
						scaleY = 1;
						translateX = 0;
						translateY = 0;
						rotation = 0;
						skewX = 0;
						skewY = 0;

						if (me.transformed) {
							me.transformed = false;
							return true;
						}

						return false;
					}
				},
				translate: {
					method: function (x, y) {
						if (isNaN(x)) {
							x = translateX;
						}

						if (isNaN(y)) {
							y = translateY;
						}

						if (x === translateX && y === translateY) {
							return false;
						}

						translateX = x;
						translateY = y;

						recompute();
						return true;
					},
					type: [
						'number',
						'number'
					]
				},
				translateX: {
					get: function () {
						return translateX;
					},
					set: function (x) {
						if (x === translateX) {
							return false;
						}

						translateX = x;

						recompute();
						return true;
					},
					type: 'number'
				},
				translateY: {
					get: function () {
						return translateY;
					},
					set: function (y) {
						if (y === translateY) {
							return false;
						}

						translateY = y;

						recompute();
						return true;
					},
					type: 'number'
				},
				rotation: {
					get: function () {
						return rotation;
					},
					set: function (angle) {
						if (angle === rotation) {
							return false;
						}

						//todo: fmod 360deg or Math.PI * 2 radians
						rotation = parseFloat(angle);

						recompute();
						return true;
					},
					type: 'number'
				},
				center: {
					method: function (x, y) {
						if (isNaN(x)) {
							x = centerX;
						}

						if (isNaN(y)) {
							y = centerY;
						}

						if (x === centerX && y === centerY) {
							return false;
						}

						centerX = x;
						centerY = y;

						recompute();
						return true;
					},
					type: [
						'number',
						'number'
					]
				},
				centerX: {
					get: function () {
						return centerX;
					},
					set: function (x) {
						if (x === centerX) {
							return false;
						}

						centerX = x;

						recompute();
						return true;
					},
					type: 'number'
				},
				centerY: {
					get: function () {
						return centerY;
					},
					set: function (y) {
						if (y === centerY) {
							return false;
						}

						centerY = y;

						recompute();
						return true;
					},
					type: 'number'
				},
				skew: {
					method: function (x, y) {
						if (isNaN(x)) {
							x = skewX;
						}

						if (isNaN(y)) {
							y = skewY;
						}

						if (x === skewX && y === skewY) {
							return false;
						}

						skewX = x;
						skewY = y;

						recompute();
						return true;
					},
					type: [
						'number',
						'number'
					]
				},
				skewX: {
					get: function () {
						return skewX;
					},
					set: function (x) {
						if (x === skewX) {
							return false;
						}

						skewX = x;

						recompute();
						return true;
					},
					type: 'number'
				},
				skewY: {
					get: function () {
						return skewY;
					},
					set: function (y) {
						if (y === skewY) {
							return false;
						}

						skewY = y;

						recompute();
						return true;
					},
					type: 'number'
				},
				scale: {
					method: function (x, y) {
						var newX, newY;

						if (isNaN(x)) {
							newX = scaleX;
						} else {
							newX = x;
						}

						/*
						if only one value is specified, set both x and y to the same scale
						*/
						if (isNaN(y)) {
							if (isNaN(x)) {
								return false;
							}

							newY = newX;
						} else {
							newY = y;
						}

						if (newX === scaleX && newY === scaleY) {
							return false;
						}

						scaleX = newX;
						scaleY = newY;

						recompute();
						return true;
					},
					type: [
						'number',
						'number'
					]
				},
				scaleX: {
					get: function () {
						return scaleX;
					},
					set: function (x) {
						if (x === scaleX) {
							return false;
						}

						scaleX = x;

						recompute();
						return true;
					},
					type: 'number'
				},
				scaleY: {
					get: function () {
						return scaleY;
					},
					set: function (y) {
						if (y === scaleY) {
							return false;
						}

						scaleY = y;

						recompute();
						return true;
					},
					type: 'number'
				}
			}
		};
	}, {
		title: '2D Transform',
		description: 'Translate, Rotate, Scale, Skew'
	});

	/*
	todo: move this to a different file when we have a build tool
	*/
	Seriously.transform('flip', function () {
		var me = this,
			horizontal = true;

		function recompute() {
			var matrix = me.matrix;

			//calculate transformation matrix
			//mat4.identity(matrix);

			//scale
			if (horizontal) {
				matrix[0] = -1;
				matrix[5] = 1;
			} else {
				matrix[0] = 1;
				matrix[5] = -1;
			}
		}

		mat4.identity(me.matrix);
		recompute();

		me.transformDirty = true;

		me.transformed = true;

		return {
			inputs: {
				direction: {
					get: function () {
						return horizontal ? 'horizontal' : 'vertical';
					},
					set: function (d) {
						var horiz;
						if (d === 'vertical') {
							horiz = false;
						} else {
							horiz = true;
						}

						if (horiz === horizontal) {
							return false;
						}

						horizontal = horiz;
						recompute();
						return true;
					},
					type: 'string'
				}
			}
		};
	}, {
		title: 'Flip',
		description: 'Flip Horizontal/Vertical'
	});

	/*
	Reformat
	todo: move this to a different file when we have a build tool
	*/
	Seriously.transform('reformat', function () {
		var me = this,
			forceWidth,
			forceHeight,
			mode = 'contain';

		function recompute() {
			var matrix = me.matrix,
				width = forceWidth || me.width,
				height = forceHeight || me.height,
				scaleX,
				scaleY,
				source = me.source,
				sourceWidth = source && source.width || 1,
				sourceHeight = source && source.height || 1,
				aspectIn,
				aspectOut;

			if (mode === 'distort' || width === sourceWidth && height === sourceHeight) {
				me.transformed = false;
				return;
			}

			aspectIn = sourceWidth / sourceHeight;

			aspectOut = width / height;

			if (mode === 'width' || mode === 'contain' && aspectOut <= aspectIn) {
				scaleX = 1;
				scaleY = aspectOut / aspectIn;
			} else if (mode === 'height' || mode === 'contain' && aspectOut > aspectIn) {
				scaleX = aspectIn / aspectOut;
				scaleY = 1;
			} else {
				//mode === 'cover'
				if (aspectOut > aspectIn) {
					scaleX = 1;
					scaleY = aspectOut / aspectIn;
				} else {
					scaleX = aspectIn / aspectOut;
					scaleY = 1;
				}
			}

			if (scaleX === 1 && scaleY === 1) {
				me.transformed = false;
				return;
			}

			//calculate transformation matrix
			mat4.identity(matrix);

			//scale
			if (scaleX !== 1) {
				matrix[0] *= scaleX;
				matrix[1] *= scaleX;
				matrix[2] *= scaleX;
				matrix[3] *= scaleX;
			}
			if (scaleY !== 1) {
				matrix[4] *= scaleY;
				matrix[5] *= scaleY;
				matrix[6] *= scaleY;
				matrix[7] *= scaleY;
			}
			me.transformed = true;
		}

		function getWidth() {
			return forceWidth || me.source && me.source.width || 1;
		}

		function getHeight() {
			return forceHeight || me.source && me.source.height || 1;
		}

		this.resize = function () {
			var width = getWidth(),
				height = getHeight(),
				i;

			if (this.width !== width || this.height !== height) {
				this.width = width;
				this.height = height;

				if (this.uniforms && this.uniforms.resolution) {
					this.uniforms.resolution[0] = width;
					this.uniforms.resolution[1] = height;
				}

				if (this.frameBuffer && this.frameBuffer.resize) {
					this.frameBuffer.resize(width, height);
				}

				for (i = 0; i < this.targets.length; i++) {
					this.targets[i].resize();
				}
			}

			this.setTransformDirty();

			recompute();
		};

		return {
			inputs: {
				width: {
					get: getWidth,
					set: function (x) {
						x = Math.floor(x);
						if (x === forceWidth) {
							return false;
						}

						forceWidth = x;

						this.resize();

						//don't need to run setTransformDirty again
						return false;
					},
					type: 'number'
				},
				height: {
					get: getHeight,
					set: function (y) {
						y = Math.floor(y);
						if (y === forceHeight) {
							return false;
						}

						forceHeight = y;

						this.resize();

						//don't need to run setTransformDirty again
						return false;
					},
					type: 'number'
				},
				mode: {
					get: function () {
						return mode;
					},
					set: function (m) {
						if (m === mode) {
							return false;
						}

						mode = m;

						recompute();
						return true;
					},
					type: 'enum',
					options: [
						'cover',
						'contain',
						'distort',
						'width',
						'height'
					]
				}
			}
		};
	}, {
		title: 'Reformat',
		description: 'Change output dimensions'
	});

	/*
	todo: additional transform node types
	- perspective
	- matrix
	- crop? - maybe not - probably would just scale.
	- camera shake?
	*/

	/*
	 * simplex noise shaders
	 * https://github.com/ashima/webgl-noise
	 * Copyright (C) 2011 by Ashima Arts (Simplex noise)
	 * Copyright (C) 2011 by Stefan Gustavson (Classic noise)
	 */

	Seriously.util.shader.noiseHelpers = '#ifndef NOISE_HELPERS\n' +
		'#define NOISE_HELPERS\n' +
		'vec2 mod289(vec2 x) {\n' +
		'	return x - floor(x * (1.0 / 289.0)) * 289.0;\n' +
		'}\n' +
		'vec3 mod289(vec3 x) {\n' +
		'	return x - floor(x * (1.0 / 289.0)) * 289.0;\n' +
		'}\n' +
		'vec4 mod289(vec4 x) {\n' +
		'	return x - floor(x * (1.0 / 289.0)) * 289.0;\n' +
		'}\n' +
		'vec3 permute(vec3 x) {\n' +
		'	return mod289(((x*34.0)+1.0)*x);\n' +
		'}\n' +
		'vec4 permute(vec4 x) {\n' +
		'	return mod289(((x*34.0)+1.0)*x);\n' +
		'}\n' +
		'vec4 taylorInvSqrt(vec4 r) {\n' +
		'	return 1.79284291400159 - 0.85373472095314 * r;\n' +
		'}\n' +
		'float taylorInvSqrt(float r) {\n' +
		'	return 1.79284291400159 - 0.85373472095314 * r;\n' +
		'}\n' +
		'#endif\n';

	Seriously.util.shader.snoise2d = '#ifndef NOISE2D\n' +
		'#define NOISE2D\n' +
		'float snoise(vec2 v) {\n' +
		'	const vec4 C = vec4(0.211324865405187, // (3.0-sqrt(3.0))/6.0\n' +
		'		0.366025403784439, // 0.5*(sqrt(3.0)-1.0)\n' +
		'		-0.577350269189626, // -1.0 + 2.0 * C.x\n' +
		'		0.024390243902439); // 1.0 / 41.0\n' +
		'	vec2 i = floor(v + dot(v, C.yy));\n' +
		'	vec2 x0 = v - i + dot(i, C.xx);\n' +
		'	vec2 i1;\n' +
		'	//i1.x = step(x0.y, x0.x); // x0.x > x0.y ? 1.0 : 0.0\n' +
		'	//i1.y = 1.0 - i1.x;\n' +
		'	i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n' +
		'	// x0 = x0 - 0.0 + 0.0 * C.xx ;\n' +
		'	// x1 = x0 - i1 + 1.0 * C.xx ;\n' +
		'	// x2 = x0 - 1.0 + 2.0 * C.xx ;\n' +
		'	vec4 x12 = x0.xyxy + C.xxzz;\n' +
		'	x12.xy -= i1;\n' +
		'	i = mod289(i); // Avoid truncation effects in permutation\n' +
		'	vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));\n' +
		'	vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);\n' +
		'	m = m*m ;\n' +
		'	m = m*m ;\n' +
		'	vec3 x = 2.0 * fract(p * C.www) - 1.0;\n' +
		'	vec3 h = abs(x) - 0.5;\n' +
		'	vec3 ox = floor(x + 0.5);\n' +
		'	vec3 a0 = x - ox;\n' +
		'	m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);\n' +
		'	vec3 g;\n' +
		'	g.x = a0.x * x0.x + h.x * x0.y;\n' +
		'	g.yz = a0.yz * x12.xz + h.yz * x12.yw;\n' +
		'	return 130.0 * dot(m, g);\n' +
		'}\n' +
		'#endif\n';

	Seriously.util.shader.snoise3d = '#ifndef NOISE3D\n' +
		'#define NOISE3D\n' +
		'float snoise(vec3 v) {\n' +
		'	const vec2 C = vec2(1.0/6.0, 1.0/3.0) ;\n' +
		'	const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);\n' +

		// First corner
		'	vec3 i = floor(v + dot(v, C.yyy));\n' +
		'	vec3 x0 = v - i + dot(i, C.xxx) ;\n' +

		// Other corners
		'	vec3 g = step(x0.yzx, x0.xyz);\n' +
		'	vec3 l = 1.0 - g;\n' +
		'	vec3 i1 = min(g.xyz, l.zxy);\n' +
		'	vec3 i2 = max(g.xyz, l.zxy);\n' +

		'	// x0 = x0 - 0.0 + 0.0 * C.xxx;\n' +
		'	// x1 = x0 - i1 + 1.0 * C.xxx;\n' +
		'	// x2 = x0 - i2 + 2.0 * C.xxx;\n' +
		'	// x3 = x0 - 1.0 + 3.0 * C.xxx;\n' +
		'	vec3 x1 = x0 - i1 + C.xxx;\n' +
		'	vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y\n' +
		'	vec3 x3 = x0 - D.yyy; // -1.0+3.0*C.x = -0.5 = -D.y\n' +

		// Permutations
		'	i = mod289(i);\n' +
		'	vec4 p = permute(permute(permute(\n' +
		'						i.z + vec4(0.0, i1.z, i2.z, 1.0))\n' +
		'						+ i.y + vec4(0.0, i1.y, i2.y, 1.0))\n' +
		'						+ i.x + vec4(0.0, i1.x, i2.x, 1.0));\n' +

		// Gradients: 7x7 points over a square, mapped onto an octahedron.
		// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
		'	float n_ = 0.142857142857; // 1.0/7.0\n' +
		'	vec3 ns = n_ * D.wyz - D.xzx;\n' +

		'	vec4 j = p - 49.0 * floor(p * ns.z * ns.z); // mod(p, 7 * 7)\n' +

		'	vec4 x_ = floor(j * ns.z);\n' +
		'	vec4 y_ = floor(j - 7.0 * x_); // mod(j, N)\n' +

		'	vec4 x = x_ * ns.x + ns.yyyy;\n' +
		'	vec4 y = y_ * ns.x + ns.yyyy;\n' +
		'	vec4 h = 1.0 - abs(x) - abs(y);\n' +

		'	vec4 b0 = vec4(x.xy, y.xy);\n' +
		'	vec4 b1 = vec4(x.zw, y.zw);\n' +

		'	//vec4 s0 = vec4(lessThan(b0, 0.0)) * 2.0 - 1.0;\n' +
		'	//vec4 s1 = vec4(lessThan(b1, 0.0)) * 2.0 - 1.0;\n' +
		'	vec4 s0 = floor(b0) * 2.0 + 1.0;\n' +
		'	vec4 s1 = floor(b1) * 2.0 + 1.0;\n' +
		'	vec4 sh = -step(h, vec4(0.0));\n' +

		'	vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy ;\n' +
		'	vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww ;\n' +

		'	vec3 p0 = vec3(a0.xy, h.x);\n' +
		'	vec3 p1 = vec3(a0.zw, h.y);\n' +
		'	vec3 p2 = vec3(a1.xy, h.z);\n' +
		'	vec3 p3 = vec3(a1.zw, h.w);\n' +

		//Normalise gradients
		'	vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));\n' +
		'	p0 *= norm.x;\n' +
		'	p1 *= norm.y;\n' +
		'	p2 *= norm.z;\n' +
		'	p3 *= norm.w;\n' +

		// Mix final noise value
		'	vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);\n' +
		'	m = m * m;\n' +
		'	return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));\n' +
		'}\n' +
		'#endif\n';

	Seriously.util.shader.snoise4d = '#ifndef NOISE4D\n' +
		'#define NOISE4D\n' +
		'vec4 grad4(float j, vec4 ip)\n' +
		'	{\n' +
		'	const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);\n' +
		'	vec4 p, s;\n' +
		'\n' +
		'	p.xyz = floor(fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;\n' +
		'	p.w = 1.5 - dot(abs(p.xyz), ones.xyz);\n' +
		'	s = vec4(lessThan(p, vec4(0.0)));\n' +
		'	p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;\n' +
		'\n' +
		'	return p;\n' +
		'	}\n' +
		'\n' +
		// (sqrt(5) - 1)/4 = F4, used once below\n
		'#define F4 0.309016994374947451\n' +
		'\n' +
		'float snoise(vec4 v)\n' +
		'	{\n' +
		'	const vec4 C = vec4(0.138196601125011, // (5 - sqrt(5))/20 G4\n' +
		'						0.276393202250021, // 2 * G4\n' +
		'						0.414589803375032, // 3 * G4\n' +
		'						-0.447213595499958); // -1 + 4 * G4\n' +
		'\n' +
		// First corner
		'	vec4 i = floor(v + dot(v, vec4(F4)));\n' +
		'	vec4 x0 = v - i + dot(i, C.xxxx);\n' +
		'\n' +
		// Other corners
		'\n' +
		// Rank sorting originally contributed by Bill Licea-Kane, AMD (formerly ATI)
		'	vec4 i0;\n' +
		'	vec3 isX = step(x0.yzw, x0.xxx);\n' +
		'	vec3 isYZ = step(x0.zww, x0.yyz);\n' +
		// i0.x = dot(isX, vec3(1.0));
		'	i0.x = isX.x + isX.y + isX.z;\n' +
		'	i0.yzw = 1.0 - isX;\n' +
		// i0.y += dot(isYZ.xy, vec2(1.0));
		'	i0.y += isYZ.x + isYZ.y;\n' +
		'	i0.zw += 1.0 - isYZ.xy;\n' +
		'	i0.z += isYZ.z;\n' +
		'	i0.w += 1.0 - isYZ.z;\n' +
		'\n' +
			// i0 now contains the unique values 0,1,2,3 in each channel
		'	vec4 i3 = clamp(i0, 0.0, 1.0);\n' +
		'	vec4 i2 = clamp(i0-1.0, 0.0, 1.0);\n' +
		'	vec4 i1 = clamp(i0-2.0, 0.0, 1.0);\n' +
		'\n' +
		'	vec4 x1 = x0 - i1 + C.xxxx;\n' +
		'	vec4 x2 = x0 - i2 + C.yyyy;\n' +
		'	vec4 x3 = x0 - i3 + C.zzzz;\n' +
		'	vec4 x4 = x0 + C.wwww;\n' +
		'\n' +
		// Permutations
		'	i = mod289(i);\n' +
		'	float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);\n' +
		'	vec4 j1 = permute(permute(permute(permute (\n' +
		'					i.w + vec4(i1.w, i2.w, i3.w, 1.0))\n' +
		'					+ i.z + vec4(i1.z, i2.z, i3.z, 1.0))\n' +
		'					+ i.y + vec4(i1.y, i2.y, i3.y, 1.0))\n' +
		'					+ i.x + vec4(i1.x, i2.x, i3.x, 1.0));\n' +
		'\n' +
		// Gradients: 7x7x6 points over a cube, mapped onto a 4-cross polytope
		// 7*7*6 = 294, which is close to the ring size 17*17 = 289.
		'	vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;\n' +
		'\n' +
		'	vec4 p0 = grad4(j0, ip);\n' +
		'	vec4 p1 = grad4(j1.x, ip);\n' +
		'	vec4 p2 = grad4(j1.y, ip);\n' +
		'	vec4 p3 = grad4(j1.z, ip);\n' +
		'	vec4 p4 = grad4(j1.w, ip);\n' +
		'\n' +
		// Normalise gradients
		'	vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));\n' +
		'	p0 *= norm.x;\n' +
		'	p1 *= norm.y;\n' +
		'	p2 *= norm.z;\n' +
		'	p3 *= norm.w;\n' +
		'	p4 *= taylorInvSqrt(dot(p4, p4));\n' +
		'\n' +
		// Mix contributions from the five corners
		'	vec3 m0 = max(0.6 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);\n' +
		'	vec2 m1 = max(0.6 - vec2(dot(x3, x3), dot(x4, x4)), 0.0);\n' +
		'	m0 = m0 * m0;\n' +
		'	m1 = m1 * m1;\n' +
		'	return 49.0 * (dot(m0*m0, vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2)))\n' +
		'							+ dot(m1*m1, vec2(dot(p3, x3), dot(p4, x4)))) ;\n' +
		'}\n' +
		'#endif\n';

	return Seriously;

}));

},{}],7:[function(require,module,exports){
/* global define, require */
(function (root, factory) {
	'use strict';

	if (typeof exports === 'object') {
		// Node/CommonJS
		factory(require('../seriously'));
	} else if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['seriously'], factory);
	} else {
		/*
		todo: build out-of-order loading for sources and transforms or remove this
		if (!root.Seriously) {
			root.Seriously = { plugin: function (name, opt) { this[name] = opt; } };
		}
		*/
		factory(root.Seriously);
	}
}(this, function (Seriously, undefined) {
	'use strict';

	var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia,

	// detect browser-prefixed window.URL
	URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

	Seriously.source('camera', function (source, options, force) {
		var me = this,
			video,
			destroyed = false,
			stream;

		function cleanUp() {
			if (video) {
				video.pause();
				video.src = '';
				video.load();
			}

			if (stream && stream.stop) {
				stream.stop();
			}
			stream = null;
		}

		function initialize() {
			if (destroyed) {
				return;
			}

			if (video.videoWidth) {
				me.width = video.videoWidth;
				me.height = video.videoHeight;
				me.setReady();
			} else {
				//Workaround for Firefox bug https://bugzilla.mozilla.org/show_bug.cgi?id=926753
				setTimeout(initialize, 50);
			}
		}

		//todo: support options for video resolution, etc.

		if (force) {
			if (!getUserMedia) {
				throw 'Camera source type unavailable. Browser does not support getUserMedia';
			}

			video = document.createElement('video');

			getUserMedia.call(navigator, {
				video: true
			}, function (s) {
				stream = s;

				if (destroyed) {
					cleanUp();
					return;
				}

				// check for firefox
				if (video.mozCaptureStream) {
					video.mozSrcObject = stream;
				} else {
					video.src = (URL && URL.createObjectURL(stream)) || stream;
				}

				if (video.readyState) {
					initialize();
				} else {
					video.addEventListener('loadedmetadata', initialize, false);
				}

				video.play();
			}, function (evt) {
				//todo: emit error event
				console.log('Unable to access video camera', evt);
			});

			return {
				deferTexture: true,
				source: video,
				render: Object.getPrototypeOf(this).renderVideo,
				destroy: function () {
					destroyed = true;
					cleanUp();
				}
			};
		}
	}, {
		compatible: function () {
			return !!getUserMedia;
		},
		title: 'Camera'
	});
}));

},{"../seriously":6}],8:[function(require,module,exports){
// getUserMedia helper by @HenrikJoreteg
var func = (window.navigator.getUserMedia ||
            window.navigator.webkitGetUserMedia ||
            window.navigator.mozGetUserMedia ||
            window.navigator.msGetUserMedia);


module.exports = function (constraints, cb) {
    var options;
    var haveOpts = arguments.length === 2;
    var defaultOpts = {video: true, audio: true};
    var error;
    var denied = 'PERMISSION_DENIED';
    var notSatified = 'CONSTRAINT_NOT_SATISFIED';

    // make constraints optional
    if (!haveOpts) {
        cb = constraints;
        constraints = defaultOpts;
    }

    // treat lack of browser support like an error
    if (!func) {
        // throw proper error per spec
        error = new Error('NavigatorUserMediaError');
        error.name = 'NOT_SUPPORTED_ERROR';
        return cb(error);
    }

    func.call(window.navigator, constraints, function (stream) {
        cb(null, stream);
    }, function (err) {
        var error;
        // coerce into an error object since FF gives us a string
        // there are only two valid names according to the spec
        // we coerce all non-denied to "constraint not satisfied".
        if (typeof err === 'string') {
            error = new Error('NavigatorUserMediaError');
            if (err === denied) {
                error.name = denied;
            } else {
                error.name = notSatified;
            }
        } else {
            // if we get an error object make sure '.name' property is set
            // according to spec: http://dev.w3.org/2011/webrtc/editor/getusermedia.html#navigatorusermediaerror-and-navigatorusermediaerrorcallback
            error = err;
            if (!error.name) {
                // this is likely chrome which
                // sets a property called "ERROR_DENIED" on the error object
                // if so we make sure to set a name
                if (error[denied]) {
                    err.name = denied;
                } else {
                    err.name = notSatified;
                }
            }
        }

        cb(error);
    });
};

},{}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvam9oYW4vcHJvamVjdHMvanMvaGl0ZW1wby9icm93c2VyL2luZGV4LmpzIiwiL1VzZXJzL2pvaGFuL3Byb2plY3RzL2pzL2hpdGVtcG8vYnJvd3Nlci9saWIvZWZmZWN0cy9zZXJpb3VzbHkuYmxlbmQuanMiLCIvVXNlcnMvam9oYW4vcHJvamVjdHMvanMvaGl0ZW1wby9icm93c2VyL2xpYi9lZmZlY3RzL3NlcmlvdXNseS5lZGdlLmpzIiwiL1VzZXJzL2pvaGFuL3Byb2plY3RzL2pzL2hpdGVtcG8vYnJvd3Nlci9saWIvZWZmZWN0cy9zZXJpb3VzbHkuaHVlLXNhdHVyYXRpb24uanMiLCIvVXNlcnMvam9oYW4vcHJvamVjdHMvanMvaGl0ZW1wby9icm93c2VyL2xpYi9lZmZlY3RzL3NlcmlvdXNseS50dmdsaXRjaC5qcyIsIi9Vc2Vycy9qb2hhbi9wcm9qZWN0cy9qcy9oaXRlbXBvL2Jyb3dzZXIvbGliL3NlcmlvdXNseS5qcyIsIi9Vc2Vycy9qb2hhbi9wcm9qZWN0cy9qcy9oaXRlbXBvL2Jyb3dzZXIvbGliL3NvdXJjZXMvc2VyaW91c2x5LmNhbWVyYS5qcyIsIi9Vc2Vycy9qb2hhbi9wcm9qZWN0cy9qcy9oaXRlbXBvL25vZGVfbW9kdWxlcy9nZXR1c2VybWVkaWEvaW5kZXgtYnJvd3Nlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1WkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeHNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbInZhciBnZXRVc2VyTWVkaWEgPSByZXF1aXJlKCdnZXR1c2VybWVkaWEnKTtcbnZhciBTZXJpb3VzbHkgPSByZXF1aXJlKCcuL2xpYi9zZXJpb3VzbHknKTtcbndpbmRvdy5TZXJpb3VzbHkgPSBTZXJpb3VzbHk7XG5yZXF1aXJlKCcuL2xpYi9zb3VyY2VzL3NlcmlvdXNseS5jYW1lcmEuanMnKTtcbnJlcXVpcmUoJy4vbGliL2VmZmVjdHMvc2VyaW91c2x5LmVkZ2UuanMnKTtcbnJlcXVpcmUoJy4vbGliL2VmZmVjdHMvc2VyaW91c2x5LmJsZW5kLmpzJyk7XG5yZXF1aXJlKCcuL2xpYi9lZmZlY3RzL3NlcmlvdXNseS50dmdsaXRjaC5qcycpO1xucmVxdWlyZSgnLi9saWIvZWZmZWN0cy9zZXJpb3VzbHkuaHVlLXNhdHVyYXRpb24uanMnKTtcbi8vcmVxdWlyZSgnLi9saWIvZWZmZWN0cy9zZXJpb3VzbHkuY29sb3IuanMnKTtcblxudmFyIHNlcmlvdXNseSA9IG5ldyBTZXJpb3VzbHkoKTtcblxuLy92YXIgc291cmNlID0gc2VyaW91c2x5LnNvdXJjZSgnY2FtZXJhJyk7XG52YXIgdmlkZW9Tb3VyY2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndmlkZW8nKTtcbnZhciB0YXJnZXQgPSBzZXJpb3VzbHkudGFyZ2V0KCcjdGFyZ2V0Jyk7XG5cbnZhciBpbnZhc2lvbiA9IHtcbiAgYmxlbmQ6IHNlcmlvdXNseS5lZmZlY3QoJ2JsZW5kJyksXG4gIHR2OiBzZXJpb3VzbHkuZWZmZWN0KCd0dmdsaXRjaCcpLFxuICBibGFja3doaXRlOiBzZXJpb3VzbHkuZWZmZWN0KCdodWUtc2F0dXJhdGlvbicpXG59O1xuLy9pbnZhc2lvbi5ibGVuZC50b3AgPSBjaHJvbWE7XG4vL2ludmFzaW9uLmJsZW5kLmJvdHRvbSA9IGltYWdlcy5jdXJ0YWluO1xuLy9pbnZhc2lvbi5ibGFja3doaXRlLnNvdXJjZSA9IGludmFzaW9uLmJsZW5kO1xuaW52YXNpb24uYmxhY2t3aGl0ZS5zYXR1cmF0aW9uID0gLTE7XG5cbmludmFzaW9uLnR2LnNvdXJjZSA9IGludmFzaW9uLmJsYWNrd2hpdGU7XG5pbnZhc2lvbi50di5kaXN0b3J0aW9uID0gMC4wMztcbmludmFzaW9uLnR2LnZlcnRpY2FsU3luYyA9IDA7XG5pbnZhc2lvbi50di5zY2FubGluZXMgPSAwLjE7XG5pbnZhc2lvbi50di5saW5lU3luYyA9IDAuMDM7XG5pbnZhc2lvbi50di5mcmFtZVNoYXJwbmVzcyA9IDEwLjY3O1xuaW52YXNpb24udHYuZnJhbWVTaGFwZSA9IDA7XG5pbnZhc2lvbi50di5mcmFtZUxpbWl0ID0gMDtcbmludmFzaW9uLnR2LmJhcnMgPSAwLjAzO1xuXG4vKlxudmFyIGNvbG9yID0gc2VyaW91c2x5LmVmZmVjdCgnY29sb3InKTtcbmNvbG9yLmNvbG9yID0gXCIjZTUwMDAwXCI7XG5jb2xvci5zb3VyY2UgPSBpbnZhc2lvbi50djtcbiovXG4vLyBDb25uZWN0IG5vZGUgaW4gdGhlIHJpZ2h0IG9yZGVyXG4vL2VkZ2Uuc291cmNlID0gc291cmNlO1xuXG5mdW5jdGlvbiByZXNpemUoKSB7XG4gIHRhcmdldC53aWR0aCA9IHZpZGVvU291cmNlLnZpZGVvV2lkdGg7XG4gIHRhcmdldC5oZWlnaHQgPSB2aWRlb1NvdXJjZS52aWRlb0hlaWdodDtcbn1cblxuZ2V0VXNlck1lZGlhKHt2aWRlbzogdHJ1ZX0sIGZ1bmN0aW9uIChlcnIsIHN0cmVhbSkge1xuICBpZiAod2luZG93LndlYmtpdFVSTCkge1xuICAgIHZpZGVvU291cmNlLnNyYyA9IHdpbmRvdy53ZWJraXRVUkwuY3JlYXRlT2JqZWN0VVJMKHN0cmVhbSk7XG4gIH0gZWxzZSB7XG4gICAgdmlkZW9Tb3VyY2Uuc3JjID0gc3RyZWFtO1xuICB9XG5cbiAgdmlkZW9Tb3VyY2UucGxheSgpO1xuICBpZiAodmlkZW9Tb3VyY2UudmlkZW9XaWR0aCkge1xuICAgIHJlc2l6ZSgpO1xuICB9XG4gIHZpZGVvU291cmNlLm9ubG9hZGVkbWV0YWRhdGEgPSB2aWRlb1NvdXJjZS5vbnBsYXkgPSByZXNpemU7XG4gIGludmFzaW9uLmJsYWNrd2hpdGUuc291cmNlID0gdmlkZW9Tb3VyY2U7XG4gIC8vaW52YXNpb24udHYuc291cmNlID0gdmlkZW9Tb3VyY2U7XG4gIC8vdGFyZ2V0LnNvdXJjZSA9IHZpZGVvU291cmNlO1xuICB0YXJnZXQuc291cmNlID0gaW52YXNpb24udHY7XG4gIC8vdGFyZ2V0LnNvdXJjZSA9IGNvbG9yLnNvdXJjZTtcbn0pO1xuXG5zZXJpb3VzbHkuZ28oKTtcblxuY29uc29sZS5sb2coJ2dvJyk7XG5cblxuXG5cblxuIiwiLyogZ2xvYmFsIGRlZmluZSwgcmVxdWlyZSAqL1xuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHRpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG5cdFx0Ly8gTm9kZS9Db21tb25KU1xuXHRcdGZhY3RvcnkocmVxdWlyZSgnLi4vc2VyaW91c2x5JykpO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuXHRcdC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cblx0XHRkZWZpbmUoWydzZXJpb3VzbHknXSwgZmFjdG9yeSk7XG5cdH0gZWxzZSB7XG5cdFx0aWYgKCFyb290LlNlcmlvdXNseSkge1xuXHRcdFx0cm9vdC5TZXJpb3VzbHkgPSB7IHBsdWdpbjogZnVuY3Rpb24gKG5hbWUsIG9wdCkgeyB0aGlzW25hbWVdID0gb3B0OyB9IH07XG5cdFx0fVxuXHRcdGZhY3Rvcnkocm9vdC5TZXJpb3VzbHkpO1xuXHR9XG59KHRoaXMsIGZ1bmN0aW9uIChTZXJpb3VzbHksIHVuZGVmaW5lZCkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0Lypcblx0dG9kbzogZm9yIHByb3RvdHlwZSB2ZXJzaW9uLCBibGVuZCBvbmx5IGhhbmRsZXMgdHdvIGxheWVycy4gdGhpcyBzaG91bGQgaGFuZGxlIG11bHRpcGxlIGxheWVycz9cblx0dG9kbzogaWYgdHJhbnNmb3JtcyBhcmUgdXNlZCwgZG8gbXVsdGlwbGUgcGFzc2VzIGFuZCBlbmFibGUgZGVwdGggdGVzdGluZz9cblx0dG9kbzogZm9yIG5vdywgb25seSBzdXBwb3J0aW5nIGZsb2F0IGJsZW5kIG1vZGVzLiBBZGQgY29tcGxleCBvbmVzXG5cdHRvZG86IGFwcGx5IHByb3BlciBjcmVkaXQgYW5kIGxpY2Vuc2VcblxuXHQqKiBSb21haW4gRHVyYSB8IFJvbXpcblx0KiogQmxvZzogaHR0cDovL2Jsb2cubW91YWlmLm9yZ1xuXHQqKiBQb3N0OiBodHRwOi8vYmxvZy5tb3VhaWYub3JnLz9wPTk0XG5cblx0Ki9cblx0dmFyIG1vZGVzID0ge1xuXHRcdCdub3JtYWwnOiAnQmxlbmROb3JtYWwnLFxuXHRcdCdsaWdodGVuJzogJ0JsZW5kTGlnaHRlbicsXG5cdFx0J2Rhcmtlbic6ICdCbGVuZERhcmtlbicsXG5cdFx0J211bHRpcGx5JzogJ0JsZW5kTXVsdGlwbHknLFxuXHRcdCdhdmVyYWdlJzogJ0JsZW5kQXZlcmFnZScsXG5cdFx0J2FkZCc6ICdCbGVuZEFkZCcsXG5cdFx0J3N1YnRyYWN0JzogJ0JsZW5kU3VidHJhY3QnLFxuXHRcdCdkaWZmZXJlbmNlJzogJ0JsZW5kRGlmZmVyZW5jZScsXG5cdFx0J25lZ2F0aW9uJzogJ0JsZW5kTmVnYXRpb24nLFxuXHRcdCdleGNsdXNpb24nOiAnQmxlbmRFeGNsdXNpb24nLFxuXHRcdCdzY3JlZW4nOiAnQmxlbmRTY3JlZW4nLFxuXHRcdCdvdmVybGF5JzogJ0JsZW5kT3ZlcmxheScsXG5cdFx0J3NvZnRsaWdodCc6ICdCbGVuZFNvZnRMaWdodCcsXG5cdFx0J2hhcmRsaWdodCc6ICdCbGVuZEhhcmRMaWdodCcsXG5cdFx0J2NvbG9yZG9kZ2UnOiAnQmxlbmRDb2xvckRvZGdlJyxcblx0XHQnY29sb3JidXJuJzogJ0JsZW5kQ29sb3JCdXJuJyxcblx0XHQnbGluZWFyZG9kZ2UnOiAnQmxlbmRMaW5lYXJEb2RnZScsXG5cdFx0J2xpbmVhcmJ1cm4nOiAnQmxlbmRMaW5lYXJCdXJuJyxcblx0XHQnbGluZWFybGlnaHQnOiAnQmxlbmRMaW5lYXJMaWdodCcsXG5cdFx0J3ZpdmlkbGlnaHQnOiAnQmxlbmRWaXZpZExpZ2h0Jyxcblx0XHQncGlubGlnaHQnOiAnQmxlbmRQaW5MaWdodCcsXG5cdFx0J2hhcmRtaXgnOiAnQmxlbmRIYXJkTWl4Jyxcblx0XHQncmVmbGVjdCc6ICdCbGVuZFJlZmxlY3QnLFxuXHRcdCdnbG93JzogJ0JsZW5kR2xvdycsXG5cdFx0J3Bob2VuaXgnOiAnQmxlbmRQaG9lbml4J1xuXHR9LFxuXHRuYXRpdmVCbGVuZE1vZGVzID0ge1xuXHRcdG5vcm1hbDogWydGVU5DX0FERCcsICdTUkNfQUxQSEEnLCAnT05FX01JTlVTX1NSQ19BTFBIQScsICdTUkNfQUxQSEEnLCAnRFNUX0FMUEhBJ10vKixcblx0XHRhZGQ6IFsnRlVOQ19BREQnLCAnU1JDX0FMUEhBJywgJ09ORV9NSU5VU19TUkNfQUxQSEEnLCAnU1JDX0FMUEhBJywgJ0RTVF9BTFBIQSddKi9cblx0fSxcblx0aWRlbnRpdHkgPSBuZXcgRmxvYXQzMkFycmF5KFtcblx0XHQxLCAwLCAwLCAwLFxuXHRcdDAsIDEsIDAsIDAsXG5cdFx0MCwgMCwgMSwgMCxcblx0XHQwLCAwLCAwLCAxXG5cdF0pO1xuXG5cdFNlcmlvdXNseS5wbHVnaW4oJ2JsZW5kJywgZnVuY3Rpb24gKCkge1xuXHRcdHZhciB0b3BVbmlmb3Jtcyxcblx0XHRcdGJvdHRvbVVuaWZvcm1zLFxuXHRcdFx0dG9wT3B0cyA9IHtcblx0XHRcdFx0Y2xlYXI6IGZhbHNlXG5cdFx0XHR9O1xuXG5cdFx0Ly8gY3VzdG9tIHJlc2l6ZSBtZXRob2Rcblx0XHR0aGlzLnJlc2l6ZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciB3aWR0aCxcblx0XHRcdFx0aGVpZ2h0LFxuXHRcdFx0XHRtb2RlID0gdGhpcy5pbnB1dHMuc2l6ZU1vZGUsXG5cdFx0XHRcdG5vZGUsXG5cdFx0XHRcdGZuLFxuXHRcdFx0XHRpLFxuXHRcdFx0XHRib3R0b20gPSB0aGlzLmlucHV0cy5ib3R0b20sXG5cdFx0XHRcdHRvcCA9IHRoaXMuaW5wdXRzLnRvcDtcblxuXHRcdFx0aWYgKG1vZGUgPT09ICdib3R0b20nIHx8IG1vZGUgPT09ICd0b3AnKSB7XG5cdFx0XHRcdG5vZGUgPSB0aGlzLmlucHV0c1ttb2RlXTtcblx0XHRcdFx0aWYgKG5vZGUpIHtcblx0XHRcdFx0XHR3aWR0aCA9IG5vZGUud2lkdGg7XG5cdFx0XHRcdFx0aGVpZ2h0ID0gbm9kZS5oZWlnaHQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0d2lkdGggPSAxO1xuXHRcdFx0XHRcdGhlaWdodCA9IDE7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChib3R0b20pIHtcblx0XHRcdFx0XHRpZiAodG9wKSB7XG5cdFx0XHRcdFx0XHRmbiA9IChtb2RlID09PSAndW5pb24nID8gTWF0aC5tYXggOiBNYXRoLm1pbik7XG5cdFx0XHRcdFx0XHR3aWR0aCA9IGZuKGJvdHRvbS53aWR0aCwgdG9wLndpZHRoKTtcblx0XHRcdFx0XHRcdGhlaWdodCA9IGZuKGJvdHRvbS5oZWlnaHQsIHRvcC5oZWlnaHQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR3aWR0aCA9IGJvdHRvbS53aWR0aDtcblx0XHRcdFx0XHRcdGhlaWdodCA9IGJvdHRvbS5oZWlnaHQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKHRvcCkge1xuXHRcdFx0XHRcdHdpZHRoID0gdG9wLndpZHRoO1xuXHRcdFx0XHRcdGhlaWdodCA9IHRvcC5oZWlnaHQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0d2lkdGggPSAxO1xuXHRcdFx0XHRcdGhlaWdodCA9IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMud2lkdGggIT09IHdpZHRoIHx8IHRoaXMuaGVpZ2h0ICE9PSBoZWlnaHQpIHtcblx0XHRcdFx0dGhpcy53aWR0aCA9IHdpZHRoO1xuXHRcdFx0XHR0aGlzLmhlaWdodCA9IGhlaWdodDtcblxuXHRcdFx0XHR0aGlzLnVuaWZvcm1zLnJlc29sdXRpb25bMF0gPSB3aWR0aDtcblx0XHRcdFx0dGhpcy51bmlmb3Jtcy5yZXNvbHV0aW9uWzFdID0gaGVpZ2h0O1xuXG5cdFx0XHRcdGlmICh0aGlzLmZyYW1lQnVmZmVyKSB7XG5cdFx0XHRcdFx0dGhpcy5mcmFtZUJ1ZmZlci5yZXNpemUod2lkdGgsIGhlaWdodCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmVtaXQoJ3Jlc2l6ZScpO1xuXHRcdFx0XHR0aGlzLnNldERpcnR5KCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0b3BVbmlmb3Jtcykge1xuXHRcdFx0XHRpZiAoYm90dG9tKSB7XG5cdFx0XHRcdFx0Ym90dG9tVW5pZm9ybXMucmVzb2x1dGlvblswXSA9IGJvdHRvbS53aWR0aDtcblx0XHRcdFx0XHRib3R0b21Vbmlmb3Jtcy5yZXNvbHV0aW9uWzFdID0gYm90dG9tLmhlaWdodDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodG9wKSB7XG5cdFx0XHRcdFx0dG9wVW5pZm9ybXMucmVzb2x1dGlvblswXSA9IHRvcC53aWR0aDtcblx0XHRcdFx0XHR0b3BVbmlmb3Jtcy5yZXNvbHV0aW9uWzFdID0gdG9wLmhlaWdodDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGkgPSAwOyBpIDwgdGhpcy50YXJnZXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHRoaXMudGFyZ2V0c1tpXS5yZXNpemUoKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNoYWRlcjogZnVuY3Rpb24gKGlucHV0cywgc2hhZGVyU291cmNlKSB7XG5cdFx0XHRcdHZhciBtb2RlID0gaW5wdXRzLm1vZGUgfHwgJ25vcm1hbCcsXG5cdFx0XHRcdFx0bm9kZTtcblx0XHRcdFx0bW9kZSA9IG1vZGUudG9Mb3dlckNhc2UoKTtcblxuXHRcdFx0XHRpZiAobmF0aXZlQmxlbmRNb2Rlc1ttb2RlXSkge1xuXHRcdFx0XHRcdC8vdG9kbzogbW92ZSB0aGlzIHRvIGFuICd1cGRhdGUnIGV2ZW50IGZvciAnbW9kZScgaW5wdXRcblx0XHRcdFx0XHRpZiAoIXRvcFVuaWZvcm1zKSB7XG5cdFx0XHRcdFx0XHRub2RlID0gdGhpcy5pbnB1dHMudG9wO1xuXHRcdFx0XHRcdFx0dG9wVW5pZm9ybXMgPSB7XG5cdFx0XHRcdFx0XHRcdHJlc29sdXRpb246IFtcblx0XHRcdFx0XHRcdFx0XHRub2RlICYmIG5vZGUud2lkdGggfHwgMSxcblx0XHRcdFx0XHRcdFx0XHRub2RlICYmIG5vZGUuaGVpZ2h0IHx8IDFcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0dGFyZ2V0UmVzOiB0aGlzLnVuaWZvcm1zLnJlc29sdXRpb24sXG5cdFx0XHRcdFx0XHRcdHNvdXJjZTogbm9kZSxcblx0XHRcdFx0XHRcdFx0dHJhbnNmb3JtOiBub2RlICYmIG5vZGUuY3VtdWxhdGl2ZU1hdHJpeCB8fCBpZGVudGl0eSxcblx0XHRcdFx0XHRcdFx0b3BhY2l0eTogMVxuXHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0bm9kZSA9IHRoaXMuaW5wdXRzLmJvdHRvbTtcblx0XHRcdFx0XHRcdGJvdHRvbVVuaWZvcm1zID0ge1xuXHRcdFx0XHRcdFx0XHRyZXNvbHV0aW9uOiBbXG5cdFx0XHRcdFx0XHRcdFx0bm9kZSAmJiBub2RlLndpZHRoIHx8IDEsXG5cdFx0XHRcdFx0XHRcdFx0bm9kZSAmJiBub2RlLmhlaWdodCB8fCAxXG5cdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdHRhcmdldFJlczogdGhpcy51bmlmb3Jtcy5yZXNvbHV0aW9uLFxuXHRcdFx0XHRcdFx0XHRzb3VyY2U6IG5vZGUsXG5cdFx0XHRcdFx0XHRcdHRyYW5zZm9ybTogbm9kZSAmJiBub2RlLmN1bXVsYXRpdmVNYXRyaXggfHwgaWRlbnRpdHksXG5cdFx0XHRcdFx0XHRcdG9wYWNpdHk6IDFcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0c2hhZGVyU291cmNlLnZlcnRleCA9IFtcblx0XHRcdFx0XHRcdCdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuXG5cdFx0XHRcdFx0XHQnYXR0cmlidXRlIHZlYzQgcG9zaXRpb247Jyxcblx0XHRcdFx0XHRcdCdhdHRyaWJ1dGUgdmVjMiB0ZXhDb29yZDsnLFxuXG5cdFx0XHRcdFx0XHQndW5pZm9ybSB2ZWMyIHJlc29sdXRpb247Jyxcblx0XHRcdFx0XHRcdCd1bmlmb3JtIHZlYzIgdGFyZ2V0UmVzOycsXG5cdFx0XHRcdFx0XHQndW5pZm9ybSBtYXQ0IHRyYW5zZm9ybTsnLFxuXG5cdFx0XHRcdFx0XHQndmFyeWluZyB2ZWMyIHZUZXhDb29yZDsnLFxuXHRcdFx0XHRcdFx0J3ZhcnlpbmcgdmVjNCB2UG9zaXRpb247JyxcblxuXHRcdFx0XHRcdFx0J3ZvaWQgbWFpbih2b2lkKSB7Jyxcblx0XHRcdFx0XHRcdC8vIGZpcnN0IGNvbnZlcnQgdG8gc2NyZWVuIHNwYWNlXG5cdFx0XHRcdFx0XHQnXHR2ZWM0IHNjcmVlblBvc2l0aW9uID0gdmVjNChwb3NpdGlvbi54eSAqIHJlc29sdXRpb24gLyAyLjAsIHBvc2l0aW9uLnosIHBvc2l0aW9uLncpOycsXG5cdFx0XHRcdFx0XHQnXHRzY3JlZW5Qb3NpdGlvbiA9IHRyYW5zZm9ybSAqIHNjcmVlblBvc2l0aW9uOycsXG5cblx0XHRcdFx0XHRcdC8vIGNvbnZlcnQgYmFjayB0byBPcGVuR0wgY29vcmRzXG5cdFx0XHRcdFx0XHQnXHRnbF9Qb3NpdGlvbi54eSA9IHNjcmVlblBvc2l0aW9uLnh5ICogMi4wIC8gcmVzb2x1dGlvbjsnLFxuXHRcdFx0XHRcdFx0J1x0Z2xfUG9zaXRpb24ueiA9IHNjcmVlblBvc2l0aW9uLnogKiAyLjAgLyAocmVzb2x1dGlvbi54IC8gcmVzb2x1dGlvbi55KTsnLFxuXHRcdFx0XHRcdFx0J1x0Z2xfUG9zaXRpb24ueHkgKj0gcmVzb2x1dGlvbiAvIHRhcmdldFJlczsnLFxuXHRcdFx0XHRcdFx0J1x0Z2xfUG9zaXRpb24udyA9IHNjcmVlblBvc2l0aW9uLnc7Jyxcblx0XHRcdFx0XHRcdCdcdHZUZXhDb29yZCA9IHRleENvb3JkOycsXG5cdFx0XHRcdFx0XHQnXHR2UG9zaXRpb24gPSBnbF9Qb3NpdGlvbjsnLFxuXHRcdFx0XHRcdFx0J31cXG4nXG5cdFx0XHRcdFx0XS5qb2luKCdcXG4nKTtcblxuXHRcdFx0XHRcdHNoYWRlclNvdXJjZS5mcmFnbWVudCA9IFtcblx0XHRcdFx0XHRcdCdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuXHRcdFx0XHRcdFx0J3ZhcnlpbmcgdmVjMiB2VGV4Q29vcmQ7Jyxcblx0XHRcdFx0XHRcdCd2YXJ5aW5nIHZlYzQgdlBvc2l0aW9uOycsXG5cdFx0XHRcdFx0XHQndW5pZm9ybSBzYW1wbGVyMkQgc291cmNlOycsXG5cdFx0XHRcdFx0XHQndW5pZm9ybSBmbG9hdCBvcGFjaXR5OycsXG5cdFx0XHRcdFx0XHQndm9pZCBtYWluKHZvaWQpIHsnLFxuXHRcdFx0XHRcdFx0J1x0Z2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHNvdXJjZSwgdlRleENvb3JkKTsnLFxuXHRcdFx0XHRcdFx0J1x0Z2xfRnJhZ0NvbG9yLmEgKj0gb3BhY2l0eTsnLFxuXHRcdFx0XHRcdFx0J30nXG5cdFx0XHRcdFx0XS5qb2luKCdcXG4nKTtcblxuXHRcdFx0XHRcdHJldHVybiBzaGFkZXJTb3VyY2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0b3BVbmlmb3JtcyA9IG51bGw7XG5cdFx0XHRcdGJvdHRvbVVuaWZvcm1zID0gbnVsbDtcblxuXHRcdFx0XHRtb2RlID0gbW9kZXNbbW9kZV0gfHwgJ0JsZW5kTm9ybWFsJztcblx0XHRcdFx0c2hhZGVyU291cmNlLmZyYWdtZW50ID0gJyNkZWZpbmUgQmxlbmRGdW5jdGlvbiAnICsgbW9kZSArICdcXG4nICtcblx0XHRcdFx0XHQnI2lmZGVmIEdMX0VTXFxuXFxuJyArXG5cdFx0XHRcdFx0J3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbicgK1xuXHRcdFx0XHRcdCcjZW5kaWZcXG5cXG4nICtcblx0XHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRMaW5lYXJEb2RnZWZcdFx0XHRcdEJsZW5kQWRkZlxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kTGluZWFyQnVybmZcdFx0XHRcdEJsZW5kU3VidHJhY3RmXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRBZGRmKGJhc2UsIGJsZW5kKVx0XHRcdG1pbihiYXNlICsgYmxlbmQsIDEuMClcXG4nICtcblx0XHRcdFx0XHQnI2RlZmluZSBCbGVuZFN1YnRyYWN0ZihiYXNlLCBibGVuZClcdG1heChiYXNlICsgYmxlbmQgLSAxLjAsIDAuMClcXG4nICtcblx0XHRcdFx0XHQnI2RlZmluZSBCbGVuZExpZ2h0ZW5mKGJhc2UsIGJsZW5kKVx0XHRtYXgoYmxlbmQsIGJhc2UpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmREYXJrZW5mKGJhc2UsIGJsZW5kKVx0XHRtaW4oYmxlbmQsIGJhc2UpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRMaW5lYXJMaWdodGYoYmFzZSwgYmxlbmQpXHQoYmxlbmQgPCAwLjUgPyBCbGVuZExpbmVhckJ1cm5mKGJhc2UsICgyLjAgKiBibGVuZCkpIDogQmxlbmRMaW5lYXJEb2RnZWYoYmFzZSwgKDIuMCAqIChibGVuZCAtIDAuNSkpKSlcXG4nICtcblx0XHRcdFx0XHQnI2RlZmluZSBCbGVuZFNjcmVlbmYoYmFzZSwgYmxlbmQpXHRcdCgxLjAgLSAoKDEuMCAtIGJhc2UpICogKDEuMCAtIGJsZW5kKSkpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRPdmVybGF5ZihiYXNlLCBibGVuZClcdFx0KGJhc2UgPCAwLjUgPyAoMi4wICogYmFzZSAqIGJsZW5kKSA6ICgxLjAgLSAyLjAgKiAoMS4wIC0gYmFzZSkgKiAoMS4wIC0gYmxlbmQpKSlcXG4nICtcblx0XHRcdFx0XHQnI2RlZmluZSBCbGVuZFNvZnRMaWdodGYoYmFzZSwgYmxlbmQpXHQoKGJsZW5kIDwgMC41KSA/ICgyLjAgKiBiYXNlICogYmxlbmQgKyBiYXNlICogYmFzZSAqICgxLjAgLSAyLjAgKiBibGVuZCkpIDogKHNxcnQoYmFzZSkgKiAoMi4wICogYmxlbmQgLSAxLjApICsgMi4wICogYmFzZSAqICgxLjAgLSBibGVuZCkpKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kQ29sb3JEb2RnZWYoYmFzZSwgYmxlbmQpXHQoKGJsZW5kID09IDEuMCkgPyBibGVuZCA6IG1pbihiYXNlIC8gKDEuMCAtIGJsZW5kKSwgMS4wKSlcXG4nICtcblx0XHRcdFx0XHQnI2RlZmluZSBCbGVuZENvbG9yQnVybmYoYmFzZSwgYmxlbmQpXHQoKGJsZW5kID09IDAuMCkgPyBibGVuZCA6IG1heCgoMS4wIC0gKCgxLjAgLSBiYXNlKSAvIGJsZW5kKSksIDAuMCkpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRWaXZpZExpZ2h0ZihiYXNlLCBibGVuZClcdCgoYmxlbmQgPCAwLjUpID8gQmxlbmRDb2xvckJ1cm5mKGJhc2UsICgyLjAgKiBibGVuZCkpIDogQmxlbmRDb2xvckRvZGdlZihiYXNlLCAoMi4wICogKGJsZW5kIC0gMC41KSkpKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kUGluTGlnaHRmKGJhc2UsIGJsZW5kKVx0KChibGVuZCA8IDAuNSkgPyBCbGVuZERhcmtlbmYoYmFzZSwgKDIuMCAqIGJsZW5kKSkgOiBCbGVuZExpZ2h0ZW5mKGJhc2UsICgyLjAgKihibGVuZCAtIDAuNSkpKSlcXG4nICtcblx0XHRcdFx0XHQnI2RlZmluZSBCbGVuZEhhcmRNaXhmKGJhc2UsIGJsZW5kKVx0XHQoKEJsZW5kVml2aWRMaWdodGYoYmFzZSwgYmxlbmQpIDwgMC41KSA/IDAuMCA6IDEuMClcXG4nICtcblx0XHRcdFx0XHQnI2RlZmluZSBCbGVuZFJlZmxlY3RmKGJhc2UsIGJsZW5kKVx0XHQoKGJsZW5kID09IDEuMCkgPyBibGVuZCA6IG1pbihiYXNlICogYmFzZSAvICgxLjAgLSBibGVuZCksIDEuMCkpXFxuJyArXG5cdFx0XHRcdFx0Lypcblx0XHRcdFx0XHQqKiBWZWN0b3IzIGJsZW5kaW5nIG1vZGVzXG5cdFx0XHRcdFx0Ki9cblxuXHRcdFx0XHRcdC8vIENvbXBvbmVudCB3aXNlIGJsZW5kaW5nXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmQoYmFzZSwgYmxlbmQsIGZ1bmNmKVx0XHR2ZWMzKGZ1bmNmKGJhc2UuciwgYmxlbmQuciksIGZ1bmNmKGJhc2UuZywgYmxlbmQuZyksIGZ1bmNmKGJhc2UuYiwgYmxlbmQuYikpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmROb3JtYWwoYmFzZSwgYmxlbmQpXHRcdChibGVuZClcXG4nICtcblx0XHRcdFx0XHQnI2RlZmluZSBCbGVuZExpZ2h0ZW5cdFx0XHRcdFx0QmxlbmRMaWdodGVuZlxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kRGFya2VuXHRcdFx0XHRcdEJsZW5kRGFya2VuZlxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kTXVsdGlwbHkoYmFzZSwgYmxlbmQpXHRcdChiYXNlICogYmxlbmQpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRBdmVyYWdlKGJhc2UsIGJsZW5kKVx0XHQoKGJhc2UgKyBibGVuZCkgLyAyLjApXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRBZGQoYmFzZSwgYmxlbmQpXHRcdFx0bWluKGJhc2UgKyBibGVuZCwgdmVjMygxLjApKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kU3VidHJhY3QoYmFzZSwgYmxlbmQpXHRtYXgoYmFzZSArIGJsZW5kIC0gdmVjMygxLjApLCB2ZWMzKDAuMCkpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmREaWZmZXJlbmNlKGJhc2UsIGJsZW5kKVx0YWJzKGJhc2UgLSBibGVuZClcXG4nICtcblx0XHRcdFx0XHQnI2RlZmluZSBCbGVuZE5lZ2F0aW9uKGJhc2UsIGJsZW5kKVx0XHQodmVjMygxLjApIC0gYWJzKHZlYzMoMS4wKSAtIGJhc2UgLSBibGVuZCkpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRFeGNsdXNpb24oYmFzZSwgYmxlbmQpXHQoYmFzZSArIGJsZW5kIC0gMi4wICogYmFzZSAqIGJsZW5kKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kU2NyZWVuKGJhc2UsIGJsZW5kKVx0XHRCbGVuZChiYXNlLCBibGVuZCwgQmxlbmRTY3JlZW5mKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kT3ZlcmxheShiYXNlLCBibGVuZClcdFx0QmxlbmQoYmFzZSwgYmxlbmQsIEJsZW5kT3ZlcmxheWYpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRTb2Z0TGlnaHQoYmFzZSwgYmxlbmQpXHRCbGVuZChiYXNlLCBibGVuZCwgQmxlbmRTb2Z0TGlnaHRmKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kSGFyZExpZ2h0KGJhc2UsIGJsZW5kKVx0QmxlbmRPdmVybGF5KGJsZW5kLCBiYXNlKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kQ29sb3JEb2RnZShiYXNlLCBibGVuZClcdEJsZW5kKGJhc2UsIGJsZW5kLCBCbGVuZENvbG9yRG9kZ2VmKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kQ29sb3JCdXJuKGJhc2UsIGJsZW5kKVx0QmxlbmQoYmFzZSwgYmxlbmQsIEJsZW5kQ29sb3JCdXJuZilcXG4nICtcblx0XHRcdFx0XHQnI2RlZmluZSBCbGVuZExpbmVhckRvZGdlXHRcdFx0XHRCbGVuZEFkZFxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kTGluZWFyQnVyblx0XHRcdFx0QmxlbmRTdWJ0cmFjdFxcbicgK1xuXHRcdFx0XHRcdC8vIExpbmVhciBMaWdodCBpcyBhbm90aGVyIGNvbnRyYXN0LWluY3JlYXNpbmcgbW9kZVxuXHRcdFx0XHRcdC8vIElmIHRoZSBibGVuZCBjb2xvciBpcyBkYXJrZXIgdGhhbiBtaWRncmF5LCBMaW5lYXIgTGlnaHQgZGFya2VucyB0aGUgaW1hZ2UgYnkgZGVjcmVhc2luZyB0aGUgYnJpZ2h0bmVzcy4gSWYgdGhlIGJsZW5kIGNvbG9yIGlzIGxpZ2h0ZXIgdGhhbiBtaWRncmF5LCB0aGUgcmVzdWx0IGlzIGEgYnJpZ2h0ZXIgaW1hZ2UgZHVlIHRvIGluY3JlYXNlZCBicmlnaHRuZXNzLlxuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kTGluZWFyTGlnaHQoYmFzZSwgYmxlbmQpXHRCbGVuZChiYXNlLCBibGVuZCwgQmxlbmRMaW5lYXJMaWdodGYpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRWaXZpZExpZ2h0KGJhc2UsIGJsZW5kKVx0QmxlbmQoYmFzZSwgYmxlbmQsIEJsZW5kVml2aWRMaWdodGYpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRQaW5MaWdodChiYXNlLCBibGVuZClcdFx0QmxlbmQoYmFzZSwgYmxlbmQsIEJsZW5kUGluTGlnaHRmKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kSGFyZE1peChiYXNlLCBibGVuZClcdFx0QmxlbmQoYmFzZSwgYmxlbmQsIEJsZW5kSGFyZE1peGYpXFxuJyArXG5cdFx0XHRcdFx0JyNkZWZpbmUgQmxlbmRSZWZsZWN0KGJhc2UsIGJsZW5kKVx0XHRCbGVuZChiYXNlLCBibGVuZCwgQmxlbmRSZWZsZWN0ZilcXG4nICtcblx0XHRcdFx0XHQnI2RlZmluZSBCbGVuZEdsb3coYmFzZSwgYmxlbmQpXHRcdFx0QmxlbmRSZWZsZWN0KGJsZW5kLCBiYXNlKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kUGhvZW5peChiYXNlLCBibGVuZClcdFx0KG1pbihiYXNlLCBibGVuZCkgLSBtYXgoYmFzZSwgYmxlbmQpICsgdmVjMygxLjApKVxcbicgK1xuXHRcdFx0XHRcdC8vJyNkZWZpbmUgQmxlbmRPcGFjaXR5KGJhc2UsIGJsZW5kLCBGLCBPKVx0KEYoYmFzZSwgYmxlbmQpICogTyArIGJsZW5kICogKDEuMCAtIE8pKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEJsZW5kT3BhY2l0eShiYXNlLCBibGVuZCwgQmxlbmRGbiwgT3BhY2l0eSwgQWxwaGEpXHQoKEJsZW5kRm4oYmFzZS5yZ2IgKiBibGVuZC5hICogT3BhY2l0eSwgYmxlbmQucmdiICogYmxlbmQuYSAqIE9wYWNpdHkpICsgYmFzZS5yZ2IgKiBiYXNlLmEgKiAoMS4wIC0gYmxlbmQuYSAqIE9wYWNpdHkpKSAvIEFscGhhKVxcbicgK1xuXHRcdFx0XHRcdCdcXG4nICtcblx0XHRcdFx0XHQndmFyeWluZyB2ZWMyIHZUZXhDb29yZDtcXG4nICtcblx0XHRcdFx0XHQndmFyeWluZyB2ZWM0IHZQb3NpdGlvbjtcXG4nICtcblx0XHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdFx0J3VuaWZvcm0gc2FtcGxlcjJEIHRvcDtcXG4nICtcblx0XHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdFx0J3VuaWZvcm0gc2FtcGxlcjJEIGJvdHRvbTtcXG4nICtcblx0XHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdFx0J3VuaWZvcm0gZmxvYXQgb3BhY2l0eTtcXG4nICtcblx0XHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdFx0J3ZvaWQgbWFpbih2b2lkKSB7XFxuJyArXG5cdFx0XHRcdFx0J1x0dmVjMyBjb2xvcjtcXG4nICtcblx0XHRcdFx0XHQnXHR2ZWM0IHRvcFBpeGVsID0gdGV4dHVyZTJEKHRvcCwgdlRleENvb3JkKTtcXG4nICtcblx0XHRcdFx0XHQnXHR2ZWM0IGJvdHRvbVBpeGVsID0gdGV4dHVyZTJEKGJvdHRvbSwgdlRleENvb3JkKTtcXG4nICtcblxuXHRcdFx0XHRcdCdcdGZsb2F0IGFscGhhID0gdG9wUGl4ZWwuYSArIGJvdHRvbVBpeGVsLmEgKiAoMS4wIC0gdG9wUGl4ZWwuYSk7XFxuJyArXG5cdFx0XHRcdFx0J1x0aWYgKGFscGhhID09IDAuMCkge1xcbicgK1xuXHRcdFx0XHRcdCdcdFx0Y29sb3IgPSB2ZWMzKDAuMCk7XFxuJyArXG5cdFx0XHRcdFx0J1x0fSBlbHNlIHtcXG4nICtcblx0XHRcdFx0XHQnXHRcdGNvbG9yID0gQmxlbmRPcGFjaXR5KGJvdHRvbVBpeGVsLCB0b3BQaXhlbCwgQmxlbmRGdW5jdGlvbiwgb3BhY2l0eSwgYWxwaGEpO1xcbicgK1xuXHRcdFx0XHRcdCdcdH1cXG4nICtcblx0XHRcdFx0XHQnXHRnbF9GcmFnQ29sb3IgPSB2ZWM0KGNvbG9yLCBhbHBoYSk7XFxuJyArXG5cdFx0XHRcdFx0J31cXG4nO1xuXG5cdFx0XHRcdHJldHVybiBzaGFkZXJTb3VyY2U7XG5cdFx0XHR9LFxuXHRcdFx0ZHJhdzogZnVuY3Rpb24gKHNoYWRlciwgbW9kZWwsIHVuaWZvcm1zLCBmcmFtZUJ1ZmZlciwgZHJhdykge1xuXHRcdFx0XHRpZiAobmF0aXZlQmxlbmRNb2Rlc1t0aGlzLmlucHV0cy5tb2RlXSkge1xuXHRcdFx0XHRcdGlmICh0aGlzLmlucHV0cy5ib3R0b20pIHtcblx0XHRcdFx0XHRcdGRyYXcoc2hhZGVyLCBtb2RlbCwgYm90dG9tVW5pZm9ybXMsIGZyYW1lQnVmZmVyKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAodGhpcy5pbnB1dHMudG9wKSB7XG5cdFx0XHRcdFx0XHRkcmF3KHNoYWRlciwgbW9kZWwsIHRvcFVuaWZvcm1zLCBmcmFtZUJ1ZmZlciwgbnVsbCwgdG9wT3B0cyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRyYXcoc2hhZGVyLCBtb2RlbCwgdW5pZm9ybXMsIGZyYW1lQnVmZmVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGlucHV0czoge1xuXHRcdFx0XHR0b3A6IHtcblx0XHRcdFx0XHR0eXBlOiAnaW1hZ2UnLFxuXHRcdFx0XHRcdHVuaWZvcm06ICd0b3AnLFxuXHRcdFx0XHRcdHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0aWYgKHRvcFVuaWZvcm1zKSB7XG5cdFx0XHRcdFx0XHRcdHRvcFVuaWZvcm1zLnNvdXJjZSA9IHRoaXMuaW5wdXRzLnRvcDtcblx0XHRcdFx0XHRcdFx0dG9wVW5pZm9ybXMudHJhbnNmb3JtID0gdGhpcy5pbnB1dHMudG9wLmN1bXVsYXRpdmVNYXRyaXggfHwgaWRlbnRpdHk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0aGlzLnJlc2l6ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0Ym90dG9tOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2ltYWdlJyxcblx0XHRcdFx0XHR1bmlmb3JtOiAnYm90dG9tJyxcblx0XHRcdFx0XHR1cGRhdGU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdGlmIChib3R0b21Vbmlmb3Jtcykge1xuXHRcdFx0XHRcdFx0XHRib3R0b21Vbmlmb3Jtcy5zb3VyY2UgPSB0aGlzLmlucHV0cy5ib3R0b207XG5cdFx0XHRcdFx0XHRcdGJvdHRvbVVuaWZvcm1zLnRyYW5zZm9ybSA9IHRoaXMuaW5wdXRzLmJvdHRvbS5jdW11bGF0aXZlTWF0cml4IHx8IGlkZW50aXR5O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhpcy5yZXNpemUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG9wYWNpdHk6IHtcblx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdFx0XHR1bmlmb3JtOiAnb3BhY2l0eScsXG5cdFx0XHRcdFx0ZGVmYXVsdFZhbHVlOiAxLFxuXHRcdFx0XHRcdG1pbjogMCxcblx0XHRcdFx0XHRtYXg6IDEsXG5cdFx0XHRcdFx0dXBkYXRlOiBmdW5jdGlvbiAob3BhY2l0eSkge1xuXHRcdFx0XHRcdFx0aWYgKHRvcFVuaWZvcm1zKSB7XG5cdFx0XHRcdFx0XHRcdHRvcFVuaWZvcm1zLm9wYWNpdHkgPSBvcGFjaXR5O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0c2l6ZU1vZGU6IHtcblx0XHRcdFx0XHR0eXBlOiAnZW51bScsXG5cdFx0XHRcdFx0ZGVmYXVsdFZhbHVlOiAnYm90dG9tJyxcblx0XHRcdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdFx0XHQnYm90dG9tJyxcblx0XHRcdFx0XHRcdCd0b3AnLFxuXHRcdFx0XHRcdFx0J3VuaW9uJyxcblx0XHRcdFx0XHRcdCdpbnRlcnNlY3Rpb24nXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHR1cGRhdGU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHRoaXMucmVzaXplKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRtb2RlOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2VudW0nLFxuXHRcdFx0XHRcdHNoYWRlckRpcnR5OiB0cnVlLFxuXHRcdFx0XHRcdGRlZmF1bHRWYWx1ZTogJ25vcm1hbCcsXG5cdFx0XHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHRcdFx0Wydub3JtYWwnLCAnTm9ybWFsJ10sXG5cdFx0XHRcdFx0XHRbJ2xpZ2h0ZW4nLCAnTGlnaHRlbiddLFxuXHRcdFx0XHRcdFx0WydkYXJrZW4nLCAnRGFya2VuJ10sXG5cdFx0XHRcdFx0XHRbJ211bHRpcGx5JywgJ011bHRpcGx5J10sXG5cdFx0XHRcdFx0XHRbJ2F2ZXJhZ2UnLCAnQXZlcmFnZSddLFxuXHRcdFx0XHRcdFx0WydhZGQnLCAnQWRkJ10sXG5cdFx0XHRcdFx0XHRbJ3N1YnN0cmFjdCcsICdTdWJzdHJhY3QnXSxcblx0XHRcdFx0XHRcdFsnZGlmZmVyZW5jZScsICdEaWZmZXJlbmNlJ10sXG5cdFx0XHRcdFx0XHRbJ25lZ2F0aW9uJywgJ05lZ2F0aW9uJ10sXG5cdFx0XHRcdFx0XHRbJ2V4Y2x1c2lvbicsICdFeGNsdXNpb24nXSxcblx0XHRcdFx0XHRcdFsnc2NyZWVuJywgJ1NjcmVlbiddLFxuXHRcdFx0XHRcdFx0WydvdmVybGF5JywgJ092ZXJsYXknXSxcblx0XHRcdFx0XHRcdFsnc29mdGxpZ2h0JywgJ1NvZnQgTGlnaHQnXSxcblx0XHRcdFx0XHRcdFsnaGFyZGxpZ2h0JywgJ0hhcmQgTGlnaHQnXSxcblx0XHRcdFx0XHRcdFsnY29sb3Jkb2RnZScsICdDb2xvciBEb2RnZSddLFxuXHRcdFx0XHRcdFx0Wydjb2xvcmJ1cm4nLCAnQ29sb3IgQnVybiddLFxuXHRcdFx0XHRcdFx0WydsaW5lYXJkb2RnZScsICdMaW5lYXIgRG9kZ2UnXSxcblx0XHRcdFx0XHRcdFsnbGluZWFyYnVybicsICdMaW5lYXIgQnVybiddLFxuXHRcdFx0XHRcdFx0WydsaW5lYXJsaWdodCcsICdMaW5lYXIgTGlnaHQnXSxcblx0XHRcdFx0XHRcdFsndml2aWRsaWdodCcsICdWaXZpZCBMaWdodCddLFxuXHRcdFx0XHRcdFx0WydwaW5saWdodCcsICdQaW4gTGlnaHQnXSxcblx0XHRcdFx0XHRcdFsnaGFyZG1peCcsICdIYXJkIE1peCddLFxuXHRcdFx0XHRcdFx0WydyZWZsZWN0JywgJ1JlZmxlY3QnXSxcblx0XHRcdFx0XHRcdFsnZ2xvdycsICdHbG93J10sXG5cdFx0XHRcdFx0XHRbJ3Bob2VuaXgnLCAnUGhvZW5peCddXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fSxcblx0e1xuXHRcdGluUGxhY2U6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiAhIW5hdGl2ZUJsZW5kTW9kZXNbdGhpcy5pbnB1dHMubW9kZV07XG5cdFx0fSxcblx0XHRkZXNjcmlwdGlvbjogJ0JsZW5kIHR3byBsYXllcnMnLFxuXHRcdHRpdGxlOiAnQmxlbmQnXG5cdH0pO1xufSkpO1xuIiwiLyogZ2xvYmFsIGRlZmluZSwgcmVxdWlyZSAqL1xuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHRpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG5cdFx0Ly8gTm9kZS9Db21tb25KU1xuXHRcdGZhY3RvcnkocmVxdWlyZSgnLi4vc2VyaW91c2x5JykpO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuXHRcdC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cblx0XHRkZWZpbmUoWydzZXJpb3VzbHknXSwgZmFjdG9yeSk7XG5cdH0gZWxzZSB7XG5cdFx0aWYgKCFyb290LlNlcmlvdXNseSkge1xuXHRcdFx0cm9vdC5TZXJpb3VzbHkgPSB7IHBsdWdpbjogZnVuY3Rpb24gKG5hbWUsIG9wdCkgeyB0aGlzW25hbWVdID0gb3B0OyB9IH07XG5cdFx0fVxuXHRcdGZhY3Rvcnkocm9vdC5TZXJpb3VzbHkpO1xuXHR9XG59KHRoaXMsIGZ1bmN0aW9uIChTZXJpb3VzbHksIHVuZGVmaW5lZCkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0Ly9cdEFkYXB0ZWQgZnJvbSBodHRwOi8vcmFzdGVyZ3JpZC5jb20vYmxvZy8yMDExLzAxL2ZyZWktY2hlbi1lZGdlLWRldGVjdG9yL1xuXHR2YXIgc3FydCA9IE1hdGguc3FydCxcblx0XHRpLCBqLFxuXHRcdGZsYXRNYXRyaWNlcyA9IFtdLFxuXHRcdG1hdHJpY2VzLFxuXHRcdGZyZWlDaGVuTWF0cml4Q29uc3RhbnRzLFxuXHRcdHNvYmVsTWF0cml4Q29uc3RhbnRzO1xuXG5cdC8vaW5pdGlhbGl6ZSBzaGFkZXIgbWF0cml4IGFycmF5c1xuXHRmdW5jdGlvbiBtdWx0aXBseUFycmF5KGZhY3RvciwgYSkge1xuXHRcdHZhciBpO1xuXHRcdGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRhW2ldICo9IGZhY3Rvcjtcblx0XHR9XG5cdFx0cmV0dXJuIGE7XG5cdH1cblxuXHRtYXRyaWNlcyA9IFtcblx0XHRtdWx0aXBseUFycmF5KDEuMCAvICgyLjAgKiBzcXJ0KDIuMCkpLCBbIDEuMCwgc3FydCgyLjApLCAxLjAsIDAuMCwgMC4wLCAwLjAsIC0xLjAsIC1zcXJ0KDIuMCksIC0xLjAgXSksXG5cdFx0bXVsdGlwbHlBcnJheSgxLjAgLyAoMi4wICogc3FydCgyLjApKSwgWzEuMCwgMC4wLCAtMS4wLCBzcXJ0KDIuMCksIDAuMCwgLXNxcnQoMi4wKSwgMS4wLCAwLjAsIC0xLjBdKSxcblx0XHRtdWx0aXBseUFycmF5KDEuMCAvICgyLjAgKiBzcXJ0KDIuMCkpLCBbMC4wLCAtMS4wLCBzcXJ0KDIuMCksIDEuMCwgMC4wLCAtMS4wLCAtc3FydCgyLjApLCAxLjAsIDAuMF0pLFxuXHRcdG11bHRpcGx5QXJyYXkoMS4wIC8gKDIuMCAqIHNxcnQoMi4wKSksIFtzcXJ0KDIuMCksIC0xLjAsIDAuMCwgLTEuMCwgMC4wLCAxLjAsIDAuMCwgMS4wLCAtc3FydCgyLjApXSksXG5cdFx0bXVsdGlwbHlBcnJheSgxLjAgLyAyLjAsIFswLjAsIDEuMCwgMC4wLCAtMS4wLCAwLjAsIC0xLjAsIDAuMCwgMS4wLCAwLjBdKSxcblx0XHRtdWx0aXBseUFycmF5KDEuMCAvIDIuMCwgWy0xLjAsIDAuMCwgMS4wLCAwLjAsIDAuMCwgMC4wLCAxLjAsIDAuMCwgLTEuMF0pLFxuXHRcdG11bHRpcGx5QXJyYXkoMS4wIC8gNi4wLCBbMS4wLCAtMi4wLCAxLjAsIC0yLjAsIDQuMCwgLTIuMCwgMS4wLCAtMi4wLCAxLjBdKSxcblx0XHRtdWx0aXBseUFycmF5KDEuMCAvIDYuMCwgWy0yLjAsIDEuMCwgLTIuMCwgMS4wLCA0LjAsIDEuMCwgLTIuMCwgMS4wLCAtMi4wXSksXG5cdFx0bXVsdGlwbHlBcnJheSgxLjAgLyAzLjAsIFsxLjAsIDEuMCwgMS4wLCAxLjAsIDEuMCwgMS4wLCAxLjAsIDEuMCwgMS4wXSlcblx0XTtcblxuXHRmb3IgKGkgPSAwOyBpIDwgbWF0cmljZXMubGVuZ3RoOyBpKyspIHtcblx0XHRmb3IgKGogPSAwOyBqIDwgbWF0cmljZXNbaV0ubGVuZ3RoOyBqKyspIHtcblx0XHRcdGZsYXRNYXRyaWNlcy5wdXNoKG1hdHJpY2VzW2ldW2pdKTtcblx0XHR9XG5cdH1cblxuXHRmcmVpQ2hlbk1hdHJpeENvbnN0YW50cyA9IG5ldyBGbG9hdDMyQXJyYXkoZmxhdE1hdHJpY2VzKTtcblxuXHRzb2JlbE1hdHJpeENvbnN0YW50cyA9IG5ldyBGbG9hdDMyQXJyYXkoW1xuXHRcdDEuMCwgMi4wLCAxLjAsIDAuMCwgMC4wLCAwLjAsIC0xLjAsIC0yLjAsIC0xLjAsXG5cdFx0MS4wLCAwLjAsIC0xLjAsIDIuMCwgMC4wLCAtMi4wLCAxLjAsIDAuMCwgLTEuMFxuXHRdKTtcblxuXHRTZXJpb3VzbHkucGx1Z2luKCdlZGdlJywge1xuXHRcdHNoYWRlcjogZnVuY3Rpb24gKGlucHV0cywgc2hhZGVyU291cmNlKSB7XG5cdFx0XHR2YXIgZGVmaW5lcztcblxuXHRcdFx0aWYgKGlucHV0cy5tb2RlID09PSAnc29iZWwnKSB7XG5cdFx0XHRcdGRlZmluZXMgPSAnI2RlZmluZSBOX01BVFJJQ0VTIDJcXG4nICtcblx0XHRcdFx0JyNkZWZpbmUgU09CRUxcXG4nO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9mcmVpLWNoZW5cblx0XHRcdFx0ZGVmaW5lcyA9ICcjZGVmaW5lIE5fTUFUUklDRVMgOVxcbic7XG5cdFx0XHR9XG5cblx0XHRcdHNoYWRlclNvdXJjZS5mcmFnbWVudCA9IGRlZmluZXMgK1xuXHRcdFx0XHQnI2lmZGVmIEdMX0VTXFxuJyArXG5cdFx0XHRcdCdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG4nICtcblx0XHRcdFx0JyNlbmRpZlxcbicgK1xuXHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdCd2YXJ5aW5nIHZlYzIgdlRleENvb3JkO1xcbicgK1xuXHRcdFx0XHQndmFyeWluZyB2ZWM0IHZQb3NpdGlvbjtcXG4nICtcblx0XHRcdFx0J1xcbicgK1xuXHRcdFx0XHQndW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xcbicgK1xuXHRcdFx0XHQndW5pZm9ybSBmbG9hdCBwaXhlbFdpZHRoO1xcbicgK1xuXHRcdFx0XHQndW5pZm9ybSBmbG9hdCBwaXhlbEhlaWdodDtcXG4nICtcblx0XHRcdFx0J3VuaWZvcm0gbWF0MyBHWzldO1xcbicgK1xuXHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdCd2b2lkIG1haW4odm9pZCkge1xcbicgK1xuXHRcdFx0XHQnXHRtYXQzIEk7XFxuJyArXG5cdFx0XHRcdCdcdGZsb2F0IGRwMywgY252WzldO1xcbicgK1xuXHRcdFx0XHQnXHR2ZWMzIHRjO1xcbicgK1xuXG5cdFx0XHRcdC8vIGZldGNoIHRoZSAzeDMgbmVpZ2hib3VyaG9vZCBhbmQgdXNlIHRoZSBSR0IgdmVjdG9yJ3MgbGVuZ3RoIGFzIGludGVuc2l0eSB2YWx1ZVxuXHRcdFx0XHQnXHRmbG9hdCBmaSA9IDAuMCwgZmogPSAwLjA7XFxuJyArXG5cdFx0XHRcdCdcdGZvciAoaW50IGkgPSAwOyBpIDwgMzsgaSsrKSB7XFxuJyArXG5cdFx0XHRcdCdcdFx0ZmogPSAwLjA7XFxuJyArXG5cdFx0XHRcdCdcdFx0Zm9yIChpbnQgaiA9IDA7IGogPCAzOyBqKyspIHtcXG4nICtcblx0XHRcdFx0J1x0XHRcdElbaV1bal0gPSBsZW5ndGgoICcgK1xuXHRcdFx0XHRcdFx0XHQndGV4dHVyZTJEKHNvdXJjZSwgJyArXG5cdFx0XHRcdFx0XHRcdFx0J3ZUZXhDb29yZCArIHZlYzIoKGZpIC0gMS4wKSAqIHBpeGVsV2lkdGgsIChmaiAtIDEuMCkgKiBwaXhlbEhlaWdodCknICtcblx0XHRcdFx0XHRcdFx0JykucmdiICk7XFxuJyArXG5cdFx0XHRcdCdcdFx0XHRmaiArPSAxLjA7XFxuJyArXG5cdFx0XHRcdCdcdFx0fTtcXG4nICtcblx0XHRcdFx0J1x0XHRmaSArPSAxLjA7XFxuJyArXG5cdFx0XHRcdCdcdH07XFxuJyArXG5cblx0XHRcdFx0Ly8gY2FsY3VsYXRlIHRoZSBjb252b2x1dGlvbiB2YWx1ZXMgZm9yIGFsbCB0aGUgbWFza3NcblxuXHRcdFx0XHQnXHRmb3IgKGludCBpID0gMDsgaSA8IE5fTUFUUklDRVM7IGkrKykge1xcbicgK1xuXHRcdFx0XHQnXHRcdGRwMyA9IGRvdChHW2ldWzBdLCBJWzBdKSArIGRvdChHW2ldWzFdLCBJWzFdKSArIGRvdChHW2ldWzJdLCBJWzJdKTtcXG4nICtcblx0XHRcdFx0J1x0XHRjbnZbaV0gPSBkcDMgKiBkcDM7XFxuJyArXG5cdFx0XHRcdCdcdH07XFxuJyArXG5cdFx0XHRcdCdcXG4nICtcblxuXHRcdFx0XHQvL1NvYmVsXG5cdFx0XHRcdCcjaWZkZWYgU09CRUxcXG4nICtcblx0XHRcdFx0J1x0dGMgPSB2ZWMzKDAuNSAqIHNxcnQoY252WzBdKmNudlswXStjbnZbMV0qY252WzFdKSk7XFxuJyArXG5cdFx0XHRcdCcjZWxzZVxcbicgK1xuXG5cdFx0XHRcdC8vRnJlaS1DaGVuXG5cdFx0XHRcdC8vIExpbmUgZGV0ZWN0b3Jcblx0XHRcdFx0J1x0ZmxvYXQgTSA9IChjbnZbNF0gKyBjbnZbNV0pICsgKGNudls2XSArIGNudls3XSk7XFxuJyArXG5cdFx0XHRcdCdcdGZsb2F0IFMgPSAoY252WzBdICsgY252WzFdKSArIChjbnZbMl0gKyBjbnZbM10pICsgKGNudls0XSArIGNudls1XSkgKyAoY252WzZdICsgY252WzddKSArIGNudls4XTtcXG4nICtcblx0XHRcdFx0J1x0dGMgPSB2ZWMzKHNxcnQoTS9TKSk7XFxuJyArXG5cdFx0XHRcdCcjZW5kaWZcXG4nICtcblxuXHRcdFx0XHQnXHRnbF9GcmFnQ29sb3IgPSB2ZWM0KHRjLCAxLjApO1xcbicgK1xuXHRcdFx0XHQnfVxcbic7XG5cblx0XHRcdHJldHVybiBzaGFkZXJTb3VyY2U7XG5cdFx0fSxcblx0XHRkcmF3OiBmdW5jdGlvbiAoc2hhZGVyLCBtb2RlbCwgdW5pZm9ybXMsIGZyYW1lQnVmZmVyLCBwYXJlbnQpIHtcblxuXHRcdFx0dW5pZm9ybXMucGl4ZWxXaWR0aCA9IDEgLyB0aGlzLndpZHRoO1xuXHRcdFx0dW5pZm9ybXMucGl4ZWxIZWlnaHQgPSAxIC8gdGhpcy5oZWlnaHQ7XG5cblx0XHRcdGlmICh0aGlzLmlucHV0cy5tb2RlID09PSAnc29iZWwnKSB7XG5cdFx0XHRcdHVuaWZvcm1zWydHWzBdJ10gPSBzb2JlbE1hdHJpeENvbnN0YW50cztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHVuaWZvcm1zWydHWzBdJ10gPSBmcmVpQ2hlbk1hdHJpeENvbnN0YW50cztcblx0XHRcdH1cblxuXHRcdFx0cGFyZW50KHNoYWRlciwgbW9kZWwsIHVuaWZvcm1zLCBmcmFtZUJ1ZmZlcik7XG5cdFx0fSxcblx0XHRpbnB1dHM6IHtcblx0XHRcdHNvdXJjZToge1xuXHRcdFx0XHR0eXBlOiAnaW1hZ2UnLFxuXHRcdFx0XHR1bmlmb3JtOiAnc291cmNlJ1xuXHRcdFx0fSxcblx0XHRcdG1vZGU6IHtcblx0XHRcdFx0dHlwZTogJ2VudW0nLFxuXHRcdFx0XHRzaGFkZXJEaXJ0eTogdHJ1ZSxcblx0XHRcdFx0ZGVmYXVsdFZhbHVlOiAnc29iZWwnLFxuXHRcdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdFx0Wydzb2JlbCcsICdTb2JlbCddLFxuXHRcdFx0XHRcdFsnZnJlaS1jaGVuJywgJ0ZyZWktQ2hlbiddXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9LFxuXHRcdGRlc2NyaXB0aW9uOiAnRWRnZSBEZXRlY3QnLFxuXHRcdHRpdGxlOiAnRWRnZSBEZXRlY3QnXG5cdH0pO1xufSkpO1xuIiwiLyogZ2xvYmFsIGRlZmluZSwgcmVxdWlyZSAqL1xuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHRpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG5cdFx0Ly8gTm9kZS9Db21tb25KU1xuXHRcdGZhY3RvcnkocmVxdWlyZSgnLi4vc2VyaW91c2x5JykpO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuXHRcdC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cblx0XHRkZWZpbmUoWydzZXJpb3VzbHknXSwgZmFjdG9yeSk7XG5cdH0gZWxzZSB7XG5cdFx0aWYgKCFyb290LlNlcmlvdXNseSkge1xuXHRcdFx0cm9vdC5TZXJpb3VzbHkgPSB7IHBsdWdpbjogZnVuY3Rpb24gKG5hbWUsIG9wdCkgeyB0aGlzW25hbWVdID0gb3B0OyB9IH07XG5cdFx0fVxuXHRcdGZhY3Rvcnkocm9vdC5TZXJpb3VzbHkpO1xuXHR9XG59KHRoaXMsIGZ1bmN0aW9uIChTZXJpb3VzbHksIHVuZGVmaW5lZCkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0Ly9pbnNwaXJlZCBieSBFdmFuIFdhbGxhY2UgKGh0dHBzOi8vZ2l0aHViLmNvbS9ldmFudy9nbGZ4LmpzKVxuXG5cdFNlcmlvdXNseS5wbHVnaW4oJ2h1ZS1zYXR1cmF0aW9uJywge1xuXHRcdGNvbW1vblNoYWRlcjogdHJ1ZSxcblx0XHRzaGFkZXI6IGZ1bmN0aW9uIChpbnB1dHMsIHNoYWRlclNvdXJjZSkge1xuXHRcdFx0c2hhZGVyU291cmNlLnZlcnRleCA9IFtcblx0XHRcdFx0JyNpZmRlZiBHTF9FUycsXG5cdFx0XHRcdCdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuXHRcdFx0XHQnI2VuZGlmICcsXG5cblx0XHRcdFx0J2F0dHJpYnV0ZSB2ZWM0IHBvc2l0aW9uOycsXG5cdFx0XHRcdCdhdHRyaWJ1dGUgdmVjMiB0ZXhDb29yZDsnLFxuXG5cdFx0XHRcdCd1bmlmb3JtIHZlYzIgcmVzb2x1dGlvbjsnLFxuXHRcdFx0XHQndW5pZm9ybSBtYXQ0IHByb2plY3Rpb247Jyxcblx0XHRcdFx0J3VuaWZvcm0gbWF0NCB0cmFuc2Zvcm07JyxcblxuXHRcdFx0XHQndW5pZm9ybSBmbG9hdCBodWU7Jyxcblx0XHRcdFx0J3VuaWZvcm0gZmxvYXQgc2F0dXJhdGlvbjsnLFxuXG5cdFx0XHRcdCd2YXJ5aW5nIHZlYzIgdlRleENvb3JkOycsXG5cdFx0XHRcdCd2YXJ5aW5nIHZlYzQgdlBvc2l0aW9uOycsXG5cblx0XHRcdFx0J3ZhcnlpbmcgdmVjMyB3ZWlnaHRzOycsXG5cblx0XHRcdFx0J3ZvaWQgbWFpbih2b2lkKSB7Jyxcblx0XHRcdFx0J1x0ZmxvYXQgYW5nbGUgPSBodWUgKiAzLjE0MTU5MjY1MzU4OTc5MzIzODQ2MjY0OycsXG5cdFx0XHRcdCdcdGZsb2F0IHMgPSBzaW4oYW5nbGUpOycsXG5cdFx0XHRcdCdcdGZsb2F0IGMgPSBjb3MoYW5nbGUpOycsXG5cdFx0XHRcdCdcdHdlaWdodHMgPSAodmVjMygyLjAgKiBjLCAtc3FydCgzLjApICogcyAtIGMsIHNxcnQoMy4wKSAqIHMgLSBjKSArIDEuMCkgLyAzLjA7JyxcblxuXHRcdFx0XHQvLyBmaXJzdCBjb252ZXJ0IHRvIHNjcmVlbiBzcGFjZVxuXHRcdFx0XHQnXHR2ZWM0IHNjcmVlblBvc2l0aW9uID0gdmVjNChwb3NpdGlvbi54eSAqIHJlc29sdXRpb24gLyAyLjAsIHBvc2l0aW9uLnosIHBvc2l0aW9uLncpOycsXG5cdFx0XHRcdCdcdHNjcmVlblBvc2l0aW9uID0gdHJhbnNmb3JtICogc2NyZWVuUG9zaXRpb247JyxcblxuXHRcdFx0XHQvLyBjb252ZXJ0IGJhY2sgdG8gT3BlbkdMIGNvb3Jkc1xuXHRcdFx0XHQnXHRnbF9Qb3NpdGlvbiA9IHNjcmVlblBvc2l0aW9uOycsXG5cdFx0XHRcdCdcdGdsX1Bvc2l0aW9uLnh5ID0gc2NyZWVuUG9zaXRpb24ueHkgKiAyLjAgLyByZXNvbHV0aW9uOycsXG5cdFx0XHRcdCdcdGdsX1Bvc2l0aW9uLnogPSBzY3JlZW5Qb3NpdGlvbi56ICogMi4wIC8gKHJlc29sdXRpb24ueCAvIHJlc29sdXRpb24ueSk7Jyxcblx0XHRcdFx0J1x0dlRleENvb3JkID0gdGV4Q29vcmQ7Jyxcblx0XHRcdFx0J1x0dlBvc2l0aW9uID0gZ2xfUG9zaXRpb247Jyxcblx0XHRcdFx0J30nXG5cdFx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdFx0c2hhZGVyU291cmNlLmZyYWdtZW50ID0gW1xuXHRcdFx0XHQnI2lmZGVmIEdMX0VTXFxuJyxcblx0XHRcdFx0J3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcbicsXG5cdFx0XHRcdCcjZW5kaWZcXG4nLFxuXG5cdFx0XHRcdCd2YXJ5aW5nIHZlYzIgdlRleENvb3JkOycsXG5cdFx0XHRcdCd2YXJ5aW5nIHZlYzQgdlBvc2l0aW9uOycsXG5cblx0XHRcdFx0J3ZhcnlpbmcgdmVjMyB3ZWlnaHRzOycsXG5cblx0XHRcdFx0J3VuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTsnLFxuXHRcdFx0XHQndW5pZm9ybSBmbG9hdCBodWU7Jyxcblx0XHRcdFx0J3VuaWZvcm0gZmxvYXQgc2F0dXJhdGlvbjsnLFxuXG5cdFx0XHRcdCd2b2lkIG1haW4odm9pZCkgeycsXG5cdFx0XHRcdCdcdHZlYzQgY29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCB2VGV4Q29vcmQpOycsXG5cblx0XHRcdFx0Ly9hZGp1c3QgaHVlXG5cdFx0XHRcdCdcdGZsb2F0IGxlbiA9IGxlbmd0aChjb2xvci5yZ2IpOycsXG5cdFx0XHRcdCdcdGNvbG9yLnJnYiA9IHZlYzMoJyArXG5cdFx0XHRcdFx0XHQnZG90KGNvbG9yLnJnYiwgd2VpZ2h0cy54eXopLCAnICtcblx0XHRcdFx0XHRcdCdkb3QoY29sb3IucmdiLCB3ZWlnaHRzLnp4eSksICcgK1xuXHRcdFx0XHRcdFx0J2RvdChjb2xvci5yZ2IsIHdlaWdodHMueXp4KSAnICtcblx0XHRcdFx0Jyk7JyxcblxuXHRcdFx0XHQvL2FkanVzdCBzYXR1cmF0aW9uXG5cdFx0XHRcdCdcdHZlYzMgYWRqdXN0bWVudCA9IChjb2xvci5yICsgY29sb3IuZyArIGNvbG9yLmIpIC8gMy4wIC0gY29sb3IucmdiOycsXG5cdFx0XHRcdCdcdGlmIChzYXR1cmF0aW9uID4gMC4wKSB7Jyxcblx0XHRcdFx0J1x0XHRhZGp1c3RtZW50ICo9ICgxLjAgLSAxLjAgLyAoMS4wIC0gc2F0dXJhdGlvbikpOycsXG5cdFx0XHRcdCdcdH0gZWxzZSB7Jyxcblx0XHRcdFx0J1x0XHRhZGp1c3RtZW50ICo9ICgtc2F0dXJhdGlvbik7Jyxcblx0XHRcdFx0J1x0fScsXG5cdFx0XHRcdCdcdGNvbG9yLnJnYiArPSBhZGp1c3RtZW50OycsXG5cblx0XHRcdFx0J1x0Z2xfRnJhZ0NvbG9yID0gY29sb3I7Jyxcblx0XHRcdFx0J30nXG5cdFx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdFx0cmV0dXJuIHNoYWRlclNvdXJjZTtcblx0XHR9LFxuXHRcdGluUGxhY2U6IHRydWUsXG5cdFx0aW5wdXRzOiB7XG5cdFx0XHRzb3VyY2U6IHtcblx0XHRcdFx0dHlwZTogJ2ltYWdlJyxcblx0XHRcdFx0dW5pZm9ybTogJ3NvdXJjZSdcblx0XHRcdH0sXG5cdFx0XHRodWU6IHtcblx0XHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRcdHVuaWZvcm06ICdodWUnLFxuXHRcdFx0XHRkZWZhdWx0VmFsdWU6IDAuNCxcblx0XHRcdFx0bWluOiAtMSxcblx0XHRcdFx0bWF4OiAxXG5cdFx0XHR9LFxuXHRcdFx0c2F0dXJhdGlvbjoge1xuXHRcdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdFx0dW5pZm9ybTogJ3NhdHVyYXRpb24nLFxuXHRcdFx0XHRkZWZhdWx0VmFsdWU6IDAsXG5cdFx0XHRcdG1pbjogLTEsXG5cdFx0XHRcdG1heDogMVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0dGl0bGU6ICdIdWUvU2F0dXJhdGlvbicsXG5cdFx0ZGVzY3JpcHRpb246ICdSb3RhdGUgaHVlIGFuZCBtdWx0aXBseSBzYXR1cmF0aW9uLidcblx0fSk7XG59KSk7XG4iLCIvKiBnbG9iYWwgZGVmaW5lLCByZXF1aXJlICovXG4oZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcblx0XHQvLyBOb2RlL0NvbW1vbkpTXG5cdFx0ZmFjdG9yeShyZXF1aXJlKCcuLi9zZXJpb3VzbHknKSk7XG5cdH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG5cdFx0Ly8gQU1ELiBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlLlxuXHRcdGRlZmluZShbJ3NlcmlvdXNseSddLCBmYWN0b3J5KTtcblx0fSBlbHNlIHtcblx0XHRpZiAoIXJvb3QuU2VyaW91c2x5KSB7XG5cdFx0XHRyb290LlNlcmlvdXNseSA9IHsgcGx1Z2luOiBmdW5jdGlvbiAobmFtZSwgb3B0KSB7IHRoaXNbbmFtZV0gPSBvcHQ7IH0gfTtcblx0XHR9XG5cdFx0ZmFjdG9yeShyb290LlNlcmlvdXNseSk7XG5cdH1cbn0odGhpcywgZnVuY3Rpb24gKFNlcmlvdXNseSwgdW5kZWZpbmVkKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHQvL3BhcnRpY2xlIHBhcmFtZXRlcnNcblx0dmFyIG1pblZlbG9jaXR5ID0gMC4yLFxuXHRcdG1heFZlbG9jaXR5ID0gMC44LFxuXHRcdG1pblNpemUgPSAwLjAyLFxuXHRcdG1heFNpemUgPSAwLjMsXG5cdFx0cGFydGljbGVDb3VudCA9IDIwO1xuXG5cdFNlcmlvdXNseS5wbHVnaW4oJ3R2Z2xpdGNoJywgZnVuY3Rpb24gKCkge1xuXHRcdHZhciBsYXN0SGVpZ2h0LFxuXHRcdFx0bGFzdFRpbWUsXG5cdFx0XHRwYXJ0aWNsZUJ1ZmZlcixcblx0XHRcdHBhcnRpY2xlU2hhZGVyLFxuXHRcdFx0cGFydGljbGVGcmFtZUJ1ZmZlcixcblx0XHRcdGdsO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uIChwYXJlbnQpIHtcblx0XHRcdFx0dmFyIGksXG5cdFx0XHRcdFx0c2l6ZVJhbmdlLFxuXHRcdFx0XHRcdHZlbG9jaXR5UmFuZ2UsXG5cdFx0XHRcdFx0cGFydGljbGVWZXJ0ZXgsXG5cdFx0XHRcdFx0cGFydGljbGVGcmFnbWVudCxcblx0XHRcdFx0XHRwYXJ0aWNsZXM7XG5cblx0XHRcdFx0Z2wgPSB0aGlzLmdsO1xuXG5cdFx0XHRcdGxhc3RIZWlnaHQgPSB0aGlzLmhlaWdodDtcblxuXHRcdFx0XHQvL2luaXRpYWxpemUgcGFydGljbGVzXG5cdFx0XHRcdHBhcnRpY2xlcyA9IFtdO1xuXHRcdFx0XHRzaXplUmFuZ2UgPSBtYXhTaXplIC0gbWluU2l6ZTtcblx0XHRcdFx0dmVsb2NpdHlSYW5nZSA9IG1heFZlbG9jaXR5IC0gbWluVmVsb2NpdHk7XG5cdFx0XHRcdGZvciAoaSA9IDA7IGkgPCBwYXJ0aWNsZUNvdW50OyBpKyspIHtcblx0XHRcdFx0XHRwYXJ0aWNsZXMucHVzaChNYXRoLnJhbmRvbSgpICogMiAtIDEpOyAvL3Bvc2l0aW9uXG5cdFx0XHRcdFx0cGFydGljbGVzLnB1c2goTWF0aC5yYW5kb20oKSAqIHZlbG9jaXR5UmFuZ2UgKyBtaW5WZWxvY2l0eSk7IC8vdmVsb2NpdHlcblx0XHRcdFx0XHRwYXJ0aWNsZXMucHVzaChNYXRoLnJhbmRvbSgpICogc2l6ZVJhbmdlICsgbWluU2l6ZSk7IC8vc2l6ZVxuXHRcdFx0XHRcdHBhcnRpY2xlcy5wdXNoKE1hdGgucmFuZG9tKCkgKiAwLjIpOyAvL2ludGVuc2l0eVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cGFydGljbGVCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcblx0XHRcdFx0Z2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHBhcnRpY2xlQnVmZmVyKTtcblx0XHRcdFx0Z2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIG5ldyBGbG9hdDMyQXJyYXkocGFydGljbGVzKSwgZ2wuU1RBVElDX0RSQVcpO1xuXHRcdFx0XHRwYXJ0aWNsZUJ1ZmZlci5pdGVtU2l6ZSA9IDQ7XG5cdFx0XHRcdHBhcnRpY2xlQnVmZmVyLm51bUl0ZW1zID0gcGFydGljbGVDb3VudDtcblxuXHRcdFx0XHRwYXJ0aWNsZVZlcnRleCA9ICcjaWZkZWYgR0xfRVNcXG4nICtcblx0XHRcdFx0J3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcbicgK1xuXHRcdFx0XHQnI2VuZGlmIFxcbicgK1xuXHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdCdhdHRyaWJ1dGUgdmVjNCBwYXJ0aWNsZTtcXG4nICtcblx0XHRcdFx0J1xcbicgK1xuXHRcdFx0XHQndW5pZm9ybSBmbG9hdCB0aW1lO1xcbicgK1xuXHRcdFx0XHQndW5pZm9ybSBmbG9hdCBoZWlnaHQ7XFxuJyArXG5cdFx0XHRcdCdcXG4nICtcblx0XHRcdFx0J3ZhcnlpbmcgZmxvYXQgaW50ZW5zaXR5O1xcbicgK1xuXHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdCd2b2lkIG1haW4odm9pZCkge1xcbicgK1xuXHRcdFx0XHQnXHRmbG9hdCB5ID0gcGFydGljbGUueCArIHRpbWUgKiBwYXJ0aWNsZS55O1xcbicgK1xuXHRcdFx0XHQnXHR5ID0gZnJhY3QoKHkgKyAxLjApIC8gMi4wKSAqIDQuMCAtIDIuMDtcXG4nICtcblx0XHRcdFx0J1x0aW50ZW5zaXR5ID0gcGFydGljbGUudztcXG4nICtcblx0XHRcdFx0J1x0Z2xfUG9zaXRpb24gPSB2ZWM0KDAuMCwgLXkgLCAxLjAsIDIuMCk7XFxuJyArXG5cdFx0XHRcdC8vJ1x0Z2xfUG9zaXRpb24gPSB2ZWM0KDAuMCwgMS4wICwgMS4wLCAxLjApO1xcbicgK1xuXHRcdFx0XHQnXHRnbF9Qb2ludFNpemUgPSBoZWlnaHQgKiBwYXJ0aWNsZS56O1xcbicgK1xuXHRcdFx0XHQnfVxcbic7XG5cblx0XHRcdFx0cGFydGljbGVGcmFnbWVudCA9ICcjaWZkZWYgR0xfRVNcXG5cXG4nICtcblx0XHRcdFx0J3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1xcblxcbicgK1xuXHRcdFx0XHQnI2VuZGlmXFxuXFxuJyArXG5cdFx0XHRcdCdcXG4nICtcblx0XHRcdFx0J3ZhcnlpbmcgZmxvYXQgaW50ZW5zaXR5O1xcbicgK1xuXHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdCd2b2lkIG1haW4odm9pZCkge1xcbicgK1xuXHRcdFx0XHQnXHRnbF9GcmFnQ29sb3IgPSB2ZWM0KDEuMCk7XFxuJyArXG5cdFx0XHRcdCdcdGdsX0ZyYWdDb2xvci5hID0gMi4wICogaW50ZW5zaXR5ICogKDEuMCAtIGFicyhnbF9Qb2ludENvb3JkLnkgLSAwLjUpKTtcXG4nICtcblx0XHRcdFx0J31cXG4nO1xuXG5cdFx0XHRcdHBhcnRpY2xlU2hhZGVyID0gbmV3IFNlcmlvdXNseS51dGlsLlNoYWRlclByb2dyYW0oZ2wsIHBhcnRpY2xlVmVydGV4LCBwYXJ0aWNsZUZyYWdtZW50KTtcblxuXHRcdFx0XHRwYXJ0aWNsZUZyYW1lQnVmZmVyID0gbmV3IFNlcmlvdXNseS51dGlsLkZyYW1lQnVmZmVyKGdsLCAxLCBNYXRoLm1heCgxLCB0aGlzLmhlaWdodCAvIDIpKTtcblx0XHRcdFx0cGFyZW50KCk7XG5cdFx0XHR9LFxuXHRcdFx0Y29tbW9uU2hhZGVyOiB0cnVlLFxuXHRcdFx0c2hhZGVyOiBmdW5jdGlvbiAoaW5wdXRzLCBzaGFkZXJTb3VyY2UpIHtcblx0XHRcdFx0Ly9iYXNlU2hhZGVyID0gdGhpcy5iYXNlU2hhZGVyO1xuXG5cdFx0XHRcdHNoYWRlclNvdXJjZS5mcmFnbWVudCA9ICcjaWZkZWYgR0xfRVNcXG5cXG4nICtcblx0XHRcdFx0XHQncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuXFxuJyArXG5cdFx0XHRcdFx0JyNlbmRpZlxcblxcbicgK1xuXHRcdFx0XHRcdCdcXG4nICtcblx0XHRcdFx0XHQvLycjZGVmaW5lIEhhcmRMaWdodCh0b3AsIGJvdHRvbSkgKHRvcCA8IDAuNSA/ICgyLjAgKiB0b3AgKiBib3R0b20pIDogKDEuMCAtIDIuMCAqICgxLjAgLSB0b3ApICogKDEuMCAtIGJvdHRvbSkpKVxcbicgK1xuXHRcdFx0XHRcdCcjZGVmaW5lIEhhcmRMaWdodCh0b3AsIGJvdHRvbSkgICgxLjAgLSAyLjAgKiAoMS4wIC0gdG9wKSAqICgxLjAgLSBib3R0b20pKVxcbicgK1xuXHRcdFx0XHRcdCdcXG4nICtcblx0XHRcdFx0XHQndmFyeWluZyB2ZWMyIHZUZXhDb29yZDtcXG4nICtcblx0XHRcdFx0XHQndmFyeWluZyB2ZWM0IHZQb3NpdGlvbjtcXG4nICtcblx0XHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdFx0J3VuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcXG4nICtcblx0XHRcdFx0XHQndW5pZm9ybSBzYW1wbGVyMkQgcGFydGljbGVzO1xcbicgK1xuXHRcdFx0XHRcdCd1bmlmb3JtIGZsb2F0IHRpbWU7XFxuJyArXG5cdFx0XHRcdFx0J3VuaWZvcm0gZmxvYXQgc2NhbmxpbmVzO1xcbicgK1xuXHRcdFx0XHRcdCd1bmlmb3JtIGZsb2F0IGxpbmVTeW5jO1xcbicgK1xuXHRcdFx0XHRcdCd1bmlmb3JtIGZsb2F0IGxpbmVIZWlnaHQ7XFxuJyArIC8vZm9yIHNjYW5saW5lcyBhbmQgZGlzdG9ydGlvblxuXHRcdFx0XHRcdCd1bmlmb3JtIGZsb2F0IGRpc3RvcnRpb247XFxuJyArXG5cdFx0XHRcdFx0J3VuaWZvcm0gZmxvYXQgdnN5bmM7XFxuJyArXG5cdFx0XHRcdFx0J3VuaWZvcm0gZmxvYXQgYmFycztcXG4nICtcblx0XHRcdFx0XHQndW5pZm9ybSBmbG9hdCBmcmFtZVNoYXJwbmVzcztcXG4nICtcblx0XHRcdFx0XHQndW5pZm9ybSBmbG9hdCBmcmFtZVNoYXBlO1xcbicgK1xuXHRcdFx0XHRcdCd1bmlmb3JtIGZsb2F0IGZyYW1lTGltaXQ7XFxuJyArXG5cdFx0XHRcdFx0J3VuaWZvcm0gdmVjNCBmcmFtZUNvbG9yO1xcbicgK1xuXHRcdFx0XHRcdCdcXG4nICtcblx0XHRcdFx0XHQvL3RvZG86IG5lZWQgbXVjaCBiZXR0ZXIgcHNldWRvLXJhbmRvbSBudW1iZXIgZ2VuZXJhdG9yXG5cdFx0XHRcdFx0U2VyaW91c2x5LnV0aWwuc2hhZGVyLm5vaXNlSGVscGVycyArXG5cdFx0XHRcdFx0U2VyaW91c2x5LnV0aWwuc2hhZGVyLnNub2lzZTJkICtcblx0XHRcdFx0XHQnXFxuJyArXG5cdFx0XHRcdFx0J3ZvaWQgbWFpbih2b2lkKSB7XFxuJyArXG5cdFx0XHRcdFx0J1x0dmVjMiB0ZXhDb29yZCA9IHZUZXhDb29yZDtcXG4nICtcblxuXHRcdFx0XHRcdFx0Ly9kaXN0b3J0aW9uXG5cdFx0XHRcdFx0J1x0ZmxvYXQgZHJhbmRvbSA9IHNub2lzZSh2ZWMyKHRpbWUgKiA1MC4wLCB0ZXhDb29yZC55IC9saW5lSGVpZ2h0KSk7XFxuJyArXG5cdFx0XHRcdFx0J1x0ZmxvYXQgZGlzdG9ydEFtb3VudCA9IGRpc3RvcnRpb24gKiAoZHJhbmRvbSAtIDAuMjUpICogMC41O1xcbicgK1xuXHRcdFx0XHRcdFx0Ly9saW5lIHN5bmNcblx0XHRcdFx0XHQnXHR2ZWM0IHBhcnRpY2xlT2Zmc2V0ID0gdGV4dHVyZTJEKHBhcnRpY2xlcywgdmVjMigwLjAsIHRleENvb3JkLnkpKTtcXG4nICtcblx0XHRcdFx0XHQnXHRkaXN0b3J0QW1vdW50IC09IGxpbmVTeW5jICogKDIuMCAqIHBhcnRpY2xlT2Zmc2V0LmEgLSAwLjUpO1xcbicgK1xuXG5cdFx0XHRcdFx0J1x0dGV4Q29vcmQueCAtPSBkaXN0b3J0QW1vdW50O1xcbicgK1xuXHRcdFx0XHRcdC8vJ1x0dGV4Q29vcmQueCA9IG1heCgwLjAsIHRleENvb3JkLngpO1xcbicgK1xuXHRcdFx0XHRcdC8vJ1x0dGV4Q29vcmQueCA9IG1pbigxLjAsIHRleENvb3JkLngpO1xcbicgK1xuXHRcdFx0XHRcdCdcdHRleENvb3JkLnggPSBtb2QodGV4Q29vcmQueCwgMS4wKTtcXG4nICtcblxuXHRcdFx0XHRcdFx0Ly92ZXJ0aWNhbCBzeW5jXG5cdFx0XHRcdFx0J1x0ZmxvYXQgcm9sbDtcXG4nICtcblx0XHRcdFx0XHQnXHRpZiAodnN5bmMgIT0gMC4wKSB7XFxuJyArXG5cdFx0XHRcdFx0J1x0XHRyb2xsID0gZnJhY3QodGltZSAvIHZzeW5jKTtcXG4nICtcblx0XHRcdFx0XHQnXHRcdHRleENvb3JkLnkgPSBtb2QodGV4Q29vcmQueSAtIHJvbGwsIDEuMCk7XFxuJyArXG5cdFx0XHRcdFx0J1x0fVxcbicgK1xuXG5cdFx0XHRcdFx0J1x0dmVjNCBwaXhlbCA9IHRleHR1cmUyRChzb3VyY2UsIHRleENvb3JkKTtcXG4nICtcblxuXHRcdFx0XHRcdFx0Ly9ob3Jpem9udGFsIGJhcnNcblx0XHRcdFx0XHQnXHRmbG9hdCBiYXJzQW1vdW50ID0gcGFydGljbGVPZmZzZXQucjtcXG4nICtcblx0XHRcdFx0XHQnXHRpZiAoYmFyc0Ftb3VudCA+IDAuMCkge1xcbicgK1xuXHRcdFx0XHRcdC8qXG5cdFx0XHRcdFx0J1x0XHRwaXhlbCA9IHZlYzQoSGFyZExpZ2h0KHBpeGVsLnIgKiBiYXJzLCBiYXJzQW1vdW50KSwnICtcblx0XHRcdFx0XHRcdFx0XHQnSGFyZExpZ2h0KHBpeGVsLmcgKiBiYXJzLCBiYXJzQW1vdW50KSwnICtcblx0XHRcdFx0XHRcdFx0XHQnSGFyZExpZ2h0KHBpeGVsLmIgKiBiYXJzLCBiYXJzQW1vdW50KSwnICtcblx0XHRcdFx0XHRcdFx0XHQncGl4ZWwuYSk7XFxuJyArXG5cdFx0XHRcdFx0Ki9cblx0XHRcdFx0XHQnXHRcdHBpeGVsID0gdmVjNChwaXhlbC5yICsgYmFycyAqIGJhcnNBbW91bnQsJyArXG5cdFx0XHRcdFx0XHRcdFx0J3BpeGVsLmcgKyBiYXJzICogYmFyc0Ftb3VudCwnICtcblx0XHRcdFx0XHRcdFx0XHQncGl4ZWwuYiArIGJhcnMgKiBiYXJzQW1vdW50LCcgK1xuXHRcdFx0XHRcdFx0XHRcdCdwaXhlbC5hKTtcXG4nICtcblx0XHRcdFx0XHQnXHR9XFxuJyArXG5cblx0XHRcdFx0XHQnXHRpZiAobW9kKHRleENvb3JkLnkgLyBsaW5lSGVpZ2h0LCAyLjApIDwgMS4wICkge1xcbicgK1xuXHRcdFx0XHRcdCdcdFx0cGl4ZWwucmdiICo9ICgxLjAgLSBzY2FubGluZXMpO1xcbicgK1xuXHRcdFx0XHRcdCdcdH1cXG4nICtcblxuXHRcdFx0XHRcdCdcdGZsb2F0IGYgPSAoMS4wIC0gdlBvc2l0aW9uLnggKiB2UG9zaXRpb24ueCkgKiAoMS4wIC0gdlBvc2l0aW9uLnkgKiB2UG9zaXRpb24ueSk7XFxuJyArXG5cdFx0XHRcdFx0J1x0ZmxvYXQgZnJhbWUgPSBjbGFtcCggZnJhbWVTaGFycG5lc3MgKiAocG93KGYsIGZyYW1lU2hhcGUpIC0gZnJhbWVMaW1pdCksIDAuMCwgMS4wKTtcXG4nICtcblxuXHRcdFx0XHRcdC8vJ1x0Z2xfRnJhZ0NvbG9yLnIgPSB2ZWM0KDEuMCk7XFxuJyArXG5cblx0XHRcdFx0XHQnXHRnbF9GcmFnQ29sb3IgPSBtaXgoZnJhbWVDb2xvciwgcGl4ZWwsIGZyYW1lKTsgLy92ZWM0KHZlYzMocGFydGljbGVPZmZzZXQpLCAxLjApO1xcbicgK1xuXHRcdFx0XHRcdC8vJ1x0Z2xfRnJhZ0NvbG9yID0gdmVjNChwYXJ0aWNsZU9mZnNldCk7XFxuJyArXG5cdFx0XHRcdFx0Ly8nXHRnbF9GcmFnQ29sb3IuYSA9IDEuMDtcXG4nICtcblx0XHRcdFx0XHQnfVxcbic7XG5cblx0XHRcdFx0cmV0dXJuIHNoYWRlclNvdXJjZTtcblx0XHRcdH0sXG5cdFx0XHRyZXNpemU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cGFydGljbGVGcmFtZUJ1ZmZlci5yZXNpemUoMSwgTWF0aC5tYXgoMSwgdGhpcy5oZWlnaHQgLyAyKSk7XG5cdFx0XHR9LFxuXHRcdFx0ZHJhdzogZnVuY3Rpb24gKHNoYWRlciwgbW9kZWwsIHVuaWZvcm1zLCBmcmFtZUJ1ZmZlciwgcGFyZW50KSB7XG5cdFx0XHRcdHZhciBkb1BhcnRpY2xlcyA9IChsYXN0VGltZSAhPT0gdGhpcy5pbnB1dHMudGltZSksXG5cdFx0XHRcdFx0dnN5bmNQZXJpb2Q7XG5cblx0XHRcdFx0aWYgKGxhc3RIZWlnaHQgIT09IHRoaXMuaGVpZ2h0KSB7XG5cdFx0XHRcdFx0bGFzdEhlaWdodCA9IHRoaXMuaGVpZ2h0O1xuXHRcdFx0XHRcdGRvUGFydGljbGVzID0gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vdG9kbzogbWFrZSB0aGlzIGNvbmZpZ3VyYWJsZT9cblx0XHRcdFx0dW5pZm9ybXMubGluZUhlaWdodCA9IDEgLyB0aGlzLmhlaWdodDtcblxuXHRcdFx0XHRpZiAodGhpcy5pbnB1dHMudmVydGljYWxTeW5jKSB7XG5cdFx0XHRcdFx0dnN5bmNQZXJpb2QgPSAwLjIgLyB0aGlzLmlucHV0cy52ZXJ0aWNhbFN5bmM7XG5cdFx0XHRcdFx0dW5pZm9ybXMudnN5bmMgPSB2c3luY1BlcmlvZDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2c3luY1BlcmlvZCA9IDE7XG5cdFx0XHRcdFx0dW5pZm9ybXMudnN5bmMgPSAwO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHVuaWZvcm1zLnRpbWUgPSAodGhpcy5pbnB1dHMudGltZSAlICgxMDAwMCAqIHZzeW5jUGVyaW9kKSkgLyAxMDAwO1xuXHRcdFx0XHR1bmlmb3Jtcy5kaXN0b3J0aW9uID0gTWF0aC5yYW5kb20oKSAqIHRoaXMuaW5wdXRzLmRpc3RvcnRpb247XG5cblx0XHRcdFx0Ly9yZW5kZXIgcGFydGljbGUgY2FudmFzIGFuZCBhdHRhY2ggdW5pZm9ybVxuXHRcdFx0XHQvL3RvZG86IHRoaXMgaXMgYSBnb29kIHNwb3QgZm9yIHBhcmFsbGVsIHByb2Nlc3NpbmcuIFBhcmFsbGVsQXJyYXkgbWF5YmU/XG5cdFx0XHRcdGlmIChkb1BhcnRpY2xlcyAmJiAodGhpcy5pbnB1dHMubGluZVN5bmMgfHwgdGhpcy5pbnB1dHMuYmFycykpIHtcblx0XHRcdFx0XHRwYXJ0aWNsZVNoYWRlci51c2UoKTtcblx0XHRcdFx0XHRnbC52aWV3cG9ydCgwLCAwLCAxLCB0aGlzLmhlaWdodCAvIDIpO1xuXHRcdFx0XHRcdGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgcGFydGljbGVGcmFtZUJ1ZmZlci5mcmFtZUJ1ZmZlcik7XG5cdFx0XHRcdFx0Z2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQpO1xuXHRcdFx0XHRcdGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KHBhcnRpY2xlU2hhZGVyLmxvY2F0aW9uLnBhcnRpY2xlKTtcblx0XHRcdFx0XHRnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgcGFydGljbGVCdWZmZXIpO1xuXHRcdFx0XHRcdGdsLnZlcnRleEF0dHJpYlBvaW50ZXIocGFydGljbGVTaGFkZXIubG9jYXRpb24ucGFydGljbGUsIHBhcnRpY2xlQnVmZmVyLml0ZW1TaXplLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXHRcdFx0XHRcdGdsLmVuYWJsZShnbC5CTEVORCk7XG5cdFx0XHRcdFx0Z2wuYmxlbmRGdW5jKGdsLlNSQ19BTFBIQSwgZ2wuT05FKTtcblx0XHRcdFx0XHRwYXJ0aWNsZVNoYWRlci50aW1lLnNldCh1bmlmb3Jtcy50aW1lKTtcblx0XHRcdFx0XHRwYXJ0aWNsZVNoYWRlci5oZWlnaHQuc2V0KHRoaXMuaGVpZ2h0KTtcblx0XHRcdFx0XHRnbC5kcmF3QXJyYXlzKGdsLlBPSU5UUywgMCwgcGFydGljbGVDb3VudCk7XG5cblx0XHRcdFx0XHRsYXN0VGltZSA9IHRoaXMuaW5wdXRzLnRpbWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dW5pZm9ybXMucGFydGljbGVzID0gcGFydGljbGVGcmFtZUJ1ZmZlci50ZXh0dXJlO1xuXG5cdFx0XHRcdHBhcmVudChzaGFkZXIsIG1vZGVsLCB1bmlmb3JtcywgZnJhbWVCdWZmZXIpO1xuXHRcdFx0fSxcblx0XHRcdGRlc3Ryb3k6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cGFydGljbGVCdWZmZXIgPSBudWxsO1xuXHRcdFx0XHRpZiAocGFydGljbGVGcmFtZUJ1ZmZlcikge1xuXHRcdFx0XHRcdHBhcnRpY2xlRnJhbWVCdWZmZXIuZGVzdHJveSgpO1xuXHRcdFx0XHRcdHBhcnRpY2xlRnJhbWVCdWZmZXIgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fSxcblx0e1xuXHRcdGluUGxhY2U6IGZhbHNlLFxuXHRcdGlucHV0czoge1xuXHRcdFx0c291cmNlOiB7XG5cdFx0XHRcdHR5cGU6ICdpbWFnZScsXG5cdFx0XHRcdHVuaWZvcm06ICdzb3VyY2UnLFxuXHRcdFx0XHRzaGFkZXJEaXJ0eTogZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHR0aW1lOiB7XG5cdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHRkZWZhdWx0VmFsdWU6IDBcblx0XHRcdH0sXG5cdFx0XHRkaXN0b3J0aW9uOiB7XG5cdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHRkZWZhdWx0VmFsdWU6IDAuMSxcblx0XHRcdFx0bWluOiAwLFxuXHRcdFx0XHRtYXg6IDFcblx0XHRcdH0sXG5cdFx0XHR2ZXJ0aWNhbFN5bmM6IHtcblx0XHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRcdGRlZmF1bHRWYWx1ZTogMC4xLFxuXHRcdFx0XHRtaW46IDAsXG5cdFx0XHRcdG1heDogMVxuXHRcdFx0fSxcblx0XHRcdGxpbmVTeW5jOiB7XG5cdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHR1bmlmb3JtOiAnbGluZVN5bmMnLFxuXHRcdFx0XHRkZWZhdWx0VmFsdWU6IDAuMixcblx0XHRcdFx0bWluOiAwLFxuXHRcdFx0XHRtYXg6IDFcblx0XHRcdH0sXG5cdFx0XHRzY2FubGluZXM6IHtcblx0XHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRcdHVuaWZvcm06ICdzY2FubGluZXMnLFxuXHRcdFx0XHRkZWZhdWx0VmFsdWU6IDAuMyxcblx0XHRcdFx0bWluOiAwLFxuXHRcdFx0XHRtYXg6IDFcblx0XHRcdH0sXG5cdFx0XHRiYXJzOiB7XG5cdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHR1bmlmb3JtOiAnYmFycycsXG5cdFx0XHRcdGRlZmF1bHRWYWx1ZTogMCxcblx0XHRcdFx0bWluOiAwLFxuXHRcdFx0XHRtYXg6IDFcblx0XHRcdH0sXG5cdFx0XHRmcmFtZVNoYXBlOiB7XG5cdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHR1bmlmb3JtOiAnZnJhbWVTaGFwZScsXG5cdFx0XHRcdG1pbjogMCxcblx0XHRcdFx0bWF4OiAyLFxuXHRcdFx0XHRkZWZhdWx0VmFsdWU6IDAuMjdcblx0XHRcdH0sXG5cdFx0XHRmcmFtZUxpbWl0OiB7XG5cdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHR1bmlmb3JtOiAnZnJhbWVMaW1pdCcsXG5cdFx0XHRcdG1pbjogLTEsXG5cdFx0XHRcdG1heDogMSxcblx0XHRcdFx0ZGVmYXVsdFZhbHVlOiAwLjM0XG5cdFx0XHR9LFxuXHRcdFx0ZnJhbWVTaGFycG5lc3M6IHtcblx0XHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRcdHVuaWZvcm06ICdmcmFtZVNoYXJwbmVzcycsXG5cdFx0XHRcdG1pbjogMCxcblx0XHRcdFx0bWF4OiA0MCxcblx0XHRcdFx0ZGVmYXVsdFZhbHVlOiA4LjRcblx0XHRcdH0sXG5cdFx0XHRmcmFtZUNvbG9yOiB7XG5cdFx0XHRcdHR5cGU6ICdjb2xvcicsXG5cdFx0XHRcdHVuaWZvcm06ICdmcmFtZUNvbG9yJyxcblx0XHRcdFx0ZGVmYXVsdFZhbHVlOiBbMCwgMCwgMCwgMV1cblx0XHRcdH1cblx0XHR9LFxuXHRcdHRpdGxlOiAnVFYgR2xpdGNoJ1xuXHR9KTtcbn0pKTtcbiIsIi8qanNsaW50IGRldmVsOiB0cnVlLCBiaXR3aXNlOiB0cnVlLCBicm93c2VyOiB0cnVlLCB3aGl0ZTogdHJ1ZSwgbm9tZW46IHRydWUsIHBsdXNwbHVzOiB0cnVlLCBtYXhlcnI6IDUwLCBpbmRlbnQ6IDQsIHRvZG86IHRydWUgKi9cbi8qZ2xvYmFsIEZsb2F0MzJBcnJheSwgVWludDhBcnJheSwgVWludDE2QXJyYXksIFdlYkdMVGV4dHVyZSwgSFRNTElucHV0RWxlbWVudCwgSFRNTFNlbGVjdEVsZW1lbnQsIEhUTUxFbGVtZW50LCBXZWJHTEZyYW1lYnVmZmVyLCBIVE1MQ2FudmFzRWxlbWVudCwgV2ViR0xSZW5kZXJpbmdDb250ZXh0LCBkZWZpbmUsIG1vZHVsZSwgZXhwb3J0cyAqL1xuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHRpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG5cdFx0Ly8gTm9kZS4gRG9lcyBub3Qgd29yayB3aXRoIHN0cmljdCBDb21tb25KUywgYnV0XG5cdFx0Ly8gb25seSBDb21tb25KUy1saWtlIGVudmlyb21lbnRzIHRoYXQgc3VwcG9ydCBtb2R1bGUuZXhwb3J0cyxcblx0XHQvLyBsaWtlIE5vZGUuXG5cdFx0bW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJvb3QpO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuXHRcdC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cblx0XHRkZWZpbmUoJ3NlcmlvdXNseScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBTZXJpb3VzbHkgPSBmYWN0b3J5KHJvb3QpO1xuXHRcdFx0aWYgKCFyb290LlNlcmlvdXNseSkge1xuXHRcdFx0XHRyb290LlNlcmlvdXNseSA9IFNlcmlvdXNseTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBTZXJpb3VzbHk7XG5cdFx0fSk7XG5cdH0gZWxzZSBpZiAodHlwZW9mIHJvb3QuU2VyaW91c2x5ICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0Ly8gQnJvd3NlciBnbG9iYWxzXG5cdFx0cm9vdC5TZXJpb3VzbHkgPSBmYWN0b3J5KHJvb3QpO1xuXHR9XG59KHRoaXMsIGZ1bmN0aW9uICgpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdC8vdmFyIGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50LFxuXHQvL1x0Y29uc29sZSA9IHdpbmRvdy5jb25zb2xlLFxuXG5cdC8qXG5cdFx0R2xvYmFsIGVudmlyb25tZW50IHZhcmlhYmxlc1xuXHQqL1xuICB2YXJcblx0dGVzdENvbnRleHQsXG5cdGNvbG9yRWxlbWVudCxcblx0aW5jb21wYXRpYmlsaXR5LFxuXHRzZXJpb3VzRWZmZWN0cyA9IHt9LFxuXHRzZXJpb3VzVHJhbnNmb3JtcyA9IHt9LFxuXHRzZXJpb3VzU291cmNlcyA9IHt9LFxuXHR0aW1lb3V0cyA9IFtdLFxuXHRhbGxFZmZlY3RzQnlIb29rID0ge30sXG5cdGFsbFRyYW5zZm9ybXNCeUhvb2sgPSB7fSxcblx0YWxsU291cmNlc0J5SG9vayA9IHtcblx0XHRjYW52YXM6IFtdLFxuXHRcdGltYWdlOiBbXSxcblx0XHR2aWRlbzogW11cblx0fSxcblx0aWRlbnRpdHksXG5cdG1heFNlcmlvdXNseUlkID0gMCxcblx0bm9wID0gZnVuY3Rpb24gKCkge30sXG5cblx0Lypcblx0XHRHbG9iYWwgcmVmZXJlbmNlIHZhcmlhYmxlc1xuXHQqL1xuXG5cdC8vIGh0dHA6Ly93d3cudzMub3JnL1RSL2NzczMtY29sb3IvI3N2Zy1jb2xvclxuXHRjb2xvck5hbWVzID0ge1xuXHRcdHRyYW5zcGFyZW50OiBbMCwgMCwgMCwgMF0sXG5cdFx0YmxhY2s6IFswLCAwLCAwLCAxXSxcblx0XHRyZWQ6IFsxLCAwLCAwLCAxXSxcblx0XHRncmVlbjogWzAsIDEsIDAsIDFdLFxuXHRcdGJsdWU6IFswLCAwLCAxLCAxXSxcblx0XHR3aGl0ZTogWzEsIDEsIDEsIDFdXG5cdH0sXG5cblx0dmVjdG9yRmllbGRzID0gWyd4JywgJ3knLCAneicsICd3J10sXG5cdGNvbG9yRmllbGRzID0gWydyJywgJ2cnLCAnYicsICdhJ10sXG5cblx0Lypcblx0XHR1dGlsaXR5IGZ1bmN0aW9uc1xuXHQqL1xuXG5cdC8qXG5cdG1hdDQgbWF0cml4IGZ1bmN0aW9ucyBib3Jyb3dlZCBmcm9tIGdsLW1hdHJpeCBieSB0b2ppXG5cdGh0dHBzOi8vZ2l0aHViLmNvbS90b2ppL2dsLW1hdHJpeFxuXHRMaWNlbnNlOiBodHRwczovL2dpdGh1Yi5jb20vdG9qaS9nbC1tYXRyaXgvYmxvYi9tYXN0ZXIvTElDRU5TRS5tZFxuXHQqL1xuXHRtYXQ0ID0ge1xuXHRcdC8qXG5cdFx0ICogbWF0NC5mcnVzdHVtXG5cdFx0ICogR2VuZXJhdGVzIGEgZnJ1c3R1bSBtYXRyaXggd2l0aCB0aGUgZ2l2ZW4gYm91bmRzXG5cdFx0ICpcblx0XHQgKiBQYXJhbXM6XG5cdFx0ICogbGVmdCwgcmlnaHQgLSBzY2FsYXIsIGxlZnQgYW5kIHJpZ2h0IGJvdW5kcyBvZiB0aGUgZnJ1c3R1bVxuXHRcdCAqIGJvdHRvbSwgdG9wIC0gc2NhbGFyLCBib3R0b20gYW5kIHRvcCBib3VuZHMgb2YgdGhlIGZydXN0dW1cblx0XHQgKiBuZWFyLCBmYXIgLSBzY2FsYXIsIG5lYXIgYW5kIGZhciBib3VuZHMgb2YgdGhlIGZydXN0dW1cblx0XHQgKiBkZXN0IC0gT3B0aW9uYWwsIG1hdDQgZnJ1c3R1bSBtYXRyaXggd2lsbCBiZSB3cml0dGVuIGludG9cblx0XHQgKlxuXHRcdCAqIFJldHVybnM6XG5cdFx0ICogZGVzdCBpZiBzcGVjaWZpZWQsIGEgbmV3IG1hdDQgb3RoZXJ3aXNlXG5cdFx0ICovXG5cdFx0ZnJ1c3R1bTogZnVuY3Rpb24gKGxlZnQsIHJpZ2h0LCBib3R0b20sIHRvcCwgbmVhciwgZmFyLCBkZXN0KSB7XG5cdFx0XHRpZighZGVzdCkgeyBkZXN0ID0gbWF0NC5jcmVhdGUoKTsgfVxuXHRcdFx0dmFyIHJsID0gKHJpZ2h0IC0gbGVmdCksXG5cdFx0XHRcdHRiID0gKHRvcCAtIGJvdHRvbSksXG5cdFx0XHRcdGZuID0gKGZhciAtIG5lYXIpO1xuXHRcdFx0ZGVzdFswXSA9IChuZWFyKjIpIC8gcmw7XG5cdFx0XHRkZXN0WzFdID0gMDtcblx0XHRcdGRlc3RbMl0gPSAwO1xuXHRcdFx0ZGVzdFszXSA9IDA7XG5cdFx0XHRkZXN0WzRdID0gMDtcblx0XHRcdGRlc3RbNV0gPSAobmVhcioyKSAvIHRiO1xuXHRcdFx0ZGVzdFs2XSA9IDA7XG5cdFx0XHRkZXN0WzddID0gMDtcblx0XHRcdGRlc3RbOF0gPSAocmlnaHQgKyBsZWZ0KSAvIHJsO1xuXHRcdFx0ZGVzdFs5XSA9ICh0b3AgKyBib3R0b20pIC8gdGI7XG5cdFx0XHRkZXN0WzEwXSA9IC0oZmFyICsgbmVhcikgLyBmbjtcblx0XHRcdGRlc3RbMTFdID0gLTE7XG5cdFx0XHRkZXN0WzEyXSA9IDA7XG5cdFx0XHRkZXN0WzEzXSA9IDA7XG5cdFx0XHRkZXN0WzE0XSA9IC0oZmFyKm5lYXIqMikgLyBmbjtcblx0XHRcdGRlc3RbMTVdID0gMDtcblx0XHRcdHJldHVybiBkZXN0O1xuXHRcdH0sXG5cblx0XHRwZXJzcGVjdGl2ZTogZnVuY3Rpb24gKGZvdnksIGFzcGVjdCwgbmVhciwgZmFyLCBkZXN0KSB7XG5cdFx0XHR2YXIgdG9wID0gbmVhcipNYXRoLnRhbihmb3Z5Kk1hdGguUEkgLyAzNjAuMCksXG5cdFx0XHRcdHJpZ2h0ID0gdG9wKmFzcGVjdDtcblx0XHRcdHJldHVybiBtYXQ0LmZydXN0dW0oLXJpZ2h0LCByaWdodCwgLXRvcCwgdG9wLCBuZWFyLCBmYXIsIGRlc3QpO1xuXHRcdH0sXG5cdFx0bXVsdGlwbHk6IGZ1bmN0aW9uIChkZXN0LCBtYXQsIG1hdDIpIHtcblx0XHRcdC8vIENhY2hlIHRoZSBtYXRyaXggdmFsdWVzIChtYWtlcyBmb3IgaHVnZSBzcGVlZCBpbmNyZWFzZXMhKVxuXHRcdFx0dmFyIGEwMCA9IG1hdFswXSwgYTAxID0gbWF0WzFdLCBhMDIgPSBtYXRbMl0sIGEwMyA9IG1hdFszXSxcblx0XHRcdFx0YTEwID0gbWF0WzRdLCBhMTEgPSBtYXRbNV0sIGExMiA9IG1hdFs2XSwgYTEzID0gbWF0WzddLFxuXHRcdFx0XHRhMjAgPSBtYXRbOF0sIGEyMSA9IG1hdFs5XSwgYTIyID0gbWF0WzEwXSwgYTIzID0gbWF0WzExXSxcblx0XHRcdFx0YTMwID0gbWF0WzEyXSwgYTMxID0gbWF0WzEzXSwgYTMyID0gbWF0WzE0XSwgYTMzID0gbWF0WzE1XSxcblxuXHRcdFx0Ly8gQ2FjaGUgb25seSB0aGUgY3VycmVudCBsaW5lIG9mIHRoZSBzZWNvbmQgbWF0cml4XG5cdFx0XHRiMCA9IG1hdDJbMF0sIGIxID0gbWF0MlsxXSwgYjIgPSBtYXQyWzJdLCBiMyA9IG1hdDJbM107XG5cdFx0XHRkZXN0WzBdID0gYjAqYTAwICsgYjEqYTEwICsgYjIqYTIwICsgYjMqYTMwO1xuXHRcdFx0ZGVzdFsxXSA9IGIwKmEwMSArIGIxKmExMSArIGIyKmEyMSArIGIzKmEzMTtcblx0XHRcdGRlc3RbMl0gPSBiMCphMDIgKyBiMSphMTIgKyBiMiphMjIgKyBiMyphMzI7XG5cdFx0XHRkZXN0WzNdID0gYjAqYTAzICsgYjEqYTEzICsgYjIqYTIzICsgYjMqYTMzO1xuXG5cdFx0XHRiMCA9IG1hdDJbNF07XG5cdFx0XHRiMSA9IG1hdDJbNV07XG5cdFx0XHRiMiA9IG1hdDJbNl07XG5cdFx0XHRiMyA9IG1hdDJbN107XG5cdFx0XHRkZXN0WzRdID0gYjAqYTAwICsgYjEqYTEwICsgYjIqYTIwICsgYjMqYTMwO1xuXHRcdFx0ZGVzdFs1XSA9IGIwKmEwMSArIGIxKmExMSArIGIyKmEyMSArIGIzKmEzMTtcblx0XHRcdGRlc3RbNl0gPSBiMCphMDIgKyBiMSphMTIgKyBiMiphMjIgKyBiMyphMzI7XG5cdFx0XHRkZXN0WzddID0gYjAqYTAzICsgYjEqYTEzICsgYjIqYTIzICsgYjMqYTMzO1xuXG5cdFx0XHRiMCA9IG1hdDJbOF07XG5cdFx0XHRiMSA9IG1hdDJbOV07XG5cdFx0XHRiMiA9IG1hdDJbMTBdO1xuXHRcdFx0YjMgPSBtYXQyWzExXTtcblx0XHRcdGRlc3RbOF0gPSBiMCphMDAgKyBiMSphMTAgKyBiMiphMjAgKyBiMyphMzA7XG5cdFx0XHRkZXN0WzldID0gYjAqYTAxICsgYjEqYTExICsgYjIqYTIxICsgYjMqYTMxO1xuXHRcdFx0ZGVzdFsxMF0gPSBiMCphMDIgKyBiMSphMTIgKyBiMiphMjIgKyBiMyphMzI7XG5cdFx0XHRkZXN0WzExXSA9IGIwKmEwMyArIGIxKmExMyArIGIyKmEyMyArIGIzKmEzMztcblxuXHRcdFx0YjAgPSBtYXQyWzEyXTtcblx0XHRcdGIxID0gbWF0MlsxM107XG5cdFx0XHRiMiA9IG1hdDJbMTRdO1xuXHRcdFx0YjMgPSBtYXQyWzE1XTtcblx0XHRcdGRlc3RbMTJdID0gYjAqYTAwICsgYjEqYTEwICsgYjIqYTIwICsgYjMqYTMwO1xuXHRcdFx0ZGVzdFsxM10gPSBiMCphMDEgKyBiMSphMTEgKyBiMiphMjEgKyBiMyphMzE7XG5cdFx0XHRkZXN0WzE0XSA9IGIwKmEwMiArIGIxKmExMiArIGIyKmEyMiArIGIzKmEzMjtcblx0XHRcdGRlc3RbMTVdID0gYjAqYTAzICsgYjEqYTEzICsgYjIqYTIzICsgYjMqYTMzO1xuXG5cdFx0XHRyZXR1cm4gZGVzdDtcblx0XHR9LFxuXHRcdGlkZW50aXR5OiBmdW5jdGlvbiAoZGVzdCkge1xuXHRcdFx0ZGVzdFswXSA9IDE7XG5cdFx0XHRkZXN0WzFdID0gMDtcblx0XHRcdGRlc3RbMl0gPSAwO1xuXHRcdFx0ZGVzdFszXSA9IDA7XG5cdFx0XHRkZXN0WzRdID0gMDtcblx0XHRcdGRlc3RbNV0gPSAxO1xuXHRcdFx0ZGVzdFs2XSA9IDA7XG5cdFx0XHRkZXN0WzddID0gMDtcblx0XHRcdGRlc3RbOF0gPSAwO1xuXHRcdFx0ZGVzdFs5XSA9IDA7XG5cdFx0XHRkZXN0WzEwXSA9IDE7XG5cdFx0XHRkZXN0WzExXSA9IDA7XG5cdFx0XHRkZXN0WzEyXSA9IDA7XG5cdFx0XHRkZXN0WzEzXSA9IDA7XG5cdFx0XHRkZXN0WzE0XSA9IDA7XG5cdFx0XHRkZXN0WzE1XSA9IDE7XG5cdFx0XHRyZXR1cm4gZGVzdDtcblx0XHR9LFxuXHRcdGNvcHk6IGZ1bmN0aW9uIChvdXQsIGEpIHtcblx0XHRcdG91dFswXSA9IGFbMF07XG5cdFx0XHRvdXRbMV0gPSBhWzFdO1xuXHRcdFx0b3V0WzJdID0gYVsyXTtcblx0XHRcdG91dFszXSA9IGFbM107XG5cdFx0XHRvdXRbNF0gPSBhWzRdO1xuXHRcdFx0b3V0WzVdID0gYVs1XTtcblx0XHRcdG91dFs2XSA9IGFbNl07XG5cdFx0XHRvdXRbN10gPSBhWzddO1xuXHRcdFx0b3V0WzhdID0gYVs4XTtcblx0XHRcdG91dFs5XSA9IGFbOV07XG5cdFx0XHRvdXRbMTBdID0gYVsxMF07XG5cdFx0XHRvdXRbMTFdID0gYVsxMV07XG5cdFx0XHRvdXRbMTJdID0gYVsxMl07XG5cdFx0XHRvdXRbMTNdID0gYVsxM107XG5cdFx0XHRvdXRbMTRdID0gYVsxNF07XG5cdFx0XHRvdXRbMTVdID0gYVsxNV07XG5cdFx0XHRyZXR1cm4gb3V0O1xuXHRcdH1cblx0fSxcblxuXHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSAoZnVuY3Rpb24gKCl7XG5cdFx0dmFyIGxhc3RUaW1lID0gMDtcblx0XHRyZXR1cm4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcblx0XHRcdFx0d2luZG93LndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxuXHRcdFx0XHR3aW5kb3cubW96UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XG5cdFx0XHRcdHdpbmRvdy5vUmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XG5cdFx0XHRcdHdpbmRvdy5tc1JlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxuXHRcdFx0XHRmdW5jdGlvbiAoY2FsbGJhY2spIHtcblx0XHRcdFx0XHR2YXIgY3VyclRpbWUsIHRpbWVUb0NhbGwsIGlkO1xuXG5cdFx0XHRcdFx0ZnVuY3Rpb24gdGltZW91dENhbGxiYWNrKCkge1xuXHRcdFx0XHRcdFx0Y2FsbGJhY2soY3VyclRpbWUgKyB0aW1lVG9DYWxsKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjdXJyVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuXHRcdFx0XHRcdHRpbWVUb0NhbGwgPSBNYXRoLm1heCgwLCAxNiAtIChjdXJyVGltZSAtIGxhc3RUaW1lKSk7XG5cdFx0XHRcdFx0aWQgPSB3aW5kb3cuc2V0VGltZW91dCh0aW1lb3V0Q2FsbGJhY2ssIHRpbWVUb0NhbGwpO1xuXHRcdFx0XHRcdGxhc3RUaW1lID0gY3VyclRpbWUgKyB0aW1lVG9DYWxsO1xuXHRcdFx0XHRcdHJldHVybiBpZDtcblx0XHRcdFx0fTtcblx0fSgpKSxcblxuXHRjYW5jZWxBbmltRnJhbWUgPSAoZnVuY3Rpb24gKCl7XG5cdFx0cmV0dXJuICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUgfHxcblx0XHRcdFx0d2luZG93LndlYmtpdENhbmNlbEFuaW1hdGlvbkZyYW1lIHx8XG5cdFx0XHRcdHdpbmRvdy5tb3pDYW5jZWxBbmltYXRpb25GcmFtZSB8fFxuXHRcdFx0XHR3aW5kb3cub0NhbmNlbEFuaW1hdGlvbkZyYW1lIHx8XG5cdFx0XHRcdHdpbmRvdy5tc0NhbmNlbEFuaW1hdGlvbkZyYW1lIHx8XG5cdFx0XHRcdGZ1bmN0aW9uIChpZCkge1xuXHRcdFx0XHRcdHdpbmRvdy5jYW5jZWxUaW1lb3V0KGlkKTtcblx0XHRcdFx0fTtcblx0fSgpKSxcblxuXHRyZXNlcnZlZE5hbWVzID0gWydzb3VyY2UnLCAndGFyZ2V0JywgJ2VmZmVjdCcsICdlZmZlY3RzJywgJ2JlbmNobWFyaycsICdpbmNvbXBhdGlibGUnLFxuXHRcdCd1dGlsJywgJ1NoYWRlclByb2dyYW0nLCAnaW5wdXRWYWxpZGF0b3JzJywgJ3NhdmUnLCAnbG9hZCcsXG5cdFx0J3BsdWdpbicsICdyZW1vdmVQbHVnaW4nLCAnYWxpYXMnLCAncmVtb3ZlQWxpYXMnLCAnc3RvcCcsICdnbycsXG5cdFx0J2Rlc3Ryb3knLCAnaXNEZXN0cm95ZWQnXTtcblxuXHRmdW5jdGlvbiBnZXRFbGVtZW50KGlucHV0LCB0YWdzKSB7XG5cdFx0dmFyIGVsZW1lbnQsXG5cdFx0XHR0YWc7XG5cdFx0aWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdC8vZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlucHV0KSB8fCBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShpbnB1dClbMF07XG5cdFx0XHRlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihpbnB1dCk7XG5cdFx0fSBlbHNlIGlmICghaW5wdXQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoaW5wdXQudGFnTmFtZSkge1xuXHRcdFx0ZWxlbWVudCA9IGlucHV0O1xuXHRcdH1cblxuXHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIGlucHV0O1xuXHRcdH1cblxuXHRcdHRhZyA9IGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xuXHRcdGlmICh0YWdzICYmIHRhZ3MuaW5kZXhPZih0YWcpIDwgMCkge1xuXHRcdFx0cmV0dXJuIGlucHV0O1xuXHRcdH1cblxuXHRcdHJldHVybiBlbGVtZW50O1xuXHR9XG5cblx0ZnVuY3Rpb24gZXh0ZW5kKGRlc3QsIHNyYykge1xuXHRcdHZhciBwcm9wZXJ0eSxcblx0XHRcdGRlc2NyaXB0b3I7XG5cblx0XHQvL3RvZG86IGFyZSB3ZSBzdXJlIHRoaXMgaXMgc2FmZT9cblx0XHRpZiAoZGVzdC5wcm90b3R5cGUgJiYgc3JjLnByb3RvdHlwZSAmJiBkZXN0LnByb3RvdHlwZSAhPT0gc3JjLnByb3RvdHlwZSkge1xuXHRcdFx0ZXh0ZW5kKGRlc3QucHJvdG90eXBlLCBzcmMucHJvdG90eXBlKTtcblx0XHR9XG5cblx0XHRmb3IgKHByb3BlcnR5IGluIHNyYykge1xuXHRcdFx0aWYgKHNyYy5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcblx0XHRcdFx0ZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Ioc3JjLCBwcm9wZXJ0eSk7XG5cblx0XHRcdFx0aWYgKGRlc2NyaXB0b3IuZ2V0IHx8IGRlc2NyaXB0b3Iuc2V0KSB7XG5cdFx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGRlc3QsIHByb3BlcnR5LCB7XG5cdFx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0Z2V0OiBkZXNjcmlwdG9yLmdldCxcblx0XHRcdFx0XHRcdHNldDogZGVzY3JpcHRvci5zZXRcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZXN0W3Byb3BlcnR5XSA9IHNyY1twcm9wZXJ0eV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZGVzdDtcblx0fVxuXG5cdC8vaHR0cDovL3d3dy53My5vcmcvVFIvY3NzMy1jb2xvci8jaHNsLWNvbG9yXG5cdGZ1bmN0aW9uIGhzbFRvUmdiKGgsIHMsIGwsIGEsIG91dCkge1xuXHRcdGZ1bmN0aW9uIGh1ZVRvUmdiKG0xLCBtMiwgaCkge1xuXHRcdFx0aCA9IGggJSAxO1xuXHRcdFx0aWYgKGggPCAwKSB7XG5cdFx0XHRcdGggKz0gMTtcblx0XHRcdH1cblx0XHRcdGlmIChoIDwgMSAvIDYpIHtcblx0XHRcdFx0cmV0dXJuIG0xICsgKG0yIC0gbTEpICogaCAqIDY7XG5cdFx0XHR9XG5cdFx0XHRpZiAoaCA8IDEgLyAyKSB7XG5cdFx0XHRcdHJldHVybiBtMjtcblx0XHRcdH1cblx0XHRcdGlmIChoIDwgMiAvIDMpIHtcblx0XHRcdFx0cmV0dXJuIG0xICsgKG0yIC0gbTEpICogKDIvMyAtIGgpICogNjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBtMTtcblx0XHR9XG5cblx0XHR2YXIgbTEsIG0yO1xuXHRcdGlmIChsIDwgMC41KSB7XG5cdFx0XHRtMiA9IGwgKiAocyArIDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtMiA9IGwgKyBzIC0gbCAqIHM7XG5cdFx0fVxuXHRcdG0xID0gbCAqIDIgLSBtMjtcblxuXHRcdGlmICghb3V0KSB7XG5cdFx0XHRvdXQgPSBbXTtcblx0XHR9XG5cblx0XHRvdXRbMF0gPSBodWVUb1JnYihtMSwgbTIsIGggKyAxLzMpO1xuXHRcdG91dFsxXSA9IGh1ZVRvUmdiKG0xLCBtMiwgaCk7XG5cdFx0b3V0WzJdID0gaHVlVG9SZ2IobTEsIG0yLCBoIC0gMS8zKTtcblx0XHRvdXRbM10gPSBhO1xuXG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cdC8qXG5cdGZhc3RlciB0aGFuIHNldFRpbWVvdXQoZm4sIDApO1xuXHRodHRwOi8vZGJhcm9uLm9yZy9sb2cvMjAxMDAzMDktZmFzdGVyLXRpbWVvdXRzXG5cdCovXG5cdGZ1bmN0aW9uIHNldFRpbWVvdXRaZXJvKGZuKSB7XG5cdFx0Lypcblx0XHRXb3JrYXJvdW5kIGZvciBwb3N0TWVzc2FnZSBidWcgaW4gRmlyZWZveCBpZiB0aGUgcGFnZSBpcyBsb2FkZWQgZnJvbSB0aGUgZmlsZSBzeXN0ZW1cblx0XHRodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD03NDA1NzZcblx0XHRTaG91bGQgcnVuIGZpbmUsIGJ1dCBtYXliZSBhIGZldyBtaWxsaXNlY29uZHMgc2xvd2VyIHBlciBmcmFtZS5cblx0XHQqL1xuXHRcdGZ1bmN0aW9uIHRpbWVvdXRGdW5jdGlvbigpIHtcblx0XHRcdGlmICh0aW1lb3V0cy5sZW5ndGgpIHtcblx0XHRcdFx0KHRpbWVvdXRzLnNoaWZ0KCkpKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0dGhyb3cgJ3NldFRpbWVvdXRaZXJvIGFyZ3VtZW50IGlzIG5vdCBhIGZ1bmN0aW9uJztcblx0XHR9XG5cblx0XHR0aW1lb3V0cy5wdXNoKGZuKTtcblx0XHRpZiAod2luZG93LmxvY2F0aW9uLnByb3RvY29sID09PSAnZmlsZTonKSB7XG5cdFx0XHRzZXRUaW1lb3V0KHRpbWVvdXRGdW5jdGlvbiwgMCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0d2luZG93LnBvc3RNZXNzYWdlKCdzZXJpb3VzbHktdGltZW91dC1tZXNzYWdlJywgd2luZG93LmxvY2F0aW9uKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGlzQXJyYXlMaWtlKG9iaikge1xuXHRcdHJldHVybiBBcnJheS5pc0FycmF5KG9iaikgfHxcblx0XHRcdChvYmogJiYgb2JqLkJZVEVTX1BFUl9FTEVNRU5UICYmICdsZW5ndGgnIGluIG9iaik7XG5cdH1cblxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldmVudCkge1xuXHRcdGlmIChldmVudC5zb3VyY2UgPT09IHdpbmRvdyAmJiBldmVudC5kYXRhID09PSAnc2VyaW91c2x5LXRpbWVvdXQtbWVzc2FnZScpIHtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0aWYgKHRpbWVvdXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dmFyIGZuID0gdGltZW91dHMuc2hpZnQoKTtcblx0XHRcdFx0Zm4oKTtcblx0XHRcdH1cblx0XHR9XG5cdH0sIHRydWUpO1xuXG5cdGZ1bmN0aW9uIGdldFRlc3RDb250ZXh0KCkge1xuXHRcdHZhciBjYW52YXM7XG5cblx0XHRpZiAodGVzdENvbnRleHQgfHwgIXdpbmRvdy5XZWJHTFJlbmRlcmluZ0NvbnRleHQpIHtcblx0XHRcdHJldHVybiB0ZXN0Q29udGV4dDtcblx0XHR9XG5cblx0XHRjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcblx0XHR0cnkge1xuXHRcdFx0dGVzdENvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnd2ViZ2wnKTtcblx0XHR9IGNhdGNoICh3ZWJnbEVycm9yKSB7XG5cdFx0fVxuXG5cdFx0aWYgKCF0ZXN0Q29udGV4dCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGVzdENvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJyk7XG5cdFx0XHR9IGNhdGNoIChleHBXZWJnbEVycm9yKSB7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRlc3RDb250ZXh0KSB7XG5cdFx0XHRjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignd2ViZ2xjb250ZXh0bG9zdCcsIGZ1bmN0aW9uIChldmVudCkge1xuXHRcdFx0XHQvKlxuXHRcdFx0XHRJZi9XaGVuIGNvbnRleHQgaXMgbG9zdCwganVzdCBjbGVhciB0ZXN0Q29udGV4dCBhbmQgY3JlYXRlXG5cdFx0XHRcdGEgbmV3IG9uZSB0aGUgbmV4dCB0aW1lIGl0J3MgbmVlZGVkXG5cdFx0XHRcdCovXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGlmICh0ZXN0Q29udGV4dCAmJiB0ZXN0Q29udGV4dC5jYW52YXMgPT09IHRoaXMpIHtcblx0XHRcdFx0XHR0ZXN0Q29udGV4dCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSwgZmFsc2UpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLmxvZygnVW5hYmxlIHRvIGFjY2VzcyBXZWJHTC4nKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGVzdENvbnRleHQ7XG5cdH1cblxuXHRmdW5jdGlvbiBjaGVja1NvdXJjZShzb3VyY2UpIHtcblx0XHR2YXIgZWxlbWVudCwgY2FudmFzLCBjdHgsIHRleHR1cmU7XG5cblx0XHQvL3RvZG86IGRvbid0IG5lZWQgdG8gY3JlYXRlIGEgbmV3IGFycmF5IGV2ZXJ5IHRpbWUgd2UgZG8gdGhpc1xuXHRcdGVsZW1lbnQgPSBnZXRFbGVtZW50KHNvdXJjZSwgWydpbWcnLCAnY2FudmFzJywgJ3ZpZGVvJ10pO1xuXHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXHRcdGlmICghY2FudmFzKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnQnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IGNhbnZhcyBvciBTZXJpb3VzbHkuanMnKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjdHggPSBnZXRUZXN0Q29udGV4dCgpO1xuXG5cdFx0aWYgKGN0eCkge1xuXHRcdFx0dGV4dHVyZSA9IGN0eC5jcmVhdGVUZXh0dXJlKCk7XG5cdFx0XHRjdHguYmluZFRleHR1cmUoY3R4LlRFWFRVUkVfMkQsIHRleHR1cmUpO1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjdHgudGV4SW1hZ2UyRChjdHguVEVYVFVSRV8yRCwgMCwgY3R4LlJHQkEsIGN0eC5SR0JBLCBjdHguVU5TSUdORURfQllURSwgZWxlbWVudCk7XG5cdFx0XHR9IGNhdGNoICh0ZXh0dXJlRXJyb3IpIHtcblx0XHRcdFx0aWYgKHRleHR1cmVFcnJvci5jb2RlID09PSB3aW5kb3cuRE9NRXhjZXB0aW9uLlNFQ1VSSVRZX0VSUikge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdVbmFibGUgdG8gYWNjZXNzIGNyb3NzLWRvbWFpbiBpbWFnZScpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdFcnJvcjogJyArIHRleHR1cmVFcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjdHguZGVsZXRlVGV4dHVyZSh0ZXh0dXJlKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Y3R4LmRlbGV0ZVRleHR1cmUodGV4dHVyZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y3R4LmRyYXdJbWFnZShlbGVtZW50LCAwLCAwKTtcblx0XHRcdFx0Y3R4LmdldEltYWdlRGF0YSgwLCAwLCAxLCAxKTtcblx0XHRcdH0gY2F0Y2ggKGRyYXdJbWFnZUVycm9yKSB7XG5cdFx0XHRcdGlmIChkcmF3SW1hZ2VFcnJvci5jb2RlID09PSB3aW5kb3cuRE9NRXhjZXB0aW9uLlNFQ1VSSVRZX0VSUikge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdVbmFibGUgdG8gYWNjZXNzIGNyb3NzLWRvbWFpbiBpbWFnZScpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdFcnJvcjogJyArIGRyYXdJbWFnZUVycm9yLm1lc3NhZ2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBUaGlzIG1ldGhvZCB3aWxsIHJldHVybiBhIGZhbHNlIHBvc2l0aXZlIGZvciByZXNvdXJjZXMgdGhhdCBhcmVuJ3Rcblx0XHQvLyBhY3R1YWxseSBpbWFnZXMgb3IgaGF2ZW4ndCBsb2FkZWQgeWV0XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGZ1bmN0aW9uIHZhbGlkYXRlSW5wdXRTcGVjcyhlZmZlY3QpIHtcblx0XHR2YXIgcmVzZXJ2ZWQgPSBbJ3JlbmRlcicsICdpbml0aWFsaXplJywgJ29yaWdpbmFsJywgJ3BsdWdpbicsICdhbGlhcycsXG5cdFx0XHQncHJvdG90eXBlJywgJ2Rlc3Ryb3knLCAnaXNEZXN0cm95ZWQnXSxcblx0XHRcdGlucHV0LFxuXHRcdFx0bmFtZTtcblxuXHRcdGZ1bmN0aW9uIG5vcCh2YWx1ZSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH1cblxuXHRcdGZvciAobmFtZSBpbiBlZmZlY3QuaW5wdXRzKSB7XG5cdFx0XHRpZiAoZWZmZWN0LmlucHV0cy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuXHRcdFx0XHRpZiAocmVzZXJ2ZWQuaW5kZXhPZihuYW1lKSA+PSAwIHx8IE9iamVjdC5wcm90b3R5cGVbbmFtZV0pIHtcblx0XHRcdFx0XHR0aHJvdyAnUmVzZXJ2ZWQgZWZmZWN0IGlucHV0IG5hbWU6ICcgKyBuYW1lO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aW5wdXQgPSBlZmZlY3QuaW5wdXRzW25hbWVdO1xuXG5cdFx0XHRcdGlmIChpc05hTihpbnB1dC5taW4pKSB7XG5cdFx0XHRcdFx0aW5wdXQubWluID0gLUluZmluaXR5O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGlzTmFOKGlucHV0Lm1heCkpIHtcblx0XHRcdFx0XHRpbnB1dC5tYXggPSBJbmZpbml0eTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpc05hTihpbnB1dC5taW5Db3VudCkpIHtcblx0XHRcdFx0XHRpbnB1dC5taW5Db3VudCA9IC1JbmZpbml0eTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpc05hTihpbnB1dC5tYXhDb3VudCkpIHtcblx0XHRcdFx0XHRpbnB1dC5tYXhDb3VudCA9IEluZmluaXR5O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGlzTmFOKGlucHV0LnN0ZXApKSB7XG5cdFx0XHRcdFx0aW5wdXQuc3RlcCA9IDA7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaW5wdXQuZGVmYXVsdFZhbHVlID09PSB1bmRlZmluZWQgfHwgaW5wdXQuZGVmYXVsdFZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRcdFx0aWYgKGlucHV0LnR5cGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHRpbnB1dC5kZWZhdWx0VmFsdWUgPSBNYXRoLm1pbihNYXRoLm1heCgwLCBpbnB1dC5taW4pLCBpbnB1dC5tYXgpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaW5wdXQudHlwZSA9PT0gJ2NvbG9yJykge1xuXHRcdFx0XHRcdFx0aW5wdXQuZGVmYXVsdFZhbHVlID0gWzAsIDAsIDAsIDBdO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaW5wdXQudHlwZSA9PT0gJ2VudW0nKSB7XG5cdFx0XHRcdFx0XHRpZiAoaW5wdXQub3B0aW9ucyAmJiBpbnB1dC5vcHRpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHRpbnB1dC5kZWZhdWx0VmFsdWUgPSBpbnB1dC5vcHRpb25zWzBdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0aW5wdXQuZGVmYXVsdFZhbHVlID0gJyc7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChpbnB1dC50eXBlID09PSAnYm9vbGVhbicpIHtcblx0XHRcdFx0XHRcdGlucHV0LmRlZmF1bHRWYWx1ZSA9IGZhbHNlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpbnB1dC5kZWZhdWx0VmFsdWUgPSAnJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaW5wdXQudHlwZSA9PT0gJ3ZlY3RvcicpIHtcblx0XHRcdFx0XHRpZiAoaW5wdXQuZGltZW5zaW9ucyA8IDIpIHtcblx0XHRcdFx0XHRcdGlucHV0LmRpbWVuc2lvbnMgPSAyO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaW5wdXQuZGltZW5zaW9ucyA+IDQpIHtcblx0XHRcdFx0XHRcdGlucHV0LmRpbWVuc2lvbnMgPSA0O1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIWlucHV0LmRpbWVuc2lvbnMgfHwgaXNOYU4oaW5wdXQuZGltZW5zaW9ucykpIHtcblx0XHRcdFx0XHRcdGlucHV0LmRpbWVuc2lvbnMgPSA0O1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpbnB1dC5kaW1lbnNpb25zID0gTWF0aC5yb3VuZChpbnB1dC5kaW1lbnNpb25zKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW5wdXQuZGltZW5zaW9ucyA9IDE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpbnB1dC5zaGFkZXJEaXJ0eSA9ICEhaW5wdXQuc2hhZGVyRGlydHk7XG5cblx0XHRcdFx0aWYgKHR5cGVvZiBpbnB1dC52YWxpZGF0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdGlucHV0LnZhbGlkYXRlID0gU2VyaW91c2x5LmlucHV0VmFsaWRhdG9yc1tpbnB1dC50eXBlXSB8fCBub3A7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWVmZmVjdC5kZWZhdWx0SW1hZ2VJbnB1dCAmJiBpbnB1dC50eXBlID09PSAnaW1hZ2UnKSB7XG5cdFx0XHRcdFx0ZWZmZWN0LmRlZmF1bHRJbWFnZUlucHV0ID0gbmFtZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdFx0aGVscGVyIENsYXNzZXNcblx0Ki9cblxuXHRmdW5jdGlvbiBGcmFtZUJ1ZmZlcihnbCwgd2lkdGgsIGhlaWdodCwgb3B0aW9ucykge1xuXHRcdHZhciBmcmFtZUJ1ZmZlcixcblx0XHRcdHJlbmRlckJ1ZmZlcixcblx0XHRcdHRleCxcblx0XHRcdHN0YXR1cyxcblx0XHRcdHVzZUZsb2F0ID0gb3B0aW9ucyA9PT0gdHJ1ZSA/IG9wdGlvbnMgOiAob3B0aW9ucyAmJiBvcHRpb25zLnVzZUZsb2F0KTtcblxuXHRcdHVzZUZsb2F0ID0gZmFsc2U7Ly91c2VGbG9hdCAmJiAhIWdsLmdldEV4dGVuc2lvbihcIk9FU190ZXh0dXJlX2Zsb2F0XCIpOyAvL3VzZUZsb2F0IGlzIG5vdCByZWFkeSFcblx0XHRpZiAodXNlRmxvYXQpIHtcblx0XHRcdHRoaXMudHlwZSA9IGdsLkZMT0FUO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnR5cGUgPSBnbC5VTlNJR05FRF9CWVRFO1xuXHRcdH1cblxuXHRcdGZyYW1lQnVmZmVyID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKTtcblx0XHRnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIGZyYW1lQnVmZmVyKTtcblxuXHRcdGlmIChvcHRpb25zICYmIG9wdGlvbnMudGV4dHVyZSkge1xuXHRcdFx0dGhpcy50ZXh0dXJlID0gb3B0aW9ucy50ZXh0dXJlO1xuXHRcdFx0Z2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGhpcy50ZXh0dXJlKTtcblx0XHRcdHRoaXMub3duVGV4dHVyZSA9IGZhbHNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG5cdFx0XHRnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0aGlzLnRleHR1cmUpO1xuXHRcdFx0Z2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMLCBmYWxzZSk7XG5cdFx0XHRnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTElORUFSKTtcblx0XHRcdGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5MSU5FQVIpO1xuXHRcdFx0Z2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSk7XG5cdFx0XHRnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcblx0XHRcdHRoaXMub3duVGV4dHVyZSA9IHRydWU7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGlmICh0aGlzLnR5cGUgPT09IGdsLkZMT0FUKSB7XG5cdFx0XHRcdHRleCA9IG5ldyBGbG9hdDMyQXJyYXkod2lkdGggKiBoZWlnaHQgKiA0KTtcblx0XHRcdFx0Z2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCB3aWR0aCwgaGVpZ2h0LCAwLCBnbC5SR0JBLCBnbC5GTE9BVCwgdGV4KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgd2lkdGgsIGhlaWdodCwgMCwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgbnVsbCk7XG5cdFx0XHRcdHRoaXMudHlwZSA9IGdsLlVOU0lHTkVEX0JZVEU7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Ly8gTnVsbCByZWplY3RlZFxuXHRcdFx0dGhpcy50eXBlID0gZ2wuVU5TSUdORURfQllURTtcblx0XHRcdHRleCA9IG5ldyBVaW50OEFycmF5KHdpZHRoICogaGVpZ2h0ICogNCk7XG5cdFx0XHRnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIHdpZHRoLCBoZWlnaHQsIDAsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIHRleCk7XG5cdFx0fVxuXG5cdFx0cmVuZGVyQnVmZmVyID0gZ2wuY3JlYXRlUmVuZGVyYnVmZmVyKCk7XG5cdFx0Z2wuYmluZFJlbmRlcmJ1ZmZlcihnbC5SRU5ERVJCVUZGRVIsIHJlbmRlckJ1ZmZlcik7XG5cdFx0Z2wucmVuZGVyYnVmZmVyU3RvcmFnZShnbC5SRU5ERVJCVUZGRVIsIGdsLkRFUFRIX0NPTVBPTkVOVDE2LCB3aWR0aCwgaGVpZ2h0KTtcblx0XHRnbC5mcmFtZWJ1ZmZlclJlbmRlcmJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZ2wuREVQVEhfQVRUQUNITUVOVCwgZ2wuUkVOREVSQlVGRkVSLCByZW5kZXJCdWZmZXIpO1xuXG5cdFx0Z2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCB0aGlzLnRleHR1cmUsIDApO1xuXG5cdFx0c3RhdHVzID0gZ2wuY2hlY2tGcmFtZWJ1ZmZlclN0YXR1cyhnbC5GUkFNRUJVRkZFUik7XG5cblx0XHRpZiAoc3RhdHVzID09PSBnbC5GUkFNRUJVRkZFUl9JTkNPTVBMRVRFX0FUVEFDSE1FTlQpIHtcblx0XHRcdHRocm93KCdJbmNvbXBsZXRlIGZyYW1lYnVmZmVyOiBGUkFNRUJVRkZFUl9JTkNPTVBMRVRFX0FUVEFDSE1FTlQnKTtcblx0XHR9XG5cblx0XHRpZiAoc3RhdHVzID09PSBnbC5GUkFNRUJVRkZFUl9JTkNPTVBMRVRFX01JU1NJTkdfQVRUQUNITUVOVCkge1xuXHRcdFx0dGhyb3coJ0luY29tcGxldGUgZnJhbWVidWZmZXI6IEZSQU1FQlVGRkVSX0lOQ09NUExFVEVfTUlTU0lOR19BVFRBQ0hNRU5UJyk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0YXR1cyA9PT0gZ2wuRlJBTUVCVUZGRVJfSU5DT01QTEVURV9ESU1FTlNJT05TKSB7XG5cdFx0XHR0aHJvdygnSW5jb21wbGV0ZSBmcmFtZWJ1ZmZlcjogRlJBTUVCVUZGRVJfSU5DT01QTEVURV9ESU1FTlNJT05TJyk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0YXR1cyA9PT0gZ2wuRlJBTUVCVUZGRVJfVU5TVVBQT1JURUQpIHtcblx0XHRcdHRocm93KCdJbmNvbXBsZXRlIGZyYW1lYnVmZmVyOiBGUkFNRUJVRkZFUl9VTlNVUFBPUlRFRCcpO1xuXHRcdH1cblxuXHRcdGlmIChzdGF0dXMgIT09IGdsLkZSQU1FQlVGRkVSX0NPTVBMRVRFKSB7XG5cdFx0XHR0aHJvdygnSW5jb21wbGV0ZSBmcmFtZWJ1ZmZlcjogJyArIHN0YXR1cyk7XG5cdFx0fVxuXG5cdFx0Ly9jbGVhbiB1cFxuXHRcdGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIG51bGwpO1xuXHRcdGdsLmJpbmRSZW5kZXJidWZmZXIoZ2wuUkVOREVSQlVGRkVSLCBudWxsKTtcblx0XHRnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIG51bGwpO1xuXG5cdFx0dGhpcy5nbCA9IGdsO1xuXHRcdHRoaXMuZnJhbWVCdWZmZXIgPSBmcmFtZUJ1ZmZlcjtcblx0XHR0aGlzLnJlbmRlckJ1ZmZlciA9IHJlbmRlckJ1ZmZlcjtcblx0XHR0aGlzLndpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cdH1cblxuXHRGcmFtZUJ1ZmZlci5wcm90b3R5cGUucmVzaXplID0gZnVuY3Rpb24gKHdpZHRoLCBoZWlnaHQpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0aWYgKHRoaXMud2lkdGggPT09IHdpZHRoICYmIHRoaXMuaGVpZ2h0ID09PSBoZWlnaHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLndpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cblx0XHRpZiAoIWdsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Z2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGhpcy50ZXh0dXJlKTtcblx0XHRnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuZnJhbWVCdWZmZXIpO1xuXHRcdGdsLmJpbmRSZW5kZXJidWZmZXIoZ2wuUkVOREVSQlVGRkVSLCB0aGlzLnJlbmRlckJ1ZmZlcik7XG5cblx0XHQvL3RvZG86IGhhbmRsZSBmbG9hdFxuXHRcdGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgd2lkdGgsIGhlaWdodCwgMCwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgbnVsbCk7XG5cdFx0Z2wucmVuZGVyYnVmZmVyU3RvcmFnZShnbC5SRU5ERVJCVUZGRVIsIGdsLkRFUFRIX0NPTVBPTkVOVDE2LCB3aWR0aCwgaGVpZ2h0KTtcblx0XHRnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHRoaXMudGV4dHVyZSwgMCk7XG5cblx0XHRnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBudWxsKTtcblx0XHRnbC5iaW5kUmVuZGVyYnVmZmVyKGdsLlJFTkRFUkJVRkZFUiwgbnVsbCk7XG5cdFx0Z2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBudWxsKTtcblx0fTtcblxuXHRGcmFtZUJ1ZmZlci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0aWYgKGdsKSB7XG5cdFx0XHRnbC5kZWxldGVGcmFtZWJ1ZmZlcih0aGlzLmZyYW1lQnVmZmVyKTtcblx0XHRcdGdsLmRlbGV0ZVJlbmRlcmJ1ZmZlcih0aGlzLnJlbmRlckJ1ZmZlcik7XG5cdFx0XHRpZiAodGhpcy5vd25UZXh0dXJlKSB7XG5cdFx0XHRcdGdsLmRlbGV0ZVRleHR1cmUodGhpcy50ZXh0dXJlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRkZWxldGUgdGhpcy5mcmFtZUJ1ZmZlcjtcblx0XHRkZWxldGUgdGhpcy5yZW5kZXJCdWZmZXI7XG5cdFx0ZGVsZXRlIHRoaXMudGV4dHVyZTtcblx0XHRkZWxldGUgdGhpcy5nbDtcblx0fTtcblxuXHQvKiBTaGFkZXJQcm9ncmFtIC0gdXRpbGl0eSBjbGFzcyBmb3IgYnVpbGRpbmcgYW5kIGFjY2Vzc2luZyBXZWJHTCBzaGFkZXJzICovXG5cblx0ZnVuY3Rpb24gU2hhZGVyUHJvZ3JhbShnbCwgdmVydGV4U2hhZGVyU291cmNlLCBmcmFnbWVudFNoYWRlclNvdXJjZSkge1xuXHRcdHZhciBwcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIsIGZyYWdtZW50U2hhZGVyLFxuXHRcdFx0cHJvZ3JhbUVycm9yID0gJycsXG5cdFx0XHRzaGFkZXJFcnJvcixcblx0XHRcdGksIGwsXG5cdFx0XHRvYmo7XG5cblx0XHRmdW5jdGlvbiBjb21waWxlU2hhZGVyKHNvdXJjZSwgZnJhZ21lbnQpIHtcblx0XHRcdHZhciBzaGFkZXIsIGk7XG5cdFx0XHRpZiAoZnJhZ21lbnQpIHtcblx0XHRcdFx0c2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKGdsLkZSQUdNRU5UX1NIQURFUik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIoZ2wuVkVSVEVYX1NIQURFUik7XG5cdFx0XHR9XG5cblx0XHRcdGdsLnNoYWRlclNvdXJjZShzaGFkZXIsIHNvdXJjZSk7XG5cdFx0XHRnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG5cblx0XHRcdGlmICghZ2wuZ2V0U2hhZGVyUGFyYW1ldGVyKHNoYWRlciwgZ2wuQ09NUElMRV9TVEFUVVMpKSB7XG5cdFx0XHRcdHNvdXJjZSA9IHNvdXJjZS5zcGxpdCgvW1xcblxccl0vKTtcblx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IHNvdXJjZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdHNvdXJjZVtpXSA9IChpICsgMSkgKyBcIjpcXHRcIiArIHNvdXJjZVtpXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zb2xlLmxvZyhzb3VyY2Uuam9pbignXFxuJykpO1xuXHRcdFx0XHR0aHJvdyAnU2hhZGVyIGVycm9yOiAnICsgZ2wuZ2V0U2hhZGVySW5mb0xvZyhzaGFkZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gc2hhZGVyO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG1ha2VTaGFkZXJTZXR0ZXIoaW5mbywgbG9jKSB7XG5cdFx0XHRpZiAoaW5mby50eXBlID09PSBnbC5TQU1QTEVSXzJEKSB7XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdFx0XHRpbmZvLmdsVGV4dHVyZSA9IGdsWydURVhUVVJFJyArIHZhbHVlXTtcblx0XHRcdFx0XHRnbC51bmlmb3JtMWkobG9jLCB2YWx1ZSk7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpbmZvLnR5cGUgPT09IGdsLkJPT0x8fCBpbmZvLnR5cGUgPT09IGdsLklOVCkge1xuXHRcdFx0XHRpZiAoaW5mby5zaXplID4gMSkge1xuXHRcdFx0XHRcdHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdFx0XHRcdGdsLnVuaWZvcm0xaXYobG9jLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdFx0XHRnbC51bmlmb3JtMWkobG9jLCB2YWx1ZSk7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpbmZvLnR5cGUgPT09IGdsLkZMT0FUKSB7XG5cdFx0XHRcdGlmIChpbmZvLnNpemUgPiAxKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0XHRcdFx0Z2wudW5pZm9ybTFmdihsb2MsIHZhbHVlKTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0XHRcdGdsLnVuaWZvcm0xZihsb2MsIHZhbHVlKTtcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGluZm8udHlwZSA9PT0gZ2wuRkxPQVRfVkVDMikge1xuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24gKG9iaikge1xuXHRcdFx0XHRcdGdsLnVuaWZvcm0yZihsb2MsIG9ialswXSwgb2JqWzFdKTtcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGluZm8udHlwZSA9PT0gZ2wuRkxPQVRfVkVDMykge1xuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24gKG9iaikge1xuXHRcdFx0XHRcdGdsLnVuaWZvcm0zZihsb2MsIG9ialswXSwgb2JqWzFdLCBvYmpbMl0pO1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5mby50eXBlID09PSBnbC5GTE9BVF9WRUM0KSB7XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiAob2JqKSB7XG5cdFx0XHRcdFx0Z2wudW5pZm9ybTRmKGxvYywgb2JqWzBdLCBvYmpbMV0sIG9ialsyXSwgb2JqWzNdKTtcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGluZm8udHlwZSA9PT0gZ2wuRkxPQVRfTUFUMykge1xuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24gKG1hdDMpIHtcblx0XHRcdFx0XHRnbC51bmlmb3JtTWF0cml4M2Z2KGxvYywgZmFsc2UsIG1hdDMpO1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5mby50eXBlID09PSBnbC5GTE9BVF9NQVQ0KSB7XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiAobWF0NCkge1xuXHRcdFx0XHRcdGdsLnVuaWZvcm1NYXRyaXg0ZnYobG9jLCBmYWxzZSwgbWF0NCk7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHRocm93IFwiVW5rbm93biBzaGFkZXIgdW5pZm9ybSB0eXBlOiBcIiArIGluZm8udHlwZTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBtYWtlU2hhZGVyR2V0dGVyKGxvYykge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIGdsLmdldFVuaWZvcm0ocHJvZ3JhbSwgbG9jKTtcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0dmVydGV4U2hhZGVyID0gY29tcGlsZVNoYWRlcih2ZXJ0ZXhTaGFkZXJTb3VyY2UpO1xuXHRcdGZyYWdtZW50U2hhZGVyID0gY29tcGlsZVNoYWRlcihmcmFnbWVudFNoYWRlclNvdXJjZSwgdHJ1ZSk7XG5cblx0XHRwcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuXHRcdGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpO1xuXHRcdHNoYWRlckVycm9yID0gZ2wuZ2V0U2hhZGVySW5mb0xvZyh2ZXJ0ZXhTaGFkZXIpO1xuXHRcdGlmIChzaGFkZXJFcnJvcikge1xuXHRcdFx0cHJvZ3JhbUVycm9yICs9ICdWZXJ0ZXggc2hhZGVyIGVycm9yOiAnICsgc2hhZGVyRXJyb3IgKyBcIlxcblwiO1xuXHRcdH1cblx0XHRnbC5hdHRhY2hTaGFkZXIocHJvZ3JhbSwgZnJhZ21lbnRTaGFkZXIpO1xuXHRcdHNoYWRlckVycm9yID0gZ2wuZ2V0U2hhZGVySW5mb0xvZyhmcmFnbWVudFNoYWRlcik7XG5cdFx0aWYgKHNoYWRlckVycm9yKSB7XG5cdFx0XHRwcm9ncmFtRXJyb3IgKz0gJ0ZyYWdtZW50IHNoYWRlciBlcnJvcjogJyArIHNoYWRlckVycm9yICsgXCJcXG5cIjtcblx0XHR9XG5cdFx0Z2wubGlua1Byb2dyYW0ocHJvZ3JhbSk7XG5cblx0XHRpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIocHJvZ3JhbSwgZ2wuTElOS19TVEFUVVMpKSB7XG5cdFx0XHRwcm9ncmFtRXJyb3IgKz0gZ2wuZ2V0UHJvZ3JhbUluZm9Mb2cocHJvZ3JhbSk7XG5cdFx0XHRnbC5kZWxldGVQcm9ncmFtKHByb2dyYW0pO1xuXHRcdFx0Z2wuZGVsZXRlU2hhZGVyKHZlcnRleFNoYWRlcik7XG5cdFx0XHRnbC5kZWxldGVTaGFkZXIoZnJhZ21lbnRTaGFkZXIpO1xuXHRcdFx0dGhyb3cgJ0NvdWxkIG5vdCBpbml0aWFsaXNlIHNoYWRlcjogJyArIHByb2dyYW1FcnJvcjtcblx0XHR9XG5cblx0XHRnbC51c2VQcm9ncmFtKHByb2dyYW0pO1xuXG5cdFx0dGhpcy51bmlmb3JtcyA9IHt9O1xuXG5cdFx0bCA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIocHJvZ3JhbSwgZ2wuQUNUSVZFX1VOSUZPUk1TKTtcblx0XHRmb3IgKGkgPSAwOyBpIDwgbDsgKytpKSB7XG5cdFx0XHRvYmogPSB7XG5cdFx0XHRcdGluZm86IGdsLmdldEFjdGl2ZVVuaWZvcm0ocHJvZ3JhbSwgaSlcblx0XHRcdH07XG5cblx0XHRcdG9iai5uYW1lID0gb2JqLmluZm8ubmFtZTtcblx0XHRcdG9iai5sb2MgPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgb2JqLm5hbWUpO1xuXHRcdFx0b2JqLnNldCA9IG1ha2VTaGFkZXJTZXR0ZXIob2JqLmluZm8sIG9iai5sb2MpO1xuXHRcdFx0b2JqLmdldCA9IG1ha2VTaGFkZXJHZXR0ZXIob2JqLmxvYyk7XG5cdFx0XHR0aGlzLnVuaWZvcm1zW29iai5uYW1lXSA9IG9iajtcblxuXHRcdFx0aWYgKCF0aGlzW29iai5uYW1lXSkge1xuXHRcdFx0XHQvL2ZvciBjb252ZW5pZW5jZVxuXHRcdFx0XHR0aGlzW29iai5uYW1lXSA9IG9iajtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLmF0dHJpYnV0ZXMgPSB7fTtcblx0XHR0aGlzLmxvY2F0aW9uID0ge307XG5cdFx0bCA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIocHJvZ3JhbSwgZ2wuQUNUSVZFX0FUVFJJQlVURVMpO1xuXHRcdGZvciAoaSA9IDA7IGkgPCBsOyArK2kpIHtcblx0XHRcdG9iaiA9IHtcblx0XHRcdFx0aW5mbzogZ2wuZ2V0QWN0aXZlQXR0cmliKHByb2dyYW0sIGkpXG5cdFx0XHR9O1xuXG5cdFx0XHRvYmoubmFtZSA9IG9iai5pbmZvLm5hbWU7XG5cdFx0XHRvYmoubG9jYXRpb24gPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihwcm9ncmFtLCBvYmoubmFtZSk7XG5cdFx0XHR0aGlzLmF0dHJpYnV0ZXNbb2JqLm5hbWVdID0gb2JqO1xuXHRcdFx0dGhpcy5sb2NhdGlvbltvYmoubmFtZV0gPSBvYmoubG9jYXRpb247XG5cdFx0fVxuXG5cdFx0dGhpcy5nbCA9IGdsO1xuXHRcdHRoaXMucHJvZ3JhbSA9IHByb2dyYW07XG5cblx0XHR0aGlzLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgaTtcblxuXHRcdFx0aWYgKGdsKSB7XG5cdFx0XHRcdGdsLmRlbGV0ZVByb2dyYW0ocHJvZ3JhbSk7XG5cdFx0XHRcdGdsLmRlbGV0ZVNoYWRlcih2ZXJ0ZXhTaGFkZXIpO1xuXHRcdFx0XHRnbC5kZWxldGVTaGFkZXIoZnJhZ21lbnRTaGFkZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGkgaW4gdGhpcykge1xuXHRcdFx0XHRpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHRcdFx0XHRcdGRlbGV0ZSB0aGlzW2ldO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHByb2dyYW0gPSBudWxsO1xuXHRcdFx0dmVydGV4U2hhZGVyID0gbnVsbDtcblx0XHRcdGZyYWdtZW50U2hhZGVyID0gbnVsbDtcblx0XHR9O1xuXHR9XG5cblx0U2hhZGVyUHJvZ3JhbS5wcm90b3R5cGUudXNlID0gZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMuZ2wudXNlUHJvZ3JhbSh0aGlzLnByb2dyYW0pO1xuXHR9O1xuXG5cdC8qXG5cdFx0bWFpbiBjbGFzczogU2VyaW91c2x5XG5cdCovXG5cblx0ZnVuY3Rpb24gU2VyaW91c2x5KG9wdGlvbnMpIHtcblxuXHRcdC8vaWYgY2FsbGVkIHdpdGhvdXQgJ25ldycsIG1ha2UgYSBuZXcgb2JqZWN0IGFuZCByZXR1cm4gdGhhdFxuXHRcdGlmICh3aW5kb3cgPT09IHRoaXMgfHwgISh0aGlzIGluc3RhbmNlb2YgU2VyaW91c2x5KSkge1xuXHRcdFx0cmV0dXJuIG5ldyBTZXJpb3VzbHkob3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Ly9pbml0aWFsaXplIG9iamVjdCwgcHJpdmF0ZSBwcm9wZXJ0aWVzXG5cdFx0dmFyIGlkID0gKyttYXhTZXJpb3VzbHlJZCxcblx0XHRcdHNlcmlvdXNseSA9IHRoaXMsXG5cdFx0XHRub2RlcyA9IFtdLFxuXHRcdFx0bm9kZXNCeUlkID0ge30sXG5cdFx0XHRub2RlSWQgPSAwLFxuXHRcdFx0c291cmNlcyA9IFtdLFxuXHRcdFx0dGFyZ2V0cyA9IFtdLFxuXHRcdFx0dHJhbnNmb3JtcyA9IFtdLFxuXHRcdFx0ZWZmZWN0cyA9IFtdLFxuXHRcdFx0YWxpYXNlcyA9IHt9LFxuXHRcdFx0cHJlQ2FsbGJhY2tzID0gW10sXG5cdFx0XHRwb3N0Q2FsbGJhY2tzID0gW10sXG5cdFx0XHRnbENhbnZhcyxcblx0XHRcdGdsLFxuXHRcdFx0cmVjdGFuZ2xlTW9kZWwsXG5cdFx0XHRjb21tb25TaGFkZXJzID0ge30sXG5cdFx0XHRiYXNlU2hhZGVyLFxuXHRcdFx0YmFzZVZlcnRleFNoYWRlciwgYmFzZUZyYWdtZW50U2hhZGVyLFxuXHRcdFx0Tm9kZSwgU291cmNlTm9kZSwgRWZmZWN0Tm9kZSwgVHJhbnNmb3JtTm9kZSwgVGFyZ2V0Tm9kZSxcblx0XHRcdEVmZmVjdCwgU291cmNlLCBUcmFuc2Zvcm0sIFRhcmdldCxcblx0XHRcdGF1dG8gPSBmYWxzZSxcblx0XHRcdGlzRGVzdHJveWVkID0gZmFsc2UsXG5cdFx0XHRyYWZJZDtcblxuXHRcdGZ1bmN0aW9uIG1ha2VHbE1vZGVsKHNoYXBlLCBnbCkge1xuXHRcdFx0dmFyIHZlcnRleCwgaW5kZXgsIHRleENvb3JkO1xuXG5cdFx0XHRpZiAoIWdsKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0dmVydGV4ID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG5cdFx0XHRnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdmVydGV4KTtcblx0XHRcdGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBzaGFwZS52ZXJ0aWNlcywgZ2wuU1RBVElDX0RSQVcpO1xuXHRcdFx0dmVydGV4LnNpemUgPSAzO1xuXG5cdFx0XHRpbmRleCA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuXHRcdFx0Z2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgaW5kZXgpO1xuXHRcdFx0Z2wuYnVmZmVyRGF0YShnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgc2hhcGUuaW5kaWNlcywgZ2wuU1RBVElDX0RSQVcpO1xuXG5cdFx0XHR0ZXhDb29yZCA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuXHRcdFx0Z2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRleENvb3JkKTtcblx0XHRcdGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBzaGFwZS5jb29yZHMsIGdsLlNUQVRJQ19EUkFXKTtcblx0XHRcdHRleENvb3JkLnNpemUgPSAyO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR2ZXJ0ZXg6IHZlcnRleCxcblx0XHRcdFx0aW5kZXg6IGluZGV4LFxuXHRcdFx0XHR0ZXhDb29yZDogdGV4Q29vcmQsXG5cdFx0XHRcdGxlbmd0aDogc2hhcGUuaW5kaWNlcy5sZW5ndGgsXG5cdFx0XHRcdG1vZGU6IHNoYXBlLm1vZGUgfHwgZ2wuVFJJQU5HTEVTXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGJ1aWxkUmVjdGFuZ2xlTW9kZWwoZ2wpIHtcblx0XHRcdHZhciBzaGFwZSA9IHt9O1xuXG5cdFx0XHRzaGFwZS52ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoW1xuXHRcdFx0XHQtMSwgLTEsIDAsXG5cdFx0XHRcdDEsIC0xLCAwLFxuXHRcdFx0XHQxLCAxLCAwLFxuXHRcdFx0XHQtMSwgMSwgMFxuXHRcdFx0XSk7XG5cblx0XHRcdHNoYXBlLmluZGljZXMgPSBuZXcgVWludDE2QXJyYXkoW1xuXHRcdFx0XHQwLCAxLCAyLFxuXHRcdFx0XHQwLCAyLCAzXHQvLyBGcm9udCBmYWNlXG5cdFx0XHRdKTtcblxuXHRcdFx0c2hhcGUuY29vcmRzID0gbmV3IEZsb2F0MzJBcnJheShbXG5cdFx0XHRcdDAsIDAsXG5cdFx0XHRcdDEsIDAsXG5cdFx0XHRcdDEsIDEsXG5cdFx0XHRcdDAsIDFcblx0XHRcdF0pO1xuXG5cdFx0XHRyZXR1cm4gbWFrZUdsTW9kZWwoc2hhcGUsIGdsKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhdHRhY2hDb250ZXh0KGNvbnRleHQpIHtcblx0XHRcdHZhciBpLCBub2RlO1xuXG5cdFx0XHRnbCA9IGNvbnRleHQ7XG5cdFx0XHRnbENhbnZhcyA9IGNvbnRleHQuY2FudmFzO1xuXG5cdFx0XHRyZWN0YW5nbGVNb2RlbCA9IGJ1aWxkUmVjdGFuZ2xlTW9kZWwoZ2wpO1xuXG5cdFx0XHRiYXNlU2hhZGVyID0gbmV3IFNoYWRlclByb2dyYW0oZ2wsIGJhc2VWZXJ0ZXhTaGFkZXIsIGJhc2VGcmFnbWVudFNoYWRlcik7XG5cblx0XHRcdGZvciAoaSA9IDA7IGkgPCBlZmZlY3RzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdG5vZGUgPSBlZmZlY3RzW2ldO1xuXHRcdFx0XHRub2RlLmdsID0gZ2w7XG5cdFx0XHRcdG5vZGUuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0XHRub2RlLmJ1aWxkU2hhZGVyKCk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdG5vZGUgPSBzb3VyY2VzW2ldO1xuXHRcdFx0XHRub2RlLmluaXRpYWxpemUoKTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChpID0gMDsgaSA8IHRhcmdldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0bm9kZSA9IHRhcmdldHNbaV07XG5cblx0XHRcdFx0aWYgKCFub2RlLm1vZGVsKSB7XG5cdFx0XHRcdFx0bm9kZS5tb2RlbCA9IHJlY3RhbmdsZU1vZGVsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly90b2RvOiBpbml0aWFsaXplIGZyYW1lIGJ1ZmZlciBpZiBub3QgbWFpbiBjYW52YXNcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKlxuXHRcdHJ1bnMgb24gZXZlcnkgZnJhbWUsIGFzIGxvbmcgYXMgdGhlcmUgYXJlIG1lZGlhIHNvdXJjZXMgKGltZywgdmlkZW8sIGNhbnZhcywgZXRjLikgdG8gY2hlY2ssXG5cdFx0ZGlydHkgdGFyZ2V0IG5vZGVzIG9yIHByZS9wb3N0IGNhbGxiYWNrcyB0byBydW4uIGFueSBzb3VyY2VzIHRoYXQgYXJlIHVwZGF0ZWQgYXJlIHNldCB0byBkaXJ0eSxcblx0XHRmb3JjaW5nIGFsbCBkZXBlbmRlbnQgbm9kZXMgdG8gcmVuZGVyXG5cdFx0Ki9cblx0XHRmdW5jdGlvbiByZW5kZXJEYWVtb24oKSB7XG5cdFx0XHR2YXIgaSwgbm9kZSwgbWVkaWEsXG5cdFx0XHRcdGtlZXBSdW5uaW5nID0gZmFsc2U7XG5cblx0XHRcdHJhZklkID0gbnVsbDtcblxuXHRcdFx0aWYgKHByZUNhbGxiYWNrcy5sZW5ndGgpIHtcblx0XHRcdFx0a2VlcFJ1bm5pbmcgPSB0cnVlO1xuXHRcdFx0XHRmb3IgKGkgPSAwOyBpIDwgcHJlQ2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0cHJlQ2FsbGJhY2tzW2ldLmNhbGwoc2VyaW91c2x5KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc291cmNlcyAmJiBzb3VyY2VzLmxlbmd0aCkge1xuXHRcdFx0XHRrZWVwUnVubmluZyA9IHRydWU7XG5cdFx0XHRcdGZvciAoaSA9IDA7IGkgPCBzb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0bm9kZSA9IHNvdXJjZXNbaV07XG5cblx0XHRcdFx0XHRtZWRpYSA9IG5vZGUuc291cmNlO1xuXHRcdFx0XHRcdGlmIChub2RlLmxhc3RSZW5kZXJUaW1lID09PSB1bmRlZmluZWQgfHxcblx0XHRcdFx0XHRcdFx0bm9kZS5kaXJ0eSB8fFxuXHRcdFx0XHRcdFx0XHRtZWRpYS5jdXJyZW50VGltZSAhPT0gdW5kZWZpbmVkICYmIG5vZGUubGFzdFJlbmRlclRpbWUgIT09IG1lZGlhLmN1cnJlbnRUaW1lKSB7XG5cdFx0XHRcdFx0XHRub2RlLmRpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRub2RlLnNldERpcnR5KCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoaSA9IDA7IGkgPCB0YXJnZXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdG5vZGUgPSB0YXJnZXRzW2ldO1xuXHRcdFx0XHRpZiAobm9kZS5hdXRvICYmIG5vZGUuZGlydHkpIHtcblx0XHRcdFx0XHRub2RlLnJlbmRlcigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwb3N0Q2FsbGJhY2tzLmxlbmd0aCkge1xuXHRcdFx0XHRrZWVwUnVubmluZyA9IHRydWU7XG5cdFx0XHRcdGZvciAoaSA9IDA7IGkgPCBwb3N0Q2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0cG9zdENhbGxiYWNrc1tpXS5jYWxsKHNlcmlvdXNseSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly9yYWZJZCBtYXkgaGF2ZSBiZWVuIHNldCBhZ2FpbiBieSBhIGNhbGxiYWNrIG9yIGluIHRhcmdldC5zZXREaXJ0eSgpXG5cdFx0XHRpZiAoa2VlcFJ1bm5pbmcgJiYgIXJhZklkKSB7XG5cdFx0XHRcdHJhZklkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHJlbmRlckRhZW1vbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZHJhdyhzaGFkZXIsIG1vZGVsLCB1bmlmb3JtcywgZnJhbWVCdWZmZXIsIG5vZGUsIG9wdGlvbnMpIHtcblx0XHRcdHZhciBudW1UZXh0dXJlcyA9IDAsXG5cdFx0XHRcdG5hbWUsIHZhbHVlLCBzaGFkZXJVbmlmb3JtLFxuXHRcdFx0XHR3aWR0aCwgaGVpZ2h0LFxuXHRcdFx0XHRub2RlR2wgPSAobm9kZSAmJiBub2RlLmdsKSB8fCBnbDtcblxuXHRcdFx0aWYgKCFub2RlR2wpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobm9kZSkge1xuXHRcdFx0XHR3aWR0aCA9IG9wdGlvbnMgJiYgb3B0aW9ucy53aWR0aCB8fCBub2RlLndpZHRoIHx8IG5vZGVHbC5jYW52YXMud2lkdGg7XG5cdFx0XHRcdGhlaWdodCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5oZWlnaHQgfHwgbm9kZS5oZWlnaHQgfHwgbm9kZUdsLmNhbnZhcy5oZWlnaHQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR3aWR0aCA9IG9wdGlvbnMgJiYgb3B0aW9ucy53aWR0aCB8fCBub2RlR2wuY2FudmFzLndpZHRoO1xuXHRcdFx0XHRoZWlnaHQgPSBvcHRpb25zICYmIG9wdGlvbnMuaGVpZ2h0IHx8IG5vZGVHbC5jYW52YXMuaGVpZ2h0O1xuXHRcdFx0fVxuXG5cdFx0XHRzaGFkZXIudXNlKCk7XG5cblx0XHRcdG5vZGVHbC52aWV3cG9ydCgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcblxuXHRcdFx0bm9kZUdsLmJpbmRGcmFtZWJ1ZmZlcihub2RlR2wuRlJBTUVCVUZGRVIsIGZyYW1lQnVmZmVyKTtcblxuXHRcdFx0LyogdG9kbzogZG8gdGhpcyBhbGwgb25seSBvbmNlIGF0IHRoZSBiZWdpbm5pbmcsIHNpbmNlIHdlIG9ubHkgaGF2ZSBvbmUgbW9kZWw/ICovXG5cdFx0XHRub2RlR2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkoc2hhZGVyLmxvY2F0aW9uLnBvc2l0aW9uKTtcblx0XHRcdG5vZGVHbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShzaGFkZXIubG9jYXRpb24udGV4Q29vcmQpO1xuXG5cdFx0XHRpZiAobW9kZWwudGV4Q29vcmQpIHtcblx0XHRcdFx0bm9kZUdsLmJpbmRCdWZmZXIobm9kZUdsLkFSUkFZX0JVRkZFUiwgbW9kZWwudGV4Q29vcmQpO1xuXHRcdFx0XHRub2RlR2wudmVydGV4QXR0cmliUG9pbnRlcihzaGFkZXIubG9jYXRpb24udGV4Q29vcmQsIG1vZGVsLnRleENvb3JkLnNpemUsIG5vZGVHbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXHRcdFx0fVxuXG5cdFx0XHRub2RlR2wuYmluZEJ1ZmZlcihub2RlR2wuQVJSQVlfQlVGRkVSLCBtb2RlbC52ZXJ0ZXgpO1xuXHRcdFx0bm9kZUdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyLmxvY2F0aW9uLnBvc2l0aW9uLCBtb2RlbC52ZXJ0ZXguc2l6ZSwgbm9kZUdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cblx0XHRcdG5vZGVHbC5iaW5kQnVmZmVyKG5vZGVHbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgbW9kZWwuaW5kZXgpO1xuXG5cdFx0XHQvL2RlZmF1bHQgZm9yIGRlcHRoIGlzIGRpc2FibGVcblx0XHRcdGlmIChvcHRpb25zICYmIG9wdGlvbnMuZGVwdGgpIHtcblx0XHRcdFx0Z2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Z2wuZGlzYWJsZShnbC5ERVBUSF9URVNUKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9kZWZhdWx0IGZvciBibGVuZCBpcyBlbmFibGVcblx0XHRcdGlmICghb3B0aW9ucyB8fCBvcHRpb25zLmJsZW5kID09PSB1bmRlZmluZWQgfHwgb3B0aW9ucy5ibGVuZCkge1xuXHRcdFx0XHRnbC5lbmFibGUoZ2wuQkxFTkQpO1xuXHRcdFx0XHRnbC5ibGVuZEZ1bmMoXG5cdFx0XHRcdFx0b3B0aW9ucyAmJiBvcHRpb25zLnNyY1JHQiB8fCBnbC5PTkUsXG5cdFx0XHRcdFx0b3B0aW9ucyAmJiBvcHRpb25zLmRzdFJHQiB8fCBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0Lypcblx0XHRcdFx0Z2wuYmxlbmRGdW5jU2VwYXJhdGUoXG5cdFx0XHRcdFx0b3B0aW9ucyAmJiBvcHRpb25zLnNyY1JHQiB8fCBnbC5PTkUsXG5cdFx0XHRcdFx0b3B0aW9ucyAmJiBvcHRpb25zLmRzdFJHQiB8fCBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBLFxuXHRcdFx0XHRcdG9wdGlvbnMgJiYgb3B0aW9ucy5zcmNBbHBoYSB8fCBnbC5TUkNfQUxQSEEsXG5cdFx0XHRcdFx0b3B0aW9ucyAmJiBvcHRpb25zLmRzdEFscGhhIHx8IGdsLkRTVF9BTFBIQVxuXHRcdFx0XHQpO1xuXHRcdFx0XHQqL1xuXHRcdFx0XHRnbC5ibGVuZEVxdWF0aW9uKG9wdGlvbnMgJiYgb3B0aW9ucy5ibGVuZEVxdWF0aW9uIHx8IGdsLkZVTkNfQUREKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGdsLmRpc2FibGUoZ2wuQkxFTkQpO1xuXHRcdFx0fVxuXG5cdFx0XHQvKiBzZXQgdW5pZm9ybXMgdG8gY3VycmVudCB2YWx1ZXMgKi9cblx0XHRcdGZvciAobmFtZSBpbiB1bmlmb3Jtcykge1xuXHRcdFx0XHRpZiAodW5pZm9ybXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHVuaWZvcm1zW25hbWVdO1xuXHRcdFx0XHRcdHNoYWRlclVuaWZvcm0gPSBzaGFkZXIudW5pZm9ybXNbbmFtZV07XG5cdFx0XHRcdFx0aWYgKHNoYWRlclVuaWZvcm0pIHtcblx0XHRcdFx0XHRcdGlmICh2YWx1ZSBpbnN0YW5jZW9mIFdlYkdMVGV4dHVyZSkge1xuXHRcdFx0XHRcdFx0XHRub2RlR2wuYWN0aXZlVGV4dHVyZShub2RlR2wuVEVYVFVSRTAgKyBudW1UZXh0dXJlcyk7XG5cdFx0XHRcdFx0XHRcdG5vZGVHbC5iaW5kVGV4dHVyZShub2RlR2wuVEVYVFVSRV8yRCwgdmFsdWUpO1xuXHRcdFx0XHRcdFx0XHRzaGFkZXJVbmlmb3JtLnNldChudW1UZXh0dXJlcyk7XG5cdFx0XHRcdFx0XHRcdG51bVRleHR1cmVzKys7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgU291cmNlTm9kZSB8fFxuXHRcdFx0XHRcdFx0XHRcdHZhbHVlIGluc3RhbmNlb2YgRWZmZWN0Tm9kZSB8fFxuXHRcdFx0XHRcdFx0XHRcdHZhbHVlIGluc3RhbmNlb2YgVHJhbnNmb3JtTm9kZSkge1xuXHRcdFx0XHRcdFx0XHRpZiAodmFsdWUudGV4dHVyZSkge1xuXHRcdFx0XHRcdFx0XHRcdG5vZGVHbC5hY3RpdmVUZXh0dXJlKG5vZGVHbC5URVhUVVJFMCArIG51bVRleHR1cmVzKTtcblx0XHRcdFx0XHRcdFx0XHRub2RlR2wuYmluZFRleHR1cmUobm9kZUdsLlRFWFRVUkVfMkQsIHZhbHVlLnRleHR1cmUpO1xuXHRcdFx0XHRcdFx0XHRcdHNoYWRlclVuaWZvcm0uc2V0KG51bVRleHR1cmVzKTtcblx0XHRcdFx0XHRcdFx0XHRudW1UZXh0dXJlcysrO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0XHRzaGFkZXJVbmlmb3JtLnNldCh2YWx1ZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vZGVmYXVsdCBmb3IgY2xlYXIgaXMgdHJ1ZVxuXHRcdFx0aWYgKCFvcHRpb25zIHx8IG9wdGlvbnMuY2xlYXIgPT09IHVuZGVmaW5lZCB8fCBvcHRpb25zLmNsZWFyKSB7XG5cdFx0XHRcdG5vZGVHbC5jbGVhckNvbG9yKDAuMCwgMC4wLCAwLjAsIDAuMCk7XG5cdFx0XHRcdG5vZGVHbC5jbGVhcihub2RlR2wuQ09MT1JfQlVGRkVSX0JJVCB8IG5vZGVHbC5ERVBUSF9CVUZGRVJfQklUKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gZHJhdyFcblx0XHRcdG5vZGVHbC5kcmF3RWxlbWVudHMobW9kZWwubW9kZSwgbW9kZWwubGVuZ3RoLCBub2RlR2wuVU5TSUdORURfU0hPUlQsIDApO1xuXG5cdFx0XHQvL3RvIHByb3RlY3Qgb3RoZXIgM0QgbGlicmFyaWVzIHRoYXQgbWF5IG5vdCByZW1lbWJlciB0byB0dXJuIHRoZWlyIGRlcHRoIHRlc3RzIG9uXG5cdFx0XHRnbC5lbmFibGUoZ2wuREVQVEhfVEVTVCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZmluZElucHV0Tm9kZShob29rLCBzb3VyY2UsIG9wdGlvbnMpIHtcblx0XHRcdHZhciBub2RlLCBpO1xuXG5cdFx0XHRpZiAodHlwZW9mIGhvb2sgIT09ICdzdHJpbmcnIHx8ICFzb3VyY2UgJiYgc291cmNlICE9PSAwKSB7XG5cdFx0XHRcdGlmICghb3B0aW9ucyB8fCB0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcblx0XHRcdFx0XHRvcHRpb25zID0gc291cmNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNvdXJjZSA9IGhvb2s7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0eXBlb2YgaG9vayAhPT0gJ3N0cmluZycgfHwgIXNlcmlvdXNTb3VyY2VzW2hvb2tdKSB7XG5cdFx0XHRcdGhvb2sgPSBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc291cmNlIGluc3RhbmNlb2YgU291cmNlTm9kZSB8fFxuXHRcdFx0XHRcdHNvdXJjZSBpbnN0YW5jZW9mIEVmZmVjdE5vZGUgfHxcblx0XHRcdFx0XHRzb3VyY2UgaW5zdGFuY2VvZiBUcmFuc2Zvcm1Ob2RlKSB7XG5cdFx0XHRcdG5vZGUgPSBzb3VyY2U7XG5cdFx0XHR9IGVsc2UgaWYgKHNvdXJjZSBpbnN0YW5jZW9mIEVmZmVjdCB8fFxuXHRcdFx0XHRcdHNvdXJjZSBpbnN0YW5jZW9mIFNvdXJjZSB8fFxuXHRcdFx0XHRcdHNvdXJjZSBpbnN0YW5jZW9mIFRyYW5zZm9ybSkge1xuXHRcdFx0XHRub2RlID0gbm9kZXNCeUlkW3NvdXJjZS5pZF07XG5cblx0XHRcdFx0aWYgKCFub2RlKSB7XG5cdFx0XHRcdFx0dGhyb3cgJ0Nhbm5vdCBjb25uZWN0IGEgZm9yZWlnbiBub2RlJztcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHR5cGVvZiBzb3VyY2UgPT09ICdzdHJpbmcnICYmIGlzTmFOKHNvdXJjZSkpIHtcblx0XHRcdFx0XHRzb3VyY2UgPSBnZXRFbGVtZW50KHNvdXJjZSwgWydjYW52YXMnLCAnaW1nJywgJ3ZpZGVvJ10pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IHNvdXJjZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRub2RlID0gc291cmNlc1tpXTtcblx0XHRcdFx0XHRpZiAoKCFob29rIHx8IGhvb2sgPT09IG5vZGUuaG9vaykgJiYgbm9kZS5jb21wYXJlICYmIG5vZGUuY29tcGFyZShzb3VyY2UsIG9wdGlvbnMpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbm9kZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRub2RlID0gbmV3IFNvdXJjZU5vZGUoaG9vaywgc291cmNlLCBvcHRpb25zKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG5vZGU7XG5cdFx0fVxuXG5cdFx0Ly90cmFjZSBiYWNrIGFsbCBzb3VyY2VzIHRvIG1ha2Ugc3VyZSB3ZSdyZSBub3QgbWFraW5nIGEgY3ljbGljYWwgY29ubmVjdGlvblxuXHRcdGZ1bmN0aW9uIHRyYWNlU291cmNlcyhub2RlLCBvcmlnaW5hbCkge1xuXHRcdFx0dmFyIGksXG5cdFx0XHRcdHNvdXJjZSxcblx0XHRcdFx0c291cmNlcztcblxuXHRcdFx0aWYgKCEobm9kZSBpbnN0YW5jZW9mIEVmZmVjdE5vZGUpICYmICEobm9kZSBpbnN0YW5jZW9mIFRyYW5zZm9ybU5vZGUpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG5vZGUgPT09IG9yaWdpbmFsKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRzb3VyY2VzID0gbm9kZS5zb3VyY2VzO1xuXG5cdFx0XHRmb3IgKGkgaW4gc291cmNlcykge1xuXHRcdFx0XHRpZiAoc291cmNlcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHRcdFx0XHRcdHNvdXJjZSA9IHNvdXJjZXNbaV07XG5cblx0XHRcdFx0XHRpZiAoc291cmNlID09PSBvcmlnaW5hbCB8fCB0cmFjZVNvdXJjZXMoc291cmNlLCBvcmlnaW5hbCkpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Tm9kZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHRoaXMucmVhZHkgPSBmYWxzZTtcblx0XHRcdHRoaXMud2lkdGggPSAxO1xuXHRcdFx0dGhpcy5oZWlnaHQgPSAxO1xuXG5cdFx0XHR0aGlzLmdsID0gZ2w7XG5cblx0XHRcdHRoaXMudW5pZm9ybXMgPSB7XG5cdFx0XHRcdHJlc29sdXRpb246IFt0aGlzLndpZHRoLCB0aGlzLmhlaWdodF0sXG5cdFx0XHRcdHRyYW5zZm9ybTogbnVsbFxuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5kaXJ0eSA9IHRydWU7XG5cdFx0XHR0aGlzLmlzRGVzdHJveWVkID0gZmFsc2U7XG5cblx0XHRcdHRoaXMuc2VyaW91c2x5ID0gc2VyaW91c2x5O1xuXG5cdFx0XHR0aGlzLmxpc3RlbmVycyA9IHt9O1xuXG5cdFx0XHR0aGlzLmlkID0gbm9kZUlkO1xuXHRcdFx0bm9kZXMucHVzaCh0aGlzKTtcblx0XHRcdG5vZGVzQnlJZFtub2RlSWRdID0gdGhpcztcblx0XHRcdG5vZGVJZCsrO1xuXHRcdH07XG5cblx0XHROb2RlLnByb3RvdHlwZS5zZXRSZWFkeSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBpO1xuXG5cdFx0XHRpZiAoIXRoaXMucmVhZHkpIHtcblx0XHRcdFx0dGhpcy5lbWl0KCdyZWFkeScpO1xuXHRcdFx0XHR0aGlzLnJlYWR5ID0gdHJ1ZTtcblx0XHRcdFx0aWYgKHRoaXMudGFyZ2V0cykge1xuXHRcdFx0XHRcdGZvciAoaSA9IDA7IGkgPCB0aGlzLnRhcmdldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdHRoaXMudGFyZ2V0c1tpXS5zZXRSZWFkeSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHROb2RlLnByb3RvdHlwZS5zZXRVbnJlYWR5ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIGk7XG5cblx0XHRcdGlmICh0aGlzLnJlYWR5KSB7XG5cdFx0XHRcdHRoaXMuZW1pdCgndW5yZWFkeScpO1xuXHRcdFx0XHR0aGlzLnJlYWR5ID0gZmFsc2U7XG5cdFx0XHRcdGlmICh0aGlzLnRhcmdldHMpIHtcblx0XHRcdFx0XHRmb3IgKGkgPSAwOyBpIDwgdGhpcy50YXJnZXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnRhcmdldHNbaV0uc2V0VW5yZWFkeSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHROb2RlLnByb3RvdHlwZS5zZXREaXJ0eSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdC8vbG9vcCB0aHJvdWdoIGFsbCB0YXJnZXRzIGNhbGxpbmcgc2V0RGlydHkgKGRlcHRoLWZpcnN0KVxuXHRcdFx0dmFyIGk7XG5cblx0XHRcdGlmICghdGhpcy5kaXJ0eSkge1xuXHRcdFx0XHR0aGlzLmVtaXQoJ2RpcnR5Jyk7XG5cdFx0XHRcdHRoaXMuZGlydHkgPSB0cnVlO1xuXHRcdFx0XHRpZiAodGhpcy50YXJnZXRzKSB7XG5cdFx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IHRoaXMudGFyZ2V0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0dGhpcy50YXJnZXRzW2ldLnNldERpcnR5KCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdE5vZGUucHJvdG90eXBlLmluaXRGcmFtZUJ1ZmZlciA9IGZ1bmN0aW9uICh1c2VGbG9hdCkge1xuXHRcdFx0aWYgKGdsKSB7XG5cdFx0XHRcdHRoaXMuZnJhbWVCdWZmZXIgPSBuZXcgRnJhbWVCdWZmZXIoZ2wsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0LCB1c2VGbG9hdCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdE5vZGUucHJvdG90eXBlLnJlYWRQaXhlbHMgPSBmdW5jdGlvbiAoeCwgeSwgd2lkdGgsIGhlaWdodCwgZGVzdCkge1xuXG5cdFx0XHRpZiAoIWdsKSB7XG5cdFx0XHRcdC8vdG9kbzogaXMgdGhpcyB0aGUgYmVzdCBhcHByb2FjaD9cblx0XHRcdFx0dGhyb3cgJ0Nhbm5vdCByZWFkIHBpeGVscyB1bnRpbCBhIGNhbnZhcyBpcyBjb25uZWN0ZWQnO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3RvZG86IGNoZWNrIG9uIHgsIHksIHdpZHRoLCBoZWlnaHRcblxuXHRcdFx0aWYgKCF0aGlzLmZyYW1lQnVmZmVyKSB7XG5cdFx0XHRcdHRoaXMuaW5pdEZyYW1lQnVmZmVyKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vdG9kbzogc2hvdWxkIHdlIHJlbmRlciBoZXJlP1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdFx0Ly90b2RvOiBmaWd1cmUgb3V0IGZvcm1hdHMgYW5kIHR5cGVzXG5cdFx0XHRpZiAoZGVzdCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGRlc3QgPSBuZXcgVWludDhBcnJheSh3aWR0aCAqIGhlaWdodCAqIDQpO1xuXHRcdFx0fSBlbHNlIGlmICghZGVzdCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcblx0XHRcdFx0dGhyb3cgJ0luY29tcGF0aWJsZSBhcnJheSB0eXBlJztcblx0XHRcdH1cblxuXHRcdFx0Z2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmZyYW1lQnVmZmVyLmZyYW1lQnVmZmVyKTsgLy90b2RvOiBhcmUgd2Ugc3VyZSBhYm91dCB0aGlzP1xuXHRcdFx0Z2wucmVhZFBpeGVscyh4LCB5LCB3aWR0aCwgaGVpZ2h0LCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBkZXN0KTtcblxuXHRcdFx0cmV0dXJuIGRlc3Q7XG5cdFx0fTtcblxuXHRcdE5vZGUucHJvdG90eXBlLnJlc2l6ZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciB3aWR0aCxcblx0XHRcdFx0aGVpZ2h0O1xuXG5cdFx0XHRpZiAodGhpcy5zb3VyY2UpIHtcblx0XHRcdFx0d2lkdGggPSB0aGlzLnNvdXJjZS53aWR0aDtcblx0XHRcdFx0aGVpZ2h0ID0gdGhpcy5zb3VyY2UuaGVpZ2h0O1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLnNvdXJjZXMgJiYgdGhpcy5zb3VyY2VzLnNvdXJjZSkge1xuXHRcdFx0XHR3aWR0aCA9IHRoaXMuc291cmNlcy5zb3VyY2Uud2lkdGg7XG5cdFx0XHRcdGhlaWdodCA9IHRoaXMuc291cmNlcy5zb3VyY2UuaGVpZ2h0O1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLmlucHV0cyAmJiB0aGlzLmlucHV0cy53aWR0aCkge1xuXHRcdFx0XHR3aWR0aCA9IHRoaXMuaW5wdXRzLndpZHRoO1xuXHRcdFx0XHRoZWlnaHQgPSB0aGlzLmlucHV0cy5oZWlnaHQgfHwgd2lkdGg7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuaW5wdXRzICYmIHRoaXMuaW5wdXRzLmhlaWdodCkge1xuXHRcdFx0XHR3aWR0aCA9IGhlaWdodCA9IHRoaXMuaW5wdXRzLmhlaWdodDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vdGhpcyBub2RlIHdpbGwgYmUgcmVzcG9uc2libGUgZm9yIGNhbGN1bGF0aW5nIGl0cyBvd24gc2l6ZVxuXHRcdFx0XHR3aWR0aCA9IDE7XG5cdFx0XHRcdGhlaWdodCA9IDE7XG5cdFx0XHR9XG5cblx0XHRcdHdpZHRoID0gTWF0aC5mbG9vcih3aWR0aCk7XG5cdFx0XHRoZWlnaHQgPSBNYXRoLmZsb29yKGhlaWdodCk7XG5cblx0XHRcdGlmICh0aGlzLndpZHRoICE9PSB3aWR0aCB8fCB0aGlzLmhlaWdodCAhPT0gaGVpZ2h0KSB7XG5cdFx0XHRcdHRoaXMud2lkdGggPSB3aWR0aDtcblx0XHRcdFx0dGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cblx0XHRcdFx0dGhpcy5lbWl0KCdyZXNpemUnKTtcblx0XHRcdFx0dGhpcy5zZXREaXJ0eSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy51bmlmb3JtcyAmJiB0aGlzLnVuaWZvcm1zLnJlc29sdXRpb24pIHtcblx0XHRcdFx0dGhpcy51bmlmb3Jtcy5yZXNvbHV0aW9uWzBdID0gd2lkdGg7XG5cdFx0XHRcdHRoaXMudW5pZm9ybXMucmVzb2x1dGlvblsxXSA9IGhlaWdodDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuZnJhbWVCdWZmZXIgJiYgdGhpcy5mcmFtZUJ1ZmZlci5yZXNpemUpIHtcblx0XHRcdFx0dGhpcy5mcmFtZUJ1ZmZlci5yZXNpemUod2lkdGgsIGhlaWdodCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdE5vZGUucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcblx0XHRcdHZhciBsaXN0ZW5lcnMsXG5cdFx0XHRcdGluZGV4ID0gLTE7XG5cblx0XHRcdGlmICghZXZlbnROYW1lIHx8IHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzW2V2ZW50TmFtZV07XG5cdFx0XHRpZiAobGlzdGVuZXJzKSB7XG5cdFx0XHRcdGluZGV4ID0gbGlzdGVuZXJzLmluZGV4T2YoY2FsbGJhY2spO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5kZXggPCAwKSB7XG5cdFx0XHRcdGxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Tm9kZS5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcblx0XHRcdHZhciBsaXN0ZW5lcnMsXG5cdFx0XHRcdGluZGV4ID0gLTE7XG5cblx0XHRcdGlmICghZXZlbnROYW1lIHx8IHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzW2V2ZW50TmFtZV07XG5cdFx0XHRpZiAobGlzdGVuZXJzKSB7XG5cdFx0XHRcdGluZGV4ID0gbGlzdGVuZXJzLmluZGV4T2YoY2FsbGJhY2spO1xuXHRcdFx0XHRpZiAoaW5kZXggPj0gMCkge1xuXHRcdFx0XHRcdGxpc3RlbmVycy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdE5vZGUucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiAoZXZlbnROYW1lKSB7XG5cdFx0XHR2YXIgaSxcblx0XHRcdFx0bGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbZXZlbnROYW1lXTtcblxuXHRcdFx0aWYgKGxpc3RlbmVycyAmJiBsaXN0ZW5lcnMubGVuZ3RoKSB7XG5cdFx0XHRcdGZvciAoaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRzZXRUaW1lb3V0WmVybyhsaXN0ZW5lcnNbaV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdE5vZGUucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgaSxcblx0XHRcdFx0a2V5O1xuXG5cdFx0XHRkZWxldGUgdGhpcy5nbDtcblx0XHRcdGRlbGV0ZSB0aGlzLnNlcmlvdXNseTtcblxuXHRcdFx0Ly9yZW1vdmUgYWxsIGxpc3RlbmVyc1xuXHRcdFx0Zm9yIChrZXkgaW4gdGhpcy5saXN0ZW5lcnMpIHtcblx0XHRcdFx0aWYgKHRoaXMubGlzdGVuZXJzLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRkZWxldGUgdGhpcy5saXN0ZW5lcnNba2V5XTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvL2NsZWFyIG91dCB1bmlmb3Jtc1xuXHRcdFx0Zm9yIChpIGluIHRoaXMudW5pZm9ybXMpIHtcblx0XHRcdFx0aWYgKHRoaXMudW5pZm9ybXMuaGFzT3duUHJvcGVydHkoaSkpIHtcblx0XHRcdFx0XHRkZWxldGUgdGhpcy51bmlmb3Jtc1tpXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvL2NsZWFyIG91dCBsaXN0IG9mIHRhcmdldHMgYW5kIGRpc2Nvbm5lY3QgZWFjaFxuXHRcdFx0aWYgKHRoaXMudGFyZ2V0cykge1xuXHRcdFx0XHRkZWxldGUgdGhpcy50YXJnZXRzO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2NsZWFyIG91dCBmcmFtZUJ1ZmZlclxuXHRcdFx0aWYgKHRoaXMuZnJhbWVCdWZmZXIgJiYgdGhpcy5mcmFtZUJ1ZmZlci5kZXN0cm95KSB7XG5cdFx0XHRcdHRoaXMuZnJhbWVCdWZmZXIuZGVzdHJveSgpO1xuXHRcdFx0XHRkZWxldGUgdGhpcy5mcmFtZUJ1ZmZlcjtcblx0XHRcdH1cblxuXHRcdFx0Ly9yZW1vdmUgZnJvbSBtYWluIG5vZGVzIGluZGV4XG5cdFx0XHRpID0gbm9kZXMuaW5kZXhPZih0aGlzKTtcblx0XHRcdGlmIChpID49IDApIHtcblx0XHRcdFx0bm9kZXMuc3BsaWNlKGksIDEpO1xuXHRcdFx0fVxuXHRcdFx0ZGVsZXRlIG5vZGVzQnlJZFt0aGlzLmlkXTtcblxuXHRcdFx0dGhpcy5pc0Rlc3Ryb3llZCA9IHRydWU7XG5cdFx0fTtcblxuXHRcdEVmZmVjdCA9IGZ1bmN0aW9uIChlZmZlY3ROb2RlKSB7XG5cdFx0XHR2YXIgbmFtZSwgbWUgPSBlZmZlY3ROb2RlO1xuXG5cdFx0XHRmdW5jdGlvbiBhcnJheVRvSGV4KGNvbG9yKSB7XG5cdFx0XHRcdHZhciBpLCB2YWwsIHMgPSAnIyc7XG5cdFx0XHRcdGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcblx0XHRcdFx0XHR2YWwgPSBNYXRoLm1pbigyNTUsIE1hdGgucm91bmQoY29sb3JbaV0gKiAyNTUgfHwgMCkpO1xuXHRcdFx0XHRcdHMgKz0gdmFsLnRvU3RyaW5nKDE2KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcztcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gc2V0SW5wdXQoaW5wdXROYW1lLCBpbnB1dCkge1xuXHRcdFx0XHR2YXIgbG9va3VwLCB2YWx1ZSwgZWZmZWN0SW5wdXQsIGk7XG5cblx0XHRcdFx0ZWZmZWN0SW5wdXQgPSBtZS5lZmZlY3QuaW5wdXRzW2lucHV0TmFtZV07XG5cblx0XHRcdFx0bG9va3VwID0gbWUuaW5wdXRFbGVtZW50c1tpbnB1dE5hbWVdO1xuXG5cdFx0XHRcdGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnICYmIGlzTmFOKGlucHV0KSkge1xuXHRcdFx0XHRcdGlmIChlZmZlY3RJbnB1dC50eXBlID09PSAnZW51bScpIHtcblx0XHRcdFx0XHRcdGlmIChlZmZlY3RJbnB1dC5vcHRpb25zICYmIGVmZmVjdElucHV0Lm9wdGlvbnMuZmlsdGVyKSB7XG5cdFx0XHRcdFx0XHRcdGkgPSBTdHJpbmcoaW5wdXQpLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRcdFx0XHRcdHZhbHVlID0gZWZmZWN0SW5wdXQub3B0aW9ucy5maWx0ZXIoZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gKHR5cGVvZiBlID09PSAnc3RyaW5nJyAmJiBlLnRvTG93ZXJDYXNlKCkgPT09IGkpIHx8XG5cdFx0XHRcdFx0XHRcdFx0XHQoZS5sZW5ndGggJiYgdHlwZW9mIGVbMF0gPT09ICdzdHJpbmcnICYmIGVbMF0udG9Mb3dlckNhc2UoKSA9PT0gaSk7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRcdHZhbHVlID0gdmFsdWUubGVuZ3RoO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdGlucHV0ID0gZ2V0RWxlbWVudChpbnB1dCwgWydzZWxlY3QnXSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR9IGVsc2UgaWYgKGVmZmVjdElucHV0LnR5cGUgPT09ICdudW1iZXInIHx8IGVmZmVjdElucHV0LnR5cGUgPT09ICdib29sZWFuJykge1xuXHRcdFx0XHRcdFx0aW5wdXQgPSBnZXRFbGVtZW50KGlucHV0LCBbJ2lucHV0JywgJ3NlbGVjdCddKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGVmZmVjdElucHV0LnR5cGUgPT09ICdpbWFnZScpIHtcblx0XHRcdFx0XHRcdGlucHV0ID0gZ2V0RWxlbWVudChpbnB1dCwgWydjYW52YXMnLCAnaW1nJywgJ3ZpZGVvJ10pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvL3RvZG86IGNvbG9yPyBkYXRlL3RpbWU/XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50IHx8IGlucHV0IGluc3RhbmNlb2YgSFRNTFNlbGVjdEVsZW1lbnQpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IGlucHV0LnZhbHVlO1xuXG5cdFx0XHRcdFx0aWYgKGxvb2t1cCAmJiBsb29rdXAuZWxlbWVudCAhPT0gaW5wdXQpIHtcblx0XHRcdFx0XHRcdGxvb2t1cC5lbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGxvb2t1cC5saXN0ZW5lciwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRsb29rdXAuZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdpbnB1dCcsIGxvb2t1cC5saXN0ZW5lciwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRkZWxldGUgbWUuaW5wdXRFbGVtZW50c1tpbnB1dE5hbWVdO1xuXHRcdFx0XHRcdFx0bG9va3VwID0gbnVsbDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIWxvb2t1cCkge1xuXHRcdFx0XHRcdFx0bG9va3VwID0ge1xuXHRcdFx0XHRcdFx0XHRlbGVtZW50OiBpbnB1dCxcblx0XHRcdFx0XHRcdFx0bGlzdGVuZXI6IChmdW5jdGlvbiAobmFtZSwgZWxlbWVudCkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgb2xkVmFsdWUsIG5ld1ZhbHVlO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoaW5wdXQudHlwZSA9PT0gJ2NoZWNrYm94Jykge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQvL3NwZWNpYWwgY2FzZSBmb3IgY2hlY2sgYm94XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG9sZFZhbHVlID0gaW5wdXQuY2hlY2tlZDtcblx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG9sZFZhbHVlID0gZWxlbWVudC52YWx1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdG5ld1ZhbHVlID0gbWUuc2V0SW5wdXQobmFtZSwgb2xkVmFsdWUpO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHQvL3NwZWNpYWwgY2FzZSBmb3IgY29sb3IgdHlwZVxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKGVmZmVjdElucHV0LnR5cGUgPT09ICdjb2xvcicpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmV3VmFsdWUgPSBhcnJheVRvSGV4KG5ld1ZhbHVlKTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdFx0Ly9pZiBpbnB1dCB2YWxpZGF0b3IgY2hhbmdlcyBvdXIgdmFsdWUsIHVwZGF0ZSBIVE1MIEVsZW1lbnRcblx0XHRcdFx0XHRcdFx0XHRcdC8vdG9kbzogbWFrZSB0aGlzIG9wdGlvbmFsLi4uc29tZWhvd1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKG5ld1ZhbHVlICE9PSBvbGRWYWx1ZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRlbGVtZW50LnZhbHVlID0gbmV3VmFsdWU7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0fShpbnB1dE5hbWUsIGlucHV0KSlcblx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdG1lLmlucHV0RWxlbWVudHNbaW5wdXROYW1lXSA9IGxvb2t1cDtcblx0XHRcdFx0XHRcdGlmIChpbnB1dC50eXBlID09PSAncmFuZ2UnKSB7XG5cdFx0XHRcdFx0XHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgbG9va3VwLmxpc3RlbmVyLCB0cnVlKTtcblx0XHRcdFx0XHRcdFx0aW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgbG9va3VwLmxpc3RlbmVyLCB0cnVlKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGxvb2t1cC5saXN0ZW5lciwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGxvb2t1cCAmJiBpbnB1dC50eXBlID09PSAnY2hlY2tib3gnKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IGlucHV0LmNoZWNrZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmIChsb29rdXApIHtcblx0XHRcdFx0XHRcdGxvb2t1cC5lbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGxvb2t1cC5saXN0ZW5lciwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRsb29rdXAuZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdpbnB1dCcsIGxvb2t1cC5saXN0ZW5lciwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRkZWxldGUgbWUuaW5wdXRFbGVtZW50c1tpbnB1dE5hbWVdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR2YWx1ZSA9IGlucHV0O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bWUuc2V0SW5wdXQoaW5wdXROYW1lLCB2YWx1ZSk7XG5cdFx0XHRcdHJldHVybiBtZS5pbnB1dHNbaW5wdXROYW1lXTtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gbWFrZUltYWdlU2V0dGVyKGlucHV0TmFtZSkge1xuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHRcdFx0dmFyIHZhbCA9IHNldElucHV0KGlucHV0TmFtZSwgdmFsdWUpO1xuXHRcdFx0XHRcdHJldHVybiB2YWwgJiYgdmFsLnB1Yjtcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gbWFrZUltYWdlR2V0dGVyKGlucHV0TmFtZSkge1xuXHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHZhciB2YWwgPSBtZS5pbnB1dHNbaW5wdXROYW1lXTtcblx0XHRcdFx0XHRyZXR1cm4gdmFsICYmIHZhbC5wdWI7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIG1ha2VTZXR0ZXIoaW5wdXROYW1lKSB7XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdFx0XHRyZXR1cm4gc2V0SW5wdXQoaW5wdXROYW1lLCB2YWx1ZSk7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIG1ha2VHZXR0ZXIoaW5wdXROYW1lKSB7XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG1lLmlucHV0c1tpbnB1dE5hbWVdO1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvL3ByaXZlbGVnZWQgcHVibGljbHkgYWNjZXNzaWJsZSBtZXRob2RzL3NldHRlcnMvZ2V0dGVyc1xuXHRcdFx0Ly90b2RvOiBwcm92aWRlIGFuIGFsdGVybmF0ZSBtZXRob2Rcblx0XHRcdGZvciAobmFtZSBpbiBtZS5lZmZlY3QuaW5wdXRzKSB7XG5cdFx0XHRcdGlmIChtZS5lZmZlY3QuaW5wdXRzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXNbbmFtZV0gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0aWYgKG1lLmVmZmVjdC5pbnB1dHNbbmFtZV0udHlwZSA9PT0gJ2ltYWdlJykge1xuXHRcdFx0XHRcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgbmFtZSwge1xuXHRcdFx0XHRcdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdGdldDogbWFrZUltYWdlR2V0dGVyKG5hbWUpLFxuXHRcdFx0XHRcdFx0XHRcdHNldDogbWFrZUltYWdlU2V0dGVyKG5hbWUpXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIG5hbWUsIHtcblx0XHRcdFx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0ZW51bWVyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRnZXQ6IG1ha2VHZXR0ZXIobmFtZSksXG5cdFx0XHRcdFx0XHRcdFx0c2V0OiBtYWtlU2V0dGVyKG5hbWUpXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHQvL3RvZG86IHRoaXMgaXMgdGVtcG9yYXJ5LiBnZXQgcmlkIG9mIGl0LlxuXHRcdFx0XHRcdFx0dGhyb3cgJ0Nhbm5vdCBvdmVyd3JpdGUgU2VyaW91c2x5LicgKyBuYW1lO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG5cdFx0XHRcdGlucHV0czoge1xuXHRcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG5cdFx0XHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0c291cmNlOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ2ltYWdlJ1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0b3JpZ2luYWw6IHtcblx0XHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRnZXQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJldHVybiBtZS5zb3VyY2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR3aWR0aDoge1xuXHRcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG5cdFx0XHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG1lLndpZHRoO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0aGVpZ2h0OiB7XG5cdFx0XHRcdFx0ZW51bWVyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRcdFx0Z2V0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbWUuaGVpZ2h0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0aWQ6IHtcblx0XHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRnZXQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJldHVybiBtZS5pZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLnJlbmRlciA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0bWUucmVuZGVyKCk7XG5cdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5yZWFkUGl4ZWxzID0gZnVuY3Rpb24gKHgsIHksIHdpZHRoLCBoZWlnaHQsIGRlc3QpIHtcblx0XHRcdFx0cmV0dXJuIG1lLnJlYWRQaXhlbHMoeCwgeSwgd2lkdGgsIGhlaWdodCwgZGVzdCk7XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLm9uID0gZnVuY3Rpb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcblx0XHRcdFx0bWUub24oZXZlbnROYW1lLCBjYWxsYmFjayk7XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLm9mZiA9IGZ1bmN0aW9uIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG5cdFx0XHRcdG1lLm9mZihldmVudE5hbWUsIGNhbGxiYWNrKTtcblx0XHRcdH07XG5cblx0XHRcdHRoaXMuYWxpYXMgPSBmdW5jdGlvbiAoaW5wdXROYW1lLCBhbGlhc05hbWUpIHtcblx0XHRcdFx0bWUuYWxpYXMoaW5wdXROYW1lLCBhbGlhc05hbWUpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdH07XG5cblx0XHRcdHRoaXMubWF0dGUgPSBmdW5jdGlvbiAocG9seWdvbnMpIHtcblx0XHRcdFx0bWUubWF0dGUocG9seWdvbnMpO1xuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgaSxcblx0XHRcdFx0XHRkZXNjcmlwdG9yO1xuXG5cdFx0XHRcdG1lLmRlc3Ryb3koKTtcblxuXHRcdFx0XHRmb3IgKGkgaW4gdGhpcykge1xuXHRcdFx0XHRcdGlmICh0aGlzLmhhc093blByb3BlcnR5KGkpICYmIGkgIT09ICdpc0Rlc3Ryb3llZCcpIHtcblx0XHRcdFx0XHRcdGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRoaXMsIGkpO1xuXHRcdFx0XHRcdFx0aWYgKGRlc2NyaXB0b3IuZ2V0IHx8IGRlc2NyaXB0b3Iuc2V0IHx8XG5cdFx0XHRcdFx0XHRcdFx0dHlwZW9mIHRoaXNbaV0gIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRcdFx0ZGVsZXRlIHRoaXNbaV07XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0aGlzW2ldID0gbm9wO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5pc0Rlc3Ryb3llZCA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIG1lLmlzRGVzdHJveWVkO1xuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5pc1JlYWR5ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gbWUucmVhZHk7XG5cdFx0XHR9O1xuXHRcdH07XG5cblx0XHRFZmZlY3ROb2RlID0gZnVuY3Rpb24gKGhvb2ssIG9wdGlvbnMpIHtcblx0XHRcdHZhciBrZXksIG5hbWUsIGlucHV0LFxuXHRcdFx0XHRoYXNJbWFnZSA9IGZhbHNlO1xuXG5cdFx0XHROb2RlLmNhbGwodGhpcywgb3B0aW9ucyk7XG5cblx0XHRcdHRoaXMuZWZmZWN0UmVmID0gc2VyaW91c0VmZmVjdHNbaG9va107XG5cdFx0XHR0aGlzLnNvdXJjZXMgPSB7fTtcblx0XHRcdHRoaXMudGFyZ2V0cyA9IFtdO1xuXHRcdFx0dGhpcy5pbnB1dEVsZW1lbnRzID0ge307XG5cdFx0XHR0aGlzLmRpcnR5ID0gdHJ1ZTtcblx0XHRcdHRoaXMuc2hhZGVyRGlydHkgPSB0cnVlO1xuXHRcdFx0dGhpcy5ob29rID0gaG9vaztcblx0XHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0XHR0aGlzLnRyYW5zZm9ybSA9IG51bGw7XG5cblx0XHRcdGlmICh0aGlzLmVmZmVjdFJlZi5kZWZpbml0aW9uKSB7XG5cdFx0XHRcdHRoaXMuZWZmZWN0ID0gdGhpcy5lZmZlY3RSZWYuZGVmaW5pdGlvbi5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuXHRcdFx0XHQvKlxuXHRcdFx0XHR0b2RvOiBjb3B5IG92ZXIgaW5wdXRzIG9iamVjdCBzZXBhcmF0ZWx5IGluIGNhc2Ugc29tZSBhcmUgc3BlY2lmaWVkXG5cdFx0XHRcdGluIGFkdmFuY2UgYW5kIHNvbWUgYXJlIHNwZWNpZmllZCBpbiBkZWZpbml0aW9uIGZ1bmN0aW9uXG5cdFx0XHRcdCovXG5cdFx0XHRcdGZvciAoa2V5IGluIHRoaXMuZWZmZWN0UmVmKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuZWZmZWN0UmVmLmhhc093blByb3BlcnR5KGtleSkgJiYgIXRoaXMuZWZmZWN0W2tleV0pIHtcblx0XHRcdFx0XHRcdHRoaXMuZWZmZWN0W2tleV0gPSB0aGlzLmVmZmVjdFJlZltrZXldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhpcy5lZmZlY3QuaW5wdXRzICE9PSB0aGlzLmVmZmVjdFJlZi5pbnB1dHMpIHtcblx0XHRcdFx0XHR2YWxpZGF0ZUlucHV0U3BlY3ModGhpcy5lZmZlY3QpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmVmZmVjdCA9IGV4dGVuZCh7fSwgdGhpcy5lZmZlY3RSZWYpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3RvZG86IHNldCB1cCBmcmFtZSBidWZmZXIocyksIGlucHV0cywgdHJhbnNmb3Jtcywgc3RlbmNpbHMsIGRyYXcgbWV0aG9kLiBhbGxvdyBwbHVnaW4gdG8gb3ZlcnJpZGVcblxuXHRcdFx0dGhpcy51bmlmb3Jtcy50cmFuc2Zvcm0gPSBpZGVudGl0eTtcblx0XHRcdHRoaXMuaW5wdXRzID0ge307XG5cdFx0XHRmb3IgKG5hbWUgaW4gdGhpcy5lZmZlY3QuaW5wdXRzKSB7XG5cdFx0XHRcdGlmICh0aGlzLmVmZmVjdC5pbnB1dHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcblx0XHRcdFx0XHRpbnB1dCA9IHRoaXMuZWZmZWN0LmlucHV0c1tuYW1lXTtcblxuXHRcdFx0XHRcdHRoaXMuaW5wdXRzW25hbWVdID0gaW5wdXQuZGVmYXVsdFZhbHVlO1xuXHRcdFx0XHRcdGlmIChpbnB1dC51bmlmb3JtKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnVuaWZvcm1zW2lucHV0LnVuaWZvcm1dID0gaW5wdXQuZGVmYXVsdFZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaW5wdXQudHlwZSA9PT0gJ2ltYWdlJykge1xuXHRcdFx0XHRcdFx0aGFzSW1hZ2UgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZ2wpIHtcblx0XHRcdFx0dGhpcy5pbml0aWFsaXplKCk7XG5cdFx0XHRcdGlmICh0aGlzLmVmZmVjdC5jb21tb25TaGFkZXIpIHtcblx0XHRcdFx0XHQvL3RoaXMgZWZmZWN0IGlzIHVubGlrZWx5IHRvIG5lZWQgdG8gYmUgbW9kaWZpZWQgYWdhaW5cblx0XHRcdFx0XHQvL2J5IGNoYW5naW5nIHBhcmFtZXRlcnNcblx0XHRcdFx0XHR0aGlzLmJ1aWxkU2hhZGVyKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5yZWFkeSA9ICFoYXNJbWFnZTtcblx0XHRcdHRoaXMuaW5QbGFjZSA9IHRoaXMuZWZmZWN0LmluUGxhY2U7XG5cblx0XHRcdHRoaXMucHViID0gbmV3IEVmZmVjdCh0aGlzKTtcblxuXHRcdFx0ZWZmZWN0cy5wdXNoKHRoaXMpO1xuXG5cdFx0XHRhbGxFZmZlY3RzQnlIb29rW2hvb2tdLnB1c2godGhpcyk7XG5cdFx0fTtcblxuXHRcdGV4dGVuZChFZmZlY3ROb2RlLCBOb2RlKTtcblxuXHRcdEVmZmVjdE5vZGUucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIXRoaXMuaW5pdGlhbGl6ZWQpIHtcblx0XHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXG5cdFx0XHRcdHRoaXMuYmFzZVNoYWRlciA9IGJhc2VTaGFkZXI7XG5cblx0XHRcdFx0aWYgKHRoaXMuc2hhcGUpIHtcblx0XHRcdFx0XHR0aGlzLm1vZGVsID0gbWFrZUdsTW9kZWwodGhpcy5zaGFwZSwgdGhpcy5nbCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5tb2RlbCA9IHJlY3RhbmdsZU1vZGVsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLmVmZmVjdC5pbml0aWFsaXplID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0dGhpcy5lZmZlY3QuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHRoYXQuaW5pdEZyYW1lQnVmZmVyKHRydWUpO1xuXHRcdFx0XHRcdH0sIGdsKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmluaXRGcmFtZUJ1ZmZlcih0cnVlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLmZyYW1lQnVmZmVyKSB7XG5cdFx0XHRcdFx0dGhpcy50ZXh0dXJlID0gdGhpcy5mcmFtZUJ1ZmZlci50ZXh0dXJlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdEVmZmVjdE5vZGUucHJvdG90eXBlLnJlc2l6ZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBpO1xuXG5cdFx0XHROb2RlLnByb3RvdHlwZS5yZXNpemUuY2FsbCh0aGlzKTtcblxuXHRcdFx0aWYgKHRoaXMuZWZmZWN0LnJlc2l6ZSkge1xuXHRcdFx0XHR0aGlzLmVmZmVjdC5yZXNpemUuY2FsbCh0aGlzKTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChpID0gMDsgaSA8IHRoaXMudGFyZ2V0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHR0aGlzLnRhcmdldHNbaV0ucmVzaXplKCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdEVmZmVjdE5vZGUucHJvdG90eXBlLnNldFJlYWR5ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIGksXG5cdFx0XHRcdGlucHV0LFxuXHRcdFx0XHRrZXk7XG5cblx0XHRcdGlmICghdGhpcy5yZWFkeSkge1xuXHRcdFx0XHRmb3IgKGtleSBpbiB0aGlzLmVmZmVjdC5pbnB1dHMpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5lZmZlY3QuaW5wdXRzLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRcdGlucHV0ID0gdGhpcy5lZmZlY3QuaW5wdXRzW2tleV07XG5cdFx0XHRcdFx0XHRpZiAoaW5wdXQudHlwZSA9PT0gJ2ltYWdlJyAmJlxuXHRcdFx0XHRcdFx0XHRcdCghdGhpcy5zb3VyY2VzW2tleV0gfHwgIXRoaXMuc291cmNlc1trZXldLnJlYWR5KSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5yZWFkeSA9IHRydWU7XG5cdFx0XHRcdHRoaXMuZW1pdCgncmVhZHknKTtcblx0XHRcdFx0aWYgKHRoaXMudGFyZ2V0cykge1xuXHRcdFx0XHRcdGZvciAoaSA9IDA7IGkgPCB0aGlzLnRhcmdldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdHRoaXMudGFyZ2V0c1tpXS5zZXRSZWFkeSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRFZmZlY3ROb2RlLnByb3RvdHlwZS5zZXRVbnJlYWR5ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIGksXG5cdFx0XHRcdGlucHV0LFxuXHRcdFx0XHRrZXk7XG5cblx0XHRcdGlmICh0aGlzLnJlYWR5KSB7XG5cdFx0XHRcdGZvciAoa2V5IGluIHRoaXMuZWZmZWN0LmlucHV0cykge1xuXHRcdFx0XHRcdGlmICh0aGlzLmVmZmVjdC5pbnB1dHMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0XHRcdFx0aW5wdXQgPSB0aGlzLmVmZmVjdC5pbnB1dHNba2V5XTtcblx0XHRcdFx0XHRcdGlmIChpbnB1dC50eXBlID09PSAnaW1hZ2UnICYmXG5cdFx0XHRcdFx0XHRcdFx0KCF0aGlzLnNvdXJjZXNba2V5XSB8fCAhdGhpcy5zb3VyY2VzW2tleV0ucmVhZHkpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMucmVhZHkgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCF0aGlzLnJlYWR5KSB7XG5cdFx0XHRcdFx0dGhpcy5lbWl0KCd1bnJlYWR5Jyk7XG5cdFx0XHRcdFx0aWYgKHRoaXMudGFyZ2V0cykge1xuXHRcdFx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IHRoaXMudGFyZ2V0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnRhcmdldHNbaV0uc2V0VW5yZWFkeSgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblxuXHRcdEVmZmVjdE5vZGUucHJvdG90eXBlLnNldFRhcmdldCA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcblx0XHRcdHZhciBpO1xuXHRcdFx0Zm9yIChpID0gMDsgaSA8IHRoaXMudGFyZ2V0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAodGhpcy50YXJnZXRzW2ldID09PSB0YXJnZXQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy50YXJnZXRzLnB1c2godGFyZ2V0KTtcblx0XHR9O1xuXG5cdFx0RWZmZWN0Tm9kZS5wcm90b3R5cGUucmVtb3ZlVGFyZ2V0ID0gZnVuY3Rpb24gKHRhcmdldCkge1xuXHRcdFx0dmFyIGkgPSB0aGlzLnRhcmdldHMgJiYgdGhpcy50YXJnZXRzLmluZGV4T2YodGFyZ2V0KTtcblx0XHRcdGlmIChpID49IDApIHtcblx0XHRcdFx0dGhpcy50YXJnZXRzLnNwbGljZShpLCAxKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0RWZmZWN0Tm9kZS5wcm90b3R5cGUucmVtb3ZlU291cmNlID0gZnVuY3Rpb24gKHNvdXJjZSkge1xuXHRcdFx0dmFyIGksIHB1YiA9IHNvdXJjZSAmJiBzb3VyY2UucHViO1xuXG5cdFx0XHRmb3IgKGkgaW4gdGhpcy5pbnB1dHMpIHtcblx0XHRcdFx0aWYgKHRoaXMuaW5wdXRzLmhhc093blByb3BlcnR5KGkpICYmXG5cdFx0XHRcdFx0KHRoaXMuaW5wdXRzW2ldID09PSBzb3VyY2UgfHwgdGhpcy5pbnB1dHNbaV0gPT09IHB1YikpIHtcblx0XHRcdFx0XHR0aGlzLmlucHV0c1tpXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChpIGluIHRoaXMuc291cmNlcykge1xuXHRcdFx0XHRpZiAodGhpcy5zb3VyY2VzLmhhc093blByb3BlcnR5KGkpICYmXG5cdFx0XHRcdFx0KHRoaXMuc291cmNlc1tpXSA9PT0gc291cmNlIHx8IHRoaXMuc291cmNlc1tpXSA9PT0gcHViKSkge1xuXHRcdFx0XHRcdHRoaXMuc291cmNlc1tpXSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0RWZmZWN0Tm9kZS5wcm90b3R5cGUuYnVpbGRTaGFkZXIgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgc2hhZGVyLCBlZmZlY3QgPSB0aGlzLmVmZmVjdDtcblx0XHRcdGlmICh0aGlzLnNoYWRlckRpcnR5KSB7XG5cdFx0XHRcdGlmIChlZmZlY3QuY29tbW9uU2hhZGVyICYmIGNvbW1vblNoYWRlcnNbdGhpcy5ob29rXSkge1xuXHRcdFx0XHRcdGlmICghdGhpcy5zaGFkZXIpIHtcblx0XHRcdFx0XHRcdGNvbW1vblNoYWRlcnNbdGhpcy5ob29rXS5jb3VudCsrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLnNoYWRlciA9IGNvbW1vblNoYWRlcnNbdGhpcy5ob29rXS5zaGFkZXI7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZWZmZWN0LnNoYWRlcikge1xuXHRcdFx0XHRcdGlmICh0aGlzLnNoYWRlciAmJiAhZWZmZWN0LmNvbW1vblNoYWRlcikge1xuXHRcdFx0XHRcdFx0dGhpcy5zaGFkZXIuZGVzdHJveSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzaGFkZXIgPSBlZmZlY3Quc2hhZGVyLmNhbGwodGhpcywgdGhpcy5pbnB1dHMsIHtcblx0XHRcdFx0XHRcdHZlcnRleDogYmFzZVZlcnRleFNoYWRlcixcblx0XHRcdFx0XHRcdGZyYWdtZW50OiBiYXNlRnJhZ21lbnRTaGFkZXJcblx0XHRcdFx0XHR9LCBTZXJpb3VzbHkudXRpbCk7XG5cblx0XHRcdFx0XHRpZiAoc2hhZGVyIGluc3RhbmNlb2YgU2hhZGVyUHJvZ3JhbSkge1xuXHRcdFx0XHRcdFx0dGhpcy5zaGFkZXIgPSBzaGFkZXI7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzaGFkZXIgJiYgc2hhZGVyLnZlcnRleCAmJiBzaGFkZXIuZnJhZ21lbnQpIHtcblx0XHRcdFx0XHRcdHRoaXMuc2hhZGVyID0gbmV3IFNoYWRlclByb2dyYW0oZ2wsIHNoYWRlci52ZXJ0ZXgsIHNoYWRlci5mcmFnbWVudCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuc2hhZGVyID0gYmFzZVNoYWRlcjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoZWZmZWN0LmNvbW1vblNoYWRlcikge1xuXHRcdFx0XHRcdFx0Y29tbW9uU2hhZGVyc1t0aGlzLmhvb2tdID0ge1xuXHRcdFx0XHRcdFx0XHRjb3VudDogMSxcblx0XHRcdFx0XHRcdFx0c2hhZGVyOiB0aGlzLnNoYWRlclxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5zaGFkZXIgPSBiYXNlU2hhZGVyO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5zaGFkZXJEaXJ0eSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRFZmZlY3ROb2RlLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgaSxcblx0XHRcdFx0ZnJhbWVCdWZmZXIsXG5cdFx0XHRcdGVmZmVjdCA9IHRoaXMuZWZmZWN0LFxuXHRcdFx0XHR0aGF0ID0gdGhpcyxcblx0XHRcdFx0aW5QbGFjZTtcblxuXHRcdFx0ZnVuY3Rpb24gZHJhd0ZuKHNoYWRlciwgbW9kZWwsIHVuaWZvcm1zLCBmcmFtZUJ1ZmZlciwgbm9kZSwgb3B0aW9ucykge1xuXHRcdFx0XHRkcmF3KHNoYWRlciwgbW9kZWwsIHVuaWZvcm1zLCBmcmFtZUJ1ZmZlciwgbm9kZSB8fCB0aGF0LCBvcHRpb25zKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLmluaXRpYWxpemVkKSB7XG5cdFx0XHRcdHRoaXMuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5zaGFkZXJEaXJ0eSkge1xuXHRcdFx0XHR0aGlzLmJ1aWxkU2hhZGVyKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmRpcnR5KSB7XG5cdFx0XHRcdGZvciAoaSBpbiB0aGlzLnNvdXJjZXMpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5zb3VyY2VzLmhhc093blByb3BlcnR5KGkpICYmXG5cdFx0XHRcdFx0XHQoIWVmZmVjdC5yZXF1aXJlcyB8fCBlZmZlY3QucmVxdWlyZXMuY2FsbCh0aGlzLCBpLCB0aGlzLmlucHV0cykpKSB7XG5cblx0XHRcdFx0XHRcdC8vdG9kbzogc2V0IHNvdXJjZSB0ZXh0dXJlXG5cdFx0XHRcdFx0XHQvL3NvdXJjZXRleHR1cmUgPSB0aGlzLnNvdXJjZXNbaV0ucmVuZGVyKCkgfHwgdGhpcy5zb3VyY2VzW2ldLnRleHR1cmVcblxuXHRcdFx0XHRcdFx0aW5QbGFjZSA9IHR5cGVvZiB0aGlzLmluUGxhY2UgPT09ICdmdW5jdGlvbicgPyB0aGlzLmluUGxhY2UoaSkgOiB0aGlzLmluUGxhY2U7XG5cdFx0XHRcdFx0XHR0aGlzLnNvdXJjZXNbaV0ucmVuZGVyKCFpblBsYWNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5mcmFtZUJ1ZmZlcikge1xuXHRcdFx0XHRcdGZyYW1lQnVmZmVyID0gdGhpcy5mcmFtZUJ1ZmZlci5mcmFtZUJ1ZmZlcjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0eXBlb2YgZWZmZWN0LmRyYXcgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRlZmZlY3QuZHJhdy5jYWxsKHRoaXMsIHRoaXMuc2hhZGVyLCB0aGlzLm1vZGVsLCB0aGlzLnVuaWZvcm1zLCBmcmFtZUJ1ZmZlciwgZHJhd0ZuKTtcblx0XHRcdFx0XHR0aGlzLmVtaXQoJ3JlbmRlcicpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGZyYW1lQnVmZmVyKSB7XG5cdFx0XHRcdFx0ZHJhdyh0aGlzLnNoYWRlciwgdGhpcy5tb2RlbCwgdGhpcy51bmlmb3JtcywgZnJhbWVCdWZmZXIsIHRoaXMpO1xuXHRcdFx0XHRcdHRoaXMuZW1pdCgncmVuZGVyJyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmRpcnR5ID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLnRleHR1cmU7XG5cdFx0fTtcblxuXHRcdEVmZmVjdE5vZGUucHJvdG90eXBlLnNldElucHV0ID0gZnVuY3Rpb24gKG5hbWUsIHZhbHVlKSB7XG5cdFx0XHR2YXIgaW5wdXQsIHVuaWZvcm0sXG5cdFx0XHRcdHNvdXJjZUtleXMsXG5cdFx0XHRcdHNvdXJjZTtcblxuXHRcdFx0aWYgKHRoaXMuZWZmZWN0LmlucHV0cy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuXHRcdFx0XHRpbnB1dCA9IHRoaXMuZWZmZWN0LmlucHV0c1tuYW1lXTtcblx0XHRcdFx0aWYgKGlucHV0LnR5cGUgPT09ICdpbWFnZScpIHtcblx0XHRcdFx0XHQvLyYmICEodmFsdWUgaW5zdGFuY2VvZiBFZmZlY3QpICYmICEodmFsdWUgaW5zdGFuY2VvZiBTb3VyY2UpKSB7XG5cblx0XHRcdFx0XHRpZiAodmFsdWUpIHtcblx0XHRcdFx0XHRcdHZhbHVlID0gZmluZElucHV0Tm9kZSh2YWx1ZSk7XG5cblx0XHRcdFx0XHRcdGlmICh2YWx1ZSAhPT0gdGhpcy5zb3VyY2VzW25hbWVdKSB7XG5cdFx0XHRcdFx0XHRcdGlmICh0aGlzLnNvdXJjZXNbbmFtZV0pIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnNvdXJjZXNbbmFtZV0ucmVtb3ZlVGFyZ2V0KHRoaXMpO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0aWYgKHRyYWNlU291cmNlcyh2YWx1ZSwgdGhpcykpIHtcblx0XHRcdFx0XHRcdFx0XHR0aHJvdyAnQXR0ZW1wdCB0byBtYWtlIGN5Y2xpY2FsIGNvbm5lY3Rpb24uJztcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHRoaXMuc291cmNlc1tuYW1lXSA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0XHR2YWx1ZS5zZXRUYXJnZXQodGhpcyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGRlbGV0ZSB0aGlzLnNvdXJjZXNbbmFtZV07XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHVuaWZvcm0gPSB0aGlzLnNvdXJjZXNbbmFtZV07XG5cblx0XHRcdFx0XHRzb3VyY2VLZXlzID0gT2JqZWN0LmtleXModGhpcy5zb3VyY2VzKTtcblx0XHRcdFx0XHRpZiAodGhpcy5pblBsYWNlID09PSB0cnVlICYmIHNvdXJjZUtleXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0XHRzb3VyY2UgPSB0aGlzLnNvdXJjZXNbc291cmNlS2V5c1swXV07XG5cdFx0XHRcdFx0XHR0aGlzLnVuaWZvcm1zLnRyYW5zZm9ybSA9IHNvdXJjZSAmJiBzb3VyY2UuY3VtdWxhdGl2ZU1hdHJpeCB8fCBpZGVudGl0eTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy51bmlmb3Jtcy50cmFuc2Zvcm0gPSBpZGVudGl0eTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLnJlc2l6ZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHZhbHVlID0gaW5wdXQudmFsaWRhdGUuY2FsbCh0aGlzLCB2YWx1ZSwgaW5wdXQsIHRoaXMuaW5wdXRzW25hbWVdKTtcblx0XHRcdFx0XHR1bmlmb3JtID0gdmFsdWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5pbnB1dHNbbmFtZV0gPT09IHZhbHVlICYmIGlucHV0LnR5cGUgIT09ICdjb2xvcicgJiYgaW5wdXQudHlwZSAhPT0gJ3ZlY3RvcicpIHtcblx0XHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmlucHV0c1tuYW1lXSA9IHZhbHVlO1xuXG5cdFx0XHRcdGlmIChpbnB1dC51bmlmb3JtKSB7XG5cdFx0XHRcdFx0dGhpcy51bmlmb3Jtc1tpbnB1dC51bmlmb3JtXSA9IHVuaWZvcm07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaW5wdXQuc2hhZGVyRGlydHkpIHtcblx0XHRcdFx0XHR0aGlzLnNoYWRlckRpcnR5ID0gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh2YWx1ZSAmJiB2YWx1ZS5yZWFkeSkge1xuXHRcdFx0XHRcdHRoaXMuc2V0UmVhZHkoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnNldFVucmVhZHkoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuc2V0RGlydHkoKTtcblxuXHRcdFx0XHRpZiAoaW5wdXQudXBkYXRlKSB7XG5cdFx0XHRcdFx0aW5wdXQudXBkYXRlLmNhbGwodGhpcywgdmFsdWUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRFZmZlY3ROb2RlLnByb3RvdHlwZS5hbGlhcyA9IGZ1bmN0aW9uIChpbnB1dE5hbWUsIGFsaWFzTmFtZSkge1xuXHRcdFx0dmFyIHRoYXQgPSB0aGlzO1xuXG5cdFx0XHRpZiAocmVzZXJ2ZWROYW1lcy5pbmRleE9mKGFsaWFzTmFtZSkgPj0gMCkge1xuXHRcdFx0XHR0aHJvdyBhbGlhc05hbWUgKyAnIGlzIGEgcmVzZXJ2ZWQgbmFtZSBhbmQgY2Fubm90IGJlIHVzZWQgYXMgYW4gYWxpYXMuJztcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuZWZmZWN0LmlucHV0cy5oYXNPd25Qcm9wZXJ0eShpbnB1dE5hbWUpKSB7XG5cdFx0XHRcdGlmICghYWxpYXNOYW1lKSB7XG5cdFx0XHRcdFx0YWxpYXNOYW1lID0gaW5wdXROYW1lO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c2VyaW91c2x5LnJlbW92ZUFsaWFzKGFsaWFzTmFtZSk7XG5cblx0XHRcdFx0YWxpYXNlc1thbGlhc05hbWVdID0ge1xuXHRcdFx0XHRcdG5vZGU6IHRoaXMsXG5cdFx0XHRcdFx0aW5wdXQ6IGlucHV0TmFtZVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzZXJpb3VzbHksIGFsaWFzTmFtZSwge1xuXHRcdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoYXQuaW5wdXRzW2lucHV0TmFtZV07XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoYXQuc2V0SW5wdXQoaW5wdXROYW1lLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblxuXHRcdC8qXG5cdFx0bWF0dGUgZnVuY3Rpb24gdG8gYmUgYXNzaWduZWQgYXMgYSBtZXRob2QgdG8gRWZmZWN0Tm9kZSBhbmQgVGFyZ2V0Tm9kZVxuXHRcdCovXG5cdFx0RWZmZWN0Tm9kZS5wcm90b3R5cGUubWF0dGUgPSBmdW5jdGlvbiAocG9seSkge1xuXHRcdFx0dmFyIHBvbHlzLFxuXHRcdFx0XHRwb2x5Z29ucyA9IFtdLFxuXHRcdFx0XHRwb2x5Z29uLFxuXHRcdFx0XHR2ZXJ0aWNlcyA9IFtdLFxuXHRcdFx0XHRpLCBqLCB2LFxuXHRcdFx0XHR2ZXJ0LCBwcmV2LFxuXHRcdFx0XHQvL3RyaWFuZ2xlcyA9IFtdLFxuXHRcdFx0XHRzaGFwZSA9IHt9O1xuXG5cdFx0XHQvL2RldGVjdCB3aGV0aGVyIGl0J3MgbXVsdGlwbGUgcG9seWdvbnMgb3Igd2hhdFxuXHRcdFx0ZnVuY3Rpb24gbWFrZVBvbHlnb25zQXJyYXkocG9seSkge1xuXHRcdFx0XHRpZiAoIXBvbHkgfHwgIXBvbHkubGVuZ3RoIHx8ICFBcnJheS5pc0FycmF5KHBvbHkpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KHBvbHlbMF0pKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtwb2x5XTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHBvbHlbMF0pICYmICFpc05hTihwb2x5WzBdWzBdKSkge1xuXHRcdFx0XHRcdHJldHVybiBbcG9seV07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gcG9seTtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gbGluZXNJbnRlcnNlY3QoYTEsIGEyLCBiMSwgYjIpIHtcblx0XHRcdFx0dmFyIHVhX3QsIHViX3QsIHVfYiwgdWEsIHViO1xuXHRcdFx0XHR1YV90ID0gKGIyLnggLSBiMS54KSAqIChhMS55IC0gYjEueSkgLSAoYjIueSAtIGIxLnkpICogKGExLnggLSBiMS54KTtcblx0XHRcdFx0dWJfdCA9IChhMi54IC0gYTEueCkgKiAoYTEueSAtIGIxLnkpIC0gKGEyLnkgLSBhMS55KSAqIChhMS54IC0gYjEueCk7XG5cdFx0XHRcdHVfYiA9IChiMi55IC0gYjEueSkgKiAoYTIueCAtIGExLngpIC0gKGIyLnggLSBiMS54KSAqIChhMi55IC0gYTEueSk7XG5cdFx0XHRcdGlmICh1X2IpIHtcblx0XHRcdFx0XHR1YSA9IHVhX3QgLyB1X2I7XG5cdFx0XHRcdFx0dWIgPSB1Yl90IC8gdV9iO1xuXHRcdFx0XHRcdGlmICh1YSA+IDAgJiYgdWEgPD0gMSAmJiB1YiA+IDAgJiYgdWIgPD0gMSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0eDogYTEueCArIHVhICogKGEyLnggLSBhMS54KSxcblx0XHRcdFx0XHRcdFx0eTogYTEueSArIHVhICogKGEyLnkgLSBhMS55KVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBtYWtlU2ltcGxlKHBvbHkpIHtcblx0XHRcdFx0Lypcblx0XHRcdFx0dGhpcyB1c2VzIGEgc2xvdywgbmFpdmUgYXBwcm9hY2ggdG8gZGV0ZWN0aW5nIGxpbmUgaW50ZXJzZWN0aW9ucy5cblx0XHRcdFx0VXNlIEJlbnRsZXktT3R0bWFubiBBbGdvcml0aG1cblx0XHRcdFx0c2VlOiBodHRwOi8vc29mdHN1cmZlci5jb20vQXJjaGl2ZS9hbGdvcml0aG1fMDEwOC9hbGdvcml0aG1fMDEwOC5odG0jQmVudGxleS1PdHRtYW5uIEFsZ29yaXRobVxuXHRcdFx0XHRzZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS90b2t1bWluZS9zd2VlcGxpbmVcblx0XHRcdFx0Ki9cblx0XHRcdFx0dmFyIGksIGosXG5cdFx0XHRcdFx0ZWRnZTEsIGVkZ2UyLFxuXHRcdFx0XHRcdGludGVyc2VjdCxcblx0XHRcdFx0XHRpbnRlcnNlY3Rpb25zID0gW10sXG5cdFx0XHRcdFx0bmV3UG9seSxcblx0XHRcdFx0XHRoZWFkLCBwb2ludCxcblx0XHRcdFx0XHRuZXdQb2x5Z29ucyxcblx0XHRcdFx0XHRwb2ludDEsIHBvaW50MjtcblxuXHRcdFx0XHRpZiAocG9seS5zaW1wbGUpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGkgPSAwOyBpIDwgcG9seS5lZGdlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGVkZ2UxID0gcG9seS5lZGdlc1tpXTtcblx0XHRcdFx0XHRmb3IgKGogPSBpICsgMTsgaiA8IHBvbHkuZWRnZXMubGVuZ3RoOyBqKyspIHtcblx0XHRcdFx0XHRcdGVkZ2UyID0gcG9seS5lZGdlc1tqXTtcblx0XHRcdFx0XHRcdGludGVyc2VjdCA9IGxpbmVzSW50ZXJzZWN0KGVkZ2UxWzBdLCBlZGdlMVsxXSwgZWRnZTJbMF0sIGVkZ2UyWzFdKTtcblx0XHRcdFx0XHRcdGlmIChpbnRlcnNlY3QpIHtcblx0XHRcdFx0XHRcdFx0aW50ZXJzZWN0LmVkZ2UxID0gZWRnZTE7XG5cdFx0XHRcdFx0XHRcdGludGVyc2VjdC5lZGdlMiA9IGVkZ2UyO1xuXHRcdFx0XHRcdFx0XHRpbnRlcnNlY3Rpb25zLnB1c2goaW50ZXJzZWN0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaW50ZXJzZWN0aW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0XHRuZXdQb2x5Z29ucyA9IFtdO1xuXG5cdFx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IGludGVyc2VjdGlvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdGludGVyc2VjdCA9IGludGVyc2VjdGlvbnNbaV07XG5cdFx0XHRcdFx0XHRlZGdlMSA9IGludGVyc2VjdC5lZGdlMTtcblx0XHRcdFx0XHRcdGVkZ2UyID0gaW50ZXJzZWN0LmVkZ2UyO1xuXG5cdFx0XHRcdFx0XHQvL21ha2UgbmV3IHBvaW50c1xuXHRcdFx0XHRcdFx0Ly90b2RvOiBzZXQgaWRzIGZvciBwb2ludHNcblx0XHRcdFx0XHRcdHBvaW50MSA9IHtcblx0XHRcdFx0XHRcdFx0eDogaW50ZXJzZWN0LngsXG5cdFx0XHRcdFx0XHRcdHk6IGludGVyc2VjdC55LFxuXHRcdFx0XHRcdFx0XHRwcmV2OiBlZGdlMVswXSxcblx0XHRcdFx0XHRcdFx0bmV4dDogZWRnZTJbMV0sXG5cdFx0XHRcdFx0XHRcdGlkOiB2ZXJ0aWNlcy5sZW5ndGhcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRwb2x5LnZlcnRpY2VzLnB1c2gocG9pbnQxKTtcblx0XHRcdFx0XHRcdHZlcnRpY2VzLnB1c2gocG9pbnQxKTtcblxuXHRcdFx0XHRcdFx0cG9pbnQyID0ge1xuXHRcdFx0XHRcdFx0XHR4OiBpbnRlcnNlY3QueCxcblx0XHRcdFx0XHRcdFx0eTogaW50ZXJzZWN0LnksXG5cdFx0XHRcdFx0XHRcdHByZXY6IGVkZ2UyWzBdLFxuXHRcdFx0XHRcdFx0XHRuZXh0OiBlZGdlMVsxXSxcblx0XHRcdFx0XHRcdFx0aWQ6IHZlcnRpY2VzLmxlbmd0aFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdHBvbHkudmVydGljZXMucHVzaChwb2ludDIpO1xuXHRcdFx0XHRcdFx0dmVydGljZXMucHVzaChwb2ludDEpO1xuXG5cdFx0XHRcdFx0XHQvL21vZGlmeSBvbGQgcG9pbnRzXG5cdFx0XHRcdFx0XHRwb2ludDEucHJldi5uZXh0ID0gcG9pbnQxO1xuXHRcdFx0XHRcdFx0cG9pbnQxLm5leHQucHJldiA9IHBvaW50MTtcblx0XHRcdFx0XHRcdHBvaW50Mi5wcmV2Lm5leHQgPSBwb2ludDI7XG5cdFx0XHRcdFx0XHRwb2ludDIubmV4dC5wcmV2ID0gcG9pbnQyO1xuXG5cdFx0XHRcdFx0XHQvL2Rvbid0IGJvdGhlciBtb2RpZnlpbmcgdGhlIG9sZCBlZGdlcy4gd2UncmUganVzdCBnb25uYSB0aHJvdyB0aGVtIG91dFxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vbWFrZSBuZXcgcG9seWdvbnNcblx0XHRcdFx0XHRkbyB7XG5cdFx0XHRcdFx0XHRuZXdQb2x5ID0ge1xuXHRcdFx0XHRcdFx0XHRlZGdlczogW10sXG5cdFx0XHRcdFx0XHRcdHZlcnRpY2VzOiBbXSxcblx0XHRcdFx0XHRcdFx0c2ltcGxlOiB0cnVlXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0bmV3UG9seWdvbnMucHVzaChuZXdQb2x5KTtcblx0XHRcdFx0XHRcdHBvaW50ID0gcG9seS52ZXJ0aWNlc1swXTtcblx0XHRcdFx0XHRcdGhlYWQgPSBwb2ludDtcblx0XHRcdFx0XHRcdC8vd2hpbGUgKHBvaW50Lm5leHQgIT09IGhlYWQgJiYgcG9seS52ZXJ0aWNlcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdGRvIHtcblx0XHRcdFx0XHRcdFx0aSA9IHBvbHkudmVydGljZXMuaW5kZXhPZihwb2ludCk7XG5cdFx0XHRcdFx0XHRcdHBvbHkudmVydGljZXMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRcdFx0XHRuZXdQb2x5LmVkZ2VzLnB1c2goW3BvaW50LCBwb2ludC5uZXh0XSk7XG5cdFx0XHRcdFx0XHRcdG5ld1BvbHkudmVydGljZXMucHVzaChwb2ludCk7XG5cdFx0XHRcdFx0XHRcdHBvaW50ID0gcG9pbnQubmV4dDtcblx0XHRcdFx0XHRcdH0gd2hpbGUgKHBvaW50ICE9PSBoZWFkKTtcblx0XHRcdFx0XHR9IHdoaWxlIChwb2x5LnZlcnRpY2VzLmxlbmd0aCk7XG5cblx0XHRcdFx0XHQvL3JlbW92ZSBvcmlnaW5hbCBwb2x5Z29uIGZyb20gbGlzdFxuXHRcdFx0XHRcdGkgPSBwb2x5Z29ucy5pbmRleE9mKHBvbHkpO1xuXHRcdFx0XHRcdHBvbHlnb25zLnNwbGljZShpLCAxKTtcblxuXHRcdFx0XHRcdC8vYWRkIG5ldyBwb2x5Z29ucyB0byBsaXN0XG5cdFx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IG5ld1BvbHlnb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRwb2x5Z29ucy5wdXNoKG5ld1BvbHlnb25zW2ldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cG9seS5zaW1wbGUgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIGNsb2NrV2lzZShwb2x5KSB7XG5cdFx0XHRcdHZhciBwLCBxLCBuID0gcG9seS52ZXJ0aWNlcy5sZW5ndGgsXG5cdFx0XHRcdFx0cHYsIHF2LCBzdW0gPSAwO1xuXHRcdFx0XHRmb3IgKHAgPSBuIC0gMSwgcSA9IDA7IHEgPCBuOyBwID0gcSwgcSsrKSB7XG5cdFx0XHRcdFx0cHYgPSBwb2x5LnZlcnRpY2VzW3BdO1xuXHRcdFx0XHRcdHF2ID0gcG9seS52ZXJ0aWNlc1txXTtcblx0XHRcdFx0XHQvL3N1bSArPSAobmV4dC54IC0gdi54KSAqIChuZXh0LnkgKyB2LnkpO1xuXHRcdFx0XHRcdC8vc3VtICs9ICh2Lm5leHQueCArIHYueCkgKiAodi5uZXh0LnkgLSB2LnkpO1xuXHRcdFx0XHRcdHN1bSArPSBwdi54ICogcXYueSAtIHF2LnggKiBwdi55O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBzdW0gPiAwO1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiB0cmlhbmd1bGF0ZShwb2x5KSB7XG5cdFx0XHRcdHZhciB2LCBwb2ludHMgPSBwb2x5LnZlcnRpY2VzLFxuXHRcdFx0XHRcdG4sIFYgPSBbXSwgaW5kaWNlcyA9IFtdLFxuXHRcdFx0XHRcdG52LCBjb3VudCwgbSwgdSwgdyxcblxuXHRcdFx0XHRcdC8vdG9kbzogZ2l2ZSB0aGVzZSB2YXJpYWJsZXMgbXVjaCBiZXR0ZXIgbmFtZXNcblx0XHRcdFx0XHRhLCBiLCBjLCBzLCB0O1xuXG5cdFx0XHRcdGZ1bmN0aW9uIHBvaW50SW5UcmlhbmdsZShhLCBiLCBjLCBwKSB7XG5cdFx0XHRcdFx0dmFyIGF4LCBheSwgYngsIGJ5LCBjeCwgY3ksIGFweCwgYXB5LCBicHgsIGJweSwgY3B4LCBjcHksXG5cdFx0XHRcdFx0XHRjWGFwLCBiWGNwLCBhWGJwO1xuXG5cdFx0XHRcdFx0YXggPSBjLnggLSBiLng7XG5cdFx0XHRcdFx0YXkgPSBjLnkgLSBiLnk7XG5cdFx0XHRcdFx0YnggPSBhLnggLSBjLng7XG5cdFx0XHRcdFx0YnkgPSBhLnkgLSBjLnk7XG5cdFx0XHRcdFx0Y3ggPSBiLnggLSBhLng7XG5cdFx0XHRcdFx0Y3kgPSBiLnkgLSBhLnk7XG5cdFx0XHRcdFx0YXB4ID0gcC54IC0gYS54O1xuXHRcdFx0XHRcdGFweSA9IHAueSAtIGEueTtcblx0XHRcdFx0XHRicHggPSBwLnggLSBiLng7XG5cdFx0XHRcdFx0YnB5ID0gcC55IC0gYi55O1xuXHRcdFx0XHRcdGNweCA9IHAueCAtIGMueDtcblx0XHRcdFx0XHRjcHkgPSBwLnkgLSBjLnk7XG5cblx0XHRcdFx0XHRhWGJwID0gYXggKiBicHkgLSBheSAqIGJweDtcblx0XHRcdFx0XHRjWGFwID0gY3ggKiBhcHkgLSBjeSAqIGFweDtcblx0XHRcdFx0XHRiWGNwID0gYnggKiBjcHkgLSBieSAqIGNweDtcblxuXHRcdFx0XHRcdHJldHVybiBhWGJwID49IDAgJiYgYlhjcCA+PTAgJiYgY1hhcCA+PTA7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmdW5jdGlvbiBzbmlwKHUsIHYsIHcsIG4sIFYpIHtcblx0XHRcdFx0XHR2YXIgcCwgYSwgYiwgYywgcG9pbnQ7XG5cdFx0XHRcdFx0YSA9IHBvaW50c1tWW3VdXTtcblx0XHRcdFx0XHRiID0gcG9pbnRzW1Zbdl1dO1xuXHRcdFx0XHRcdGMgPSBwb2ludHNbVlt3XV07XG5cdFx0XHRcdFx0aWYgKDAgPiAoYi54IC0gYS54KSAqIChjLnkgLSBhLnkpIC0gKGIueSAtIGEueSkgKiAoYy54IC0gYS54KSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmb3IgKHAgPSAwOyBwIDwgbjsgcCsrKSB7XG5cdFx0XHRcdFx0XHRpZiAoIShwID09PSB1IHx8IHAgPT09IHYgfHwgcCA9PT0gdykpIHtcblx0XHRcdFx0XHRcdFx0cG9pbnQgPSBwb2ludHNbVltwXV07XG5cdFx0XHRcdFx0XHRcdGlmIChwb2ludEluVHJpYW5nbGUoYSwgYiwgYywgcG9pbnQpKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly9jb3B5IHBvaW50c1xuXHRcdFx0XHQvL2ZvciAodiA9IDA7IHYgPCBwb2x5LnZlcnRpY2VzLmxlbmd0aDsgdisrKSB7XG5cdFx0XHRcdC8vXHRwb2ludHMucHVzaChwb2x5LnZlcnRpY2VzW3ZdKTtcblx0XHRcdFx0Ly99XG5cdFx0XHRcdG4gPSBwb2ludHMubGVuZ3RoO1xuXG5cdFx0XHRcdGlmIChwb2x5LmNsb2NrV2lzZSkge1xuXHRcdFx0XHRcdGZvciAodiA9IDA7IHYgPCBuOyB2KyspIHtcblx0XHRcdFx0XHRcdFZbdl0gPSB2O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRmb3IgKHYgPSAwOyB2IDwgbjsgdisrKSB7XG5cdFx0XHRcdFx0XHRWW3ZdID0gKG4gLSAxKSAtIHY7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0bnYgPSBuO1xuXHRcdFx0XHRjb3VudCA9IDIgKiBudjtcblx0XHRcdFx0bSA9IDA7XG5cdFx0XHRcdHYgPSBudiAtIDE7XG5cdFx0XHRcdHdoaWxlIChudiA+IDIpIHtcblx0XHRcdFx0XHRpZiAoKGNvdW50LS0pIDw9IDApIHtcblx0XHRcdFx0XHRcdHJldHVybiBpbmRpY2VzO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHUgPSB2O1xuXHRcdFx0XHRcdGlmIChudiA8PSB1KSB7XG5cdFx0XHRcdFx0XHR1ID0gMDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR2ID0gdSArIDE7XG5cdFx0XHRcdFx0aWYgKG52IDw9IHYpIHtcblx0XHRcdFx0XHRcdHYgPSAwO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHcgPSB2ICsgMTtcblx0XHRcdFx0XHRpZiAobnYgPCB3KSB7XG5cdFx0XHRcdFx0XHR3ID0gMDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoc25pcCh1LCB2LCB3LCBudiwgVikpIHtcblx0XHRcdFx0XHRcdGEgPSBWW3VdO1xuXHRcdFx0XHRcdFx0YiA9IFZbdl07XG5cdFx0XHRcdFx0XHRjID0gVlt3XTtcblx0XHRcdFx0XHRcdGlmIChwb2x5LmNsb2NrV2lzZSkge1xuXHRcdFx0XHRcdFx0XHRpbmRpY2VzLnB1c2gocG9pbnRzW2FdKTtcblx0XHRcdFx0XHRcdFx0aW5kaWNlcy5wdXNoKHBvaW50c1tiXSk7XG5cdFx0XHRcdFx0XHRcdGluZGljZXMucHVzaChwb2ludHNbY10pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0aW5kaWNlcy5wdXNoKHBvaW50c1tjXSk7XG5cdFx0XHRcdFx0XHRcdGluZGljZXMucHVzaChwb2ludHNbYl0pO1xuXHRcdFx0XHRcdFx0XHRpbmRpY2VzLnB1c2gocG9pbnRzW2FdKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdG0rKztcblx0XHRcdFx0XHRcdGZvciAocyA9IHYsIHQgPSB2ICsgMTsgdCA8IG52OyBzKyssIHQrKykge1xuXHRcdFx0XHRcdFx0XHRWW3NdID0gVlt0XTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdG52LS07XG5cdFx0XHRcdFx0XHRjb3VudCA9IDIgKiBudjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwb2x5Z29uLmluZGljZXMgPSBpbmRpY2VzO1xuXHRcdFx0fVxuXG5cdFx0XHRwb2x5cyA9IG1ha2VQb2x5Z29uc0FycmF5KHBvbHkpO1xuXG5cdFx0XHRmb3IgKGkgPSAwOyBpIDwgcG9seXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0cG9seSA9IHBvbHlzW2ldO1xuXHRcdFx0XHRwcmV2ID0gbnVsbDtcblx0XHRcdFx0cG9seWdvbiA9IHtcblx0XHRcdFx0XHR2ZXJ0aWNlczogW10sXG5cdFx0XHRcdFx0ZWRnZXM6IFtdXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Zm9yIChqID0gMDsgaiA8IHBvbHkubGVuZ3RoOyBqKyspIHtcblx0XHRcdFx0XHR2ID0gcG9seVtqXTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIHYgPT09J29iamVjdCcgJiYgIWlzTmFOKHYueCkgJiYgIWlzTmFOKHYueSkpIHtcblx0XHRcdFx0XHRcdHZlcnQgPSB7XG5cdFx0XHRcdFx0XHRcdHg6IHYueCxcblx0XHRcdFx0XHRcdFx0eTogdi55LFxuXHRcdFx0XHRcdFx0XHRpZDogdmVydGljZXMubGVuZ3RoXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAodi5sZW5ndGggPj0gMiAmJiAhaXNOYU4odlswXSkgJiYgIWlzTmFOKHZbMV0pKSB7XG5cdFx0XHRcdFx0XHR2ZXJ0ID0ge1xuXHRcdFx0XHRcdFx0XHR4OiB2WzBdLFxuXHRcdFx0XHRcdFx0XHR5OiB2WzFdLFxuXHRcdFx0XHRcdFx0XHRpZDogdmVydGljZXMubGVuZ3RoXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodmVydCkge1xuXHRcdFx0XHRcdFx0aWYgKHByZXYpIHtcblx0XHRcdFx0XHRcdFx0cHJldi5uZXh0ID0gdmVydDtcblx0XHRcdFx0XHRcdFx0dmVydC5wcmV2ID0gcHJldjtcblx0XHRcdFx0XHRcdFx0dmVydC5uZXh0ID0gcG9seWdvbi52ZXJ0aWNlc1swXTtcblx0XHRcdFx0XHRcdFx0cG9seWdvbi52ZXJ0aWNlc1swXS5wcmV2ID0gdmVydDtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHBvbHlnb24uaGVhZCA9IHZlcnQ7XG5cdFx0XHRcdFx0XHRcdHZlcnQubmV4dCA9IHZlcnQ7XG5cdFx0XHRcdFx0XHRcdHZlcnQucHJldiA9IHZlcnQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR2ZXJ0aWNlcy5wdXNoKHZlcnQpO1xuXHRcdFx0XHRcdFx0cG9seWdvbi52ZXJ0aWNlcy5wdXNoKHZlcnQpO1xuXHRcdFx0XHRcdFx0cHJldiA9IHZlcnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHBvbHlnb24udmVydGljZXMubGVuZ3RoID4gMikge1xuXHRcdFx0XHRcdGlmIChwb2x5Z29uLnZlcnRpY2VzLmxlbmd0aCA9PT0gMykge1xuXHRcdFx0XHRcdFx0cG9seWdvbi5zaW1wbGUgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHBvbHlnb25zLnB1c2gocG9seWdvbik7XG5cblx0XHRcdFx0XHQvL3NhdmUgZWRnZXNcblx0XHRcdFx0XHRmb3IgKGogPSAwOyBqIDwgcG9seWdvbi52ZXJ0aWNlcy5sZW5ndGg7IGorKykge1xuXHRcdFx0XHRcdFx0dmVydCA9IHBvbHlnb24udmVydGljZXNbal07XG5cdFx0XHRcdFx0XHRwb2x5Z29uLmVkZ2VzLnB1c2goW1xuXHRcdFx0XHRcdFx0XHR2ZXJ0LCB2ZXJ0Lm5leHRcblx0XHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGkgPSBwb2x5Z29ucy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0XHRwb2x5Z29uID0gcG9seWdvbnNbaV07XG5cdFx0XHRcdG1ha2VTaW1wbGUocG9seWdvbik7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoaSA9IDA7IGkgPCBwb2x5Z29ucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRwb2x5Z29uID0gcG9seWdvbnNbaV07XG5cdFx0XHRcdHBvbHlnb24uY2xvY2tXaXNlID0gY2xvY2tXaXNlKHBvbHlnb24pO1xuXHRcdFx0XHR0cmlhbmd1bGF0ZShwb2x5Z29uKTtcblx0XHRcdH1cblxuXHRcdFx0Ly9idWlsZCBzaGFwZVxuXHRcdFx0c2hhcGUudmVydGljZXMgPSBbXTtcblx0XHRcdHNoYXBlLmNvb3JkcyA9IFtdO1xuXHRcdFx0Zm9yIChpID0gMDsgaSA8IHZlcnRpY2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHYgPSB2ZXJ0aWNlc1tpXTtcblx0XHRcdFx0c2hhcGUudmVydGljZXMucHVzaCh2LnggKiAyIC0gMSk7XG5cdFx0XHRcdHNoYXBlLnZlcnRpY2VzLnB1c2godi55ICogLTIgKyAxKTtcblx0XHRcdFx0c2hhcGUudmVydGljZXMucHVzaCgtMSk7XG5cblx0XHRcdFx0c2hhcGUuY29vcmRzLnB1c2godi54KTtcblx0XHRcdFx0c2hhcGUuY29vcmRzLnB1c2godi55ICogLTEgKyAxKTtcblx0XHRcdH1cblx0XHRcdHNoYXBlLnZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheShzaGFwZS52ZXJ0aWNlcyk7XG5cdFx0XHRzaGFwZS5jb29yZHMgPSBuZXcgRmxvYXQzMkFycmF5KHNoYXBlLmNvb3Jkcyk7XG5cblx0XHRcdHNoYXBlLmluZGljZXMgPSBbXTtcblx0XHRcdGZvciAoaSA9IDA7IGkgPCBwb2x5Z29ucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRwb2x5Z29uID0gcG9seWdvbnNbaV07XG5cdFx0XHRcdGZvciAoaiA9IDA7IGogPCBwb2x5Z29uLmluZGljZXMubGVuZ3RoOyBqKyspIHtcblx0XHRcdFx0XHR2ID0gcG9seWdvbi5pbmRpY2VzW2pdO1xuXHRcdFx0XHRcdHNoYXBlLmluZGljZXMucHVzaCh2LmlkKTtcblx0XHRcdFx0XHQvL3NoYXBlLmluZGljZXMucHVzaCh2WzFdLmlkKTtcblx0XHRcdFx0XHQvL3NoYXBlLmluZGljZXMucHVzaCh2WzJdLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0c2hhcGUuaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShzaGFwZS5pbmRpY2VzKTtcblxuXHRcdFx0dGhpcy5zaGFwZSA9IHNoYXBlO1xuXHRcdFx0aWYgKHRoaXMuZ2wpIHtcblx0XHRcdFx0bWFrZUdsTW9kZWwoc2hhcGUsIHRoaXMuZ2wpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRFZmZlY3ROb2RlLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIGksIGtleSwgaXRlbSwgaG9vayA9IHRoaXMuaG9vaztcblxuXHRcdFx0Ly9sZXQgZWZmZWN0IGRlc3Ryb3kgaXRzZWxmXG5cdFx0XHRpZiAodGhpcy5lZmZlY3QuZGVzdHJveSAmJiB0eXBlb2YgdGhpcy5lZmZlY3QuZGVzdHJveSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHR0aGlzLmVmZmVjdC5kZXN0cm95LmNhbGwodGhpcyk7XG5cdFx0XHR9XG5cdFx0XHRkZWxldGUgdGhpcy5lZmZlY3Q7XG5cblx0XHRcdC8vc2hhZGVyXG5cdFx0XHRpZiAoY29tbW9uU2hhZGVyc1tob29rXSkge1xuXHRcdFx0XHRjb21tb25TaGFkZXJzW2hvb2tdLmNvdW50LS07XG5cdFx0XHRcdGlmICghY29tbW9uU2hhZGVyc1tob29rXS5jb3VudCkge1xuXHRcdFx0XHRcdGRlbGV0ZSBjb21tb25TaGFkZXJzW2hvb2tdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5zaGFkZXIgJiYgdGhpcy5zaGFkZXIuZGVzdHJveSAmJiB0aGlzLnNoYWRlciAhPT0gYmFzZVNoYWRlciAmJiAhY29tbW9uU2hhZGVyc1tob29rXSkge1xuXHRcdFx0XHR0aGlzLnNoYWRlci5kZXN0cm95KCk7XG5cdFx0XHR9XG5cdFx0XHRkZWxldGUgdGhpcy5zaGFkZXI7XG5cblx0XHRcdC8vc3RvcCB3YXRjaGluZyBhbnkgaW5wdXQgZWxlbWVudHNcblx0XHRcdGZvciAoa2V5IGluIHRoaXMuaW5wdXRFbGVtZW50cykge1xuXHRcdFx0XHRpZiAodGhpcy5pbnB1dEVsZW1lbnRzLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRpdGVtID0gdGhpcy5pbnB1dEVsZW1lbnRzW2tleV07XG5cdFx0XHRcdFx0aXRlbS5lbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGl0ZW0ubGlzdGVuZXIsIHRydWUpO1xuXHRcdFx0XHRcdGl0ZW0uZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdpbnB1dCcsIGl0ZW0ubGlzdGVuZXIsIHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vc291cmNlc1xuXHRcdFx0Zm9yIChrZXkgaW4gdGhpcy5zb3VyY2VzKSB7XG5cdFx0XHRcdGlmICh0aGlzLnNvdXJjZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0XHRcdGl0ZW0gPSB0aGlzLnNvdXJjZXNba2V5XTtcblx0XHRcdFx0XHRpZiAoaXRlbSAmJiBpdGVtLnJlbW92ZVRhcmdldCkge1xuXHRcdFx0XHRcdFx0aXRlbS5yZW1vdmVUYXJnZXQodGhpcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGRlbGV0ZSB0aGlzLnNvdXJjZXNba2V5XTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvL3RhcmdldHNcblx0XHRcdHdoaWxlICh0aGlzLnRhcmdldHMubGVuZ3RoKSB7XG5cdFx0XHRcdGl0ZW0gPSB0aGlzLnRhcmdldHMucG9wKCk7XG5cdFx0XHRcdGlmIChpdGVtICYmIGl0ZW0ucmVtb3ZlU291cmNlKSB7XG5cdFx0XHRcdFx0aXRlbS5yZW1vdmVTb3VyY2UodGhpcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChpIGluIHRoaXMpIHtcblx0XHRcdFx0aWYgKHRoaXMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBrZXkgIT09ICdpZCcpIHtcblx0XHRcdFx0XHRkZWxldGUgdGhpc1trZXldO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vcmVtb3ZlIGFueSBhbGlhc2VzXG5cdFx0XHRmb3IgKGtleSBpbiBhbGlhc2VzKSB7XG5cdFx0XHRcdGlmIChhbGlhc2VzLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRpdGVtID0gYWxpYXNlc1trZXldO1xuXHRcdFx0XHRcdGlmIChpdGVtLm5vZGUgPT09IHRoaXMpIHtcblx0XHRcdFx0XHRcdHNlcmlvdXNseS5yZW1vdmVBbGlhcyhrZXkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvL3JlbW92ZSBzZWxmIGZyb20gbWFzdGVyIGxpc3Qgb2YgZWZmZWN0c1xuXHRcdFx0aSA9IGVmZmVjdHMuaW5kZXhPZih0aGlzKTtcblx0XHRcdGlmIChpID49IDApIHtcblx0XHRcdFx0ZWZmZWN0cy5zcGxpY2UoaSwgMSk7XG5cdFx0XHR9XG5cblx0XHRcdGkgPSBhbGxFZmZlY3RzQnlIb29rW2hvb2tdLmluZGV4T2YodGhpcyk7XG5cdFx0XHRpZiAoaSA+PSAwKSB7XG5cdFx0XHRcdGFsbEVmZmVjdHNCeUhvb2tbaG9va10uc3BsaWNlKGksIDEpO1xuXHRcdFx0fVxuXG5cdFx0XHROb2RlLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG5cdFx0fTtcblxuXHRcdFNvdXJjZSA9IGZ1bmN0aW9uIChzb3VyY2VOb2RlKSB7XG5cdFx0XHR2YXIgbWUgPSBzb3VyY2VOb2RlO1xuXG5cdFx0XHQvL3ByaXZlbGVnZWQgYWNjZXNzb3IgbWV0aG9kc1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuXHRcdFx0XHRvcmlnaW5hbDoge1xuXHRcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG5cdFx0XHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG1lLnNvdXJjZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGlkOiB7XG5cdFx0XHRcdFx0ZW51bWVyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRcdFx0Z2V0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbWUuaWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdG1lLnJlbmRlcigpO1xuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy51cGRhdGUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdG1lLnNldERpcnR5KCk7XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLnJlYWRQaXhlbHMgPSBmdW5jdGlvbiAoeCwgeSwgd2lkdGgsIGhlaWdodCwgZGVzdCkge1xuXHRcdFx0XHRyZXR1cm4gbWUucmVhZFBpeGVscyh4LCB5LCB3aWR0aCwgaGVpZ2h0LCBkZXN0KTtcblx0XHRcdH07XG5cblx0XHRcdHRoaXMub24gPSBmdW5jdGlvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuXHRcdFx0XHRtZS5vbihldmVudE5hbWUsIGNhbGxiYWNrKTtcblx0XHRcdH07XG5cblx0XHRcdHRoaXMub2ZmID0gZnVuY3Rpb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcblx0XHRcdFx0bWUub2ZmKGV2ZW50TmFtZSwgY2FsbGJhY2spO1xuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgaSxcblx0XHRcdFx0XHRkZXNjcmlwdG9yO1xuXG5cdFx0XHRcdG1lLmRlc3Ryb3koKTtcblxuXHRcdFx0XHRmb3IgKGkgaW4gdGhpcykge1xuXHRcdFx0XHRcdGlmICh0aGlzLmhhc093blByb3BlcnR5KGkpICYmIGkgIT09ICdpc0Rlc3Ryb3llZCcpIHtcblx0XHRcdFx0XHRcdGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRoaXMsIGkpO1xuXHRcdFx0XHRcdFx0aWYgKGRlc2NyaXB0b3IuZ2V0IHx8IGRlc2NyaXB0b3Iuc2V0IHx8XG5cdFx0XHRcdFx0XHRcdFx0dHlwZW9mIHRoaXNbaV0gIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRcdFx0ZGVsZXRlIHRoaXNbaV07XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0aGlzW2ldID0gbm9wO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5pc0Rlc3Ryb3llZCA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIG1lLmlzRGVzdHJveWVkO1xuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5pc1JlYWR5ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gbWUucmVhZHk7XG5cdFx0XHR9O1xuXHRcdH07XG5cblx0XHQvKlxuXHRcdFx0cG9zc2libGUgc291cmNlczogaW1nLCB2aWRlbywgY2FudmFzICgyZCBvciAzZCksIHRleHR1cmUsIEltYWdlRGF0YSwgYXJyYXksIHR5cGVkIGFycmF5XG5cdFx0Ki9cblx0XHRTb3VyY2VOb2RlID0gZnVuY3Rpb24gKGhvb2ssIHNvdXJjZSwgb3B0aW9ucykge1xuXHRcdFx0dmFyIG9wdHMgPSBvcHRpb25zIHx8IHt9LFxuXHRcdFx0XHRmbGlwID0gb3B0cy5mbGlwID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0cy5mbGlwLFxuXHRcdFx0XHR3aWR0aCA9IG9wdHMud2lkdGgsXG5cdFx0XHRcdGhlaWdodCA9IG9wdHMuaGVpZ2h0LFxuXHRcdFx0XHRkZWZlclRleHR1cmUgPSBmYWxzZSxcblx0XHRcdFx0dGhhdCA9IHRoaXMsXG5cdFx0XHRcdG1hdGNoZWRUeXBlID0gZmFsc2UsXG5cdFx0XHRcdGtleSxcblx0XHRcdFx0cGx1Z2luO1xuXG5cdFx0XHRmdW5jdGlvbiBzb3VyY2VQbHVnaW4oaG9vaywgc291cmNlLCBvcHRpb25zLCBmb3JjZSkge1xuXHRcdFx0XHR2YXIgcGx1Z2luID0gc2VyaW91c1NvdXJjZXNbaG9va107XG5cdFx0XHRcdGlmIChwbHVnaW4uZGVmaW5pdGlvbikge1xuXHRcdFx0XHRcdHBsdWdpbiA9IHBsdWdpbi5kZWZpbml0aW9uLmNhbGwodGhhdCwgc291cmNlLCBvcHRpb25zLCBmb3JjZSk7XG5cdFx0XHRcdFx0aWYgKHBsdWdpbikge1xuXHRcdFx0XHRcdFx0cGx1Z2luID0gZXh0ZW5kKGV4dGVuZCh7fSwgc2VyaW91c1NvdXJjZXNbaG9va10pLCBwbHVnaW4pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHBsdWdpbjtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gY29tcGFyZVNvdXJjZShzb3VyY2UpIHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuc291cmNlID09PSBzb3VyY2U7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIGluaXRpYWxpemVWaWRlbygpIHtcblx0XHRcdFx0aWYgKHRoYXQuaXNEZXN0cm95ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoc291cmNlLnZpZGVvV2lkdGgpIHtcblx0XHRcdFx0XHR0aGF0LndpZHRoID0gc291cmNlLnZpZGVvV2lkdGg7XG5cdFx0XHRcdFx0dGhhdC5oZWlnaHQgPSBzb3VyY2UudmlkZW9IZWlnaHQ7XG5cdFx0XHRcdFx0aWYgKGRlZmVyVGV4dHVyZSkge1xuXHRcdFx0XHRcdFx0dGhhdC5zZXRSZWFkeSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvL1dvcmthcm91bmQgZm9yIEZpcmVmb3ggYnVnIGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTkyNjc1M1xuXHRcdFx0XHRcdGRlZmVyVGV4dHVyZSA9IHRydWU7XG5cdFx0XHRcdFx0c2V0VGltZW91dChpbml0aWFsaXplVmlkZW8sIDUwKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHROb2RlLmNhbGwodGhpcyk7XG5cblx0XHRcdGlmIChob29rICYmIHR5cGVvZiBob29rICE9PSAnc3RyaW5nJyB8fCAhc291cmNlICYmIHNvdXJjZSAhPT0gMCkge1xuXHRcdFx0XHRpZiAoIW9wdGlvbnMgfHwgdHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnKSB7XG5cdFx0XHRcdFx0b3B0aW9ucyA9IHNvdXJjZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzb3VyY2UgPSBob29rO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodHlwZW9mIHNvdXJjZSA9PT0gJ3N0cmluZycgJiYgaXNOYU4oc291cmNlKSkge1xuXHRcdFx0XHRzb3VyY2UgPSBnZXRFbGVtZW50KHNvdXJjZSwgWydjYW52YXMnLCAnaW1nJywgJ3ZpZGVvJ10pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBmb3JjZWQgc291cmNlIHR5cGU/XG5cdFx0XHRpZiAodHlwZW9mIGhvb2sgPT09ICdzdHJpbmcnICYmIHNlcmlvdXNTb3VyY2VzW2hvb2tdKSB7XG5cdFx0XHRcdHBsdWdpbiA9IHNvdXJjZVBsdWdpbihob29rLCBzb3VyY2UsIG9wdGlvbnMsIHRydWUpO1xuXHRcdFx0XHRpZiAocGx1Z2luKSB7XG5cdFx0XHRcdFx0dGhpcy5ob29rID0gaG9vaztcblx0XHRcdFx0XHRtYXRjaGVkVHlwZSA9IHRydWU7XG5cdFx0XHRcdFx0ZGVmZXJUZXh0dXJlID0gcGx1Z2luLmRlZmVyVGV4dHVyZTtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblx0XHRcdFx0XHR0aGlzLmNvbXBhcmUgPSBwbHVnaW4uY29tcGFyZTtcblx0XHRcdFx0XHRpZiAocGx1Z2luLnNvdXJjZSkge1xuXHRcdFx0XHRcdFx0c291cmNlID0gcGx1Z2luLnNvdXJjZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly90b2RvOiBjb3VsZCBwcm9iYWJseSBzdGFuZCB0byByZS13b3JrIGFuZCByZS1pbmRlbnQgdGhpcyB3aG9sZSBibG9jayBub3cgdGhhdCB3ZSBoYXZlIHBsdWdpbnNcblx0XHRcdGlmICghcGx1Z2luICYmIHNvdXJjZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG5cdFx0XHRcdGlmIChzb3VyY2UudGFnTmFtZSA9PT0gJ0NBTlZBUycpIHtcblx0XHRcdFx0XHR0aGlzLndpZHRoID0gc291cmNlLndpZHRoO1xuXHRcdFx0XHRcdHRoaXMuaGVpZ2h0ID0gc291cmNlLmhlaWdodDtcblxuXHRcdFx0XHRcdHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXJJbWFnZUNhbnZhcztcblx0XHRcdFx0XHRtYXRjaGVkVHlwZSA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5ob29rID0gJ2NhbnZhcyc7XG5cdFx0XHRcdFx0dGhpcy5jb21wYXJlID0gY29tcGFyZVNvdXJjZTtcblx0XHRcdFx0fSBlbHNlIGlmIChzb3VyY2UudGFnTmFtZSA9PT0gJ0lNRycpIHtcblx0XHRcdFx0XHR0aGlzLndpZHRoID0gc291cmNlLm5hdHVyYWxXaWR0aCB8fCAxO1xuXHRcdFx0XHRcdHRoaXMuaGVpZ2h0ID0gc291cmNlLm5hdHVyYWxIZWlnaHQgfHwgMTtcblxuXHRcdFx0XHRcdGlmICghc291cmNlLmNvbXBsZXRlIHx8ICFzb3VyY2UubmF0dXJhbFdpZHRoKSB7XG5cdFx0XHRcdFx0XHRkZWZlclRleHR1cmUgPSB0cnVlO1xuXG5cdFx0XHRcdFx0XHRzb3VyY2UuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdFx0aWYgKCF0aGF0LmlzRGVzdHJveWVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhhdC53aWR0aCA9IHNvdXJjZS5uYXR1cmFsV2lkdGg7XG5cdFx0XHRcdFx0XHRcdFx0dGhhdC5oZWlnaHQgPSBzb3VyY2UubmF0dXJhbEhlaWdodDtcblx0XHRcdFx0XHRcdFx0XHR0aGF0LnNldFJlYWR5KCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0sIHRydWUpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXJJbWFnZUNhbnZhcztcblx0XHRcdFx0XHRtYXRjaGVkVHlwZSA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5ob29rID0gJ2ltYWdlJztcblx0XHRcdFx0XHR0aGlzLmNvbXBhcmUgPSBjb21wYXJlU291cmNlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHNvdXJjZS50YWdOYW1lID09PSAnVklERU8nKSB7XG5cdFx0XHRcdFx0aWYgKHNvdXJjZS5yZWFkeVN0YXRlKSB7XG5cdFx0XHRcdFx0XHRpbml0aWFsaXplVmlkZW8oKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZGVmZXJUZXh0dXJlID0gdHJ1ZTtcblx0XHRcdFx0XHRcdHNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIGluaXRpYWxpemVWaWRlbywgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy5yZW5kZXIgPSB0aGlzLnJlbmRlclZpZGVvO1xuXHRcdFx0XHRcdG1hdGNoZWRUeXBlID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLmhvb2sgPSAndmlkZW8nO1xuXHRcdFx0XHRcdHRoaXMuY29tcGFyZSA9IGNvbXBhcmVTb3VyY2U7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoIXBsdWdpbiAmJiBzb3VyY2UgaW5zdGFuY2VvZiBXZWJHTFRleHR1cmUpIHtcblx0XHRcdFx0aWYgKGdsICYmICFnbC5pc1RleHR1cmUoc291cmNlKSkge1xuXHRcdFx0XHRcdHRocm93ICdOb3QgYSB2YWxpZCBXZWJHTCB0ZXh0dXJlLic7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvL2RpZmZlcmVudCBkZWZhdWx0c1xuXHRcdFx0XHRpZiAoIWlzTmFOKHdpZHRoKSkge1xuXHRcdFx0XHRcdGlmIChpc05hTihoZWlnaHQpKSB7XG5cdFx0XHRcdFx0XHRoZWlnaHQgPSB3aWR0aDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoIWlzTmFOKGhlaWdodCkpIHtcblx0XHRcdFx0XHR3aWR0aCA9IGhlaWdodDtcblx0XHRcdFx0fS8qIGVsc2Uge1xuXHRcdFx0XHRcdC8vdG9kbzogZ3Vlc3MgYmFzZWQgb24gZGltZW5zaW9ucyBvZiB0YXJnZXQgY2FudmFzXG5cdFx0XHRcdFx0Ly90aHJvdyAnTXVzdCBzcGVjaWZ5IHdpZHRoIGFuZCBoZWlnaHQgd2hlbiB1c2luZyBhIFdlYkdMIHRleHR1cmUgYXMgYSBzb3VyY2UnO1xuXHRcdFx0XHR9Ki9cblxuXHRcdFx0XHR0aGlzLndpZHRoID0gd2lkdGg7XG5cdFx0XHRcdHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXG5cdFx0XHRcdGlmIChvcHRzLmZsaXAgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGZsaXAgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRtYXRjaGVkVHlwZSA9IHRydWU7XG5cblx0XHRcdFx0dGhpcy50ZXh0dXJlID0gc291cmNlO1xuXHRcdFx0XHR0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5ob29rID0gJ3RleHR1cmUnO1xuXHRcdFx0XHR0aGlzLmNvbXBhcmUgPSBjb21wYXJlU291cmNlO1xuXG5cdFx0XHRcdC8vdG9kbzogaWYgV2ViR0xUZXh0dXJlIHNvdXJjZSBpcyBmcm9tIGEgZGlmZmVyZW50IGNvbnRleHQgcmVuZGVyIGl0IGFuZCBjb3B5IGl0IG92ZXJcblx0XHRcdFx0dGhpcy5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7fTtcblx0XHRcdH0gZWxzZSBpZiAoIXBsdWdpbikge1xuXHRcdFx0XHRmb3IgKGtleSBpbiBzZXJpb3VzU291cmNlcykge1xuXHRcdFx0XHRcdGlmIChzZXJpb3VzU291cmNlcy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIHNlcmlvdXNTb3VyY2VzW2tleV0pIHtcblx0XHRcdFx0XHRcdHBsdWdpbiA9IHNvdXJjZVBsdWdpbihrZXksIHNvdXJjZSwgb3B0aW9ucywgZmFsc2UpO1xuXHRcdFx0XHRcdFx0aWYgKHBsdWdpbikge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmhvb2sgPSBrZXk7XG5cdFx0XHRcdFx0XHRcdG1hdGNoZWRUeXBlID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0ZGVmZXJUZXh0dXJlID0gcGx1Z2luLmRlZmVyVGV4dHVyZTtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cdFx0XHRcdFx0XHRcdHRoaXMuY29tcGFyZSA9IHBsdWdpbi5jb21wYXJlO1xuXHRcdFx0XHRcdFx0XHRpZiAocGx1Z2luLnNvdXJjZSkge1xuXHRcdFx0XHRcdFx0XHRcdHNvdXJjZSA9IHBsdWdpbi5zb3VyY2U7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCFtYXRjaGVkVHlwZSkge1xuXHRcdFx0XHR0aHJvdyAnVW5rbm93biBzb3VyY2UgdHlwZSc7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc291cmNlID0gc291cmNlO1xuXHRcdFx0aWYgKHRoaXMuZmxpcCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRoaXMuZmxpcCA9IGZsaXA7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudGFyZ2V0cyA9IFtdO1xuXG5cdFx0XHRpZiAoIWRlZmVyVGV4dHVyZSkge1xuXHRcdFx0XHR0aGF0LnNldFJlYWR5KCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMucHViID0gbmV3IFNvdXJjZSh0aGlzKTtcblxuXHRcdFx0c291cmNlcy5wdXNoKHRoaXMpO1xuXHRcdFx0YWxsU291cmNlc0J5SG9va1t0aGlzLmhvb2tdLnB1c2godGhpcyk7XG5cblx0XHRcdGlmIChzb3VyY2VzLmxlbmd0aCAmJiAhcmFmSWQpIHtcblx0XHRcdFx0cmVuZGVyRGFlbW9uKCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGV4dGVuZChTb3VyY2VOb2RlLCBOb2RlKTtcblxuXHRcdFNvdXJjZU5vZGUucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgdGV4dHVyZTtcblxuXHRcdFx0aWYgKCFnbCB8fCB0aGlzLnRleHR1cmUgfHwgIXRoaXMucmVhZHkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0ZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuXHRcdFx0Z2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZSk7XG5cdFx0XHRnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIGZhbHNlKTtcblx0XHRcdGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5MSU5FQVIpO1xuXHRcdFx0Z2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLkxJTkVBUik7XG5cdFx0XHRnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcblx0XHRcdGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuXHRcdFx0Z2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG5cblx0XHRcdHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cdFx0XHR0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcblx0XHRcdHRoaXMuYWxsb3dSZWZyZXNoID0gdHJ1ZTtcblx0XHRcdHRoaXMuc2V0RGlydHkoKTtcblx0XHR9O1xuXG5cdFx0U291cmNlTm9kZS5wcm90b3R5cGUuaW5pdEZyYW1lQnVmZmVyID0gZnVuY3Rpb24gKHVzZUZsb2F0KSB7XG5cdFx0XHRpZiAoZ2wpIHtcblx0XHRcdFx0dGhpcy5mcmFtZUJ1ZmZlciA9IG5ldyBGcmFtZUJ1ZmZlcihnbCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQsIHtcblx0XHRcdFx0XHR0ZXh0dXJlOiB0aGlzLnRleHR1cmUsXG5cdFx0XHRcdFx0dXNlRmxvYXQ6IHVzZUZsb2F0XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRTb3VyY2VOb2RlLnByb3RvdHlwZS5zZXRUYXJnZXQgPSBmdW5jdGlvbiAodGFyZ2V0KSB7XG5cdFx0XHR2YXIgaTtcblx0XHRcdGZvciAoaSA9IDA7IGkgPCB0aGlzLnRhcmdldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHRoaXMudGFyZ2V0c1tpXSA9PT0gdGFyZ2V0KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudGFyZ2V0cy5wdXNoKHRhcmdldCk7XG5cdFx0fTtcblxuXHRcdFNvdXJjZU5vZGUucHJvdG90eXBlLnJlbW92ZVRhcmdldCA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcblx0XHRcdHZhciBpID0gdGhpcy50YXJnZXRzICYmIHRoaXMudGFyZ2V0cy5pbmRleE9mKHRhcmdldCk7XG5cdFx0XHRpZiAoaSA+PSAwKSB7XG5cdFx0XHRcdHRoaXMudGFyZ2V0cy5zcGxpY2UoaSwgMSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdFNvdXJjZU5vZGUucHJvdG90eXBlLnJlc2l6ZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBpLFxuXHRcdFx0XHR0YXJnZXQ7XG5cblx0XHRcdHRoaXMudW5pZm9ybXMucmVzb2x1dGlvblswXSA9IHRoaXMud2lkdGg7XG5cdFx0XHR0aGlzLnVuaWZvcm1zLnJlc29sdXRpb25bMV0gPSB0aGlzLmhlaWdodDtcblxuXHRcdFx0aWYgKHRoaXMuZnJhbWVidWZmZXIpIHtcblx0XHRcdFx0dGhpcy5mcmFtZWJ1ZmZlci5yZXNpemUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmVtaXQoJ3Jlc2l6ZScpO1xuXHRcdFx0dGhpcy5zZXREaXJ0eSgpO1xuXG5cdFx0XHRpZiAodGhpcy50YXJnZXRzKSB7XG5cdFx0XHRcdGZvciAoaSA9IDA7IGkgPCB0aGlzLnRhcmdldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHR0YXJnZXQgPSB0aGlzLnRhcmdldHNbaV07XG5cdFx0XHRcdFx0dGFyZ2V0LnJlc2l6ZSgpO1xuXHRcdFx0XHRcdGlmICh0YXJnZXQuc2V0VHJhbnNmb3JtRGlydHkpIHtcblx0XHRcdFx0XHRcdHRhcmdldC5zZXRUcmFuc2Zvcm1EaXJ0eSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRTb3VyY2VOb2RlLnByb3RvdHlwZS5zZXRSZWFkeSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBpO1xuXHRcdFx0aWYgKCF0aGlzLnJlYWR5KSB7XG5cdFx0XHRcdHRoaXMucmVhZHkgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLnJlc2l6ZSgpO1xuXHRcdFx0XHR0aGlzLmluaXRpYWxpemUoKTtcblxuXHRcdFx0XHR0aGlzLmVtaXQoJ3JlYWR5Jyk7XG5cdFx0XHRcdGlmICh0aGlzLnRhcmdldHMpIHtcblx0XHRcdFx0XHRmb3IgKGkgPSAwOyBpIDwgdGhpcy50YXJnZXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnRhcmdldHNbaV0uc2V0UmVhZHkoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRTb3VyY2VOb2RlLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgbWVkaWEgPSB0aGlzLnNvdXJjZTtcblxuXHRcdFx0aWYgKCFnbCB8fCAhbWVkaWEgJiYgbWVkaWEgIT09IDAgfHwgIXRoaXMucmVhZHkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMuaW5pdGlhbGl6ZWQpIHtcblx0XHRcdFx0dGhpcy5pbml0aWFsaXplKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5hbGxvd1JlZnJlc2gpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5wbHVnaW4gJiYgdGhpcy5wbHVnaW4ucmVuZGVyICYmXG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4ucmVuZGVyLmNhbGwodGhpcywgZ2wsIGRyYXcsIHJlY3RhbmdsZU1vZGVsLCBiYXNlU2hhZGVyKSkge1xuXG5cdFx0XHRcdHRoaXMuZGlydHkgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5lbWl0KCdyZW5kZXInKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0U291cmNlTm9kZS5wcm90b3R5cGUucmVuZGVyVmlkZW8gPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgdmlkZW8gPSB0aGlzLnNvdXJjZTtcblxuXHRcdFx0aWYgKCFnbCB8fCAhdmlkZW8gfHwgIXZpZGVvLnZpZGVvSGVpZ2h0IHx8ICF2aWRlby52aWRlb1dpZHRoIHx8IHZpZGVvLnJlYWR5U3RhdGUgPCAyIHx8ICF0aGlzLnJlYWR5KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLmluaXRpYWxpemVkKSB7XG5cdFx0XHRcdHRoaXMuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMuYWxsb3dSZWZyZXNoKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuZGlydHkgfHxcblx0XHRcdFx0dGhpcy5sYXN0UmVuZGVyRnJhbWUgIT09IHZpZGVvLm1velByZXNlbnRlZEZyYW1lcyB8fFxuXHRcdFx0XHR0aGlzLmxhc3RSZW5kZXJUaW1lICE9PSB2aWRlby5jdXJyZW50VGltZSkge1xuXG5cdFx0XHRcdGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRoaXMudGV4dHVyZSk7XG5cdFx0XHRcdGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19GTElQX1lfV0VCR0wsIHRoaXMuZmxpcCk7XG5cdFx0XHRcdGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgZmFsc2UpO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgdmlkZW8pO1xuXHRcdFx0XHR9IGNhdGNoIChzZWN1cml0eUVycm9yKSB7XG5cdFx0XHRcdFx0aWYgKHNlY3VyaXR5RXJyb3IuY29kZSA9PT0gd2luZG93LkRPTUV4Y2VwdGlvbi5TRUNVUklUWV9FUlIpIHtcblx0XHRcdFx0XHRcdHRoaXMuYWxsb3dSZWZyZXNoID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnVW5hYmxlIHRvIGFjY2VzcyBjcm9zcy1kb21haW4gaW1hZ2UnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZW5kZXIgYSBmZXcgZXh0cmEgdGltZXMgYmVjYXVzZSB0aGUgY2FudmFzIHRha2VzIGEgd2hpbGUgdG8gY2F0Y2ggdXBcblx0XHRcdFx0aWYgKERhdGUubm93KCkgLSAxMDAgPiB0aGlzLmxhc3RSZW5kZXJUaW1lU3RhbXApIHtcblx0XHRcdFx0XHR0aGlzLmxhc3RSZW5kZXJUaW1lID0gdmlkZW8uY3VycmVudFRpbWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5sYXN0UmVuZGVyRnJhbWUgPSB2aWRlby5tb3pQcmVzZW50ZWRGcmFtZXM7XG5cdFx0XHRcdHRoaXMubGFzdFJlbmRlclRpbWVTdGFtcCA9IERhdGUubm93KCk7XG5cdFx0XHRcdHRoaXMuZGlydHkgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5lbWl0KCdyZW5kZXInKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0U291cmNlTm9kZS5wcm90b3R5cGUucmVuZGVySW1hZ2VDYW52YXMgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgbWVkaWEgPSB0aGlzLnNvdXJjZTtcblxuXHRcdFx0aWYgKCFnbCB8fCAhbWVkaWEgfHwgIXRoaXMucmVhZHkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMuaW5pdGlhbGl6ZWQpIHtcblx0XHRcdFx0dGhpcy5pbml0aWFsaXplKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5hbGxvd1JlZnJlc2gpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5kaXJ0eSkge1xuXHRcdFx0XHRnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0aGlzLnRleHR1cmUpO1xuXHRcdFx0XHRnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCB0aGlzLmZsaXApO1xuXHRcdFx0XHRnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIGZhbHNlKTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIG1lZGlhKTtcblx0XHRcdFx0fSBjYXRjaCAoc2VjdXJpdHlFcnJvcikge1xuXHRcdFx0XHRcdGlmIChzZWN1cml0eUVycm9yLmNvZGUgPT09IHdpbmRvdy5ET01FeGNlcHRpb24uU0VDVVJJVFlfRVJSKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmFsbG93UmVmcmVzaCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ1VuYWJsZSB0byBhY2Nlc3MgY3Jvc3MtZG9tYWluIGltYWdlJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5sYXN0UmVuZGVyVGltZSA9IERhdGUubm93KCkgLyAxMDAwO1xuXHRcdFx0XHR0aGlzLmRpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdHRoaXMuZW1pdCgncmVuZGVyJyk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdFNvdXJjZU5vZGUucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgaSwga2V5LCBpdGVtO1xuXG5cdFx0XHRpZiAodGhpcy5wbHVnaW4gJiYgdGhpcy5wbHVnaW4uZGVzdHJveSkge1xuXHRcdFx0XHR0aGlzLnBsdWdpbi5kZXN0cm95LmNhbGwodGhpcyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChnbCAmJiB0aGlzLnRleHR1cmUpIHtcblx0XHRcdFx0Z2wuZGVsZXRlVGV4dHVyZSh0aGlzLnRleHR1cmUpO1xuXHRcdFx0fVxuXG5cdFx0XHQvL3RhcmdldHNcblx0XHRcdHdoaWxlICh0aGlzLnRhcmdldHMubGVuZ3RoKSB7XG5cdFx0XHRcdGl0ZW0gPSB0aGlzLnRhcmdldHMucG9wKCk7XG5cdFx0XHRcdGlmIChpdGVtICYmIGl0ZW0ucmVtb3ZlU291cmNlKSB7XG5cdFx0XHRcdFx0aXRlbS5yZW1vdmVTb3VyY2UodGhpcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly9yZW1vdmUgc2VsZiBmcm9tIG1hc3RlciBsaXN0IG9mIHNvdXJjZXNcblx0XHRcdGkgPSBzb3VyY2VzLmluZGV4T2YodGhpcyk7XG5cdFx0XHRpZiAoaSA+PSAwKSB7XG5cdFx0XHRcdHNvdXJjZXMuc3BsaWNlKGksIDEpO1xuXHRcdFx0fVxuXG5cdFx0XHRpID0gYWxsU291cmNlc0J5SG9va1t0aGlzLmhvb2tdLmluZGV4T2YodGhpcyk7XG5cdFx0XHRpZiAoaSA+PSAwKSB7XG5cdFx0XHRcdGFsbFNvdXJjZXNCeUhvb2tbdGhpcy5ob29rXS5zcGxpY2UoaSwgMSk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoa2V5IGluIHRoaXMpIHtcblx0XHRcdFx0aWYgKHRoaXMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBrZXkgIT09ICdpZCcpIHtcblx0XHRcdFx0XHRkZWxldGUgdGhpc1trZXldO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdE5vZGUucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcblx0XHR9O1xuXG5cdFx0Ly90b2RvOiBpbXBsZW1lbnQgcmVuZGVyIGZvciBhcnJheSBhbmQgdHlwZWQgYXJyYXlcblxuXHRcdFRhcmdldCA9IGZ1bmN0aW9uICh0YXJnZXROb2RlKSB7XG5cdFx0XHR2YXIgbWUgPSB0YXJnZXROb2RlO1xuXG5cdFx0XHQvL3ByaXZlbGVnZWQgYWNjZXNzb3IgbWV0aG9kc1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuXHRcdFx0XHRpbnB1dHM6IHtcblx0XHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRnZXQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdHNvdXJjZToge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdpbWFnZSdcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNvdXJjZToge1xuXHRcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG5cdFx0XHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0aWYgKG1lLnNvdXJjZSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbWUuc291cmNlLnB1Yjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHRcdFx0XHRtZS5zZXRTb3VyY2UodmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0b3JpZ2luYWw6IHtcblx0XHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRnZXQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJldHVybiBtZS50YXJnZXQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR3aWR0aDoge1xuXHRcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG5cdFx0XHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG1lLndpZHRoO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdFx0XHRcdGlmICghaXNOYU4odmFsdWUpICYmIHZhbHVlID4wICYmIG1lLndpZHRoICE9PSB2YWx1ZSkge1xuXHRcdFx0XHRcdFx0XHRtZS53aWR0aCA9IG1lLmRlc2lyZWRXaWR0aCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0XHRtZS50YXJnZXQud2lkdGggPSB2YWx1ZTtcblxuXHRcdFx0XHRcdFx0XHRtZS5zZXRUcmFuc2Zvcm1EaXJ0eSgpO1xuXHRcdFx0XHRcdFx0XHQvKlxuXHRcdFx0XHRcdFx0XHRpZiAodGhpcy5zb3VyY2UgJiYgdGhpcy5zb3VyY2UucmVzaXplKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5zb3VyY2UucmVzaXplKHZhbHVlKTtcblxuXHRcdFx0XHRcdFx0XHRcdC8vdG9kbzogZm9yIHNlY29uZGFyeSB3ZWJnbCBub2Rlcywgd2UgbmVlZCBhIG5ldyBhcnJheVxuXHRcdFx0XHRcdFx0XHRcdC8vaWYgKHRoaXMucGl4ZWxzICYmIHRoaXMucGl4ZWxzLmxlbmd0aCAhPT0gKHRoaXMud2lkdGggKiB0aGlzLmhlaWdodCAqIDQpKSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly9cdGRlbGV0ZSB0aGlzLnBpeGVscztcblx0XHRcdFx0XHRcdFx0XHQvL31cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHQqL1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0aGVpZ2h0OiB7XG5cdFx0XHRcdFx0ZW51bWVyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRcdFx0Z2V0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbWUuaGVpZ2h0O1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdFx0XHRcdGlmICghaXNOYU4odmFsdWUpICYmIHZhbHVlID4wICYmIG1lLmhlaWdodCAhPT0gdmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0bWUuaGVpZ2h0ID0gbWUuZGVzaXJlZEhlaWdodCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0XHRtZS50YXJnZXQuaGVpZ2h0ID0gdmFsdWU7XG5cblx0XHRcdFx0XHRcdFx0bWUuc2V0VHJhbnNmb3JtRGlydHkoKTtcblxuXHRcdFx0XHRcdFx0XHQvKlxuXHRcdFx0XHRcdFx0XHRpZiAodGhpcy5zb3VyY2UgJiYgdGhpcy5zb3VyY2UucmVzaXplKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5zb3VyY2UucmVzaXplKHVuZGVmaW5lZCwgdmFsdWUpO1xuXG5cdFx0XHRcdFx0XHRcdFx0Ly9mb3Igc2Vjb25kYXJ5IHdlYmdsIG5vZGVzLCB3ZSBuZWVkIGEgbmV3IGFycmF5XG5cdFx0XHRcdFx0XHRcdFx0Ly9pZiAodGhpcy5waXhlbHMgJiYgdGhpcy5waXhlbHMubGVuZ3RoICE9PSAodGhpcy53aWR0aCAqIHRoaXMuaGVpZ2h0ICogNCkpIHtcblx0XHRcdFx0XHRcdFx0XHQvL1x0ZGVsZXRlIHRoaXMucGl4ZWxzO1xuXHRcdFx0XHRcdFx0XHRcdC8vfVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdCovXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRpZDoge1xuXHRcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG5cdFx0XHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG1lLmlkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMucmVuZGVyID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRtZS5yZW5kZXIoKTtcblx0XHRcdH07XG5cblx0XHRcdHRoaXMucmVhZFBpeGVscyA9IGZ1bmN0aW9uICh4LCB5LCB3aWR0aCwgaGVpZ2h0LCBkZXN0KSB7XG5cdFx0XHRcdHJldHVybiBtZS5yZWFkUGl4ZWxzKHgsIHksIHdpZHRoLCBoZWlnaHQsIGRlc3QpO1xuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5vbiA9IGZ1bmN0aW9uIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG5cdFx0XHRcdG1lLm9uKGV2ZW50TmFtZSwgY2FsbGJhY2spO1xuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5vZmYgPSBmdW5jdGlvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuXHRcdFx0XHRtZS5vZmYoZXZlbnROYW1lLCBjYWxsYmFjayk7XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLmdvID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcblx0XHRcdFx0bWUuZ28ob3B0aW9ucyk7XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLnN0b3AgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdG1lLnN0b3AoKTtcblx0XHRcdH07XG5cblx0XHRcdHRoaXMuZ2V0VGV4dHVyZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIG1lLmZyYW1lQnVmZmVyLnRleHR1cmU7XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciBpLFxuXHRcdFx0XHRcdGRlc2NyaXB0b3I7XG5cblx0XHRcdFx0bWUuZGVzdHJveSgpO1xuXG5cdFx0XHRcdGZvciAoaSBpbiB0aGlzKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuaGFzT3duUHJvcGVydHkoaSkgJiYgaSAhPT0gJ2lzRGVzdHJveWVkJykge1xuXHRcdFx0XHRcdFx0ZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGhpcywgaSk7XG5cdFx0XHRcdFx0XHRpZiAoZGVzY3JpcHRvci5nZXQgfHwgZGVzY3JpcHRvci5zZXQgfHxcblx0XHRcdFx0XHRcdFx0XHR0eXBlb2YgdGhpc1tpXSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdFx0XHRkZWxldGUgdGhpc1tpXTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRoaXNbaV0gPSBub3A7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLmlzRGVzdHJveWVkID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gbWUuaXNEZXN0cm95ZWQ7XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLmlzUmVhZHkgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBtZS5yZWFkeTtcblx0XHRcdH07XG5cdFx0fTtcblxuXHRcdC8qXG5cdFx0XHRwb3NzaWJsZSB0YXJnZXRzOiBjYW52YXMgKDJkIG9yIDNkKSwgZ2wgcmVuZGVyIGJ1ZmZlciAobXVzdCBiZSBzYW1lIGNhbnZhcylcblx0XHQqL1xuXHRcdFRhcmdldE5vZGUgPSBmdW5jdGlvbiAodGFyZ2V0LCBvcHRpb25zKSB7XG5cdFx0XHR2YXIgb3B0cyA9IG9wdGlvbnMgfHwge30sXG5cdFx0XHRcdGZsaXAgPSBvcHRzLmZsaXAgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBvcHRzLmZsaXAsXG5cdFx0XHRcdHdpZHRoID0gcGFyc2VJbnQob3B0cy53aWR0aCwgMTApLFxuXHRcdFx0XHRoZWlnaHQgPSBwYXJzZUludChvcHRzLmhlaWdodCwgMTApLFxuXHRcdFx0XHRtYXRjaGVkVHlwZSA9IGZhbHNlLFxuXHRcdFx0XHRpLCBlbGVtZW50LCBlbGVtZW50cywgY29udGV4dCxcblx0XHRcdFx0ZnJhbWVCdWZmZXI7XG5cblx0XHRcdE5vZGUuY2FsbCh0aGlzLCBvcHRzKTtcblxuXHRcdFx0dGhpcy5yZW5kZXJUb1RleHR1cmUgPSBvcHRzLnJlbmRlclRvVGV4dHVyZTtcblxuXHRcdFx0aWYgKHR5cGVvZiB0YXJnZXQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCh0YXJnZXQpO1xuXG5cdFx0XHRcdGZvciAoaSA9IDA7IGkgPCBlbGVtZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGVsZW1lbnQgPSBlbGVtZW50c1tpXTtcblx0XHRcdFx0XHRpZiAoZWxlbWVudC50YWdOYW1lID09PSAnQ0FOVkFTJykge1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGkgPj0gZWxlbWVudHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhyb3cgJ25vdCBhIHZhbGlkIEhUTUwgZWxlbWVudCAobXVzdCBiZSBpbWFnZSwgdmlkZW8gb3IgY2FudmFzKSc7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0YXJnZXQgPSBlbGVtZW50O1xuXHRcdFx0fSBlbHNlIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBXZWJHTEZyYW1lYnVmZmVyKSB7XG5cblx0XHRcdFx0ZnJhbWVCdWZmZXIgPSB0YXJnZXQ7XG5cblx0XHRcdFx0aWYgKG9wdHMgaW5zdGFuY2VvZiBIVE1MQ2FudmFzRWxlbWVudCkge1xuXHRcdFx0XHRcdHRhcmdldCA9IG9wdHM7XG5cdFx0XHRcdH0gZWxzZSBpZiAob3B0cyBpbnN0YW5jZW9mIFdlYkdMUmVuZGVyaW5nQ29udGV4dCkge1xuXHRcdFx0XHRcdHRhcmdldCA9IG9wdHMuY2FudmFzO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG9wdHMuY2FudmFzIGluc3RhbmNlb2YgSFRNTENhbnZhc0VsZW1lbnQpIHtcblx0XHRcdFx0XHR0YXJnZXQgPSBvcHRzLmNhbnZhcztcblx0XHRcdFx0fSBlbHNlIGlmIChvcHRzLmNvbnRleHQgaW5zdGFuY2VvZiBXZWJHTFJlbmRlcmluZ0NvbnRleHQpIHtcblx0XHRcdFx0XHR0YXJnZXQgPSBvcHRzLmNvbnRleHQuY2FudmFzO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vdG9kbzogc2VhcmNoIGFsbCBjYW52YXNlcyBmb3IgbWF0Y2hpbmcgY29udGV4dHM/XG5cdFx0XHRcdFx0dGhyb3cgJ011c3QgcHJvdmlkZSBhIGNhbnZhcyB3aXRoIFdlYkdMRnJhbWVidWZmZXIgdGFyZ2V0Jztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGFyZ2V0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgJiYgdGFyZ2V0LnRhZ05hbWUgPT09ICdDQU5WQVMnKSB7XG5cdFx0XHRcdHdpZHRoID0gdGFyZ2V0LndpZHRoO1xuXHRcdFx0XHRoZWlnaHQgPSB0YXJnZXQuaGVpZ2h0O1xuXG5cdFx0XHRcdC8vdG9kbzogdHJ5IHRvIGdldCBhIHdlYmdsIGNvbnRleHQuIGlmIG5vdCwgZ2V0IGEgMmQgY29udGV4dCwgYW5kIHNldCB1cCBhIGRpZmZlcmVudCByZW5kZXIgZnVuY3Rpb25cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRpZiAod2luZG93LldlYkdMRGVidWdVdGlscykge1xuXHRcdFx0XHRcdFx0Y29udGV4dCA9IHdpbmRvdy5XZWJHTERlYnVnVXRpbHMubWFrZURlYnVnQ29udGV4dCh0YXJnZXQuZ2V0Q29udGV4dCgnd2ViZ2wnLCB7XG5cdFx0XHRcdFx0XHRcdGFscGhhOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRwcmVtdWx0aXBsaWVkQWxwaGE6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRwcmVzZXJ2ZURyYXdpbmdCdWZmZXI6IHRydWUsXG5cdFx0XHRcdFx0XHRcdHN0ZW5jaWw6IHRydWVcblx0XHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y29udGV4dCA9IHRhcmdldC5nZXRDb250ZXh0KCd3ZWJnbCcsIHtcblx0XHRcdFx0XHRcdFx0YWxwaGE6IHRydWUsXG5cdFx0XHRcdFx0XHRcdHByZW11bHRpcGxpZWRBbHBoYTogZmFsc2UsXG5cdFx0XHRcdFx0XHRcdHByZXNlcnZlRHJhd2luZ0J1ZmZlcjogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0c3RlbmNpbDogdHJ1ZVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChleHBFcnJvcikge1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFjb250ZXh0KSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnRleHQgPSB0YXJnZXQuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJywge1xuXHRcdFx0XHRcdFx0XHRhbHBoYTogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0cHJlbXVsdGlwbGllZEFscGhhOiBmYWxzZSxcblx0XHRcdFx0XHRcdFx0cHJlc2VydmVEcmF3aW5nQnVmZmVyOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRzdGVuY2lsOiB0cnVlXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghY29udGV4dCkge1xuXHRcdFx0XHRcdGNvbnRleHQgPSB0YXJnZXQuZ2V0Q29udGV4dCgnMmQnKTtcblx0XHRcdFx0XHQvL3RvZG86IHNldCB1cCBJbWFnZURhdGEgYW5kIGFsdGVybmF0aXZlIGRyYXdpbmcgbWV0aG9kIChvciBkcmF3SW1hZ2UpXG5cdFx0XHRcdFx0dGhpcy5yZW5kZXIgPSB0aGlzLnJlbmRlcjJEO1xuXHRcdFx0XHRcdHRoaXMudXNlMkQgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCFnbCB8fCBnbCA9PT0gY29udGV4dCkge1xuXHRcdFx0XHRcdC8vdGhpcyBpcyBvdXIgbWFpbiBXZWJHTCBjYW52YXNcblx0XHRcdFx0XHRpZiAoIWdsKSB7XG5cdFx0XHRcdFx0XHRhdHRhY2hDb250ZXh0KGNvbnRleHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLnJlbmRlciA9IHRoaXMucmVuZGVyV2ViR0w7XG5cdFx0XHRcdFx0aWYgKG9wdHMucmVuZGVyVG9UZXh0dXJlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmZyYW1lQnVmZmVyID0gbmV3IEZyYW1lQnVmZmVyKGdsLCB3aWR0aCwgaGVpZ2h0LCBmYWxzZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuZnJhbWVCdWZmZXIgPSB7XG5cdFx0XHRcdFx0XHRcdGZyYW1lQnVmZmVyOiBmcmFtZUJ1ZmZlciB8fCBudWxsXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChjb250ZXh0ICE9PSBnbCkge1xuXHRcdFx0XHRcdC8vc2V0IHVwIGFsdGVybmF0aXZlIGRyYXdpbmcgbWV0aG9kIHVzaW5nIEFycmF5QnVmZmVyVmlld1xuXHRcdFx0XHRcdHRoaXMuZ2wgPSBjb250ZXh0O1xuXHRcdFx0XHRcdC8vdGhpcy5waXhlbHMgPSBuZXcgVWludDhBcnJheSh3aWR0aCAqIGhlaWdodCAqIDQpO1xuXHRcdFx0XHRcdC8vdG9kbzogcHJvYmFibHkgbmVlZCBhbm90aGVyIGZyYW1lYnVmZmVyIGZvciByZW5kZXJUb1RleHR1cmVcblx0XHRcdFx0XHRpZiAoZnJhbWVCdWZmZXIpIHtcblx0XHRcdFx0XHRcdHRoaXMuZnJhbWVCdWZmZXIgPSB7XG5cdFx0XHRcdFx0XHRcdGZyYW1lQnVmZmVyOiBmcmFtZUJ1ZmZlclxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5mcmFtZUJ1ZmZlciA9IG5ldyBGcmFtZUJ1ZmZlcih0aGlzLmdsLCB3aWR0aCwgaGVpZ2h0LCBmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuc2hhZGVyID0gbmV3IFNoYWRlclByb2dyYW0odGhpcy5nbCwgYmFzZVZlcnRleFNoYWRlciwgYmFzZUZyYWdtZW50U2hhZGVyKTtcblx0XHRcdFx0XHR0aGlzLm1vZGVsID0gYnVpbGRSZWN0YW5nbGVNb2RlbC5jYWxsKHRoaXMsIHRoaXMuZ2wpO1xuXG5cdFx0XHRcdFx0dGhpcy50ZXh0dXJlID0gdGhpcy5nbC5jcmVhdGVUZXh0dXJlKCk7XG5cdFx0XHRcdFx0dGhpcy5nbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0aGlzLnRleHR1cmUpO1xuXHRcdFx0XHRcdHRoaXMuZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLkxJTkVBUik7XG5cdFx0XHRcdFx0dGhpcy5nbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTElORUFSKTtcblx0XHRcdFx0XHR0aGlzLmdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuXHRcdFx0XHRcdHRoaXMuZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG5cblx0XHRcdFx0XHR0aGlzLnJlbmRlciA9IHRoaXMucmVuZGVyU2Vjb25kYXJ5V2ViR0w7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly90b2RvOiB0aGlzIHNob3VsZCB0aGVvcmV0aWNhbGx5IG5ldmVyIGhhcHBlblxuXHRcdFx0XHR9XG5cblx0XHRcdFx0bWF0Y2hlZFR5cGUgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIW1hdGNoZWRUeXBlKSB7XG5cdFx0XHRcdHRocm93ICdVbmtub3duIHRhcmdldCB0eXBlJztcblx0XHRcdH1cblxuXHRcdFx0dGhpcy50YXJnZXQgPSB0YXJnZXQ7XG5cdFx0XHR0aGlzLnRyYW5zZm9ybSA9IG51bGw7XG5cdFx0XHR0aGlzLnRyYW5zZm9ybURpcnR5ID0gdHJ1ZTtcblx0XHRcdHRoaXMuZmxpcCA9IGZsaXA7XG5cdFx0XHR0aGlzLndpZHRoID0gd2lkdGg7XG5cdFx0XHR0aGlzLmhlaWdodCA9IGhlaWdodDtcblxuXHRcdFx0dGhpcy51bmlmb3Jtcy5yZXNvbHV0aW9uWzBdID0gdGhpcy53aWR0aDtcblx0XHRcdHRoaXMudW5pZm9ybXMucmVzb2x1dGlvblsxXSA9IHRoaXMuaGVpZ2h0O1xuXG5cdFx0XHRpZiAob3B0cy5hdXRvICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5hdXRvID0gb3B0cy5hdXRvO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5hdXRvID0gYXV0bztcblx0XHRcdH1cblx0XHRcdHRoaXMuZnJhbWVzID0gMDtcblxuXHRcdFx0dGhpcy5wdWIgPSBuZXcgVGFyZ2V0KHRoaXMpO1xuXG5cdFx0XHR0YXJnZXRzLnB1c2godGhpcyk7XG5cdFx0fTtcblxuXHRcdGV4dGVuZChUYXJnZXROb2RlLCBOb2RlKTtcblxuXHRcdFRhcmdldE5vZGUucHJvdG90eXBlLnNldFNvdXJjZSA9IGZ1bmN0aW9uIChzb3VyY2UpIHtcblx0XHRcdHZhciBuZXdTb3VyY2U7XG5cblx0XHRcdC8vdG9kbzogd2hhdCBpZiBzb3VyY2UgaXMgbnVsbC91bmRlZmluZWQvZmFsc2VcblxuXHRcdFx0bmV3U291cmNlID0gZmluZElucHV0Tm9kZShzb3VyY2UpO1xuXG5cdFx0XHQvL3RvZG86IGNoZWNrIGZvciBjeWNsZXNcblxuXHRcdFx0aWYgKG5ld1NvdXJjZSAhPT0gdGhpcy5zb3VyY2UpIHtcblx0XHRcdFx0aWYgKHRoaXMuc291cmNlKSB7XG5cdFx0XHRcdFx0dGhpcy5zb3VyY2UucmVtb3ZlVGFyZ2V0KHRoaXMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuc291cmNlID0gbmV3U291cmNlO1xuXHRcdFx0XHRuZXdTb3VyY2Uuc2V0VGFyZ2V0KHRoaXMpO1xuXG5cdFx0XHRcdGlmIChuZXdTb3VyY2UgJiYgbmV3U291cmNlLnJlYWR5KSB7XG5cdFx0XHRcdFx0dGhpcy5zZXRSZWFkeSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuc2V0VW5yZWFkeSgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5zZXREaXJ0eSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRUYXJnZXROb2RlLnByb3RvdHlwZS5zZXREaXJ0eSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHRoaXMuZGlydHkgPSB0cnVlO1xuXG5cdFx0XHRpZiAodGhpcy5hdXRvICYmICFyYWZJZCkge1xuXHRcdFx0XHRyYWZJZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShyZW5kZXJEYWVtb24pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRUYXJnZXROb2RlLnByb3RvdHlwZS5yZXNpemUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHQvL2lmIHRhcmdldCBpcyBhIGNhbnZhcywgcmVzZXQgc2l6ZSB0byBjYW52YXMgc2l6ZVxuXHRcdFx0aWYgKHRoaXMudGFyZ2V0IGluc3RhbmNlb2YgSFRNTENhbnZhc0VsZW1lbnQgJiZcblx0XHRcdFx0XHQodGhpcy53aWR0aCAhPT0gdGhpcy50YXJnZXQud2lkdGggfHwgdGhpcy5oZWlnaHQgIT09IHRoaXMudGFyZ2V0LmhlaWdodCkpIHtcblx0XHRcdFx0dGhpcy53aWR0aCA9IHRoaXMudGFyZ2V0LndpZHRoO1xuXHRcdFx0XHR0aGlzLmhlaWdodCA9IHRoaXMudGFyZ2V0LmhlaWdodDtcblx0XHRcdFx0dGhpcy51bmlmb3Jtcy5yZXNvbHV0aW9uWzBdID0gdGhpcy53aWR0aDtcblx0XHRcdFx0dGhpcy51bmlmb3Jtcy5yZXNvbHV0aW9uWzFdID0gdGhpcy5oZWlnaHQ7XG5cdFx0XHRcdHRoaXMuZW1pdCgncmVzaXplJyk7XG5cdFx0XHRcdHRoaXMuc2V0VHJhbnNmb3JtRGlydHkoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuc291cmNlICYmXG5cdFx0XHRcdCh0aGlzLnNvdXJjZS53aWR0aCAhPT0gdGhpcy53aWR0aCB8fCB0aGlzLnNvdXJjZS5oZWlnaHQgIT09IHRoaXMuaGVpZ2h0KSkge1xuXHRcdFx0XHRpZiAoIXRoaXMudHJhbnNmb3JtKSB7XG5cdFx0XHRcdFx0dGhpcy50cmFuc2Zvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDE2KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRUYXJnZXROb2RlLnByb3RvdHlwZS5zZXRUcmFuc2Zvcm1EaXJ0eSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHRoaXMudHJhbnNmb3JtRGlydHkgPSB0cnVlO1xuXHRcdFx0dGhpcy5zZXREaXJ0eSgpO1xuXHRcdH07XG5cblx0XHRUYXJnZXROb2RlLnByb3RvdHlwZS5nbyA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHRoaXMuYXV0byA9IHRydWU7XG5cdFx0XHR0aGlzLnNldERpcnR5KCk7XG5cdFx0fTtcblxuXHRcdFRhcmdldE5vZGUucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR0aGlzLmF1dG8gPSBmYWxzZTtcblx0XHR9O1xuXG5cdFx0VGFyZ2V0Tm9kZS5wcm90b3R5cGUucmVuZGVyV2ViR0wgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgbWF0cml4LCB4LCB5O1xuXG5cdFx0XHR0aGlzLnJlc2l6ZSgpO1xuXG5cdFx0XHRpZiAodGhpcy5kaXJ0eSkge1xuXHRcdFx0XHRpZiAoIXRoaXMuc291cmNlKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5zb3VyY2UucmVuZGVyKCk7XG5cblx0XHRcdFx0dGhpcy51bmlmb3Jtcy5zb3VyY2UgPSB0aGlzLnNvdXJjZS50ZXh0dXJlO1xuXG5cdFx0XHRcdGlmICh0aGlzLnNvdXJjZS53aWR0aCA9PT0gdGhpcy53aWR0aCAmJiB0aGlzLnNvdXJjZS5oZWlnaHQgPT09IHRoaXMuaGVpZ2h0KSB7XG5cdFx0XHRcdFx0dGhpcy51bmlmb3Jtcy50cmFuc2Zvcm0gPSB0aGlzLnNvdXJjZS5jdW11bGF0aXZlTWF0cml4IHx8IGlkZW50aXR5O1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRoaXMudHJhbnNmb3JtRGlydHkpIHtcblx0XHRcdFx0XHRtYXRyaXggPSB0aGlzLnRyYW5zZm9ybTtcblx0XHRcdFx0XHRtYXQ0LmNvcHkobWF0cml4LCB0aGlzLnNvdXJjZS5jdW11bGF0aXZlTWF0cml4IHx8IGlkZW50aXR5KTtcblx0XHRcdFx0XHR4ID0gdGhpcy5zb3VyY2Uud2lkdGggLyB0aGlzLndpZHRoO1xuXHRcdFx0XHRcdHkgPSB0aGlzLnNvdXJjZS5oZWlnaHQgLyB0aGlzLmhlaWdodDtcblx0XHRcdFx0XHRtYXRyaXhbMF0gKj0geDtcblx0XHRcdFx0XHRtYXRyaXhbMV0gKj0geDtcblx0XHRcdFx0XHRtYXRyaXhbMl0gKj0geDtcblx0XHRcdFx0XHRtYXRyaXhbM10gKj0geDtcblx0XHRcdFx0XHRtYXRyaXhbNF0gKj0geTtcblx0XHRcdFx0XHRtYXRyaXhbNV0gKj0geTtcblx0XHRcdFx0XHRtYXRyaXhbNl0gKj0geTtcblx0XHRcdFx0XHRtYXRyaXhbN10gKj0geTtcblx0XHRcdFx0XHR0aGlzLnVuaWZvcm1zLnRyYW5zZm9ybSA9IG1hdHJpeDtcblx0XHRcdFx0XHR0aGlzLnRyYW5zZm9ybURpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRkcmF3KGJhc2VTaGFkZXIsIHJlY3RhbmdsZU1vZGVsLCB0aGlzLnVuaWZvcm1zLCB0aGlzLmZyYW1lQnVmZmVyLmZyYW1lQnVmZmVyLCB0aGlzKTtcblxuXHRcdFx0XHR0aGlzLmVtaXQoJ3JlbmRlcicpO1xuXHRcdFx0XHR0aGlzLmRpcnR5ID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdFRhcmdldE5vZGUucHJvdG90eXBlLnJlbmRlclNlY29uZGFyeVdlYkdMID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKHRoaXMuZGlydHkgJiYgdGhpcy5zb3VyY2UpIHtcblx0XHRcdFx0dGhpcy5lbWl0KCdyZW5kZXInKTtcblx0XHRcdFx0dGhpcy5zb3VyY2UucmVuZGVyKCk7XG5cblx0XHRcdFx0dmFyIHdpZHRoID0gdGhpcy5zb3VyY2Uud2lkdGgsXG5cdFx0XHRcdFx0aGVpZ2h0ID0gdGhpcy5zb3VyY2UuaGVpZ2h0O1xuXG5cdFx0XHRcdGlmICghdGhpcy5waXhlbHMgfHwgdGhpcy5waXhlbHMubGVuZ3RoICE9PSB3aWR0aCAqIGhlaWdodCAqIDQpIHtcblx0XHRcdFx0XHR0aGlzLnBpeGVscyA9IG5ldyBVaW50OEFycmF5KHdpZHRoICogaGVpZ2h0ICogNCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnNvdXJjZS5yZWFkUGl4ZWxzKDAsIDAsIHRoaXMuc291cmNlLndpZHRoLCB0aGlzLnNvdXJjZS5oZWlnaHQsIHRoaXMucGl4ZWxzKTtcblxuXHRcdFx0XHR0aGlzLmdsLnRleEltYWdlMkQodGhpcy5nbC5URVhUVVJFXzJELCAwLCB0aGlzLmdsLlJHQkEsIHdpZHRoLCBoZWlnaHQsIDAsIHRoaXMuZ2wuUkdCQSwgdGhpcy5nbC5VTlNJR05FRF9CWVRFLCB0aGlzLnBpeGVscyk7XG5cblx0XHRcdFx0dGhpcy51bmlmb3Jtcy5zb3VyY2UgPSB0aGlzLnRleHR1cmU7XG5cdFx0XHRcdGRyYXcodGhpcy5zaGFkZXIsIHRoaXMubW9kZWwsIHRoaXMudW5pZm9ybXMsIG51bGwsIHRoaXMpO1xuXG5cdFx0XHRcdHRoaXMuZGlydHkgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0VGFyZ2V0Tm9kZS5wcm90b3R5cGUucmVuZGVyMkQgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHQvL3RvZG86IG1ha2UgdGhpcyBhY3R1YWxseSBkbyBzb21ldGhpbmc/XG5cdFx0fTtcblxuXHRcdFRhcmdldE5vZGUucHJvdG90eXBlLnJlbW92ZVNvdXJjZSA9IGZ1bmN0aW9uIChzb3VyY2UpIHtcblx0XHRcdGlmICh0aGlzLnNvdXJjZSA9PT0gc291cmNlIHx8IHRoaXMuc291cmNlID09PSBzb3VyY2UucHViKSB7XG5cdFx0XHRcdHRoaXMuc291cmNlID0gbnVsbDtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0VGFyZ2V0Tm9kZS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBpO1xuXG5cdFx0XHQvL3NvdXJjZVxuXHRcdFx0aWYgKHRoaXMuc291cmNlICYmIHRoaXMuc291cmNlLnJlbW92ZVRhcmdldCkge1xuXHRcdFx0XHR0aGlzLnNvdXJjZS5yZW1vdmVUYXJnZXQodGhpcyk7XG5cdFx0XHR9XG5cdFx0XHRkZWxldGUgdGhpcy5zb3VyY2U7XG5cdFx0XHRkZWxldGUgdGhpcy50YXJnZXQ7XG5cdFx0XHRkZWxldGUgdGhpcy5wdWI7XG5cdFx0XHRkZWxldGUgdGhpcy51bmlmb3Jtcztcblx0XHRcdGRlbGV0ZSB0aGlzLnBpeGVscztcblx0XHRcdGRlbGV0ZSB0aGlzLmF1dG87XG5cblx0XHRcdC8vcmVtb3ZlIHNlbGYgZnJvbSBtYXN0ZXIgbGlzdCBvZiB0YXJnZXRzXG5cdFx0XHRpID0gdGFyZ2V0cy5pbmRleE9mKHRoaXMpO1xuXHRcdFx0aWYgKGkgPj0gMCkge1xuXHRcdFx0XHR0YXJnZXRzLnNwbGljZShpLCAxKTtcblx0XHRcdH1cblxuXHRcdFx0Ly90b2RvOiBpZiB0aGlzLmdsID09PSBnbCwgY2xlYXIgb3V0IGNvbnRleHQgc28gd2UgY2FuIHN0YXJ0IG92ZXJcblxuXHRcdFx0Tm9kZS5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuXHRcdH07XG5cblx0XHRUcmFuc2Zvcm0gPSBmdW5jdGlvbiAodHJhbnNmb3JtTm9kZSkge1xuXHRcdFx0dmFyIG1lID0gdHJhbnNmb3JtTm9kZSxcblx0XHRcdFx0c2VsZiA9IHRoaXMsXG5cdFx0XHRcdGtleTtcblxuXHRcdFx0ZnVuY3Rpb24gc2V0SW5wdXQoaW5wdXROYW1lLCBkZWYsIGlucHV0KSB7XG5cdFx0XHRcdHZhciBrZXksIGxvb2t1cCwgdmFsdWU7XG5cblx0XHRcdFx0bG9va3VwID0gbWUuaW5wdXRFbGVtZW50c1tpbnB1dE5hbWVdO1xuXG5cdFx0XHRcdC8vdG9kbzogdGhlcmUgaXMgc29tZSBkdXBsaWNhdGUgY29kZSB3aXRoIEVmZmVjdCBoZXJlLiBDb25zb2xpZGF0ZS5cblx0XHRcdFx0aWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycgJiYgaXNOYU4oaW5wdXQpKSB7XG5cdFx0XHRcdFx0aWYgKGRlZi50eXBlID09PSAnZW51bScpIHtcblx0XHRcdFx0XHRcdGlmIChkZWYub3B0aW9ucyAmJiBkZWYub3B0aW9ucy5maWx0ZXIpIHtcblx0XHRcdFx0XHRcdFx0a2V5ID0gU3RyaW5nKGlucHV0KS50b0xvd2VyQ2FzZSgpO1xuXG5cdFx0XHRcdFx0XHRcdC8vdG9kbzogcG9zc2libGUgbWVtb3J5IGxlYWsgb24gdGhpcyBmdW5jdGlvbj9cblx0XHRcdFx0XHRcdFx0dmFsdWUgPSBkZWYub3B0aW9ucy5maWx0ZXIoZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gKHR5cGVvZiBlID09PSAnc3RyaW5nJyAmJiBlLnRvTG93ZXJDYXNlKCkgPT09IGtleSkgfHxcblx0XHRcdFx0XHRcdFx0XHRcdChlLmxlbmd0aCAmJiB0eXBlb2YgZVswXSA9PT0gJ3N0cmluZycgJiYgZVswXS50b0xvd2VyQ2FzZSgpID09PSBrZXkpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0XHR2YWx1ZSA9IHZhbHVlLmxlbmd0aDtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKCF2YWx1ZSkge1xuXHRcdFx0XHRcdFx0XHRpbnB1dCA9IGdldEVsZW1lbnQoaW5wdXQsIFsnc2VsZWN0J10pO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0fSBlbHNlIGlmIChkZWYudHlwZSA9PT0gJ251bWJlcicgfHwgZGVmLnR5cGUgPT09ICdib29sZWFuJykge1xuXHRcdFx0XHRcdFx0aW5wdXQgPSBnZXRFbGVtZW50KGlucHV0LCBbJ2lucHV0JywgJ3NlbGVjdCddKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGRlZi50eXBlID09PSAnaW1hZ2UnKSB7XG5cdFx0XHRcdFx0XHRpbnB1dCA9IGdldEVsZW1lbnQoaW5wdXQsIFsnY2FudmFzJywgJ2ltZycsICd2aWRlbyddKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50IHx8IGlucHV0IGluc3RhbmNlb2YgSFRNTFNlbGVjdEVsZW1lbnQpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IGlucHV0LnZhbHVlO1xuXG5cdFx0XHRcdFx0aWYgKGxvb2t1cCAmJiBsb29rdXAuZWxlbWVudCAhPT0gaW5wdXQpIHtcblx0XHRcdFx0XHRcdGxvb2t1cC5lbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGxvb2t1cC5saXN0ZW5lciwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRsb29rdXAuZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdpbnB1dCcsIGxvb2t1cC5saXN0ZW5lciwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRkZWxldGUgbWUuaW5wdXRFbGVtZW50c1tpbnB1dE5hbWVdO1xuXHRcdFx0XHRcdFx0bG9va3VwID0gbnVsbDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIWxvb2t1cCkge1xuXHRcdFx0XHRcdFx0bG9va3VwID0ge1xuXHRcdFx0XHRcdFx0XHRlbGVtZW50OiBpbnB1dCxcblx0XHRcdFx0XHRcdFx0bGlzdGVuZXI6IChmdW5jdGlvbiAobmFtZSwgZWxlbWVudCkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgb2xkVmFsdWUsIG5ld1ZhbHVlO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoaW5wdXQudHlwZSA9PT0gJ2NoZWNrYm94Jykge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQvL3NwZWNpYWwgY2FzZSBmb3IgY2hlY2sgYm94XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG9sZFZhbHVlID0gaW5wdXQuY2hlY2tlZDtcblx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG9sZFZhbHVlID0gZWxlbWVudC52YWx1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKGRlZi5zZXQuY2FsbChtZSwgb2xkVmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG1lLnNldFRyYW5zZm9ybURpcnR5KCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRcdG5ld1ZhbHVlID0gZGVmLmdldC5jYWxsKG1lKTtcblxuXHRcdFx0XHRcdFx0XHRcdFx0Ly9zcGVjaWFsIGNhc2UgZm9yIGNvbG9yIHR5cGVcblx0XHRcdFx0XHRcdFx0XHRcdC8qXG5cdFx0XHRcdFx0XHRcdFx0XHRubyBjb2xvcnMgb24gdHJhbnNmb3JtIG5vZGVzIGp1c3QgeWV0LiBtYXliZSBsYXRlclxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKGRlZi50eXBlID09PSAnY29sb3InKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5ld1ZhbHVlID0gYXJyYXlUb0hleChuZXdWYWx1ZSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHQqL1xuXG5cdFx0XHRcdFx0XHRcdFx0XHQvL2lmIGlucHV0IHZhbGlkYXRvciBjaGFuZ2VzIG91ciB2YWx1ZSwgdXBkYXRlIEhUTUwgRWxlbWVudFxuXHRcdFx0XHRcdFx0XHRcdFx0Ly90b2RvOiBtYWtlIHRoaXMgb3B0aW9uYWwuLi5zb21laG93XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAobmV3VmFsdWUgIT09IG9sZFZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGVsZW1lbnQudmFsdWUgPSBuZXdWYWx1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHR9KGlucHV0TmFtZSwgaW5wdXQpKVxuXHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0bWUuaW5wdXRFbGVtZW50c1tpbnB1dE5hbWVdID0gbG9va3VwO1xuXHRcdFx0XHRcdFx0aWYgKGlucHV0LnR5cGUgPT09ICdyYW5nZScpIHtcblx0XHRcdFx0XHRcdFx0aW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBsb29rdXAubGlzdGVuZXIsIHRydWUpO1xuXHRcdFx0XHRcdFx0XHRpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBsb29rdXAubGlzdGVuZXIsIHRydWUpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0aW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgbG9va3VwLmxpc3RlbmVyLCB0cnVlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAobG9va3VwICYmIHZhbHVlLnR5cGUgPT09ICdjaGVja2JveCcpIHtcblx0XHRcdFx0XHRcdHZhbHVlID0gdmFsdWUuY2hlY2tlZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGxvb2t1cCkge1xuXHRcdFx0XHRcdFx0bG9va3VwLmVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgbG9va3VwLmxpc3RlbmVyLCB0cnVlKTtcblx0XHRcdFx0XHRcdGxvb2t1cC5lbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2lucHV0JywgbG9va3VwLmxpc3RlbmVyLCB0cnVlKTtcblx0XHRcdFx0XHRcdGRlbGV0ZSBtZS5pbnB1dEVsZW1lbnRzW2lucHV0TmFtZV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHZhbHVlID0gaW5wdXQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZGVmLnNldC5jYWxsKG1lLCB2YWx1ZSkpIHtcblx0XHRcdFx0XHRtZS5zZXRUcmFuc2Zvcm1EaXJ0eSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIHNldFByb3BlcnR5KG5hbWUsIGRlZikge1xuXHRcdFx0XHQvLyB0b2RvOiB2YWxpZGF0ZSB2YWx1ZSBwYXNzZWQgdG8gJ3NldCdcblx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHNlbGYsIG5hbWUsIHtcblx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRcdFx0ZW51bWVyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRnZXQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJldHVybiBkZWYuZ2V0LmNhbGwobWUpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c2V0OiBmdW5jdGlvbiAodmFsKSB7XG5cdFx0XHRcdFx0XHRzZXRJbnB1dChuYW1lLCBkZWYsIHZhbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gbWFrZU1ldGhvZChtZXRob2QpIHtcblx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAobWV0aG9kLmFwcGx5KG1lLCBhcmd1bWVudHMpKSB7XG5cdFx0XHRcdFx0XHRtZS5zZXRUcmFuc2Zvcm1EaXJ0eSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5pbnB1dEVsZW1lbnRzID0ge307XG5cblx0XHRcdC8vcHJpdmVsZWdlZCBhY2Nlc3NvciBtZXRob2RzXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG5cdFx0XHRcdGlkOiB7XG5cdFx0XHRcdFx0ZW51bWVyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRcdFx0Z2V0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbWUuaWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzb3VyY2U6IHtcblx0XHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZSxcblx0XHRcdFx0XHRnZXQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJldHVybiBtZS5zb3VyY2UucHViO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c2V0OiBmdW5jdGlvbiAoc291cmNlKSB7XG5cdFx0XHRcdFx0XHRtZS5zZXRTb3VyY2Uoc291cmNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHQvLyBhdHRhY2ggbWV0aG9kc1xuXHRcdFx0Zm9yIChrZXkgaW4gbWUubWV0aG9kcykge1xuXHRcdFx0XHRpZiAobWUubWV0aG9kcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG5cdFx0XHRcdFx0dGhpc1trZXldID0gbWFrZU1ldGhvZChtZS5tZXRob2RzW2tleV0uYmluZChtZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoa2V5IGluIG1lLmlucHV0cykge1xuXHRcdFx0XHRpZiAobWUuaW5wdXRzLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRzZXRQcm9wZXJ0eShrZXksIG1lLmlucHV0c1trZXldKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnVwZGF0ZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0bWUuc2V0RGlydHkoKTtcblx0XHRcdH07XG5cblx0XHRcdHRoaXMuYWxpYXMgPSBmdW5jdGlvbiAoaW5wdXROYW1lLCBhbGlhc05hbWUpIHtcblx0XHRcdFx0bWUuYWxpYXMoaW5wdXROYW1lLCBhbGlhc05hbWUpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdH07XG5cblx0XHRcdHRoaXMub24gPSBmdW5jdGlvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuXHRcdFx0XHRtZS5vbihldmVudE5hbWUsIGNhbGxiYWNrKTtcblx0XHRcdH07XG5cblx0XHRcdHRoaXMub2ZmID0gZnVuY3Rpb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcblx0XHRcdFx0bWUub2ZmKGV2ZW50TmFtZSwgY2FsbGJhY2spO1xuXHRcdFx0fTtcblxuXHRcdFx0dGhpcy5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgaSxcblx0XHRcdFx0XHRkZXNjcmlwdG9yO1xuXG5cdFx0XHRcdG1lLmRlc3Ryb3koKTtcblxuXHRcdFx0XHRmb3IgKGkgaW4gdGhpcykge1xuXHRcdFx0XHRcdGlmICh0aGlzLmhhc093blByb3BlcnR5KGkpICYmIGkgIT09ICdpc0Rlc3Ryb3llZCcpIHtcblx0XHRcdFx0XHRcdC8vdG9kbzogcHJvYmFibHkgY2FuIHNpbXBsaWZ5IHRoaXMgaWYgdGhlIG9ubHkgc2V0dGVyL2dldHRlciBpcyBpZFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGhpcywgaSk7XG5cdFx0XHRcdFx0XHRpZiAoZGVzY3JpcHRvci5nZXQgfHwgZGVzY3JpcHRvci5zZXQgfHxcblx0XHRcdFx0XHRcdFx0XHR0eXBlb2YgdGhpc1tpXSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdFx0XHRkZWxldGUgdGhpc1tpXTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRoaXNbaV0gPSBub3A7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLmlzRGVzdHJveWVkID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gbWUuaXNEZXN0cm95ZWQ7XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLmlzUmVhZHkgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBtZS5yZWFkeTtcblx0XHRcdH07XG5cdFx0fTtcblxuXHRcdFRyYW5zZm9ybU5vZGUgPSBmdW5jdGlvbiAoaG9vaywgb3B0aW9ucykge1xuXHRcdFx0dmFyIGtleSxcblx0XHRcdFx0aW5wdXQ7XG5cblx0XHRcdHRoaXMubWF0cml4ID0gbmV3IEZsb2F0MzJBcnJheSgxNik7XG5cdFx0XHR0aGlzLmN1bXVsYXRpdmVNYXRyaXggPSBuZXcgRmxvYXQzMkFycmF5KDE2KTtcblxuXHRcdFx0dGhpcy5yZWFkeSA9IGZhbHNlO1xuXHRcdFx0dGhpcy53aWR0aCA9IDE7XG5cdFx0XHR0aGlzLmhlaWdodCA9IDE7XG5cblx0XHRcdHRoaXMuc2VyaW91c2x5ID0gc2VyaW91c2x5O1xuXG5cdFx0XHR0aGlzLnRyYW5zZm9ybVJlZiA9IHNlcmlvdXNUcmFuc2Zvcm1zW2hvb2tdO1xuXHRcdFx0dGhpcy5ob29rID0gaG9vaztcblx0XHRcdHRoaXMuaWQgPSBub2RlSWQ7XG5cdFx0XHRub2Rlcy5wdXNoKHRoaXMpO1xuXHRcdFx0bm9kZXNCeUlkW25vZGVJZF0gPSB0aGlzO1xuXHRcdFx0bm9kZUlkKys7XG5cblx0XHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0XHR0aGlzLnNvdXJjZXMgPSBudWxsO1xuXHRcdFx0dGhpcy50YXJnZXRzID0gW107XG5cdFx0XHR0aGlzLmlucHV0RWxlbWVudHMgPSB7fTtcblx0XHRcdHRoaXMuaW5wdXRzID0ge307XG5cdFx0XHR0aGlzLm1ldGhvZHMgPSB7fTtcblx0XHRcdHRoaXMubGlzdGVuZXJzID0ge307XG5cblx0XHRcdHRoaXMudGV4dHVyZSA9IG51bGw7XG5cdFx0XHR0aGlzLmZyYW1lQnVmZmVyID0gbnVsbDtcblx0XHRcdHRoaXMudW5pZm9ybXMgPSBudWxsO1xuXG5cdFx0XHR0aGlzLmRpcnR5ID0gdHJ1ZTtcblx0XHRcdHRoaXMudHJhbnNmb3JtRGlydHkgPSB0cnVlO1xuXHRcdFx0dGhpcy5yZW5kZXJEaXJ0eSA9IGZhbHNlO1xuXHRcdFx0dGhpcy5pc0Rlc3Ryb3llZCA9IGZhbHNlO1xuXHRcdFx0dGhpcy50cmFuc2Zvcm1lZCA9IGZhbHNlO1xuXG5cdFx0XHRpZiAodGhpcy50cmFuc2Zvcm1SZWYuZGVmaW5pdGlvbikge1xuXHRcdFx0XHR0aGlzLnBsdWdpbiA9IHRoaXMudHJhbnNmb3JtUmVmLmRlZmluaXRpb24uY2FsbCh0aGlzLCBvcHRpb25zKTtcblx0XHRcdFx0Zm9yIChrZXkgaW4gdGhpcy50cmFuc2Zvcm1SZWYpIHtcblx0XHRcdFx0XHRpZiAodGhpcy50cmFuc2Zvcm1SZWYuaGFzT3duUHJvcGVydHkoa2V5KSAmJiAhdGhpcy5wbHVnaW5ba2V5XSkge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW5ba2V5XSA9IHRoaXMudHJhbnNmb3JtUmVmW2tleV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Lypcblx0XHRcdFx0dG9kbzogdmFsaWRhdGUgbWV0aG9kIGRlZmluaXRpb25zLCBjaGVjayBhZ2FpbnN0IHJlc2VydmVkIG5hbWVzXG5cdFx0XHRcdGlmICh0aGlzLnBsdWdpbi5pbnB1dHMgIT09IHRoaXMudHJhbnNmb3JtUmVmLmlucHV0cykge1xuXHRcdFx0XHRcdHZhbGlkYXRlSW5wdXRTcGVjcyh0aGlzLnBsdWdpbik7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ki9cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucGx1Z2luID0gZXh0ZW5kKHt9LCB0aGlzLnRyYW5zZm9ybVJlZik7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoa2V5IGluIHRoaXMucGx1Z2luLmlucHV0cykge1xuXHRcdFx0XHRpZiAodGhpcy5wbHVnaW4uaW5wdXRzLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRpbnB1dCA9IHRoaXMucGx1Z2luLmlucHV0c1trZXldO1xuXG5cdFx0XHRcdFx0aWYgKGlucHV0Lm1ldGhvZCAmJiB0eXBlb2YgaW5wdXQubWV0aG9kID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm1ldGhvZHNba2V5XSA9IGlucHV0Lm1ldGhvZDtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBpbnB1dC5zZXQgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGlucHV0LmdldCA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdFx0dGhpcy5pbnB1dHNba2V5XSA9IGlucHV0O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnB1YiA9IG5ldyBUcmFuc2Zvcm0odGhpcyk7XG5cblx0XHRcdHRyYW5zZm9ybXMucHVzaCh0aGlzKTtcblxuXHRcdFx0YWxsVHJhbnNmb3Jtc0J5SG9va1tob29rXS5wdXNoKHRoaXMpO1xuXHRcdH07XG5cblx0XHRUcmFuc2Zvcm1Ob2RlLnByb3RvdHlwZS5zZXREaXJ0eSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHRoaXMucmVuZGVyRGlydHkgPSB0cnVlO1xuXHRcdFx0Tm9kZS5wcm90b3R5cGUuc2V0RGlydHkuY2FsbCh0aGlzKTtcblx0XHR9O1xuXG5cdFx0VHJhbnNmb3JtTm9kZS5wcm90b3R5cGUuc2V0VHJhbnNmb3JtRGlydHkgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgaSxcblx0XHRcdFx0dGFyZ2V0O1xuXHRcdFx0dGhpcy50cmFuc2Zvcm1EaXJ0eSA9IHRydWU7XG5cdFx0XHR0aGlzLmRpcnR5ID0gdHJ1ZTtcblx0XHRcdHRoaXMucmVuZGVyRGlydHkgPSB0cnVlO1xuXHRcdFx0Zm9yIChpID0gMDsgaSA8IHRoaXMudGFyZ2V0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHR0YXJnZXQgPSB0aGlzLnRhcmdldHNbaV07XG5cdFx0XHRcdGlmICh0YXJnZXQuc2V0VHJhbnNmb3JtRGlydHkpIHtcblx0XHRcdFx0XHR0YXJnZXQuc2V0VHJhbnNmb3JtRGlydHkoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0YXJnZXQuc2V0RGlydHkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRUcmFuc2Zvcm1Ob2RlLnByb3RvdHlwZS5yZXNpemUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgaTtcblxuXHRcdFx0Tm9kZS5wcm90b3R5cGUucmVzaXplLmNhbGwodGhpcyk7XG5cblx0XHRcdGlmICh0aGlzLnBsdWdpbi5yZXNpemUpIHtcblx0XHRcdFx0dGhpcy5wbHVnaW4ucmVzaXplLmNhbGwodGhpcyk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoaSA9IDA7IGkgPCB0aGlzLnRhcmdldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0dGhpcy50YXJnZXRzW2ldLnJlc2l6ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnNldFRyYW5zZm9ybURpcnR5KCk7XG5cdFx0fTtcblxuXHRcdFRyYW5zZm9ybU5vZGUucHJvdG90eXBlLnNldFNvdXJjZSA9IGZ1bmN0aW9uIChzb3VyY2UpIHtcblx0XHRcdHZhciBuZXdTb3VyY2U7XG5cblx0XHRcdC8vdG9kbzogd2hhdCBpZiBzb3VyY2UgaXMgbnVsbC91bmRlZmluZWQvZmFsc2VcblxuXHRcdFx0bmV3U291cmNlID0gZmluZElucHV0Tm9kZShzb3VyY2UpO1xuXG5cdFx0XHRpZiAobmV3U291cmNlID09PSB0aGlzLnNvdXJjZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0cmFjZVNvdXJjZXMobmV3U291cmNlLCB0aGlzKSkge1xuXHRcdFx0XHR0aHJvdyAnQXR0ZW1wdCB0byBtYWtlIGN5Y2xpY2FsIGNvbm5lY3Rpb24uJztcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuc291cmNlKSB7XG5cdFx0XHRcdHRoaXMuc291cmNlLnJlbW92ZVRhcmdldCh0aGlzKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuc291cmNlID0gbmV3U291cmNlO1xuXHRcdFx0bmV3U291cmNlLnNldFRhcmdldCh0aGlzKTtcblxuXHRcdFx0aWYgKG5ld1NvdXJjZSAmJiBuZXdTb3VyY2UucmVhZHkpIHtcblx0XHRcdFx0dGhpcy5zZXRSZWFkeSgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5zZXRVbnJlYWR5KCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJlc2l6ZSgpO1xuXHRcdH07XG5cblx0XHRUcmFuc2Zvcm1Ob2RlLnByb3RvdHlwZS5zZXRUYXJnZXQgPSBmdW5jdGlvbiAodGFyZ2V0KSB7XG5cdFx0XHR2YXIgaTtcblx0XHRcdGZvciAoaSA9IDA7IGkgPCB0aGlzLnRhcmdldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHRoaXMudGFyZ2V0c1tpXSA9PT0gdGFyZ2V0KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudGFyZ2V0cy5wdXNoKHRhcmdldCk7XG5cdFx0fTtcblxuXHRcdFRyYW5zZm9ybU5vZGUucHJvdG90eXBlLnJlbW92ZVRhcmdldCA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcblx0XHRcdHZhciBpID0gdGhpcy50YXJnZXRzICYmIHRoaXMudGFyZ2V0cy5pbmRleE9mKHRhcmdldCk7XG5cdFx0XHRpZiAoaSA+PSAwKSB7XG5cdFx0XHRcdHRoaXMudGFyZ2V0cy5zcGxpY2UoaSwgMSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLnRhcmdldHMgJiYgdGhpcy50YXJnZXRzLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLnJlc2l6ZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRUcmFuc2Zvcm1Ob2RlLnByb3RvdHlwZS5hbGlhcyA9IGZ1bmN0aW9uIChpbnB1dE5hbWUsIGFsaWFzTmFtZSkge1xuXHRcdFx0dmFyIG1lID0gdGhpcyxcblx0XHRcdFx0aW5wdXQsXG5cdFx0XHRcdGRlZjtcblxuXHRcdFx0aWYgKHJlc2VydmVkTmFtZXMuaW5kZXhPZihhbGlhc05hbWUpID49IDApIHtcblx0XHRcdFx0dGhyb3cgYWxpYXNOYW1lICsgJyBpcyBhIHJlc2VydmVkIG5hbWUgYW5kIGNhbm5vdCBiZSB1c2VkIGFzIGFuIGFsaWFzLic7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLnBsdWdpbi5pbnB1dHMuaGFzT3duUHJvcGVydHkoaW5wdXROYW1lKSkge1xuXHRcdFx0XHRpZiAoIWFsaWFzTmFtZSkge1xuXHRcdFx0XHRcdGFsaWFzTmFtZSA9IGlucHV0TmFtZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHNlcmlvdXNseS5yZW1vdmVBbGlhcyhhbGlhc05hbWUpO1xuXG5cdFx0XHRcdGlucHV0ID0gdGhpcy5pbnB1dHNbaW5wdXROYW1lXTtcblx0XHRcdFx0aWYgKGlucHV0KSB7XG5cdFx0XHRcdFx0ZGVmID0gbWUuaW5wdXRzW2lucHV0TmFtZV07XG5cdFx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHNlcmlvdXNseSwgYWxpYXNOYW1lLCB7XG5cdFx0XHRcdFx0XHRjb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0Z2V0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBkZWYuZ2V0LmNhbGwobWUpO1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHNldDogZnVuY3Rpb24gKHZhbCkge1xuXHRcdFx0XHRcdFx0XHRpZiAoZGVmLnNldC5jYWxsKG1lLCB2YWwpKSB7XG5cdFx0XHRcdFx0XHRcdFx0bWUuc2V0VHJhbnNmb3JtRGlydHkoKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlucHV0ID0gdGhpcy5tZXRob2RzW2lucHV0TmFtZV07XG5cdFx0XHRcdFx0aWYgKGlucHV0KSB7XG5cdFx0XHRcdFx0XHRkZWYgPSBpbnB1dDtcblx0XHRcdFx0XHRcdHNlcmlvdXNseVthbGlhc05hbWVdID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0XHRpZiAoZGVmLmFwcGx5KG1lLCBhcmd1bWVudHMpKSB7XG5cdFx0XHRcdFx0XHRcdFx0bWUuc2V0VHJhbnNmb3JtRGlydHkoKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaW5wdXQpIHtcblx0XHRcdFx0XHRhbGlhc2VzW2FsaWFzTmFtZV0gPSB7XG5cdFx0XHRcdFx0XHRub2RlOiB0aGlzLFxuXHRcdFx0XHRcdFx0aW5wdXQ6IGlucHV0TmFtZVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fTtcblxuXHRcdFRyYW5zZm9ybU5vZGUucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uIChyZW5kZXJUcmFuc2Zvcm0pIHtcblx0XHRcdGlmICghdGhpcy5zb3VyY2UpIHtcblx0XHRcdFx0aWYgKHRoaXMudHJhbnNmb3JtRGlydHkpIHtcblx0XHRcdFx0XHRtYXQ0LmNvcHkodGhpcy5jdW11bGF0aXZlTWF0cml4LCB0aGlzLm1hdHJpeCk7XG5cdFx0XHRcdFx0dGhpcy50cmFuc2Zvcm1EaXJ0eSA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudGV4dHVyZSA9IG51bGw7XG5cdFx0XHRcdHRoaXMuZGlydHkgPSBmYWxzZTtcblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc291cmNlLnJlbmRlcigpO1xuXG5cdFx0XHRpZiAodGhpcy50cmFuc2Zvcm1EaXJ0eSkge1xuXHRcdFx0XHRpZiAodGhpcy50cmFuc2Zvcm1lZCkge1xuXHRcdFx0XHRcdC8vdXNlIHRoaXMubWF0cml4XG5cdFx0XHRcdFx0aWYgKHRoaXMuc291cmNlLmN1bXVsYXRpdmVNYXRyaXgpIHtcblx0XHRcdFx0XHRcdG1hdDQubXVsdGlwbHkodGhpcy5jdW11bGF0aXZlTWF0cml4LCB0aGlzLm1hdHJpeCwgdGhpcy5zb3VyY2UuY3VtdWxhdGl2ZU1hdHJpeCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG1hdDQuY29weSh0aGlzLmN1bXVsYXRpdmVNYXRyaXgsIHRoaXMubWF0cml4KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly9jb3B5IHNvdXJjZS5jdW11bGF0aXZlTWF0cml4XG5cdFx0XHRcdFx0bWF0NC5jb3B5KHRoaXMuY3VtdWxhdGl2ZU1hdHJpeCwgdGhpcy5zb3VyY2UuY3VtdWxhdGl2ZU1hdHJpeCB8fCBpZGVudGl0eSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnRyYW5zZm9ybURpcnR5ID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChyZW5kZXJUcmFuc2Zvcm0gJiYgZ2wpIHtcblx0XHRcdFx0aWYgKHRoaXMucmVuZGVyRGlydHkpIHtcblx0XHRcdFx0XHRpZiAoIXRoaXMuZnJhbWVCdWZmZXIpIHtcblx0XHRcdFx0XHRcdHRoaXMudW5pZm9ybXMgPSB7XG5cdFx0XHRcdFx0XHRcdHJlc29sdXRpb246IFt0aGlzLndpZHRoLCB0aGlzLmhlaWdodF1cblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHR0aGlzLmZyYW1lQnVmZmVyID0gbmV3IEZyYW1lQnVmZmVyKGdsLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy51bmlmb3Jtcy5zb3VyY2UgPSB0aGlzLnNvdXJjZS50ZXh0dXJlO1xuXHRcdFx0XHRcdHRoaXMudW5pZm9ybXMudHJhbnNmb3JtID0gdGhpcy5jdW11bGF0aXZlTWF0cml4IHx8IGlkZW50aXR5O1xuXHRcdFx0XHRcdGRyYXcoYmFzZVNoYWRlciwgcmVjdGFuZ2xlTW9kZWwsIHRoaXMudW5pZm9ybXMsIHRoaXMuZnJhbWVCdWZmZXIuZnJhbWVCdWZmZXIsIHRoaXMpO1xuXG5cdFx0XHRcdFx0dGhpcy5yZW5kZXJEaXJ0eSA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudGV4dHVyZSA9IHRoaXMuZnJhbWVCdWZmZXIudGV4dHVyZTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5zb3VyY2UpIHtcblx0XHRcdFx0dGhpcy50ZXh0dXJlID0gdGhpcy5zb3VyY2UudGV4dHVyZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudGV4dHVyZSA9IG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuZGlydHkgPSBmYWxzZTtcblxuXHRcdFx0cmV0dXJuIHRoaXMudGV4dHVyZTtcblx0XHR9O1xuXG5cdFx0VHJhbnNmb3JtTm9kZS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBpLCBrZXksIGl0ZW0sIGhvb2sgPSB0aGlzLmhvb2s7XG5cblx0XHRcdC8vbGV0IGVmZmVjdCBkZXN0cm95IGl0c2VsZlxuXHRcdFx0aWYgKHRoaXMucGx1Z2luLmRlc3Ryb3kgJiYgdHlwZW9mIHRoaXMucGx1Z2luLmRlc3Ryb3kgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uZGVzdHJveS5jYWxsKHRoaXMpO1xuXHRcdFx0fVxuXHRcdFx0ZGVsZXRlIHRoaXMuZWZmZWN0O1xuXG5cdFx0XHQvL3N0b3Agd2F0Y2hpbmcgYW55IGlucHV0IGVsZW1lbnRzXG5cdFx0XHRmb3IgKGkgaW4gdGhpcy5pbnB1dEVsZW1lbnRzKSB7XG5cdFx0XHRcdGlmICh0aGlzLmlucHV0RWxlbWVudHMuaGFzT3duUHJvcGVydHkoaSkpIHtcblx0XHRcdFx0XHRpdGVtID0gdGhpcy5pbnB1dEVsZW1lbnRzW2ldO1xuXHRcdFx0XHRcdGl0ZW0uZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBpdGVtLmxpc3RlbmVyLCB0cnVlKTtcblx0XHRcdFx0XHRpdGVtLmVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBpdGVtLmxpc3RlbmVyLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvL3NvdXJjZXNcblx0XHRcdGlmICh0aGlzLnNvdXJjZSkge1xuXHRcdFx0XHR0aGlzLnNvdXJjZS5yZW1vdmVUYXJnZXQodGhpcyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vdGFyZ2V0c1xuXHRcdFx0d2hpbGUgKHRoaXMudGFyZ2V0cy5sZW5ndGgpIHtcblx0XHRcdFx0aXRlbSA9IHRoaXMudGFyZ2V0cy5wb3AoKTtcblx0XHRcdFx0aWYgKGl0ZW0gJiYgaXRlbS5yZW1vdmVTb3VyY2UpIHtcblx0XHRcdFx0XHRpdGVtLnJlbW92ZVNvdXJjZSh0aGlzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGtleSBpbiB0aGlzKSB7XG5cdFx0XHRcdGlmICh0aGlzLmhhc093blByb3BlcnR5KGtleSkgJiYga2V5ICE9PSAnaWQnKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHRoaXNba2V5XTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvL3JlbW92ZSBhbnkgYWxpYXNlc1xuXHRcdFx0Zm9yIChrZXkgaW4gYWxpYXNlcykge1xuXHRcdFx0XHRpZiAoYWxpYXNlcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG5cdFx0XHRcdFx0aXRlbSA9IGFsaWFzZXNba2V5XTtcblx0XHRcdFx0XHRpZiAoaXRlbS5ub2RlID09PSB0aGlzKSB7XG5cdFx0XHRcdFx0XHRzZXJpb3VzbHkucmVtb3ZlQWxpYXMoa2V5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly9yZW1vdmUgc2VsZiBmcm9tIG1hc3RlciBsaXN0IG9mIGVmZmVjdHNcblx0XHRcdGkgPSB0cmFuc2Zvcm1zLmluZGV4T2YodGhpcyk7XG5cdFx0XHRpZiAoaSA+PSAwKSB7XG5cdFx0XHRcdHRyYW5zZm9ybXMuc3BsaWNlKGksIDEpO1xuXHRcdFx0fVxuXG5cdFx0XHRpID0gYWxsVHJhbnNmb3Jtc0J5SG9va1tob29rXS5pbmRleE9mKHRoaXMpO1xuXHRcdFx0aWYgKGkgPj0gMCkge1xuXHRcdFx0XHRhbGxUcmFuc2Zvcm1zQnlIb29rW2hvb2tdLnNwbGljZShpLCAxKTtcblx0XHRcdH1cblxuXHRcdFx0Tm9kZS5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuXHRcdH07XG5cblx0XHRUcmFuc2Zvcm1Ob2RlLnByb3RvdHlwZS5zZXRSZWFkeSA9IE5vZGUucHJvdG90eXBlLnNldFJlYWR5O1xuXHRcdFRyYW5zZm9ybU5vZGUucHJvdG90eXBlLnNldFVucmVhZHkgPSBOb2RlLnByb3RvdHlwZS5zZXRVbnJlYWR5O1xuXHRcdFRyYW5zZm9ybU5vZGUucHJvdG90eXBlLm9uID0gTm9kZS5wcm90b3R5cGUub247XG5cdFx0VHJhbnNmb3JtTm9kZS5wcm90b3R5cGUub2ZmID0gTm9kZS5wcm90b3R5cGUub2ZmO1xuXHRcdFRyYW5zZm9ybU5vZGUucHJvdG90eXBlLmVtaXQgPSBOb2RlLnByb3RvdHlwZS5lbWl0O1xuXG5cdFx0Lypcblx0XHRJbml0aWFsaXplIFNlcmlvdXNseSBvYmplY3QgYmFzZWQgb24gb3B0aW9uc1xuXHRcdCovXG5cblx0XHRpZiAob3B0aW9ucyBpbnN0YW5jZW9mIEhUTUxDYW52YXNFbGVtZW50KSB7XG5cdFx0XHRvcHRpb25zID0ge1xuXHRcdFx0XHRjYW52YXM6IG9wdGlvbnNcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLmNhbnZhcykge1xuXHRcdH1cblxuXHRcdC8qXG5cdFx0cHJpdmVsZWdlZCBtZXRob2RzXG5cdFx0Ki9cblx0XHR0aGlzLmVmZmVjdCA9IGZ1bmN0aW9uIChob29rLCBvcHRpb25zKSB7XG5cdFx0XHRpZiAoIXNlcmlvdXNFZmZlY3RzW2hvb2tdKSB7XG5cdFx0XHRcdHRocm93ICdVbmtub3duIGVmZmVjdDogJyArIGhvb2s7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBlZmZlY3ROb2RlID0gbmV3IEVmZmVjdE5vZGUoaG9vaywgb3B0aW9ucyk7XG5cdFx0XHRyZXR1cm4gZWZmZWN0Tm9kZS5wdWI7XG5cdFx0fTtcblxuXHRcdHRoaXMuc291cmNlID0gZnVuY3Rpb24gKGhvb2ssIHNvdXJjZSwgb3B0aW9ucykge1xuXHRcdFx0dmFyIHNvdXJjZU5vZGUgPSBmaW5kSW5wdXROb2RlKGhvb2ssIHNvdXJjZSwgb3B0aW9ucyk7XG5cdFx0XHRyZXR1cm4gc291cmNlTm9kZS5wdWI7XG5cdFx0fTtcblxuXHRcdHRoaXMudHJhbnNmb3JtID0gZnVuY3Rpb24gKGhvb2ssIG9wdHMpIHtcblx0XHRcdHZhciB0cmFuc2Zvcm1Ob2RlO1xuXG5cdFx0XHRpZiAodHlwZW9mIGhvb2sgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdG9wdHMgPSBob29rO1xuXHRcdFx0XHRob29rID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChob29rKSB7XG5cdFx0XHRcdGlmICghc2VyaW91c1RyYW5zZm9ybXNbaG9va10pIHtcblx0XHRcdFx0XHR0aHJvdyAnVW5rbm93biB0cmFuc2Zvcm1zOiAnICsgaG9vaztcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aG9vayA9IG9wdGlvbnMgJiYgb3B0aW9ucy5kZWZhdWx0VHJhbnNmb3JtIHx8ICcyZCc7XG5cdFx0XHRcdGlmICghc2VyaW91c1RyYW5zZm9ybXNbaG9va10pIHtcblx0XHRcdFx0XHR0aHJvdyAnTm8gdHJhbnNmb3JtIHNwZWNpZmllZCc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dHJhbnNmb3JtTm9kZSA9IG5ldyBUcmFuc2Zvcm1Ob2RlKGhvb2ssIG9wdHMpO1xuXHRcdFx0cmV0dXJuIHRyYW5zZm9ybU5vZGUucHViO1xuXHRcdH07XG5cblx0XHR0aGlzLnRhcmdldCA9IGZ1bmN0aW9uICh0YXJnZXQsIG9wdGlvbnMpIHtcblx0XHRcdHZhciB0YXJnZXROb2RlLCBpO1xuXG5cdFx0XHRmb3IgKGkgPSAwOyBpIDwgdGFyZ2V0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAodGFyZ2V0c1tpXSA9PT0gdGFyZ2V0IHx8IHRhcmdldHNbaV0udGFyZ2V0ID09PSB0YXJnZXQpIHtcblx0XHRcdFx0XHRpZiAoISEob3B0aW9ucyAmJiBvcHRpb25zLnJlbmRlclRvVGV4dHVyZSkgPT09ICEhdGFyZ2V0c1tpXS5yZW5kZXJUb1RleHR1cmUpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0YXJnZXRzW2ldLnB1Yjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGFyZ2V0Tm9kZSA9IG5ldyBUYXJnZXROb2RlKHRhcmdldCwgb3B0aW9ucyk7XG5cblx0XHRcdHJldHVybiB0YXJnZXROb2RlLnB1Yjtcblx0XHR9O1xuXG5cdFx0dGhpcy5hbGlhc2VzID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIE9iamVjdC5rZXlzKGFsaWFzZXMpO1xuXHRcdH07XG5cblx0XHR0aGlzLnJlbW92ZUFsaWFzID0gZnVuY3Rpb24gKG5hbWUpIHtcblx0XHRcdGlmIChhbGlhc2VzW25hbWVdKSB7XG5cdFx0XHRcdGRlbGV0ZSB0aGlzW25hbWVdO1xuXHRcdFx0XHRkZWxldGUgYWxpYXNlc1tuYW1lXTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5nbyA9IGZ1bmN0aW9uIChwcmUsIHBvc3QpIHtcblx0XHRcdHZhciBpO1xuXG5cdFx0XHRpZiAodHlwZW9mIHByZSA9PT0gJ2Z1bmN0aW9uJyAmJiBwcmVDYWxsYmFja3MuaW5kZXhPZihwcmUpIDwgMCkge1xuXHRcdFx0XHRwcmVDYWxsYmFja3MucHVzaChwcmUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodHlwZW9mIHBvc3QgPT09ICdmdW5jdGlvbicgJiYgcG9zdENhbGxiYWNrcy5pbmRleE9mKHBvc3QpIDwgMCkge1xuXHRcdFx0XHRwb3N0Q2FsbGJhY2tzLnB1c2gocG9zdCk7XG5cdFx0XHR9XG5cblx0XHRcdGF1dG8gPSB0cnVlO1xuXHRcdFx0Zm9yIChpID0gMDsgaSA8IHRhcmdldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0dGFyZ2V0c1tpXS5nbygpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXJhZklkICYmIChwcmVDYWxsYmFja3MubGVuZ3RoIHx8IHBvc3RDYWxsYmFja3MubGVuZ3RoKSkge1xuXHRcdFx0XHRyZW5kZXJEYWVtb24oKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5zdG9wID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0cHJlQ2FsbGJhY2tzLmxlbmd0aCA9IDA7XG5cdFx0XHRwb3N0Q2FsbGJhY2tzLmxlbmd0aCA9IDA7XG5cdFx0XHRjYW5jZWxBbmltRnJhbWUocmFmSWQpO1xuXHRcdFx0cmFmSWQgPSBudWxsO1xuXHRcdH07XG5cblx0XHR0aGlzLnJlbmRlciA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBpO1xuXHRcdFx0Zm9yIChpID0gMDsgaSA8IHRhcmdldHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0dGFyZ2V0c1tpXS5yZW5kZXIob3B0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBpLFxuXHRcdFx0XHRub2RlLFxuXHRcdFx0XHRkZXNjcmlwdG9yO1xuXG5cdFx0XHR3aGlsZSAobm9kZXMubGVuZ3RoKSB7XG5cdFx0XHRcdG5vZGUgPSBub2Rlcy5zaGlmdCgpO1xuXHRcdFx0XHRub2RlLmRlc3Ryb3koKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGJhc2VTaGFkZXIpIHtcblx0XHRcdFx0YmFzZVNoYWRlci5kZXN0cm95KCk7XG5cdFx0XHRcdGJhc2VTaGFkZXIgPSBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHQvL2NsZWFuIHVwIHJlY3RhbmdsZU1vZGVsXG5cdFx0XHRpZiAoZ2wpIHtcblx0XHRcdFx0Z2wuZGVsZXRlQnVmZmVyKHJlY3RhbmdsZU1vZGVsLnZlcnRleCk7XG5cdFx0XHRcdGdsLmRlbGV0ZUJ1ZmZlcihyZWN0YW5nbGVNb2RlbC50ZXhDb29yZCk7XG5cdFx0XHRcdGdsLmRlbGV0ZUJ1ZmZlcihyZWN0YW5nbGVNb2RlbC5pbmRleCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChyZWN0YW5nbGVNb2RlbCkge1xuXHRcdFx0XHRkZWxldGUgcmVjdGFuZ2xlTW9kZWwudmVydGV4O1xuXHRcdFx0XHRkZWxldGUgcmVjdGFuZ2xlTW9kZWwudGV4Q29vcmQ7XG5cdFx0XHRcdGRlbGV0ZSByZWN0YW5nbGVNb2RlbC5pbmRleDtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChpIGluIHRoaXMpIHtcblx0XHRcdFx0aWYgKHRoaXMuaGFzT3duUHJvcGVydHkoaSkgJiYgaSAhPT0gJ2lzRGVzdHJveWVkJykge1xuXHRcdFx0XHRcdGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRoaXMsIGkpO1xuXHRcdFx0XHRcdGlmIChkZXNjcmlwdG9yLmdldCB8fCBkZXNjcmlwdG9yLnNldCB8fFxuXHRcdFx0XHRcdFx0XHR0eXBlb2YgdGhpc1tpXSAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdFx0ZGVsZXRlIHRoaXNbaV07XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXNbaV0gPSBub3A7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGJhc2VGcmFnbWVudFNoYWRlciA9IG51bGw7XG5cdFx0XHRiYXNlVmVydGV4U2hhZGVyID0gbnVsbDtcblx0XHRcdHJlY3RhbmdsZU1vZGVsID0gbnVsbDtcblx0XHRcdGdsID0gbnVsbDtcblx0XHRcdHNlcmlvdXNseSA9IG51bGw7XG5cdFx0XHRzb3VyY2VzID0gW107XG5cdFx0XHR0YXJnZXRzID0gW107XG5cdFx0XHRlZmZlY3RzID0gW107XG5cdFx0XHRub2RlcyA9IFtdO1xuXHRcdFx0cHJlQ2FsbGJhY2tzLmxlbmd0aCA9IDA7XG5cdFx0XHRwb3N0Q2FsbGJhY2tzLmxlbmd0aCA9IDA7XG5cdFx0XHRjYW5jZWxBbmltRnJhbWUocmFmSWQpO1xuXHRcdFx0cmFmSWQgPSBudWxsO1xuXG5cblx0XHRcdGlzRGVzdHJveWVkID0gdHJ1ZTtcblx0XHR9O1xuXG5cdFx0dGhpcy5pc0Rlc3Ryb3llZCA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiBpc0Rlc3Ryb3llZDtcblx0XHR9O1xuXG5cdFx0dGhpcy5pbmNvbXBhdGlibGUgPSBmdW5jdGlvbiAoaG9vaykge1xuXHRcdFx0dmFyIGtleSxcblx0XHRcdFx0cGx1Z2luLFxuXHRcdFx0XHRmYWlsdXJlID0gZmFsc2U7XG5cblx0XHRcdGZhaWx1cmUgPSBTZXJpb3VzbHkuaW5jb21wYXRpYmxlKGhvb2spO1xuXG5cdFx0XHRpZiAoZmFpbHVyZSkge1xuXHRcdFx0XHRyZXR1cm4gZmFpbHVyZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFob29rKSB7XG5cdFx0XHRcdGZvciAoa2V5IGluIGFsbEVmZmVjdHNCeUhvb2spIHtcblx0XHRcdFx0XHRpZiAoYWxsRWZmZWN0c0J5SG9vay5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGFsbEVmZmVjdHNCeUhvb2tba2V5XS5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdHBsdWdpbiA9IHNlcmlvdXNFZmZlY3RzW2tleV07XG5cdFx0XHRcdFx0XHRpZiAocGx1Z2luICYmIHR5cGVvZiBwbHVnaW4uY29tcGF0aWJsZSA9PT0gJ2Z1bmN0aW9uJyAmJlxuXHRcdFx0XHRcdFx0XHRcdCFwbHVnaW4uY29tcGF0aWJsZS5jYWxsKHRoaXMpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiAncGx1Z2luLScgKyBrZXk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Zm9yIChrZXkgaW4gYWxsU291cmNlc0J5SG9vaykge1xuXHRcdFx0XHRcdGlmIChhbGxTb3VyY2VzQnlIb29rLmhhc093blByb3BlcnR5KGtleSkgJiYgYWxsU291cmNlc0J5SG9va1trZXldLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0cGx1Z2luID0gc2VyaW91c1NvdXJjZXNba2V5XTtcblx0XHRcdFx0XHRcdGlmIChwbHVnaW4gJiYgdHlwZW9mIHBsdWdpbi5jb21wYXRpYmxlID09PSAnZnVuY3Rpb24nICYmXG5cdFx0XHRcdFx0XHRcdFx0IXBsdWdpbi5jb21wYXRpYmxlLmNhbGwodGhpcykpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuICdzb3VyY2UtJyArIGtleTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH07XG5cblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG5cdFx0XHRpZDoge1xuXHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuXHRcdFx0XHRjb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHJldHVybiBpZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly90b2RvOiBsb2FkLCBzYXZlLCBmaW5kXG5cblx0XHRiYXNlVmVydGV4U2hhZGVyID0gW1xuXHRcdFx0JyNpZmRlZiBHTF9FUycsXG5cdFx0XHQncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7Jyxcblx0XHRcdCcjZW5kaWYnLFxuXG5cdFx0XHQnYXR0cmlidXRlIHZlYzQgcG9zaXRpb247Jyxcblx0XHRcdCdhdHRyaWJ1dGUgdmVjMiB0ZXhDb29yZDsnLFxuXG5cdFx0XHQndW5pZm9ybSB2ZWMyIHJlc29sdXRpb247Jyxcblx0XHRcdCd1bmlmb3JtIG1hdDQgdHJhbnNmb3JtOycsXG5cblx0XHRcdCd2YXJ5aW5nIHZlYzIgdlRleENvb3JkOycsXG5cdFx0XHQndmFyeWluZyB2ZWM0IHZQb3NpdGlvbjsnLFxuXG5cdFx0XHQndm9pZCBtYWluKHZvaWQpIHsnLFxuXHRcdFx0Ly8gZmlyc3QgY29udmVydCB0byBzY3JlZW4gc3BhY2Vcblx0XHRcdCdcdHZlYzQgc2NyZWVuUG9zaXRpb24gPSB2ZWM0KHBvc2l0aW9uLnh5ICogcmVzb2x1dGlvbiAvIDIuMCwgcG9zaXRpb24ueiwgcG9zaXRpb24udyk7Jyxcblx0XHRcdCdcdHNjcmVlblBvc2l0aW9uID0gdHJhbnNmb3JtICogc2NyZWVuUG9zaXRpb247JyxcblxuXHRcdFx0Ly8gY29udmVydCBiYWNrIHRvIE9wZW5HTCBjb29yZHNcblx0XHRcdCdcdGdsX1Bvc2l0aW9uLnh5ID0gc2NyZWVuUG9zaXRpb24ueHkgKiAyLjAgLyByZXNvbHV0aW9uOycsXG5cdFx0XHQnXHRnbF9Qb3NpdGlvbi56ID0gc2NyZWVuUG9zaXRpb24ueiAqIDIuMCAvIChyZXNvbHV0aW9uLnggLyByZXNvbHV0aW9uLnkpOycsXG5cdFx0XHQnXHRnbF9Qb3NpdGlvbi53ID0gc2NyZWVuUG9zaXRpb24udzsnLFxuXHRcdFx0J1x0dlRleENvb3JkID0gdGV4Q29vcmQ7Jyxcblx0XHRcdCdcdHZQb3NpdGlvbiA9IGdsX1Bvc2l0aW9uOycsXG5cdFx0XHQnfVxcbidcblx0XHRdLmpvaW4oJ1xcbicpO1xuXG5cdFx0YmFzZUZyYWdtZW50U2hhZGVyID0gW1xuXHRcdFx0JyNpZmRlZiBHTF9FUycsXG5cdFx0XHQncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7Jyxcblx0XHRcdCcjZW5kaWYnLFxuXHRcdFx0J3ZhcnlpbmcgdmVjMiB2VGV4Q29vcmQ7Jyxcblx0XHRcdCd2YXJ5aW5nIHZlYzQgdlBvc2l0aW9uOycsXG5cdFx0XHQndW5pZm9ybSBzYW1wbGVyMkQgc291cmNlOycsXG5cdFx0XHQndm9pZCBtYWluKHZvaWQpIHsnLFxuXHRcdFx0Lypcblx0XHRcdCdcdGlmIChhbnkobGVzc1RoYW4odlRleENvb3JkLCB2ZWMyKDAuMCkpKSB8fCBhbnkoZ3JlYXRlclRoYW5FcXVhbCh2VGV4Q29vcmQsIHZlYzIoMS4wKSkpKSB7Jyxcblx0XHRcdCdcdFx0Z2xfRnJhZ0NvbG9yID0gdmVjNCgwLjApOycsXG5cdFx0XHQnXHR9IGVsc2UgeycsXG5cdFx0XHQqL1xuXHRcdFx0J1x0XHRnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCB2VGV4Q29vcmQpOycsXG5cdFx0XHQvLydcdH0nLFxuXHRcdFx0J30nXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0fVxuXG5cdFNlcmlvdXNseS5pbmNvbXBhdGlibGUgPSBmdW5jdGlvbiAoaG9vaykge1xuXHRcdHZhciBjYW52YXMsIGdsLCBwbHVnaW47XG5cblx0XHRpZiAoaW5jb21wYXRpYmlsaXR5ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXHRcdFx0aWYgKCFjYW52YXMgfHwgIWNhbnZhcy5nZXRDb250ZXh0KSB7XG5cdFx0XHRcdGluY29tcGF0aWJpbGl0eSA9ICdjYW52YXMnO1xuXHRcdFx0fSBlbHNlIGlmICghd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCkge1xuXHRcdFx0XHRpbmNvbXBhdGliaWxpdHkgPSAnd2ViZ2wnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Z2wgPSBnZXRUZXN0Q29udGV4dCgpO1xuXHRcdFx0XHRpZiAoIWdsKSB7XG5cdFx0XHRcdFx0aW5jb21wYXRpYmlsaXR5ID0gJ2NvbnRleHQnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGluY29tcGF0aWJpbGl0eSkge1xuXHRcdFx0cmV0dXJuIGluY29tcGF0aWJpbGl0eTtcblx0XHR9XG5cblx0XHRpZiAoaG9vaykge1xuXHRcdFx0cGx1Z2luID0gc2VyaW91c0VmZmVjdHNbaG9va107XG5cdFx0XHRpZiAocGx1Z2luICYmIHR5cGVvZiBwbHVnaW4uY29tcGF0aWJsZSA9PT0gJ2Z1bmN0aW9uJyAmJlxuXHRcdFx0XHQhcGx1Z2luLmNvbXBhdGlibGUoZ2wpKSB7XG5cblx0XHRcdFx0cmV0dXJuICdwbHVnaW4tJyArIGhvb2s7XG5cdFx0XHR9XG5cblx0XHRcdHBsdWdpbiA9IHNlcmlvdXNTb3VyY2VzW2hvb2tdO1xuXHRcdFx0aWYgKHBsdWdpbiAmJiB0eXBlb2YgcGx1Z2luLmNvbXBhdGlibGUgPT09ICdmdW5jdGlvbicgJiZcblx0XHRcdFx0IXBsdWdpbi5jb21wYXRpYmxlKGdsKSkge1xuXG5cdFx0XHRcdHJldHVybiAnc291cmNlLScgKyBob29rO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fTtcblxuXHRTZXJpb3VzbHkucGx1Z2luID0gZnVuY3Rpb24gKGhvb2ssIGRlZmluaXRpb24sIG1ldGEpIHtcblx0XHR2YXIgZWZmZWN0O1xuXG5cdFx0aWYgKHNlcmlvdXNFZmZlY3RzW2hvb2tdKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnRWZmZWN0IFsnICsgaG9vayArICddIGFscmVhZHkgbG9hZGVkJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKG1ldGEgPT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZGVmaW5pdGlvbiA9PT0gJ29iamVjdCcpIHtcblx0XHRcdG1ldGEgPSBkZWZpbml0aW9uO1xuXHRcdH1cblxuXHRcdGlmICghbWV0YSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGVmZmVjdCA9IGV4dGVuZCh7fSwgbWV0YSk7XG5cblx0XHRpZiAodHlwZW9mIGRlZmluaXRpb24gPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdGVmZmVjdC5kZWZpbml0aW9uID0gZGVmaW5pdGlvbjtcblx0XHR9XG5cblx0XHRpZiAoZWZmZWN0LmlucHV0cykge1xuXHRcdFx0dmFsaWRhdGVJbnB1dFNwZWNzKGVmZmVjdCk7XG5cdFx0fVxuXG5cdFx0aWYgKCFlZmZlY3QudGl0bGUpIHtcblx0XHRcdGVmZmVjdC50aXRsZSA9IGhvb2s7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRpZiAodHlwZW9mIGVmZmVjdC5yZXF1aXJlcyAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0ZWZmZWN0LnJlcXVpcmVzID0gZmFsc2U7XG5cdFx0fVxuXHRcdCovXG5cblx0XHRzZXJpb3VzRWZmZWN0c1tob29rXSA9IGVmZmVjdDtcblx0XHRhbGxFZmZlY3RzQnlIb29rW2hvb2tdID0gW107XG5cblx0XHRyZXR1cm4gZWZmZWN0O1xuXHR9O1xuXG5cdFNlcmlvdXNseS5yZW1vdmVQbHVnaW4gPSBmdW5jdGlvbiAoaG9vaykge1xuXHRcdHZhciBhbGwsIGVmZmVjdCwgcGx1Z2luO1xuXG5cdFx0aWYgKCFob29rKSB7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cblx0XHRwbHVnaW4gPSBzZXJpb3VzRWZmZWN0c1tob29rXTtcblxuXHRcdGlmICghcGx1Z2luKSB7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cblx0XHRhbGwgPSBhbGxFZmZlY3RzQnlIb29rW2hvb2tdO1xuXHRcdGlmIChhbGwpIHtcblx0XHRcdHdoaWxlIChhbGwubGVuZ3RoKSB7XG5cdFx0XHRcdGVmZmVjdCA9IGFsbC5zaGlmdCgpO1xuXHRcdFx0XHRlZmZlY3QuZGVzdHJveSgpO1xuXHRcdFx0fVxuXHRcdFx0ZGVsZXRlIGFsbEVmZmVjdHNCeUhvb2tbaG9va107XG5cdFx0fVxuXG5cdFx0ZGVsZXRlIHNlcmlvdXNFZmZlY3RzW2hvb2tdO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0U2VyaW91c2x5LnNvdXJjZSA9IGZ1bmN0aW9uIChob29rLCBkZWZpbml0aW9uLCBtZXRhKSB7XG5cdFx0dmFyIHNvdXJjZTtcblxuXHRcdGlmIChzZXJpb3VzU291cmNlc1tob29rXSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ1NvdXJjZSBbJyArIGhvb2sgKyAnXSBhbHJlYWR5IGxvYWRlZCcpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChtZXRhID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIGRlZmluaXRpb24gPT09ICdvYmplY3QnKSB7XG5cdFx0XHRtZXRhID0gZGVmaW5pdGlvbjtcblx0XHR9XG5cblx0XHRpZiAoIW1ldGEgJiYgIWRlZmluaXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzb3VyY2UgPSBleHRlbmQoe30sIG1ldGEpO1xuXG5cdFx0aWYgKHR5cGVvZiBkZWZpbml0aW9uID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRzb3VyY2UuZGVmaW5pdGlvbiA9IGRlZmluaXRpb247XG5cdFx0fVxuXG5cdFx0aWYgKCFzb3VyY2UudGl0bGUpIHtcblx0XHRcdHNvdXJjZS50aXRsZSA9IGhvb2s7XG5cdFx0fVxuXG5cblx0XHRzZXJpb3VzU291cmNlc1tob29rXSA9IHNvdXJjZTtcblx0XHRhbGxTb3VyY2VzQnlIb29rW2hvb2tdID0gW107XG5cblx0XHRyZXR1cm4gc291cmNlO1xuXHR9O1xuXG5cdFNlcmlvdXNseS5yZW1vdmVTb3VyY2UgPSBmdW5jdGlvbiAoaG9vaykge1xuXHRcdHZhciBhbGwsIHNvdXJjZSwgcGx1Z2luO1xuXG5cdFx0aWYgKCFob29rKSB7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cblx0XHRwbHVnaW4gPSBzZXJpb3VzU291cmNlc1tob29rXTtcblxuXHRcdGlmICghcGx1Z2luKSB7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cblx0XHRhbGwgPSBhbGxTb3VyY2VzQnlIb29rW2hvb2tdO1xuXHRcdGlmIChhbGwpIHtcblx0XHRcdHdoaWxlIChhbGwubGVuZ3RoKSB7XG5cdFx0XHRcdHNvdXJjZSA9IGFsbC5zaGlmdCgpO1xuXHRcdFx0XHRzb3VyY2UuZGVzdHJveSgpO1xuXHRcdFx0fVxuXHRcdFx0ZGVsZXRlIGFsbFNvdXJjZXNCeUhvb2tbaG9va107XG5cdFx0fVxuXG5cdFx0ZGVsZXRlIHNlcmlvdXNTb3VyY2VzW2hvb2tdO1xuXG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cblx0U2VyaW91c2x5LnRyYW5zZm9ybSA9IGZ1bmN0aW9uIChob29rLCBkZWZpbml0aW9uLCBtZXRhKSB7XG5cdFx0dmFyIHRyYW5zZm9ybTtcblxuXHRcdGlmIChzZXJpb3VzVHJhbnNmb3Jtc1tob29rXSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ1RyYW5zZm9ybSBbJyArIGhvb2sgKyAnXSBhbHJlYWR5IGxvYWRlZCcpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChtZXRhID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIGRlZmluaXRpb24gPT09ICdvYmplY3QnKSB7XG5cdFx0XHRtZXRhID0gZGVmaW5pdGlvbjtcblx0XHR9XG5cblx0XHRpZiAoIW1ldGEgJiYgIWRlZmluaXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0cmFuc2Zvcm0gPSBleHRlbmQoe30sIG1ldGEpO1xuXG5cdFx0aWYgKHR5cGVvZiBkZWZpbml0aW9uID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0cmFuc2Zvcm0uZGVmaW5pdGlvbiA9IGRlZmluaXRpb247XG5cdFx0fVxuXG5cdFx0Lypcblx0XHR0b2RvOiB2YWxpZGF0ZSBtZXRob2QgZGVmaW5pdGlvbnNcblx0XHRpZiAoZWZmZWN0LmlucHV0cykge1xuXHRcdFx0dmFsaWRhdGVJbnB1dFNwZWNzKGVmZmVjdCk7XG5cdFx0fVxuXHRcdCovXG5cblx0XHRpZiAoIXRyYW5zZm9ybS50aXRsZSkge1xuXHRcdFx0dHJhbnNmb3JtLnRpdGxlID0gaG9vaztcblx0XHR9XG5cblxuXHRcdHNlcmlvdXNUcmFuc2Zvcm1zW2hvb2tdID0gdHJhbnNmb3JtO1xuXHRcdGFsbFRyYW5zZm9ybXNCeUhvb2tbaG9va10gPSBbXTtcblxuXHRcdHJldHVybiB0cmFuc2Zvcm07XG5cdH07XG5cblx0U2VyaW91c2x5LnJlbW92ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIChob29rKSB7XG5cdFx0dmFyIGFsbCwgdHJhbnNmb3JtLCBwbHVnaW47XG5cblx0XHRpZiAoIWhvb2spIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblxuXHRcdHBsdWdpbiA9IHNlcmlvdXNUcmFuc2Zvcm1zW2hvb2tdO1xuXG5cdFx0aWYgKCFwbHVnaW4pIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblxuXHRcdGFsbCA9IGFsbFRyYW5zZm9ybXNCeUhvb2tbaG9va107XG5cdFx0aWYgKGFsbCkge1xuXHRcdFx0d2hpbGUgKGFsbC5sZW5ndGgpIHtcblx0XHRcdFx0dHJhbnNmb3JtID0gYWxsLnNoaWZ0KCk7XG5cdFx0XHRcdHRyYW5zZm9ybS5kZXN0cm95KCk7XG5cdFx0XHR9XG5cdFx0XHRkZWxldGUgYWxsVHJhbnNmb3Jtc0J5SG9va1tob29rXTtcblx0XHR9XG5cblx0XHRkZWxldGUgc2VyaW91c1RyYW5zZm9ybXNbaG9va107XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fTtcblxuXHQvL3RvZG86IHZhbGlkYXRvcnMgc2hvdWxkIG5vdCBhbGxvY2F0ZSBuZXcgb2JqZWN0cy9hcnJheXMgaWYgaW5wdXQgaXMgdmFsaWRcblx0U2VyaW91c2x5LmlucHV0VmFsaWRhdG9ycyA9IHtcblx0XHRjb2xvcjogZnVuY3Rpb24gKHZhbHVlLCBpbnB1dCwgb2xkVmFsdWUpIHtcblx0XHRcdHZhciBzLCBhLCBpLCBjb21wdXRlZCwgYmc7XG5cblx0XHRcdGEgPSBvbGRWYWx1ZSB8fCBbXTtcblxuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Ly90b2RvOiBzdXBwb3J0IHBlcmNlbnRhZ2VzLCBkZWNpbWFsc1xuXHRcdFx0XHRzID0gKC9eKHJnYnxoc2wpYT9cXChcXHMqKFxcZCspXFxzKixcXHMqKFxcZCspXFxzKixcXHMqKFxcZCspXFxzKigsXFxzKihcXGQrKFxcLlxcZCopPylcXHMqKT9cXCkvaSkuZXhlYyh2YWx1ZSk7XG5cdFx0XHRcdGlmIChzICYmIHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0aWYgKHMubGVuZ3RoIDwgMykge1xuXHRcdFx0XHRcdFx0YVswXSA9IGFbMV0gPSBhWzJdID0gYVszXSA9IDA7XG5cdFx0XHRcdFx0XHRyZXR1cm4gYTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRhWzNdID0gMTtcblx0XHRcdFx0XHRmb3IgKGkgPSAwOyBpIDwgMzsgaSsrKSB7XG5cdFx0XHRcdFx0XHRhW2ldID0gcGFyc2VGbG9hdChzW2krMl0pIC8gMjU1O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIWlzTmFOKHNbNl0pKSB7XG5cdFx0XHRcdFx0XHRhWzNdID0gcGFyc2VGbG9hdChzWzZdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHNbMV0udG9Mb3dlckNhc2UoKSA9PT0gJ2hzbCcpIHtcblx0XHRcdFx0XHRcdHJldHVybiBoc2xUb1JnYihhWzBdLCBhWzFdLCBhWzJdLCBhWzNdLCBhKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzID0gKC9eIygoWzAtOWEtZkEtRl17Myw4fSkpLykuZXhlYyh2YWx1ZSk7XG5cdFx0XHRcdGlmIChzICYmIHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cyA9IHNbMV07XG5cdFx0XHRcdFx0aWYgKHMubGVuZ3RoID09PSAzKSB7XG5cdFx0XHRcdFx0XHRhWzBdID0gcGFyc2VJbnQoc1swXSwgMTYpIC8gMTU7XG5cdFx0XHRcdFx0XHRhWzFdID0gcGFyc2VJbnQoc1sxXSwgMTYpIC8gMTU7XG5cdFx0XHRcdFx0XHRhWzJdID0gcGFyc2VJbnQoc1syXSwgMTYpIC8gMTU7XG5cdFx0XHRcdFx0XHRhWzNdID0gMTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHMubGVuZ3RoID09PSA0KSB7XG5cdFx0XHRcdFx0XHRhWzBdID0gcGFyc2VJbnQoc1swXSwgMTYpIC8gMTU7XG5cdFx0XHRcdFx0XHRhWzFdID0gcGFyc2VJbnQoc1sxXSwgMTYpIC8gMTU7XG5cdFx0XHRcdFx0XHRhWzJdID0gcGFyc2VJbnQoc1syXSwgMTYpIC8gMTU7XG5cdFx0XHRcdFx0XHRhWzNdID0gcGFyc2VJbnQoc1szXSwgMTYpIC8gMTU7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzLmxlbmd0aCA9PT0gNikge1xuXHRcdFx0XHRcdFx0YVswXSA9IHBhcnNlSW50KHMuc3Vic3RyKDAsIDIpLCAxNikgLyAyNTU7XG5cdFx0XHRcdFx0XHRhWzFdID0gcGFyc2VJbnQocy5zdWJzdHIoMiwgMiksIDE2KSAvIDI1NTtcblx0XHRcdFx0XHRcdGFbMl0gPSBwYXJzZUludChzLnN1YnN0cig0LCAyKSwgMTYpIC8gMjU1O1xuXHRcdFx0XHRcdFx0YVszXSA9IDE7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzLmxlbmd0aCA9PT0gOCkge1xuXHRcdFx0XHRcdFx0YVswXSA9IHBhcnNlSW50KHMuc3Vic3RyKDAsIDIpLCAxNikgLyAyNTU7XG5cdFx0XHRcdFx0XHRhWzFdID0gcGFyc2VJbnQocy5zdWJzdHIoMiwgMiksIDE2KSAvIDI1NTtcblx0XHRcdFx0XHRcdGFbMl0gPSBwYXJzZUludChzLnN1YnN0cig0LCAyKSwgMTYpIC8gMjU1O1xuXHRcdFx0XHRcdFx0YVszXSA9IHBhcnNlSW50KHMuc3Vic3RyKDYsIDIpLCAxNikgLyAyNTU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGFbMF0gPSBhWzFdID0gYVsyXSA9IGFbM10gPSAwO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gYTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHMgPSBjb2xvck5hbWVzW3ZhbHVlLnRvTG93ZXJDYXNlKCldO1xuXHRcdFx0XHRpZiAocykge1xuXHRcdFx0XHRcdGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcblx0XHRcdFx0XHRcdGFbaV0gPSBzW2ldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gYTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghY29sb3JFbGVtZW50KSB7XG5cdFx0XHRcdFx0Y29sb3JFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbG9yRWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnJztcblx0XHRcdFx0Y29sb3JFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHZhbHVlO1xuXHRcdFx0XHRjb21wdXRlZCA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGNvbG9yRWxlbWVudCk7XG5cdFx0XHRcdGJnID0gY29tcHV0ZWQuZ2V0UHJvcGVydHlWYWx1ZSgnYmFja2dyb3VuZC1jb2xvcicpIHx8XG5cdFx0XHRcdFx0Y29tcHV0ZWQuZ2V0UHJvcGVydHlWYWx1ZSgnYmFja2dyb3VuZENvbG9yJykgfHxcblx0XHRcdFx0XHRjb2xvckVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yO1xuXHRcdFx0XHRpZiAoYmcgJiYgYmcgIT09IHZhbHVlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFNlcmlvdXNseS5pbnB1dFZhbGlkYXRvcnMuY29sb3IoYmcsIGlucHV0LCBvbGRWYWx1ZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhWzBdID0gYVsxXSA9IGFbMl0gPSBhWzNdID0gMDtcblx0XHRcdFx0cmV0dXJuIGE7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpc0FycmF5TGlrZSh2YWx1ZSkpIHtcblx0XHRcdFx0YSA9IHZhbHVlO1xuXHRcdFx0XHRpZiAoYS5sZW5ndGggPCAzKSB7XG5cdFx0XHRcdFx0YVswXSA9IGFbMV0gPSBhWzJdID0gYVszXSA9IDA7XG5cdFx0XHRcdFx0cmV0dXJuIGE7XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IDM7IGkrKykge1xuXHRcdFx0XHRcdGlmIChpc05hTihhW2ldKSkge1xuXHRcdFx0XHRcdFx0YVswXSA9IGFbMV0gPSBhWzJdID0gYVszXSA9IDA7XG5cdFx0XHRcdFx0XHRyZXR1cm4gYTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGEubGVuZ3RoIDwgNCkge1xuXHRcdFx0XHRcdGEucHVzaCgxKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gYTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0YVswXSA9IGFbMV0gPSBhWzJdID0gdmFsdWU7XG5cdFx0XHRcdGFbM10gPSAxO1xuXHRcdFx0XHRyZXR1cm4gYTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuXHRcdFx0XHRcdHMgPSBjb2xvckZpZWxkc1tpXTtcblx0XHRcdFx0XHRpZiAodmFsdWVbc10gPT09IG51bGwgfHwgaXNOYU4odmFsdWVbc10pKSB7XG5cdFx0XHRcdFx0XHRhW2ldID0gaSA9PT0gMyA/IDEgOiAwO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhW2ldID0gdmFsdWVbc107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBhO1xuXHRcdFx0fVxuXG5cdFx0XHRhWzBdID0gYVsxXSA9IGFbMl0gPSBhWzNdID0gMDtcblx0XHRcdHJldHVybiBhO1xuXHRcdH0sXG5cdFx0bnVtYmVyOiBmdW5jdGlvbiAodmFsdWUsIGlucHV0KSB7XG5cdFx0XHRpZiAoaXNOYU4odmFsdWUpKSB7XG5cdFx0XHRcdHJldHVybiBpbnB1dC5kZWZhdWx0VmFsdWUgfHwgMDtcblx0XHRcdH1cblxuXHRcdFx0dmFsdWUgPSBwYXJzZUZsb2F0KHZhbHVlKTtcblxuXHRcdFx0aWYgKHZhbHVlIDwgaW5wdXQubWluKSB7XG5cdFx0XHRcdHJldHVybiBpbnB1dC5taW47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh2YWx1ZSA+IGlucHV0Lm1heCkge1xuXHRcdFx0XHRyZXR1cm4gaW5wdXQubWF4O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5wdXQuc3RlcCkge1xuXHRcdFx0XHRyZXR1cm4gTWF0aC5yb3VuZCh2YWx1ZSAvIGlucHV0LnN0ZXApICogaW5wdXQuc3RlcDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH0sXG5cdFx0J2VudW0nOiBmdW5jdGlvbiAodmFsdWUsIGlucHV0KSB7XG5cdFx0XHR2YXIgb3B0aW9ucyA9IGlucHV0Lm9wdGlvbnMgfHwgW10sXG5cdFx0XHRcdGZpbHRlcmVkO1xuXG5cdFx0XHRmaWx0ZXJlZCA9IG9wdGlvbnMuZmlsdGVyKGZ1bmN0aW9uIChvcHQpIHtcblx0XHRcdFx0cmV0dXJuIChpc0FycmF5TGlrZShvcHQpICYmIG9wdC5sZW5ndGggJiYgb3B0WzBdID09PSB2YWx1ZSkgfHwgb3B0ID09PSB2YWx1ZTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoZmlsdGVyZWQubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGlucHV0LmRlZmF1bHRWYWx1ZSB8fCAnJztcblx0XHR9LFxuXHRcdHZlY3RvcjogZnVuY3Rpb24gKHZhbHVlLCBpbnB1dCwgb2xkVmFsdWUpIHtcblx0XHRcdHZhciBhLCBpLCBzLCBuID0gaW5wdXQuZGltZW5zaW9ucyB8fCA0O1xuXG5cdFx0XHRhID0gb2xkVmFsdWUgfHwgW107XG5cdFx0XHRpZiAoaXNBcnJheUxpa2UodmFsdWUpKSB7XG5cdFx0XHRcdGZvciAoaSA9IDA7IGkgPCBuOyBpKyspIHtcblx0XHRcdFx0XHRhW2ldID0gdmFsdWVbaV0gfHwgMDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gYTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IG47IGkrKykge1xuXHRcdFx0XHRcdHMgPSB2ZWN0b3JGaWVsZHNbaV07XG5cdFx0XHRcdFx0aWYgKHZhbHVlW3NdID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHMgPSBjb2xvckZpZWxkc1tpXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YVtpXSA9IHZhbHVlW3NdIHx8IDA7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGE7XG5cdFx0XHR9XG5cblx0XHRcdHZhbHVlID0gcGFyc2VGbG9hdCh2YWx1ZSkgfHwgMDtcblx0XHRcdGZvciAoaSA9IDA7IGkgPCBuOyBpKyspIHtcblx0XHRcdFx0YVtpXSA9IHZhbHVlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gYTtcblx0XHR9LFxuXHRcdCdib29sZWFuJzogZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHZhbHVlICYmIHZhbHVlLnRvTG93ZXJDYXNlICYmIHZhbHVlLnRvTG93ZXJDYXNlKCkgPT09ICdmYWxzZScpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9LFxuXHRcdCdzdHJpbmcnOiBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHZhbHVlICE9PSAwICYmICF2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh2YWx1ZS50b1N0cmluZykge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWUudG9TdHJpbmcoKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIFN0cmluZyh2YWx1ZSk7XG5cdFx0fVxuXHRcdC8vdG9kbzogZGF0ZS90aW1lXG5cdH07XG5cblx0U2VyaW91c2x5LnByb3RvdHlwZS5lZmZlY3RzID0gU2VyaW91c2x5LmVmZmVjdHMgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIG5hbWUsXG5cdFx0XHRlZmZlY3QsXG5cdFx0XHRtYW5pZmVzdCxcblx0XHRcdGVmZmVjdHMgPSB7fSxcblx0XHRcdGlucHV0LFxuXHRcdFx0aTtcblxuXHRcdGZvciAobmFtZSBpbiBzZXJpb3VzRWZmZWN0cykge1xuXHRcdFx0aWYgKHNlcmlvdXNFZmZlY3RzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG5cdFx0XHRcdGVmZmVjdCA9IHNlcmlvdXNFZmZlY3RzW25hbWVdO1xuXHRcdFx0XHRtYW5pZmVzdCA9IHtcblx0XHRcdFx0XHR0aXRsZTogZWZmZWN0LnRpdGxlIHx8IG5hbWUsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGVmZmVjdC5kZXNjcmlwdGlvbiB8fCAnJyxcblx0XHRcdFx0XHRpbnB1dHM6IHt9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Zm9yIChpIGluIGVmZmVjdC5pbnB1dHMpIHtcblx0XHRcdFx0XHRpZiAoZWZmZWN0LmlucHV0cy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHRcdFx0XHRcdFx0aW5wdXQgPSBlZmZlY3QuaW5wdXRzW2ldO1xuXHRcdFx0XHRcdFx0bWFuaWZlc3QuaW5wdXRzW2ldID0ge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiBpbnB1dC50eXBlLFxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0VmFsdWU6IGlucHV0LmRlZmF1bHRWYWx1ZSxcblx0XHRcdFx0XHRcdFx0c3RlcDogaW5wdXQuc3RlcCxcblx0XHRcdFx0XHRcdFx0bWluOiBpbnB1dC5taW4sXG5cdFx0XHRcdFx0XHRcdG1heDogaW5wdXQubWF4LFxuXHRcdFx0XHRcdFx0XHRtaW5Db3VudDogaW5wdXQubWluQ291bnQsXG5cdFx0XHRcdFx0XHRcdG1heENvdW50OiBpbnB1dC5tYXhDb3VudCxcblx0XHRcdFx0XHRcdFx0ZGltZW5zaW9uczogaW5wdXQuZGltZW5zaW9ucyxcblx0XHRcdFx0XHRcdFx0dGl0bGU6IGlucHV0LnRpdGxlIHx8IGksXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBpbnB1dC5kZXNjcmlwdGlvbiB8fCAnJyxcblx0XHRcdFx0XHRcdFx0b3B0aW9uczogaW5wdXQub3B0aW9ucyB8fCBbXVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlZmZlY3RzW25hbWVdID0gbWFuaWZlc3Q7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVmZmVjdHM7XG5cdH07XG5cblx0aWYgKHdpbmRvdy5GbG9hdDMyQXJyYXkpIHtcblx0XHRpZGVudGl0eSA9IG5ldyBGbG9hdDMyQXJyYXkoW1xuXHRcdFx0MSwgMCwgMCwgMCxcblx0XHRcdDAsIDEsIDAsIDAsXG5cdFx0XHQwLCAwLCAxLCAwLFxuXHRcdFx0MCwgMCwgMCwgMVxuXHRcdF0pO1xuXHR9XG5cblx0Ly9jaGVjayBmb3IgcGx1Z2lucyBsb2FkZWQgb3V0IG9mIG9yZGVyXG5cdGlmICh3aW5kb3cuU2VyaW91c2x5KSB7XG5cdFx0aWYgKHR5cGVvZiB3aW5kb3cuU2VyaW91c2x5ID09PSAnb2JqZWN0Jykge1xuXHRcdFx0KGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dmFyIGk7XG5cdFx0XHRcdGZvciAoaSBpbiB3aW5kb3cuU2VyaW91c2x5KSB7XG5cdFx0XHRcdFx0aWYgKHdpbmRvdy5TZXJpb3VzbHkuaGFzT3duUHJvcGVydHkoaSkgJiZcblx0XHRcdFx0XHRcdGkgIT09ICdwbHVnaW4nICYmXG5cdFx0XHRcdFx0XHR0eXBlb2Ygd2luZG93LlNlcmlvdXNseVtpXSA9PT0gJ29iamVjdCcpIHtcblxuXHRcdFx0XHRcdFx0U2VyaW91c2x5LnBsdWdpbihpLCB3aW5kb3cuU2VyaW91c2x5W2ldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0oKSk7XG5cdFx0fVxuXHR9XG5cblx0Ly9leHBvc2UgU2VyaW91c2x5IHRvIHRoZSBnbG9iYWwgb2JqZWN0XG5cdFNlcmlvdXNseS51dGlsID0ge1xuXHRcdG1hdDQ6IG1hdDQsXG5cdFx0Y2hlY2tTb3VyY2U6IGNoZWNrU291cmNlLFxuXHRcdGhzbFRvUmdiOiBoc2xUb1JnYixcblx0XHRjb2xvcnM6IGNvbG9yTmFtZXMsXG5cdFx0c2V0VGltZW91dFplcm86IHNldFRpbWVvdXRaZXJvLFxuXHRcdFNoYWRlclByb2dyYW06IFNoYWRlclByb2dyYW0sXG5cdFx0RnJhbWVCdWZmZXI6IEZyYW1lQnVmZmVyLFxuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZTogcmVxdWVzdEFuaW1hdGlvbkZyYW1lLFxuXHRcdHNoYWRlcjoge1xuXHRcdFx0bWFrZU5vaXNlOiAnZmxvYXQgbWFrZU5vaXNlKGZsb2F0IHUsIGZsb2F0IHYsIGZsb2F0IHRpbWVyKSB7XFxuJyArXG5cdFx0XHRcdFx0XHQnXHRmbG9hdCB4ID0gdSAqIHYgKiBtb2QodGltZXIgKiAxMDAwLjAsIDEwMC4wKTtcXG4nICtcblx0XHRcdFx0XHRcdCdcdHggPSBtb2QoeCwgMTMuMCkgKiBtb2QoeCwgMTI3LjApO1xcbicgK1xuXHRcdFx0XHRcdFx0J1x0ZmxvYXQgZHggPSBtb2QoeCwgMC4wMSk7XFxuJyArXG5cdFx0XHRcdFx0XHQnXHRyZXR1cm4gY2xhbXAoMC4xICsgZHggKiAxMDAuMCwgMC4wLCAxLjApO1xcbicgK1xuXHRcdFx0XHRcdFx0J31cXG4nLFxuXHRcdFx0cmFuZG9tOiAnI2lmbmRlZiBSQU5ET01cXG4nICtcblx0XHRcdFx0JyNkZWZpbmUgUkFORE9NXFxuJyArXG5cdFx0XHRcdCdmbG9hdCByYW5kb20odmVjMiBuKSB7XFxuJyArXG5cdFx0XHRcdCdcdHJldHVybiAwLjUgKyAwLjUgKiBmcmFjdChzaW4oZG90KG4ueHksIHZlYzIoMTIuOTg5OCwgNzguMjMzKSkpKiA0Mzc1OC41NDUzKTtcXG4nICtcblx0XHRcdFx0J31cXG4nICtcblx0XHRcdFx0JyNlbmRpZlxcbidcblx0XHR9XG5cdH07XG5cblx0Lypcblx0RGVmYXVsdCB0cmFuc2Zvcm0gLSAyRFxuXHRBZmZpbmUgdHJhbnNmb3Jtc1xuXHQtIHRyYW5zbGF0ZVxuXHQtIHJvdGF0ZSAoZGVncmVlcylcblx0LSBzY2FsZVxuXHQtIHNrZXdcblxuXHR0b2RvOiBtb3ZlIHRoaXMgdG8gYSBkaWZmZXJlbnQgZmlsZSB3aGVuIHdlIGhhdmUgYSBidWlsZCB0b29sXG5cdCovXG5cdFNlcmlvdXNseS50cmFuc2Zvcm0oJzJkJywgZnVuY3Rpb24gKG9wdGlvbnMpIHtcblx0XHR2YXIgbWUgPSB0aGlzLFxuXHRcdFx0ZGVncmVlcyA9ICEob3B0aW9ucyAmJiBvcHRpb25zLnJhZGlhbnMpLFxuXG5cdFx0XHRjZW50ZXJYID0gMCxcblx0XHRcdGNlbnRlclkgPSAwLFxuXHRcdFx0c2NhbGVYID0gMSxcblx0XHRcdHNjYWxlWSA9IDEsXG5cdFx0XHR0cmFuc2xhdGVYID0gMCxcblx0XHRcdHRyYW5zbGF0ZVkgPSAwLFxuXHRcdFx0cm90YXRpb24gPSAwLFxuXHRcdFx0c2tld1ggPSAwLFxuXHRcdFx0c2tld1kgPSAwO1xuXG5cdFx0Ly90b2RvOiBza2V3IG9yZGVyXG5cdFx0Ly90b2RvOiBpbnZlcnQ/XG5cblx0XHRmdW5jdGlvbiByZWNvbXB1dGUoKSB7XG5cdFx0XHR2YXIgbWF0cml4ID0gbWUubWF0cml4LFxuXHRcdFx0XHRhbmdsZSxcblx0XHRcdFx0cywgYyxcblx0XHRcdFx0bTAwLFxuXHRcdFx0XHRtMDEsXG5cdFx0XHRcdG0wMixcblx0XHRcdFx0bTAzLFxuXHRcdFx0XHRtMTAsXG5cdFx0XHRcdG0xMSxcblx0XHRcdFx0bTEyLFxuXHRcdFx0XHRtMTM7XG5cblx0XHRcdGZ1bmN0aW9uIHRyYW5zbGF0ZSh4LCB5KSB7XG5cdFx0XHRcdG1hdHJpeFsxMl0gPSBtYXRyaXhbMF0gKiB4ICsgbWF0cml4WzRdICogeSArIG1hdHJpeFsxMl07XG5cdFx0XHRcdG1hdHJpeFsxM10gPSBtYXRyaXhbMV0gKiB4ICsgbWF0cml4WzVdICogeSArIG1hdHJpeFsxM107XG5cdFx0XHRcdG1hdHJpeFsxNF0gPSBtYXRyaXhbMl0gKiB4ICsgbWF0cml4WzZdICogeSArIG1hdHJpeFsxNF07XG5cdFx0XHRcdG1hdHJpeFsxNV0gPSBtYXRyaXhbM10gKiB4ICsgbWF0cml4WzddICogeSArIG1hdHJpeFsxNV07XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdHJhbnNsYXRlWCAmJlxuXHRcdFx0XHRcdCF0cmFuc2xhdGVZICYmXG5cdFx0XHRcdFx0IXJvdGF0aW9uICYmXG5cdFx0XHRcdFx0IXNrZXdYICYmXG5cdFx0XHRcdFx0IXNrZXdZICYmXG5cdFx0XHRcdFx0c2NhbGVYID09PSAxICYmXG5cdFx0XHRcdFx0c2NhbGVZID09PSAxXG5cdFx0XHRcdFx0KSB7XG5cdFx0XHRcdG1lLnRyYW5zZm9ybWVkID0gZmFsc2U7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly9jYWxjdWxhdGUgdHJhbnNmb3JtYXRpb24gbWF0cml4XG5cdFx0XHRtYXQ0LmlkZW50aXR5KG1hdHJpeCk7XG5cblx0XHRcdHRyYW5zbGF0ZSh0cmFuc2xhdGVYICsgY2VudGVyWCwgdHJhbnNsYXRlWSArIGNlbnRlclkpO1xuXG5cdFx0XHQvL3NrZXdcblx0XHRcdGlmIChza2V3WCkge1xuXHRcdFx0XHRtYXRyaXhbNF0gPSBza2V3WCAvIG1lLndpZHRoO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHNrZXdZKSB7XG5cdFx0XHRcdG1hdHJpeFsxXSA9IHNrZXdZIC8gbWUuaGVpZ2h0O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocm90YXRpb24pIHtcblx0XHRcdFx0bTAwID0gbWF0cml4WzBdO1xuXHRcdFx0XHRtMDEgPSBtYXRyaXhbMV07XG5cdFx0XHRcdG0wMiA9IG1hdHJpeFsyXTtcblx0XHRcdFx0bTAzID0gbWF0cml4WzNdO1xuXHRcdFx0XHRtMTAgPSBtYXRyaXhbNF07XG5cdFx0XHRcdG0xMSA9IG1hdHJpeFs1XTtcblx0XHRcdFx0bTEyID0gbWF0cml4WzZdO1xuXHRcdFx0XHRtMTMgPSBtYXRyaXhbN107XG5cblx0XHRcdFx0Ly9yb3RhdGVcblx0XHRcdFx0YW5nbGUgPSAtKGRlZ3JlZXMgPyByb3RhdGlvbiAqIE1hdGguUEkgLyAxODAgOiByb3RhdGlvbik7XG5cdFx0XHRcdC8vLi4ucm90YXRlXG5cdFx0XHRcdHMgPSBNYXRoLnNpbihhbmdsZSk7XG5cdFx0XHRcdGMgPSBNYXRoLmNvcyhhbmdsZSk7XG5cdFx0XHRcdG1hdHJpeFswXSA9IG0wMCAqIGMgKyBtMTAgKiBzO1xuXHRcdFx0XHRtYXRyaXhbMV0gPSBtMDEgKiBjICsgbTExICogcztcblx0XHRcdFx0bWF0cml4WzJdID0gbTAyICogYyArIG0xMiAqIHM7XG5cdFx0XHRcdG1hdHJpeFszXSA9IG0wMyAqIGMgKyBtMTMgKiBzO1xuXHRcdFx0XHRtYXRyaXhbNF0gPSBtMTAgKiBjIC0gbTAwICogcztcblx0XHRcdFx0bWF0cml4WzVdID0gbTExICogYyAtIG0wMSAqIHM7XG5cdFx0XHRcdG1hdHJpeFs2XSA9IG0xMiAqIGMgLSBtMDIgKiBzO1xuXHRcdFx0XHRtYXRyaXhbN10gPSBtMTMgKiBjIC0gbTAzICogcztcblx0XHRcdH1cblxuXHRcdFx0Ly9zY2FsZVxuXHRcdFx0aWYgKHNjYWxlWCAhPT0gMSkge1xuXHRcdFx0XHRtYXRyaXhbMF0gKj0gc2NhbGVYO1xuXHRcdFx0XHRtYXRyaXhbMV0gKj0gc2NhbGVYO1xuXHRcdFx0XHRtYXRyaXhbMl0gKj0gc2NhbGVYO1xuXHRcdFx0XHRtYXRyaXhbM10gKj0gc2NhbGVYO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHNjYWxlWSAhPT0gMSkge1xuXHRcdFx0XHRtYXRyaXhbNF0gKj0gc2NhbGVZO1xuXHRcdFx0XHRtYXRyaXhbNV0gKj0gc2NhbGVZO1xuXHRcdFx0XHRtYXRyaXhbNl0gKj0gc2NhbGVZO1xuXHRcdFx0XHRtYXRyaXhbN10gKj0gc2NhbGVZO1xuXHRcdFx0fVxuXG5cdFx0XHR0cmFuc2xhdGUoLWNlbnRlclgsIC1jZW50ZXJZKTtcblxuXHRcdFx0bWUudHJhbnNmb3JtZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRpbnB1dHM6IHtcblx0XHRcdFx0cmVzZXQ6IHtcblx0XHRcdFx0XHRtZXRob2Q6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdGNlbnRlclggPSAwO1xuXHRcdFx0XHRcdFx0Y2VudGVyWSA9IDA7XG5cdFx0XHRcdFx0XHRzY2FsZVggPSAxO1xuXHRcdFx0XHRcdFx0c2NhbGVZID0gMTtcblx0XHRcdFx0XHRcdHRyYW5zbGF0ZVggPSAwO1xuXHRcdFx0XHRcdFx0dHJhbnNsYXRlWSA9IDA7XG5cdFx0XHRcdFx0XHRyb3RhdGlvbiA9IDA7XG5cdFx0XHRcdFx0XHRza2V3WCA9IDA7XG5cdFx0XHRcdFx0XHRza2V3WSA9IDA7XG5cblx0XHRcdFx0XHRcdGlmIChtZS50cmFuc2Zvcm1lZCkge1xuXHRcdFx0XHRcdFx0XHRtZS50cmFuc2Zvcm1lZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0dHJhbnNsYXRlOiB7XG5cdFx0XHRcdFx0bWV0aG9kOiBmdW5jdGlvbiAoeCwgeSkge1xuXHRcdFx0XHRcdFx0aWYgKGlzTmFOKHgpKSB7XG5cdFx0XHRcdFx0XHRcdHggPSB0cmFuc2xhdGVYO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAoaXNOYU4oeSkpIHtcblx0XHRcdFx0XHRcdFx0eSA9IHRyYW5zbGF0ZVk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmICh4ID09PSB0cmFuc2xhdGVYICYmIHkgPT09IHRyYW5zbGF0ZVkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR0cmFuc2xhdGVYID0geDtcblx0XHRcdFx0XHRcdHRyYW5zbGF0ZVkgPSB5O1xuXG5cdFx0XHRcdFx0XHRyZWNvbXB1dGUoKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dHlwZTogW1xuXHRcdFx0XHRcdFx0J251bWJlcicsXG5cdFx0XHRcdFx0XHQnbnVtYmVyJ1xuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0dHJhbnNsYXRlWDoge1xuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRyYW5zbGF0ZVg7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzZXQ6IGZ1bmN0aW9uICh4KSB7XG5cdFx0XHRcdFx0XHRpZiAoeCA9PT0gdHJhbnNsYXRlWCkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHRyYW5zbGF0ZVggPSB4O1xuXG5cdFx0XHRcdFx0XHRyZWNvbXB1dGUoKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dHlwZTogJ251bWJlcidcblx0XHRcdFx0fSxcblx0XHRcdFx0dHJhbnNsYXRlWToge1xuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRyYW5zbGF0ZVk7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzZXQ6IGZ1bmN0aW9uICh5KSB7XG5cdFx0XHRcdFx0XHRpZiAoeSA9PT0gdHJhbnNsYXRlWSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHRyYW5zbGF0ZVkgPSB5O1xuXG5cdFx0XHRcdFx0XHRyZWNvbXB1dGUoKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dHlwZTogJ251bWJlcidcblx0XHRcdFx0fSxcblx0XHRcdFx0cm90YXRpb246IHtcblx0XHRcdFx0XHRnZXQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJldHVybiByb3RhdGlvbjtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHNldDogZnVuY3Rpb24gKGFuZ2xlKSB7XG5cdFx0XHRcdFx0XHRpZiAoYW5nbGUgPT09IHJvdGF0aW9uKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly90b2RvOiBmbW9kIDM2MGRlZyBvciBNYXRoLlBJICogMiByYWRpYW5zXG5cdFx0XHRcdFx0XHRyb3RhdGlvbiA9IHBhcnNlRmxvYXQoYW5nbGUpO1xuXG5cdFx0XHRcdFx0XHRyZWNvbXB1dGUoKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dHlwZTogJ251bWJlcidcblx0XHRcdFx0fSxcblx0XHRcdFx0Y2VudGVyOiB7XG5cdFx0XHRcdFx0bWV0aG9kOiBmdW5jdGlvbiAoeCwgeSkge1xuXHRcdFx0XHRcdFx0aWYgKGlzTmFOKHgpKSB7XG5cdFx0XHRcdFx0XHRcdHggPSBjZW50ZXJYO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAoaXNOYU4oeSkpIHtcblx0XHRcdFx0XHRcdFx0eSA9IGNlbnRlclk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmICh4ID09PSBjZW50ZXJYICYmIHkgPT09IGNlbnRlclkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjZW50ZXJYID0geDtcblx0XHRcdFx0XHRcdGNlbnRlclkgPSB5O1xuXG5cdFx0XHRcdFx0XHRyZWNvbXB1dGUoKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dHlwZTogW1xuXHRcdFx0XHRcdFx0J251bWJlcicsXG5cdFx0XHRcdFx0XHQnbnVtYmVyJ1xuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0Y2VudGVyWDoge1xuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGNlbnRlclg7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzZXQ6IGZ1bmN0aW9uICh4KSB7XG5cdFx0XHRcdFx0XHRpZiAoeCA9PT0gY2VudGVyWCkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGNlbnRlclggPSB4O1xuXG5cdFx0XHRcdFx0XHRyZWNvbXB1dGUoKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dHlwZTogJ251bWJlcidcblx0XHRcdFx0fSxcblx0XHRcdFx0Y2VudGVyWToge1xuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGNlbnRlclk7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzZXQ6IGZ1bmN0aW9uICh5KSB7XG5cdFx0XHRcdFx0XHRpZiAoeSA9PT0gY2VudGVyWSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGNlbnRlclkgPSB5O1xuXG5cdFx0XHRcdFx0XHRyZWNvbXB1dGUoKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dHlwZTogJ251bWJlcidcblx0XHRcdFx0fSxcblx0XHRcdFx0c2tldzoge1xuXHRcdFx0XHRcdG1ldGhvZDogZnVuY3Rpb24gKHgsIHkpIHtcblx0XHRcdFx0XHRcdGlmIChpc05hTih4KSkge1xuXHRcdFx0XHRcdFx0XHR4ID0gc2tld1g7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmIChpc05hTih5KSkge1xuXHRcdFx0XHRcdFx0XHR5ID0gc2tld1k7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmICh4ID09PSBza2V3WCAmJiB5ID09PSBza2V3WSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHNrZXdYID0geDtcblx0XHRcdFx0XHRcdHNrZXdZID0geTtcblxuXHRcdFx0XHRcdFx0cmVjb21wdXRlKCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHR5cGU6IFtcblx0XHRcdFx0XHRcdCdudW1iZXInLFxuXHRcdFx0XHRcdFx0J251bWJlcidcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNrZXdYOiB7XG5cdFx0XHRcdFx0Z2V0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gc2tld1g7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzZXQ6IGZ1bmN0aW9uICh4KSB7XG5cdFx0XHRcdFx0XHRpZiAoeCA9PT0gc2tld1gpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRza2V3WCA9IHg7XG5cblx0XHRcdFx0XHRcdHJlY29tcHV0ZSgpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRza2V3WToge1xuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHNrZXdZO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c2V0OiBmdW5jdGlvbiAoeSkge1xuXHRcdFx0XHRcdFx0aWYgKHkgPT09IHNrZXdZKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0c2tld1kgPSB5O1xuXG5cdFx0XHRcdFx0XHRyZWNvbXB1dGUoKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dHlwZTogJ251bWJlcidcblx0XHRcdFx0fSxcblx0XHRcdFx0c2NhbGU6IHtcblx0XHRcdFx0XHRtZXRob2Q6IGZ1bmN0aW9uICh4LCB5KSB7XG5cdFx0XHRcdFx0XHR2YXIgbmV3WCwgbmV3WTtcblxuXHRcdFx0XHRcdFx0aWYgKGlzTmFOKHgpKSB7XG5cdFx0XHRcdFx0XHRcdG5ld1ggPSBzY2FsZVg7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRuZXdYID0geDtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Lypcblx0XHRcdFx0XHRcdGlmIG9ubHkgb25lIHZhbHVlIGlzIHNwZWNpZmllZCwgc2V0IGJvdGggeCBhbmQgeSB0byB0aGUgc2FtZSBzY2FsZVxuXHRcdFx0XHRcdFx0Ki9cblx0XHRcdFx0XHRcdGlmIChpc05hTih5KSkge1xuXHRcdFx0XHRcdFx0XHRpZiAoaXNOYU4oeCkpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRuZXdZID0gbmV3WDtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdG5ld1kgPSB5O1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAobmV3WCA9PT0gc2NhbGVYICYmIG5ld1kgPT09IHNjYWxlWSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHNjYWxlWCA9IG5ld1g7XG5cdFx0XHRcdFx0XHRzY2FsZVkgPSBuZXdZO1xuXG5cdFx0XHRcdFx0XHRyZWNvbXB1dGUoKTtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dHlwZTogW1xuXHRcdFx0XHRcdFx0J251bWJlcicsXG5cdFx0XHRcdFx0XHQnbnVtYmVyJ1xuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0c2NhbGVYOiB7XG5cdFx0XHRcdFx0Z2V0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gc2NhbGVYO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c2V0OiBmdW5jdGlvbiAoeCkge1xuXHRcdFx0XHRcdFx0aWYgKHggPT09IHNjYWxlWCkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHNjYWxlWCA9IHg7XG5cblx0XHRcdFx0XHRcdHJlY29tcHV0ZSgpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzY2FsZVk6IHtcblx0XHRcdFx0XHRnZXQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJldHVybiBzY2FsZVk7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzZXQ6IGZ1bmN0aW9uICh5KSB7XG5cdFx0XHRcdFx0XHRpZiAoeSA9PT0gc2NhbGVZKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0c2NhbGVZID0geTtcblxuXHRcdFx0XHRcdFx0cmVjb21wdXRlKCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHR5cGU6ICdudW1iZXInXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9LCB7XG5cdFx0dGl0bGU6ICcyRCBUcmFuc2Zvcm0nLFxuXHRcdGRlc2NyaXB0aW9uOiAnVHJhbnNsYXRlLCBSb3RhdGUsIFNjYWxlLCBTa2V3J1xuXHR9KTtcblxuXHQvKlxuXHR0b2RvOiBtb3ZlIHRoaXMgdG8gYSBkaWZmZXJlbnQgZmlsZSB3aGVuIHdlIGhhdmUgYSBidWlsZCB0b29sXG5cdCovXG5cdFNlcmlvdXNseS50cmFuc2Zvcm0oJ2ZsaXAnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIG1lID0gdGhpcyxcblx0XHRcdGhvcml6b250YWwgPSB0cnVlO1xuXG5cdFx0ZnVuY3Rpb24gcmVjb21wdXRlKCkge1xuXHRcdFx0dmFyIG1hdHJpeCA9IG1lLm1hdHJpeDtcblxuXHRcdFx0Ly9jYWxjdWxhdGUgdHJhbnNmb3JtYXRpb24gbWF0cml4XG5cdFx0XHQvL21hdDQuaWRlbnRpdHkobWF0cml4KTtcblxuXHRcdFx0Ly9zY2FsZVxuXHRcdFx0aWYgKGhvcml6b250YWwpIHtcblx0XHRcdFx0bWF0cml4WzBdID0gLTE7XG5cdFx0XHRcdG1hdHJpeFs1XSA9IDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtYXRyaXhbMF0gPSAxO1xuXHRcdFx0XHRtYXRyaXhbNV0gPSAtMTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRtYXQ0LmlkZW50aXR5KG1lLm1hdHJpeCk7XG5cdFx0cmVjb21wdXRlKCk7XG5cblx0XHRtZS50cmFuc2Zvcm1EaXJ0eSA9IHRydWU7XG5cblx0XHRtZS50cmFuc2Zvcm1lZCA9IHRydWU7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5wdXRzOiB7XG5cdFx0XHRcdGRpcmVjdGlvbjoge1xuXHRcdFx0XHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGhvcml6b250YWwgPyAnaG9yaXpvbnRhbCcgOiAndmVydGljYWwnO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c2V0OiBmdW5jdGlvbiAoZCkge1xuXHRcdFx0XHRcdFx0dmFyIGhvcml6O1xuXHRcdFx0XHRcdFx0aWYgKGQgPT09ICd2ZXJ0aWNhbCcpIHtcblx0XHRcdFx0XHRcdFx0aG9yaXogPSBmYWxzZTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGhvcml6ID0gdHJ1ZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKGhvcml6ID09PSBob3Jpem9udGFsKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aG9yaXpvbnRhbCA9IGhvcml6O1xuXHRcdFx0XHRcdFx0cmVjb21wdXRlKCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9LCB7XG5cdFx0dGl0bGU6ICdGbGlwJyxcblx0XHRkZXNjcmlwdGlvbjogJ0ZsaXAgSG9yaXpvbnRhbC9WZXJ0aWNhbCdcblx0fSk7XG5cblx0Lypcblx0UmVmb3JtYXRcblx0dG9kbzogbW92ZSB0aGlzIHRvIGEgZGlmZmVyZW50IGZpbGUgd2hlbiB3ZSBoYXZlIGEgYnVpbGQgdG9vbFxuXHQqL1xuXHRTZXJpb3VzbHkudHJhbnNmb3JtKCdyZWZvcm1hdCcsIGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgbWUgPSB0aGlzLFxuXHRcdFx0Zm9yY2VXaWR0aCxcblx0XHRcdGZvcmNlSGVpZ2h0LFxuXHRcdFx0bW9kZSA9ICdjb250YWluJztcblxuXHRcdGZ1bmN0aW9uIHJlY29tcHV0ZSgpIHtcblx0XHRcdHZhciBtYXRyaXggPSBtZS5tYXRyaXgsXG5cdFx0XHRcdHdpZHRoID0gZm9yY2VXaWR0aCB8fCBtZS53aWR0aCxcblx0XHRcdFx0aGVpZ2h0ID0gZm9yY2VIZWlnaHQgfHwgbWUuaGVpZ2h0LFxuXHRcdFx0XHRzY2FsZVgsXG5cdFx0XHRcdHNjYWxlWSxcblx0XHRcdFx0c291cmNlID0gbWUuc291cmNlLFxuXHRcdFx0XHRzb3VyY2VXaWR0aCA9IHNvdXJjZSAmJiBzb3VyY2Uud2lkdGggfHwgMSxcblx0XHRcdFx0c291cmNlSGVpZ2h0ID0gc291cmNlICYmIHNvdXJjZS5oZWlnaHQgfHwgMSxcblx0XHRcdFx0YXNwZWN0SW4sXG5cdFx0XHRcdGFzcGVjdE91dDtcblxuXHRcdFx0aWYgKG1vZGUgPT09ICdkaXN0b3J0JyB8fCB3aWR0aCA9PT0gc291cmNlV2lkdGggJiYgaGVpZ2h0ID09PSBzb3VyY2VIZWlnaHQpIHtcblx0XHRcdFx0bWUudHJhbnNmb3JtZWQgPSBmYWxzZTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3BlY3RJbiA9IHNvdXJjZVdpZHRoIC8gc291cmNlSGVpZ2h0O1xuXG5cdFx0XHRhc3BlY3RPdXQgPSB3aWR0aCAvIGhlaWdodDtcblxuXHRcdFx0aWYgKG1vZGUgPT09ICd3aWR0aCcgfHwgbW9kZSA9PT0gJ2NvbnRhaW4nICYmIGFzcGVjdE91dCA8PSBhc3BlY3RJbikge1xuXHRcdFx0XHRzY2FsZVggPSAxO1xuXHRcdFx0XHRzY2FsZVkgPSBhc3BlY3RPdXQgLyBhc3BlY3RJbjtcblx0XHRcdH0gZWxzZSBpZiAobW9kZSA9PT0gJ2hlaWdodCcgfHwgbW9kZSA9PT0gJ2NvbnRhaW4nICYmIGFzcGVjdE91dCA+IGFzcGVjdEluKSB7XG5cdFx0XHRcdHNjYWxlWCA9IGFzcGVjdEluIC8gYXNwZWN0T3V0O1xuXHRcdFx0XHRzY2FsZVkgPSAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly9tb2RlID09PSAnY292ZXInXG5cdFx0XHRcdGlmIChhc3BlY3RPdXQgPiBhc3BlY3RJbikge1xuXHRcdFx0XHRcdHNjYWxlWCA9IDE7XG5cdFx0XHRcdFx0c2NhbGVZID0gYXNwZWN0T3V0IC8gYXNwZWN0SW47XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2NhbGVYID0gYXNwZWN0SW4gLyBhc3BlY3RPdXQ7XG5cdFx0XHRcdFx0c2NhbGVZID0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc2NhbGVYID09PSAxICYmIHNjYWxlWSA9PT0gMSkge1xuXHRcdFx0XHRtZS50cmFuc2Zvcm1lZCA9IGZhbHNlO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vY2FsY3VsYXRlIHRyYW5zZm9ybWF0aW9uIG1hdHJpeFxuXHRcdFx0bWF0NC5pZGVudGl0eShtYXRyaXgpO1xuXG5cdFx0XHQvL3NjYWxlXG5cdFx0XHRpZiAoc2NhbGVYICE9PSAxKSB7XG5cdFx0XHRcdG1hdHJpeFswXSAqPSBzY2FsZVg7XG5cdFx0XHRcdG1hdHJpeFsxXSAqPSBzY2FsZVg7XG5cdFx0XHRcdG1hdHJpeFsyXSAqPSBzY2FsZVg7XG5cdFx0XHRcdG1hdHJpeFszXSAqPSBzY2FsZVg7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc2NhbGVZICE9PSAxKSB7XG5cdFx0XHRcdG1hdHJpeFs0XSAqPSBzY2FsZVk7XG5cdFx0XHRcdG1hdHJpeFs1XSAqPSBzY2FsZVk7XG5cdFx0XHRcdG1hdHJpeFs2XSAqPSBzY2FsZVk7XG5cdFx0XHRcdG1hdHJpeFs3XSAqPSBzY2FsZVk7XG5cdFx0XHR9XG5cdFx0XHRtZS50cmFuc2Zvcm1lZCA9IHRydWU7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0V2lkdGgoKSB7XG5cdFx0XHRyZXR1cm4gZm9yY2VXaWR0aCB8fCBtZS5zb3VyY2UgJiYgbWUuc291cmNlLndpZHRoIHx8IDE7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0SGVpZ2h0KCkge1xuXHRcdFx0cmV0dXJuIGZvcmNlSGVpZ2h0IHx8IG1lLnNvdXJjZSAmJiBtZS5zb3VyY2UuaGVpZ2h0IHx8IDE7XG5cdFx0fVxuXG5cdFx0dGhpcy5yZXNpemUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgd2lkdGggPSBnZXRXaWR0aCgpLFxuXHRcdFx0XHRoZWlnaHQgPSBnZXRIZWlnaHQoKSxcblx0XHRcdFx0aTtcblxuXHRcdFx0aWYgKHRoaXMud2lkdGggIT09IHdpZHRoIHx8IHRoaXMuaGVpZ2h0ICE9PSBoZWlnaHQpIHtcblx0XHRcdFx0dGhpcy53aWR0aCA9IHdpZHRoO1xuXHRcdFx0XHR0aGlzLmhlaWdodCA9IGhlaWdodDtcblxuXHRcdFx0XHRpZiAodGhpcy51bmlmb3JtcyAmJiB0aGlzLnVuaWZvcm1zLnJlc29sdXRpb24pIHtcblx0XHRcdFx0XHR0aGlzLnVuaWZvcm1zLnJlc29sdXRpb25bMF0gPSB3aWR0aDtcblx0XHRcdFx0XHR0aGlzLnVuaWZvcm1zLnJlc29sdXRpb25bMV0gPSBoZWlnaHQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5mcmFtZUJ1ZmZlciAmJiB0aGlzLmZyYW1lQnVmZmVyLnJlc2l6ZSkge1xuXHRcdFx0XHRcdHRoaXMuZnJhbWVCdWZmZXIucmVzaXplKHdpZHRoLCBoZWlnaHQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IHRoaXMudGFyZ2V0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdHRoaXMudGFyZ2V0c1tpXS5yZXNpemUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnNldFRyYW5zZm9ybURpcnR5KCk7XG5cblx0XHRcdHJlY29tcHV0ZSgpO1xuXHRcdH07XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5wdXRzOiB7XG5cdFx0XHRcdHdpZHRoOiB7XG5cdFx0XHRcdFx0Z2V0OiBnZXRXaWR0aCxcblx0XHRcdFx0XHRzZXQ6IGZ1bmN0aW9uICh4KSB7XG5cdFx0XHRcdFx0XHR4ID0gTWF0aC5mbG9vcih4KTtcblx0XHRcdFx0XHRcdGlmICh4ID09PSBmb3JjZVdpZHRoKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Zm9yY2VXaWR0aCA9IHg7XG5cblx0XHRcdFx0XHRcdHRoaXMucmVzaXplKCk7XG5cblx0XHRcdFx0XHRcdC8vZG9uJ3QgbmVlZCB0byBydW4gc2V0VHJhbnNmb3JtRGlydHkgYWdhaW5cblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHR5cGU6ICdudW1iZXInXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGhlaWdodDoge1xuXHRcdFx0XHRcdGdldDogZ2V0SGVpZ2h0LFxuXHRcdFx0XHRcdHNldDogZnVuY3Rpb24gKHkpIHtcblx0XHRcdFx0XHRcdHkgPSBNYXRoLmZsb29yKHkpO1xuXHRcdFx0XHRcdFx0aWYgKHkgPT09IGZvcmNlSGVpZ2h0KSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Zm9yY2VIZWlnaHQgPSB5O1xuXG5cdFx0XHRcdFx0XHR0aGlzLnJlc2l6ZSgpO1xuXG5cdFx0XHRcdFx0XHQvL2Rvbid0IG5lZWQgdG8gcnVuIHNldFRyYW5zZm9ybURpcnR5IGFnYWluXG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR0eXBlOiAnbnVtYmVyJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRtb2RlOiB7XG5cdFx0XHRcdFx0Z2V0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbW9kZTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHNldDogZnVuY3Rpb24gKG0pIHtcblx0XHRcdFx0XHRcdGlmIChtID09PSBtb2RlKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0bW9kZSA9IG07XG5cblx0XHRcdFx0XHRcdHJlY29tcHV0ZSgpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR0eXBlOiAnZW51bScsXG5cdFx0XHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHRcdFx0J2NvdmVyJyxcblx0XHRcdFx0XHRcdCdjb250YWluJyxcblx0XHRcdFx0XHRcdCdkaXN0b3J0Jyxcblx0XHRcdFx0XHRcdCd3aWR0aCcsXG5cdFx0XHRcdFx0XHQnaGVpZ2h0J1xuXHRcdFx0XHRcdF1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH0sIHtcblx0XHR0aXRsZTogJ1JlZm9ybWF0Jyxcblx0XHRkZXNjcmlwdGlvbjogJ0NoYW5nZSBvdXRwdXQgZGltZW5zaW9ucydcblx0fSk7XG5cblx0Lypcblx0dG9kbzogYWRkaXRpb25hbCB0cmFuc2Zvcm0gbm9kZSB0eXBlc1xuXHQtIHBlcnNwZWN0aXZlXG5cdC0gbWF0cml4XG5cdC0gY3JvcD8gLSBtYXliZSBub3QgLSBwcm9iYWJseSB3b3VsZCBqdXN0IHNjYWxlLlxuXHQtIGNhbWVyYSBzaGFrZT9cblx0Ki9cblxuXHQvKlxuXHQgKiBzaW1wbGV4IG5vaXNlIHNoYWRlcnNcblx0ICogaHR0cHM6Ly9naXRodWIuY29tL2FzaGltYS93ZWJnbC1ub2lzZVxuXHQgKiBDb3B5cmlnaHQgKEMpIDIwMTEgYnkgQXNoaW1hIEFydHMgKFNpbXBsZXggbm9pc2UpXG5cdCAqIENvcHlyaWdodCAoQykgMjAxMSBieSBTdGVmYW4gR3VzdGF2c29uIChDbGFzc2ljIG5vaXNlKVxuXHQgKi9cblxuXHRTZXJpb3VzbHkudXRpbC5zaGFkZXIubm9pc2VIZWxwZXJzID0gJyNpZm5kZWYgTk9JU0VfSEVMUEVSU1xcbicgK1xuXHRcdCcjZGVmaW5lIE5PSVNFX0hFTFBFUlNcXG4nICtcblx0XHQndmVjMiBtb2QyODkodmVjMiB4KSB7XFxuJyArXG5cdFx0J1x0cmV0dXJuIHggLSBmbG9vcih4ICogKDEuMCAvIDI4OS4wKSkgKiAyODkuMDtcXG4nICtcblx0XHQnfVxcbicgK1xuXHRcdCd2ZWMzIG1vZDI4OSh2ZWMzIHgpIHtcXG4nICtcblx0XHQnXHRyZXR1cm4geCAtIGZsb29yKHggKiAoMS4wIC8gMjg5LjApKSAqIDI4OS4wO1xcbicgK1xuXHRcdCd9XFxuJyArXG5cdFx0J3ZlYzQgbW9kMjg5KHZlYzQgeCkge1xcbicgK1xuXHRcdCdcdHJldHVybiB4IC0gZmxvb3IoeCAqICgxLjAgLyAyODkuMCkpICogMjg5LjA7XFxuJyArXG5cdFx0J31cXG4nICtcblx0XHQndmVjMyBwZXJtdXRlKHZlYzMgeCkge1xcbicgK1xuXHRcdCdcdHJldHVybiBtb2QyODkoKCh4KjM0LjApKzEuMCkqeCk7XFxuJyArXG5cdFx0J31cXG4nICtcblx0XHQndmVjNCBwZXJtdXRlKHZlYzQgeCkge1xcbicgK1xuXHRcdCdcdHJldHVybiBtb2QyODkoKCh4KjM0LjApKzEuMCkqeCk7XFxuJyArXG5cdFx0J31cXG4nICtcblx0XHQndmVjNCB0YXlsb3JJbnZTcXJ0KHZlYzQgcikge1xcbicgK1xuXHRcdCdcdHJldHVybiAxLjc5Mjg0MjkxNDAwMTU5IC0gMC44NTM3MzQ3MjA5NTMxNCAqIHI7XFxuJyArXG5cdFx0J31cXG4nICtcblx0XHQnZmxvYXQgdGF5bG9ySW52U3FydChmbG9hdCByKSB7XFxuJyArXG5cdFx0J1x0cmV0dXJuIDEuNzkyODQyOTE0MDAxNTkgLSAwLjg1MzczNDcyMDk1MzE0ICogcjtcXG4nICtcblx0XHQnfVxcbicgK1xuXHRcdCcjZW5kaWZcXG4nO1xuXG5cdFNlcmlvdXNseS51dGlsLnNoYWRlci5zbm9pc2UyZCA9ICcjaWZuZGVmIE5PSVNFMkRcXG4nICtcblx0XHQnI2RlZmluZSBOT0lTRTJEXFxuJyArXG5cdFx0J2Zsb2F0IHNub2lzZSh2ZWMyIHYpIHtcXG4nICtcblx0XHQnXHRjb25zdCB2ZWM0IEMgPSB2ZWM0KDAuMjExMzI0ODY1NDA1MTg3LCAvLyAoMy4wLXNxcnQoMy4wKSkvNi4wXFxuJyArXG5cdFx0J1x0XHQwLjM2NjAyNTQwMzc4NDQzOSwgLy8gMC41KihzcXJ0KDMuMCktMS4wKVxcbicgK1xuXHRcdCdcdFx0LTAuNTc3MzUwMjY5MTg5NjI2LCAvLyAtMS4wICsgMi4wICogQy54XFxuJyArXG5cdFx0J1x0XHQwLjAyNDM5MDI0MzkwMjQzOSk7IC8vIDEuMCAvIDQxLjBcXG4nICtcblx0XHQnXHR2ZWMyIGkgPSBmbG9vcih2ICsgZG90KHYsIEMueXkpKTtcXG4nICtcblx0XHQnXHR2ZWMyIHgwID0gdiAtIGkgKyBkb3QoaSwgQy54eCk7XFxuJyArXG5cdFx0J1x0dmVjMiBpMTtcXG4nICtcblx0XHQnXHQvL2kxLnggPSBzdGVwKHgwLnksIHgwLngpOyAvLyB4MC54ID4geDAueSA/IDEuMCA6IDAuMFxcbicgK1xuXHRcdCdcdC8vaTEueSA9IDEuMCAtIGkxLng7XFxuJyArXG5cdFx0J1x0aTEgPSAoeDAueCA+IHgwLnkpID8gdmVjMigxLjAsIDAuMCkgOiB2ZWMyKDAuMCwgMS4wKTtcXG4nICtcblx0XHQnXHQvLyB4MCA9IHgwIC0gMC4wICsgMC4wICogQy54eCA7XFxuJyArXG5cdFx0J1x0Ly8geDEgPSB4MCAtIGkxICsgMS4wICogQy54eCA7XFxuJyArXG5cdFx0J1x0Ly8geDIgPSB4MCAtIDEuMCArIDIuMCAqIEMueHggO1xcbicgK1xuXHRcdCdcdHZlYzQgeDEyID0geDAueHl4eSArIEMueHh6ejtcXG4nICtcblx0XHQnXHR4MTIueHkgLT0gaTE7XFxuJyArXG5cdFx0J1x0aSA9IG1vZDI4OShpKTsgLy8gQXZvaWQgdHJ1bmNhdGlvbiBlZmZlY3RzIGluIHBlcm11dGF0aW9uXFxuJyArXG5cdFx0J1x0dmVjMyBwID0gcGVybXV0ZShwZXJtdXRlKGkueSArIHZlYzMoMC4wLCBpMS55LCAxLjApKSArIGkueCArIHZlYzMoMC4wLCBpMS54LCAxLjApKTtcXG4nICtcblx0XHQnXHR2ZWMzIG0gPSBtYXgoMC41IC0gdmVjMyhkb3QoeDAsIHgwKSwgZG90KHgxMi54eSwgeDEyLnh5KSwgZG90KHgxMi56dywgeDEyLnp3KSksIDAuMCk7XFxuJyArXG5cdFx0J1x0bSA9IG0qbSA7XFxuJyArXG5cdFx0J1x0bSA9IG0qbSA7XFxuJyArXG5cdFx0J1x0dmVjMyB4ID0gMi4wICogZnJhY3QocCAqIEMud3d3KSAtIDEuMDtcXG4nICtcblx0XHQnXHR2ZWMzIGggPSBhYnMoeCkgLSAwLjU7XFxuJyArXG5cdFx0J1x0dmVjMyBveCA9IGZsb29yKHggKyAwLjUpO1xcbicgK1xuXHRcdCdcdHZlYzMgYTAgPSB4IC0gb3g7XFxuJyArXG5cdFx0J1x0bSAqPSAxLjc5Mjg0MjkxNDAwMTU5IC0gMC44NTM3MzQ3MjA5NTMxNCAqIChhMCphMCArIGgqaCk7XFxuJyArXG5cdFx0J1x0dmVjMyBnO1xcbicgK1xuXHRcdCdcdGcueCA9IGEwLnggKiB4MC54ICsgaC54ICogeDAueTtcXG4nICtcblx0XHQnXHRnLnl6ID0gYTAueXogKiB4MTIueHogKyBoLnl6ICogeDEyLnl3O1xcbicgK1xuXHRcdCdcdHJldHVybiAxMzAuMCAqIGRvdChtLCBnKTtcXG4nICtcblx0XHQnfVxcbicgK1xuXHRcdCcjZW5kaWZcXG4nO1xuXG5cdFNlcmlvdXNseS51dGlsLnNoYWRlci5zbm9pc2UzZCA9ICcjaWZuZGVmIE5PSVNFM0RcXG4nICtcblx0XHQnI2RlZmluZSBOT0lTRTNEXFxuJyArXG5cdFx0J2Zsb2F0IHNub2lzZSh2ZWMzIHYpIHtcXG4nICtcblx0XHQnXHRjb25zdCB2ZWMyIEMgPSB2ZWMyKDEuMC82LjAsIDEuMC8zLjApIDtcXG4nICtcblx0XHQnXHRjb25zdCB2ZWM0IEQgPSB2ZWM0KDAuMCwgMC41LCAxLjAsIDIuMCk7XFxuJyArXG5cblx0XHQvLyBGaXJzdCBjb3JuZXJcblx0XHQnXHR2ZWMzIGkgPSBmbG9vcih2ICsgZG90KHYsIEMueXl5KSk7XFxuJyArXG5cdFx0J1x0dmVjMyB4MCA9IHYgLSBpICsgZG90KGksIEMueHh4KSA7XFxuJyArXG5cblx0XHQvLyBPdGhlciBjb3JuZXJzXG5cdFx0J1x0dmVjMyBnID0gc3RlcCh4MC55engsIHgwLnh5eik7XFxuJyArXG5cdFx0J1x0dmVjMyBsID0gMS4wIC0gZztcXG4nICtcblx0XHQnXHR2ZWMzIGkxID0gbWluKGcueHl6LCBsLnp4eSk7XFxuJyArXG5cdFx0J1x0dmVjMyBpMiA9IG1heChnLnh5eiwgbC56eHkpO1xcbicgK1xuXG5cdFx0J1x0Ly8geDAgPSB4MCAtIDAuMCArIDAuMCAqIEMueHh4O1xcbicgK1xuXHRcdCdcdC8vIHgxID0geDAgLSBpMSArIDEuMCAqIEMueHh4O1xcbicgK1xuXHRcdCdcdC8vIHgyID0geDAgLSBpMiArIDIuMCAqIEMueHh4O1xcbicgK1xuXHRcdCdcdC8vIHgzID0geDAgLSAxLjAgKyAzLjAgKiBDLnh4eDtcXG4nICtcblx0XHQnXHR2ZWMzIHgxID0geDAgLSBpMSArIEMueHh4O1xcbicgK1xuXHRcdCdcdHZlYzMgeDIgPSB4MCAtIGkyICsgQy55eXk7IC8vIDIuMCpDLnggPSAxLzMgPSBDLnlcXG4nICtcblx0XHQnXHR2ZWMzIHgzID0geDAgLSBELnl5eTsgLy8gLTEuMCszLjAqQy54ID0gLTAuNSA9IC1ELnlcXG4nICtcblxuXHRcdC8vIFBlcm11dGF0aW9uc1xuXHRcdCdcdGkgPSBtb2QyODkoaSk7XFxuJyArXG5cdFx0J1x0dmVjNCBwID0gcGVybXV0ZShwZXJtdXRlKHBlcm11dGUoXFxuJyArXG5cdFx0J1x0XHRcdFx0XHRcdGkueiArIHZlYzQoMC4wLCBpMS56LCBpMi56LCAxLjApKVxcbicgK1xuXHRcdCdcdFx0XHRcdFx0XHQrIGkueSArIHZlYzQoMC4wLCBpMS55LCBpMi55LCAxLjApKVxcbicgK1xuXHRcdCdcdFx0XHRcdFx0XHQrIGkueCArIHZlYzQoMC4wLCBpMS54LCBpMi54LCAxLjApKTtcXG4nICtcblxuXHRcdC8vIEdyYWRpZW50czogN3g3IHBvaW50cyBvdmVyIGEgc3F1YXJlLCBtYXBwZWQgb250byBhbiBvY3RhaGVkcm9uLlxuXHRcdC8vIFRoZSByaW5nIHNpemUgMTcqMTcgPSAyODkgaXMgY2xvc2UgdG8gYSBtdWx0aXBsZSBvZiA0OSAoNDkqNiA9IDI5NClcblx0XHQnXHRmbG9hdCBuXyA9IDAuMTQyODU3MTQyODU3OyAvLyAxLjAvNy4wXFxuJyArXG5cdFx0J1x0dmVjMyBucyA9IG5fICogRC53eXogLSBELnh6eDtcXG4nICtcblxuXHRcdCdcdHZlYzQgaiA9IHAgLSA0OS4wICogZmxvb3IocCAqIG5zLnogKiBucy56KTsgLy8gbW9kKHAsIDcgKiA3KVxcbicgK1xuXG5cdFx0J1x0dmVjNCB4XyA9IGZsb29yKGogKiBucy56KTtcXG4nICtcblx0XHQnXHR2ZWM0IHlfID0gZmxvb3IoaiAtIDcuMCAqIHhfKTsgLy8gbW9kKGosIE4pXFxuJyArXG5cblx0XHQnXHR2ZWM0IHggPSB4XyAqIG5zLnggKyBucy55eXl5O1xcbicgK1xuXHRcdCdcdHZlYzQgeSA9IHlfICogbnMueCArIG5zLnl5eXk7XFxuJyArXG5cdFx0J1x0dmVjNCBoID0gMS4wIC0gYWJzKHgpIC0gYWJzKHkpO1xcbicgK1xuXG5cdFx0J1x0dmVjNCBiMCA9IHZlYzQoeC54eSwgeS54eSk7XFxuJyArXG5cdFx0J1x0dmVjNCBiMSA9IHZlYzQoeC56dywgeS56dyk7XFxuJyArXG5cblx0XHQnXHQvL3ZlYzQgczAgPSB2ZWM0KGxlc3NUaGFuKGIwLCAwLjApKSAqIDIuMCAtIDEuMDtcXG4nICtcblx0XHQnXHQvL3ZlYzQgczEgPSB2ZWM0KGxlc3NUaGFuKGIxLCAwLjApKSAqIDIuMCAtIDEuMDtcXG4nICtcblx0XHQnXHR2ZWM0IHMwID0gZmxvb3IoYjApICogMi4wICsgMS4wO1xcbicgK1xuXHRcdCdcdHZlYzQgczEgPSBmbG9vcihiMSkgKiAyLjAgKyAxLjA7XFxuJyArXG5cdFx0J1x0dmVjNCBzaCA9IC1zdGVwKGgsIHZlYzQoMC4wKSk7XFxuJyArXG5cblx0XHQnXHR2ZWM0IGEwID0gYjAueHp5dyArIHMwLnh6eXcgKiBzaC54eHl5IDtcXG4nICtcblx0XHQnXHR2ZWM0IGExID0gYjEueHp5dyArIHMxLnh6eXcgKiBzaC56end3IDtcXG4nICtcblxuXHRcdCdcdHZlYzMgcDAgPSB2ZWMzKGEwLnh5LCBoLngpO1xcbicgK1xuXHRcdCdcdHZlYzMgcDEgPSB2ZWMzKGEwLnp3LCBoLnkpO1xcbicgK1xuXHRcdCdcdHZlYzMgcDIgPSB2ZWMzKGExLnh5LCBoLnopO1xcbicgK1xuXHRcdCdcdHZlYzMgcDMgPSB2ZWMzKGExLnp3LCBoLncpO1xcbicgK1xuXG5cdFx0Ly9Ob3JtYWxpc2UgZ3JhZGllbnRzXG5cdFx0J1x0dmVjNCBub3JtID0gdGF5bG9ySW52U3FydCh2ZWM0KGRvdChwMCwgcDApLCBkb3QocDEsIHAxKSwgZG90KHAyLCBwMiksIGRvdChwMywgcDMpKSk7XFxuJyArXG5cdFx0J1x0cDAgKj0gbm9ybS54O1xcbicgK1xuXHRcdCdcdHAxICo9IG5vcm0ueTtcXG4nICtcblx0XHQnXHRwMiAqPSBub3JtLno7XFxuJyArXG5cdFx0J1x0cDMgKj0gbm9ybS53O1xcbicgK1xuXG5cdFx0Ly8gTWl4IGZpbmFsIG5vaXNlIHZhbHVlXG5cdFx0J1x0dmVjNCBtID0gbWF4KDAuNiAtIHZlYzQoZG90KHgwLCB4MCksIGRvdCh4MSwgeDEpLCBkb3QoeDIsIHgyKSwgZG90KHgzLCB4MykpLCAwLjApO1xcbicgK1xuXHRcdCdcdG0gPSBtICogbTtcXG4nICtcblx0XHQnXHRyZXR1cm4gNDIuMCAqIGRvdChtKm0sIHZlYzQoZG90KHAwLCB4MCksIGRvdChwMSwgeDEpLCBkb3QocDIsIHgyKSwgZG90KHAzLCB4MykpKTtcXG4nICtcblx0XHQnfVxcbicgK1xuXHRcdCcjZW5kaWZcXG4nO1xuXG5cdFNlcmlvdXNseS51dGlsLnNoYWRlci5zbm9pc2U0ZCA9ICcjaWZuZGVmIE5PSVNFNERcXG4nICtcblx0XHQnI2RlZmluZSBOT0lTRTREXFxuJyArXG5cdFx0J3ZlYzQgZ3JhZDQoZmxvYXQgaiwgdmVjNCBpcClcXG4nICtcblx0XHQnXHR7XFxuJyArXG5cdFx0J1x0Y29uc3QgdmVjNCBvbmVzID0gdmVjNCgxLjAsIDEuMCwgMS4wLCAtMS4wKTtcXG4nICtcblx0XHQnXHR2ZWM0IHAsIHM7XFxuJyArXG5cdFx0J1xcbicgK1xuXHRcdCdcdHAueHl6ID0gZmxvb3IoZnJhY3QgKHZlYzMoaikgKiBpcC54eXopICogNy4wKSAqIGlwLnogLSAxLjA7XFxuJyArXG5cdFx0J1x0cC53ID0gMS41IC0gZG90KGFicyhwLnh5eiksIG9uZXMueHl6KTtcXG4nICtcblx0XHQnXHRzID0gdmVjNChsZXNzVGhhbihwLCB2ZWM0KDAuMCkpKTtcXG4nICtcblx0XHQnXHRwLnh5eiA9IHAueHl6ICsgKHMueHl6KjIuMCAtIDEuMCkgKiBzLnd3dztcXG4nICtcblx0XHQnXFxuJyArXG5cdFx0J1x0cmV0dXJuIHA7XFxuJyArXG5cdFx0J1x0fVxcbicgK1xuXHRcdCdcXG4nICtcblx0XHQvLyAoc3FydCg1KSAtIDEpLzQgPSBGNCwgdXNlZCBvbmNlIGJlbG93XFxuXG5cdFx0JyNkZWZpbmUgRjQgMC4zMDkwMTY5OTQzNzQ5NDc0NTFcXG4nICtcblx0XHQnXFxuJyArXG5cdFx0J2Zsb2F0IHNub2lzZSh2ZWM0IHYpXFxuJyArXG5cdFx0J1x0e1xcbicgK1xuXHRcdCdcdGNvbnN0IHZlYzQgQyA9IHZlYzQoMC4xMzgxOTY2MDExMjUwMTEsIC8vICg1IC0gc3FydCg1KSkvMjAgRzRcXG4nICtcblx0XHQnXHRcdFx0XHRcdFx0MC4yNzYzOTMyMDIyNTAwMjEsIC8vIDIgKiBHNFxcbicgK1xuXHRcdCdcdFx0XHRcdFx0XHQwLjQxNDU4OTgwMzM3NTAzMiwgLy8gMyAqIEc0XFxuJyArXG5cdFx0J1x0XHRcdFx0XHRcdC0wLjQ0NzIxMzU5NTQ5OTk1OCk7IC8vIC0xICsgNCAqIEc0XFxuJyArXG5cdFx0J1xcbicgK1xuXHRcdC8vIEZpcnN0IGNvcm5lclxuXHRcdCdcdHZlYzQgaSA9IGZsb29yKHYgKyBkb3QodiwgdmVjNChGNCkpKTtcXG4nICtcblx0XHQnXHR2ZWM0IHgwID0gdiAtIGkgKyBkb3QoaSwgQy54eHh4KTtcXG4nICtcblx0XHQnXFxuJyArXG5cdFx0Ly8gT3RoZXIgY29ybmVyc1xuXHRcdCdcXG4nICtcblx0XHQvLyBSYW5rIHNvcnRpbmcgb3JpZ2luYWxseSBjb250cmlidXRlZCBieSBCaWxsIExpY2VhLUthbmUsIEFNRCAoZm9ybWVybHkgQVRJKVxuXHRcdCdcdHZlYzQgaTA7XFxuJyArXG5cdFx0J1x0dmVjMyBpc1ggPSBzdGVwKHgwLnl6dywgeDAueHh4KTtcXG4nICtcblx0XHQnXHR2ZWMzIGlzWVogPSBzdGVwKHgwLnp3dywgeDAueXl6KTtcXG4nICtcblx0XHQvLyBpMC54ID0gZG90KGlzWCwgdmVjMygxLjApKTtcblx0XHQnXHRpMC54ID0gaXNYLnggKyBpc1gueSArIGlzWC56O1xcbicgK1xuXHRcdCdcdGkwLnl6dyA9IDEuMCAtIGlzWDtcXG4nICtcblx0XHQvLyBpMC55ICs9IGRvdChpc1laLnh5LCB2ZWMyKDEuMCkpO1xuXHRcdCdcdGkwLnkgKz0gaXNZWi54ICsgaXNZWi55O1xcbicgK1xuXHRcdCdcdGkwLnp3ICs9IDEuMCAtIGlzWVoueHk7XFxuJyArXG5cdFx0J1x0aTAueiArPSBpc1laLno7XFxuJyArXG5cdFx0J1x0aTAudyArPSAxLjAgLSBpc1laLno7XFxuJyArXG5cdFx0J1xcbicgK1xuXHRcdFx0Ly8gaTAgbm93IGNvbnRhaW5zIHRoZSB1bmlxdWUgdmFsdWVzIDAsMSwyLDMgaW4gZWFjaCBjaGFubmVsXG5cdFx0J1x0dmVjNCBpMyA9IGNsYW1wKGkwLCAwLjAsIDEuMCk7XFxuJyArXG5cdFx0J1x0dmVjNCBpMiA9IGNsYW1wKGkwLTEuMCwgMC4wLCAxLjApO1xcbicgK1xuXHRcdCdcdHZlYzQgaTEgPSBjbGFtcChpMC0yLjAsIDAuMCwgMS4wKTtcXG4nICtcblx0XHQnXFxuJyArXG5cdFx0J1x0dmVjNCB4MSA9IHgwIC0gaTEgKyBDLnh4eHg7XFxuJyArXG5cdFx0J1x0dmVjNCB4MiA9IHgwIC0gaTIgKyBDLnl5eXk7XFxuJyArXG5cdFx0J1x0dmVjNCB4MyA9IHgwIC0gaTMgKyBDLnp6eno7XFxuJyArXG5cdFx0J1x0dmVjNCB4NCA9IHgwICsgQy53d3d3O1xcbicgK1xuXHRcdCdcXG4nICtcblx0XHQvLyBQZXJtdXRhdGlvbnNcblx0XHQnXHRpID0gbW9kMjg5KGkpO1xcbicgK1xuXHRcdCdcdGZsb2F0IGowID0gcGVybXV0ZShwZXJtdXRlKHBlcm11dGUocGVybXV0ZShpLncpICsgaS56KSArIGkueSkgKyBpLngpO1xcbicgK1xuXHRcdCdcdHZlYzQgajEgPSBwZXJtdXRlKHBlcm11dGUocGVybXV0ZShwZXJtdXRlIChcXG4nICtcblx0XHQnXHRcdFx0XHRcdGkudyArIHZlYzQoaTEudywgaTIudywgaTMudywgMS4wKSlcXG4nICtcblx0XHQnXHRcdFx0XHRcdCsgaS56ICsgdmVjNChpMS56LCBpMi56LCBpMy56LCAxLjApKVxcbicgK1xuXHRcdCdcdFx0XHRcdFx0KyBpLnkgKyB2ZWM0KGkxLnksIGkyLnksIGkzLnksIDEuMCkpXFxuJyArXG5cdFx0J1x0XHRcdFx0XHQrIGkueCArIHZlYzQoaTEueCwgaTIueCwgaTMueCwgMS4wKSk7XFxuJyArXG5cdFx0J1xcbicgK1xuXHRcdC8vIEdyYWRpZW50czogN3g3eDYgcG9pbnRzIG92ZXIgYSBjdWJlLCBtYXBwZWQgb250byBhIDQtY3Jvc3MgcG9seXRvcGVcblx0XHQvLyA3KjcqNiA9IDI5NCwgd2hpY2ggaXMgY2xvc2UgdG8gdGhlIHJpbmcgc2l6ZSAxNyoxNyA9IDI4OS5cblx0XHQnXHR2ZWM0IGlwID0gdmVjNCgxLjAvMjk0LjAsIDEuMC80OS4wLCAxLjAvNy4wLCAwLjApIDtcXG4nICtcblx0XHQnXFxuJyArXG5cdFx0J1x0dmVjNCBwMCA9IGdyYWQ0KGowLCBpcCk7XFxuJyArXG5cdFx0J1x0dmVjNCBwMSA9IGdyYWQ0KGoxLngsIGlwKTtcXG4nICtcblx0XHQnXHR2ZWM0IHAyID0gZ3JhZDQoajEueSwgaXApO1xcbicgK1xuXHRcdCdcdHZlYzQgcDMgPSBncmFkNChqMS56LCBpcCk7XFxuJyArXG5cdFx0J1x0dmVjNCBwNCA9IGdyYWQ0KGoxLncsIGlwKTtcXG4nICtcblx0XHQnXFxuJyArXG5cdFx0Ly8gTm9ybWFsaXNlIGdyYWRpZW50c1xuXHRcdCdcdHZlYzQgbm9ybSA9IHRheWxvckludlNxcnQodmVjNChkb3QocDAsIHAwKSwgZG90KHAxLCBwMSksIGRvdChwMiwgcDIpLCBkb3QocDMsIHAzKSkpO1xcbicgK1xuXHRcdCdcdHAwICo9IG5vcm0ueDtcXG4nICtcblx0XHQnXHRwMSAqPSBub3JtLnk7XFxuJyArXG5cdFx0J1x0cDIgKj0gbm9ybS56O1xcbicgK1xuXHRcdCdcdHAzICo9IG5vcm0udztcXG4nICtcblx0XHQnXHRwNCAqPSB0YXlsb3JJbnZTcXJ0KGRvdChwNCwgcDQpKTtcXG4nICtcblx0XHQnXFxuJyArXG5cdFx0Ly8gTWl4IGNvbnRyaWJ1dGlvbnMgZnJvbSB0aGUgZml2ZSBjb3JuZXJzXG5cdFx0J1x0dmVjMyBtMCA9IG1heCgwLjYgLSB2ZWMzKGRvdCh4MCwgeDApLCBkb3QoeDEsIHgxKSwgZG90KHgyLCB4MikpLCAwLjApO1xcbicgK1xuXHRcdCdcdHZlYzIgbTEgPSBtYXgoMC42IC0gdmVjMihkb3QoeDMsIHgzKSwgZG90KHg0LCB4NCkpLCAwLjApO1xcbicgK1xuXHRcdCdcdG0wID0gbTAgKiBtMDtcXG4nICtcblx0XHQnXHRtMSA9IG0xICogbTE7XFxuJyArXG5cdFx0J1x0cmV0dXJuIDQ5LjAgKiAoZG90KG0wKm0wLCB2ZWMzKGRvdChwMCwgeDApLCBkb3QocDEsIHgxKSwgZG90KHAyLCB4MikpKVxcbicgK1xuXHRcdCdcdFx0XHRcdFx0XHRcdCsgZG90KG0xKm0xLCB2ZWMyKGRvdChwMywgeDMpLCBkb3QocDQsIHg0KSkpKSA7XFxuJyArXG5cdFx0J31cXG4nICtcblx0XHQnI2VuZGlmXFxuJztcblxuXHRyZXR1cm4gU2VyaW91c2x5O1xuXG59KSk7XG4iLCIvKiBnbG9iYWwgZGVmaW5lLCByZXF1aXJlICovXG4oZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcblx0XHQvLyBOb2RlL0NvbW1vbkpTXG5cdFx0ZmFjdG9yeShyZXF1aXJlKCcuLi9zZXJpb3VzbHknKSk7XG5cdH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG5cdFx0Ly8gQU1ELiBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlLlxuXHRcdGRlZmluZShbJ3NlcmlvdXNseSddLCBmYWN0b3J5KTtcblx0fSBlbHNlIHtcblx0XHQvKlxuXHRcdHRvZG86IGJ1aWxkIG91dC1vZi1vcmRlciBsb2FkaW5nIGZvciBzb3VyY2VzIGFuZCB0cmFuc2Zvcm1zIG9yIHJlbW92ZSB0aGlzXG5cdFx0aWYgKCFyb290LlNlcmlvdXNseSkge1xuXHRcdFx0cm9vdC5TZXJpb3VzbHkgPSB7IHBsdWdpbjogZnVuY3Rpb24gKG5hbWUsIG9wdCkgeyB0aGlzW25hbWVdID0gb3B0OyB9IH07XG5cdFx0fVxuXHRcdCovXG5cdFx0ZmFjdG9yeShyb290LlNlcmlvdXNseSk7XG5cdH1cbn0odGhpcywgZnVuY3Rpb24gKFNlcmlvdXNseSwgdW5kZWZpbmVkKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgZ2V0VXNlck1lZGlhID0gbmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fCBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEsXG5cblx0Ly8gZGV0ZWN0IGJyb3dzZXItcHJlZml4ZWQgd2luZG93LlVSTFxuXHRVUkwgPSB3aW5kb3cuVVJMIHx8IHdpbmRvdy53ZWJraXRVUkwgfHwgd2luZG93Lm1velVSTCB8fCB3aW5kb3cubXNVUkw7XG5cblx0U2VyaW91c2x5LnNvdXJjZSgnY2FtZXJhJywgZnVuY3Rpb24gKHNvdXJjZSwgb3B0aW9ucywgZm9yY2UpIHtcblx0XHR2YXIgbWUgPSB0aGlzLFxuXHRcdFx0dmlkZW8sXG5cdFx0XHRkZXN0cm95ZWQgPSBmYWxzZSxcblx0XHRcdHN0cmVhbTtcblxuXHRcdGZ1bmN0aW9uIGNsZWFuVXAoKSB7XG5cdFx0XHRpZiAodmlkZW8pIHtcblx0XHRcdFx0dmlkZW8ucGF1c2UoKTtcblx0XHRcdFx0dmlkZW8uc3JjID0gJyc7XG5cdFx0XHRcdHZpZGVvLmxvYWQoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHN0cmVhbSAmJiBzdHJlYW0uc3RvcCkge1xuXHRcdFx0XHRzdHJlYW0uc3RvcCgpO1xuXHRcdFx0fVxuXHRcdFx0c3RyZWFtID0gbnVsbDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuXHRcdFx0aWYgKGRlc3Ryb3llZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh2aWRlby52aWRlb1dpZHRoKSB7XG5cdFx0XHRcdG1lLndpZHRoID0gdmlkZW8udmlkZW9XaWR0aDtcblx0XHRcdFx0bWUuaGVpZ2h0ID0gdmlkZW8udmlkZW9IZWlnaHQ7XG5cdFx0XHRcdG1lLnNldFJlYWR5KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvL1dvcmthcm91bmQgZm9yIEZpcmVmb3ggYnVnIGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTkyNjc1M1xuXHRcdFx0XHRzZXRUaW1lb3V0KGluaXRpYWxpemUsIDUwKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL3RvZG86IHN1cHBvcnQgb3B0aW9ucyBmb3IgdmlkZW8gcmVzb2x1dGlvbiwgZXRjLlxuXG5cdFx0aWYgKGZvcmNlKSB7XG5cdFx0XHRpZiAoIWdldFVzZXJNZWRpYSkge1xuXHRcdFx0XHR0aHJvdyAnQ2FtZXJhIHNvdXJjZSB0eXBlIHVuYXZhaWxhYmxlLiBCcm93c2VyIGRvZXMgbm90IHN1cHBvcnQgZ2V0VXNlck1lZGlhJztcblx0XHRcdH1cblxuXHRcdFx0dmlkZW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd2aWRlbycpO1xuXG5cdFx0XHRnZXRVc2VyTWVkaWEuY2FsbChuYXZpZ2F0b3IsIHtcblx0XHRcdFx0dmlkZW86IHRydWVcblx0XHRcdH0sIGZ1bmN0aW9uIChzKSB7XG5cdFx0XHRcdHN0cmVhbSA9IHM7XG5cblx0XHRcdFx0aWYgKGRlc3Ryb3llZCkge1xuXHRcdFx0XHRcdGNsZWFuVXAoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBjaGVjayBmb3IgZmlyZWZveFxuXHRcdFx0XHRpZiAodmlkZW8ubW96Q2FwdHVyZVN0cmVhbSkge1xuXHRcdFx0XHRcdHZpZGVvLm1velNyY09iamVjdCA9IHN0cmVhbTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2aWRlby5zcmMgPSAoVVJMICYmIFVSTC5jcmVhdGVPYmplY3RVUkwoc3RyZWFtKSkgfHwgc3RyZWFtO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHZpZGVvLnJlYWR5U3RhdGUpIHtcblx0XHRcdFx0XHRpbml0aWFsaXplKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCBpbml0aWFsaXplLCBmYWxzZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2aWRlby5wbGF5KCk7XG5cdFx0XHR9LCBmdW5jdGlvbiAoZXZ0KSB7XG5cdFx0XHRcdC8vdG9kbzogZW1pdCBlcnJvciBldmVudFxuXHRcdFx0XHRjb25zb2xlLmxvZygnVW5hYmxlIHRvIGFjY2VzcyB2aWRlbyBjYW1lcmEnLCBldnQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGRlZmVyVGV4dHVyZTogdHJ1ZSxcblx0XHRcdFx0c291cmNlOiB2aWRlbyxcblx0XHRcdFx0cmVuZGVyOiBPYmplY3QuZ2V0UHJvdG90eXBlT2YodGhpcykucmVuZGVyVmlkZW8sXG5cdFx0XHRcdGRlc3Ryb3k6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRkZXN0cm95ZWQgPSB0cnVlO1xuXHRcdFx0XHRcdGNsZWFuVXAoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdH0sIHtcblx0XHRjb21wYXRpYmxlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gISFnZXRVc2VyTWVkaWE7XG5cdFx0fSxcblx0XHR0aXRsZTogJ0NhbWVyYSdcblx0fSk7XG59KSk7XG4iLCIvLyBnZXRVc2VyTWVkaWEgaGVscGVyIGJ5IEBIZW5yaWtKb3JldGVnXG52YXIgZnVuYyA9ICh3aW5kb3cubmF2aWdhdG9yLmdldFVzZXJNZWRpYSB8fFxuICAgICAgICAgICAgd2luZG93Lm5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWEgfHxcbiAgICAgICAgICAgIHdpbmRvdy5uYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhIHx8XG4gICAgICAgICAgICB3aW5kb3cubmF2aWdhdG9yLm1zR2V0VXNlck1lZGlhKTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjb25zdHJhaW50cywgY2IpIHtcbiAgICB2YXIgb3B0aW9ucztcbiAgICB2YXIgaGF2ZU9wdHMgPSBhcmd1bWVudHMubGVuZ3RoID09PSAyO1xuICAgIHZhciBkZWZhdWx0T3B0cyA9IHt2aWRlbzogdHJ1ZSwgYXVkaW86IHRydWV9O1xuICAgIHZhciBlcnJvcjtcbiAgICB2YXIgZGVuaWVkID0gJ1BFUk1JU1NJT05fREVOSUVEJztcbiAgICB2YXIgbm90U2F0aWZpZWQgPSAnQ09OU1RSQUlOVF9OT1RfU0FUSVNGSUVEJztcblxuICAgIC8vIG1ha2UgY29uc3RyYWludHMgb3B0aW9uYWxcbiAgICBpZiAoIWhhdmVPcHRzKSB7XG4gICAgICAgIGNiID0gY29uc3RyYWludHM7XG4gICAgICAgIGNvbnN0cmFpbnRzID0gZGVmYXVsdE9wdHM7XG4gICAgfVxuXG4gICAgLy8gdHJlYXQgbGFjayBvZiBicm93c2VyIHN1cHBvcnQgbGlrZSBhbiBlcnJvclxuICAgIGlmICghZnVuYykge1xuICAgICAgICAvLyB0aHJvdyBwcm9wZXIgZXJyb3IgcGVyIHNwZWNcbiAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ05hdmlnYXRvclVzZXJNZWRpYUVycm9yJyk7XG4gICAgICAgIGVycm9yLm5hbWUgPSAnTk9UX1NVUFBPUlRFRF9FUlJPUic7XG4gICAgICAgIHJldHVybiBjYihlcnJvcik7XG4gICAgfVxuXG4gICAgZnVuYy5jYWxsKHdpbmRvdy5uYXZpZ2F0b3IsIGNvbnN0cmFpbnRzLCBmdW5jdGlvbiAoc3RyZWFtKSB7XG4gICAgICAgIGNiKG51bGwsIHN0cmVhbSk7XG4gICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICB2YXIgZXJyb3I7XG4gICAgICAgIC8vIGNvZXJjZSBpbnRvIGFuIGVycm9yIG9iamVjdCBzaW5jZSBGRiBnaXZlcyB1cyBhIHN0cmluZ1xuICAgICAgICAvLyB0aGVyZSBhcmUgb25seSB0d28gdmFsaWQgbmFtZXMgYWNjb3JkaW5nIHRvIHRoZSBzcGVjXG4gICAgICAgIC8vIHdlIGNvZXJjZSBhbGwgbm9uLWRlbmllZCB0byBcImNvbnN0cmFpbnQgbm90IHNhdGlzZmllZFwiLlxuICAgICAgICBpZiAodHlwZW9mIGVyciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGVycm9yID0gbmV3IEVycm9yKCdOYXZpZ2F0b3JVc2VyTWVkaWFFcnJvcicpO1xuICAgICAgICAgICAgaWYgKGVyciA9PT0gZGVuaWVkKSB7XG4gICAgICAgICAgICAgICAgZXJyb3IubmFtZSA9IGRlbmllZDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXJyb3IubmFtZSA9IG5vdFNhdGlmaWVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaWYgd2UgZ2V0IGFuIGVycm9yIG9iamVjdCBtYWtlIHN1cmUgJy5uYW1lJyBwcm9wZXJ0eSBpcyBzZXRcbiAgICAgICAgICAgIC8vIGFjY29yZGluZyB0byBzcGVjOiBodHRwOi8vZGV2LnczLm9yZy8yMDExL3dlYnJ0Yy9lZGl0b3IvZ2V0dXNlcm1lZGlhLmh0bWwjbmF2aWdhdG9ydXNlcm1lZGlhZXJyb3ItYW5kLW5hdmlnYXRvcnVzZXJtZWRpYWVycm9yY2FsbGJhY2tcbiAgICAgICAgICAgIGVycm9yID0gZXJyO1xuICAgICAgICAgICAgaWYgKCFlcnJvci5uYW1lKSB7XG4gICAgICAgICAgICAgICAgLy8gdGhpcyBpcyBsaWtlbHkgY2hyb21lIHdoaWNoXG4gICAgICAgICAgICAgICAgLy8gc2V0cyBhIHByb3BlcnR5IGNhbGxlZCBcIkVSUk9SX0RFTklFRFwiIG9uIHRoZSBlcnJvciBvYmplY3RcbiAgICAgICAgICAgICAgICAvLyBpZiBzbyB3ZSBtYWtlIHN1cmUgdG8gc2V0IGEgbmFtZVxuICAgICAgICAgICAgICAgIGlmIChlcnJvcltkZW5pZWRdKSB7XG4gICAgICAgICAgICAgICAgICAgIGVyci5uYW1lID0gZGVuaWVkO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVyci5uYW1lID0gbm90U2F0aWZpZWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY2IoZXJyb3IpO1xuICAgIH0pO1xufTtcbiJdfQ==
;