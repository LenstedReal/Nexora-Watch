import { createRequire } from "node:module";
import { PassThrough, Readable } from "node:stream";
//#region node_modules/crossws/dist/_chunks/libs/ws.mjs
var t = Object.create;
var n = Object.defineProperty;
var r = Object.getOwnPropertyDescriptor;
var i = Object.getOwnPropertyNames;
var a = Object.getPrototypeOf;
var o = Object.prototype.hasOwnProperty;
var s = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports);
var c = (e, t, a, s) => {
	if (t && typeof t == `object` || typeof t == `function`) for (var c = i(t), l = 0, u = c.length, d; l < u; l++) d = c[l], !o.call(e, d) && d !== a && n(e, d, {
		get: ((e) => t[e]).bind(null, d),
		enumerable: !(s = r(t, d)) || s.enumerable
	});
	return e;
};
var l = (e, r, i) => (i = e == null ? {} : t(a(e)), c(r || !e || !e.__esModule || !o.call(e, `default`) ? n(i, `default`, {
	value: e,
	enumerable: !0
}) : i, e));
var u = createRequire(import.meta.url);
var d = s(((e, t) => {
	let n = [
		`nodebuffer`,
		`arraybuffer`,
		`fragments`
	], r = typeof Blob < `u`;
	r && n.push(`blob`), t.exports = {
		BINARY_TYPES: n,
		CLOSE_TIMEOUT: 3e4,
		EMPTY_BUFFER: Buffer.alloc(0),
		GUID: `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`,
		hasBlob: r,
		kForOnEventAttribute: Symbol(`kIsForOnEventAttribute`),
		kListener: Symbol(`kListener`),
		kStatusCode: Symbol(`status-code`),
		kWebSocket: Symbol(`websocket`),
		NOOP: () => {}
	};
}));
var f = s(((e, t) => {
	let { EMPTY_BUFFER: n } = d(), r = Buffer[Symbol.species];
	function i(e, t) {
		if (e.length === 0) return n;
		if (e.length === 1) return e[0];
		let i = Buffer.allocUnsafe(t), a = 0;
		for (let t = 0; t < e.length; t++) {
			let n = e[t];
			i.set(n, a), a += n.length;
		}
		return a < t ? new r(i.buffer, i.byteOffset, a) : i;
	}
	function a(e, t, n, r, i) {
		for (let a = 0; a < i; a++) n[r + a] = e[a] ^ t[a & 3];
	}
	function o(e, t) {
		for (let n = 0; n < e.length; n++) e[n] ^= t[n & 3];
	}
	function s(e) {
		return e.length === e.buffer.byteLength ? e.buffer : e.buffer.slice(e.byteOffset, e.byteOffset + e.length);
	}
	function c(e) {
		if (c.readOnly = !0, Buffer.isBuffer(e)) return e;
		let t;
		return e instanceof ArrayBuffer ? t = new r(e) : ArrayBuffer.isView(e) ? t = new r(e.buffer, e.byteOffset, e.byteLength) : (t = Buffer.from(e), c.readOnly = !1), t;
	}
	if (t.exports = {
		concat: i,
		mask: a,
		toArrayBuffer: s,
		toBuffer: c,
		unmask: o
	}, !process.env.WS_NO_BUFFER_UTIL) try {
		let e = u(`bufferutil`);
		t.exports.mask = function(t, n, r, i, o) {
			o < 48 ? a(t, n, r, i, o) : e.mask(t, n, r, i, o);
		}, t.exports.unmask = function(t, n) {
			t.length < 32 ? o(t, n) : e.unmask(t, n);
		};
	} catch {}
}));
var p = s(((e, t) => {
	let n = Symbol(`kDone`), r = Symbol(`kRun`);
	t.exports = class {
		constructor(e) {
			this[n] = () => {
				this.pending--, this[r]();
			}, this.concurrency = e || 1 / 0, this.jobs = [], this.pending = 0;
		}
		add(e) {
			this.jobs.push(e), this[r]();
		}
		[r]() {
			if (this.pending !== this.concurrency && this.jobs.length) {
				let e = this.jobs.shift();
				this.pending++, e(this[n]);
			}
		}
	};
}));
var m = s(((e, t) => {
	let n = u(`zlib`), r = f(), i = p(), { kStatusCode: a } = d(), o = Buffer[Symbol.species], s = Buffer.from([
		0,
		0,
		255,
		255
	]), c = Symbol(`permessage-deflate`), l = Symbol(`total-length`), m = Symbol(`callback`), h = Symbol(`buffers`), g = Symbol(`error`), _;
	t.exports = class {
		constructor(e) {
			if (this._options = e || {}, this._threshold = this._options.threshold === void 0 ? 1024 : this._options.threshold, this._maxPayload = this._options.maxPayload | 0, this._isServer = !!this._options.isServer, this._deflate = null, this._inflate = null, this.params = null, !_) {
				let e = this._options.concurrencyLimit === void 0 ? 10 : this._options.concurrencyLimit;
				_ = new i(e);
			}
		}
		static get extensionName() {
			return `permessage-deflate`;
		}
		offer() {
			let e = {};
			return this._options.serverNoContextTakeover && (e.server_no_context_takeover = !0), this._options.clientNoContextTakeover && (e.client_no_context_takeover = !0), this._options.serverMaxWindowBits && (e.server_max_window_bits = this._options.serverMaxWindowBits), this._options.clientMaxWindowBits ? e.client_max_window_bits = this._options.clientMaxWindowBits : this._options.clientMaxWindowBits ?? (e.client_max_window_bits = !0), e;
		}
		accept(e) {
			return e = this.normalizeParams(e), this.params = this._isServer ? this.acceptAsServer(e) : this.acceptAsClient(e), this.params;
		}
		cleanup() {
			if (this._inflate &&= (this._inflate.close(), null), this._deflate) {
				let e = this._deflate[m];
				this._deflate.close(), this._deflate = null, e && e(Error(`The deflate stream was closed while data was being processed`));
			}
		}
		acceptAsServer(e) {
			let t = this._options, n = e.find((e) => !(t.serverNoContextTakeover === !1 && e.server_no_context_takeover || e.server_max_window_bits && (t.serverMaxWindowBits === !1 || typeof t.serverMaxWindowBits == `number` && t.serverMaxWindowBits > e.server_max_window_bits) || typeof t.clientMaxWindowBits == `number` && (typeof e.client_max_window_bits == `number` ? t.clientMaxWindowBits > e.client_max_window_bits : !e.client_max_window_bits)));
			if (!n) throw Error(`None of the extension offers can be accepted`);
			return t.serverNoContextTakeover && (n.server_no_context_takeover = !0), t.clientNoContextTakeover && (n.client_no_context_takeover = !0), typeof t.serverMaxWindowBits == `number` && (n.server_max_window_bits = t.serverMaxWindowBits), typeof t.clientMaxWindowBits == `number` ? n.client_max_window_bits = t.clientMaxWindowBits : (n.client_max_window_bits === !0 || t.clientMaxWindowBits === !1) && delete n.client_max_window_bits, n;
		}
		acceptAsClient(e) {
			let t = e[0];
			if (this._options.clientNoContextTakeover === !1 && t.client_no_context_takeover) throw Error(`Unexpected parameter "client_no_context_takeover"`);
			if (!t.client_max_window_bits) typeof this._options.clientMaxWindowBits == `number` && (t.client_max_window_bits = this._options.clientMaxWindowBits);
			else if (this._options.clientMaxWindowBits === !1 || typeof this._options.clientMaxWindowBits == `number` && t.client_max_window_bits > this._options.clientMaxWindowBits) throw Error(`Unexpected or invalid parameter "client_max_window_bits"`);
			return t;
		}
		normalizeParams(e) {
			return e.forEach((e) => {
				Object.keys(e).forEach((t) => {
					let n = e[t];
					if (n.length > 1) throw Error(`Parameter "${t}" must have only a single value`);
					if (n = n[0], t === `client_max_window_bits`) {
						if (n !== !0) {
							let e = +n;
							if (!Number.isInteger(e) || e < 8 || e > 15) throw TypeError(`Invalid value for parameter "${t}": ${n}`);
							n = e;
						} else if (!this._isServer) throw TypeError(`Invalid value for parameter "${t}": ${n}`);
					} else if (t === `server_max_window_bits`) {
						let e = +n;
						if (!Number.isInteger(e) || e < 8 || e > 15) throw TypeError(`Invalid value for parameter "${t}": ${n}`);
						n = e;
					} else if (t === `client_no_context_takeover` || t === `server_no_context_takeover`) {
						if (n !== !0) throw TypeError(`Invalid value for parameter "${t}": ${n}`);
					} else throw Error(`Unknown parameter "${t}"`);
					e[t] = n;
				});
			}), e;
		}
		decompress(e, t, n) {
			_.add((r) => {
				this._decompress(e, t, (e, t) => {
					r(), n(e, t);
				});
			});
		}
		compress(e, t, n) {
			_.add((r) => {
				this._compress(e, t, (e, t) => {
					r(), n(e, t);
				});
			});
		}
		_decompress(e, t, i) {
			let a = this._isServer ? `client` : `server`;
			if (!this._inflate) {
				let e = `${a}_max_window_bits`, t = typeof this.params[e] == `number` ? this.params[e] : n.Z_DEFAULT_WINDOWBITS;
				this._inflate = n.createInflateRaw({
					...this._options.zlibInflateOptions,
					windowBits: t
				}), this._inflate[c] = this, this._inflate[l] = 0, this._inflate[h] = [], this._inflate.on(`error`, b), this._inflate.on(`data`, y);
			}
			this._inflate[m] = i, this._inflate.write(e), t && this._inflate.write(s), this._inflate.flush(() => {
				let e = this._inflate[g];
				if (e) {
					this._inflate.close(), this._inflate = null, i(e);
					return;
				}
				let n = r.concat(this._inflate[h], this._inflate[l]);
				this._inflate._readableState.endEmitted ? (this._inflate.close(), this._inflate = null) : (this._inflate[l] = 0, this._inflate[h] = [], t && this.params[`${a}_no_context_takeover`] && this._inflate.reset()), i(null, n);
			});
		}
		_compress(e, t, i) {
			let a = this._isServer ? `server` : `client`;
			if (!this._deflate) {
				let e = `${a}_max_window_bits`, t = typeof this.params[e] == `number` ? this.params[e] : n.Z_DEFAULT_WINDOWBITS;
				this._deflate = n.createDeflateRaw({
					...this._options.zlibDeflateOptions,
					windowBits: t
				}), this._deflate[l] = 0, this._deflate[h] = [], this._deflate.on(`data`, v);
			}
			this._deflate[m] = i, this._deflate.write(e), this._deflate.flush(n.Z_SYNC_FLUSH, () => {
				if (!this._deflate) return;
				let e = r.concat(this._deflate[h], this._deflate[l]);
				t && (e = new o(e.buffer, e.byteOffset, e.length - 4)), this._deflate[m] = null, this._deflate[l] = 0, this._deflate[h] = [], t && this.params[`${a}_no_context_takeover`] && this._deflate.reset(), i(null, e);
			});
		}
	};
	function v(e) {
		this[h].push(e), this[l] += e.length;
	}
	function y(e) {
		if (this[l] += e.length, this[c]._maxPayload < 1 || this[l] <= this[c]._maxPayload) {
			this[h].push(e);
			return;
		}
		this[g] = RangeError(`Max payload size exceeded`), this[g].code = `WS_ERR_UNSUPPORTED_MESSAGE_LENGTH`, this[g][a] = 1009, this.removeListener(`data`, y), this.reset();
	}
	function b(e) {
		if (this[c]._inflate = null, this[g]) {
			this[m](this[g]);
			return;
		}
		e[a] = 1007, this[m](e);
	}
}));
var h = s(((e, t) => {
	let { isUtf8: n } = u(`buffer`), { hasBlob: r } = d(), i = [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		0,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		1,
		1,
		0,
		1,
		1,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		1,
		0,
		1,
		0
	];
	function a(e) {
		return e >= 1e3 && e <= 1014 && e !== 1004 && e !== 1005 && e !== 1006 || e >= 3e3 && e <= 4999;
	}
	function o(e) {
		let t = e.length, n = 0;
		for (; n < t;) if (!(e[n] & 128)) n++;
		else if ((e[n] & 224) == 192) {
			if (n + 1 === t || (e[n + 1] & 192) != 128 || (e[n] & 254) == 192) return !1;
			n += 2;
		} else if ((e[n] & 240) == 224) {
			if (n + 2 >= t || (e[n + 1] & 192) != 128 || (e[n + 2] & 192) != 128 || e[n] === 224 && (e[n + 1] & 224) == 128 || e[n] === 237 && (e[n + 1] & 224) == 160) return !1;
			n += 3;
		} else if ((e[n] & 248) == 240) {
			if (n + 3 >= t || (e[n + 1] & 192) != 128 || (e[n + 2] & 192) != 128 || (e[n + 3] & 192) != 128 || e[n] === 240 && (e[n + 1] & 240) == 128 || e[n] === 244 && e[n + 1] > 143 || e[n] > 244) return !1;
			n += 4;
		} else return !1;
		return !0;
	}
	function s(e) {
		return r && typeof e == `object` && typeof e.arrayBuffer == `function` && typeof e.type == `string` && typeof e.stream == `function` && (e[Symbol.toStringTag] === `Blob` || e[Symbol.toStringTag] === `File`);
	}
	if (t.exports = {
		isBlob: s,
		isValidStatusCode: a,
		isValidUTF8: o,
		tokenChars: i
	}, n) t.exports.isValidUTF8 = function(e) {
		return e.length < 24 ? o(e) : n(e);
	};
	else if (!process.env.WS_NO_UTF_8_VALIDATE) try {
		let e = u(`utf-8-validate`);
		t.exports.isValidUTF8 = function(t) {
			return t.length < 32 ? o(t) : e(t);
		};
	} catch {}
}));
var g = s(((e, t) => {
	let { Writable: n } = u(`stream`), r = m(), { BINARY_TYPES: i, EMPTY_BUFFER: a, kStatusCode: o, kWebSocket: s } = d(), { concat: c, toArrayBuffer: l, unmask: p } = f(), { isValidStatusCode: g, isValidUTF8: _ } = h(), v = Buffer[Symbol.species];
	t.exports = class extends n {
		constructor(e = {}) {
			super(), this._allowSynchronousEvents = e.allowSynchronousEvents === void 0 || e.allowSynchronousEvents, this._binaryType = e.binaryType || i[0], this._extensions = e.extensions || {}, this._isServer = !!e.isServer, this._maxBufferedChunks = e.maxBufferedChunks | 0, this._maxFragments = e.maxFragments | 0, this._maxPayload = e.maxPayload | 0, this._skipUTF8Validation = !!e.skipUTF8Validation, this[s] = void 0, this._bufferedBytes = 0, this._buffers = [], this._compressed = !1, this._payloadLength = 0, this._mask = void 0, this._fragmented = 0, this._masked = !1, this._fin = !1, this._opcode = 0, this._totalPayloadLength = 0, this._messageLength = 0, this._numFragments = 0, this._fragments = [], this._errored = !1, this._loop = !1, this._state = 0;
		}
		_write(e, t, n) {
			if (this._opcode === 8 && this._state == 0) return n();
			if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
				n(this.createError(RangeError, `Too many buffered chunks`, !1, 1008, `WS_ERR_TOO_MANY_BUFFERED_PARTS`));
				return;
			}
			this._bufferedBytes += e.length, this._buffers.push(e), this.startLoop(n);
		}
		consume(e) {
			if (this._bufferedBytes -= e, e === this._buffers[0].length) return this._buffers.shift();
			if (e < this._buffers[0].length) {
				let t = this._buffers[0];
				return this._buffers[0] = new v(t.buffer, t.byteOffset + e, t.length - e), new v(t.buffer, t.byteOffset, e);
			}
			let t = Buffer.allocUnsafe(e);
			do {
				let n = this._buffers[0], r = t.length - e;
				e >= n.length ? t.set(this._buffers.shift(), r) : (t.set(new Uint8Array(n.buffer, n.byteOffset, e), r), this._buffers[0] = new v(n.buffer, n.byteOffset + e, n.length - e)), e -= n.length;
			} while (e > 0);
			return t;
		}
		startLoop(e) {
			this._loop = !0;
			do
				switch (this._state) {
					case 0:
						this.getInfo(e);
						break;
					case 1:
						this.getPayloadLength16(e);
						break;
					case 2:
						this.getPayloadLength64(e);
						break;
					case 3:
						this.getMask();
						break;
					case 4:
						this.getData(e);
						break;
					case 5:
					case 6:
						this._loop = !1;
						return;
				}
			while (this._loop);
			this._errored || e();
		}
		getInfo(e) {
			if (this._bufferedBytes < 2) {
				this._loop = !1;
				return;
			}
			let t = this.consume(2);
			if (t[0] & 48) {
				e(this.createError(RangeError, `RSV2 and RSV3 must be clear`, !0, 1002, `WS_ERR_UNEXPECTED_RSV_2_3`));
				return;
			}
			let n = (t[0] & 64) == 64;
			if (n && !this._extensions[r.extensionName]) {
				e(this.createError(RangeError, `RSV1 must be clear`, !0, 1002, `WS_ERR_UNEXPECTED_RSV_1`));
				return;
			}
			if (this._fin = (t[0] & 128) == 128, this._opcode = t[0] & 15, this._payloadLength = t[1] & 127, this._opcode === 0) {
				if (n) {
					e(this.createError(RangeError, `RSV1 must be clear`, !0, 1002, `WS_ERR_UNEXPECTED_RSV_1`));
					return;
				}
				if (!this._fragmented) {
					e(this.createError(RangeError, `invalid opcode 0`, !0, 1002, `WS_ERR_INVALID_OPCODE`));
					return;
				}
				this._opcode = this._fragmented;
			} else if (this._opcode === 1 || this._opcode === 2) {
				if (this._fragmented) {
					e(this.createError(RangeError, `invalid opcode ${this._opcode}`, !0, 1002, `WS_ERR_INVALID_OPCODE`));
					return;
				}
				this._compressed = n;
			} else if (this._opcode > 7 && this._opcode < 11) {
				if (!this._fin) {
					e(this.createError(RangeError, `FIN must be set`, !0, 1002, `WS_ERR_EXPECTED_FIN`));
					return;
				}
				if (n) {
					e(this.createError(RangeError, `RSV1 must be clear`, !0, 1002, `WS_ERR_UNEXPECTED_RSV_1`));
					return;
				}
				if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
					e(this.createError(RangeError, `invalid payload length ${this._payloadLength}`, !0, 1002, `WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH`));
					return;
				}
			} else {
				e(this.createError(RangeError, `invalid opcode ${this._opcode}`, !0, 1002, `WS_ERR_INVALID_OPCODE`));
				return;
			}
			if (!this._fin && !this._fragmented && (this._fragmented = this._opcode), this._masked = (t[1] & 128) == 128, this._isServer) {
				if (!this._masked) {
					e(this.createError(RangeError, `MASK must be set`, !0, 1002, `WS_ERR_EXPECTED_MASK`));
					return;
				}
			} else if (this._masked) {
				e(this.createError(RangeError, `MASK must be clear`, !0, 1002, `WS_ERR_UNEXPECTED_MASK`));
				return;
			}
			this._payloadLength === 126 ? this._state = 1 : this._payloadLength === 127 ? this._state = 2 : this.haveLength(e);
		}
		getPayloadLength16(e) {
			if (this._bufferedBytes < 2) {
				this._loop = !1;
				return;
			}
			this._payloadLength = this.consume(2).readUInt16BE(0), this.haveLength(e);
		}
		getPayloadLength64(e) {
			if (this._bufferedBytes < 8) {
				this._loop = !1;
				return;
			}
			let t = this.consume(8), n = t.readUInt32BE(0);
			if (n > 2 ** 21 - 1) {
				e(this.createError(RangeError, `Unsupported WebSocket frame: payload length > 2^53 - 1`, !1, 1009, `WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH`));
				return;
			}
			this._payloadLength = n * 2 ** 32 + t.readUInt32BE(4), this.haveLength(e);
		}
		haveLength(e) {
			if (this._payloadLength && this._opcode < 8 && (this._totalPayloadLength += this._payloadLength, this._totalPayloadLength > this._maxPayload && this._maxPayload > 0)) {
				e(this.createError(RangeError, `Max payload size exceeded`, !1, 1009, `WS_ERR_UNSUPPORTED_MESSAGE_LENGTH`));
				return;
			}
			this._state = this._masked ? 3 : 4;
		}
		getMask() {
			if (this._bufferedBytes < 4) {
				this._loop = !1;
				return;
			}
			this._mask = this.consume(4), this._state = 4;
		}
		getData(e) {
			let t = a;
			if (this._payloadLength) {
				if (this._bufferedBytes < this._payloadLength) {
					this._loop = !1;
					return;
				}
				t = this.consume(this._payloadLength), this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0 && p(t, this._mask);
			}
			if (this._opcode > 7) {
				this.controlMessage(t, e);
				return;
			}
			if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
				e(this.createError(RangeError, `Too many message fragments`, !1, 1008, `WS_ERR_TOO_MANY_BUFFERED_PARTS`));
				return;
			}
			if (this._compressed) {
				this._state = 5, this.decompress(t, e);
				return;
			}
			t.length && (this._messageLength = this._totalPayloadLength, this._fragments.push(t)), this.dataMessage(e);
		}
		decompress(e, t) {
			this._extensions[r.extensionName].decompress(e, this._fin, (e, n) => {
				if (e) return t(e);
				if (n.length) {
					if (this._messageLength += n.length, this._messageLength > this._maxPayload && this._maxPayload > 0) {
						t(this.createError(RangeError, `Max payload size exceeded`, !1, 1009, `WS_ERR_UNSUPPORTED_MESSAGE_LENGTH`));
						return;
					}
					this._fragments.push(n);
				}
				this.dataMessage(t), this._state === 0 && this.startLoop(t);
			});
		}
		dataMessage(e) {
			if (!this._fin) {
				this._state = 0;
				return;
			}
			let t = this._messageLength, n = this._fragments;
			if (this._totalPayloadLength = 0, this._messageLength = 0, this._fragmented = 0, this._numFragments = 0, this._fragments = [], this._opcode === 2) {
				let r;
				r = this._binaryType === `nodebuffer` ? c(n, t) : this._binaryType === `arraybuffer` ? l(c(n, t)) : this._binaryType === `blob` ? new Blob(n) : n, this._allowSynchronousEvents ? (this.emit(`message`, r, !0), this._state = 0) : (this._state = 6, setImmediate(() => {
					this.emit(`message`, r, !0), this._state = 0, this.startLoop(e);
				}));
			} else {
				let r = c(n, t);
				if (!this._skipUTF8Validation && !_(r)) {
					e(this.createError(Error, `invalid UTF-8 sequence`, !0, 1007, `WS_ERR_INVALID_UTF8`));
					return;
				}
				this._state === 5 || this._allowSynchronousEvents ? (this.emit(`message`, r, !1), this._state = 0) : (this._state = 6, setImmediate(() => {
					this.emit(`message`, r, !1), this._state = 0, this.startLoop(e);
				}));
			}
		}
		controlMessage(e, t) {
			if (this._opcode === 8) {
				if (e.length === 0) this._loop = !1, this.emit(`conclude`, 1005, a), this.end();
				else {
					let n = e.readUInt16BE(0);
					if (!g(n)) {
						t(this.createError(RangeError, `invalid status code ${n}`, !0, 1002, `WS_ERR_INVALID_CLOSE_CODE`));
						return;
					}
					let r = new v(e.buffer, e.byteOffset + 2, e.length - 2);
					if (!this._skipUTF8Validation && !_(r)) {
						t(this.createError(Error, `invalid UTF-8 sequence`, !0, 1007, `WS_ERR_INVALID_UTF8`));
						return;
					}
					this._loop = !1, this.emit(`conclude`, n, r), this.end();
				}
				this._state = 0;
				return;
			}
			this._allowSynchronousEvents ? (this.emit(this._opcode === 9 ? `ping` : `pong`, e), this._state = 0) : (this._state = 6, setImmediate(() => {
				this.emit(this._opcode === 9 ? `ping` : `pong`, e), this._state = 0, this.startLoop(t);
			}));
		}
		createError(e, t, n, r, i) {
			this._loop = !1, this._errored = !0;
			let a = new e(n ? `Invalid WebSocket frame: ${t}` : t);
			return Error.captureStackTrace(a, this.createError), a.code = i, a[o] = r, a;
		}
	};
}));
var _ = s(((e, t) => {
	let { Duplex: n } = u(`stream`), { randomFillSync: r } = u(`crypto`), { types: { isUint8Array: i } } = u(`util`), a = m(), { EMPTY_BUFFER: o, kWebSocket: s, NOOP: c } = d(), { isBlob: l, isValidStatusCode: p } = h(), { mask: g, toBuffer: _ } = f(), v = Symbol(`kByteLength`), y = Buffer.alloc(4), b = 8192, x, S = b;
	t.exports = class e {
		constructor(e, t, n) {
			this._extensions = t || {}, n && (this._generateMask = n, this._maskBuffer = Buffer.alloc(4)), this._socket = e, this._firstFragment = !0, this._compress = !1, this._bufferedBytes = 0, this._queue = [], this._state = 0, this.onerror = c, this[s] = void 0;
		}
		static frame(e, t) {
			let n, i = !1, a = 2, o = !1;
			t.mask && (n = t.maskBuffer || y, t.generateMask ? t.generateMask(n) : (S === b && (x === void 0 && (x = Buffer.alloc(b)), r(x, 0, b), S = 0), n[0] = x[S++], n[1] = x[S++], n[2] = x[S++], n[3] = x[S++]), o = (n[0] | n[1] | n[2] | n[3]) === 0, a = 6);
			let s;
			typeof e == `string` ? (!t.mask || o) && t[v] !== void 0 ? s = t[v] : (e = Buffer.from(e), s = e.length) : (s = e.length, i = t.mask && t.readOnly && !o);
			let c = s;
			s >= 65536 ? (a += 8, c = 127) : s > 125 && (a += 2, c = 126);
			let l = Buffer.allocUnsafe(i ? s + a : a);
			return l[0] = t.fin ? t.opcode | 128 : t.opcode, t.rsv1 && (l[0] |= 64), l[1] = c, c === 126 ? l.writeUInt16BE(s, 2) : c === 127 && (l[2] = l[3] = 0, l.writeUIntBE(s, 4, 6)), !t.mask || (l[1] |= 128, l[a - 4] = n[0], l[a - 3] = n[1], l[a - 2] = n[2], l[a - 1] = n[3], o) ? [l, e] : i ? (g(e, n, l, a, s), [l]) : (g(e, n, e, 0, s), [l, e]);
		}
		close(t, n, r, a) {
			let s;
			if (t === void 0) s = o;
			else if (typeof t != `number` || !p(t)) throw TypeError(`First argument must be a valid error code number`);
			else if (n === void 0 || !n.length) s = Buffer.allocUnsafe(2), s.writeUInt16BE(t, 0);
			else {
				let e = Buffer.byteLength(n);
				if (e > 123) throw RangeError(`The message must not be greater than 123 bytes`);
				if (s = Buffer.allocUnsafe(2 + e), s.writeUInt16BE(t, 0), typeof n == `string`) s.write(n, 2);
				else if (i(n)) s.set(n, 2);
				else throw TypeError(`Second argument must be a string or a Uint8Array`);
			}
			let c = {
				[v]: s.length,
				fin: !0,
				generateMask: this._generateMask,
				mask: r,
				maskBuffer: this._maskBuffer,
				opcode: 8,
				readOnly: !1,
				rsv1: !1
			};
			this._state === 0 ? this.sendFrame(e.frame(s, c), a) : this.enqueue([
				this.dispatch,
				s,
				!1,
				c,
				a
			]);
		}
		ping(t, n, r) {
			let i, a;
			if (typeof t == `string` ? (i = Buffer.byteLength(t), a = !1) : l(t) ? (i = t.size, a = !1) : (t = _(t), i = t.length, a = _.readOnly), i > 125) throw RangeError(`The data size must not be greater than 125 bytes`);
			let o = {
				[v]: i,
				fin: !0,
				generateMask: this._generateMask,
				mask: n,
				maskBuffer: this._maskBuffer,
				opcode: 9,
				readOnly: a,
				rsv1: !1
			};
			l(t) ? this._state === 0 ? this.getBlobData(t, !1, o, r) : this.enqueue([
				this.getBlobData,
				t,
				!1,
				o,
				r
			]) : this._state === 0 ? this.sendFrame(e.frame(t, o), r) : this.enqueue([
				this.dispatch,
				t,
				!1,
				o,
				r
			]);
		}
		pong(t, n, r) {
			let i, a;
			if (typeof t == `string` ? (i = Buffer.byteLength(t), a = !1) : l(t) ? (i = t.size, a = !1) : (t = _(t), i = t.length, a = _.readOnly), i > 125) throw RangeError(`The data size must not be greater than 125 bytes`);
			let o = {
				[v]: i,
				fin: !0,
				generateMask: this._generateMask,
				mask: n,
				maskBuffer: this._maskBuffer,
				opcode: 10,
				readOnly: a,
				rsv1: !1
			};
			l(t) ? this._state === 0 ? this.getBlobData(t, !1, o, r) : this.enqueue([
				this.getBlobData,
				t,
				!1,
				o,
				r
			]) : this._state === 0 ? this.sendFrame(e.frame(t, o), r) : this.enqueue([
				this.dispatch,
				t,
				!1,
				o,
				r
			]);
		}
		send(e, t, n) {
			let r = this._extensions[a.extensionName], i = t.binary ? 2 : 1, o = t.compress, s, c;
			typeof e == `string` ? (s = Buffer.byteLength(e), c = !1) : l(e) ? (s = e.size, c = !1) : (e = _(e), s = e.length, c = _.readOnly), this._firstFragment ? (this._firstFragment = !1, o && r && r.params[r._isServer ? `server_no_context_takeover` : `client_no_context_takeover`] && (o = s >= r._threshold), this._compress = o) : (o = !1, i = 0), t.fin && (this._firstFragment = !0);
			let u = {
				[v]: s,
				fin: t.fin,
				generateMask: this._generateMask,
				mask: t.mask,
				maskBuffer: this._maskBuffer,
				opcode: i,
				readOnly: c,
				rsv1: o
			};
			l(e) ? this._state === 0 ? this.getBlobData(e, this._compress, u, n) : this.enqueue([
				this.getBlobData,
				e,
				this._compress,
				u,
				n
			]) : this._state === 0 ? this.dispatch(e, this._compress, u, n) : this.enqueue([
				this.dispatch,
				e,
				this._compress,
				u,
				n
			]);
		}
		getBlobData(t, n, r, i) {
			this._bufferedBytes += r[v], this._state = 2, t.arrayBuffer().then((t) => {
				if (this._socket.destroyed) {
					let e = Error(`The socket was closed while the blob was being read`);
					process.nextTick(C, this, e, i);
					return;
				}
				this._bufferedBytes -= r[v];
				let a = _(t);
				n ? this.dispatch(a, n, r, i) : (this._state = 0, this.sendFrame(e.frame(a, r), i), this.dequeue());
			}).catch((e) => {
				process.nextTick(w, this, e, i);
			});
		}
		dispatch(t, n, r, i) {
			if (!n) {
				this.sendFrame(e.frame(t, r), i);
				return;
			}
			let o = this._extensions[a.extensionName];
			this._bufferedBytes += r[v], this._state = 1, o.compress(t, r.fin, (t, n) => {
				if (this._socket.destroyed) {
					let e = Error(`The socket was closed while data was being compressed`);
					C(this, e, i);
					return;
				}
				this._bufferedBytes -= r[v], this._state = 0, r.readOnly = !1, this.sendFrame(e.frame(n, r), i), this.dequeue();
			});
		}
		dequeue() {
			for (; this._state === 0 && this._queue.length;) {
				let e = this._queue.shift();
				this._bufferedBytes -= e[3][v], Reflect.apply(e[0], this, e.slice(1));
			}
		}
		enqueue(e) {
			this._bufferedBytes += e[3][v], this._queue.push(e);
		}
		sendFrame(e, t) {
			e.length === 2 ? (this._socket.cork(), this._socket.write(e[0]), this._socket.write(e[1], t), this._socket.uncork()) : this._socket.write(e[0], t);
		}
	};
	function C(e, t, n) {
		typeof n == `function` && n(t);
		for (let n = 0; n < e._queue.length; n++) {
			let r = e._queue[n], i = r[r.length - 1];
			typeof i == `function` && i(t);
		}
	}
	function w(e, t, n) {
		C(e, t, n), e.onerror(t);
	}
}));
var v = s(((e, t) => {
	let { kForOnEventAttribute: n, kListener: r } = d(), i = Symbol(`kCode`), a = Symbol(`kData`), o = Symbol(`kError`), s = Symbol(`kMessage`), c = Symbol(`kReason`), l = Symbol(`kTarget`), u = Symbol(`kType`), f = Symbol(`kWasClean`);
	var p = class {
		constructor(e) {
			this[l] = null, this[u] = e;
		}
		get target() {
			return this[l];
		}
		get type() {
			return this[u];
		}
	};
	Object.defineProperty(p.prototype, "target", { enumerable: !0 }), Object.defineProperty(p.prototype, "type", { enumerable: !0 });
	var m = class extends p {
		constructor(e, t = {}) {
			super(e), this[i] = t.code === void 0 ? 0 : t.code, this[c] = t.reason === void 0 ? `` : t.reason, this[f] = t.wasClean !== void 0 && t.wasClean;
		}
		get code() {
			return this[i];
		}
		get reason() {
			return this[c];
		}
		get wasClean() {
			return this[f];
		}
	};
	Object.defineProperty(m.prototype, "code", { enumerable: !0 }), Object.defineProperty(m.prototype, "reason", { enumerable: !0 }), Object.defineProperty(m.prototype, "wasClean", { enumerable: !0 });
	var h = class extends p {
		constructor(e, t = {}) {
			super(e), this[o] = t.error === void 0 ? null : t.error, this[s] = t.message === void 0 ? `` : t.message;
		}
		get error() {
			return this[o];
		}
		get message() {
			return this[s];
		}
	};
	Object.defineProperty(h.prototype, "error", { enumerable: !0 }), Object.defineProperty(h.prototype, "message", { enumerable: !0 });
	var g = class extends p {
		constructor(e, t = {}) {
			super(e), this[a] = t.data === void 0 ? null : t.data;
		}
		get data() {
			return this[a];
		}
	};
	Object.defineProperty(g.prototype, "data", { enumerable: !0 }), t.exports = {
		CloseEvent: m,
		ErrorEvent: h,
		Event: p,
		EventTarget: {
			addEventListener(e, t, i = {}) {
				for (let a of this.listeners(e)) if (!i[n] && a[r] === t && !a[n]) return;
				let a;
				if (e === `message`) a = function(e, n) {
					let r = new g(`message`, { data: n ? e : e.toString() });
					r[l] = this, _(t, this, r);
				};
				else if (e === `close`) a = function(e, n) {
					let r = new m(`close`, {
						code: e,
						reason: n.toString(),
						wasClean: this._closeFrameReceived && this._closeFrameSent
					});
					r[l] = this, _(t, this, r);
				};
				else if (e === `error`) a = function(e) {
					let n = new h(`error`, {
						error: e,
						message: e.message
					});
					n[l] = this, _(t, this, n);
				};
				else if (e === `open`) a = function() {
					let e = new p(`open`);
					e[l] = this, _(t, this, e);
				};
				else return;
				a[n] = !!i[n], a[r] = t, i.once ? this.once(e, a) : this.on(e, a);
			},
			removeEventListener(e, t) {
				for (let i of this.listeners(e)) if (i[r] === t && !i[n]) {
					this.removeListener(e, i);
					break;
				}
			}
		},
		MessageEvent: g
	};
	function _(e, t, n) {
		typeof e == `object` && e.handleEvent ? e.handleEvent.call(e, n) : e.call(t, n);
	}
}));
var y = s(((e, t) => {
	let { tokenChars: n } = h();
	function r(e, t, n) {
		e[t] === void 0 ? e[t] = [n] : e[t].push(n);
	}
	function i(e) {
		let t = Object.create(null), i = Object.create(null), a = !1, o = !1, s = !1, c, l, u = -1, d = -1, f = -1, p = 0;
		for (; p < e.length; p++) if (d = e.charCodeAt(p), c === void 0) {
			if (f === -1 && n[d] === 1) u === -1 && (u = p);
			else if (p !== 0 && (d === 32 || d === 9)) f === -1 && u !== -1 && (f = p);
			else if (d === 59 || d === 44) {
				if (u === -1) throw SyntaxError(`Unexpected character at index ${p}`);
				f === -1 && (f = p);
				let n = e.slice(u, f);
				d === 44 ? (r(t, n, i), i = Object.create(null)) : c = n, u = f = -1;
			} else throw SyntaxError(`Unexpected character at index ${p}`);
		} else if (l === void 0) {
			if (f === -1 && n[d] === 1) u === -1 && (u = p);
			else if (d === 32 || d === 9) f === -1 && u !== -1 && (f = p);
			else if (d === 59 || d === 44) {
				if (u === -1) throw SyntaxError(`Unexpected character at index ${p}`);
				f === -1 && (f = p), r(i, e.slice(u, f), !0), d === 44 && (r(t, c, i), i = Object.create(null), c = void 0), u = f = -1;
			} else if (d === 61 && u !== -1 && f === -1) l = e.slice(u, p), u = f = -1;
			else throw SyntaxError(`Unexpected character at index ${p}`);
		} else if (o) {
			if (n[d] !== 1) throw SyntaxError(`Unexpected character at index ${p}`);
			u === -1 ? u = p : a ||= !0, o = !1;
		} else if (s) {
			if (n[d] === 1) u === -1 && (u = p);
			else if (d === 34 && u !== -1) s = !1, f = p;
			else if (d === 92) o = !0;
			else throw SyntaxError(`Unexpected character at index ${p}`);
		} else if (d === 34 && e.charCodeAt(p - 1) === 61) s = !0;
		else if (f === -1 && n[d] === 1) u === -1 && (u = p);
		else if (u !== -1 && (d === 32 || d === 9)) f === -1 && (f = p);
		else if (d === 59 || d === 44) {
			if (u === -1) throw SyntaxError(`Unexpected character at index ${p}`);
			f === -1 && (f = p);
			let n = e.slice(u, f);
			a &&= (n = n.replace(/\\/g, ``), !1), r(i, l, n), d === 44 && (r(t, c, i), i = Object.create(null), c = void 0), l = void 0, u = f = -1;
		} else throw SyntaxError(`Unexpected character at index ${p}`);
		if (u === -1 || s || d === 32 || d === 9) throw SyntaxError(`Unexpected end of input`);
		f === -1 && (f = p);
		let m = e.slice(u, f);
		return c === void 0 ? r(t, m, i) : (l === void 0 ? r(i, m, !0) : a ? r(i, l, m.replace(/\\/g, ``)) : r(i, l, m), r(t, c, i)), t;
	}
	function a(e) {
		return Object.keys(e).map((t) => {
			let n = e[t];
			return Array.isArray(n) || (n = [n]), n.map((e) => [t].concat(Object.keys(e).map((t) => {
				let n = e[t];
				return Array.isArray(n) || (n = [n]), n.map((e) => e === !0 ? t : `${t}=${e}`).join(`; `);
			})).join(`; `)).join(`, `);
		}).join(`, `);
	}
	t.exports = {
		format: a,
		parse: i
	};
}));
var b = s(((e, t) => {
	let n = u(`events`), r = u(`https`), i = u(`http`), a = u(`net`), o = u(`tls`), { randomBytes: s, createHash: c } = u(`crypto`), { Duplex: l, Readable: p } = u(`stream`), { URL: b } = u(`url`), x = m(), S = g(), C = _(), { isBlob: w } = h(), { BINARY_TYPES: T, CLOSE_TIMEOUT: E, EMPTY_BUFFER: D, GUID: O, kForOnEventAttribute: k, kListener: A, kStatusCode: j, kWebSocket: M, NOOP: N } = d(), { EventTarget: { addEventListener: ee, removeEventListener: te } } = v(), { format: ne, parse: P } = y(), { toBuffer: F } = f(), I = Symbol(`kAborted`), L = [8, 13], R = [
		`CONNECTING`,
		`OPEN`,
		`CLOSING`,
		`CLOSED`
	], z = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
	var B = class e extends n {
		constructor(t, n, r) {
			super(), this._binaryType = T[0], this._closeCode = 1006, this._closeFrameReceived = !1, this._closeFrameSent = !1, this._closeMessage = D, this._closeTimer = null, this._errorEmitted = !1, this._extensions = {}, this._paused = !1, this._protocol = ``, this._readyState = e.CONNECTING, this._receiver = null, this._sender = null, this._socket = null, t === null ? (this._autoPong = r.autoPong, this._closeTimeout = r.closeTimeout, this._isServer = !0) : (this._bufferedAmount = 0, this._isServer = !1, this._redirects = 0, n === void 0 ? n = [] : Array.isArray(n) || (typeof n == `object` && n ? (r = n, n = []) : n = [n]), V(this, t, n, r));
		}
		get binaryType() {
			return this._binaryType;
		}
		set binaryType(e) {
			T.includes(e) && (this._binaryType = e, this._receiver && (this._receiver._binaryType = e));
		}
		get bufferedAmount() {
			return this._socket ? this._socket._writableState.length + this._sender._bufferedBytes : this._bufferedAmount;
		}
		get extensions() {
			return Object.keys(this._extensions).join();
		}
		get isPaused() {
			return this._paused;
		}
		get onclose() {
			return null;
		}
		get onerror() {
			return null;
		}
		get onopen() {
			return null;
		}
		get onmessage() {
			return null;
		}
		get protocol() {
			return this._protocol;
		}
		get readyState() {
			return this._readyState;
		}
		get url() {
			return this._url;
		}
		setSocket(t, n, r) {
			let i = new S({
				allowSynchronousEvents: r.allowSynchronousEvents,
				binaryType: this.binaryType,
				extensions: this._extensions,
				isServer: this._isServer,
				maxBufferedChunks: r.maxBufferedChunks,
				maxFragments: r.maxFragments,
				maxPayload: r.maxPayload,
				skipUTF8Validation: r.skipUTF8Validation
			}), a = new C(t, this._extensions, r.generateMask);
			this._receiver = i, this._sender = a, this._socket = t, i[M] = this, a[M] = this, t[M] = this, i.on(`conclude`, re), i.on(`drain`, ie), i.on(`error`, ae), i.on(`message`, oe), i.on(`ping`, se), i.on(`pong`, ce), a.onerror = le, t.setTimeout && t.setTimeout(0), t.setNoDelay && t.setNoDelay(), n.length > 0 && t.unshift(n), t.on(`close`, X), t.on(`data`, Z), t.on(`end`, Q), t.on(`error`, $), this._readyState = e.OPEN, this.emit(`open`);
		}
		emitClose() {
			if (!this._socket) {
				this._readyState = e.CLOSED, this.emit(`close`, this._closeCode, this._closeMessage);
				return;
			}
			this._extensions[x.extensionName] && this._extensions[x.extensionName].cleanup(), this._receiver.removeAllListeners(), this._readyState = e.CLOSED, this.emit(`close`, this._closeCode, this._closeMessage);
		}
		close(t, n) {
			if (this.readyState !== e.CLOSED) {
				if (this.readyState === e.CONNECTING) {
					G(this, this._req, `WebSocket was closed before the connection was established`);
					return;
				}
				if (this.readyState === e.CLOSING) {
					this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted) && this._socket.end();
					return;
				}
				this._readyState = e.CLOSING, this._sender.close(t, n, !this._isServer, (e) => {
					e || (this._closeFrameSent = !0, (this._closeFrameReceived || this._receiver._writableState.errorEmitted) && this._socket.end());
				}), Y(this);
			}
		}
		pause() {
			this.readyState !== e.CONNECTING && this.readyState !== e.CLOSED && (this._paused = !0, this._socket.pause());
		}
		ping(t, n, r) {
			if (this.readyState === e.CONNECTING) throw Error(`WebSocket is not open: readyState 0 (CONNECTING)`);
			if (typeof t == `function` ? (r = t, t = n = void 0) : typeof n == `function` && (r = n, n = void 0), typeof t == `number` && (t = t.toString()), this.readyState !== e.OPEN) {
				K(this, t, r);
				return;
			}
			n === void 0 && (n = !this._isServer), this._sender.ping(t || D, n, r);
		}
		pong(t, n, r) {
			if (this.readyState === e.CONNECTING) throw Error(`WebSocket is not open: readyState 0 (CONNECTING)`);
			if (typeof t == `function` ? (r = t, t = n = void 0) : typeof n == `function` && (r = n, n = void 0), typeof t == `number` && (t = t.toString()), this.readyState !== e.OPEN) {
				K(this, t, r);
				return;
			}
			n === void 0 && (n = !this._isServer), this._sender.pong(t || D, n, r);
		}
		resume() {
			this.readyState !== e.CONNECTING && this.readyState !== e.CLOSED && (this._paused = !1, this._receiver._writableState.needDrain || this._socket.resume());
		}
		send(t, n, r) {
			if (this.readyState === e.CONNECTING) throw Error(`WebSocket is not open: readyState 0 (CONNECTING)`);
			if (typeof n == `function` && (r = n, n = {}), typeof t == `number` && (t = t.toString()), this.readyState !== e.OPEN) {
				K(this, t, r);
				return;
			}
			let i = {
				binary: typeof t != `string`,
				mask: !this._isServer,
				compress: !0,
				fin: !0,
				...n
			};
			this._extensions[x.extensionName] || (i.compress = !1), this._sender.send(t || D, i, r);
		}
		terminate() {
			if (this.readyState !== e.CLOSED) {
				if (this.readyState === e.CONNECTING) {
					G(this, this._req, `WebSocket was closed before the connection was established`);
					return;
				}
				this._socket && (this._readyState = e.CLOSING, this._socket.destroy());
			}
		}
	};
	Object.defineProperty(B, "CONNECTING", {
		enumerable: !0,
		value: R.indexOf(`CONNECTING`)
	}), Object.defineProperty(B.prototype, "CONNECTING", {
		enumerable: !0,
		value: R.indexOf(`CONNECTING`)
	}), Object.defineProperty(B, "OPEN", {
		enumerable: !0,
		value: R.indexOf(`OPEN`)
	}), Object.defineProperty(B.prototype, "OPEN", {
		enumerable: !0,
		value: R.indexOf(`OPEN`)
	}), Object.defineProperty(B, "CLOSING", {
		enumerable: !0,
		value: R.indexOf(`CLOSING`)
	}), Object.defineProperty(B.prototype, "CLOSING", {
		enumerable: !0,
		value: R.indexOf(`CLOSING`)
	}), Object.defineProperty(B, "CLOSED", {
		enumerable: !0,
		value: R.indexOf(`CLOSED`)
	}), Object.defineProperty(B.prototype, "CLOSED", {
		enumerable: !0,
		value: R.indexOf(`CLOSED`)
	}), [
		`binaryType`,
		`bufferedAmount`,
		`extensions`,
		`isPaused`,
		`protocol`,
		`readyState`,
		`url`
	].forEach((e) => {
		Object.defineProperty(B.prototype, e, { enumerable: !0 });
	}), [
		`open`,
		`error`,
		`close`,
		`message`
	].forEach((e) => {
		Object.defineProperty(B.prototype, `on${e}`, {
			enumerable: !0,
			get() {
				for (let t of this.listeners(e)) if (t[k]) return t[A];
				return null;
			},
			set(t) {
				for (let t of this.listeners(e)) if (t[k]) {
					this.removeListener(e, t);
					break;
				}
				typeof t == `function` && this.addEventListener(e, t, { [k]: !0 });
			}
		});
	}), B.prototype.addEventListener = ee, B.prototype.removeEventListener = te, t.exports = B;
	function V(e, t, n, a) {
		let o = {
			allowSynchronousEvents: !0,
			autoPong: !0,
			closeTimeout: E,
			protocolVersion: L[1],
			maxBufferedChunks: 262144,
			maxFragments: 16384,
			maxPayload: 104857600,
			skipUTF8Validation: !1,
			perMessageDeflate: !0,
			followRedirects: !1,
			maxRedirects: 10,
			...a,
			socketPath: void 0,
			hostname: void 0,
			protocol: void 0,
			timeout: void 0,
			method: `GET`,
			host: void 0,
			path: void 0,
			port: void 0
		};
		if (e._autoPong = o.autoPong, e._closeTimeout = o.closeTimeout, !L.includes(o.protocolVersion)) throw RangeError(`Unsupported protocol version: ${o.protocolVersion} (supported versions: ${L.join(`, `)})`);
		let l;
		if (t instanceof b) l = t;
		else try {
			l = new b(t);
		} catch {
			throw SyntaxError(`Invalid URL: ${t}`);
		}
		l.protocol === `http:` ? l.protocol = `ws:` : l.protocol === `https:` && (l.protocol = `wss:`), e._url = l.href;
		let u = l.protocol === `wss:`, d = l.protocol === `ws+unix:`, f;
		if (l.protocol !== `ws:` && !u && !d ? f = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"` : d && !l.pathname ? f = `The URL's pathname is empty` : l.hash && (f = `The URL contains a fragment identifier`), f) {
			let t = SyntaxError(f);
			if (e._redirects === 0) throw t;
			H(e, t);
			return;
		}
		let p = u ? 443 : 80, m = s(16).toString(`base64`), h = u ? r.request : i.request, g = /* @__PURE__ */ new Set(), _;
		if (o.createConnection = o.createConnection || (u ? W : U), o.defaultPort = o.defaultPort || p, o.port = l.port || p, o.host = l.hostname.startsWith(`[`) ? l.hostname.slice(1, -1) : l.hostname, o.headers = {
			...o.headers,
			"Sec-WebSocket-Version": o.protocolVersion,
			"Sec-WebSocket-Key": m,
			Connection: `Upgrade`,
			Upgrade: `websocket`
		}, o.path = l.pathname + l.search, o.timeout = o.handshakeTimeout, o.perMessageDeflate && (_ = new x({
			...o.perMessageDeflate,
			isServer: !1,
			maxPayload: o.maxPayload
		}), o.headers[`Sec-WebSocket-Extensions`] = ne({ [x.extensionName]: _.offer() })), n.length) {
			for (let e of n) {
				if (typeof e != `string` || !z.test(e) || g.has(e)) throw SyntaxError(`An invalid or duplicated subprotocol was specified`);
				g.add(e);
			}
			o.headers[`Sec-WebSocket-Protocol`] = n.join(`,`);
		}
		if (o.origin && (o.protocolVersion < 13 ? o.headers[`Sec-WebSocket-Origin`] = o.origin : o.headers.Origin = o.origin), (l.username || l.password) && (o.auth = `${l.username}:${l.password}`), d) {
			let e = o.path.split(`:`);
			o.socketPath = e[0], o.path = e[1];
		}
		let v;
		if (o.followRedirects) {
			if (e._redirects === 0) {
				e._originalIpc = d, e._originalSecure = u, e._originalHostOrSocketPath = d ? o.socketPath : l.host;
				let t = a && a.headers;
				if (a = {
					...a,
					headers: {}
				}, t) for (let [e, n] of Object.entries(t)) a.headers[e.toLowerCase()] = n;
			} else if (e.listenerCount(`redirect`) === 0) {
				let t = d ? e._originalIpc ? o.socketPath === e._originalHostOrSocketPath : !1 : !e._originalIpc && l.host === e._originalHostOrSocketPath;
				(!t || e._originalSecure && !u) && (delete o.headers.authorization, delete o.headers.cookie, t || delete o.headers.host, o.auth = void 0);
			}
			o.auth && !a.headers.authorization && (a.headers.authorization = `Basic ` + Buffer.from(o.auth).toString(`base64`)), v = e._req = h(o), e._redirects && e.emit(`redirect`, e.url, v);
		} else v = e._req = h(o);
		o.timeout && v.on(`timeout`, () => {
			G(e, v, `Opening handshake has timed out`);
		}), v.on(`error`, (t) => {
			v === null || v[I] || (v = e._req = null, H(e, t));
		}), v.on(`response`, (r) => {
			let i = r.headers.location, s = r.statusCode;
			if (i && o.followRedirects && s >= 300 && s < 400) {
				if (++e._redirects > o.maxRedirects) {
					G(e, v, `Maximum redirects exceeded`);
					return;
				}
				v.abort();
				let r;
				try {
					r = new b(i, t);
				} catch {
					H(e, SyntaxError(`Invalid URL: ${i}`));
					return;
				}
				V(e, r, n, a);
			} else e.emit(`unexpected-response`, v, r) || G(e, v, `Unexpected server response: ${r.statusCode}`);
		}), v.on(`upgrade`, (t, n, r) => {
			if (e.emit(`upgrade`, t), e.readyState !== B.CONNECTING) return;
			v = e._req = null;
			let i = t.headers.upgrade;
			if (i === void 0 || i.toLowerCase() !== `websocket`) {
				G(e, n, `Invalid Upgrade header`);
				return;
			}
			let a = c(`sha1`).update(m + O).digest(`base64`);
			if (t.headers[`sec-websocket-accept`] !== a) {
				G(e, n, `Invalid Sec-WebSocket-Accept header`);
				return;
			}
			let s = t.headers[`sec-websocket-protocol`], l;
			if (s === void 0 ? g.size && (l = `Server sent no subprotocol`) : g.size ? g.has(s) || (l = `Server sent an invalid subprotocol`) : l = `Server sent a subprotocol but none was requested`, l) {
				G(e, n, l);
				return;
			}
			s && (e._protocol = s);
			let u = t.headers[`sec-websocket-extensions`];
			if (u !== void 0) {
				if (!_) {
					G(e, n, `Server sent a Sec-WebSocket-Extensions header but no extension was requested`);
					return;
				}
				let t;
				try {
					t = P(u);
				} catch {
					G(e, n, `Invalid Sec-WebSocket-Extensions header`);
					return;
				}
				let r = Object.keys(t);
				if (r.length !== 1 || r[0] !== x.extensionName) {
					G(e, n, `Server indicated an extension that was not requested`);
					return;
				}
				try {
					_.accept(t[x.extensionName]);
				} catch {
					G(e, n, `Invalid Sec-WebSocket-Extensions header`);
					return;
				}
				e._extensions[x.extensionName] = _;
			}
			e.setSocket(n, r, {
				allowSynchronousEvents: o.allowSynchronousEvents,
				generateMask: o.generateMask,
				maxBufferedChunks: o.maxBufferedChunks,
				maxFragments: o.maxFragments,
				maxPayload: o.maxPayload,
				skipUTF8Validation: o.skipUTF8Validation
			});
		}), o.finishRequest ? o.finishRequest(v, e) : v.end();
	}
	function H(e, t) {
		e._readyState = B.CLOSING, e._errorEmitted = !0, e.emit(`error`, t), e.emitClose();
	}
	function U(e) {
		return e.path = e.socketPath, a.connect(e);
	}
	function W(e) {
		return e.path = void 0, !e.servername && e.servername !== `` && (e.servername = a.isIP(e.host) ? `` : e.host), o.connect(e);
	}
	function G(e, t, n) {
		e._readyState = B.CLOSING;
		let r = Error(n);
		Error.captureStackTrace(r, G), t.setHeader ? (t[I] = !0, t.abort(), t.socket && !t.socket.destroyed && t.socket.destroy(), process.nextTick(H, e, r)) : (t.destroy(r), t.once(`error`, e.emit.bind(e, `error`)), t.once(`close`, e.emitClose.bind(e)));
	}
	function K(e, t, n) {
		if (t) {
			let n = w(t) ? t.size : F(t).length;
			e._socket ? e._sender._bufferedBytes += n : e._bufferedAmount += n;
		}
		if (n) {
			let t = Error(`WebSocket is not open: readyState ${e.readyState} (${R[e.readyState]})`);
			process.nextTick(n, t);
		}
	}
	function re(e, t) {
		let n = this[M];
		n._closeFrameReceived = !0, n._closeMessage = t, n._closeCode = e, n._socket[M] !== void 0 && (n._socket.removeListener(`data`, Z), process.nextTick(J, n._socket), e === 1005 ? n.close() : n.close(e, t));
	}
	function ie() {
		let e = this[M];
		e.isPaused || e._socket.resume();
	}
	function ae(e) {
		let t = this[M];
		t._socket[M] !== void 0 && (t._socket.removeListener(`data`, Z), process.nextTick(J, t._socket), t.close(e[j])), t._errorEmitted || (t._errorEmitted = !0, t.emit(`error`, e));
	}
	function q() {
		this[M].emitClose();
	}
	function oe(e, t) {
		this[M].emit(`message`, e, t);
	}
	function se(e) {
		let t = this[M];
		t._autoPong && t.pong(e, !this._isServer, N), t.emit(`ping`, e);
	}
	function ce(e) {
		this[M].emit(`pong`, e);
	}
	function J(e) {
		e.resume();
	}
	function le(e) {
		let t = this[M];
		t.readyState !== B.CLOSED && (t.readyState === B.OPEN && (t._readyState = B.CLOSING, Y(t)), this._socket.end(), t._errorEmitted || (t._errorEmitted = !0, t.emit(`error`, e)));
	}
	function Y(e) {
		e._closeTimer = setTimeout(e._socket.destroy.bind(e._socket), e._closeTimeout);
	}
	function X() {
		let e = this[M];
		if (this.removeListener(`close`, X), this.removeListener(`data`, Z), this.removeListener(`end`, Q), e._readyState = B.CLOSING, !this._readableState.endEmitted && !e._closeFrameReceived && !e._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
			let t = this.read(this._readableState.length);
			e._receiver.write(t);
		}
		e._receiver.end(), this[M] = void 0, clearTimeout(e._closeTimer), e._receiver._writableState.finished || e._receiver._writableState.errorEmitted ? e.emitClose() : (e._receiver.on(`error`, q), e._receiver.on(`finish`, q));
	}
	function Z(e) {
		this[M]._receiver.write(e) || this.pause();
	}
	function Q() {
		let e = this[M];
		e._readyState = B.CLOSING, e._receiver.end(), this.end();
	}
	function $() {
		let e = this[M];
		this.removeListener(`error`, $), this.on(`error`, N), e && (e._readyState = B.CLOSING, this.destroy());
	}
}));
var x = s(((e, t) => {
	b();
	let { Duplex: n } = u(`stream`);
	function r(e) {
		e.emit(`close`);
	}
	function i() {
		!this.destroyed && this._writableState.finished && this.destroy();
	}
	function a(e) {
		this.removeListener(`error`, a), this.destroy(), this.listenerCount(`error`) === 0 && this.emit(`error`, e);
	}
	function o(e, t) {
		let o = !0, s = new n({
			...t,
			autoDestroy: !1,
			emitClose: !1,
			objectMode: !1,
			writableObjectMode: !1
		});
		return e.on(`message`, function(t, n) {
			let r = !n && s._readableState.objectMode ? t.toString() : t;
			s.push(r) || e.pause();
		}), e.once(`error`, function(e) {
			s.destroyed || (o = !1, s.destroy(e));
		}), e.once(`close`, function() {
			s.destroyed || s.push(null);
		}), s._destroy = function(t, n) {
			if (e.readyState === e.CLOSED) {
				n(t), process.nextTick(r, s);
				return;
			}
			let i = !1;
			e.once(`error`, function(e) {
				i = !0, n(e);
			}), e.once(`close`, function() {
				i || n(t), process.nextTick(r, s);
			}), o && e.terminate();
		}, s._final = function(t) {
			if (e.readyState === e.CONNECTING) {
				e.once(`open`, function() {
					s._final(t);
				});
				return;
			}
			e._socket !== null && (e._socket._writableState.finished ? (t(), s._readableState.endEmitted && s.destroy()) : (e._socket.once(`finish`, function() {
				t();
			}), e.close()));
		}, s._read = function() {
			e.isPaused && e.resume();
		}, s._write = function(t, n, r) {
			if (e.readyState === e.CONNECTING) {
				e.once(`open`, function() {
					s._write(t, n, r);
				});
				return;
			}
			e.send(t, r);
		}, s.on(`end`, i), s.on(`error`, a), s;
	}
	t.exports = o;
}));
var S = s(((e, t) => {
	let { tokenChars: n } = h();
	function r(e) {
		let t = /* @__PURE__ */ new Set(), r = -1, i = -1, a = 0;
		for (; a < e.length; a++) {
			let o = e.charCodeAt(a);
			if (i === -1 && n[o] === 1) r === -1 && (r = a);
			else if (a !== 0 && (o === 32 || o === 9)) i === -1 && r !== -1 && (i = a);
			else if (o === 44) {
				if (r === -1) throw SyntaxError(`Unexpected character at index ${a}`);
				i === -1 && (i = a);
				let n = e.slice(r, i);
				if (t.has(n)) throw SyntaxError(`The "${n}" subprotocol is duplicated`);
				t.add(n), r = i = -1;
			} else throw SyntaxError(`Unexpected character at index ${a}`);
		}
		if (r === -1 || i !== -1) throw SyntaxError(`Unexpected end of input`);
		let o = e.slice(r, a);
		if (t.has(o)) throw SyntaxError(`The "${o}" subprotocol is duplicated`);
		return t.add(o), t;
	}
	t.exports = { parse: r };
}));
var C = s(((e, t) => {
	let n = u(`events`), r = u(`http`), { Duplex: i } = u(`stream`), { createHash: a } = u(`crypto`), o = y(), s = m(), c = S(), l = b(), { CLOSE_TIMEOUT: f, GUID: p, kWebSocket: h } = d(), g = /^[+/0-9A-Za-z]{22}==$/;
	t.exports = class extends n {
		constructor(e, t) {
			if (super(), e = {
				allowSynchronousEvents: !0,
				autoPong: !0,
				maxBufferedChunks: 262144,
				maxFragments: 16384,
				maxPayload: 104857600,
				skipUTF8Validation: !1,
				perMessageDeflate: !1,
				handleProtocols: null,
				clientTracking: !0,
				closeTimeout: f,
				verifyClient: null,
				noServer: !1,
				backlog: null,
				server: null,
				host: null,
				path: null,
				port: null,
				WebSocket: l,
				...e
			}, e.port == null && !e.server && !e.noServer || e.port != null && (e.server || e.noServer) || e.server && e.noServer) throw TypeError(`One and only one of the "port", "server", or "noServer" options must be specified`);
			if (e.port == null ? e.server && (this._server = e.server) : (this._server = r.createServer((e, t) => {
				let n = r.STATUS_CODES[426];
				t.writeHead(426, {
					"Content-Length": n.length,
					"Content-Type": `text/plain`
				}), t.end(n);
			}), this._server.listen(e.port, e.host, e.backlog, t)), this._server) {
				let e = this.emit.bind(this, `connection`);
				this._removeListeners = _(this._server, {
					listening: this.emit.bind(this, `listening`),
					error: this.emit.bind(this, `error`),
					upgrade: (t, n, r) => {
						this.handleUpgrade(t, n, r, e);
					}
				});
			}
			e.perMessageDeflate === !0 && (e.perMessageDeflate = {}), e.clientTracking && (this.clients = /* @__PURE__ */ new Set(), this._shouldEmitClose = !1), this.options = e, this._state = 0;
		}
		address() {
			if (this.options.noServer) throw Error(`The server is operating in "noServer" mode`);
			return this._server ? this._server.address() : null;
		}
		close(e) {
			if (this._state === 2) {
				e && this.once(`close`, () => {
					e(Error(`The server is not running`));
				}), process.nextTick(v, this);
				return;
			}
			if (e && this.once(`close`, e), this._state !== 1) {
				if (this._state = 1, this.options.noServer || this.options.server) this._server && (this._removeListeners(), this._removeListeners = this._server = null), this.clients && this.clients.size ? this._shouldEmitClose = !0 : process.nextTick(v, this);
				else {
					let e = this._server;
					this._removeListeners(), this._removeListeners = this._server = null, e.close(() => {
						v(this);
					});
				}
			}
		}
		shouldHandle(e) {
			if (this.options.path) {
				let t = e.url.indexOf(`?`);
				if ((t === -1 ? e.url : e.url.slice(0, t)) !== this.options.path) return !1;
			}
			return !0;
		}
		handleUpgrade(e, t, n, r) {
			t.on(`error`, x);
			let i = e.headers[`sec-websocket-key`], a = e.headers.upgrade, l = +e.headers[`sec-websocket-version`];
			if (e.method !== `GET`) {
				w(this, e, t, 405, `Invalid HTTP method`);
				return;
			}
			if (a === void 0 || a.toLowerCase() !== `websocket`) {
				w(this, e, t, 400, `Invalid Upgrade header`);
				return;
			}
			if (i === void 0 || !g.test(i)) {
				w(this, e, t, 400, `Missing or invalid Sec-WebSocket-Key header`);
				return;
			}
			if (l !== 13 && l !== 8) {
				w(this, e, t, 400, `Missing or invalid Sec-WebSocket-Version header`, { "Sec-WebSocket-Version": `13, 8` });
				return;
			}
			if (!this.shouldHandle(e)) {
				C(t, 400);
				return;
			}
			let u = e.headers[`sec-websocket-protocol`], d = /* @__PURE__ */ new Set();
			if (u !== void 0) try {
				d = c.parse(u);
			} catch {
				w(this, e, t, 400, `Invalid Sec-WebSocket-Protocol header`);
				return;
			}
			let f = e.headers[`sec-websocket-extensions`], p = {};
			if (this.options.perMessageDeflate && f !== void 0) {
				let n = new s({
					...this.options.perMessageDeflate,
					isServer: !0,
					maxPayload: this.options.maxPayload
				});
				try {
					let e = o.parse(f);
					e[s.extensionName] && (n.accept(e[s.extensionName]), p[s.extensionName] = n);
				} catch {
					w(this, e, t, 400, `Invalid or unacceptable Sec-WebSocket-Extensions header`);
					return;
				}
			}
			if (this.options.verifyClient) {
				let a = {
					origin: e.headers[`${l === 8 ? `sec-websocket-origin` : `origin`}`],
					secure: !!(e.socket.authorized || e.socket.encrypted),
					req: e
				};
				if (this.options.verifyClient.length === 2) {
					this.options.verifyClient(a, (a, o, s, c) => {
						if (!a) return C(t, o || 401, s, c);
						this.completeUpgrade(p, i, d, e, t, n, r);
					});
					return;
				}
				if (!this.options.verifyClient(a)) return C(t, 401);
			}
			this.completeUpgrade(p, i, d, e, t, n, r);
		}
		completeUpgrade(e, t, n, r, i, c, l) {
			if (!i.readable || !i.writable) return i.destroy();
			if (i[h]) throw Error(`server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration`);
			if (this._state > 0) return C(i, 503);
			let u = [
				`HTTP/1.1 101 Switching Protocols`,
				`Upgrade: websocket`,
				`Connection: Upgrade`,
				`Sec-WebSocket-Accept: ${a(`sha1`).update(t + p).digest(`base64`)}`
			], d = new this.options.WebSocket(null, void 0, this.options);
			if (n.size) {
				let e = this.options.handleProtocols ? this.options.handleProtocols(n, r) : n.values().next().value;
				e && (u.push(`Sec-WebSocket-Protocol: ${e}`), d._protocol = e);
			}
			if (e[s.extensionName]) {
				let t = e[s.extensionName].params, n = o.format({ [s.extensionName]: [t] });
				u.push(`Sec-WebSocket-Extensions: ${n}`), d._extensions = e;
			}
			this.emit(`headers`, u, r), i.write(u.concat(`\r
`).join(`\r
`)), i.removeListener(`error`, x), d.setSocket(i, c, {
				allowSynchronousEvents: this.options.allowSynchronousEvents,
				maxBufferedChunks: this.options.maxBufferedChunks,
				maxFragments: this.options.maxFragments,
				maxPayload: this.options.maxPayload,
				skipUTF8Validation: this.options.skipUTF8Validation
			}), this.clients && (this.clients.add(d), d.on(`close`, () => {
				this.clients.delete(d), this._shouldEmitClose && !this.clients.size && process.nextTick(v, this);
			})), l(d, r);
		}
	};
	function _(e, t) {
		for (let n of Object.keys(t)) e.on(n, t[n]);
		return function() {
			for (let n of Object.keys(t)) e.removeListener(n, t[n]);
		};
	}
	function v(e) {
		e._state = 2, e.emit(`close`);
	}
	function x() {
		this.destroy();
	}
	function C(e, t, n, i) {
		n ||= r.STATUS_CODES[t], i = {
			Connection: `close`,
			"Content-Type": `text/html`,
			"Content-Length": Buffer.byteLength(n),
			...i
		}, e.once(`finish`, e.destroy), e.end(`HTTP/1.1 ${t} ${r.STATUS_CODES[t]}\r\n` + Object.keys(i).map((e) => `${e}: ${i[e]}`).join(`\r
`) + `\r
\r
` + n);
	}
	function w(e, t, n, r, i, a) {
		if (e.listenerCount(`wsClientError`)) {
			let r = Error(i);
			Error.captureStackTrace(r, w), e.emit(`wsClientError`, r, n, t);
		} else C(n, r, i, a);
	}
}));
x(), y(), m(), g(), _(), S();
l(b(), 1);
var T = l(C(), 1);
//#endregion
//#region node_modules/crossws/dist/_chunks/adapter.mjs
var AdapterHookable = class {
	options;
	#resolveCache = /* @__PURE__ */ new WeakMap();
	constructor(options) {
		this.options = options || {};
	}
	callHook(name, arg1, arg2, connection) {
		const globalHook = this.options.hooks?.[name];
		const globalPromise = globalHook?.(arg1, arg2);
		const resolve = this.options.resolve;
		if (!resolve) return globalPromise;
		const request = arg1.request || arg1;
		const cacheKey = connection || arg1.context || request;
		let resolveHooksPromise;
		if (this.#resolveCache.has(cacheKey)) resolveHooksPromise = this.#resolveCache.get(cacheKey);
		else {
			try {
				resolveHooksPromise = resolve(request);
			} catch (error) {
				resolveHooksPromise = Promise.reject(error);
			}
			this.#resolveCache.set(cacheKey, resolveHooksPromise);
			if (resolveHooksPromise instanceof Promise) resolveHooksPromise.catch(() => {
				if (this.#resolveCache.get(cacheKey) === resolveHooksPromise) this.#resolveCache.delete(cacheKey);
			});
		}
		if (!resolveHooksPromise) return globalPromise;
		const resolvePromise = resolveHooksPromise instanceof Promise ? resolveHooksPromise.then((hooks) => hooks?.[name]) : resolveHooksPromise?.[name];
		return Promise.all([globalPromise, resolvePromise]).then(([globalRes, hook]) => {
			const hookResPromise = hook?.(arg1, arg2);
			return hookResPromise instanceof Promise ? hookResPromise.then((hookRes) => hookRes || globalRes) : hookResPromise || globalRes;
		});
	}
	async upgrade(request) {
		let namespace = this.options.getNamespace?.(request) ?? new URL(request.url).pathname;
		const context = request.context || {};
		let upgradeHeaders;
		let protocolFromHook;
		try {
			const res = await this.callHook("upgrade", request, void 0, context);
			if (res) {
				if (res.namespace) namespace = res.namespace;
				if (res.context) Object.assign(context, res.context);
				if (res instanceof Response) return {
					context,
					namespace,
					endResponse: res
				};
				if (res.handled) return {
					context,
					namespace,
					handled: true
				};
				upgradeHeaders = res.headers;
				protocolFromHook = res.protocol;
			}
		} catch (error) {
			const errResponse = error.response || error;
			if (errResponse instanceof Response) return {
				context,
				namespace,
				endResponse: errResponse
			};
			throw error;
		}
		const protocol = await this._resolveProtocol(request, upgradeHeaders, protocolFromHook);
		if (protocol) {
			const merged = new Headers(upgradeHeaders);
			merged.set("sec-websocket-protocol", protocol);
			upgradeHeaders = merged;
		}
		return {
			context,
			namespace,
			upgradeHeaders
		};
	}
	async _resolveProtocol(request, upgradeHeaders, protocolFromHook) {
		if (protocolFromHook) return protocolFromHook;
		if (upgradeHeaders) {
			const fromHeader = (upgradeHeaders instanceof Headers ? upgradeHeaders : new Headers(upgradeHeaders)).get("sec-websocket-protocol");
			if (fromHeader) return fromHeader;
		}
		const handleProtocols = this.options.handleProtocols;
		if (handleProtocols) {
			const offered = _parseProtocols(request.headers.get("sec-websocket-protocol"));
			if (offered.size > 0) {
				const chosen = await handleProtocols(offered, request);
				if (chosen) return chosen;
			}
		}
	}
};
function _parseProtocols(header) {
	const protocols = /* @__PURE__ */ new Set();
	if (!header) return protocols;
	for (const part of header.split(",")) {
		const token = part.trim();
		if (token) protocols.add(token);
	}
	return protocols;
}
var kNodeInspect = /*#__PURE__*/ Symbol.for("nodejs.util.inspect.custom");
function toBufferLike(val) {
	if (val === void 0 || val === null) return "";
	const type = typeof val;
	if (type === "string") return val;
	if (type === "number" || type === "boolean" || type === "bigint") return val.toString();
	if (type === "function" || type === "symbol") return "{}";
	if (val instanceof Uint8Array || val instanceof ArrayBuffer) return val;
	if (isPlainObject(val)) return JSON.stringify(val);
	return val;
}
function serializeMessage(val) {
	const data = toBufferLike(val);
	if (typeof data === "string") return data;
	return data instanceof Uint8Array ? data : new Uint8Array(data);
}
function isPlainObject(value) {
	if (value === null || typeof value !== "object") return false;
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) return false;
	if (Symbol.iterator in value) return false;
	if (Symbol.toStringTag in value) return Object.prototype.toString.call(value) === "[object Module]";
	return true;
}
function adapterUtils(globalPeers, options, caps) {
	const localPublish = (topic, message, pubOptions) => {
		for (const peers of pubOptions?.namespace ? [globalPeers.get(pubOptions.namespace) || []] : globalPeers.values()) {
			let firstPeerWithTopic;
			for (const peer of peers) if (peer.topics.has(topic)) {
				firstPeerWithTopic = peer;
				break;
			}
			if (firstPeerWithTopic) {
				firstPeerWithTopic.send(message, pubOptions);
				firstPeerWithTopic._publish(topic, message, pubOptions);
				if (caps?.nativePubSub && !pubOptions?.namespace) break;
			}
		}
	};
	let sync;
	if (options?.sync) {
		const report = (stage, error) => {
			if (options.onError) options.onError(error, { stage });
			else console.error(`[crossws] sync ${stage} failed:`, error);
		};
		const driver = options.sync({ id: crypto.randomUUID() });
		const deliver = (msg) => {
			try {
				localPublish(msg.topic, msg.data, { namespace: msg.namespace || void 0 });
			} catch (error) {
				report("delivery", error);
			}
		};
		try {
			Promise.resolve(driver.subscribe(deliver)).catch((error) => report("subscribe", error));
		} catch (error) {
			report("subscribe", error);
		}
		sync = {
			subscribe: (deliver) => driver.subscribe(deliver),
			publish: (msg) => {
				try {
					return Promise.resolve(driver.publish(msg)).catch((e) => report("publish", e));
				} catch (error) {
					report("publish", error);
				}
			},
			close: driver.close ? () => driver.close() : void 0
		};
	}
	return {
		peers: globalPeers,
		sync,
		publish(topic, message, options) {
			localPublish(topic, message, options);
			sync?.publish({
				namespace: options?.namespace || "",
				topic,
				data: serializeMessage(message)
			});
		},
		async close(code, reason) {
			for (const peers of globalPeers.values()) for (const peer of peers) peer.close(code, reason);
			await sync?.close?.();
		}
	};
}
function getPeers(globalPeers, namespace) {
	if (!namespace) throw new Error("Websocket publish namespace missing.");
	let peers = globalPeers.get(namespace);
	if (!peers) {
		peers = /* @__PURE__ */ new Set();
		globalPeers.set(namespace, peers);
	}
	return peers;
}
//#endregion
//#region node_modules/crossws/dist/_chunks/peer.mjs
var Message = class {
	event;
	peer;
	rawData;
	#id;
	#uint8Array;
	#arrayBuffer;
	#blob;
	#text;
	#json;
	constructor(rawData, peer, event) {
		this.rawData = rawData || "";
		this.peer = peer;
		this.event = event;
	}
	get id() {
		if (!this.#id) this.#id = crypto.randomUUID();
		return this.#id;
	}
	uint8Array() {
		const _uint8Array = this.#uint8Array;
		if (_uint8Array) return _uint8Array;
		const rawData = this.rawData;
		if (rawData instanceof Uint8Array) return this.#uint8Array = rawData;
		if (rawData instanceof ArrayBuffer || rawData instanceof SharedArrayBuffer) {
			this.#arrayBuffer = rawData;
			return this.#uint8Array = new Uint8Array(rawData);
		}
		if (typeof rawData === "string") {
			this.#text = rawData;
			return this.#uint8Array = new TextEncoder().encode(this.#text);
		}
		if (Symbol.iterator in rawData) return this.#uint8Array = new Uint8Array(rawData);
		if (typeof rawData?.length === "number") return this.#uint8Array = new Uint8Array(rawData);
		if (rawData instanceof DataView) return this.#uint8Array = new Uint8Array(rawData.buffer, rawData.byteOffset, rawData.byteLength);
		throw new TypeError(`Unsupported message type: ${Object.prototype.toString.call(rawData)}`);
	}
	arrayBuffer() {
		const _arrayBuffer = this.#arrayBuffer;
		if (_arrayBuffer) return _arrayBuffer;
		const rawData = this.rawData;
		if (rawData instanceof ArrayBuffer || rawData instanceof SharedArrayBuffer) return this.#arrayBuffer = rawData;
		return this.#arrayBuffer = this.uint8Array().buffer;
	}
	blob() {
		const _blob = this.#blob;
		if (_blob) return _blob;
		const rawData = this.rawData;
		if (rawData instanceof Blob) return this.#blob = rawData;
		return this.#blob = new Blob([this.uint8Array()]);
	}
	text() {
		const _text = this.#text;
		if (_text) return _text;
		const rawData = this.rawData;
		if (typeof rawData === "string") return this.#text = rawData;
		return this.#text = new TextDecoder().decode(this.uint8Array());
	}
	json() {
		const _json = this.#json;
		if (_json) return _json;
		return this.#json = JSON.parse(this.text());
	}
	get data() {
		switch (this.peer?.websocket?.binaryType) {
			case "arraybuffer": return this.arrayBuffer();
			case "blob": return this.blob();
			case "nodebuffer": {
				const NodeBuffer = globalThis.Buffer;
				return NodeBuffer ? NodeBuffer.from(this.uint8Array()) : this.uint8Array();
			}
			case "uint8array": return this.uint8Array();
			case "text": return this.text();
			default: return this.rawData;
		}
	}
	toString() {
		return this.text();
	}
	[Symbol.toPrimitive]() {
		return this.text();
	}
	[kNodeInspect]() {
		return { message: {
			id: this.id,
			peer: this.peer,
			text: this.text()
		} };
	}
};
var Peer = class {
	_internal;
	_topics;
	_id;
	#ws;
	#pingUnsupportedWarned = false;
	constructor(internal) {
		this._topics = /* @__PURE__ */ new Set();
		this._internal = internal;
	}
	get context() {
		return this._internal.context ??= {};
	}
	get namespace() {
		return this._internal.namespace;
	}
	get id() {
		if (!this._id) this._id = crypto.randomUUID();
		return this._id;
	}
	get remoteAddress() {}
	get request() {
		return this._internal.request;
	}
	get websocket() {
		if (!this.#ws) {
			const _ws = this._internal.ws;
			const _request = this._internal.request;
			this.#ws = _request ? createWsProxy(_ws, _request) : _ws;
		}
		return this.#ws;
	}
	get peers() {
		return this._internal.peers || /* @__PURE__ */ new Set();
	}
	get topics() {
		return this._topics;
	}
	get bufferedAmount() {
		return this._internal.ws?.bufferedAmount ?? 0;
	}
	waitForDrain(opts = {}) {
		const threshold = opts.threshold ?? 0;
		if (this.bufferedAmount <= threshold) return Promise.resolve();
		const signal = opts.signal;
		if (signal?.aborted) return Promise.reject(signal.reason);
		return new Promise((resolve, reject) => {
			const check = () => {
				if (this.bufferedAmount <= threshold || (this.websocket.readyState ?? 1) > 1) {
					cleanup();
					resolve();
				}
			};
			const onAbort = () => {
				cleanup();
				reject(signal.reason);
			};
			const timer = setInterval(check, opts.pollInterval ?? 100);
			timer.unref?.();
			const cleanup = () => {
				clearInterval(timer);
				signal?.removeEventListener("abort", onAbort);
			};
			signal?.addEventListener("abort", onAbort, { once: true });
		});
	}
	terminate() {
		this.close();
	}
	ping(_data) {
		if (!this.#pingUnsupportedWarned) {
			this.#pingUnsupportedWarned = true;
			console.warn("[crossws] `peer.ping()` is not supported by this adapter.");
		}
	}
	subscribe(topic) {
		this._topics.add(topic);
	}
	unsubscribe(topic) {
		this._topics.delete(topic);
	}
	publish(topic, data, options) {
		this._publish(topic, data, options);
		this._internal.sync?.publish({
			namespace: this.namespace,
			topic,
			data: serializeMessage(data)
		});
	}
	toString() {
		return this.id;
	}
	[Symbol.toPrimitive]() {
		return this.id;
	}
	[Symbol.toStringTag]() {
		return "WebSocket";
	}
	[kNodeInspect]() {
		return { peer: {
			id: this.id,
			ip: this.remoteAddress
		} };
	}
};
function createWsProxy(ws, request) {
	return new Proxy(ws, { get: (target, prop) => {
		const value = Reflect.get(target, prop);
		if (!value) switch (prop) {
			case "protocol": return request?.headers?.get("sec-websocket-protocol") || "";
			case "extensions": return request?.headers?.get("sec-websocket-extensions") || "";
			case "url": return request?.url?.replace(/^http/, "ws") || void 0;
		}
		return value;
	} });
}
//#endregion
//#region node_modules/crossws/dist/_chunks/error.mjs
var WSError = class extends Error {
	constructor(...args) {
		super(...args);
		this.name = "WSError";
	}
};
//#endregion
//#region node_modules/crossws/dist/_chunks/_request.mjs
var StubRequest = /* @__PURE__ */ (() => {
	class StubRequest {
		url;
		_abortController;
		_headers;
		_init;
		constructor(url, init = {}) {
			this.url = url;
			this._init = init;
		}
		get headers() {
			if (!this._headers) this._headers = new Headers(this._init?.headers);
			return this._headers;
		}
		clone() {
			return new StubRequest(this.url, this._init);
		}
		get method() {
			return "GET";
		}
		get signal() {
			if (!this._abortController) this._abortController = new AbortController();
			return this._abortController.signal;
		}
		get cache() {
			return "default";
		}
		get credentials() {
			return "same-origin";
		}
		get destination() {
			return "";
		}
		get integrity() {
			return "";
		}
		get keepalive() {
			return false;
		}
		get redirect() {
			return "follow";
		}
		get mode() {
			return "cors";
		}
		get referrer() {
			return "about:client";
		}
		get referrerPolicy() {
			return "";
		}
		get body() {
			return null;
		}
		get bodyUsed() {
			return false;
		}
		arrayBuffer() {
			return Promise.resolve(/* @__PURE__ */ new ArrayBuffer(0));
		}
		blob() {
			return Promise.resolve(new Blob());
		}
		bytes() {
			return Promise.resolve(/* @__PURE__ */ new Uint8Array());
		}
		formData() {
			return Promise.resolve(new FormData());
		}
		json() {
			return Promise.resolve(JSON.parse(""));
		}
		text() {
			return Promise.resolve("");
		}
	}
	Object.setPrototypeOf(StubRequest.prototype, globalThis.Request.prototype);
	return StubRequest;
})();
//#endregion
//#region node_modules/crossws/dist/_chunks/node.mjs
var HEARTBEAT_PING = Buffer.from("crossws-ping");
var nodeAdapter = (options = {}) => {
	if ("Deno" in globalThis || "Bun" in globalThis) throw new Error("[crossws] Using Node.js adapter in an incompatible environment.");
	const hooks = new AdapterHookable(options);
	const globalPeers = /* @__PURE__ */ new Map();
	const baseUtils = adapterUtils(globalPeers, options);
	const wss = options.wss || new T.default({
		noServer: true,
		handleProtocols: () => false,
		...options.serverOptions
	});
	const liveSockets = /* @__PURE__ */ new Set();
	const idleTimeoutMs = (options.idleTimeout ?? 30) * 1e3;
	const sweepMs = Math.max(1, Math.floor(idleTimeoutMs));
	wss.on("connection", (ws, nodeReq) => {
		const request = new NodeReqProxy(nodeReq);
		const peers = getPeers(globalPeers, nodeReq._namespace);
		const peer = new NodePeer({
			ws,
			request,
			peers,
			nodeReq,
			namespace: nodeReq._namespace,
			sync: baseUtils.sync,
			hooks
		});
		peers.add(peer);
		liveSockets.add(ws);
		if (idleTimeoutMs > 0) {
			ws._isAlive = true;
			const markAlive = () => {
				ws._isAlive = true;
			};
			ws.on("pong", markAlive);
			ws.on("ping", markAlive);
			ws.on("message", markAlive);
		}
		hooks.callHook("open", peer);
		ws.on("message", (rawData, isBinary) => {
			const buff = Array.isArray(rawData) ? Buffer.concat(rawData) : rawData;
			const data = !isBinary && !(buff instanceof ArrayBuffer) ? buff.toString("utf8") : buff;
			hooks.callHook("message", peer, new Message(data, peer));
		});
		ws.on("ping", (data) => {
			hooks.callHook("ping", peer, data);
		});
		ws.on("pong", (data) => {
			if (data.equals(HEARTBEAT_PING)) return;
			hooks.callHook("pong", peer, data);
		});
		ws.on("error", (error) => {
			peers.delete(peer);
			hooks.callHook("error", peer, new WSError(error));
		});
		const socket = ws._socket;
		const onDrain = () => hooks.callHook("drain", peer);
		socket?.on("drain", onDrain);
		ws.on("close", (code, reason) => {
			peers.delete(peer);
			liveSockets.delete(ws);
			socket?.off("drain", onDrain);
			hooks.callHook("close", peer, {
				code,
				reason: reason?.toString()
			});
		});
	});
	let idleTimer;
	const stopSweep = () => {
		if (idleTimer) {
			clearInterval(idleTimer);
			idleTimer = void 0;
		}
	};
	if (idleTimeoutMs > 0) {
		idleTimer = setInterval(() => {
			for (const ws of liveSockets) {
				if (ws._isAlive === false) {
					ws.terminate();
					continue;
				}
				ws._isAlive = false;
				try {
					ws.ping(HEARTBEAT_PING);
				} catch {}
			}
		}, sweepMs);
		idleTimer.unref?.();
		wss.on("close", stopSweep);
	}
	wss.on("headers", (outgoingHeaders, req) => {
		const upgradeHeaders = req._upgradeHeaders;
		if (upgradeHeaders) for (const [key, value] of new Headers(upgradeHeaders)) outgoingHeaders.push(`${key}: ${value}`);
	});
	return {
		...baseUtils,
		close: async (code, reason) => {
			stopSweep();
			await baseUtils.close(code, reason);
		},
		handleUpgrade: async (nodeReq, socket, head, webRequest) => {
			const request = webRequest || new NodeReqProxy(nodeReq);
			let upgraded;
			try {
				upgraded = await hooks.upgrade(request);
			} catch {
				return sendResponse(socket, new Response("Internal Server Error", { status: 500 }));
			}
			const { upgradeHeaders, endResponse, handled, context, namespace } = upgraded;
			if (endResponse) return sendResponse(socket, endResponse);
			if (handled) return;
			nodeReq._request = request;
			nodeReq._upgradeHeaders = upgradeHeaders;
			nodeReq._context = context;
			nodeReq._namespace = namespace;
			wss.handleUpgrade(nodeReq, socket, head, (ws) => {
				wss.emit("connection", ws, nodeReq);
			});
		},
		closeAll: (code, data, force) => {
			for (const ws of liveSockets) if (force) ws.terminate();
			else ws.close(code, data);
		}
	};
};
var NodePeer = class extends Peer {
	get remoteAddress() {
		return this._internal.nodeReq.socket?.remoteAddress;
	}
	get context() {
		return this._internal.nodeReq._context;
	}
	send(data, options) {
		const dataBuff = toBufferLike(data);
		const isBinary = typeof dataBuff !== "string";
		this._internal.ws.send(dataBuff, {
			compress: options?.compress,
			binary: isBinary,
			...options
		});
		return this._internal.ws.bufferedAmount;
	}
	_publish(topic, data, options) {
		const dataBuff = toBufferLike(data);
		const isBinary = typeof dataBuff !== "string";
		const sendOptions = {
			compress: options?.compress,
			binary: isBinary,
			...options
		};
		for (const peer of this._internal.peers) if (peer !== this && peer._topics.has(topic)) peer._internal.ws.send(dataBuff, sendOptions);
	}
	close(code, data) {
		this._internal.ws.close(code, data);
	}
	terminate() {
		this._internal.ws.terminate();
	}
	ping(data) {
		try {
			this._internal.ws.ping(data);
		} catch (error) {
			this._internal.hooks.callHook("error", this, new WSError(error));
		}
	}
};
var NodeReqProxy = class extends StubRequest {
	constructor(req) {
		const host = req.headers["host"] || "localhost";
		const url = `${req.socket?.encrypted ?? req.headers["x-forwarded-proto"] === "https" ? "https" : "http"}://${host}${req.url}`;
		super(url, { headers: req.headers });
	}
};
async function sendResponse(socket, res) {
	const head = [`HTTP/1.1 ${res.status || 200} ${res.statusText || ""}`, ...[...res.headers.entries()].map(([key, value]) => `${key}: ${value}`)];
	socket.write(head.join("\r\n") + "\r\n\r\n");
	if (res.body) for await (const chunk of res.body) socket.write(chunk);
	return new Promise((resolve) => {
		socket.end(() => {
			socket.destroy();
			resolve();
		});
	});
}
//#endregion
//#region node_modules/srvx/dist/_chunks/_url.mjs
function lazyInherit(target, source, sourceKey) {
	for (const key of [...Object.getOwnPropertyNames(source), ...Object.getOwnPropertySymbols(source)]) {
		if (key === "constructor") continue;
		const targetDesc = Object.getOwnPropertyDescriptor(target, key);
		const desc = Object.getOwnPropertyDescriptor(source, key);
		let modified = false;
		if (desc.get) {
			modified = true;
			desc.get = targetDesc?.get || function() {
				return this[sourceKey][key];
			};
		}
		if (desc.set) {
			modified = true;
			desc.set = targetDesc?.set || function(value) {
				this[sourceKey][key] = value;
			};
		}
		if (!targetDesc?.value && typeof desc.value === "function") {
			modified = true;
			desc.value = function(...args) {
				return this[sourceKey][key](...args);
			};
		}
		if (modified) Object.defineProperty(target, key, desc);
	}
}
var _needsNormRE = /(?:(?:^|\/)(?:\.|\.\.|%2e|%2e\.|\.%2e|%2e%2e)(?:\/|$))|[\\^#"<>{}`\x80-\uffff]/i;
var _searchNeedsNormRE = /[#"'<>]/;
var FastURL = /* @__PURE__ */ (() => {
	const NativeURL = globalThis.URL;
	const FastURL = class URL {
		#url;
		#href;
		#protocol;
		#host;
		#pathname;
		#search;
		#searchParams;
		#pos;
		constructor(url) {
			if (typeof url === "string") {
				const isOriginForm = url[0] === "/";
				if (isOriginForm && !_searchNeedsNormRE.test(url)) this.#href = url;
				else this.#url = new NativeURL(isOriginForm ? `http://localhost${url}` : url);
			} else if (_needsNormRE.test(url.pathname) || url.search && _searchNeedsNormRE.test(url.search)) this.#url = new NativeURL(`${url.protocol || "http:"}//${url.host || "localhost"}${url.pathname}${url.search || ""}`);
			else {
				this.#protocol = url.protocol;
				this.#host = url.host;
				this.#pathname = url.pathname;
				this.#search = url.search;
			}
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeURL;
		}
		get _url() {
			if (this.#url) return this.#url;
			this.#url = new NativeURL(this.href);
			this.#href = void 0;
			this.#protocol = void 0;
			this.#host = void 0;
			this.#pathname = void 0;
			this.#search = void 0;
			this.#searchParams = void 0;
			this.#pos = void 0;
			return this.#url;
		}
		get href() {
			if (this.#url) return this.#url.href;
			if (!this.#href) this.#href = `${this.#protocol || "http:"}//${this.#host || "localhost"}${this.#pathname || "/"}${this.#search || ""}`;
			return this.#href;
		}
		#getPos() {
			if (!this.#pos) {
				const url = this.href;
				const protoIndex = url.indexOf("://");
				const pathnameIndex = protoIndex === -1 ? -1 : url.indexOf("/", protoIndex + 4);
				const qIndex = pathnameIndex === -1 ? -1 : url.indexOf("?", pathnameIndex);
				this.#pos = [
					protoIndex,
					pathnameIndex,
					qIndex
				];
			}
			return this.#pos;
		}
		get pathname() {
			if (this.#url) return this.#url.pathname;
			if (this.#pathname === void 0) {
				const [, pathnameIndex, queryIndex] = this.#getPos();
				if (pathnameIndex === -1) return this._url.pathname;
				this.#pathname = this.href.slice(pathnameIndex, queryIndex === -1 ? void 0 : queryIndex);
			}
			return this.#pathname;
		}
		get search() {
			if (this.#url) return this.#url.search;
			if (this.#search === void 0) {
				const [, pathnameIndex, queryIndex] = this.#getPos();
				if (pathnameIndex === -1) return this._url.search;
				const url = this.href;
				this.#search = queryIndex === -1 || queryIndex === url.length - 1 ? "" : url.slice(queryIndex);
			}
			return this.#search;
		}
		get searchParams() {
			if (this.#url) return this.#url.searchParams;
			if (!this.#searchParams) this.#searchParams = new URLSearchParams(this.search);
			return this.#searchParams;
		}
		get protocol() {
			if (this.#url) return this.#url.protocol;
			if (this.#protocol === void 0) {
				const [protocolIndex] = this.#getPos();
				if (protocolIndex === -1) return this._url.protocol;
				const url = this.href;
				this.#protocol = url.slice(0, protocolIndex + 1);
			}
			return this.#protocol;
		}
		toString() {
			return this.href;
		}
		toJSON() {
			return this.href;
		}
	};
	lazyInherit(FastURL.prototype, NativeURL.prototype, "_url");
	Object.setPrototypeOf(FastURL.prototype, NativeURL.prototype);
	Object.setPrototypeOf(FastURL, NativeURL);
	return FastURL;
})();
//#endregion
//#region node_modules/srvx/dist/_chunks/_trust-proxy.mjs
function isTrustedProxy(trustProxy, remoteAddress) {
	if (trustProxy === void 0 || trustProxy === false) return false;
	if (trustProxy === true) return true;
	if (trustProxy === "loopback") return isLoopbackAddress(remoteAddress);
	if (remoteAddress === void 0) return false;
	if (trustProxy.includes(remoteAddress)) return true;
	const mapped = ipv4FromMapped(remoteAddress);
	return mapped !== void 0 && trustProxy.includes(mapped);
}
function ipv4FromMapped(address) {
	return address.startsWith("::ffff:") && address.includes(".") ? address.slice(7) : void 0;
}
function isLoopbackAddress(address) {
	return !!address && (address === "::1" || address.startsWith("127.") || address.startsWith("::ffff:127."));
}
var HOST_RE = /^(\[(?:[A-Fa-f0-9:.]+)\]|(?:[A-Za-z0-9_-]+\.)*[A-Za-z0-9_-]+|(?:\d{1,3}\.){3}\d{1,3})(:\d{1,5})?$/;
function firstForwardedValue(value) {
	if (!value) return;
	return (Array.isArray(value) ? value[0] : value).split(",")[0].trim() || void 0;
}
//#endregion
//#region node_modules/srvx/dist/_chunks/_body-limit.mjs
function createBodyTooLargeError(maxRequestBodySize) {
	return Object.assign(/* @__PURE__ */ new Error(`Request body exceeds the maximum allowed size of ${maxRequestBodySize} bytes.`), {
		code: "ERR_BODY_TOO_LARGE",
		statusCode: 413,
		status: 413
	});
}
function limitBodyStream(stream, maxRequestBodySize) {
	const reader = stream.getReader();
	let size = 0;
	return new ReadableStream({
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) {
				controller.close();
				return;
			}
			size += value.byteLength;
			if (size > maxRequestBodySize) {
				const error = createBodyTooLargeError(maxRequestBodySize);
				reader.cancel(error).catch(() => {});
				controller.error(error);
				return;
			}
			controller.enqueue(value);
		},
		cancel(reason) {
			return reader.cancel(reason);
		}
	});
}
//#endregion
//#region node_modules/srvx/dist/adapters/node.mjs
var NodeRequestURL = class extends FastURL {
	constructor({ req, trusted = false }) {
		const path = req.url || "/";
		const forwardedHost = trusted ? firstForwardedValue(req.headers["x-forwarded-host"]) : void 0;
		let host = (forwardedHost && HOST_RE.test(forwardedHost) ? forwardedHost : void 0) || req.headers.host || req.headers[":authority"];
		if (host && !HOST_RE.test(host)) host = "_invalid_";
		else if (!host) if (req.socket) host = `${req.socket.localFamily === "IPv6" ? "[" + req.socket.localAddress + "]" : req.socket.localAddress}:${req.socket?.localPort || "80"}`;
		else host = "localhost";
		const forwardedProto = trusted ? firstForwardedValue(req.headers["x-forwarded-proto"]) : void 0;
		const protocol = req.socket?.encrypted || forwardedProto === "https" || trusted && req.headers[":scheme"] === "https" ? "https:" : "http:";
		if (path[0] === "/") {
			const qIndex = path.indexOf("?");
			super({
				protocol,
				host,
				pathname: qIndex === -1 ? path : path.slice(0, qIndex) || "/",
				search: qIndex === -1 ? "" : path.slice(qIndex) || ""
			});
		} else if (path === "*") super({
			protocol,
			host,
			pathname: "/*",
			search: ""
		});
		else super(path);
	}
};
var _nonJoinedHeaders = /* @__PURE__ */ new Set([
	"age",
	"authorization",
	"content-length",
	"content-type",
	"etag",
	"expires",
	"from",
	"host",
	"if-modified-since",
	"if-unmodified-since",
	"last-modified",
	"location",
	"max-forwards",
	"proxy-authorization",
	"referer",
	"retry-after",
	"server",
	"user-agent"
]);
var _validHeaderNameRE = /^[!#$%&'*+\-.^_`|~\dA-Za-z]+$/;
function _isRepeated(rawHeaders, lowerName) {
	let seen = false;
	for (let i = 0; i < rawHeaders.length; i += 2) {
		const key = rawHeaders[i];
		if (key.length === lowerName.length && key.toLowerCase() === lowerName) {
			if (seen) return true;
			seen = true;
		}
	}
	return false;
}
var NodeRequestHeaders = /* @__PURE__ */ (() => {
	const NativeHeaders = globalThis.Headers;
	class Headers {
		#req;
		#headers;
		constructor(req) {
			this.#req = req;
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeHeaders;
		}
		get _headers() {
			if (!this.#headers) {
				const headers = new NativeHeaders();
				const rawHeaders = this.#req.rawHeaders;
				const len = rawHeaders.length;
				for (let i = 0; i < len; i += 2) {
					const key = rawHeaders[i];
					if (key.charCodeAt(0) === 58) continue;
					const value = rawHeaders[i + 1];
					headers.append(key, value);
				}
				this.#headers = headers;
			}
			return this.#headers;
		}
		get(name) {
			if (this.#headers) return this.#headers.get(name);
			const lower = name.toLowerCase();
			if (lower.charCodeAt(0) === 58) return this._headers.get(name);
			const value = this.#req.headers[lower];
			if (typeof value === "string") return _nonJoinedHeaders.has(lower) && _isRepeated(this.#req.rawHeaders, lower) ? this._headers.get(name) : value;
			if (Array.isArray(value)) return value.join(", ");
			return lower !== "__proto__" && _validHeaderNameRE.test(name) ? null : this._headers.get(name);
		}
		has(name) {
			if (this.#headers) return this.#headers.has(name);
			const lower = name.toLowerCase();
			if (lower.charCodeAt(0) === 58) return this._headers.has(name);
			if (Object.hasOwn(this.#req.headers, lower)) return true;
			return lower !== "__proto__" && _validHeaderNameRE.test(name) ? false : this._headers.has(name);
		}
		getSetCookie() {
			if (this.#headers) return this.#headers.getSetCookie();
			const value = this.#req.headers["set-cookie"];
			return Array.isArray(value) ? value.slice() : value ? [value] : [];
		}
		entries() {
			return this._headers.entries();
		}
		[Symbol.iterator]() {
			return this.entries();
		}
	}
	lazyInherit(Headers.prototype, NativeHeaders.prototype, "_headers");
	Object.setPrototypeOf(Headers, NativeHeaders);
	Object.setPrototypeOf(Headers.prototype, NativeHeaders.prototype);
	return Headers;
})();
var kNativeRequest = /* @__PURE__ */ Symbol.for("srvx.nativeRequest");
var NodeRequest = /* @__PURE__ */ (() => {
	const NativeRequest = getNativeRequest();
	class Request {
		runtime;
		waitUntil;
		#req;
		#url;
		#bodyStream;
		#request;
		#headers;
		#abortController;
		#maxRequestBodySize;
		#trustProxy;
		#ip;
		#ipResolved = false;
		#remoteAddress;
		#trusted;
		constructor(ctx) {
			this.#req = ctx.req;
			this.#maxRequestBodySize = ctx.maxRequestBodySize;
			this.#trustProxy = ctx.trustProxy;
			this.runtime = {
				name: "node",
				node: ctx
			};
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeRequest;
		}
		#resolveTrusted() {
			if (this.#trusted === void 0) {
				this.#remoteAddress = this.#req.socket?.remoteAddress;
				this.#trusted = isTrustedProxy(this.#trustProxy, this.#remoteAddress);
			}
			return this.#trusted;
		}
		get ip() {
			if (this.#ipResolved) return this.#ip;
			this.#ipResolved = true;
			if (this.#resolveTrusted()) {
				const forwarded = firstForwardedValue(this.#req.headers["x-forwarded-for"]);
				if (forwarded) return this.#ip = forwarded;
			}
			return this.#ip = this.#remoteAddress;
		}
		get method() {
			if (this.#request) return this.#request.method;
			return this.#req.method || "GET";
		}
		get _url() {
			return this.#url ||= new NodeRequestURL({
				req: this.#req,
				trusted: this.#resolveTrusted()
			});
		}
		set _url(url) {
			this.#url = url;
		}
		get url() {
			if (this.#request) return this.#request.url;
			return this._url.href;
		}
		get headers() {
			if (this.#request) return this.#request.headers;
			return this.#headers ||= new NodeRequestHeaders(this.#req);
		}
		get _abortController() {
			if (!this.#abortController) {
				this.#abortController = new AbortController();
				const { req, res } = this.runtime.node;
				const abortController = this.#abortController;
				const abort = (err) => abortController.abort?.(err);
				if (res) res.once("close", () => {
					const reqError = req.errored;
					if (reqError) abort(reqError);
					else if (!res.writableEnded) abort();
				});
				else req.once("close", () => {
					if (!req.complete) abort();
				});
			}
			return this.#abortController;
		}
		get signal() {
			return this.#request ? this.#request.signal : this._abortController.signal;
		}
		get body() {
			if (this.#request) return this.#request.body;
			if (this.#bodyStream === void 0) {
				const method = this.method;
				let stream = !(method === "GET" || method === "HEAD") ? Readable.toWeb(this.#req) : null;
				if (stream && this.#maxRequestBodySize !== void 0) stream = limitBodyStream(stream, this.#maxRequestBodySize);
				this.#bodyStream = stream;
			}
			return this.#bodyStream;
		}
		#readBuffered() {
			return readBody(this.#req, this.#maxRequestBodySize);
		}
		text() {
			if (this.#request) return this.#request.text();
			if (this.#bodyStream !== void 0) return this.#bodyStream ? new Response(this.#bodyStream).text() : Promise.resolve("");
			return this.#readBuffered().then((buf) => buf.toString());
		}
		json() {
			if (this.#request) return this.#request.json();
			if (this.#bodyStream !== void 0) return this.text().then((text) => JSON.parse(text));
			return this.#readBuffered().then((buf) => JSON.parse(buf.toString()));
		}
		get _request() {
			if (!this.#request) {
				const body = this.body;
				this.#request = new NativeRequest(this.url, {
					method: this.method,
					headers: this.headers,
					signal: this._abortController.signal,
					body,
					duplex: body ? "half" : void 0
				});
				this.#headers = void 0;
				this.#bodyStream = void 0;
			}
			return this.#request;
		}
	}
	lazyInherit(Request.prototype, NativeRequest.prototype, "_request");
	Object.setPrototypeOf(Request.prototype, NativeRequest.prototype);
	return Request;
})();
function readBody(req, maxRequestBodySize) {
	if ("rawBody" in req && Buffer.isBuffer(req.rawBody)) {
		if (maxRequestBodySize !== void 0 && req.rawBody.length > maxRequestBodySize) return Promise.reject(createBodyTooLargeError(maxRequestBodySize));
		return Promise.resolve(req.rawBody);
	}
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		const cleanup = () => {
			req.off("data", onData);
			req.off("end", onEnd);
			req.off("error", onError);
		};
		const onData = (chunk) => {
			if (maxRequestBodySize !== void 0) {
				size += chunk.length;
				if (size > maxRequestBodySize) {
					cleanup();
					req.pause?.();
					reject(createBodyTooLargeError(maxRequestBodySize));
					return;
				}
			}
			chunks.push(chunk);
		};
		const onError = (err) => {
			cleanup();
			reject(err);
		};
		const onEnd = () => {
			cleanup();
			resolve(chunks.length === 1 ? chunks[0] : Buffer.concat(chunks));
		};
		req.on("data", onData).once("end", onEnd).once("error", onError);
	});
}
function getNativeRequest() {
	let R = globalThis[kNativeRequest] || globalThis.Request;
	while (R?._srvx) R = Object.getPrototypeOf(R);
	return globalThis[kNativeRequest] ??= R;
}
var NodeResponse = /* @__PURE__ */ (() => {
	const NativeResponse = globalThis.Response;
	const STATUS_CODES = globalThis.process?.getBuiltinModule?.("node:http")?.STATUS_CODES || {};
	class NodeResponse {
		#body;
		#init;
		#headers;
		#response;
		constructor(body, init) {
			this.#body = body;
			this.#init = init;
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeResponse;
		}
		get status() {
			return this.#response?.status || this.#init?.status || 200;
		}
		get statusText() {
			return this.#response?.statusText || this.#init?.statusText || STATUS_CODES[this.status] || "";
		}
		get headers() {
			if (this.#response) return this.#response.headers;
			if (this.#headers) return this.#headers;
			const initHeaders = this.#init?.headers;
			return this.#headers = initHeaders instanceof Headers ? initHeaders : new Headers(initHeaders);
		}
		get ok() {
			if (this.#response) return this.#response.ok;
			const status = this.status;
			return status >= 200 && status < 300;
		}
		get _response() {
			if (this.#response) return this.#response;
			let body = this.#body;
			if (body && typeof body.pipe === "function" && !(body instanceof Readable)) {
				const stream = new PassThrough();
				body.pipe(stream);
				const abort = body.abort;
				if (abort) stream.once("close", () => abort());
				body = stream;
			}
			this.#response = new NativeResponse(body, this.#headers ? {
				...this.#init,
				headers: this.#headers
			} : this.#init);
			this.#init = void 0;
			this.#headers = void 0;
			this.#body = void 0;
			return this.#response;
		}
		_toNodeResponse() {
			const status = this.status;
			const statusText = this.statusText;
			let body;
			let contentType;
			let contentLength;
			if (this.#response) body = this.#response.body;
			else if (this.#body) if (this.#body instanceof ReadableStream) body = this.#body;
			else if (typeof this.#body === "string") {
				body = this.#body;
				contentType = "text/plain; charset=UTF-8";
				contentLength = Buffer.byteLength(this.#body);
			} else if (this.#body instanceof ArrayBuffer) {
				body = Buffer.from(this.#body);
				contentLength = this.#body.byteLength;
			} else if (this.#body instanceof Uint8Array) {
				body = this.#body;
				contentLength = this.#body.byteLength;
			} else if (this.#body instanceof DataView) {
				body = Buffer.from(this.#body.buffer);
				contentLength = this.#body.byteLength;
			} else if (this.#body instanceof Blob) {
				body = this.#body.stream();
				contentType = this.#body.type;
				contentLength = this.#body.size;
			} else if (typeof this.#body.pipe === "function") body = this.#body;
			else body = this._response.body;
			const headers = [];
			const initHeaders = this.#init?.headers;
			const headerEntries = this.#response?.headers || this.#headers || (initHeaders ? Array.isArray(initHeaders) ? initHeaders : initHeaders?.entries ? initHeaders.entries() : Object.entries(initHeaders) : void 0);
			let hasContentTypeHeader;
			let hasContentLength;
			if (headerEntries) for (const [key, value] of headerEntries) {
				const lowerKey = typeof key === "string" ? key.toLowerCase() : String(key);
				if (Array.isArray(value)) for (const v of value) headers.push(lowerKey, v);
				else headers.push(lowerKey, value);
				if (lowerKey === "content-type") hasContentTypeHeader = true;
				else if (lowerKey === "content-length") hasContentLength = true;
			}
			if (contentType && !hasContentTypeHeader) headers.push("content-type", contentType);
			if (contentLength && !hasContentLength) headers.push("content-length", String(contentLength));
			this.#init = void 0;
			this.#headers = void 0;
			this.#response = void 0;
			this.#body = void 0;
			return {
				status,
				statusText,
				headers,
				body
			};
		}
	}
	lazyInherit(NodeResponse.prototype, NativeResponse.prototype, "_response");
	Object.setPrototypeOf(NodeResponse, NativeResponse);
	Object.setPrototypeOf(NodeResponse.prototype, NativeResponse.prototype);
	return NodeResponse;
})();
//#endregion
//#region node_modules/crossws/dist/adapters/vercel.mjs
var VERCEL_REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");
var vercelAdapter = (options = {}) => {
	const wss = nodeAdapter(options);
	async function handleWebUpgrade(request) {
		if (!_isWsUpgrade(request.method, request.headers.get("upgrade") || void 0)) return;
		const upgrade = _getVercelUpgrade();
		if (!upgrade) return;
		await wss.handleUpgrade(upgrade.req, upgrade.socket, upgrade.head, request);
		return new Response(null, { status: 204 });
	}
	async function handleNodeUpgrade(req, res) {
		if (!_isWsUpgrade(req.method, req.headers.upgrade)) return false;
		const upgrade = _getVercelUpgrade();
		if (!upgrade) return false;
		await wss.handleUpgrade(upgrade.req, upgrade.socket, upgrade.head, new NodeRequest({
			req,
			res
		}));
		if (!res.headersSent && !res.writableEnded) {
			res.statusCode = 204;
			res.end();
		}
		return true;
	}
	const { handleUpgrade: _, ...rest } = wss;
	return {
		...rest,
		handleWebUpgrade,
		handleNodeUpgrade
	};
};
function _isWsUpgrade(method, upgradeHeader) {
	return method === "GET" && upgradeHeader?.toLowerCase?.() === "websocket";
}
function _getVercelUpgrade() {
	const upgrade = _getVercelRequestContext()?.upgradeWebSocket?.();
	return upgrade?.req && upgrade?.socket && upgrade?.head ? upgrade : void 0;
}
function _getVercelRequestContext() {
	const store = globalThis[VERCEL_REQUEST_CONTEXT_SYMBOL];
	if (typeof store?.get !== "function") return;
	const context = store.get();
	if (!context || typeof context !== "object") return;
	return context;
}
//#endregion
export { NodeResponse as n, FastURL as r, vercelAdapter as t };
