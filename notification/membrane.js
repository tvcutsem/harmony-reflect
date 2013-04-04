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
 * A revocable membrane abstraction expressed using Notification Proxies.
 * See the makeMembrane function below for details.
 *
 * Inspired by the original membrane example code by Mark S. Miller:
 * http://wiki.ecmascript.org/doku.php?id=harmony:proxies#an_identity-preserving_membrane
 *
 * For a detailed rationale of this membrane design, and the interaction
 * with ES5 invariants, see http://soft.vub.ac.be/Publications/2013/vub-soft-tr-13-03.pdf
 *
 * @author tvcutsem
 */

// requires Notification Proxies
// load('notify-reflect.js') before using
 
(function(exports){
  "use strict";
  
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

  // == The interesting stuff ==

  /**
   * A revocable membrane abstraction expressed using Notification Proxies.
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
   *
   * Note: once the membrane is revoked, access to wrapped objects is no longer
   * possible, although GC can't detect the revocation since we're not using
   * revocable proxies.
   */
  function makeMembrane(initWetTarget) {

    /****************************************************************************
    Design notes:

    A membrane separates two "realms" (object graphs): a "wet" realm and a "dry"
    realm. Every non-primitive value that crosses the membrane gets wrapped in a
    proxy. The membrane uses two WeakMaps to identify and cache previously
    created wrappers, so that for any "wet" value on the inside of the membrane,
    only a single "dry" wrapper gets created. This preserves identity across the
    membrane.

    Values can flow in two directions through the membrane:

      * dry -> wet: typically via argument-passing
      * wet -> dry: typically via return values or thrown exceptions

    The membrane distinguishes between these two directions by allocating a
    different wrapper, and maintaining a separate WeakMap cache, per direction.

    To be able to properly represent non-configurability and non-extensibility
    invariants, the membrane's Proxy wrappers make use of a dummy, "shadow"
    target. The "shadow", while being encapsulated inside the proxy, actually
    still counts as being on the opposite side of the membrane.

    Dry (outside)         | Wet (inside)
                          |
      DryObject  -->    DryToWetProxy --> DryShadowTarget
                                     \--> WetRealTarget
                          |
    WetShadowTarget <-- WetToDryProxy <-- WetObject
      DryRealTarget <--/
                          |
                          |

    In the above drawing, the DryToWetProxy is a proxy for the WetRealTarget,
    but the "target" of the Proxy abstraction is DryShadowTarget.

    In every pre-trap, the state of the DryShadowTarget is "synchronized" with
    that of the WetRealTarget. When the notification proxy next forwards the
    intercepted operation to the DryShadowTarget, the shadow will return the
    appropriate result.

    If the intercepted operation is supposed to side-effect the target, then
    a post-trap is registered that propagates the update from the
    DryShadowTarget to the WetRealTarget.

    If the intercepted operation does not side-effect the target, then no
    post-trap is required and the pre-trap simply returns undefined.

    Throughout the remainder of this code, we use the naming prefix "wet" or "dry"
    consistently as a sort of type annotation to identify the provenance of the
    named value.

    ****************************************************************************/

    var revoked = false; // is the membrane revoked yet?

    // on first read, it may help to skip down below to see how this function
    // is used
    var dryToWetMaker = function(dryToWetCache, wetToDryCache, dryToWetRef, wetToDryRef) {

      // This function is called whenever a dry object crosses the membrane
      // to the wet side. It should convert the dryTarget to its wet counterpart.
      return function(dryTarget) {

        if (Object(dryTarget) !== dryTarget) {
          return dryTarget; // primitives are passed through unwrapped
        }

        var wetToDryWrapper = dryToWetCache.get(dryTarget);
        if (wetToDryWrapper) {
          return wetToDryWrapper; // already got a wrapper
        }

        var dryToWet = dryToWetRef.val;
        var wetToDry = wetToDryRef.val;

        // need to make a new wrapper

        var wetShadowTarget;

        if (typeof dryTarget === "function") {
          wetShadowTarget = function() {
            if (revoked) throw new Error("revoked");
            var wetArgs = Array.prototype.slice.call(arguments);
            var wetThis = this;
            var dryArgs = wetArgs.map(wetToDry);
            var dryThis = wetToDry(wetThis);
            try {
              var dryResult = Reflect.apply(dryTarget, dryThis, dryArgs);            
              var wetResult = dryToWet(dryResult);
              return wetResult;
            } catch (dryException) {
              throw dryToWet(dryException);
            }
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
              try {
                wetShadowTarget.__proto__ = dryToWet(dryProto);
              } catch (e) {
                // fails on FF with TypeError:
                // can't redefine non-configurable property '__proto__'
              }
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
              // preventExtensions shouldn't fail on the shadow since
              // it's a normal, non-proxy object
              assert(success);
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
          
          // FIXME: skipped onFreeze, onSeal, onIsFrozen, onIsSealed traps

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
            //   - then the following line will define wetShadowTarget.name
            //     as a wrapped accessor
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
            return function(wetShadowTarget, name, val, wetReceiver, success) {
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
        wetToDryCache.set(wetToDryWrapper, dryTarget);
        return wetToDryWrapper;
      }; // end function(dryTarget)

    }; // end dryToWetMaker

    var dryToWetCache = new WeakMap();
    var wetToDryCache = new WeakMap();

    // dryToWet needs wetToDry and vice-versa -> cyclic dependency
    // this dependency is broken by introducing explicit "reference" objects
    // whose 'val' property acts as an explicit pointer.
    var dryToWetRef = {val:null};
    var wetToDryRef = {val:null};

    dryToWetRef.val = dryToWetMaker(dryToWetCache, wetToDryCache,
                                    dryToWetRef, wetToDryRef);
    
    // note the reversed order of wetToDry and dryToWet:
    
    wetToDryRef.val = dryToWetMaker(wetToDryCache, dryToWetCache,
                                    wetToDryRef, dryToWetRef);

    return {
      target: wetToDryRef.val(initWetTarget),
      revoke: function() {
        dryToWetCache = null;
        wetToDryCache = null;
        revoked = true;
      }
    };
  }; // end makeMembrane

  // trivial unit test, see ../test/membrane_test.js for more
  function testMembrane() {
    load('notify-reflect.js');
    var wetTarget = {x: {y:2}};
    var membrane = makeMembrane(wetTarget);
    var dryProxy = membrane.target;

    var dryFoo = dryProxy.x;
    assert(dryFoo.y === 2);
    membrane.revoke();
    try {
      dryFoo.y; // TypeError: revoked
      assert(false);
    } catch (e) {
      assert(/revoked/.test(e.toString()));
    }
    print('ok');
  }

  // testMembrane();
  
  exports.makeMembrane = makeMembrane;
  
}(typeof exports !== "undefined" ? exports : this));