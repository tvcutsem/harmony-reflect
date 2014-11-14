// Copyright (C) 2012 Software Languages Lab, Vrije Universiteit Brussel
// This code is dual-licensed under both the Apache License and the MPL

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is a series of unit tests for the ES-harmony reflect module.
 *
 * The Initial Developer of the Original Code is
 * Tom Van Cutsem, Vrije Universiteit Brussel.
 * Portions created by the Initial Developer are Copyright (C) 2012
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 */
// for node.js
if(typeof require === 'function') {
  var load = require;
  var print = function(msg) {
    if(/^fail/.test(msg)) { console.error(msg); }
    else { console.log(msg); }
  }
}
load('../reflect.js');

function assert(b, msg) {
  print((b ? 'success: ' : 'fail: ') + msg);
}

function assertThrows(message, fn) {
  try {
    fn();
    print('fail: expected exception, but succeeded. Message was: '+message);
  } catch(e) {
    assert(e.message === message, "assertThrows: "+e.message);
  }
}

// the 'main' function
function test() {
  
  (function(){
    // https://github.com/tvcutsem/harmony-reflect/issues/11
    function f() {}
    var p = Proxy(f, {});
    var proto = {};
    p.prototype = proto;
    assert(p.prototype === proto, 'prototype changed via p');
    assert(f.prototype === proto, 'prototype changed via f');
  }());
  
  (function(){
    // https://github.com/tvcutsem/harmony-reflect/issues/16
    assert(({}).toString.apply(1) === '[object Number]',
           'toString Number');
           
    assert(({}).toString.apply(true) === '[object Boolean]',
           'toString Boolean');
           
    assert(({}).toString.apply('asdf') === '[object String]',
           'toString String');
           
    assert(({}).toString.apply(null) === '[object Null]',
           'toString null');
           
    assert(({}).toString.apply(undefined) === '[object Undefined]',
           'toString undefined');
           
    assert(({}).toString.apply([]) === '[object Array]',
           'toString Array');
           
    assert(({}).toString.apply({}) === '[object Object]',
           'toString Object');

    assert(({}).toString.apply(new Proxy({},{})) === '[object Object]',
           'toString Proxy');
  }());
  
  (function(){
    // https://github.com/tvcutsem/harmony-reflect/issues/19
    var a = [1,2];
    var h = {};
    var aProxy = Proxy(a, h);
    var aConcat = [].concat(a);
    var aProxyConcat = [].concat(aProxy);

    assert(JSON.stringify(aConcat) === "[1,2]", 'aConcat eq [1,2]');
    assert(JSON.stringify(aProxyConcat) === "[1,2]", 'aProxyConcat eq [1,2]');
    
    assert(JSON.stringify([].concat())         === "[]",      'plain concat 1');
    assert(JSON.stringify([1].concat(2))       === "[1,2]",   'plain concat 2');
    assert(JSON.stringify([1].concat(2,[3]))   === "[1,2,3]", 'plain concat 3');
    assert(JSON.stringify([1].concat(2,3))     === "[1,2,3]", 'plain concat 4');    
    assert(JSON.stringify([1].concat([2],[3])) === "[1,2,3]", 'plain concat 5');
    assert(JSON.stringify([].concat([]))       === "[]",      'plain concat 6');
    assert(JSON.stringify([].concat(1))        === "[1]",     'plain concat 7');
  }());
  
  (function(){
    // isPrototypeOf doesn't work if __proto__ is changed after proxy is created
    var b = {base: 'base'};
    var o = {foo: 'bar'};
    var h = {};
    var oProxy = Proxy(o, h);
    o.__proto__ = b;
    assert(b.isPrototypeOf(oProxy), 'isPrototypeOf test1');
  }());
  
  (function(){
    // isPrototypeOf doesn't work if __proto__ is changed after proxy is created
    var a = {a : 'a'};
    var b = {base: 'base'};
    var bProxy = Proxy(b, {});
    b.__proto__ = a;
    var o = {foo: 'bar'};
    var oProxy = Proxy(o, {});
    o.__proto__ = bProxy;
    assert(bProxy.isPrototypeOf(oProxy), 'isPrototypeOf test2a');
    assert(a.isPrototypeOf(oProxy), 'isPrototypeOf test2b');
  }());
 
  (function(){
    // inheritance and proxies: https://github.com/tvcutsem/harmony-reflect/issues/23
    // prototype has the property
    var proto = {age: 1}
    var proxiedProto = new Proxy(proto, {
        set: function(target, name, value) {
            target[name] = value; return true;
        }
    });

    var obj = Object.create(proxiedProto);
    obj.age = 2;

    assert(obj.age === 2, 'obj.age === 2');
    assert(obj.hasOwnProperty('age') === false, 'age lives on prototype');
    assert(proto.age === 2, 'age on prototype updated');
  }());
  
  (function(){
    // inheritance and proxies: https://github.com/tvcutsem/harmony-reflect/issues/23
    // prototype does not have the property
    var proto = {};
    var proxiedProto = new Proxy(proto, {
        has: function() { return true; }, // without this line, set trap is not called!
        set: function(target, name, value) {
            target[name] = value; return true;
        }
    });

    var obj = Object.create(proxiedProto);
    obj.age = 2;

    assert(obj.age === 2, 'obj.age === 2');
    assert(obj.hasOwnProperty('age') === false, 'age lives on prototype');
    assert(proto.age === 2, 'age on prototype updated');
  }());
  
  (function () {
    var obj = {};
    assert(Object.freeze(obj) === obj, 'freeze returns obj');
    var obj2 = {};
    assert(Object.seal(obj2) === obj2, 'seal returns obj');
  }());
  
  // see https://github.com/tvcutsem/harmony-reflect/issues/43
  (function () {

    function wrap(obj) {
        return new Proxy(obj, {});
    }
    var proxy = wrap({a: 1, b: 2});
    var result = [];
    for (var prop in proxy) { result.push(prop) }
    assert(JSON.stringify(result) === '["a","b"]',
           'enumerate on proxy returns a,b');

    result = [];
    proxy = wrap(proxy);
    for (var prop in proxy) { result.push(prop) }
    assert(JSON.stringify(result) === '["a","b"]',
           'enumerate on proxied proxy returns a,b');
  }());
  
}

if (typeof window === "undefined") {
  test();
}