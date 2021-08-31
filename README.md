# callq

call queue

## install

`npm install callq`

## usage examples

```
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
