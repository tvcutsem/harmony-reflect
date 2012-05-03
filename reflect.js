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
 * The Original Code is a shim for the ES-Harmony reflection module
 *
 * The Initial Developer of the Original Code is
 * Tom Van Cutsem, Vrije Universiteit Brussel.
 * Portions created by the Initial Developer are Copyright (C) 2011-2012
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 */

 // ----------------------------------------------------------------------------

 // This file is a polyfill for the upcoming ECMAScript Reflect API,
 // including support for Proxies. See the draft specification at:
 // http://wiki.ecmascript.org/doku.php?id=harmony:reflect_api
 // http://wiki.ecmascript.org/doku.php?id=harmony:direct_proxies
 // http://wiki.ecmascript.org/doku.php?id=harmony:virtual_object_api
 
 // It supersedes the earlier polyfill at:
 // code.google.com/p/es-lab/source/browse/trunk/src/proxies/DirectProxies.js

 // This code was tested on tracemonkey / Firefox 7 / Firefox 12
 // The code also loads correctly on
 //   v8 --harmony_proxies --harmony_weakmaps (v3.6.5.1)
 // but does not work entirely as intended, since v8 proxies, as specified,
 // don't allow proxy handlers to return non-configurable property descriptors

 // Language Dependencies:
 //  - ECMAScript 5/strict
 //  - "old" (i.e. non-direct) Harmony Proxies with non-standard support
 //    for passing through non-configurable properties
 //  - Harmony WeakMaps
 // Patches:
 //  - Object.{freeze,seal,preventExtensions}
 //  - Object.{isFrozen,isSealed,isExtensible}
 //  - Object.getPrototypeOf
 //  - Object.prototype.valueOf
 // Adds new globals:
 //  - Reflect

 // Direct proxies can be created via Reflect.Proxy(target, handler)

 // ----------------------------------------------------------------------------

(function(global, nonstrictDelete){ // function-as-module pattern
"use strict";

// === Direct Proxies: Invariant Enforcement ===

// Direct proxies build on non-direct proxies by automatically wrapping
// all user-defined proxy handlers in a Validator handler that checks and
// enforces ES5 invariants.

// A direct proxy is a proxy for an existing object called the target object.

// A Validator handler is a wrapper for a target proxy handler H.
// The Validator forwards all operations to H, but additionally
// performs a number of integrity checks on the results of some traps,
// to make sure H does not violate the ES5 invariants w.r.t. non-configurable
// properties and non-extensible, sealed or frozen objects.

// For each property that H exposes as own, non-configurable
// (e.g. by returning a descriptor from a call to getOwnPropertyDescriptor)
// the Validator handler defines those properties on the target object.
// When the proxy becomes non-extensible, also configurable own properties
// are checked against the target.
// We will call properties that are defined on the target object
// "fixed properties".

// We will name fixed non-configurable properties "sealed properties".
// We will name fixed non-configurable non-writable properties "frozen
// properties".

// The Validator handler upholds the following invariants w.r.t. non-configurability:
// - getOwnPropertyDescriptor cannot report sealed properties as non-existent
// - getOwnPropertyDescriptor cannot report incompatible changes to the
//   attributes of a sealed property (e.g. reporting a non-configurable
//   property as configurable, or reporting a non-configurable, non-writable
//   property as writable)
// - getPropertyDescriptor cannot report sealed properties as non-existent
// - getPropertyDescriptor cannot report incompatible changes to the
//   attributes of a sealed property. It _can_ report incompatible changes
//   to the attributes of non-own, inherited properties.
// - defineProperty cannot make incompatible changes to the attributes of
//   sealed properties
// - deleteProperty cannot report a successful deletion of a sealed property
// - hasOwn cannot report a sealed property as non-existent
// - has cannot report a sealed property as non-existent
// - get cannot report inconsistent values for frozen data
//   properties, and must report undefined for sealed accessors with an
//   undefined getter
// - set cannot report a successful assignment for frozen data
//   properties or sealed accessors with an undefined setter.
// - get{Own}PropertyNames lists all sealed properties of the target.
// - keys lists all enumerable sealed properties of the target.
// - enumerate lists all enumerable sealed properties of the target.
// - if a property of a non-extensible proxy is reported as non-existent,
//   then it must forever be reported as non-existent. This applies to
//   own and inherited properties and is enforced in the
//   deleteProperty, get{Own}PropertyDescriptor, has{Own},
//   get{Own}PropertyNames, keys and enumerate traps

// Violation of any of these invariants by H will result in TypeError being
// thrown.

// Additionally, once Object.preventExtensions, Object.seal or Object.freeze
// is invoked on the proxy, the set of own property names for the proxy is
// fixed. Any property name that is not fixed is called a 'new' property.

// The Validator upholds the following invariants regarding extensibility:
// - getOwnPropertyDescriptor cannot report new properties as existent
//   (it must report them as non-existent by returning undefined)
// - defineProperty cannot successfully add a new property (it must reject)
// - getOwnPropertyNames cannot list new properties
// - hasOwn cannot report true for new properties (it must report false)
// - keys cannot list new properties

// Invariants currently not enforced:
// - getOwnPropertyNames lists only own property names
// - keys lists only enumerable own property names
// Both traps may list more property names than are actually defined on the
// target.

// Invariants with regard to inheritance are currently not enforced.
// - a non-configurable potentially inherited property on a proxy with
//   non-mutable ancestry cannot be reported as non-existent
// (An object with non-mutable ancestry is a non-extensible object whose
// [[Prototype]] is either null or an object with non-mutable ancestry.)

// Changes in Handler API compared to previous harmony:proxies, see:
// http://wiki.ecmascript.org/doku.php?id=strawman:direct_proxies
// http://wiki.ecmascript.org/doku.php?id=harmony:direct_proxies

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

function toCompletePropertyDescriptor(desc) {
  var internalDesc = toPropertyDescriptor(desc);
  if (isGenericDescriptor(internalDesc) || isDataDescriptor(internalDesc)) {
    if (!('value' in internalDesc)) { internalDesc.value = undefined; }
    if (!('writable' in internalDesc)) { internalDesc.writable = false; }
  } else {
    if (!('get' in internalDesc)) { internalDesc.get = undefined; }
    if (!('set' in internalDesc)) { internalDesc.set = undefined; }
  }
  if (!('enumerable' in internalDesc)) { internalDesc.enumerable = false; }
  if (!('configurable' in internalDesc)) { internalDesc.configurable = false; }
  return internalDesc;
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
 * Returns a fresh property descriptor that is guaranteed
 * to be complete (i.e. contain all the standard attributes).
 * Additionally, any non-standard enumerable properties of
 * attributes are copied over to the fresh descriptor.
 *
 * If attributes is undefined, returns undefined.
 *
 * See also: http://wiki.ecmascript.org/doku.php?id=harmony:proxies_semantics
 */
function normalizeAndCompletePropertyDescriptor(attributes) {
  if (attributes === undefined) { return undefined; }
  var desc = toCompletePropertyDescriptor(attributes);
  // Note: no need to call FromPropertyDescriptor(desc), as we represent
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
var prim_preventExtensions = Object.preventExtensions,
    prim_seal = Object.seal,
    prim_freeze = Object.freeze,
    prim_isExtensible = Object.isExtensible,
    prim_isSealed = Object.isSealed,
    prim_isFrozen = Object.isFrozen,
    prim_getPrototypeOf = Object.getPrototypeOf,
    prim_valueOf = Object.prototype.valueOf;

/**
 * A property 'name' is fixed if it is an own property of the target.
 */
function isFixed(name, target) {
  return ({}).hasOwnProperty.call(target, name);
}
function isSealed(name, target) {
  var desc = Object.getOwnPropertyDescriptor(target, name);
  if (desc === undefined) { return false; }
  return !desc.configurable;
}

/**
 * Performs all validation that Object.defineProperty performs,
 * without actually defining the property. Returns a boolean
 * indicating whether validation succeeded.
 *
 * Implementation transliterated from ES5.1 section 8.12.9
 */
function validateProperty(target, name, desc) {
  var current = Object.getOwnPropertyDescriptor(target, name);
  var extensible = Object.isExtensible(target);
  if (current === undefined && extensible === false) {
    return false;
  }
  if (current === undefined && extensible === true) {
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
    return true;
  }
  if (isDataDescriptor(current) !== isDataDescriptor(desc)) {
    if (current.configurable === false) {
      return false;
    }
    return true;
  }
  if (isDataDescriptor(current) && isDataDescriptor(desc)) {
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
    return true;
  }
  if (isAccessorDescriptor(current) && isAccessorDescriptor(desc)) {
    if (current.configurable === false) {
      if ('set' in desc && !sameValue(desc.set, current.set)) {
        return false;
      }
      if ('get' in desc && !sameValue(desc.get, current.get)) {
        return false;
      }
    }
  }
  return true;
}

// ---- The Validator handler wrapper around user handlers ----

/**
 * @param target the object wrapped by this proxy.
 * As long as the proxy is extensible, only non-configurable properties
 * are checked against the target. Once the proxy becomes non-extensible,
 * invariants w.r.t. non-extensibility are also enforced.
 *
 * @param handler the handler of the direct proxy. The object emulated by
 * this handler is validated against the target object of the direct proxy.
 * Any violations that the handler makes against the invariants
 * of the target will cause a TypeError to be thrown.
 *
 * Both target and handler must be proper Objects at initialization time.
 */
function Validator(target, handler) {
  // this is a const reference, this.target should never change
  this.target = target;
  // this is a const reference, this.handler should never change
  this.handler = handler;
}

Validator.prototype = {

  /**
   * If getTrap returns undefined, the caller should perform the
   * default forwarding behavior.
   * If getTrap returns normally otherwise, the return value
   * will be a callable trap function whose |this| binding is
   * pre-bound to this.handler (for convenience in the rest of the code)
   */
  getTrap: function(trapName) {    
    var trap = this.handler[trapName];
    if (trap === undefined) {
      // the trap was not defined,
      // perform the default forwarding behavior
      return undefined;
    }
    
    if (typeof trap !== "function") {
      throw new TypeError(trapName + " trap is not callable: "+trap);
    }
    
    // bind the trap's |this| to this.handler, for convenience
    return Function.prototype.bind.call(trap, this.handler);
  },
  
  // === fundamental traps ===
  
  /**
   * If name denotes a fixed property, check:
   *   - whether targetHandler reports it as existent
   *   - whether the returned descriptor is compatible with the fixed property
   * If the proxy is non-extensible, check:
   *   - whether name is not a new property
   * Additionally, the returned descriptor is normalized and completed.
   */
  getOwnPropertyDescriptor: function(name) {
    "use strict";
    
    var trap = this.getTrap("getOwnPropertyDescriptor");
    if (trap === undefined) {
      return Reflect.getOwnPropertyDescriptor(this.target, name);
    }
    
    name = String(name);
    var desc = trap(this.target, name);
    desc = normalizeAndCompletePropertyDescriptor(desc);
    if (desc === undefined) {      
      if (isSealed(name, this.target)) {
        throw new TypeError("cannot report non-configurable property '"+name+
                            "' as non-existent");        
      }
      if (!Object.isExtensible(this.target) &&
          isFixed(name, this.target)) {
          // if handler is allowed to return undefined, we cannot guarantee
          // that it will not return a descriptor for this property later.
          // Once a property has been reported as non-existent on a non-extensible
          // object, it should forever be reported as non-existent
          throw new TypeError("cannot report existing own property '"+name+
                              "' as non-existent on a non-extensible object");
      }
      return undefined;
    }
    
    // at this point, we know (desc !== undefined), i.e.
    // targetHandler reports 'name' as an existing property
    
    // Note: we could collapse the following two if-tests into a single
    // test. Separating out the cases to improve error reporting.
    
    if (!Object.isExtensible(this.target)) {
      if (!isFixed(name, this.target)) {
        throw new TypeError("cannot report a new own property '"+
                            name + "' on a non-extensible object");        
      }
    }

    if (isFixed(name, this.target)) {
      if (!validateProperty(this.target, name, desc)) {
        throw new TypeError("cannot report incompatible property descriptor "+
                            "for property '"+name+"'");
      }
    }
    
    if (!desc.configurable && !isFixed(name, this.target)) {
      // if the property is non-existent on the target, but is reported
      // as a non-configurable property, it may later be reported as
      // non-existent, which violates the invariant that if the property
      // might disappear, the configurable attribute must be true.
      throw new TypeError("cannot report a non-configurable descriptor "+
                          "for non-existent property '"+name+"'");
    }
    
    return desc;
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
      get: function() { return handler.get(this, name); },
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
   * If name denotes a fixed property, check for incompatible changes.
   * If the proxy is non-extensible, check that new properties are rejected.
   */
  defineProperty: function(name, desc) {
    // TODO(tvcutsem): the current tracemonkey implementation of proxies
    // auto-completes 'desc', which is not correct. 'desc' should be
    // normalized, but not completed. Consider:
    // Object.defineProperty(proxy, 'foo', {enumerable:false})
    // This trap will receive desc =
    //  {value:undefined,writable:false,enumerable:false,configurable:false}
    // This will also set all other attributes to their default value,
    // which is unexpected and different from [[DefineOwnProperty]].
    // Bug filed: https://bugzilla.mozilla.org/show_bug.cgi?id=601329

    var trap = this.getTrap("defineProperty");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.defineProperty(this.target, name, desc);
    }

    name = String(name);
    desc = normalizePropertyDescriptor(desc);
    var success = trap(this.target, name, desc);
    success = !!success; // coerce to Boolean


    if (success === true) {
      
      // Note: we could collapse the following two if-tests into a single
      // test. Separating out the cases to improve error reporting.
      
      if (!Object.isExtensible(this.target)) {
        if (!isFixed(name, this.target)) {
          throw new TypeError("cannot successfully add a new property '"+
                              name + "' to a non-extensible object");          
        }
      }

      if (isFixed(name, this.target)) {
        if (!validateProperty(this.target, name, desc)) {
          throw new TypeError("cannot define incompatible property "+
                              "descriptor for property '"+name+"'");
        }
      }
      
      if (!desc.configurable && !isFixed(name, this.target)) {
        throw new TypeError("cannot successfully define a non-configurable "+
                            "descriptor for non-existent property '"+
                            name+"'");
      }
      
    }
    
    return success;
  },
  
  /**
   * On success, check whether the target object is indeed frozen.
   */
  freeze: function() {
    var trap = this.getTrap("freeze");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.freeze(this.target);
    }

    var success = trap(this.target);
    success = !!success; // coerce to Boolean
    if (success) {
      if (!prim_isFrozen(this.target)) {
        throw new TypeError("can't report non-frozen object as frozen: "+
                            this.target);
      }      
    }
    return success;
  },
  
  /**
   * On success, check whether the target object is indeed sealed.
   */
  seal: function() {
    var trap = this.getTrap("seal");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.seal(this.target);
    }

    var success = trap(this.target);
    success = !!success; // coerce to Boolean
    if (success) {
      if (!prim_isSealed(this.target)) {
        throw new TypeError("can't report non-sealed object as sealed: "+
                            this.target);
      }      
    }
    return success;
  },
  
  /**
   * On success, check whether the target object is indeed non-extensible.
   */
  preventExtensions: function() {
    var trap = this.getTrap("preventExtensions");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.preventExtensions(this.target);
    }

    var success = trap(this.target);
    success = !!success; // coerce to Boolean
    if (success) {
      if (prim_isExtensible(this.target)) {
        throw new TypeError("can't report extensible object as non-extensible: "+
                            this.target);
      }      
    }
    return success;
  },
  
  /**
   * If name denotes a sealed property, check whether handler rejects.
   */
  delete: function(name) { 
    "use strict";
    var trap = this.getTrap("deleteProperty");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.deleteProperty(this.target, name);
    }
    
    name = String(name);
    var res = trap(this.target, name);
    res = !!res; // coerce to Boolean
    
    if (res === true) {
      if (isSealed(name, this.target)) {
        throw new TypeError("property '"+name+"' is non-configurable "+
                            "and can't be deleted");        
      }
    }
    
    return res;
  },
  
  /**
   * Checks whether the trap result does not contain any new properties
   * if the proxy is non-extensible.
   *
   * Any own non-configurable properties of the target that are not included
   * in the trap result give rise to a TypeError. As such, we check whether the
   * returned result contains at least all sealed properties of the target
   * object.
   *
   * Additionally, the trap result is normalized.
   * Instead of returning the trap result directly:
   *  - create and return a fresh Array,
   *  - of which each element is coerced to String,
   *  - which does not contain duplicates.
   */
  getOwnPropertyNames: function() {
    var trap = this.getTrap("getOwnPropertyNames");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.getOwnPropertyNames(this.target);
    }
    
    var trapResult = trap(this.target);

    // propNames is used as a set of strings
    var propNames = Object.create(null);
    var numProps = +trapResult.length;
    var result = new Array(numProps);
    
    for (var i = 0; i < numProps; i++) {
      var s = String(trapResult[i]);
      if (propNames[s]) {
        throw new TypeError("getOwnPropertyNames cannot list a "+
                            "duplicate property '"+s+"'");
      }
      if (!Object.isExtensible(this.target) && !isFixed(s, this.target)) {
        // non-extensible proxies don't tolerate new own property names
        throw new TypeError("getOwnPropertyNames cannot list a new "+
                            "property '"+s+"' on a non-extensible object");
      }
      
      propNames[s] = true;
      result[i] = s;
    }
    
    var ownProps = Object.getOwnPropertyNames(this.target);
    var target = this.target;
    ownProps.forEach(function (ownProp) {
      if (!propNames[ownProp]) {
        if (isSealed(ownProp, target)) {
          throw new TypeError("getOwnPropertyNames trap failed to include "+
                              "non-configurable property '"+ownProp+"'");          
        }
        if (!Object.isExtensible(target) &&
            isFixed(ownProp, target)) {
            // if handler is allowed to report ownProp as non-existent,
            // we cannot guarantee that it will never later report it as
            // existent. Once a property has been reported as non-existent
            // on a non-extensible object, it should forever be reported as
            // non-existent
            throw new TypeError("cannot report existing own property '"+ownProp+
                                "' as non-existent on a non-extensible object");
        }
      }
    });
    
    return result;
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
   * If name denotes a fixed property, check whether the trap returns true.
   * If name denotes a new property on a non-extensible proxy, check whether
   * the trap returns false.
   */
  hasOwn: function(name) {
    "use strict";

    var trap = this.getTrap("hasOwn");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.hasOwn(this.target, name);
    }

    name = String(name);
    var res = trap(this.target, name);
    res = !!res; // coerce to Boolean
        
    if (res === false) {
      if (isSealed(name, this.target)) {
        throw new TypeError("cannot report existing non-configurable own "+
                            "property '"+name + "' as a non-existent own "+
                            "property");
      }
      if (!Object.isExtensible(this.target) &&
          isFixed(name, this.target)) {
          // if handler is allowed to return false, we cannot guarantee
          // that it will return true for this property later.
          // Once a property has been reported as non-existent on a non-extensible
          // object, it should forever be reported as non-existent
          throw new TypeError("cannot report existing own property '"+name+
                              "' as non-existent on a non-extensible object");
      }
    } else {
      // res === true, if the proxy is non-extensible,
      // check that name is no new property
      if (!Object.isExtensible(this.target)) {
        if (!isFixed(name, this.target)) {
          throw new TypeError("cannot report a new own property '"+
                              name + "' on a non-extensible object");          
        }
      }
    }
    
    return res;
  },
  
  /**
   * If name denotes a fixed property, check whether the trap returns true.
   */
  has: function(name) {    
    var trap = this.getTrap("has");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.has(this.target, name);
    }
    
    name = String(name);
    var res = trap(this.target, name);
    res = !!res; // coerce to Boolean
    
    if (res === false) {
      if (isSealed(name, this.target)) {
        throw new TypeError("cannot report existing non-configurable own "+
                            "property '"+ name + "' as a non-existent "+
                            "property");        
      }
      if (!Object.isExtensible(this.target) &&
          isFixed(name, this.target)) {
          // if handler is allowed to return false, we cannot guarantee
          // that it will not return true for this property later.
          // Once a property has been reported as non-existent on a non-extensible
          // object, it should forever be reported as non-existent
          throw new TypeError("cannot report existing own property '"+name+
                              "' as non-existent on a non-extensible object");
      }
    }
    
    // if res === true, we don't need to check for extensibility
    // even for a non-extensible proxy that has no own name property,
    // the property may have been inherited
    
    return res;
  },
  
  /**
   * If name denotes a fixed non-configurable, non-writable data property,
   * check its return value against the previously asserted value of the
   * fixed property.
   */
  get: function(receiver, name) {
    var trap = this.getTrap("get");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.get(this.target, name, receiver);
    }

    name = String(name);
    var res = trap(this.target, name, receiver);
    
    var fixedDesc = Object.getOwnPropertyDescriptor(this.target, name);
    // check consistency of the returned value
    if (fixedDesc !== undefined) { // getting an existing property
      if (isDataDescriptor(fixedDesc) &&
          fixedDesc.configurable === false &&
          fixedDesc.writable === false) { // own frozen data property
        if (!sameValue(res, fixedDesc.value)) {
          throw new TypeError("cannot report inconsistent value for "+
                              "non-writable, non-configurable property '"+
                              name+"'");
        }
      } else { // it's an accessor property
        if (isAccessorDescriptor(fixedDesc) &&
            fixedDesc.configurable === false &&
            fixedDesc.get === undefined) {
          if (res !== undefined) {
            throw new TypeError("must report undefined for non-configurable "+
                                "accessor property '"+name+"' without getter");            
          }
        }
      }
    }
    
    return res;
  },
  
  /**
   * If name denotes a fixed non-configurable, non-writable data property,
   * check that the trap rejects the assignment.
   */
  set: function(receiver, name, val) {
    var trap = this.getTrap("set");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.set(this.target, name, val, receiver);
    }
        
    name = String(name);
    var res = trap(this.target, name, val, receiver);
    res = !!res; // coerce to Boolean
         
    // if success is reported, check whether property is truly assignable
    if (res === true) {
      var fixedDesc = Object.getOwnPropertyDescriptor(this.target, name);
      if (fixedDesc !== undefined) { // setting an existing property
        if (isDataDescriptor(fixedDesc) &&
            fixedDesc.configurable === false &&
            fixedDesc.writable === false) {
          if (!sameValue(val, fixedDesc.value)) {
            throw new TypeError("cannot successfully assign to a "+
                                "non-writable, non-configurable property '"+
                                name+"'");
          }
        } else {
          if (isAccessorDescriptor(fixedDesc) &&
              fixedDesc.configurable === false && // non-configurable
              fixedDesc.set === undefined) {      // accessor with undefined setter
            throw new TypeError("setting a property '"+name+"' that has "+
                                " only a getter");
          }
        }
      }
    }
    
    return res;
  },
  
  /**
   * Any own enumerable non-configurable properties of the target that are not
   * included in the trap result give rise to a TypeError. As such, we check
   * whether the returned result contains at least all sealed enumerable properties
   * of the target object.
   *
   * The trap result is normalized.
   * The trap result is not returned directly. Instead:
   *  - create and return a fresh Array,
   *  - of which each element is coerced to String,
   *  - which does not contain duplicates
   */
  enumerate: function() {
    var trap = this.getTrap("enumerate");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.enumerate(this.target);
    }
    
    var trapResult = trap(this.target);

    // propNames is used as a set of strings
    var propNames = Object.create(null);
    var numProps = +trapResult.length;
    var result = new Array(numProps);
    
    for (var i = 0; i < numProps; i++) {
      var s = String(trapResult[i]);
      if (propNames[s]) {
        throw new TypeError("enumerate trap cannot list a "+
                            "duplicate property '"+s+"'");
      }

      propNames[s] = true;
      result[i] = s;
    }

    var ownEnumerableProps = Object.keys(this.target);
    var target = this.target;
    ownEnumerableProps.forEach(function (ownEnumerableProp) {
      if (!propNames[ownEnumerableProp]) {
        if (isSealed(ownEnumerableProp, target)) {
          throw new TypeError("enumerate trap failed to include "+
                              "non-configurable enumerable property '"+
                              ownEnumerableProp+"'");          
        }
        if (!Object.isExtensible(target) &&
            isFixed(ownEnumerableProp, target)) {
            // if handler is allowed not to report ownEnumerableProp as an own
            // property, we cannot guarantee that it will never report it as
            // an own property later. Once a property has been reported as
            // non-existent on a non-extensible object, it should forever be
            // reported as non-existent
            throw new TypeError("cannot report existing own property '"+
                                ownEnumerableProp+"' as non-existent on a "+
                                "non-extensible object");
        }
      }
    });

    return result;
  },
  
  /**
   * The iterate trap should return an iterator object.
   */
  iterate: function() {
    var trap = this.getTrap("iterate");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.iterate(this.target);
    }
    
    var trapResult = trap(this.target);

    if (Object(trapResult) !== trapResult) {
      throw new TypeError("iterate trap should return an iterator object, "+
                          "got: "+ trapResult);
    }
    return trapResult;
  },
  
  /**
   * Any own non-configurable properties of the target that are not included
   * in the trap result give rise to a TypeError. As such, we check whether the
   * returned result contains at least all sealed properties of the target
   * object.
   *
   * The trap result is normalized.
   * The trap result is not returned directly. Instead:
   *  - create and return a fresh Array,
   *  - of which each element is coerced to String,
   *  - which does not contain duplicates
   */
  keys: function() {
    var trap = this.getTrap("keys");
    if (trap === undefined) {
      // default forwarding behavior
      return Reflect.keys(this.target);
    }
    
    var trapResult = trap(this.target);

    // propNames is used as a set of strings
    var propNames = Object.create(null);
    var numProps = +trapResult.length;
    var result = new Array(numProps);
    
    for (var i = 0; i < numProps; i++) {
     var s = String(trapResult[i]);
     if (propNames[s]) {
       throw new TypeError("keys trap cannot list a "+
                           "duplicate property '"+s+"'");
     }
     if (!Object.isExtensible(this.target) && !isFixed(s, this.target)) {
       // non-extensible proxies don't tolerate new own property names
       throw new TypeError("keys trap cannot list a new "+
                           "property '"+s+"' on a non-extensible object");
     }
     
     propNames[s] = true;
     result[i] = s;
    }
    
    var ownEnumerableProps = Object.keys(this.target);
    var target = this.target;
    ownEnumerableProps.forEach(function (ownEnumerableProp) {
      if (!propNames[ownEnumerableProp]) {
        if (isSealed(ownEnumerableProp, target)) {
          throw new TypeError("keys trap failed to include "+
                              "non-configurable enumerable property '"+
                              ownEnumerableProp+"'");          
        }
        if (!Object.isExtensible(target) &&
            isFixed(ownEnumerableProp, target)) {
            // if handler is allowed not to report ownEnumerableProp as an own
            // property, we cannot guarantee that it will never report it as
            // an own property later. Once a property has been reported as
            // non-existent on a non-extensible object, it should forever be
            // reported as non-existent
            throw new TypeError("cannot report existing own property '"+
                                ownEnumerableProp+"' as non-existent on a "+
                                "non-extensible object");
        }
      }
    });
    
    return result;
  },
  
  /**
   * New trap that reifies [[Call]].
   * If the target is a function, then a call to
   *   proxy(...args)
   * Triggers this trap
   */
  apply: function(target, thisBinding, args) {
    var trap = this.getTrap("apply");
    if (trap === undefined) {
      return Reflect.apply(target, thisBinding, args);
    }
    
    if (typeof this.target === "function") {
      return trap(target, thisBinding, args);
    } else {
      throw new TypeError("apply: "+ target + " is not a function");
    }
  },
  
  /**
   * New trap that reifies [[Construct]].
   * If the target is a function, then a call to
   *   new proxy(...args)
   * Triggers this trap
   */
  construct: function(target, args) {
    var trap = this.getTrap("construct");
    if (trap === undefined) {
      return Reflect.construct(target, args);
    }
    
    if (typeof this.target === "function") {
      return trap(target, args);
    } else {
      throw new TypeError("new: "+ target + " is not a function");
    }
  }
};

// ---- end of the Validator handler wrapper handler ----

// In what follows, a 'direct proxy' is a proxy
// whose handler is a Validator. Such proxies can be made non-extensible,
// sealed or frozen without losing the ability to trap.

// maps direct proxies to their Validator handlers
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
Object.isExtensible = function(subject) {
  var vHandler = directProxies.get(subject);
  if (vHandler !== undefined) {
    return Object.isExtensible(vHandler.target);
  } else {
    return prim_isExtensible(subject);
  }
};
Object.isSealed = function(subject) {
  var vHandler = directProxies.get(subject);
  if (vHandler !== undefined) {
    return Object.isSealed(vHandler.target);
  } else {
    return prim_isSealed(subject);
  }
};
Object.isFrozen = function(subject) {
  var vHandler = directProxies.get(subject);
  if (vHandler !== undefined) {
    return Object.isFrozen(vHandler.target);
  } else {
    return prim_isFrozen(subject);
  }
};
Object.getPrototypeOf = function(subject) {
  var vHandler = directProxies.get(subject);
  if (vHandler !== undefined) {
    return Object.getPrototypeOf(vHandler.target);
  } else {
    return prim_getPrototypeOf(subject);
  }
};
Object.prototype.valueOf = function() {
  var vHandler = directProxies.get(this);
  if (vHandler !== undefined) {
    return Object.prototype.valueOf.call(vHandler.target);
  } else {
    return prim_valueOf.call(this);
  }
};

// ============= Reflection module =============
// see http://wiki.ecmascript.org/doku.php?id=harmony:reflect_api

global.Reflect = {
  getOwnPropertyDescriptor: function(target, name) {
    return Object.getOwnPropertyDescriptor(target, name);
  },
  getOwnPropertyNames: function(target) {
    return Object.getOwnPropertyNames(target);
  },
  defineProperty: function(target, name, desc) {
    Object.defineProperty(target, name, desc);
    return true;
  },
  deleteProperty: function(target, name) {
    return nonstrictDelete(target, name);
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
      if (receiver === target) {
        var updateDesc =
          { value: value,
            // FIXME: it should not be necessary to describe the following
            // attributes. Added to circumvent a bug in tracemonkey:
            // https://bugzilla.mozilla.org/show_bug.cgi?id=601329
            writable:     ownDesc.writable,
            enumerable:   ownDesc.enumerable,
            configurable: ownDesc.configurable };
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
      return handler.construct(handler.target, args);
    }
    
    var proto = target.prototype;
    var instance = (Object(proto) === proto) ? Object.create(proto) : {};
    var result = Function.prototype.apply.call(target, instance, args);
    return Object(result) === result ? result : instance;
  }
};

// ============= Virtual Object API =============
// see http://wiki.ecmascript.org/doku.php?id=harmony:virtual_object_api

function abstract(name) {
  return function() {
    throw new TypeError("Missing fundamental trap: "+name);
  };
}

// TODO: consider defining VirtualHandler as a singleton object,
// instead of as a constructor function. It is a stateless abstraction.
function VirtualHandler() { };
global.Reflect.VirtualHandler = VirtualHandler;
VirtualHandler.prototype = {
  // fundamental traps
  getOwnPropertyDescriptor: abstract("getOwnPropertyDescriptor"),
  getOwnPropertyNames:      abstract("getOwnPropertyNames"),
  defineProperty:           abstract("defineProperty"),
  deleteProperty:           abstract("deleteProperty"),
  preventExtensions:        abstract("preventExtensions"),
  apply:                    abstract("apply"),
 
  // derived traps
  seal: function(target) {
    var success = this.preventExtensions(target);
    success = !!success; // coerce to Boolean
    if (success) {
      var props = this.getOwnPropertyNames(target);
      var l = +props.length;
      for (var i = 0; i < l; i++) {
        var name = props[i];
        success = success &&
          this.defineProperty(target,name,{configurable:false});
      }
    }
    return success;
  },
  freeze: function(target) {
    var success = this.preventExtensions(target);
    success = !!success; // coerce to Boolean
    if (success) {
      var props = this.getOwnPropertyNames(target);
      var l = +props.length;
      for (var i = 0; i < l; i++) {
        var name = props[i];
        var desc = this.getOwnPropertyDescriptor(target,name);
        desc = normalizeAndCompletePropertyDescriptor(desc);
        if (desc !== undefined && 'value' in desc) {
          success = success &&
            this.defineProperty(target,name,{writable:false,
                                             configurable:false});
        }
      }
    }
    return success;
  },
  has: function(target, name) {
    var desc = this.getOwnPropertyDescriptor(target, name);
    desc = normalizeAndCompletePropertyDescriptor(desc);
    if (desc !== undefined) {
      return true;
    }
    var proto = Object.getPrototypeOf(target);
    if (proto === null) {
      return false;
    }
    return Reflect.has(proto, name);
  },
  hasOwn: function(target,name) {
    var desc = this.getOwnPropertyDescriptor(target,name);
    desc = normalizeAndCompletePropertyDescriptor(desc);
    return desc !== undefined;
  },
  get: function(target, name, receiver) {
    receiver = receiver || target;
    
    var desc = this.getOwnPropertyDescriptor(target, name);
    desc = normalizeAndCompletePropertyDescriptor(desc);
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
  set: function(target, name, value, receiver) {
    // No need to set receiver = receiver || target;
    // in a trap invocation, receiver should already be set
    
    // first, check whether target has a non-writable property
    // shadowing name on receiver, via the fundamental
    // getOwnPropertyDescriptor trap
    var ownDesc = this.getOwnPropertyDescriptor(target, name);
    ownDesc = normalizeAndCompletePropertyDescriptor(ownDesc);
    
    if (ownDesc !== undefined) {
      if (isAccessorDescriptor(ownDesc)) {
        var setter = ownDesc.set;
        if (setter === undefined) return false;
        setter.call(receiver, value); // assumes Function.prototype.call
        return true;
      }
      // otherwise, isDataDescriptor(ownDesc) must be true
      if (ownDesc.writable === false) return false;
      if (receiver === target) {
        var updateDesc =
          { value: value,
            // FIXME: it should not be necessary to describe the following
            // attributes. Added to circumvent a bug in tracemonkey:
            // https://bugzilla.mozilla.org/show_bug.cgi?id=601329
            writable:     ownDesc.writable,
            enumerable:   ownDesc.enumerable,
            configurable: ownDesc.configurable };
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
    var trapResult = this.getOwnPropertyNames(target);
    var l = +trapResult.length;
    var result = [];
    for (var i = 0; i < l; i++) {
      var name = String(trapResult[i]);
      var desc = this.getOwnPropertyDescriptor(name);
      desc = normalizeAndCompletePropertyDescriptor(desc);
      if (desc !== undefined && desc.enumerable) {
        result.push(name);
      }
    }
    var proto = Object.getPrototypeOf(target);
    if (proto === null) {
      return result;
    }
    var inherited = Reflect.enumerate(proto);
    // FIXME: filter duplicates
    return result.concat(inherited);
  },
  iterate: function(target) {
    var trapResult = this.enumerate(target);
    var l = +trapResult.length;
    var idx = 0;
    return {
      next: function() {
        if (idx === l) {
          throw StopIteration;
        } else {
          return trapResult[idx++];
        }
      }
    };
  },
  keys: function(target) {
    var trapResult = this.getOwnPropertyNames(target);
    var l = +trapResult.length;
    var result = [];
    for (var i = 0; i < l; i++) {
      var name = String(trapResult[i]);
      var desc = this.getOwnPropertyDescriptor(name);
      desc = normalizeAndCompletePropertyDescriptor(desc);
      if (desc !== undefined && desc.enumerable) {
        result.push(name);
      }
    }
    return result;
  },
  construct: function(target, args) {
    var proto = this.get(target, 'prototype', target);
    var instance;
    if (Object(proto) === proto) {
      instance = Object.create(proto);        
    } else {
      instance = {};
    }
    var res = this.apply(target, instance, args);
    if (Object(res) === res) {
      return res;
    }
    return instance;
  }
};

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

      var vHandler = new Validator(target, handler);
      var proxy;
      if (typeof target === "function") {
        proxy = primCreateFunction(vHandler,
          // call trap
          function() {
            var args = Array.prototype.slice.call(arguments);
            return vHandler.apply(target, this, args);
          },
          // construct trap
          function() {
            var args = Array.prototype.slice.call(arguments);
            return vHandler.construct(target, args);
          });
      } else {
        proxy = primCreate(vHandler, Object.getPrototypeOf(target));
      }
      directProxies.set(proxy, vHandler);
      return proxy;
    };

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

// to support iteration protocol in non-spidermonkey environments:
if (typeof StopIteration === "undefined") {
  global.StopIteration = {};
}

}(this, function(target, name) {
  // non-strict delete, will never throw
  return delete target[name];
})); // function-as-module pattern