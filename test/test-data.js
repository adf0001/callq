// global, for html page
cq = require("../callq.js");

module.exports = {

	"sync by return": function (done) {
		var seq = [];
		cq(null, [
			function (error, data) {
				seq.push(data = "1-return");
				return data;
			},
			function (error, data) {
				seq.push(data = data + ",2-error");
				return Error(data);
			},
			function (error, data) {
				seq.push(data = error.message + ",3-throw");
				throw data;
			},
			function (error, data, que) {
				seq.push(data = error.message + ",4-next");
				que.next(null, data);
			},
			function (error, data, que) {
				seq.push(data = data + ",5-sync-blocked");
				que.next(null, data);

				seq.push(seq[seq.length - 1] + ",try-sync-blocked");
				return "try-sync-blocked";
			},
			function (error, data, que) {
				seq.push(data = data + ",6-async-blocked");
				setTimeout(function () {
					seq.push(seq[seq.length - 1] + ",try-async-blocked");
					que.next(null, "try-async-blocked");
				}, 50);
				return data;
			},
			function (error, data, que) {
				seq.push(data = data + ",end");
				setTimeout(function () { que.next(null, data); }, 150);	//wait async finish
			},
			function (error, data, que) {
				showResult(seq.join("\n"), 3);

				data = seq[seq.length - 1];
				var expect = "1-return,2-error,3-throw,4-next,5-sync-blocked,6-async-blocked,end,try-sync-blocked,try-async-blocked";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next();
			},
		], "sync");
	},
	"async": function (done) {
		var seq = [];
		cq(null, [
			function (error, data, que) {
				seq.push(data = "1-data")
				setTimeout(function () { que.next(null, data); }, 50);
			},
			function (error, data, que) {
				seq.push(data = data + ",2-error")
				setTimeout(function () { que.next(data); }, 50);
			},
			function (error, data, que) {
				seq.push(data = error.message + ",3-catch");
				setTimeout(function () {
					try { throw data; }
					catch (e) { que.next(e); }
				}, 50);
			},
			function (error, data, que) {
				seq.push(data = error.message + ",4-blocked");
				setTimeout(function () { que.next(data); }, 50);
				setTimeout(function () {
					seq.push(seq[seq.length - 1] + ",try-blocked");
					que.next("try-blocked");
				}, 100);
			},
			function (error, data, que) {
				seq.push(data = error.message + ",end");
				setTimeout(function () { que.next(null, data); }, 200);	//wait async finish
			},
			function (error, data, que) {
				showResult(seq.join("\n"), 3);

				data = seq[seq.length - 1];
				var expect = "1-data,2-error,3-catch,4-blocked,end,try-blocked";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next();
			},
		], "async");
	},
	"timeout": function (done) {
		var seq = [];
		cq(null, [
			50, function (error, data, que) {
				seq.push(data = "1-timeout");
			},
			function (error, data, que) {
				seq.push(data = seq[seq.length - 1] + ",[" + error.message + "],2-manually");
				que.next(null, data, 80);
			},
			function (error, data, que) {
				//do nothing to wait
			},
			function (error, data, que) {
				seq.push(data = seq[seq.length - 1] + ",[" + error.message + "],3-replace");
				que.next(null, data, 150);
			},
			7, function (error, data, que) {
				setTimeout(function () {
					seq.push(data = data + ",4-no-timeout");
					que.next(null, data);
				}, 100);
			},
			function (error, data, que) {
				seq.push(data = data + ",end");
				que.next(null, data);
			},
			function (error, data, que) {
				showResult(seq.join("\n"), 3);

				data = seq[seq.length - 1];
				var expect = "1-timeout,[cq thread timeout, 50],2-manually,[cq thread timeout, 80],3-replace,4-no-timeout,end";
				done((data == expect) ? null : Error("expect (" + expect + "),\nbut (" + data + ")"));
				que.next();
			},
		], "timeout");
	},
	"wait": function (done) {
		function outside(data, cb) {
			setTimeout(function () {
				data = data + ",outside";
				console.log("outside: " + data);
				cb(null, data);
			}, 100);
		}

		var seq = [];
		cq(null, [
			function (error, data, que) {
				seq.push(data = "1-wait");
				outside(data, que.wait());
			},
			function (error, data, que) {
				seq.push(data = data + ",1-wait-timeout");
				outside(data, que.wait(50));
			},
			function (error, data, que) {
				seq.push(data = seq[seq.length - 1] + ",[" + error.message + "],end");
				setTimeout(function () { que.next(null, data); }, 100);	//wait async finish
			},
			function (error, data, que) {
				showResult(seq.join("\n"), 3);

				data = seq[seq.length - 1];
				var expect = "1-wait,outside,1-wait-timeout,[cq wait-timeout, 50],end";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next();
			},
		], "wait");
	},
	"jump, label": function (done) {
		var seq = [];
		cq(null, [
			function (error, data, que) {
				seq.push(data = "1-label");
				setTimeout(function () { que.jump(null, data, "3"); }, 50);
			},
			"2", function (error, data, que) {
				seq.push(data = data + ",2-end");
				setTimeout(function () { que.jump(null, data, "4"); }, 50);
			},
			"3", function (error, data, que) {
				seq.push(data = data + ",3-label");
				setTimeout(function () { que.jump(null, data, "2"); }, 50);
			},
			"4", function (error, data, que) {
				showResult(seq.join("\n"), 3);

				data = seq[seq.length - 1];
				var expect = "1-label,3-label,2-end";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], "jump");
	},
	"operatorSet - jump, label": function (done) {
		var seq = [];
		var myObj = {
			f1: function (error, data, que) {
				seq.push(data = "1-label");
				setTimeout(function () { que.jump(null, data, "f3"); }, 50);
			},
			f2: function (error, data, que) {
				seq.push(data = data + ",2-end");
				setTimeout(function () { que.jump(null, data, "f4"); }, 50);
			},
			f3: function (error, data, que) {
				seq.push(data = data + ",3-label");
				setTimeout(function () { que.jump(null, data, "f2"); }, 50);
			},
			f4: function (error, data, que) {
				showResult(seq.join("\n"), 3);

				data = seq[seq.length - 1];
				var expect = "1-label,3-label,2-end";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		}
		cq(myObj, ["f1", "f2", "f3", "f4"], "operatorSet");
	},
	"jump-process": function (done) {
		var seq = [];
		var myObj = {
			f1: function (error, data, que) {
				seq.push(data = "1-label");
				setTimeout(function () { que.jump(null, data, myObj.f3); }, 50);
			},
			f2: function (error, data, que) {
				seq.push(data = data + ",2-end");
				setTimeout(function () { que.jump(null, data, myObj.f4); }, 50);
			},
			f3: function (error, data, que) {
				seq.push(data = data + ",3-label");
				setTimeout(function () { que.jump(null, data, myObj.f2); }, 50);
			},
			f4: function (error, data, que) {
				showResult(seq.join("\n"), 3);

				data = seq[seq.length - 1];
				var expect = "1-label,3-label,2-end";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		}
		cq(myObj, "f1", "jump-process");
	},
	"pick, label-range": function (done) {
		var seq = [];
		cq(null, [
			function (error, data, que) {
				seq.push(data = "1-run");
				setTimeout(function () { que.pick(null, data, ["3:5", "2"], null, "sub"); }, 50);
			},
			"2", function (error, data, que) {
				seq.push(data = data + ",2");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"3", function (error, data, que) {
				seq.push(data = data + ",3");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			function (error, data, que) {
				seq.push(data = data + ",4");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"5", function (error, data, que) {
				seq.push(data = data + ",5");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			function (error, data, que) {
				seq.push(data = data + ",end");

				showResult(seq.join("\n"), 3);
				data = seq[seq.length - 1];

				var expect = "1-run,3,4,5,2,2,3,4,5,end";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], "pick");
	},
	"pick, item timeout": function (done) {
		var seq = [];
		cq(null, [
			function (error, data, que) {
				seq.push(data = "1-run");
				setTimeout(function () { que.pick(null, data, ["3:5", 10, "2"], null, "sub"); }, 50);
			},
			"2", function (error, data, que) {
				console.log(error && error.message);
				seq.push(data = seq[seq.length - 1] + "," + ((error && ("[" + error.message + " at 2]")) || "2"));
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"3", function (error, data, que) {
				seq.push(data = data + ",3");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			function (error, data, que) {
				seq.push(data = data + ",4");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"5", function (error, data, que) {
				seq.push(data = data + ",5");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			function (error, data, que) {
				seq.push(data = data + ",end");

				showResult(seq.join("\n"), 3);
				data = seq[seq.length - 1];

				var expect = "1-run,3,4,5,2,[cq thread timeout, 10 at 2],3,4,5,end";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], "pick item timeout");
	},
	"pick timeout": function (done) {
		var seq = [];
		cq(null, [
			function (error, data, que) {
				seq.push(data = "1-pick-timeout");
				setTimeout(function () { que.pick(null, data, ["3:5"], 100, null, "sub1"); }, 50);	//timeout
			},
			"2", function (error, data, que) {
				seq.push(data = seq[seq.length - 1] + ",[" + error.message + "],2-pick");
				setTimeout(function () { que.pick(null, data, ["3:5"], 300, null, "sub2"); }, 50);	//no timeout
			},
			"3", function (error, data, que) {
				seq.push(data = data + ",3");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			function (error, data, que) {
				seq.push(data = data + ",4");
				setTimeout(function () { que.next(null, data); }, 100);
			},
			"5", function (error, data, que) {
				seq.push(data = data + ",5");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			function (error, data, que) {
				seq.push(data = data + ",last");

				showResult(seq.join("\n"), 3);
				data = seq[seq.length - 1];

				var expect = "1-pick-timeout,3,4,[cq process timeout, 100, " + (parseInt(que.process.processId) + 1) + "-sub1],2-pick,3,4,5,3,4,5,last";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], "pick-timeout");
	},
	"process if": function (done) {
		var seq = [];
		cq(null, [
			function (error, data, que) {
				var num = (new Date()).getSeconds();
				seq.push("seconds= " + num);

				seq.push(data = "1-if");
				setTimeout(function () { que.if(null, data, (num % 2), "even", "odd", "end-if", "sub"); }, 50);
			},
			"odd", function (error, data, que) {
				seq.push(data = data + ",2-odd");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"even", function (error, data, que) {
				seq.push(data = data + ",3-even");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"end-if", function (error, data, que) {
				seq.push(data = data + ",4-end-if");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			function (error, data, que) {
				showResult(seq.join("\n"), 3);

				var expect1 = "1-if,2-odd,4-end-if";
				var expect2 = "1-if,3-even,4-end-if";
				done((data == expect1 || data == expect2) ? null : Error("expect (" + expect1 + ") or (" + expect2 + ") but (" + data + ")"));
				que.next(null, data);
			},
		], "if");
	},
	"process if-operatorSet": function (done) {
		var seq = [];
		var myObj = {
			f1: function (error, data, que) {
				var num = (new Date()).getSeconds();
				seq.push("seconds= " + num);

				seq.push(data = "1-if");
				setTimeout(function () { que.if(null, data, function (err, data) { return (num % 2); }, "even", "odd", "end-if", "sub"); }, 50);
			},
			"odd": function (error, data, que) {
				seq.push(data = data + ",2-odd");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"even": function (error, data, que) {
				seq.push(data = data + ",3-even");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"end-if": function (error, data, que) {
				seq.push(data = data + ",4-end-if");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			f5: function (error, data, que) {
				showResult(seq.join("\n"), 3);

				var expect1 = "1-if,2-odd,4-end-if";
				var expect2 = "1-if,3-even,4-end-if";
				done((data == expect1 || data == expect2) ? null : Error("expect (" + expect1 + ") or (" + expect2 + ") but (" + data + ")"));
				que.next(null, data);
			},
		};

		cq(myObj, ["f1", "odd", "even", "end-if", "f5"], "if-operatorSet");
	},
	"loop": function (done) {
		var seq = [];
		cq(null, [
			function (error, data, que) {
				seq.push(data = "1");
				setTimeout(function () { que.jump(error, data, "loop-i"); }, 50);
			},
			"loop-i", function (error, data, que) {
				seq.push(data = data + ", 2");
				que.loop(error, data, { i: 0 }, function (condition) { return condition.i++ < 2; }, "loop-j", "f5", "loop-i");
			},
			"loop-j", function (error, data, que) {
				seq.push(data = data + ", 3");
				que.loop(error, data, { j: 0 }, function (condition) { return condition.j++ < 3; }, "j2", null, "loop-j");
			},
			"j2", function (error, data, que) {
				seq.push(data = data + ",[4]");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"f5", function (error, data, que) {
				seq.push(data = data + " ,5");

				showResult(seq.join("\n"), 3);

				var expect = "1, 2, 3,[4],[4],[4], 3,[4],[4],[4] ,5";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], "loop");
	},
	"loop-operatorSet": function (done) {
		var seq = [];
		var myObj = {
			f1: function (error, data, que) {
				seq.push(data = "1");
				setTimeout(function () { que.jump(error, data, "loop-i"); }, 50);
			},
			"loop-i": function (error, data, que) {
				seq.push(data = data + ", 2");
				que.loop(error, data, { i: 0 }, function (condition) { return condition.i++ < 2; }, "loop-j", "f5", "loop-i");
			},
			"loop-j": function (error, data, que) {
				seq.push(data = data + ", 3");
				que.loop(error, data, { j: 0 }, function (condition) { return condition.j++ < 3; }, "j2", null, "loop-j");
			},
			"j2": function (error, data, que) {
				seq.push(data = data + ",[4]");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			f5: function (error, data, que) {
				seq.push(data = data + " ,5");

				showResult(seq.join("\n"), 3);

				var expect = "1, 2, 3,[4],[4],[4], 3,[4],[4],[4] ,5";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		};

		cq(myObj, "f1", "loop-operatorSet");
	},
	"fork-all": function (done) {
		var seq = [];
		var seqFull = [];

		cq(null, [
			function (error, data, que) {
				seq.push("1");
				seqFull.push(data = "1");

				setTimeout(function () {
					que.fork(null, data, {
						pickSet: {
							"a": "2",
							"b": ["3", "5"],
							"c": "4"
						}
					}, "6");
				}, 50);
			},
			"2", function (error, data, que) {
				setTimeout(function () {
					seq.push("2");
					seqFull.push(data = data + ",2");
					que.next(null, data);
				}, 150);
			},
			"3", function (error, data, que) {
				setTimeout(function () {
					seq.push("3");
					seqFull.push(data = data + ",3");
					que.next(null, data);
				}, 100);
			},
			"4", function (error, data, que) {
				setTimeout(function () {
					seq.push("4");
					seqFull.push(data = data + ",4");
					que.next(null, data);
				}, 50);
			},
			"5", function (error, data, que) {
				setTimeout(function () {
					seq.push("5");
					seqFull.push(data = data + ",5");
					que.next(null, data);
				}, 100);
			},

			"6", function (error, data, que) {
				seq.push("6");

				var s = "seq=[" + seq.join(",") + "], result={";

				s += "a:(" + data[0]["a"][1] + "),";
				s += "b:(" + data[0]["b"][1] + "),";
				s += "c:(" + data[0]["c"][1] + "),";
				s += "count:" + data[1] + "}"

				showResult(seqFull.join("\n") + "\n" + s, 3);

				setTimeout(function () { que.next(null, s); }, 50);
			},
			function (error, data, que) {
				var expect = "seq=[1,4,3,2,5,6], result={a:(1,2),b:(1,3,5),c:(1,4),count:3}";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], 'fork-all');
	},
	"fork-any": function (done) {
		var seq = [];
		var seqFull = [];

		cq(null, [
			function (error, data, que) {
				seq.push("1");
				seqFull.push(data = "1");

				setTimeout(function () {
					que.fork(null, data, {
						mode: "any",
						pickSet: {
							"a": "2",
							"b": ["3", "5"],
							"c": "4"
						}
					}, "6");
				}, 50);
			},
			"2", function (error, data, que) {
				setTimeout(function () {
					seq.push("2");
					seqFull.push(data = data + ",2");
					que.next(null, data);
				}, 150);
			},
			"3", function (error, data, que) {
				setTimeout(function () {
					seq.push("3");
					seqFull.push(data = data + ",3");
					que.next(null, data);
				}, 50);
			},
			"4", function (error, data, que) {
				setTimeout(function () {
					seq.push("4");
					seqFull.push(data = data + ",4");
					que.next(null, data);
				}, 100);
			},
			"5", function (error, data, que) {
				setTimeout(function () {
					seq.push("5");
					seqFull.push(data = data + ",5");
					que.next(null, data);
				}, 100);
			},

			"6", function (error, data, que) {
				seq.push("6");

				var s = "seq=[" + seq.join(",") + "], result={";

				s += "a:(" + (data[0]["a"] || "") + "),";
				s += "b:(" + (data[0]["b"] || "") + "),";
				s += "c:(" + data[0]["c"][1] + "),";
				s += "count:" + data[1] + ",last:" + data[2] + "}"

				showResult(seqFull.join("\n") + "\n" + s, 3);

				setTimeout(function () { que.next(null, s); }, 50);
			},
			function (error, data, que) {
				var expect = "seq=[1,3,4,6], result={a:(),b:(),c:(1,4),count:1,last:c}";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], 'fork-any');
	},

	".isQue()": function (done) {
		cq(null, [
			function (error, data, que) {
				data = cq.isQue(que) && !cq.isQue(data);
				var expect = true;
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], "isQue");
	},
	"flow:jump": function (done) {
		var seq = [];
		cq(null, [
			function (error, data, que) {
				seq.push(data = "1-label");
				setTimeout(function () { que.next(error, data); }, 50);
			},
			cq.jump("3"),
			"2", function (error, data, que) {
				seq.push(data = data + ",2-end");
				setTimeout(function () { que.next(error, data); }, 50);
			},
			cq.jump("4"),
			"3", function (error, data, que) {
				seq.push(data = data + ",3-label");
				setTimeout(function () { que.next(error, data); }, 50);
			},
			cq.jump("2"),
			"4", function (error, data, que) {
				showResult(seq.join("\n"), 3);

				data = seq[seq.length - 1];
				var expect = "1-label,3-label,2-end";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], "flow-jump");
	},

	"flow:if": function (done) {
		var seq = [];
		cq(null, [
			function (error, data, que) {
				var num = (new Date()).getSeconds();
				seq.push("seconds= " + num);

				seq.push(data = "1-if");
				setTimeout(que.waitVoid(null, num), 50);
			},
			cq.if(function (err, data) { return data % 2; }, "even", "odd", "end-if", "sub"),
			"odd", function (error, data, que) {
				seq.push(data = seq[seq.length - 1] + ",2-odd");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"even", function (error, data, que) {
				seq.push(data = seq[seq.length - 1] + ",3-even");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"end-if", function (error, data, que) {
				seq.push(data = data + ",4-end-if");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			function (error, data, que) {
				showResult(seq.join("\n"), 3);

				var expect1 = "1-if,2-odd,4-end-if";
				var expect2 = "1-if,3-even,4-end-if";
				done((data == expect1 || data == expect2) ? null : Error("expect (" + expect1 + ") or (" + expect2 + ") but (" + data + ")"));
				que.next(null, data);
			},
		], "flow-if");
	},

	"flow:loop": function (done) {
		var seq = [];

		cq(null, [
			function (error, data, que) {
				seq.push(data = "1");
				setTimeout(function () { que.jump(error, data, "loop-i"); }, 50);
			},
			"loop-i", function (error, data, que) {
				seq.push(data = data + ", 2");
				que.next(error, data);
			},
			cq.loop({ i: 0 }, function (condition) { console.log("i=" + condition.i); return condition.i++ < 2; }, "loop-j:loop-j2", "f5", "loop-i"),
			"loop-j", function (error, data, que) {
				seq.push(data = data + ", 3");
				que.next(error, data);
			},
			"loop-j2", cq.loop({ j: 0 }, function (condition) { return condition.j++ < 3; }, "j2", null, "loop-j"),
			"j2", function (error, data, que) {
				seq.push(data = data + ",[4]");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			"f5", function (error, data, que) {
				seq.push(data = data + " ,5");

				showResult(seq.join("\n"), 3);

				var expect = "1, 2, 3,[4],[4],[4], 3,[4],[4],[4] ,5";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], "flow-loop");
	},

	"flow:fork-all": function (done) {
		var seq = [];
		var seqFull = [];

		cq(null, [
			function (error, data, que) {
				seq.push("1");
				seqFull.push(data = "1");
				que.next(null, data);
			},
			cq.fork("all", {
				"a": "2",
				"b": ["3", "5"],
				"c": "4"
			}, "6"),
			"2", function (error, data, que) {
				setTimeout(function () {
					seq.push("2");
					seqFull.push(data = data + ",2");
					que.next(null, data);
				}, 150);
			},
			"3", function (error, data, que) {
				setTimeout(function () {
					seq.push("3");
					seqFull.push(data = data + ",3");
					que.next(null, data);
				}, 100);
			},
			"4", function (error, data, que) {
				setTimeout(function () {
					seq.push("4");
					seqFull.push(data = data + ",4");
					que.next(null, data);
				}, 50);
			},
			"5", function (error, data, que) {
				setTimeout(function () {
					seq.push("5");
					seqFull.push(data = data + ",5");
					que.next(null, data);
				}, 100);
			},

			"6", function (error, data, que) {
				seq.push("6");

				var s = "seq=[" + seq.join(",") + "], result={";

				s += "a:(" + data[0]["a"][1] + "),";
				s += "b:(" + data[0]["b"][1] + "),";
				s += "c:(" + data[0]["c"][1] + "),";
				s += "count:" + data[1] + "}"

				showResult(seqFull.join("\n") + "\n" + s, 3);

				setTimeout(function () { que.next(null, s); }, 50);
			},
			function (error, data, que) {
				var expect = "seq=[1,4,3,2,5,6], result={a:(1,2),b:(1,3,5),c:(1,4),count:3}";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], 'flow:fork-all');
	},

	"flow:fork-any": function (done) {
		var seq = [];
		var seqFull = [];

		cq(null, [
			function (error, data, que) {
				seq.push("1");
				seqFull.push(data = "1");
				que.next(null, data);
			},
			cq.fork("any", {
				"a": "2",
				"b": ["3", "5"],
				"c": "4"
			}, "6"),
			"2", function (error, data, que) {
				setTimeout(function () {
					seq.push("2");
					seqFull.push(data = data + ",2");
					que.next(null, data);
				}, 150);
			},
			"3", function (error, data, que) {
				setTimeout(function () {
					seq.push("3");
					seqFull.push(data = data + ",3");
					que.next(null, data);
				}, 50);
			},
			"4", function (error, data, que) {
				setTimeout(function () {
					seq.push("4");
					seqFull.push(data = data + ",4");
					que.next(null, data);
				}, 100);
			},
			"5", function (error, data, que) {
				setTimeout(function () {
					seq.push("5");
					seqFull.push(data = data + ",5");
					que.next(null, data);
				}, 100);
			},

			"6", function (error, data, que) {
				seq.push("6");

				var s = "seq=[" + seq.join(",") + "], result={";

				s += "a:(" + (data[0]["a"] || "") + "),";
				s += "b:(" + (data[0]["b"] || "") + "),";
				s += "c:(" + data[0]["c"][1] + "),";
				s += "count:" + data[1] + ",last:" + data[2] + "}"

				showResult(seqFull.join("\n") + "\n" + s, 3);

				setTimeout(function () { que.next(null, s); }, 50);
			},
			function (error, data, que) {
				var expect = "seq=[1,3,4,6], result={a:(),b:(),c:(1,4),count:1,last:c}";
				done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				que.next(null, data);
			},
		], 'flow:fork-any');
	},

	"flow:join()": function (done) {
		var seq = ["0"];

		var doneFlag = 0;

		var queData = [
			function (error, data, que) {
				seq.push(data = seq[seq.length - 1] + ",1");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			cq.join("slow", "3", "join-1"),
			"slow", function (error, data, que) {

				console.log("slow " + que.processId);
				seq.push(data = seq[seq.length - 1] + ",2-slow");
				//lastQue = que;
				setTimeout(function () { que.next(null, data); }, 300);
			},
			"3", function (error, data, que) {
				console.log("3 " + que.processId);
				seq.push(data = seq[seq.length - 1] + ",3");
				setTimeout(function () { que.next(null, data); }, 50);
			},
			function (error, data, que) {
				showResult(seq.join("\n"), 3);

				data = seq[seq.length - 1];
				var expect = "0,1,1,2-slow,3,3";

				if (doneFlag) {
					done((data == expect) ? null : Error("expect (" + expect + ") but (" + data + ")"));
				}
				doneFlag++;

				que.next(null, data);
			},
		];

		cq(null, queData, "p1");
		cq(null, queData, "p2");
	},

};

// for html page
//if (typeof setHtmlPage === "function") setHtmlPage("title", "10em", 1);	//page setting
if (typeof showResult !== "function") showResult = function (text) { console.log(text); }

//for mocha
if (typeof describe === "function") describe('mocha-test', function () { for (var i in module.exports) { it(i, module.exports[i]); } });
