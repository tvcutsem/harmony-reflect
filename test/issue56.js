var assert = require('assert');

var a = require('../reflect')
assert(new Proxy({}, {}).toString() === '[object Object]');
var b = require('harmony-reflect')
assert(a !== b);
assert(new Proxy({}, {}).toString() === '[object Object]'); // fails
console.log('ok');