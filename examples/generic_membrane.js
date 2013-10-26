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
 * A generic membrane abstraction based on the revocable
 * membrane abstraction elsewhere in this repository.
 *
 * @author tvcutsem
 */

// requires Direct Proxies
// load('reflect.js') before using
 
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

  function isConfigurable(obj, name) {
    var desc = Reflect.getOwnPropertyDescriptor(obj, name);
    return desc === undefined || desc.configurable === true;
  }


  // == The interesting stuff ==

  /**
   * A revocable membrane abstraction expressed using Direct Proxies.
   *
   * @author tvcutsem
   *
   * For a general introduction to membranes, see:
   * http://soft.vub.ac.be/~tvcutsem/invokedynamic/js-membranes
   *
   * Usage:
   * var membrane = makeGenericMembrane(wetObject, handler)
   * var dryObject = membrane.target;
   * var dryX = dryObject.x; // accessed objects are recursively wrapped
   *
   * dry2wetHandler and wet2dryHandler are both membrane handlers that trap
   * operations intercepted on either wet or dry membrane proxies.
   *
   * A membrane handler supports a callback for each trap of the regular
   * Proxy handlers. These callbacks are invoked whenever an operation is 
   * intercepted on a membraned object. Example:
   *
   * wet2dryHandler = {
   *   onGet: function(wetTarget, name, wetReceiver, dryTarget) -> void
   * }
   *
   * The parameters of the callback are the same of the corresponding trap,
   * except the callback takes as an extra last argument the dryTarget
   * (i.e. the actual value being wrapped)
   *
   * The callback's return value is ignored, but the callback is ran before
   * the membrane forwards the operation to the wrapped target. Thus, a
   * callback may abort an intercepted operation by throwing an exception.
   *
   * In addition, the membraneHandler supports the following traps:
   *
   *  onFirstCross(obj : object) -> void
   *    called when obj crosses the membrane (for the first time)
   *    an object can be prohibited from crossing the membrane by
   *    having this callback throw an exception.
   *
   */
  function makeGenericMembrane(initWetTarget, dry2wetHandler, wet2dryHandler) {

    /****************************************************************************
    Design notes:

    A membrane separates two "realms" (object graphs): a "wet" realm and a "dry"
    realm. Every non-primitive value that crosses the membrane gets wrapped in a
    proxy. The membrane uses two WeakMaps to identify and cache previously
    created wrappers, so that for any "wet" value on the inside of the membrane,
    only a single "dry" wrapper gets created. This preserves identity across the
    membrane.

    Values can flow in two directions through the membrane:

      * dry -> wet: typically via argument-passing into called functions,
                    or by assigning to object fields
      * wet -> dry: typically via return values or thrown exceptions,
                    or by reading from object fields

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

    Before the DryToWetProxy forwards the intercepted operation to
    WetRealTarget, the state of the DryShadowTarget is "synchronized" with
    that of the WetRealTarget. When the proxy next forwards the
    intercepted operation to the DryShadowTarget, the shadow will return the
    appropriate result.

    If the intercepted operation is supposed to side-effect the target, then
    after the operation was forwarded, the proxy propagates the update from the
    DryShadowTarget to the WetRealTarget.

    Throughout the remainder of this code, we use the naming prefix "wet" or "dry"
    consistently as a sort of type annotation to identify the provenance of the
    named value.

    ****************************************************************************/
    
    // on first read, it may help to skip down below to see how this function
    // is used
    var dryToWetMaker =
      function(dryToWetCache, wetToDryCache, dryToWetRef, wetToDryRef, handler) {

      // This function is called whenever a dry object crosses the membrane
      // to the wet side. It should convert the dryTarget to its wet counterpart.
      return function(dryTarget) {

        if (Object(dryTarget) !== dryTarget) {
          return dryTarget; // primitives are passed through unwrapped
        }
        // errors are passed as reconstructed error objects
        if (dryTarget instanceof Error) {
          return new Error(''+dryTarget.message);
        }

        var wetToDryWrapper = dryToWetCache.get(dryTarget);
        if (wetToDryWrapper) {
          return wetToDryWrapper; // already got a wrapper
        }

        if (handler.onFirstCross) {
          handler.onFirstCross(dryTarget); // callback to membrane handler
        }

        var dryToWet = dryToWetRef.val;
        var wetToDry = wetToDryRef.val;

        // need to make a new wrapper

        var wetShadowTarget;

        if (typeof dryTarget === "function") {
          wetShadowTarget = function wrapper() {
            var wetArgs = Array.prototype.slice.call(arguments);
            var wetThis = this;
            var dryArgs = wetArgs.map(wetToDry);
            var dryThis = wetToDry(wetThis);
            try {
              var dryResult = Reflect.apply(dryTarget, dryThis, dryArgs);            
              var wetResult = dryToWet(dryResult);
              return wetResult;
            } catch (dryException) {
              // DEBUG: throw dryException;
              throw dryToWet(dryException);
            }
          };
        } else {
          var dryProto = Object.getPrototypeOf(dryTarget);
          wetShadowTarget = Object.create(dryToWet(dryProto));
        }

        wetToDryWrapper = new Proxy(wetShadowTarget, {

          getOwnPropertyDescriptor: function(wetShadowTarget, name) {
            if (handler.onGetOwnPropertyDescriptor) {
              handler.onGetOwnPropertyDescriptor(wetShadowTarget, name, dryTarget);
            }
            
            // no-invariant case:
            if (Object.isExtensible(wetShadowTarget) &&
                isConfigurable(dryTarget, name)) {
              return dryToWet(Reflect.getOwnPropertyDescriptor(dryTarget, name));
            }
            
            // general case:
            copy(dryTarget, wetShadowTarget, name, dryToWet);
            return Reflect.getOwnPropertyDescriptor(wetShadowTarget, name);
          },

          getOwnPropertyNames: function(wetShadowTarget) {
            if (handler.onGetOwnPropertyNames) {
              handler.onGetOwnPropertyNames(wetShadowTarget, dryTarget);              
            }
            
            // no-invariant case:
            if (Object.isExtensible(wetShadowTarget)) {
              return Reflect.getOwnPropertyNames(dryTarget);
            }
            
            // general case:
            copyAll(dryTarget, wetShadowTarget, dryToWet);
            return Reflect.getOwnPropertyNames(wetShadowTarget);
          },

          getPrototypeOf: function(wetShadowTarget) {
            if (handler.onGetPrototypeOf) {
              handler.onGetPrototypeOf(wetShadowTarget, dryTarget);              
            }
            
            // if non-standard __proto__ is available, use it to synchronize the prototype
            // as it may have changed since wetShadowTarget was first created
            if (({}).__proto__ !== undefined) {
              var dryProto = Object.getPrototypeOf(dryTarget);
              var wetProto = dryToWet(dryProto);
              if (Object.getPrototypeOf(wetShadowTarget) !== wetProto) {
                // Note: using [[Set]] instead of [[DefineOwnProperty]] by executing:
                //  wetShadowTarget.__proto__ = ...;
                // fails on spidermonkey/firefox
                Object.defineProperty(wetShadowTarget, '__proto__', wetProto);                
              }
            }
            return Reflect.getPrototypeOf(wetShadowTarget);
          },

          defineProperty: function(wetShadowTarget, name, wetDesc) {
            if (handler.onDefineProperty) {
              handler.onDefineProperty(wetShadowTarget, name, wetDesc, dryTarget);              
            }
            
            // no-invariant case:
            if (Object.isExtensible(wetShadowTarget) &&
                wetDesc.configurable === true) {
              return Reflect.defineProperty(dryTarget, name, wetToDry(wetDesc));    
            }
            
            // general case:
            copy(dryTarget, wetShadowTarget, name, dryToWet);
            var success = Reflect.defineProperty(wetShadowTarget, name, wetDesc);
            if (success) {
              copy(wetShadowTarget, dryTarget, name, wetToDry);
            }
            return success;
          },

          deleteProperty: function(wetShadowTarget, name) {
            if (handler.onDeleteProperty) {
              handler.onDeleteProperty(wetShadowTarget, name, dryTarget);              
            }
            
            // no-invariant case:
            if (isConfigurable(dryTarget, name)) {
              return Reflect.deleteProperty(dryTarget, name);
            }
            
            // general case:
            copy(dryTarget, wetShadowTarget, name, dryToWet);
            var success = Reflect.deleteProperty(wetShadowTarget, name);
            if (success) {
              copy(wetShadowTarget, dryTarget, name, wetToDry);
            }
            return success;
          },

          preventExtensions: function(wetShadowTarget) {
            if (handler.onPreventExtensions) {
              handler.onPreventExtensions(wetShadowTarget, dryTarget);  
            }
                        
            copyAll(dryTarget, wetShadowTarget, dryToWet);
            Object.preventExtensions(dryTarget);
            return Reflect.preventExtensions(wetShadowTarget);
          },

          isExtensible: function(wetShadowTarget) {
            if (handler.onIsExtensible) {
              handler.onIsExtensible(wetShadowTarget, dryTarget);              
            }
            
            if (!Object.isExtensible(dryTarget)) {
              copyAll(dryTarget, wetShadowTarget, dryToWet);
              Object.preventExtensions(wetShadowTarget);
            }
            return Reflect.isExtensible(wetShadowTarget);
          },
          
          // FIXME: skipped freeze, seal, isFrozen, isSealed traps

          has: function(wetShadowTarget, name) {
            if (handler.onHas) {
              handler.onHas(wetShadowTarget, name, dryTarget);              
            }
            
            // no-invariant case:
            if (Object.isExtensible(wetShadowTarget) &&
                isConfigurable(dryTarget, name)) {
              return Reflect.has(dryTarget, name);
            }
            
            // general case:
            copy(dryTarget, wetShadowTarget, name, dryToWet);
            return Reflect.has(wetShadowTarget, name);
          },

          hasOwn: function(wetShadowTarget, name) {
            if (handler.onHasOwn) {
              handler.hasOwn(wetShadowTarget, name, dryTarget);              
            }
            
            // no-invariant case:
            if (Object.isExtensible(wetShadowTarget) &&
                isConfigurable(dryTarget, name)) {
              return Reflect.hasOwn(dryTarget, name);
            }
            
            copy(dryTarget, wetShadowTarget, name, dryToWet);
            return Reflect.hasOwn(wetShadowTarget, name);
          },

          get: function(wetShadowTarget, name, wetReceiver) {
            // DEBUG: if (name === "toString") { return dryTarget.toString; }
            
            if (handler.onGet) {
              handler.onGet(wetShadowTarget, name, wetReceiver, dryTarget);              
            }
            
            // no-invariant case:
            if (isConfigurable(dryTarget, name)) {
              // TODO: catch and wrap exceptions thrown from getter?
              return dryToWet(Reflect.get(dryTarget, name, wetToDry(wetReceiver)));
            }
            
            // general case:
            
            // How does wetReceiver get wrapped?
            //   - assume dryTarget.name is an accessor
            //   - then the following line will define wetShadowTarget.name
            //     as a wrapped accessor
            //   - the wrapped accessor's "get" function will be a function proxy...
            //   - ... which does the wrapping when it gets applied
            copy(dryTarget, wetShadowTarget, name, dryToWet);
            return Reflect.get(wetShadowTarget, name, wetReceiver);
          },

          set: function(wetShadowTarget, name, val, wetReceiver) {
            if (handler.onSet) {
              handler.onSet(wetShadowTarget, name, val, wetReceiver, dryTarget);  
            }
                        
            // no-invariant case:
            if (isConfigurable(dryTarget, name)) {
              // TODO: catch and wrap exceptions thrown from setter?
              return dryToWet(Reflect.set(dryTarget, name,
                                          wetToDry(val), wetToDry(wetReceiver)));
            }
            
            // general case:
            copy(dryTarget, wetShadowTarget, name, dryToWet);
            var success = Reflect.set(wetShadowTarget, name, val, wetReceiver);            
            if (success) {
              copy(wetShadowTarget, dryTarget, name, wetToDry);            
            }
            return success;
          },

          enumerate: function(wetShadowTarget) {
            if (handler.onEnumerate) {
              handler.onEnumerate(wetShadowTarget, dryTarget);
            }
            
            if (Object.isExtensible(wetShadowTarget)) {
              return Reflect.enumerate(dryTarget);
            }
            
            copyAll(dryTarget, wetShadowTarget, dryToWet);
            return Reflect.enumerate(wetShadowTarget);
          },

          keys: function(wetShadowTarget) {
            if (handler.onKeys) {
              handler.onKeys(wetShadowTarget, dryTarget);
            }
            
            if (Object.isExtensible(wetShadowTarget)) {
              return Reflect.keys(dryTarget);
            }
            
            copyAll(dryTarget, wetShadowTarget, dryToWet);
            return Reflect.keys(wetShadowTarget);
          },

          apply: function(wetShadowTarget, wetThisArg, wetArgs) {
            if (handler.onApply) {
              handler.onApply(wetShadowTarget, wetThisArg, wetArgs, dryTarget);
            }
            
            return Reflect.apply(wetShadowTarget, wetThisArg, wetArgs);
          },

          construct: function(wetShadowTarget, wetArgs) {
            if (handler.onConstruct) {
              handler.onConstruct(wetShadowTarget, wetArgs, dryTarget);              
            }
            
            return Reflect.construct(wetShadowTarget, wetArgs);
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
                                    dryToWetRef, wetToDryRef, dry2wetHandler);
    
    // note the reversed order of wetToDry and dryToWet:
    
    wetToDryRef.val = dryToWetMaker(wetToDryCache, dryToWetCache,
                                    wetToDryRef, dryToWetRef, wet2dryHandler);

    return {
      target: wetToDryRef.val(initWetTarget),
    };
  }; // end makeMembrane

  // trivial unit test, see ../test/membrane_test.js for more
  function testGenericMembrane() {
    load('../reflect.js');
    var wetTarget = {x: {y:2}};
    var interceptedGets = 0;
    var memHandler = {
      onGet: function(tgt, name, rcvr) {
        interceptedGets++;
      }
    };
    var membrane = makeGenericMembrane(wetTarget, memHandler, memHandler);
    var dryProxy = membrane.target;

    var dryFoo = dryProxy.x;
    assert(dryFoo.y === 2);
    assert(interceptedGets === 2);
    print('ok');
  }

  // testGenericMembrane();
  
  exports.makeGenericMembrane = makeGenericMembrane;
  
}(typeof exports !== "undefined" ? exports : this));