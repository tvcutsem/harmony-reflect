// Copyright (C) 2013 Software Languages Lab, Vrije Universiteit Brussel
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
 * The Original Code is unit tests for membranes.
 *
 * The Initial Developer of the Original Code is
 * Tom Van Cutsem, Vrije Universiteit Brussel.
 * Portions created by the Initial Developer are Copyright (C) 2013
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 */

// ----------------------------------------------------------------------------

// test suite works both with membranes implemented using Direct Proxies as
// well as Notification Proxies
//  for Direct Proxies, load '../examples/membrane.js'
//load('../reflect.js');
//load('../examples/membrane.js');

//  for Notification Proxies, load '../notification/membrane.js'
load('../notification/notify-reflect.js');
load('../notification/membrane.js');

(function(){
  "use strict";
  
  function assert(b, reason) {
    if (!b) throw new Error('assertion failed: '+reason);
  }
  function assertThrows(reason, msg, f) {
    try {
      f();
      throw new Error('assertThrows: no exception raised: '+reason);
    } catch(e) {
      if (!msg.test(e.message)) {
        throw e;
      }
    }
  }

  var TESTS = Object.create(null); // unit test functions stored in here

  // each unit test is a function(membraneMaker)
  // where membraneMaker is a function to construct an initial membrane

  // test simple transitive wrapping
  // test whether primitives make it through unwrapped
  TESTS.testTransitiveWrapping = function(makeMembrane) {
    // membrane works for configurable properties
    var wetA = {x:1};
    var wetB = {y:wetA};
    var membrane = makeMembrane(wetB);
    var dryB = membrane.target;
    var dryA = dryB.y;
    assert(wetA !== dryA, 'wetA !== dryA');
    assert(wetB !== dryB, 'wetB !== dryB');
    assert(wetA.x === 1, 'wetA.x === 1');
    assert(dryA.x === 1, 'dryA.x === 1');
    membrane.revoke();
    assert(wetA.x === 1, 'wetA.x === 1 after revoke');
    assert(wetB.y === wetA, 'wetB.y === wetA after revoke');
    assertThrows('dryA.x', /revoked/, function() { dryA.x });
    assertThrows('dryB.y', /revoked/, function() { dryB.y });
  };

  // test whether functions are wrapped
  TESTS.testFunctionWrapping = function(makeMembrane) {
    var wetA = function(x) { return x; };
    var membrane = makeMembrane(wetA);
    var dryA = membrane.target;

    assert(wetA !== dryA, 'wetA !== dryA');
    assert(wetA(1) === 1, 'wetA(1) === 1');
    assert(dryA(1) === 1, 'dryA(1) === 1');

    membrane.revoke();
    assert(wetA(1) === 1, 'wetA(1) === 1 after revoke');
    assertThrows('dryA(1) after revoke', /revoked/, function() { dryA(1) });
  };

  // test whether values returned from wrapped methods are wrapped
  TESTS.testReturnWrapping = function(makeMembrane) {
    var wetA = { x: 42 };
    var wetB = {
      m: function() { return wetA; }
    };
    var membrane = makeMembrane(wetB);
    assert(wetA.x === 42, 'wetA.x === 42');
    assert(wetB.m().x === 42, 'wetB.m().x === 42');

    var dryB = membrane.target;
    var dryA = dryB.m();

    assert(wetA !== dryA, 'wetA !== dryA');
    assert(wetB !== dryB, 'wetB !== dryB');

    assert(dryA.x === 42, 'dryA.x === 42');

    membrane.revoke();

    assertThrows('dryA.x', /revoked/, function() { dryA.x });
    assertThrows('dryB.m()', /revoked/, function() { dryB.m() });  
  };

  // test whether the prototype is also wrapped
  TESTS.testProtoWrapping = function(makeMembrane) {
    var wetA = { x: 42 };
    var wetB = Object.create(wetA);

    assert(Object.getPrototypeOf(wetB) === wetA,
           'Object.getPrototypeOf(wetB) === wetA');

    var membrane = makeMembrane(wetB);
    var dryB = membrane.target;
    var dryA = Object.getPrototypeOf(dryB);

    assert(wetA !== dryA, 'wetA !== dryA');
    assert(wetB !== dryB, 'wetB !== dryB');

    assert(dryA.x === 42, 'dryA.x === 42');
    membrane.revoke();
    assertThrows('dryA.x', /revoked/, function() { dryA.x });
  };

  // test whether typeof results are unchanged when
  // crossing a membrane
  TESTS.testTypeOf = function(makeMembrane) {
    var wetA = {
      obj: {},
      arr: [],
      fun: function(){},
      nbr: 1,
      str: "x",
      nul: null,
      udf: undefined,
      bln: true,
      rex: /x/,
      dat: new Date()
    };
    var membrane = makeMembrane(wetA);
    var dryA = membrane.target;

    Object.keys(wetA).forEach(function (name) {
      assert(typeof wetA[name] === typeof dryA[name],
             'typeof wetA['+name+'] === typeof dryA['+name+']');
    });
  };

  // test observation of non-configurability of wrapped properties
  TESTS.testNonConfigurableObservation = function(makeMembrane) {
    var wetA = Object.create(null, {
      x: { value: 1,
           writable: true,
           enumerable: true,
           configurable: false }
    });

    assert(wetA.x === 1, 'wetA.x === 1');
    assert(!Object.getOwnPropertyDescriptor(wetA,'x').configurable,
           'wetA.x is non-configurable');

    var membrane = makeMembrane(wetA);
    var dryA = membrane.target;

    // perhaps surprisingly, just reading out the property value works,
    // since no code has yet observed that 'x' is a non-configurable
    // own property.
    assert(dryA.x === 1, 'dryA.x === 1');

    // membranes should expose a non-configurable prop as non-configurable
    var exactDesc = Object.getOwnPropertyDescriptor(dryA,'x');
    assert(!exactDesc.configurable, 'exactDesc.configurable is false');
    assert(exactDesc.value === 1, exactDesc.value === 1);
    assert(exactDesc.enumerable, 'exactDesc.enumerable is true');
    assert(exactDesc.writable, 'exactDesc.writable is true');

    assert(dryA.x === 1, 'dryA.x === 1');
  };

  // test non-extensibility across a membrane  
  TESTS.testNonExtensibility = function(makeMembrane) {
    var wetA = Object.preventExtensions({x:1});
    assert(!Object.isExtensible(wetA), 'wetA is non-extensible');

    var membrane = makeMembrane(wetA);
    var dryA = membrane.target;

    assert(dryA.x === 1, 'dryA.x === 1');

    assert(!Object.isExtensible(dryA), 'dryA is also non-extensible');

    var dryDesc = Object.getOwnPropertyDescriptor(dryA,'x');
    assert(dryDesc.value === 1);

    assert(Reflect.hasOwn(dryA,'x'));
  };

  // test assignment into a membrane
  TESTS.testAssignment = function(makeMembrane) {
    var wetA = {x:1};
    assert(wetA.x === 1, 'wetA.x === 1');

    var membrane = makeMembrane(wetA);
    var dryA = membrane.target;

    Object.defineProperty(dryA,'y',
      { value:2,
        writable:true,
        enumerable:true,
        configurable:true });
    assert(dryA.y === 2, 'dryA.y === 2');

    assert(dryA.x === 1, 'dryA.x === 1');
    dryA.x = 2;
    assert(dryA.x === 2, 'dryA.x === 2');

    membrane.revoke();

    assertThrows("dryA.x = 3", /revoked/, function() { dryA.x = 3; });
  };

  // test definition of a new non-configurable property on a membrane
  TESTS.testNonConfigurableDefinition = function(makeMembrane) {
    var wetA = {};  
    var membrane = makeMembrane(wetA);
    var dryA = membrane.target;

    function defineProp() {
      Object.defineProperty(dryA,'x',
        { value:1,
          writable:true,
          enumerable:true,
          configurable:false });
    }

    // membranes should allow definition of non-configurable props
    defineProp();
    assert(dryA.x === 1, 'dryA.x === 1');
    assert(wetA.x === 1, 'wetA.x === 1');
  };

  // test that a membrane preserves object identity
  TESTS.testIdentitySimpleMembrane = function(makeMembrane) {
    var wetA = {};
    var wetB = {x:wetA};
    var membrane = makeMembrane(wetB);
    var dryB = membrane.target;

    var dryA1 = dryB.x;
    var dryA2 = dryB.x;
    assert(dryA1 === dryA2, 'dryA1 === dryA2');
  };

  // test that a membrane properly unwraps a value when crossing the
  // boundary wet->dry and then dry->wet, instead of doubly wrapping the value
  TESTS.testCrossingSimpleMembrane = function(makeMembrane) {
    var wetA = {
      out: {},
      id: function(x) { return x; }
    };
    
    var membrane = makeMembrane(wetA);
    var dryA = membrane.target;
    var dryB = dryA.out;
    var dryC = {};
    
    var outWetB = dryA.id(dryB);
    assert(dryB === outWetB, 'dryB === outWetB');
    
    var outWetA = dryA.id(dryA);
    assert(dryA === outWetA, 'dryA === outWetA');
    
    var outC = dryA.id(dryC);
    assert(outC === dryC, 'outC === dryC');
  };
  
  // TODO: test operations other than simple property access/update:
  // delete, in-operator, for-in, etc.

  // simple test driver loop
  function runTests() {
    for (var testName in TESTS) {
      print("test: " + testName);
      TESTS[testName](makeMembrane);
      print("ok");
    }
    print("done");
  }

  runTests();
  
}());