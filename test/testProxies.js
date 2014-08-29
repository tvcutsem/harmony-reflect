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
 * The Original Code is a series of unit tests for ES-harmony direct proxies.
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

(function(global){

  var VERBOSE = false;
  var passed = 0;
  var total = 0;

  function assert(bool, msg) {
    total++;
    if (bool) {
      passed++;
      if (VERBOSE) { print('success: ' + msg); }
    } else {
      print('fail: ' + msg);
    }
  }

  function assertThrows(message, fn) {
    // Different js engines use different language for the errors
    // This is a small hack to allow them to pass while other unexpected
    // errors still fail. There may be gaps here that would allow
    // failing tests to get through
    var re = /cannot|can't|redefine|trap/i;
    try {
      fn();
      assert(false, 'expected exception, but succeeded. Message was: '+message);
    } catch(e) {
      assert(e.message === message, "assertThrows: "+message+" !== " +e.message);
      // FIXME: relax test suite message detection
      // re.test(e.message) && re.test(message), "assertThrows: "+e.message);
    }
  }
  
  // returns an ES6-compatible iterator for an array
  function createArrayIterator(array) {
    var l = +array.length;
    var idx = 0;
    return {
      next: function() {
        if (idx === l) return { done: true };
        return { done: false, value: array[idx++] };
      }
    };
  }

  // exhausts an ES6-compatible iterator and stores all
  // enumerated values in an array
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
  global.test = function test() {
    var emulatedProps,
        emulatedProto,
        success,
        brokenProxy,
        target,
        result;

    try {
      testTrapEvenWhenFrozen();
      testForwarding();
      testInheritance();
      testFunctions();
      testSet();
      testTransparentWrappers();
      testRevocableProxies();
      testSetPrototypeOf();
      testSetPrototypeOfUndefined();
      testUpdatePropertyDescriptor();
      //testInvokeTrap();

      for (var testName in TESTS) {
        emulatedProps = {};
        emulatedProto = {};
        target = Object.create(emulatedProto);
        success = {};
        brokenProxy = createEmulatedObject(target, emulatedProps, success);
        if (VERBOSE) { print('>>> '+testName); }
        TESTS[testName](brokenProxy, emulatedProps, emulatedProto, success,
                        target);
      }
    } catch (e) {
      assert(false, 'unexpected exception: '+ e);
    }

    print('' + passed + '/' + total + ' assertions passed.');
  }

  /**
   * This function returns a proxy that will emulate the properties stored
   * in emulatedProps (a mapping from names to property descriptors).
   * The intent is that the test suite can freely modify the emulatedProps,
   * in order to provoke erroneous behavior on the returned proxy.
   *
   * The proxy wraps the given target object.
   *
   * Both target and proxy inherit from emulatedProto, which is a plain object
   * (not a mapping from property names to property descriptors.)
   *
   * success is a mapping from names to booleans. The test suite should
   * use it to indicate what the return value should be for the
   * 'defineProperty', 'set' and 'deleteProperty' traps.
   */
  function createEmulatedObject(target, emulatedProps, success) {
    var emulatedProto = Object.getPrototypeOf(target);
    var handler = {
      getOwnPropertyDescriptor: function(target, name) {
        return emulatedProps[name];
      },
      defineProperty: function(target, name, desc) {
        emulatedProps[name] = desc;
        return success[name];
      },
      preventExtensions: function(target) {
        Object.defineProperties(target, emulatedProps);
        Object.preventExtensions(target);
        return true;
      },
      deleteProperty: function(target, name) {
        delete emulatedProps[name];
        return success[name];
      },
      ownKeys: function(target) {
        return Object.getOwnPropertyNames(emulatedProps);
      },
      get: function(target, name, receiver) {
        var desc = emulatedProps[name];
        if (desc === undefined) { return emulatedProto[name]; }
        if ('value' in desc) return desc.value;
        if ('get' in desc) return desc.get.call(target);
      },
      set: function(target, name, value, receiver) {
        return success[name];
      },
      has: function(target, name) {
        return !!emulatedProps[name];
      },
      enumerate: function(target) {
        var props =
          Object.getOwnPropertyNames(emulatedProps).filter(function (name) {
            return emulatedProps[name].enumerable;
          });
        return createArrayIterator(props);
      }
    };
    return Proxy(target, handler);
  }

  /**
   * The methods of this object are unit tests that each detect a particular
   * invariant violation.
   */
  var TESTS = Object.create(null);

  TESTS.testNonConfigurableExists =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      emulatedProps.x = {value:1,configurable:false};
      // to emulate non-configurable props, must make sure they exist on target
      Object.defineProperty(target, 'x', emulatedProps.x);
      var result = Object.getOwnPropertyDescriptor(brokenProxy, 'x');
      assert(result.value === 1 && result.configurable === false,
             'x was observed as non-configurable');
      delete emulatedProps.x;
      assertThrows("cannot report non-configurable property 'x' as non-existent",
        function() { Object.getOwnPropertyDescriptor(brokenProxy, 'x'); });
    };

  TESTS.testCantEmulateNonExistentNonConfigurableProps =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      emulatedProps.x = {value:1,configurable:false};
      assertThrows("cannot report a non-configurable descriptor for "+
                   "configurable or non-existent property 'x'",
        function() { Object.getOwnPropertyDescriptor(brokenProxy, 'x'); });
    };

  TESTS.testCantEmulateConfigurableAsNonConfigurableProps =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      Object.defineProperty(target, 'x', {
        value:1,
        configurable:true,
        writable:true,
        enumerable:true});
      emulatedProps.x = {value:1,configurable:false,writable:true,enumerable:true};
      assertThrows("cannot report a non-configurable descriptor for "+
                   "configurable or non-existent property 'x'",
        function() { Object.getOwnPropertyDescriptor(brokenProxy, 'x'); });
    };

  TESTS.testCantDefineNonExistentNonConfigurableProp =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      success.x = true;
      assertThrows("cannot successfully define a non-configurable "+
                   "descriptor for configurable or non-existent property 'x'",
        function() { Object.defineProperty(brokenProxy, 'x',
                                           {value:1,configurable:false}); });
    };

  TESTS.testCantDefineConfigurableAsNonConfigurableProp =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      Object.defineProperty(target, 'x', {
        value:1,
        writable:true,
        enumerable:true,
        configurable:true });
      success.x = true;
      assertThrows("cannot successfully define a non-configurable "+
                   "descriptor for configurable or non-existent property 'x'",
        function() { Object.defineProperty(brokenProxy, 'x',
                                           {value:1,
                                            writable:true,
                                            enumerable:true,
                                            configurable:false}); });
    };

  TESTS.testNonConfigurableRedefinition =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      emulatedProps.x = {value:1,configurable:false};
      // to emulate non-configurable props, must make sure they exist on target
      Object.defineProperty(target, 'x', emulatedProps.x);
      var result = Object.getOwnPropertyDescriptor(brokenProxy, 'x');
      assert(result.value === 1 && result.configurable === false,
             'x was observed as non-configurable');
      emulatedProps.x = {value:1,configurable:true}
      assertThrows("cannot report incompatible property descriptor for property 'x'",
        function() { Object.getOwnPropertyDescriptor(brokenProxy, 'x'); });
    };

  TESTS.testNonExtensibleReportNoNewProps =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      emulatedProps.x = {value:1,configurable:false};
      // to emulate non-configurable props, must make sure they exist on target
      Object.defineProperty(target, 'x', emulatedProps.x);
      var result = Object.getOwnPropertyDescriptor(brokenProxy, 'x');
      assert(result.value === 1 && result.configurable === false,
             'x was observed as non-configurable');
      Object.preventExtensions(brokenProxy);
      emulatedProps.y = {value:2,configurable:true};
      assertThrows("cannot report a new own property 'y' on a non-extensible object",
        function() { Object.getOwnPropertyDescriptor(brokenProxy, 'y'); });
    };

  TESTS.testNonExtensibleDefineNoNewProps =
    function(brokenProxy, emulatedProps, emulatedProto, success) {
      emulatedProps.x = {value:1,writable:true,configurable:true};
      Object.preventExtensions(brokenProxy);
      // should still be possible to update 'x'
      success.x = true;
      Object.defineProperty(brokenProxy,'x',{
        value: 2,
        writable: true,
        enumerable: true,
        configurable: true
      });
      var result = Object.getOwnPropertyDescriptor(brokenProxy, 'x');
      assert(result.value === 2, 'x was updated');
      // should not be possible to add a new property 'y'
      assertThrows("cannot successfully add a new property 'y' to a "+
                   "non-extensible object",
        function() {
          success.y = true;
          Object.defineProperty(brokenProxy, 'y', {value:3});
        });
    };

  TESTS.testNonConfigurableNoDelete =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      emulatedProps.x = {value:1, configurable:false};
      // to emulate non-configurable props, must make sure they exist on target
      Object.defineProperty(target, 'x', emulatedProps.x);
      var result = Object.getOwnPropertyDescriptor(brokenProxy, 'x');
      assert(result.value === 1 && result.configurable === false,
             'x was observed as non-configurable');
      assertThrows("property 'x' is non-configurable and can't be deleted",
        function() {
          success.x = true;
          delete brokenProxy.x;
        });
    };

  TESTS.testGOPNCannotListNewProperties =
    function(brokenProxy, emulatedProps, emulatedProto, success) {
      emulatedProps.x = {value:1, configurable:false};
      Object.preventExtensions(brokenProxy);
      emulatedProps.y = {value:2, configurable:true};
      assertThrows("ownKeys trap cannot list a new property "+
                   "'y' on a non-extensible object",
        function() {
          Object.getOwnPropertyNames(brokenProxy);
        });
    };

  TESTS.testNonConfigurableMustBeReportedByHasOwn =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      emulatedProps.x = {value:1, configurable:false};
      // to emulate non-configurable props, must make sure they exist on target
      Object.defineProperty(target, 'x', emulatedProps.x);
      var result = Object.getOwnPropertyDescriptor(brokenProxy, 'x');
      assert(result.value === 1 && result.configurable === false,
             'x was observed as non-configurable');
      delete emulatedProps.x;
      assertThrows("cannot report non-configurable property 'x'"+
                   " as non-existent",    
        function() {
          Object.prototype.hasOwnProperty.call(brokenProxy, 'x');
        });
    };

  TESTS.testNewPropertyCantBeReportedByHasOwn =
    function(brokenProxy, emulatedProps, emulatedProto, success) {
      emulatedProps.x = {value:1, configurable:false};
      Object.preventExtensions(brokenProxy);
      emulatedProps.y = {value:2, configurable:true};
      assertThrows("cannot report a new own property 'y' "+
                   "on a non-extensible object",
        function() {
          Object.prototype.hasOwnProperty.call(brokenProxy, 'y');
        });
    };

  TESTS.testNonConfigurableMustBeReportedByHas =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      emulatedProps.x = {value:1, configurable:false};
      // to emulate non-configurable props, must make sure they exist on target
      Object.defineProperty(target, 'x', emulatedProps.x);
      var result = Object.getOwnPropertyDescriptor(brokenProxy, 'x');
      assert(result.value === 1 && result.configurable === false,
             'x was observed as non-configurable');
      delete emulatedProps.x;
      assertThrows("cannot report existing non-configurable own property "+
                   "'x' as a non-existent property",
        function() {
          'x' in brokenProxy;
        });
    };

  TESTS.testNonConfigurableNonWritableHasStableValue =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      emulatedProps.x = {value:1, writable:false,configurable:false};
      // to emulate non-configurable props, must make sure they exist on target
      Object.defineProperty(target, 'x', emulatedProps.x);
      var result = Object.getOwnPropertyDescriptor(brokenProxy, 'x');
      assert(result.value === 1 && result.configurable === false,
             'x was observed as non-configurable');
      emulatedProps.x = {value:2, writable:false,configurable:false};
      assertThrows("cannot report inconsistent value for non-writable, "+
                   "non-configurable property 'x'",
        function() {
          brokenProxy.x;
        });
    };

  TESTS.testNonConfigurableNonWritableCantBeAssigned =
    function(brokenProxy, emulatedProps, emulatedProto, success, target) {
      emulatedProps.x = {value:1, writable:false,configurable:false};
      // to emulate non-configurable props, must make sure they exist on target
      Object.defineProperty(target, 'x', emulatedProps.x);
      var result = Object.getOwnPropertyDescriptor(brokenProxy, 'x');
      assert(result.value === 1 && result.configurable === false,
             'x was observed as non-configurable');
      assertThrows("cannot successfully assign to a non-writable, "+
                   "non-configurable property 'x'",
        function() {
          success.x = true;
          brokenProxy.x = 2;
        });
    };

  TESTS.testKeysCannotListNewProperties =
    function(brokenProxy, emulatedProps, emulatedProto, success) {
      emulatedProps.x = {value:1, enumerable:true, configurable:false};
      Object.preventExtensions(brokenProxy);
      emulatedProps.y = {value:2, enumerable:true, configurable:true};
      assertThrows("ownKeys trap cannot list a new property "+
                   "'y' on a non-extensible object",
        function() {
          Object.keys(brokenProxy);
        });
    };

  TESTS.testGOPNMustListNonConfigurableProperties =
    function(brokenProxy, emulatedProps, emulatedProto, success) {
      emulatedProps.x = {value:1, enumerable:true, configurable:false};
      emulatedProps.y = {value:2, enumerable:true, configurable:true};
      Object.preventExtensions(brokenProxy);
      delete emulatedProps.x;
      assertThrows("ownKeys trap failed to include "+
                   "non-configurable property 'x'",
        function() {
          Object.getOwnPropertyNames(brokenProxy);
        });
    };

  TESTS.testEnumerateMustListNonConfigurableEnumerableProperties =
    function(brokenProxy, emulatedProps, emulatedProto, success) {
      emulatedProps.x = {value:1, enumerable:true, configurable:false};
      emulatedProps.y = {value:2, enumerable:true, configurable:true};
      Object.preventExtensions(brokenProxy);
      delete emulatedProps.x;
      assertThrows("enumerate trap failed to include "+
                   "non-configurable enumerable property 'x'",
        function() {
          for (var name in Object.create(brokenProxy)) { }
        });
    };

  TESTS.testEnumerateMaySkipNonConfigurableNonEnumerableProperties =
    function(brokenProxy, emulatedProps, emulatedProto, success) {
      emulatedProps.x = {value:1, enumerable:false, configurable:false};
      emulatedProps.y = {value:2, enumerable:true, configurable:false};
      Object.preventExtensions(brokenProxy);
      delete emulatedProps.x;
      var res = [];
      for (var name in Object.create(brokenProxy)) { res.push(name); }
      assert(res.length === 1,
        "ok to drop non-configurable non-enumerable props in enumerate trap");
    };

  TESTS.testKeysMustListNonConfigurableEnumerableProperties =
    function(brokenProxy, emulatedProps, emulatedProto, success) {
      emulatedProps.x = {value:1, enumerable:true, configurable:false};
      emulatedProps.y = {value:2, enumerable:true, configurable:true};
      Object.preventExtensions(brokenProxy);
      delete emulatedProps.x;
      assertThrows("ownKeys trap failed to include "+
                   "non-configurable property 'x'",
        function() {
          Object.keys(brokenProxy);
        });
    };

  /**
   * Test that a proxy can keep on trapping even after
   * it has been frozen.
   */
  function testTrapEvenWhenFrozen() {
    var target = {};
    var forwarder = {};
    var proxy = Proxy(target, forwarder);
    assert(proxy.x === undefined, 'proxy.x === undefined');

    Object.defineProperty(proxy,'x',
      { value:1,
        configurable:false });
    assert(target.x === 1, 'target.x === 1');
    assert(proxy.x === 1, 'proxy.x === 1');

    assertThrows("can't redefine property 'x'",
      function() {
        Object.defineProperty(proxy,'x',{configurable:false,value:2});
      });

    assert(proxy.x === 1, "proxy.x === 1");

    forwarder.freeze = function(target) {
      Object.defineProperty(target, 'x',
        {value:1,
         configurable:false,
         writable:false,
         enumerable:false });
      Object.freeze(target);
      return true;
    }
    Object.freeze(proxy);
    assert(Object.isFrozen(proxy), "proxy is frozen");

    var wasIntercepted = false;
    forwarder.get = function(target, name, receiver) {
      wasIntercepted = true;
      return target[name];
    };

    assert(proxy.x === 1, "proxy.x === 1 after freeze");
    assert(wasIntercepted, "proxy.x was intercepted even after freeze");
  }

  /**
   * This function tests whether wrapping a regular object
   * with an empty handler forwards to the target, without
   * raising any unexpected TypeErrors.
   */
  function testForwarding() {
    var result;

    var proto = { inherited: 3 };
    var target = Object.create(proto);
    Object.defineProperty(target, 'wcdp', {
      // writable, configurable data property (wcdp)
      value: 1,
      writable: true,
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(target, 'nwncdp', {
      // non-writable, non-configurable data property (nwncdp)
      value: 2,
      writable: false,
      enumerable: false,
      configurable: false
    });

    var proxy = Proxy(target, {});

    result = Object.getOwnPropertyDescriptor(proxy, 'non-existent-prop');
    assert(result === undefined,
           'FWD: non-existent prop is undefined');

    result = Object.getOwnPropertyDescriptor(proxy, 'wcdp');
    assert(result !== undefined, 'FWD: wcdp is not undefined');
    assert(result.value === 1,
           'FWD: wcdp value is correct');
    result = Object.getOwnPropertyDescriptor(proxy, 'nwncdp');
    assert(result !== undefined, 'FWD: nwncdp is not undefined');
    assert(result.value === 2,
           'FWD: nwncdp value is correct');
    // now, the nwncdp value should be stored in the fixed props,
    // try accessing nwncdp again
    result = Object.getOwnPropertyDescriptor(proxy, 'nwncdp');
    assert(result !== undefined, 'FWD: nwncdp is still not undefined');
    assert(result.value === 2,
           'FWD: nwncdp value is still correct');

    result = Object.getOwnPropertyNames(proxy);
    assert(result.length === 2,
           'FWD: getOwnPropertyNames returned correct #names');

    // make a compatible change to wcdp by making it non-enumerable
    Object.defineProperty(proxy, 'wcdp',
      {value:1,writable:true,enumerable:false,configurable:true});
    result = Object.getOwnPropertyDescriptor(proxy, 'wcdp');
    assert(result.enumerable === false,
           'FWD: wcdp enumerable is correct');

    // define a new writable, non-configurable data property
    Object.defineProperty(proxy, 'wncdp',
      {value:3,
       writable:true,
       enumerable:true,
       configurable:false});
    result = Object.getOwnPropertyDescriptor(proxy, 'wncdp');
    assert(result.configurable === false,
           'FWD: wncdp configurable is correct');

    // delete wcdp
    result = delete proxy.wcdp;
    assert(result === true,
           'FWD: wcdp deleted');
    result = Object.getOwnPropertyDescriptor(proxy, 'wcdp');
    assert(result === undefined,
           'FWD: wcdp is non-existent');

    result = [];
    // enumerates wncdp, inherited
    for (var name in proxy) { result.push(name); }
    assert(result.length === 2,
           'FWD: enumerate returned correct #names');

    result = 'non-existent' in proxy;
    assert(result === false,
           'FWD: ! non-existent in proxy');
    result = 'nwncdp' in proxy;
    assert(result === true,
           'FWD: nwncdp in proxy');
    result = 'inherited' in proxy;
    assert(result === true,
           'FWD: inherited in proxy');

    result = ({}).hasOwnProperty.call(proxy, 'inherited');
    assert(result === false,
           'FWD: inherited is not an own property of proxy');
    result = ({}).hasOwnProperty.call(proxy, 'nwncdp');
    assert(result === true,
           'FWD: nwncdp is an own property of proxy');

    assert(proxy.nwncdp === 2,
           'FWD: proxy.nwncdp has correct value');
    try { proxy.nwncdp = 42; } catch(e) {} // may throw in strict-mode
    assert(proxy.nwncdp === 2,
           'FWD: proxy.nwncdp still has correct value');

    result = Object.keys(proxy); // wncdp
    assert(result.length === 1,
           'FWD: keys returned correct #names');
  }

  function testInheritance() {
    var child;
    var called = false;
    var proxy = Proxy({}, {
      has: function(tgt, name) {
        return name === 'foo';
      },
      get: function(tgt, name, rcvr) {
        assert(rcvr === child, 'get: receiver is child');
        return name;
      },
      set: function(tgt, name, val, rcvr) {
        assert(rcvr === child, 'set: receiver is child');
        called = true;
        return true;
      },
      enumerate: function(tgt) {
        return createArrayIterator(['baz']);
      }
    });
    child = Object.create(proxy);
    assert('foo' in child, 'invoking inherited has');
    assert(!('bar' in child), 'invoking inherited has on non-existent prop');
    assert(child['foo'] === 'foo', 'invoking inherited get');
    child['foo'] = 42;
    assert(called, 'inherited set actually invoked');
    var props = [];
    for (var p in child) { props.push(p); }
    assert(props.length === 1 && props[0] === 'baz', 'invoking inherited enumerate');
  }

  function testFunctions() {
    var fun = function(){};
    var proxy = Proxy(fun, {
      apply: function(tgt, thisBinding, args) {
        assert(tgt === fun, 'apply: target is correct');
        assert(thisBinding === undefined, 'apply: thisBinding is correct');
        assert(args.length === 3, 'apply: args is correct');
        return 'apply';
      },
      construct: function(tgt, args) {
        assert(tgt === fun, 'construct: target is correct');
        assert(args.length === 3, 'construct: args is correct');
        return {'construct': true};
      }
    });
    assert(proxy(1,2,3) === 'apply', 'calling apply');
    assert(new proxy(1,2,3).construct === true, 'calling construct');
  }

  function testSet() {
    var t = {};
    var p = Proxy(t, {
      defineProperty: function(tgt,name,desc) {
        assert(name === 'x', 'testSet defineProperty name === x');
        assert(desc.value === 1, 'testSet defineProperty value === 1');
        t.xWasSet = true;
        return true;
      }
    });
    // p has no "set" trap, so default behavior is to invoke:
    // Reflect.set(t, 'x', 1, p)
    // which will not find 'x', so will call Object.defineProperty(p,'x',{value:1,...})
    p.x = 1;
    assert(t.xWasSet, 'default set triggers defineProperty');
    var child = Object.create(p);
    child.y = 1; // should also trigger p's set trap, but Reflect.set will now
                 // define the property on the child
    assert(child.y === 1, 'default set on inherited object');
  }

  // test whether Date, Function, Array toString() work
  // transparently on proxies
  function testTransparentWrappers() {
    // dates
    (function(){
      var d = new Date();
      var dp = Proxy(d,{});
      var dpp = Proxy(dp,{});

      var str = Date.prototype.toString.call(d);
      assert(str === Date.prototype.toString.call(dp),
             'Date.prototype.toString on dp');
      assert(str === dp.toString(), 'dp.toString()');
      assert(str === Date.prototype.toString.call(dpp),
             'Date.prototype.toString on dpp');
    }());

    // functions
    (function(){
      var f = function() { return 42; };
      var fp = Proxy(f,{});
      var fpp = Proxy(fp,{});

      var str = Function.prototype.toString.call(f);
      assert(str === Function.prototype.toString.call(fp),
             'Function.prototype.toString on fp');
      assert(str === fp.toString(), 'fp.toString()');
      assert(str === Function.prototype.toString.call(fpp),
             'Function.prototype.toString on fpp');
    }());

    // arrays
    (function(){
      var a = [1,2,3];
      var ap = Proxy(a,{});
      var app = Proxy(ap,{});

      var str = Array.prototype.toString.call(a);
      assert(str === Array.prototype.toString.call(ap),
             'Array.prototype.toString on ap');
      assert(str === ap.toString(), 'ap.toString()');
      assert(str === Array.prototype.toString.call(app),
             'Array.prototype.toString on app');
    }());
  }

  function testRevocableProxies() {
    var target = {};
    var handler = { get: function() { return 1; }};
    var tuple = Proxy.revocable(target, handler);
    var p = tuple.proxy;
    assert(p.x === 1, 'unrevoked proxy get works');
    tuple.revoke();
    assertThrows('proxy is revoked', function() { p.x });
    assertThrows('proxy is revoked', function() { p.x = 1 });
    assertThrows('proxy is revoked', function() { Object.isExtensible(p) });
    assertThrows('proxy is revoked', function() { delete p.x });
    assert(typeof p === 'object', 'typeof still works on revoked proxy');
  }

  function testSetPrototypeOf() {
    try {
      Object.setPrototypeOf({}, {});
    } catch (e) {
      if (e.message === 'setPrototypeOf not supported on this platform') {
        return;
      } else {
        fail(e);
      }
    }

    var parent = {};
    var child = Object.create(parent);
    var newParent = {};
    assert(Object.getPrototypeOf(child) === parent, 'getPrototypeOf before');
    assert(Object.setPrototypeOf(child, newParent) === child, 'setPrototypeOf return');
    assert(Object.getPrototypeOf(child) === newParent, 'getPrototypeOf after');

    assertThrows("can't set prototype on non-extensible object: "+({}),
                 function() {
                   Object.setPrototypeOf(Object.preventExtensions({}), {});
                 });

    var p = Proxy({}, {
      setPrototypeOf: function(target, newProto) {
        assert(newProto === newParent, 'newProto === newParent');
        return Reflect.setPrototypeOf(target, newProto);
      }
    });
    Object.setPrototypeOf(p, newParent);
    assert(Object.getPrototypeOf(p) === newParent, 'getPrototypeOf proxy after');

    assertThrows("prototype value does not match: " + {},
      function() {
        var p = Proxy(Object.preventExtensions({}), {
          setPrototypeOf: function(target, newProto) {
            return true;
          }
        });
        Object.setPrototypeOf(p, newParent);
      });
  }

  function testSetPrototypeOfUndefined() {
    var obj = {};
    var shouldThrow;
    try {
      Object.setPrototypeOf(obj, undefined);
    } catch (ex) {
      shouldThrow = ex;
    }
    assert(shouldThrow, 'testSetPrototypeOfUndefined: cannot set to undefined');
  }

  function testUpdatePropertyDescriptor() {
    var obj = {};
    Object.defineProperty(obj, 'prop', {value: true, configurable: true});
    var proxy = Proxy(obj, {
      defineProperty: function(target, name, desc) {
        return Object.defineProperty(obj, name, desc);
      }
    });
    Object.defineProperty(proxy, 'prop', {value: function() { return false; }});
    var descriptor = Object.getOwnPropertyDescriptor(obj, 'prop');
    assert(typeof descriptor.value === 'function',
           'testUpdatePropertyDescriptor: prop updated');
  }

  // invoke experiment
  /*function testInvokeTrap() {
    // first test whether __noSuchMethod__ is supported

    var t = {
      foo: function(x) { return x; }
    };
    var p = new Proxy(t, {
      get: function(tgt, name, rcvr) {
        print('get ' + name);
        return undefined; //return Reflect.get(tgt, name, rcvr);
      },
      invoke: function(tgt, name, args, rcvr) {
        print('invoke ' + name);
        return Reflect.invoke(tgt, name, args, rcvr);
      }
    });

    print(p.foo(2));

  }*/

  if (typeof window === "undefined") {
    global.test();
  }
}(this));