# callq

call queue

# Install

```
npm install callq
```

# Usage

```javascript
var cq= require( "callq" );

var myObj = {
	f1: function (error, data, que) {
		console.log(data = "1-label");
		setTimeout(function() { que.jump(null, data, "f3"); }, 50);
	},
	f2: function (error, data, que) {
		console.log(data = data + ",2-end");
		setTimeout(function() { que.jump(null, data, "f4"); }, 50);
	},
	f3: function (error, data, que) {
		console.log(data = data + ",3-label");
		setTimeout(function() { que.jump(null, data, "f2"); }, 50);
	},
	f4: function (error, data, que) {
		var expect = "1-label,3-label,2-end";
		if(data != expect) throw Error("expect (" + expect + ") but (" + data + ")");
		que.next(null, data);
	},
};

cq(myObj, ["f1", "f2", "f3", "f4"] );

```

# Convention

```
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

		* label: default-label string for the operator;
			* a label prefixed ":" char is a sub procedure label.
				* the procedure will be skipped by normal process;
				* it can be called by .pick() later;
		* timeout: default-timeout number for the operator, in milliseconds;
		* op:
			* an operator function.
			* or an existing label string of an operator in the operator-set;
	
	* or an array like:
		[ ["label1",] [timeout1,] operator1, ["label2",] [timeout2,] operator2, ... ]

		* a new `labelN` here shouldn't be an existing label in the operator-set, otherwise it will be parsed as the existing operator;
	
		* the `label` here can be a label-range, defined as string "label1:label2",
				that is a new array extracted from an existig operator-array, that from `label1` to `label2`(included).
			* a label-range will clear preceding `label` and `timeout`

	* or a mixed array of the 2 above formats;

* levels
	1. root: static call-queue object with a user-defined `operator-set`
	2. process: run user-defined `operator-array` by tools of call-queue class
	3. thread: run user-defined operator.

* call stack
	queue
		.next()	/ .wait() / .waitVoid()	/ thread
			.jump()	/ thread
				.pick() / .run() / process
					.if()
					.loop()
					.fork()
					.final()

					cq.join()

* all *-timeout arguments are optional.

```
