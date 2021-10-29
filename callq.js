
"use strict";

/*

call queue

convention:

	* an 'error-data-que' callback function, named `operator`, is defined as:
		function( error, data, que ){ ... }

			* `que`: a call-queue object.

			* sync process:
				* return an `Error` object, for `error`;
				* or throw an exception, for `error`;
				* or return anything neither `undefined` nor `Error`, for `data`;
				* or directly call `que.next()` and return nothing/`undefined`;

			* async callback:
				* return nothing/`undefined`.
					* directly call `que.next()` in callback;
					* or get an 'error-first' function from `que.wait()`, as a parameter for outside callback;
	
	* an `operator-set`, is a user-defined object with some operator functions.

	* operator-array:
		* an array of
			{ label:"labelN", timeout:timeoutN, op:operatorN }

			* label: new label string for the operator;
			* timeout: timeout number for the operator, in milliseconds;
			* op:
				* an operator function.
				* or an existing label string of an operator in the operator-set;
		
		* or an array like:
			[ ["label1",] [timeout1,] operator1, ["label2",] [timeout2,] operator2, ... ]

			* a new `labelN` here shouldn't be an existing label in the operator-set, otherwise it will be parsed as the existing operator;
		
			* the `label` here can be a label-range, defined as string "label1:label2",
					that is a new array extracted from an existig operator-array, that from `label1` to `label2`(included).
				* so a normal label shouldn't contain character ':'.
				* a label-range will clear preceding `label` and `timeout`

		* or a mixed array of the 2 above formats;

	* levels
		1. root: static call-queue object with a user-defined `operator-set`
		2. process: run user-defined `operator-array` by tools of call-queue class
		3. thread: run user-defined operator.
*/


function CallQueueClass(operatorSet) {
	this.root = this;

	this.operatorSet = operatorSet;
}

var STATE_ROOT_INIT = 0;			//initial root state

var STATE_PROCESS_RUNNING = 1;		//virtual process running
var STATE_PROCESS_FINISHED = 2;		//virtual process finished
var STATE_PROCESS_TIMEOUT = 3;		//virtual process timeout

var STATE_THREAD_PENDING = 11;	//virtual thread pending
var STATE_THREAD_FINISHED = 12;	//virtual thread finished
var STATE_THREAD_TIMEOUT = 13;	//virtual thread timeout

//var REG_OPTIONAL = /^optional(\.update)?$/;

var processIdSeed = 0;

CallQueueClass.prototype = {

	debug: 1,		//debug output flag, 0: silent, 1: show warns, 2: verbose

	operatorSet: null,		//the `this` when operator function is called

	queue: null,		//queue data object
	labelSet: null,		//map label name to index

	index: 0,		//point to the next-call

	root: null,		//root CallQueueClass `this`
	process: null,		//process `this`

	processId: null,	//unique process id

	state: STATE_ROOT_INIT,		//state of process or thread

	//timer id: when timeout, it will be set to `false`; when stop normally, it will be set to `null`.
	processTmid: null,	//process timer id
	threadTmid: null,	//thread timer id

	joinList: null,			//list for join
	joinTailList: null,		//list for join at tail

	/**
	 * get the index of a label
	 * @param {string} label - a label string.
	 * @param {bool} extendMode - flag to search and return the labeled function in `operatorSet`.
	 */
	labelIndex: function (label, extendMode) {
		if (label in this.labelSet) return this.labelSet[label];
		else if (extendMode && typeof this.operatorSet[label] === "function") return this.operatorSet[label];
		else throw Error("unknown label, " + label);
	},

	buildQueue: function (operatorArray, refProcess) {
		if (!(operatorArray instanceof Array)) operatorArray = [operatorArray];

		this.queue = [];
		this.labelSet = {}

		var i, imax = operatorArray.length, oai, oai_ts, op, timeout, label, newLabel, qi, rqi;
		for (i = 0; i < imax; i++) {
			oai = operatorArray[i];
			oai_ts = typeof (oai);

			if (oai_ts === "function") {	//op
				op = oai;
				if (op.name && op.name != "anonymous") label = op.name;
			}
			else if (oai_ts === "number") { timeout = oai; }	//timeout
			else if (oai_ts === "string") {		//label or op
				if (refProcess && refProcess.queue && refProcess.operatorSet === this.operatorSet) {
					if (oai.indexOf(':') > 0) {
						//label-range, copy from source
						var sa = oai.split(":").map(function (si) { return refProcess.labelIndex(si); });
						for (var j = sa[0]; j <= sa[1]; j++) {
							rqi = refProcess.queue[j];
							if (rqi.label) this.labelSet[rqi.label] = this.queue.length;
							this.queue.push(rqi);
						}
						op = timeout = label = newLabel = null;
						continue;
					}
					else if (oai in refProcess.labelSet) {
						rqi = refProcess.queue[refProcess.labelIndex(oai)];
						if (rqi.label) this.labelSet[rqi.label] = this.queue.length;
						this.queue.push(rqi);
						op = timeout = label = newLabel = null;
						continue;
					}
				}

				if (this.operatorSet && oai in this.operatorSet) {
					op = this.operatorSet[oai];
					if (typeof op !== "function") throw "cq format fail, not function label, " + oai;
					label = oai;
				}
				else { newLabel = oai; }
			}
			else if (oai_ts === "object") {
				if (oai.label) { newLabel = oai; }
				if (oai.timeout) { timeout = oai; }
				if (oai.op) {
					if (typeof oai.op === "function") {
						op = oai.op;
						if (oai.op.name && oai.op.name != "anonymous") label = oai.op.name;
					}
					else {
						if (!this.operatorSet) throw "cq format fail, empty operatorSet for label, " + oai.op;
						op = this.operatorSet[oai.op];
						if (typeof op !== "function") throw "cq format fail, not function label, " + oai.op;
						label = oai.op;
					}
				}
			}

			if (!op) continue;		//wait op

			label = newLabel || label;
			if (label) {
				this.labelSet[label] = this.queue.length;		//old label index may be replaced
				qi = { label: label, timeout: timeout, op: op };
			}
			else { qi = { timeout: timeout, op: op }; }

			this.queue.push(qi);

			op = timeout = label = newLabel = null;
		}

		//build emulated root operatorSet when root operatorSet is empty in array mode
		if (!this.root.operatorSet) {
			var os = {};
			for (var i in this.labelSet) {
				os[i] = this.queue[this.labelSet[i]].op;
			}
			this.root.operatorSet = os;
		}
	},

	isOmitTimeout: function (v) { return typeof v !== "undefined" && typeof v !== "number"; },

	//run a new process
	run: function (error, data, operatorArray, runTimeout, runTimeoutLabel, runDescription) {
		if (this.isOmitTimeout(runTimeout)) {		//optional runTimeout
			runDescription = runTimeoutLabel; runTimeoutLabel = runTimeout; runTimeout = 0;
		}

		var process = Object.create(this.root);

		process.process = process;
		process.processId = (++processIdSeed) + (runDescription ? ("-" + runDescription) : "");

		process.processTmid = null;
		process.threadTmid = null;
		process.index = 0;

		process.buildQueue(operatorArray, this);

		process.state = STATE_PROCESS_RUNNING;
		if (runTimeout > 0) {
			process.processTmid = setTimeout(
				function () {
					if (process.state === STATE_PROCESS_RUNNING) {
						process.state = STATE_PROCESS_TIMEOUT;

						if (runTimeoutLabel) {
							process.jump("cq process timeout, " + runTimeout + ", " + process.processId, null, runTimeoutLabel);
							//don't set process.processTmid = false, as a flag to run timeout label 1 time.
						}
						else { process.processTmid = false; }
					}
				},
				runTimeout
			);
		}

		return process.next(error, data);
	},

	//like `.run()` but continue current process
	pick: function (error, data, pickArray, pickTimeout, jumpLabel, jumpTimeout, pickDescription) {
		if (this.isOmitTimeout(pickTimeout)) {		//optional pickTimeout
			pickDescription = jumpTimeout; jumpTimeout = jumpLabel; jumpLabel = pickTimeout; pickTimeout = 0;
		}
		if (this.isOmitTimeout(jumpTimeout)) {		//optional jumpTimeout
			pickDescription = jumpTimeout; jumpTimeout = 0;
		}

		var _this = this;
		var cb = function (error, data, que) {
			if (que.process.state == STATE_PROCESS_RUNNING) que.next();
			_this.jump(error, data, jumpLabel, jumpTimeout);
		};

		if (!(pickArray instanceof Array)) pickArray = [pickArray];
		return this.run(error, data, pickArray.concat(cb), pickTimeout, cb, pickDescription);
	},

	loop: function (error, data, conditionFunc, loopArray, finalLabel, finalTimeout, loopDescription) {
		if (this.isOmitTimeout(finalTimeout)) {		//optional finalTimeout
			loopDescription = finalTimeout; finalTimeout = 0;
		}

		var cnt = 0;
		var cbLoop = function (error, data, que) {
			if (conditionFunc()) {
				return que.pick(error, data, loopArray, cbLoop, loopDescription ? (loopDescription + "-" + (cnt++)) : null);
			}
			else return que.jump(error, data, finalLabel, finalTimeout);
		}
		return cbLoop(error, data, this);
	},

	//when `jumpLabel` is null, `.jump()` is same as `.next()`
	jump: function (error, data, jumpLabel, jumpTimeout) {
		if (jumpLabel) {
			if (typeof jumpLabel !== "function") jumpLabel = this.labelIndex(jumpLabel, true);

			if (typeof jumpLabel === "function") return jumpLabel.call(this.operatorSet, error, data, this);

			this.process.index = jumpLabel;
		}
		return this.next(error, data, jumpTimeout);
	},

	//next step
	next: function (error, data, nextTimeout) {
		//stop thread timer
		if (this.threadTmid) { clearTimeout(this.threadTmid); this.threadTmid = null; }

		//virtual thread checking
		if (this.state === STATE_THREAD_TIMEOUT) { if (this.debug > 0) console.warn("WARN: cq blocked by thread-timeout"); return; }
		if (this.state === STATE_THREAD_FINISHED) { if (this.debug > 0) console.warn("WARN: cq blocked by thread-finished"); return; }
		if (this.state === STATE_THREAD_PENDING) {
			this.state = STATE_THREAD_FINISHED;		//set finish flag when the 1st call ending
			return this.process.next(error, data, nextTimeout);		//call `process.next()`
		}

		if (this.state === STATE_PROCESS_TIMEOUT) {
			if (!this.processTmid) { if (this.debug > 0) console.warn("WARN: cq blocked by process-timeout"); return; }
			this.processTmid = false;		//set process timeout flag, and continue process step 1 time
		}
		else if (this.state === STATE_PROCESS_FINISHED) { if (this.debug > 0) console.warn("WARN: cq blocked by process-finished"); return; }
		else if (this.state === STATE_PROCESS_RUNNING) { }	//continue
		else { throw Error("cq state unexpected, " + this.state); }

		//check process pointer
		if (this.process !== this) { throw Error("cq process pointer fail"); }

		//normalize error
		if (error && !(error instanceof Error)) error = Error(error);

		//call join list at current index
		while (this.joinList && this.joinList.length > 0) { try { this.joinList.shift()(error, data); } catch (ex) { console.warn("cq join exception", ex); } }

		//get next queue item
		var qi = this.queue[this.index];
		if (!qi) {
			//process finish
			if (this.state != STATE_PROCESS_TIMEOUT) this.state = STATE_PROCESS_FINISHED;	//keep process timeout state

			if (this.processTmid) { clearTimeout(this.processTmid); this.processTmid = null; }

			if (this.debug > 1) console.log("process finish, id='" + this.processId + "'");

			//call join list at tail
			while (this.joinTailList && this.joinTailList.length > 0) { try { this.joinTailList.shift()(error, data); } catch (ex) { console.warn("cq join tail exception", ex); } }

			return error || data || null;	//call queue end
		}

		this.index++;

		//run next
		var thread = Object.create(this);
		thread.state = STATE_THREAD_PENDING;
		thread.processTmid = null;		//protect prototype's timer_id
		thread.threadTmid = null;		//protect prototype's timer_id

		var ret;
		try {
			ret = qi.op.call(this.operatorSet, error, data, thread);
		}
		catch (e) {
			if (this.debug > 0) console.warn("WARN: cq exception:", e);
			ret = (e instanceof Error) ? e : Error(e);
		}

		if (typeof ret !== "undefined") {
			//sync return

			//check sync thread ending, 
			if (thread.state === STATE_THREAD_FINISHED) { if (this.debug > 0) console.warn("WARN: cq sync thread blocked"); return; }
			if (thread.state === STATE_THREAD_TIMEOUT) { if (this.debug > 0) console.warn("WARN: cq sync thread timeout blocked"); return; }
			thread.state = STATE_THREAD_FINISHED;

			return (ret instanceof Error) ? this.next(ret) : this.next(null, ret);		//process.next()
		}
		else if (thread.state === STATE_THREAD_PENDING) {	//thread may have been finished
			//async return, timer
			var tmr = (nextTimeout > 0) ? nextTimeout : qi.timeout;
			if (tmr) {
				var _this = this;
				thread.threadTmid = setTimeout(
					function () {
						thread.threadTmid = false;
						thread.state = STATE_THREAD_TIMEOUT;
						_this.next("cq thread timeout, " + tmr);
					},
					tmr
				);
			}
		}
	},

	//enclose `.next()` to error-first callback
	wait: function (/*error, data,*/ waitTimeout, nextTimeout) {
		var tmid = null;
		var _this = this;

		if (waitTimeout > 0) {
			tmid = setTimeout(function () { tmid = false; _this.next("cq wait-timeout, " + waitTimeout); }, waitTimeout);
		}

		return function (error, data) {
			if (tmid === false) { if (_this.debug > 0) console.warn("WARN: cq blocked by wait-timeout, " + waitTimeout); return; }
			if (tmid) { clearTimeout(tmid); tmid = null; }

			return _this.next(error, data, nextTimeout);
		}
	},

	markCallback: function (mark, callback, thisObject) {
		return function () {
			return callback.apply(thisObject, [mark].concat(Array.prototype.slice.apply(arguments)));
		}
	},

	/*
	forkSettings: {
		mode: "all"|"allOrError"|"any"|"anyData"|"optional"|"optional.update"|user-defined,
		timeout: 0,
		description:""
		pickSet:{
			labelN: pickArrayN | forkSettingsN,
			...
		},
	}

	async callback: ( error, [ result, resultCount, lastResultLabel ] )
	*/
	fork: function (error, data, forkSettings, jumpLabel, jumpTimeout) {
		var result = {};	//map labelN to [ errorN, dataN ]
		var resultCount = 0, blocked = false;
		var resultCountMax = Object.keys(forkSettings.pickSet).length;

		var tmid = null;
		var _this = this;
		if (forkSettings.timeout > 0) {
			tmid = setTimeout(function () { tmid = false; blocked = true; _this.jump("cq fork-timeout, " + forkSettings.timeout, [result, resultCount, null], jumpLabel, jumpTimeout); }, forkSettings.timeout);
		}

		var mode = forkSettings.mode || "all";

		//prepare final callback
		var markCheck = function (mark, error, data, que) {
			if (tmid === false) { if (_this.debug > 0) console.warn("WARN: cq fork timeout blocked"); return; }

			if (blocked) { if (_this.debug > 0) console.warn("WARN: fork blocked - " + (mode || "others")); return; }

			if (!result[mark]) { resultCount++; }
			if (!result[mark] || mode === "optional.update") { result[mark] = [error, data]; }

			if (mode === "all") { if (resultCount < resultCountMax) return; blocked = true; }
			else if (mode === "allOrError") { if (resultCount < resultCountMax && !error) return; blocked = true; }
			else if (mode === "any") { blocked = true; }
			else if (mode === "anyData") { if (!data && resultCount < resultCountMax) return; blocked = true; }

			if (blocked && tmid) { clearTimeout(tmid); tmid = null; }	//try stop fork timer

			var ret = que.jump(null, [result, resultCount, mark], jumpLabel, jumpTimeout);

			if (!blocked && ret && !mode.match(REG_OPTIONAL)) {
				blocked = true;	//block others
				if (tmid) { clearTimeout(tmid); tmid = null; }	//try stop fork timer, after blocking others.
			}

			return ret;
		}

		//run all
		var i, psi;
		for (var i in forkSettings.pickSet) {
			psi = forkSettings.pickSet[i];
			//console.log(psi);
			if ((psi instanceof Array) || !psi.pickSet) {
				this.pick(error, data, psi, this.markCallback(i, markCheck), (forkSettings.description || "") + ":" + i);
			}
			else {
				//cascading fork
				if (!psi.description) psi.description = i;
				this.fork(error, data, psi, this.markCallback(i, markCheck));
			}
		}
	},

	//join callback or another que, at current index, or at end when 'tail' is true
	join: function (cb, joinTimeout, tail) {
		//arguments
		if (this.isOmitTimeout(joinTimeout)) {		//optional joinTimeout
			tail = joinTimeout; joinTimeout = 0;
		}

		var _this, func;
		if (cb instanceof CallQueueClass) { _this = cb; func = cb.next; }
		else { func = cb; }

		//timer
		var tmid = null;
		if (joinTimeout > 0) {
			tmid = setTimeout(function () { tmid = false; func.call(_this, "cq join-timeout, " + joinTimeout); }, joinTimeout);
		}

		//add to list
		var list = tail ? (this.process.joinTailList || (this.process.joinTailList = [])) : (this.process.joinList || (this.process.joinList = []));

		list.push(
			function (err, data) {
				if (tmid === false) { if (_this.debug > 0) console.warn("WARN: cq blocked by join-timeout, " + joinTimeout); return; }
				if (tmid) { clearTimeout(tmid); tmid = null; }

				func.call(_this, err, data);
			}
		);
	},

}

module.exports = exports = function (operatorSet, operatorArray, timeout, description) {
	if (!operatorArray) throw "cq empty operatorArray";

	if (CallQueueClass.prototype.isOmitTimeout(timeout)) {		//optional timeout
		description = timeout; timeout = 0;
	}

	var que = new CallQueueClass(operatorSet);
	return que.run(null, null, operatorArray, timeout, null, description);
}

exports.class = CallQueueClass;
exports.isQue = function (obj) { return (obj instanceof CallQueueClass); }

