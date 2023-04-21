function loop() {
	// update once per animation frame
	window.game.update();
	// callback argument that is invoked before the repaint (next frame)
	// ISSUES WITH REFRESH RATE OF SCREENS
	requestAnimationFrame(loop);
}

class Game {
	constructor() {
		this.canvas_elm = document.createElement("canvas");
		this.canvas_elm.width = 800;
		this.canvas_elm.height = 600;

		this.world_space_matrix = new M3x3();

		// webgl context
		this.gl = this.canvas_elm.getContext("webgl2");
		this.gl.clearColor(0.4, 0.6, 1.0, 1.0);
		this.gl.enable(this.gl.BLEND);

		document.body.appendChild(this.canvas_elm);

		// import shader information
		let vs = document.getElementById("vs").innerHTML;
		let fs = document.getElementById("fs").innerHTML;

		/*
		* light buffer displays backbuffer concept
		*	we are using backbuffers as multiple layers to the same image
		* backbuffer size controls the resolution of the rendered image
		*/
		this.backBuffer = new BackBuffer(this.gl, {width:512, height:240}); // buffer for sprite layer
		this.finalBuffer = new BackBuffer(this.gl, {width:512, height:240});

		this.sprites = {
			"background" : new Sprite(this.gl, "img/nort.png", vs, fs, { width: 256, height: 256 }),
			"shadow" : new Sprite(this.gl, "img/shadow-80x70.png", vs, fs, { width: 80, height: 70 }),
			"light" : new Sprite(this.gl, "img/light-mask.png", vs, fs, { width: 256, height: 256 }),
			"white" : new Sprite(this.gl, "img/white.png", vs, fs, { width: 1, height: 1 }),
		};

		this.gatherRenderables();
	}

	gatherRenderables() {
		this.renderables = {

			layers: [
				{
					blendmode: 0, objs: [
						{ sprite: "background", position: { x: 32, y: 32 }, frame: { x: 0, y: 0 }, flip: false, blendmode: 0, options: {} },
						{ sprite: "shadow", position: { x: 238, y: 75 }, frame: { x: 0, y: 0 }, flip: false, blendmode: Game.BLENDMODE_ALPHA, options: {} },
					],
				},
				{
					blendmode: Game.BLENDMODE_MULTIPLY, objs: [
						{ sprite: "white", position: { x: 0, y: 0 }, frame: { x: 0, y: 0 }, flip: false, blendmode: 0, options: { scalex: 512, scaley: 240, u_color: [0.5, 0.125, 0.25, 1] } },
						{ sprite: "light", position: { x: 128, y: 80 }, frame: { x: 0, y: 0 }, flip: false, blendmode: Game.BLENDMODE_ADDITITVE, options: {} },
					],
				}
			]
		}
	}

	resize(x, y) {
		this.canvas_elm.width = x;
		this.canvas_elm.height = y;

		// older pixelated games had 240 vertical lines, hence width=240
		// transition (-1,1) to move origin (0,0) of view space from center of the screen to the top left corner
		// changing the height of window will adjust the scale of sprites
		// changing the width only changes how much of the game is displayed
		let w_ratio = x / (y / 240);
		this.world_space_matrix = new M3x3().transition(-1, 1).scale(2 / w_ratio, -2 / 240);
	}

	// set context of buffer
	// if not an instance of backbuffer, then switch back to the main context to render to
	// and not one of the framebuffers
	setBuffer(buffer) {
		let gl = this.gl;

		// instanceof checks if the constructor of the class appears in the object given
		if (buffer instanceof BackBuffer) {
			gl.viewport(0, 0, buffer.size.x, buffer.size.y);
			gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fbuffer);
		} else {
			gl.viewport(0, 0, this.canvas_elm.width, this.canvas_elm.height);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		}
	}

	// create constants for
	// alpha blends the alhpa channels with the surrounding textures
	setBlendmode(bm) {
		switch (bm) {
			case Game.BLENDMODE_ALPHA:
				this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA); break;
			case Game.BLENDMODE_ADDITITVE:
				this.gl.blendFunc(this.gl.ONE, this.gl.ONE); break;
			case Game.BLENDMODE_MULTIPLY:
				this.gl.blendFunc(this.gl.DST_COLOR, this.gl.ZERO); break;
		}
	}

	update() {
		// render loop
		// first, render objects to the backbuffer
		// second, render backbuffer to the finalbuffer
		// repeate until ended
		for (let l = 0; l < this.renderables.layers.length; l++) {
			let layer = this.renderables.layers[l];

			this.setBuffer(this.backBuffer);
			this.gl.clear(this.gl.COLOR_BUFFER_BIT);

			for (let i = 0; i < layer.objs.length; i++) {
				let obj = layer.objs[i];
				let sprite = this.sprites[obj.sprite];

				this.setBlendmode(obj.blendmode);
				sprite.render(obj.position, obj.frame, obj.options);
			}

			this.setBlendmode(layer.blendmode);
			this.setBuffer(this.finalBuffer);
			this.backBuffer.render();

		}

		this.setBuffer();
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);
		this.setBlendmode(Game.BLENDMODE_ALPHA);
		this.finalBuffer.render();

		// clean everything
		this.gl.flush();
	}
}

Game.BLENDMODE_ALPHA = 0;
Game.BLENDMODE_ADDITITVE = 1;
Game.BLENDMODE_MULTIPLY = 2;