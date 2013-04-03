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
 * The Original Code is an example of Notification Proxies
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

"use strict";
load('notify-reflect.js');

// == Auxiliaries ==

function assert(bool) {
  if (!bool) throw new Error("assertion failed");
}

/**
 * Overwrites `dst.name` with `src.name`.
 * Either succeeds silently or fails noisily with a TypeError.
 */
function copy(src, dst, name, wrap) {
  var srcDesc = Reflect.getOwnPropertyDescriptor(src, name);
  if (srcDesc === undefined) {
    delete dst[name];
  } else {
    
    // simply calling wrappedSrcDesc = wrap(srcDesc) leads to infinite recursion,
    // possible cause: internal algo's query srcDesc for its attributes, which are
    // themselves new objects that need to be wrapped, which themselves have attributes,
    // which need to be wrapped, etc.
    // Hence, we manually wrap the source property descriptor:
    var wrappedSrcDesc = Object.create(null);
    wrappedSrcDesc.enumerable = srcDesc.enumerable;
    wrappedSrcDesc.configurable = srcDesc.configurable;
    if ('value' in srcDesc) {
      wrappedSrcDesc.value = wrap(srcDesc.value);
      wrappedSrcDesc.writable = srcDesc.writable;
    } else {
      wrappedSrcDesc.get = wrap(srcDesc.get);
      wrappedSrcDesc.set = wrap(srcDesc.set);
    }

    // Case-analysis, assuming dstDesc = Object.getOwnPropertyDescriptor(dst, name);
    // srcDesc is configurable, dstDesc is configurable or undefined
    //  => dstDesc is unconditionally overridden
    // srcDesc is configurable, dstDesc is non-configurable
    //  => should not occur (dstDesc can only be non-configurable
    //                       if srcDesc was previously non-configurable)
    // srcDesc is non-configurable, dstDesc is configurable or undefined
    //  => dstDesc is unconditionally overridden
    // srcDesc is non-configurable, dstDesc is non-configurable
    //  => Object.defineProperty should tolerate the update as long as all values
    //     are identical. OK since wrap preserves identity of wrappers.
    Object.defineProperty(dst, name, wrappedSrcDesc);
  }
}

/**
 * Copy all "own" properties from 'src' to 'dst'. Properties are wrapped
 * using 'wrap' before being defined on the 'dst' object.
 */
function copyAll(src, dst, wrap) {
  Object.getOwnPropertyNames(src).forEach(function (name) {
    copy(src, dst, name, wrap);
  });
}

/**
 * A membrane abstraction expressed using Notification Proxies.
 *
 * @author tvcutsem
 *
 * For a general introduction to membranes, see:
 * http://soft.vub.ac.be/~tvcutsem/invokedynamic/js-membranes
 *
 * Usage:
 * var membrane = makeMembrane(wetObject)
 * var dryObject = membrane.target;
 * var dryX = dryObject.x; // accessed objects are recursively wrapped
 * membrane.revoke(); // touching any dry value after this point throws
 */
function makeMembrane(initWetTarget) {
  
  var revoked = false;
  
  // Dry ---> DryToWetProxy ---> DryShadowTarget
  //                        ---> WetRealTarget
  
  // Wet ---> WetToDryProxy ---> WetShadowTarget
  //                        ---> DryRealTarget
    
  var dryToWetMaker = function(scope, dryToWetName, wetToDryName) {
    
    var dryToWetCache = new WeakMap();
    
    return function(dryTarget) {

      if (Object(dryTarget) !== dryTarget) {
        return dryTarget; // primitives are passed through
      }
      
      var wetToDryWrapper = dryToWetCache.get(dryTarget);
      if (wetToDryWrapper) {
        return wetToDryWrapper; // already got a wrapper
      }

      var dryToWet = scope[dryToWetName];
      var wetToDry = scope[wetToDryName];

      // need to make a new wrapper
      var wetShadowTarget;
      
      // DEBUG: print('wrapping ' + dryTarget.toSource());

      if (typeof dryTarget === "function") {
        wetShadowTarget = function() {
          var wetArgs = Array.prototype.slice.call(arguments);
          var wetThis = this;
          var dryArgs = wetArgs.map(wetToDry);
          var dryThis = dryToWet(wetThis);
          var dryResult = Reflect.apply(dryTarget, dryThis, dryArgs);
          var wetResult = wetToDry(dryResult);
          return wetResult;
        };
      } else {
        var dryProto = Object.getPrototypeOf(dryTarget);
        wetShadowTarget = Object.create(dryToWet(dryProto));
      }
      
      wetToDryWrapper = new Proxy(wetShadowTarget, {

        onGetOwnPropertyDescriptor: function(wetShadowTarget, name) {
          if (revoked) throw new Error("revoked");
          copy(dryTarget, wetShadowTarget, name, dryToWet);
          return undefined;
        },

        onGetOwnPropertyNames: function(wetShadowTarget) {
          if (revoked) throw new Error("revoked");
          copyAll(dryTarget, wetShadowTarget, dryToWet);
          return undefined;
        },

        onGetPrototypeOf: function(wetShadowTarget) {
          if (revoked) throw new Error("revoked");
          // if non-standard __proto__ is available, use it to synchronize the prototype
          // as it may have changed since wetShadowTarget was first created
          if (({}).__proto__ !== undefined) {
            var dryProto = Object.getPrototypeOf(dryTarget);
            wetShadowTarget.__proto__ = dryToWet(dryProto);          
          }
          return undefined;
        },

        onDefineProperty: function(wetShadowTarget, name, wetDesc) {
          if (revoked) throw new Error("revoked");
          copy(dryTarget, wetShadowTarget, name, dryToWet);
          return function(wetShadowTarget, name, wetDesc, success) {
            if (success) {
              copy(wetShadowTarget, dryTarget, name, wetToDry);
            }
          };
        },

        onDeleteProperty: function(wetShadowTarget, name) {
          if (revoked) throw new Error("revoked");
          copy(dryTarget, wetShadowTarget, name, dryToWet);
          return function(wetShadowTarget, name, success) {
            if (success) {
              copy(wetShadowTarget, dryTarget, name, wetToDry);
            }
          };
        },

        onPreventExtensions: function(wetShadowTarget) {
          if (revoked) throw new Error("revoked");
          copyAll(dryTarget, wetShadowTarget, dryToWet);
          Object.preventExtensions(dryTarget);
          return function(wetShadowTarget, success) {
            assert(success === true)
          };
        },

        onIsExtensible: function(wetShadowTarget) {
          if (revoked) throw new Error("revoked");
          if (!Object.isExtensible(dryTarget)) {
            copyAll(dryTarget, wetShadowTarget, dryToWet);
            Object.preventExtensions(wetShadowTarget);
          }
          return undefined;
        },

        onHas: function(wetShadowTarget, name) {
          if (revoked) throw new Error("revoked");
          copy(dryTarget, wetShadowTarget, name, dryToWet);
          return undefined;
        },

        onHasOwn: function(wetShadowTarget, name) {
          if (revoked) throw new Error("revoked");
          copy(dryTarget, wetShadowTarget, name, dryToWet);
          return undefined;
        },

        onGet: function(wetShadowTarget, name, wetReceiver) {
          if (revoked) throw new Error("revoked");
          // How does wetReceiver get wrapped?
          //   - assume dryTarget.name is an accessor
          //   - the following line will define wetShadowTarget.name as a wrapped accessor
          //   - the wrapped accessor's "get" function will be a function proxy...
          //   - ... which does the wrapping when it gets applied
          copy(dryTarget, wetShadowTarget, name, dryToWet);
          return undefined;
              // post-trap: function(wetShadowTarget, name, wetReceiver, wetResult) {}
              // note: return value is already 'wet', as it comes from
              // accessing a property on the wetShadowTarget
        },

        onSet: function(wetShadowTarget, name, val, wetReceiver) {
          if (revoked) throw new Error("revoked");
          copy(dryTarget, wetShadowTarget, name, dryToWet);
          return function(wetShadowTarget, name, wetReceiver, success) {
            if (success) {
              copy(wetShadowTarget, dryTarget, name, wetToDry);            
            }
          }
        },

        onEnumerate: function(wetShadowTarget) {
          if (revoked) throw new Error("revoked");
          copyAll(dryTarget, wetShadowTarget, dryToWet);
          return undefined;
        },

        onKeys: function(wetShadowTarget) {
          if (revoked) throw new Error("revoked");
          copyAll(dryTarget, wetShadowTarget, dryToWet);
          return undefined;
        },

        onApply: function(wetShadowTarget, wetThisArg, wetArgs) {
          if (revoked) throw new Error("revoked");
          return undefined;
        },

        onConstruct: function(wetShadowTarget, wetArgs) {
          if (revoked) throw new Error("revoked");
          return undefined;
        }

      }); // end wetToDryWrapper = new Proxy(...)

      dryToWetCache.set(dryTarget, wetToDryWrapper);
      return wetToDryWrapper;
    }; // end function(dryTarget)
  }; // end dryToWetMaker
  
  // dryToWet needs wetToDry and vice-versa -> cyclic dependency
  // this dependency is broken by introducing an explicit scope object
  var scope = {};
  scope.dryToWet = dryToWetMaker(scope, 'dryToWet', 'wetToDry');
  scope.wetToDry = dryToWetMaker(scope, 'wetToDry', 'dryToWet');
  
  return {
    target: scope.wetToDry(initWetTarget),
    revoke: function() { revoked = true; }
  };
}; // end makeMembrane

// simple unit test

var wetTarget = {x: {y:2}};
var membrane = makeMembrane(wetTarget);
var dryProxy = membrane.target;

var dryFoo = dryProxy.x;
print(dryFoo.y); // 2
membrane.revoke();
print(dryFoo.y); // TypeError: revoked

// TODOs:
// - test dry->wet mapping by passing a wet object
// (or better yet: run direct proxy simple_membrane.js tests with this implementation)
// - rename to membrane.js
// - use this impl. to derive a full impl for direct proxies