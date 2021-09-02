
var assert = require("assert");

showResult= function( txt ) { console.log(txt); }	//global interface
setHtmlPage= function() {}				//global interface

require("./test-data.js");

describe( 'mocha-test', function () {
	for( var i in testData ){ it( i, testData[i] ); }
});
