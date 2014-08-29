// Copyright (C) 2011-2012 Software Languages Lab, Vrije Universiteit Brussel
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
 * Portions created by the Initial Developer are Copyright (C) 2011-2012
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

function drainToArray(iterator) {
  var props = [];
  var nxt = iterator.next();
  while (!nxt.done) {
    props.push(nxt.value);
    nxt = iterator.next();
  }
  if (nxt.value !== undefined) {
    props.push(nxt.value);
  }
  return props; 
}

// the 'main' function
function test() {
  
  // getOwnPropertyDescriptor(target : object, name : string) -> object?
  (function(){
    assert(Reflect.getOwnPropertyDescriptor({x:1},'x').value === 1,
           'getOwnPropertyDescriptor existent property');
    assert(Reflect.getOwnPropertyDescriptor({x:1},'y') === undefined,
           'getOwnPropertyDescriptor non-existent property');    
  }());

  // defineProperty(target : object, name : string, desc : object) -> bool
  (function(){
    var target = {x:1};
    assert(Reflect.defineProperty(target, 'x', {value: 2}) === true &&
           target.x === 2,
           'defineProperty update success');
    assert(Reflect.defineProperty(target, 'y', {value: 3}) === true &&
           target.y === 3,
           'defineProperty addition success');
    Object.defineProperty(target,'z',{
      value:0,
      writable:false,
      configurable:false });
    assert(Reflect.defineProperty(target, 'z', {value: 1}) === false &&
           target.z === 0,
           'defineProperty update failure');
  }());

  // ownKeys(target : object) -> array[string]
  (function(){
    var target = Object.create(Object.prototype, {
      x: { value:1, enumerable: true  },
      y: { value:2, enumerable: false },
      z: { get: function(){}, enumerable: true }
    });
    var result = Reflect.ownKeys(target);
    assert(result.length === 3 &&
           result.indexOf('x') !== -1 &&
           result.indexOf('y') !== -1 &&
           result.indexOf('z') !== -1,
           'ownKeys success');
  }());
  
  // deleteProperty(target : object, name : string) -> bool
  (function(){
    var target = Object.create(Object.prototype, {
      x: { value:1, configurable: true  },
      y: { value:2, configurable: false },
    });
    
    assert(Reflect.deleteProperty(target, 'x') === true &&
           target.x === undefined,
           'deleteProperty success');
    assert(Reflect.deleteProperty(target, 'y') === false &&
           target.y === 2,
           'deleteProperty failure');    
  }());
  
  // enumerate(target : object) -> iterator[string]
  (function(){
    var target = Object.create({ z:3 }, {
      x: { value:1, enumerable: true  },
      y: { value:2, enumerable: false },
    });
    var result = Reflect.enumerate(target);
    result = drainToArray(result);
    assert(result.length === 2 &&
           result.indexOf('x') !== -1 &&
           result.indexOf('z') !== -1,
           'enumerate success');
  }());
  
  // preventExtensions(target : object) -> bool
  (function(){
    var target = {x:1};
    assert(Reflect.preventExtensions(target) === true, 'pE success');
    assert(Object.isExtensible(target) === false, 'pE -> non-extensible');
    var desc = Reflect.getOwnPropertyDescriptor(target,'x');
    assert(desc.configurable === true, 'pE -/-> non-configurable'); 
    assert(desc.writable === true, 'pE -/-> non-writable');     
  }());
  
  // has(target : object, name : string) -> bool
  (function(){
    var proto = {x:1};
    var target = Object.create(proto, {y: {value:2 }});
    assert(Reflect.has(target, 'x') === true, 'has proto ok');
    assert(Reflect.has(target, 'y') === true, 'has own ok');
    assert(Reflect.has(target, 'z') === false, 'has failure');
  }());
  
  // get(target : object, name : string, receiver : object?) -> any
  (function(){
    var target = Object.create({z:3, get w() { return this; }}, {
      x: { value: 1 },
      y: { get: function() { return this; } },
    });
    
    var receiver = {};
    assert(Reflect.get(target,'x',receiver) === 1,         'get x');
    assert(Reflect.get(target,'y',receiver) === receiver,  'get y');
    assert(Reflect.get(target,'z',receiver) === 3,         'get z');
    assert(Reflect.get(target,'w',receiver) === receiver,  'get w');
    assert(Reflect.get(target,'u',receiver) === undefined, 'get u');
  }());
  
  // set(target : object, name : string, value : any, receiver : object?) -> bool
  (function(){
    var out;
    var target = Object.create({z:3,
                                set w(v) { out = this; }}, {
      x: { value: 1, writable: true, configurable: true },
      y: { set: function(v) { out = this; } },
      c: { value: 1, writable: false, configurable: false },
    });
    
    assert(Reflect.set(target,'x',2,target) === true &&
           target.x === 2,
           'set x');
    
    out = null; // reset out
    assert(Reflect.set(target,'y',1,target) === true &&
           out === target,
           'set y');
    
    assert(Reflect.set(target,'z',4,target) === true &&
           target.z === 4,
           'set z');
    
    out = null; // reset out
    assert(Reflect.set(target,'w',1,target) === true &&
           out === target,
           'set w');
           
    assert(Reflect.set(target,'u',0,target) === true &&
           target.u === 0,
           'set u');

    assert(Reflect.set(target,'c',2,target) === false &&
           target.c === 1,
           'set c');
  }());
  
  // invoke(target : object, name: string, args : array, receiver: object?) -> any
  /*(function(){
    var target = {
      foo: function(x,y) { return x+y; },
      bar: function() { return this; }
    };
    assert(Reflect.invoke(target, "foo", [1,2]) === 3,
                          'invoke foo');
    assert(Reflect.invoke(target, "bar", []) === target,
                          'invoke bar');
                          
    var rcvr = {};
    assert(Reflect.invoke(target, "bar", [], rcvr) === rcvr,
                          'invoke bar with receiver');
                          
    try {
      Reflect.invoke(target,"baz",[]);
      assert(false, "invoke baz");
    } catch (e) {
      assert(true, "invoke baz");
    }
  }());*/
  
  // apply(target : object, receiver : object?, args : array) -> any
  (function(){
    assert(Reflect.apply(function(x) { return x; },
                         undefined,
                         [1]) === 1, 'apply identity');

    var receiver = {};
    assert(Reflect.apply(function() { return this; },
                         receiver,
                         []) === receiver, 'apply this');
  }());
  
  // construct(target : object, args : array) -> any
  (function(){
    assert(Reflect.construct(function(x) { return x; },
                             [1]) !== 1, 'construct identity');

    assert(Reflect.construct(function(x,y,z) { this.x = x; },
                             [1,2,3]).x === 1, 'construct this');    
  }());
  
  // test whether proxies for arrays are treated as arrays
  (function(){
    var p = Proxy([], {}); // a proxy for an array
    assert(Object.prototype.toString.call(p) === '[object Array]',
           'toString(p) = [object Array]');
    assert(Array.isArray(p), 'Array.isArray(p)');
    // below test fails because JSON.stringify uses a [[Class]] check
    // to test whether p is an array, and we can't intercept that
    // assert(Array.isArray(JSON.parse(JSON.stringify(p))), 'JSON stringify array');
  }());
  
  // Rev16 change to [[Set]]. Cf. https://bugs.ecmascript.org/show_bug.cgi?id=1549
  (function(){
    var target = {};
    var receiver = {};

    Reflect.set(target, "foo", 1, receiver);
    assert(target.foo === undefined, 'target.foo === undefined');
    assert(receiver.foo === 1, 'receiver.foo === 1'); // new property added to receiver

    Object.defineProperty(receiver, "bar",
      { value: 0,
        writable: true,
        enumerable: false,
        configurable: true });

    Reflect.set(target, "bar", 1, receiver);

    assert(receiver.bar === 1, 'receiver.bar === 1'); // value of existing receiver property updated
    assert(Object.getOwnPropertyDescriptor(receiver,"bar").enumerable === false,
           'enumerability not overridden'); // enumerability was not overridden
  }());
  
  // setPrototypeOf(target : object, newProto : object | null) -> boolean
  (function() {
    try {
      Reflect.setPrototypeOf({},{});
    } catch(e) {
      if (e.message === "setPrototypeOf not supported on this platform") {
        return;
      } else {
        throw e;
      }
    }
    
    var oldProto = {};
    var target = Object.create(oldProto);
    var newProto = {};
    Reflect.setPrototypeOf(target, newProto);
    assert(Reflect.getPrototypeOf(target) === newProto);
    assertThrows("Object prototype may only be an Object or null: undefined",
      function() {
        Reflect.setPrototypeOf(target, undefined);
      });
  }());
  
}

if (typeof window === "undefined") {
  test();
}