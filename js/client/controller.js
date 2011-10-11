/*global exports, JSON, cs, ASSERT, LOG, superClass, inherit, Proxy, DP */
/*global myModules, $ */
(function(){
var myc = myModules.myc;
var mycs = myModules.mycs;
var cs = myModules.cs;

var proxy;
var selectedColor = 'red';

var BRUSH_SCAEL = 1000;	// input attribute step=0.1 doesn't work fine on jquery mobile.

function updatePalette() {
	$('#painting').css('background-color', selectedColor);
	var brushSize = $('#brush_size').attr('value') / BRUSH_SCAEL;
	proxy.send({
		type: 'update_palette',
		arg: {
			color: cs.paletteColors[selectedColor],
			r: brushSize
		}
	});
}

function start() {
	$('#recording').bind('change', function(e) {
		proxy.send({
			type: (this.value === 'on')? 'start_record': 'stop_record'
		});
	});
	var painting = $('#painting');
	painting.bind('touchstart mousedown', function() {
		proxy.send({
			type: 'start_paint'
		});
	});
	painting.bind('touchend mouseup', function() {
		proxy.send({
			type: 'end_paint'
		});
	});
	
	$('#brush_size').bind('change', updatePalette);
	
	$('#save_model_button').bind('click', function() {
		var name = prompt('Please input the model name.', 'Default');
		proxy.send({
			type: 'save_model',
			arg: {
				name: name
			}
		});
	});

	$('#clear_model_button').bind('click', function() {
		proxy.send({
			type: 'clear_all_blocks'
		});
	});

	$('#inhibit_destroy_block_command').bind('change', function(e) {
		proxy.send({
			type: 'set_inhibit_destroy_block_flag',
			arg: {
				flag: (this.value === 'on')
			}
		});
	});
}

$(document).ready(function(){
	
	var wrap = $('<div/>');
	for (var name in cs.paletteColors) {
		var color = $('<div/>')
			.addClass('palette_color')
			.css('background-color', name)
			.bind('click', (function(name){
				return function(){
					selectedColor = name;
					updatePalette();
				};
			})(name));
		wrap.append(color);
	}
	$('#color_palette').append(wrap);
	
	$('#brush_size').val(cs.DEFAULT_BLOCK_SIZE * BRUSH_SCAEL).slider('refresh');
	proxy = new myc.SocketIoProxy(
		cs.CONTROLLER_PORT,
		function(){
			LOG('open');
			start();
		},
		function(data) {
			switch (data.type) {
			case 'notify_id': 
				$('#id').html(data.arg.id);
				break;
			}
		},
		function(){
			LOG('close');
		}
	);
});

window.addEventListener('unload', function(){	// for browser bug
	if (proxy) {
		proxy.close();
	}
}, false);

})();

