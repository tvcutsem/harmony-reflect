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
 * The Original Code is Notification Proxies
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

 // This file is a polyfill for Notification Proxies
 // An idea expressed by E. Dean Tribble on the es-discuss mailing list:
 // <https://mail.mozilla.org/pipermail/es-discuss/2012-November/026587.html>
 // <https://mail.mozilla.org/pipermail/es-discuss/2012-November/026589.html>
 
 // This code was tested on tracemonkey / Firefox 12
 //  (and should run fine on older Firefox versions starting with FF4)
 // The code also works correctly on
 //   v8 --harmony (at least since v3.6.5.1)
 //   node --harmony (at least since v0.7.8)

 // Language Dependencies:
 //  - ECMAScript 5/strict
 //  - "old" (i.e. non-direct) Harmony Proxies
 //  - Harmony WeakMaps
 // Patches:
 //  - Object.{freeze,seal,preventExtensions}
 //  - Object.{isFrozen,isSealed,isExtensible}
 //  - Object.getPrototypeOf
 //  - Object.prototype.valueOf
 //  - Object.prototype.isPrototypeOf
 //  - Object.getOwnPropertyDescriptor
 //  - Function.prototype.toString
 //  - Proxy
 // Adds new globals:
 //  - Reflect

 // Notification proxies can be created via Proxy(target, handler)

 // ----------------------------------------------------------------------------

(function(global, nonstrictDelete){ // function-as-module pattern
"use strict";

// === Notification Proxies ===

// The basic idea:
// When an operation is intercepted by a proxy
// 1) invoke a pre-trap on the handler
// 2) forward the operation to the target
// 3) if the pre-trap returned a callable, call the callable as a post-trap
// 4) return the result of step 2)

// pre-trap generic signature:
// on{Operation}(target, ...args) -> undefined | callable

// post-trap generic signature
// function(target, result) -> void

// Notification Proxies Handler API:

// onGetOwnPropertyDescriptor: function(target,name)
// Object.getOwnPropertyDescriptor(proxy,name)
//   post-trap receives copy of the returned descriptor

// onGetOwnPropertyNames:      function(target)
// Object.getOwnPropertyNames(proxy) 
//   post-trap receives copy of the returned array

// OnGetPrototypeOf:           function(target)
// Object.getPrototypeOf(proxy)

// onDefineProperty:           function(target,name, desc)
// Object.defineProperty(proxy,name,desc)
//   pre-trap receives normalized copy of the argument descriptor

// onDeleteProperty:           function(target,name)                 
// delete proxy[name]

// onFreeze:                   function(target)                      
// Object.freeze(proxy)

// onSeal:                     function(target)                  
// Object.seal(proxy)

// onPreventExtensions:        function(target)                      
// Object.preventExtensions(proxy)

// onIsFrozen:                 function(target)                    
// Object.isFrozen(proxy)

// onIsSealed:                 function(target)                     
// Object.isSealed(proxy)

// onIsExtensible:             function(target)                      
// Object.isExtensible(proxy)

// onHas:                      function(target,name)                  
// name in proxy

// onHasOwn:                   function(target,name)                 
// ({}).hasOwnProperty.call(proxy,name)

// onGet:                      function(target,name,receiver)         
// receiver[name]

// onSet:                      function(target,name,val,receiver)   
// receiver[name] = val

// onEnumerate:                function(target)                 
// for (name in proxy)
// (iterator should yield all enumerable own and inherited properties)
//   post-trap receives a "copy of the iterator" (?)
//   (post-trap consuming the iterator should have no effect on the
//    iterator returned to clients)

// onKeys:                     function(target)      
// Object.keys(proxy)
// (return array of enumerable own properties only)
//   post-trap receives a copy of the result array

// onApply:                    function(target,thisArg,args)
// proxy(...args)

// onConstruct:                function(target,args)   
// new proxy(...args)

// ----------------------------------------------------------------------------

// ---- WeakMap polyfill ----

// TODO: find a proper WeakMap polyfill

// define an empty WeakMap so that at least the Reflect module code
// will work in the absence of WeakMaps. Proxy emulation depends on
// actual WeakMaps, so will not work with this little shim.
if (typeof WeakMap === "undefined") {
  global.WeakMap = function(){};
  global.WeakMap.prototype = {
    get: function(k) { return undefined; },
    set: function(k,v) { throw new Error("WeakMap not supported"); }
  };
}

// ---- Normalization functions for property descriptors ----

function isStandardAttribute(name) {
  return /^(get|set|value|writable|enumerable|configurable)$/.test(name);
}

// Adapted from ES5 section 8.10.5
function toPropertyDescriptor(obj) {
  if (Object(obj) !== obj) {
    throw new TypeError("property descriptor should be an Object, given: "+
                        obj);
  }
  var desc = {};
  if ('enumerable' in obj) { desc.enumerable = !!obj.enumerable; }
  if ('configurable' in obj) { desc.configurable = !!obj.configurable; }
  if ('value' in obj) { desc.value = obj.value; }
  if ('writable' in obj) { desc.writable = !!obj.writable; }
  if ('get' in obj) {
    var getter = obj.get;
    if (getter !== undefined && typeof getter !== "function") {
      throw new TypeError("property descriptor 'get' attribute must be "+
                          "callable or undefined, given: "+getter);
    }
    desc.get = getter;
  }
  if ('set' in obj) {
    var setter = obj.set;
    if (setter !== undefined && typeof setter !== "function") {
      throw new TypeError("property descriptor 'set' attribute must be "+
                          "callable or undefined, given: "+setter);
    }
    desc.set = setter;
  }
  if ('get' in desc || 'set' in desc) {
    if ('value' in desc || 'writable' in desc) {
      throw new TypeError("property descriptor cannot be both a data and an "+
                          "accessor descriptor: "+obj);
    }
  }
  return desc;
}

function isAccessorDescriptor(desc) {
  if (desc === undefined) return false;
  return ('get' in desc || 'set' in desc);
}
function isDataDescriptor(desc) {
  if (desc === undefined) return false;
  return ('value' in desc || 'writable' in desc);
}
function isGenericDescriptor(desc) {
  if (desc === undefined) return false;
  return !isAccessorDescriptor(desc) && !isDataDescriptor(desc);
}
function isEmptyDescriptor(desc) {
  return !('get' in desc) &&
         !('set' in desc) &&
         !('value' in desc) &&
         !('writable' in desc) &&
         !('enumerable' in desc) &&
         !('configurable' in desc);
}
function isEquivalentDescriptor(desc1, desc2) {
  return sameValue(desc1.get, desc2.get) &&
         sameValue(desc1.set, desc2.set) &&
         sameValue(desc1.value, desc2.value) &&
         sameValue(desc1.writable, desc2.writable) &&
         sameValue(desc1.enumerable, desc2.enumerable) &&
         sameValue(desc1.configurable, desc2.configurable);
}

// copied from http://wiki.ecmascript.org/doku.php?id=harmony:egal
function sameValue(x, y) {
  if (x === y) {
    // 0 === -0, but they are not identical
    return x !== 0 || 1 / x === 1 / y;
  }

  // NaN !== NaN, but they are identical.
  // NaNs are the only non-reflexive value, i.e., if x !== x,
  // then x is a NaN.
  // isNaN is broken: it converts its argument to number, so
  // isNaN("foo") => true
  return x !== x && y !== y;
}

/**
 * Returns a fresh property descriptor whose standard
 * attributes are guaranteed to be data properties of the right type.
 * Additionally, any non-standard enumerable properties of
 * attributes are copied over to the fresh descriptor.
 *
 * If attributes is undefined, will throw a TypeError.
 *
 * See also: http://wiki.ecmascript.org/doku.php?id=harmony:proxies_semantics
 */
function normalizePropertyDescriptor(attributes) {
  var desc = toPropertyDescriptor(attributes);
  // Note: no need to call FromGenericPropertyDescriptor(desc), as we represent
  // "internal" property descriptors as proper Objects from the start
  for (var name in attributes) {
    if (!isStandardAttribute(name)) {
      Object.defineProperty(desc, name,
        { value: attributes[name],
          writable: true,
          enumerable: true,
          configurable: true });
    }
  }
  return desc;
}

// store a reference to the real ES5 primitives before patching them later
var prim_preventExtensions =        Object.preventExtensions,
    prim_seal =                     Object.seal,
    prim_freeze =                   Object.freeze,
    prim_isExtensible =             Object.isExtensible,
    prim_isSealed =                 Object.isSealed,
    prim_isFrozen =                 Object.isFrozen,
    prim_getPrototypeOf =           Object.getPrototypeOf,
    prim_getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor,
    prim_defineProperty =           Object.defineProperty;

// these will point to the patched versions of the respective methods on
// Object. They are used within this module as the "intrinsic" bindings
// of these methods (i.e. the "original" bindings as defined in the spec)
var Object_isFrozen, Object_isSealed, Object_isExtensible, Object_getPrototypeOf;

// ---- The Notifier handler wrapper around user handlers ----

/**
 * @param target the object wrapped by this proxy.
 * As long as the proxy is extensible, only non-configurable properties
 * are checked against the target. Once the proxy becomes non-extensible,
 * invariants w.r.t. non-extensibility are also enforced.
 *
 * @param handler the handler of the direct proxy. Defines notification
 * traps that get invoked before applying the operation to the wrapped target.
 *
 * Both target and handler must be proper Objects at initialization time.
 */
function Notifier(target, handler) {
  // for non-revokable proxies, these are const references
  // for revokable proxies, on revocation:
  // - this.target is set to null
  // - this.handler is set to a handler that throws on all traps
  this.target  = target;
  this.handler = handler;
}

// used to convert e.g. "onGet" to "get" so we can call Reflect["get"]
// strip off "on", uncapitalize first letter
// e.g. onGet -> get, onKeys -> keys, etc.
function eventToCommand(eventName) {
  return eventName[2].toLowerCase() + eventName.slice(3);
}

/**
 * Invoke the trap named trapName on the given handler, for the given target.
 * The pre-trap is passed trapArgs, while the forwarded operation on target
 * is passed realArgs. The result of the operation, applied to the target,
 * is passed into protectResult, and the return value of this function is
 * passed into the post-trap.
 * The actual unprotected return value is returned to the caller.
 *
 * realArgs is optional and defaults to trapArgs.
 * protectResult is optional and defaults to the identity function.
 */
function trap(target, handler, onTrapName, trapArgs, realArgs, protectResult) {
  realArgs = realArgs || trapArgs;
  protectResult = protectResult || function(res) { return res; };

  var trapName = eventToCommand(onTrapName);
  
  var trap = handler[onTrapName];
  
  var tRealArgs = [target].concat(realArgs);
  
  if (trap === undefined) {
    return Reflect[trapName].apply(undefined, tRealArgs);
  }
  
  if (typeof trap !== "function") {
    throw new TypeError(trapName + " trap is not callable: "+trap);
  }
  
  var tTrapArgs = [target].concat(trapArgs);
  var postTrap = trap.apply(handler, tTrapArgs);
  
  var result = Reflect[trapName].apply(undefined, tRealArgs);
  
  if (postTrap !== undefined) {
    if (typeof postTrap !== "function") {
      throw new TypeError(trapName + " post-trap is not callable: "+postTrap);
    }
    tTrapArgs.push(protectResult(result)); // add result as last argument
    postTrap.apply(handler, tTrapArgs);
  }
  return result;
}

Notifier.prototype = {

  // === fundamental traps ===
  
  /**
   * The post-trap receives a copy of the returned descriptor
   */
  getOwnPropertyDescriptor: function(name) {
    var args = [String(name)];
    return trap(
         this.target,
         this.handler,
         "onGetOwnPropertyDescriptor",
         args,
         args,
         function (result) {
           if (result !== undefined) {
             // TODO: actually, returning a (shallow) copy is good enough,
             // the result is already normalized
             return normalizePropertyDescriptor(result);
             // TODO: freeze standard atributes, copy custom attributes?
           } else {
             return undefined;
           }
         });
  },
  
  /**
   * In the direct proxies design with refactored prototype climbing,
   * this trap is deprecated. For proxies-as-prototypes, instead
   * of calling this trap, the get, set, has or enumerate traps are
   * called instead.
   *
   * In this implementation, we "abuse" getPropertyDescriptor to
   * support trapping the get or set traps for proxies-as-prototypes.
   * We do this by returning a getter/setter pair that invokes
   * the corresponding traps.
   *
   * In Firefox, this trap is only called after a prior invocation
   * of the 'has' trap has returned true. Hence, expect the following
   * behavior:
   * <code>
   * var child = Object.create(Proxy(target, handler));
   * child[name] // triggers handler.has(target, name)
   * // if that returns true, triggers handler.get(target, name, child)
   * </code>
   */
  getPropertyDescriptor: function(name) {
    var handler = this;
    return {
      get: function() {
        return handler.get(this, name);
      },
      set: function(val) {
        if (handler.set(this, name, val)) {
          return val;
        } else {
          throw new TypeError("failed assignment to "+name);
        }
      },
      enumerable: true,
      configurable: true
    };
  },
  
  /**
   * The pre-trap receives a normalized copy of the actual descriptor.
   */
  defineProperty: function(name, desc) {
    var normalizedDesc = normalizePropertyDescriptor(desc);
    // TODO: a shallow copy is enough
    var copy = normalizePropertyDescriptor(normalizedDesc);
    // TODO: freeze standard atributes, copy custom attributes?
    
    return trap(
      this.target,
      this.handler,
      "onDefineProperty",
      [String(name), copy],
      [String(name), normalizedDesc]);
  },
  
  /**
   * 
   */
  freeze: function() {
    return trap(
      this.target,
      this.handler,
      "onFreeze",
      []);
  },
  
  /**
   * 
   */
  seal: function() {
    return trap(
      this.target,
      this.handler,
      "onSeal",
      []);
  },
  
  /**
   * 
   */
  preventExtensions: function() {
    return trap(
      this.target,
      this.handler,
      "onPreventExtensions",
      []);
  },
  
  /**
   * 
   */
  delete: function(name) { 
    return trap(
      this.target,
      this.handler,
      "onDeleteProperty",
      [String(name)]);
  },
  
  /**
   * The post-trap receives a copy of the returned array.
   */
  getOwnPropertyNames: function() {
    return trap(
      this.target,
      this.handler,
      "onGetOwnPropertyNames",
      [],
      [],
      function(result) {
        return Object.freeze(Array.prototype.slice.call(result));
      });
  },
  
  /**
   * 
   */
  isExtensible: function() {
    return trap(
      this.target,
      this.handler,
      "onIsExtensible",
      []);
  },
  
  /**
   * 
   */
  getPrototypeOf: function() {
    return trap(
      this.target,
      this.handler,
      "onGetPrototypeOf",
      []);
  },
  
  /**
   * In the direct proxies design with refactored prototype climbing,
   * this trap is deprecated. For proxies-as-prototypes, for-in will
   * call the enumerate() trap. If that trap is not defined, the
   * operation is forwarded to the target, no more fallback on this
   * fundamental trap.
   */
  getPropertyNames: function() {
    throw new TypeError("getPropertyNames trap is deprecated");
  },
  
  // === derived traps ===
  
  /**
   * 
   */
  hasOwn: function(name) {
    return trap(
      this.target,
      this.handler,
      "onHasOwn",
      [String(name)]);
  },
  
  /**
   * 
   */
  has: function(name) {    
    return trap(
      this.target,
      this.handler,
      "onHas",
      [String(name)]);
  },
  
  /**
   * 
   */
  get: function(receiver, name) {
    return trap(
      this.target,
      this.handler,
      "onGet",
      [String(name), receiver]);
  },
  
  /**
   * 
   */
  set: function(receiver, name, val) {
    return trap(
      this.target,
      this.handler,
      "onSet",
      [String(name), val, receiver]);
  },
  
  /**
   * TODO(tvcutsem) trap return value should change from [string] to iterator.
   */
  enumerate: function() {
    return trap(
      this.target,
      this.handler,
      "onEnumerate",
      []);
  },
  
  /**
   * The post-trap receives a copy of the iterator.
   *
   * TODO(tvcutsem) this trap is deprecated in favor of an @iterator
   * public symbol.
   */
  iterate: function() {
    return trap(
      this.target,
      this.handler,
      "onIterate",
      []);
  },
  
  /**
   * The post-trap receives a copy of the result array.
   */
  keys: function() {
    return trap(
      this.target,
      this.handler,
      "onKeys",
      [],
      [],
      function(result) {
        return Object.freeze(Array.prototype.slice.call(result));
      });
  },
  
  /**
   * New trap that reifies [[Call]].
   * If the target is a function, then a call to
   *   proxy(...args)
   * Triggers this trap
   */
  apply: function(thisBinding, args) {
    return trap(
      this.target,
      this.handler,
      "onApply",
      [thisBinding, args]);
  },
  
  /**
   * New trap that reifies [[Construct]].
   * If the target is a function, then a call to
   *   new proxy(...args)
   * Triggers this trap
   */
  construct: function(args) {
    return trap(
      this.target,
      this.handler,
      "onConstruct",
      [args]);
  },
  
  /**
   * 
   */
  isSealed: function() {
    return trap(
      this.target,
      this.handler,
      "onIsSealed",
      []);
  },
  
  /**
   * Checks whether the trap result is consistent with the state of the
   * wrapped target.
   */
  isFrozen: function() {
    return trap(
      this.target,
      this.handler,
      "onIsFrozen",
      []);
  }
};

// ---- end of the Notifier handler wrapper handler ----

// In what follows, a 'notification proxy' is a proxy
// whose handler is a Notifier. Such proxies can be made non-extensible,
// sealed or frozen without losing the ability to trap.

// maps direct proxies to their Notifier handlers
var directProxies = new WeakMap();

// patch Object.{preventExtensions,seal,freeze} so that
// they recognize fixable proxies and act accordingly
Object.preventExtensions = function(subject) {
  var vhandler = directProxies.get(subject);
  if (vhandler !== undefined) {
    if (vhandler.preventExtensions()) {
      return subject;
    } else {
      throw new TypeError("preventExtensions on "+subject+" rejected");
    }
  } else {
    return prim_preventExtensions(subject);
  }
};
Object.seal = function(subject) {
  var vHandler = directProxies.get(subject);
  if (vHandler !== undefined) {
    if (vHandler.seal()) {
      return subject;
    } else {
      throw new TypeError("seal on "+subject+" rejected");
    }
  } else {
    return prim_seal(subject);
  }
};
Object.freeze = function(subject) {
  var vHandler = directProxies.get(subject);
  if (vHandler !== undefined) {
    if (vHandler.freeze()) {
      return subject;
    } else {
      throw new TypeError("freeze on "+subject+" rejected");
    }
  } else {
    return prim_freeze(subject);
  }
};
Object.isExtensible = Object_isExtensible = function(subject) {
  var vHandler = directProxies.get(subject);
  if (vHandler !== undefined) {
    return vHandler.isExtensible();
  } else {
    return prim_isExtensible(subject);
  }
};
Object.isSealed = Object_isSealed = function(subject) {
  var vHandler = directProxies.get(subject);
  if (vHandler !== undefined) {
    return vHandler.isSealed();
  } else {
    return prim_isSealed(subject);
  }
};
Object.isFrozen = Object_isFrozen = function(subject) {
  var vHandler = directProxies.get(subject);
  if (vHandler !== undefined) {
    return vHandler.isFrozen();
  } else {
    return prim_isFrozen(subject);
  }
};
Object.getPrototypeOf = Object_getPrototypeOf = function(subject) {
  var vHandler = directProxies.get(subject);
  if (vHandler !== undefined) {
    return vHandler.getPrototypeOf();
  } else {
    return prim_getPrototypeOf(subject);
  }
};

// patch Object.getOwnPropertyDescriptor to directly call
// the Notifier.prototype.getOwnPropertyDescriptor trap
// This is to circumvent an assertion in the built-in Proxy
// trapping mechanism of v8, which disallows that trap to
// return non-configurable property descriptors (as per the
// old Proxy design)
Object.getOwnPropertyDescriptor = function(subject, name) {
  var vhandler = directProxies.get(subject);
  if (vhandler !== undefined) {
    return vhandler.getOwnPropertyDescriptor(name);
  } else {
    return prim_getOwnPropertyDescriptor(subject, name);
  }
};

// patch Object.defineProperty to directly call
// the Notifier.prototype.defineProperty trap
// This is to circumvent two issues with the built-in
// trap mechanism:
// 1) the current tracemonkey implementation of proxies
// auto-completes 'desc', which is not correct. 'desc' should be
// normalized, but not completed. Consider:
// Object.defineProperty(proxy, 'foo', {enumerable:false})
// This trap will receive desc =
//  {value:undefined,writable:false,enumerable:false,configurable:false}
// This will also set all other attributes to their default value,
// which is unexpected and different from [[DefineOwnProperty]].
// Bug filed: https://bugzilla.mozilla.org/show_bug.cgi?id=601329
// 2) the current spidermonkey implementation does not
// throw an exception when this trap returns 'false', but instead silently
// ignores the operation (this is regardless of strict-mode)
// 2a) v8 does throw an exception for this case, but includes the rather
//     unhelpful error message:
// 'Proxy handler #<Object> returned false from 'defineProperty' trap'
Object.defineProperty = function(subject, name, desc) {
  var vhandler = directProxies.get(subject);
  if (vhandler !== undefined) {
    var normalizedDesc = normalizePropertyDescriptor(desc);
    var success = vhandler.defineProperty(name, normalizedDesc);
    if (success === false) {
      throw new TypeError("can't redefine property '"+name+"'");
    }
    return success;
  } else {
    return prim_defineProperty(subject, name, desc);
  }
};

// returns a new function of zero arguments that recursively
// unwraps any proxies specified as the |this|-value.
// The primitive is assumed to be a zero-argument method
// that uses its |this|-binding.
function makeUnwrapping0ArgMethod(primitive) {
  return function builtin() {
    var vHandler = directProxies.get(this);
    if (vHandler !== undefined) {
      return builtin.call(vHandler.target);
    } else {
      return primitive.call(this);
    } 
  }
};

// returns a new function of 1 arguments that recursively
// unwraps any proxies specified as the |this|-value.
// The primitive is assumed to be a 1-argument method
// that uses its |this|-binding.
function makeUnwrapping1ArgMethod(primitive) {
  return function builtin(arg) {
    var vHandler = directProxies.get(this);
    if (vHandler !== undefined) {
      return builtin.call(vHandler.target, arg);
    } else {
      return primitive.call(this, arg);
    } 
  }
};

Object.prototype.valueOf =
  makeUnwrapping0ArgMethod(Object.prototype.valueOf);
Object.prototype.isPrototypeOf =
  makeUnwrapping1ArgMethod(Object.prototype.isPrototypeOf);
Function.prototype.toString =
  makeUnwrapping0ArgMethod(Function.prototype.toString);
Date.prototype.toString =
  makeUnwrapping0ArgMethod(Date.prototype.toString);

// ============= Reflection module =============
// see http://wiki.ecmascript.org/doku.php?id=harmony:reflect_api

var Reflect = global.Reflect = {
  getOwnPropertyDescriptor: function(target, name) {
    return Object.getOwnPropertyDescriptor(target, name);
  },
  getOwnPropertyNames: function(target) {
    return Object.getOwnPropertyNames(target);
  },
  defineProperty: function(target, name, desc) {
    
    // if target is a proxy, invoke its "defineProperty" trap
    var handler = directProxies.get(target);
    if (handler !== undefined) {
      return handler.defineProperty(target, name, desc);
    }
    
    // Implementation transliterated from [[DefineOwnProperty]]
    // see ES5.1 section 8.12.9
    var current = Object.getOwnPropertyDescriptor(target, name);
    var extensible = Object.isExtensible(target);
    if (current === undefined && extensible === false) {
      return false;
    }
    if (current === undefined && extensible === true) {
      Object.defineProperty(target, name, desc); // should never fail
      return true;
    }
    if (isEmptyDescriptor(desc)) {
      return true;
    }
    if (isEquivalentDescriptor(current, desc)) {
      return true;
    }
    if (current.configurable === false) {
      if (desc.configurable === true) {
        return false;
      }
      if ('enumerable' in desc && desc.enumerable !== current.enumerable) {
        return false;
      }
    }
    if (isGenericDescriptor(desc)) {
      // no further validation necessary
    } else if (isDataDescriptor(current) !== isDataDescriptor(desc)) {
      if (current.configurable === false) {
        return false;
      }
    } else if (isDataDescriptor(current) && isDataDescriptor(desc)) {
      if (current.configurable === false) {
        if (current.writable === false && desc.writable === true) {
          return false;
        }
        if (current.writable === false) {
          if ('value' in desc && !sameValue(desc.value, current.value)) {
            return false;
          }
        }
      }
    } else if (isAccessorDescriptor(current) && isAccessorDescriptor(desc)) {
      if (current.configurable === false) {
        if ('set' in desc && !sameValue(desc.set, current.set)) {
          return false;
        }
        if ('get' in desc && !sameValue(desc.get, current.get)) {
          return false;
        }
      }
    }
    Object.defineProperty(target, name, desc); // should never fail
    return true;
  },
  deleteProperty: function(target, name) {
    return nonstrictDelete(target, name);
  },
  getPrototypeOf: function(target) {
    return Object.getPrototypeOf(target);
  },
  freeze: function(target) {
    Object.freeze(target);
    return true;
  },
  seal: function(target) {
    Object.seal(target);
    return true;
  },
  preventExtensions: function(target) {
    Object.preventExtensions(target);
    return true;
  },
  isExtensible: function(target) {
    return Object.isExtensible(target);
  },
  isSealed: function(target) {
    return Object.isSealed(target);
  },
  isFrozen: function(target) {
    return Object.isFrozen(target);
  },
  has: function(target, name) {
    return name in target;
  },
  hasOwn: function(target, name) {
    return ({}).hasOwnProperty.call(target, name);
  },
  get: function(target, name, receiver) {
    receiver = receiver || target;
    
    // if target is a proxy, invoke its "get" trap
    var handler = directProxies.get(target);
    if (handler !== undefined) {
      return handler.get(receiver, name);
    }
    
    var desc = Object.getOwnPropertyDescriptor(target, name);
    if (desc === undefined) {
      var proto = Object.getPrototypeOf(target);
      if (proto === null) {
        return undefined;
      }
      return Reflect.get(proto, name, receiver);
    }
    if (isDataDescriptor(desc)) {
      return desc.value;
    }
    var getter = desc.get;
    if (getter === undefined) {
      return undefined;
    }
    return desc.get.call(receiver);
  },
  // Reflect.set implementation based on latest version of [[SetP]] at
  // http://wiki.ecmascript.org/doku.php?id=harmony:proto_climbing_refactoring
  set: function(target, name, value, receiver) {
    receiver = receiver || target;
    
    // if target is a proxy, invoke its "set" trap
    var handler = directProxies.get(target);
    if (handler !== undefined) {
      return handler.set(receiver, name, value);
    }
    
    // first, check whether target has a non-writable property
    // shadowing name on receiver
    var ownDesc = Object.getOwnPropertyDescriptor(target, name);
    if (ownDesc !== undefined) {
      if (isAccessorDescriptor(ownDesc)) {
        var setter = ownDesc.set;
        if (setter === undefined) return false;
        setter.call(receiver, value); // assumes Function.prototype.call
        return true;
      }
      // otherwise, isDataDescriptor(ownDesc) must be true
      if (ownDesc.writable === false) return false;
      // we found an existing writable data property on the prototype chain.
      // Now update or add the data property on the receiver, depending on
      // whether the receiver already defines the property or not.
      var existingDesc = Object.getOwnPropertyDescriptor(receiver, name);
      if (existingDesc !== undefined) {
        var updateDesc =
          { value: value,
            // FIXME: it should not be necessary to describe the following
            // attributes. Added to circumvent a bug in tracemonkey:
            // https://bugzilla.mozilla.org/show_bug.cgi?id=601329
            writable:     existingDesc.writable,
            enumerable:   existingDesc.enumerable,
            configurable: existingDesc.configurable };
        Object.defineProperty(receiver, name, updateDesc);
        return true;
      } else {
        if (!Object.isExtensible(receiver)) return false;
        var newDesc =
          { value: value,
            writable: true,
            enumerable: true,
            configurable: true };
        Object.defineProperty(receiver, name, newDesc);
        return true;
      }
    }

    // name is not defined in target, search target's prototype
    var proto = Object.getPrototypeOf(target);
    if (proto === null) {
      // target was the last prototype, now we know that 'name' is not shadowed
      // by an existing (accessor or data) property, so we can add the property
      // to the initial receiver object
      if (!Object.isExtensible(receiver)) return false;
      var newDesc =
        { value: value,
          writable: true,
          enumerable: true,
          configurable: true };
      Object.defineProperty(receiver, name, newDesc);
      return true;
    }
    // continue the search in target's prototype
    return Reflect.set(proto, name, value, receiver);
  },
  enumerate: function(target) {
    var result = [];
    for (var name in target) { result.push(name); };
    return result;
  },
  iterate: function(target) {
    // in ES-next: for (var name of target) { ... }
    var handler = directProxies.get(target);
    if (handler !== undefined) {
      return handler.iterate(handler.target);
    }
    
    // non-standard iterator support, used today
    if ('__iterator__' in target) return target.__iterator__;
    
    var result = Reflect.enumerate(target);
    var l = +result.length;
    var idx = 0;
    return {
      next: function() {
        if (idx === l) throw StopIteration;
        return result[idx++];
      }
    };
  },
  keys: function(target) {
    return Object.keys(target);
  },
  apply: function(target, receiver, args) {
    // target.apply(receiver, args)
    return Function.prototype.apply.call(target, receiver, args);
  },
  construct: function(target, args) {
    // return new target(...args);

    // if target is a proxy, invoke its "construct" trap
    var handler = directProxies.get(target);
    if (handler !== undefined) {
      return handler.construct(args);
    }
    
    var proto = target.prototype;
    var instance = (Object(proto) === proto) ? Object.create(proto) : {};
    var result = Function.prototype.apply.call(target, instance, args);
    return Object(result) === result ? result : instance;
  }
};

var revokedHandler = Proxy.create({
  get: function() { throw new TypeError("proxy is revoked"); }
});

// feature-test whether the Proxy global exists
if (typeof Proxy !== "undefined") {

  // if Proxy is a function, direct proxies are already supported
  if (typeof Proxy !== "function") {

    var primCreate = Proxy.create,
        primCreateFunction = Proxy.createFunction;

    Reflect.Proxy = function(target, handler) {
      // check that target is an Object
      if (Object(target) !== target) {
        throw new TypeError("Proxy target must be an Object, given "+target);
      }
      // check that handler is an Object
      if (Object(handler) !== handler) {
        throw new TypeError("Proxy handler must be an Object, given "+handler);
      }

      var vHandler = new Notifier(target, handler);
      var proxy;
      if (typeof target === "function") {
        proxy = primCreateFunction(vHandler,
          // call trap
          function() {
            var args = Array.prototype.slice.call(arguments);
            return vHandler.apply(this, args);
          },
          // construct trap
          function() {
            var args = Array.prototype.slice.call(arguments);
            return vHandler.construct(args);
          });
      } else {
        proxy = primCreate(vHandler, Object.getPrototypeOf(target));
      }
      directProxies.set(proxy, vHandler);
      return proxy;
    };
    
    Reflect.Proxy.revocable = function(target, handler) {
      var proxy = Reflect.Proxy(target, handler);
      var revoke = function() {
        var vHandler = directProxies.get(proxy);
        if (vHandler !== null) {
          vHandler.target  = null;
          vHandler.handler = revokedHandler;
        }
        return undefined;
      };
      return {proxy: proxy, revoke: revoke};
    }

  } else {
    // Proxy is already a function, so presumably direct proxies
    // are supported natively
    Reflect.Proxy = Proxy;
  }
} else {
  // Proxy global not defined, so proxies are not supported
  
  Reflect.Proxy = function(_target, _handler) {
    throw new Error("proxies not supported on this platform");
  }
  

}

// override the old global Proxy object
// with the new Proxy object exported by this library
global.Proxy = Reflect.Proxy;

// to support iteration protocol in non-spidermonkey environments:
if (typeof StopIteration === "undefined") {
  global.StopIteration = {};
}

// for node.js modules, export every property in the Reflect object
// as part of the module interface
if (typeof exports !== 'undefined') {
  Object.keys(Reflect).forEach(function (key) {
    exports[key] = Reflect[key];
  });
}

}(typeof exports !== 'undefined' ? global : this, function(target, name) {
  // non-strict delete, will never throw
  return delete target[name];
})); // function-as-module pattern