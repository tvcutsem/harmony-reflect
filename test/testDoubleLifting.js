// for node.js
if(typeof require === 'function') {
  var load = require;
  var print = function(msg) {
    if(/^fail/.test(msg)) { console.error(msg); }
    else { console.log(msg); }
  }
}

load('../reflect.js');

// a proxy making use of "double-lifting" (i.e. a proxy whose handler is a proxy)

var metaHandler = {
  get: function(dummyTarget, trapName, dummyReceiver) {
    return function(/*...trapArgs*/) { // function acting as a generic trap, its this-binding is irrelevant
      var trapArgs = Array.prototype.slice.call(arguments);
      print("intercepting "+trapName);
      //return Reflect[trapName](...trapArgs); // forward manually
      return Reflect[trapName].apply(undefined, trapArgs);
    }
  },
};

var target = {x:1};
var dummy = {};
var doubleLiftedProxy = new Proxy(target, new Proxy(dummy, metaHandler));

// tests
print(doubleLiftedProxy.x) // intercepting get, evals to 1
print('x' in doubleLiftedProxy) // interecepting has, evals to true

// expected output:
// intercepting get
// 1
// intercepting has
// true