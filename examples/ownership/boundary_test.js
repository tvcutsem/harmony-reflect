// Copyright (C) 2013 Software Languages Lab, Vrije Universiteit Brussel

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

/**
 * Unit tests for the boundary abstraction.
 *
 * @author tvcutsem
 */

// require('reflect.js')
load('../../reflect.js');
// require('examples/generic_membrane.js')
load('../generic_membrane.js');
// require('examples/ownership/boundary.js)
load('boundary.js');

(function(exports){
  "use strict";
  
  function assert(bool) {
    if (!bool) throw new Error("assertion failed");
  }
  
  function assertFails(inOrOut, fn) {
    var re = /does not match/i;
    try {
      fn();
      assert(false, 'expected exception, but succeeded.');
    } catch(e) {
      if (!re.test(e.message)) {
        throw e;
      }
      if (inOrOut === "in") {
        if (!/in-filter/.test(e.message)) {
          print("expected in-filter violation");
          throw e;
        }
      } else {
        if (!/out-filter/.test(e.message)) {
          print("expected out-filter violation");
          throw e;
        }
      }
    }
  }
  
  var pass = 0;
  
  function test(fn) {
    fn();
    pass++;
  }
  
  test(function() {
    var f = function(){ return 42; }.class("foo");
    assert(typeof f === "function");
    assert(f() === 42);
    assert(f.__class__ === "foo");
  });
  
  function Box(init) {
    this.state = init;
  }
  Box.prototype.read = function read(){
    return this.state;
  }.class("readonly");
  Box.prototype.write = function write(v) {
    this.state = v;
  }.class("mutator");
  Box.prototype.toString = function toString() {
    return "[Box: " + this.state.toString() + "]";
  };
  
  test(function() {
    var aFoo = {toString: function toString(){ return "foo"; }};
    
    var boundary = new Boundary({
      in: [], // empty list implies no methods are allowed
      out: '*', // * implies all methods are allowed
      entry: function initF(init) {
        return new Box(init);
      }
    })
    var boundedBoxMaker = boundary.entry;

    var boundBox = boundedBoxMaker(aFoo);
    assertFails("in", function(){ boundBox.toString(); });
  });
  
  test(function() {
    var boundary = new Boundary({
      in: [],
      out: [".readonly"],
      entry: new Box(42)
    });
    var boundBox = boundary.entry;
    
    assertFails("out", function() { boundBox.write(24); });
    // TypeError: method 'write' does not match boundary
    // out-filters '[".readonly"]' ('write' is classified as
    // '["mutator"]')
  });
  
  test(function() {
    var boundary = new Boundary({
      in: [],
      out: [".readonly", "#init"],
      entry: function init() {
        var calculator = {
          square : function square(x) { return x * x; }
        };
        return new Box(calculator);
      }
    });
    var boxedCalculatorMaker = boundary.entry;
    
    var boundBox = boxedCalculatorMaker();
    var calc = boundBox.read(); // ok, read is classified as "readonly"
    assertFails("out", function() { calc.square(4); });
    // TypeError: method 'square' does not match boundary
    // out-filters '[".readonly"]' ('square' is not classified)
  });
  
  test(function() {
    var boundary = new Boundary({
      in: [ '#iter' ],
      out: [ '#forEach', '#init' ],
      entry: function init() {
        var circle = { paint: function paint() { /*...*/ } };
        var triangle = { paint: function paint() { /*...*/ } };
        var square = { paint: function paint() { /*...*/ } };
        return [circle, triangle, square];
      }
    });
    var shapeMaker = boundary.entry;
    
    var shapes = shapeMaker();
    shapes.forEach(function iter(shape) {
      // shape parameter passed into the callback also transitively
      // enforces boundary filters
      assertFails("out", function() { shape.paint(); });
      // TypeError: method 'paint' does not match boundary out-filters
      // '[ "#forEach", "#init" ]' ('paint' is not classified)
    });
  });
  
  test(function() {
    var token = {};
    var boundary = new Boundary({
      in: [],
      out: '*',
      entry: function(val) {
        return new Box(val);
      }
    });
    var boundedBoxMaker = boundary.entry;
    
    var boundBox = boundedBoxMaker(token);   
    var readToken = boundBox.read();
    assert(token === readToken);
  });
  
  test(function() {
    var b1 = new Boundary({
      in: [ ],
      out: [".readonly", "#init"],
      entry: function init(val) {
        var b2 = new Boundary({
          in: [ ],
          out: [".readonly", ".mutator"],
          entry: new Box(42)
        });
        return b2.entry;
      }
    });
    
    var doubleBoundBox = b1.entry(); 
    assert(42 === doubleBoundBox.read()); // ok, returns 42
    assertFails("out", function() { doubleBoundBox.write(24); });
    // FIXME:
    // in v8, the error string displays 'wrapper' rather than 'write' as the name of the method
    // we cannot transparently wrap the 'name' attribute of functions
    // in js, invariant violation kicks in and complains about redefining 'name'
    
    // TypeError: method 'write' does not match boundary
    // out-filters '[".readonly","#init"]' ('write' is classified as
    // '["mutator"]')
  });
  
  print("passed "+pass+" tests");
  
}(typeof exports !== "undefined" ? exports : this));