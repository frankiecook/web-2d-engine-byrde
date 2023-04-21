class Material {
	constructor(gl,vs, fs) {
		this.gl = gl;

		let vs_shader = this.getShader(vs, gl.VERTEX_SHADER);
		let fs_shader = this.getShader(fs, gl.FRAGMENT_SHADER);

		// test if the two shader work
		if (vs_shader && fs_shader) {
			this.program = gl.createProgram();
			gl.attachShader(this.program, vs_shader);
			gl.attachShader(this.program, fs_shader);
			gl.linkProgram(this.program);

			// check program
			if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
				console.error("cannot load shader \n:" + gl.getProgramInfoLog(this.program));
				return null
			}

			// gather the gl attributes
			this.gatherParameters();

			// clean garbage
			// since the program has been made, you can get rid of the shaders
			gl.detachShader(this.program, vs_shader);
			gl.detachShader(this.program, fs_shader);
			gl.deleteShader(vs_shader);
			gl.deleteShader(fs_shader);

			gl.useProgram(null);
		}
	}

	// combine the fragment and vertex shader
	getShader(script, type) {
		// check code using breakpoints but add error checking for text script
		let gl = this.gl;
		var output = gl.createShader(type);
		gl.shaderSource(output, script);
		gl.compileShader(output);

		// error check
		if (!gl.getShaderParameter(output, gl.COMPILE_STATUS)) {
			console.error("Shader Error: \n:" + gl.getShaderInfoLog(output));
			return null
		}

		return output
	}

	// load in attributes of shader (a_position, a_texCoord, u_image, etc.)
	// problem is that these are hardcoded for every shader
	// solve by pulling out dynamically
	gatherParameters() {
		let gl = this.gl;
		let is_uniform = 0;

		this.parameters = {};

		while (is_uniform < 2) {
			// ternary operator (condition ? true : false)
			// gathers the attributes and uniforms from webgl shaders
			let param_type = is_uniform ? gl.ACTIVE_UNIFORMS : gl.ACTIVE_ATTRIBUTES;
			let count = gl.getProgramParameter(this.program, param_type);

			for (let i = 0; i < count; i++) {
				let details;
				let location;
				if (is_uniform) {
					details = gl.getActiveUniform(this.program, i);
					location = gl.getUniformLocation(this.program, details.name);
				} else {
					details = gl.getActiveAttrib(this.program, i);
					location = gl.getAttribLocation(this.program, details.name);
				}

				this.parameters[details.name] = {
					location: location,
					uniform: !!is_uniform,
					type: details.type
				}
			}
			is_uniform++;
		}
	}

	// use already gathered parameters in rendering
	set(name, a, b, c, d) {
		let gl = this.gl;

		if (name in this.parameters) {
			let param = this.parameters[name];

			if (param.uniform) {
				switch (param.type) {
					case gl.FLOAT: gl.uniform1f(param.location, a); break;
					case gl.FLOAT_VEC2: gl.uniform2f(param.location, a, b); break;
					case gl.FLOAT_VEC3: gl.uniform3f(param.location, a, b, c); break;
					case gl.FLOAT_VEC4: gl.uniform4f(param.location, a, b, c, d); break;
					case gl.FLOAT_MAT3: gl.uniformMatrix3fv(param.location, false, a); break;
					case gl.FLOAT_MAT4: gl.uniformMatrix4fv(param.location, false, a); break;
					case gl.SAMPLER_2D: gl.uniform1i(param.location, a); break;
				}
			} else {
				gl.enableVertexAttribArray(param.location);

				if (a == undefined) a = gl.FLOAT;
				if (b == undefined) b = false;
				if (c == undefined) c = 0;
				if (d == undefined) d = 0;

				switch (param.type) {
					case gl.FLOAT: gl.vertexAttribPointer(param.location, 1, a, b, c, d); break;
					case gl.FLOAT_VEC2: gl.vertexAttribPointer(param.location, 2, a, b, c, d); break;
					case gl.FLOAT_VEC3: gl.vertexAttribPointer(param.location, 3, a, b, c, d); break;
					case gl.FLOAT_VEC4: gl.vertexAttribPointer(param.location, 4, a, b, c, d); break;
				}
			}
		}
	}
}

class Sprite {
	constructor(gl, img_url, vs, fs, opts={}) {
		this.gl = gl;
		this.is_loaded = false;		// takes time to load in an image, so there will be a delay to track
		this.material = new Material(gl, vs, fs);

		// create width and height 
		this.size = new Point(64, 64);
		if ("width" in opts) {
			this.size.x = opts.width * 1; // multiplay by 1 to ensure the item is a number
		}
		if ("height" in opts) {
			this.size.y = opts.height * 1;
		}

		this.image = new Image();
		this.image.src = img_url;
		this.image.sprite = this;	// now you can reference the sprite associated with an image
		this.image.onload = function () {
			// setup function
			this.sprite.setup();
		}
	}

	// cannot call static methods on an object
	static createRectArray(x = 0, y = 0, w = 1, h = 1) {
		// special type of array in javascript for strict types
		return new Float32Array([
			x, y,
			x + w, y,
			x, y + h,
			x, y + h,
			x + w, y,
			x + w, y + h
		]);
	}

	setup() {
		let gl = this.gl;

		// convert image object (used by HTML) to something webgl can use
		gl.useProgram(this.material.program);
		this.gl_tex = gl.createTexture();		// memory allocation for texture

		gl.bindTexture(gl.TEXTURE_2D, this.gl_tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);	// filter - texture expands beyond resolution
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
		gl.bindTexture(gl.TEXTURE_2D, null); //unbind texture

		// texture coordinates are in increment of sprite size
		this.uv_x = this.size.x / this.image.width;
		this.uv_y = this.size.y / this.image.height;

		// texture coordinates loaded in
		this.tex_buff = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.tex_buff);
		gl.bufferData(gl.ARRAY_BUFFER, Sprite.createRectArray(0, 0, this.uv_x, this.uv_y), gl.STATIC_DRAW);

		// geometry is a rectangle, only thing needed for 2D engines (typically)
		this.geo_buff = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.geo_buff);
		gl.bufferData(gl.ARRAY_BUFFER, Sprite.createRectArray(0, 0, this.size.x, this.size.y), gl.STATIC_DRAW); // overide default with defined size

		// delete the program
		gl.useProgram(null);
		this.isLoaded = true;
	}

	render(position, frames, options) {
		if (this.isLoaded) {
			let gl = this.gl;

			// update the frame being displayed
			let frame_x = Math.floor(frames.x) * this.uv_x;
			let frame_y = Math.floor(frames.y) * this.uv_y;

			// matrix for object
			let o_mat = new M3x3().transition(position.x, position.y);

			gl.useProgram(this.material.program);

			this.material.set("u_color", 1, 1, 1, 1);	// white

			// apply all options to the shader
			for (let option in options) {
				// concat the option's property name with the option's property value
				this.material.set.apply(this.material, [option].concat(options[option]));

				if (option == "scalex") { o_mat = o_mat.scale(options.scalex, 1.0); }
				if (option == "scaley") { o_mat = o_mat.scale(1.0, options.scaley); }
			}

			// set up the texture
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.gl_tex);
			this.material.set("u_image", 0);	// one of the new implementations of attributes

			// set up the two buffers
			gl.bindBuffer(gl.ARRAY_BUFFER, this.tex_buff);
			//gl.enableVertexAttribArray(this.aTexcoordLoc);
			this.material.set("a_texCoord");
			//gl.vertexAttribPointer(this.aTexcoordLoc, 2, gl.FLOAT, false, 0, 0);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.geo_buff);
			//gl.enableVertexAttribArray(this.aPositionLoc);
			this.material.set("a_position");
			//gl.vertexAttribPointer(this.aPositionLoc, 2, gl.FLOAT, false, 0, 0);
			
			this.material.set("u_frame", frame_x, frame_y);
			this.material.set("u_world", window.game.world_space_matrix.getFloatArray());
			this.material.set("u_object", o_mat.getFloatArray());
			//gl.uniform2f(this.uFrameLoc, frame_x, frame_y);
			//gl.uniformMatrix3fv(this.uWorldLoc, false, window.game.world_space_matrix.getFloatArray());
			//gl.uniformMatrix3fv(this.uObjectLoc, false, o_mat.getFloatArray());

			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 6);

			gl.useProgram(null);
		}
	}
}

/*
* Addition of framebuffers
*
* draw multiple scenes offscreen and composite them together for the final result to be viewed
* Useful for multi-layers or post-render effects
*
*	backbuffers are a setup for the current frame to be viewed on screen, where as frontbuffers are the last frame that IS being viewed on the frame
*
* buffers are 1-dimensional storage of data, typically in an array, that is mapped to the 2D output (the viewable canvas)
* just collection of data
*/

class BackBuffer {
	constructor(gl, options) {
		this.gl = gl;
		this.material = new Material(
			this.gl,
			BackBuffer.VS,
			BackBuffer.FS
		);
		this.size = new Point(512, 512);

		if ("width" in options) { this.size.x = options.width; }
		if ("height" in options) { this.size.y = options.height; }

		this.fbuffer = gl.createFramebuffer();
		this.rbuffer = gl.createRenderbuffer();
		this.texture = gl.createTexture();

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbuffer);
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.rbuffer);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);

		// CLAMP_TO_EDGE stretches out border pixels? what
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.size.x, this.size.y, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.size.x, this.size.y);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.rbuffer);

		//Create geometry for rendering
		this.tex_buff = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.tex_buff);
		gl.bufferData(gl.ARRAY_BUFFER, Sprite.createRectArray(), gl.STATIC_DRAW);

		this.geo_buff = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.geo_buff);
		gl.bufferData(gl.ARRAY_BUFFER, Sprite.createRectArray(-1, -1, 2, 2), gl.STATIC_DRAW);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindTexture(gl.RENDERBUFFER, null);
		gl.bindTexture(gl.FRAMEBUFFER, null);
	}

	// once a buffer is full of data, we want to render that information
	render() {
		let gl = this.gl;

		gl.useProgram(this.material.program);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		this.material.set("u_image", 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.tex_buff);
		this.material.set("a_texCoord");

		gl.bindBuffer(gl.ARRAY_BUFFER, this.geo_buff);
		this.material.set("a_position");

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 6);

		gl.useProgram(null);
	}
}

// this is a bit wacky
// shader for back buffer is similar to the vertex shader
// geometry will just be a rectangle over the entire viewable space
BackBuffer.VS = `
	attribute vec2 a_position;
	attribute vec2 a_texCoord;
	
	varying vec2 v_texCoord;

	void main(){
		gl_Position = vec4( a_position, 1, 1);
		v_texCoord = a_texCoord;
	}
`;

BackBuffer.FS = `
	precision mediump float;
	uniform sampler2D u_image;
	varying vec2 v_texCoord;
	
	void main(){
		gl_FragColor = texture2D(u_image, v_texCoord);
	}
`;