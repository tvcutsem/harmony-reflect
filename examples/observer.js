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
 * The Original Code is an implementation of the Observe strawman
 *
 * The Initial Developer of the Original Code is
 * Tom Van Cutsem, Vrije Universiteit Brussel.
 * Portions created by the Initial Developer are Copyright (C) 2011-2012
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 */

/* This is a prototype implementation of the "Observe strawman proposal"
 * at http://wiki.ecmascript.org/doku.php?id=strawman:observe
 * as proposed by Rafael Weinstein, Erik Arvidsson and others
 */

// This script depends on reflect.js
// see https://raw.github.com/tvcutsem/harmony-reflect/master/reflect.js

// loading this script sets a single global variable, "Observer"
// to a function representing the observer module. To actually load the
// module, call the function, providing the global "Object" to which the
// module should add the observe, unobserve and getNotifier methods.
// The return value of the Observer module is a function that should be
// called by the embedder to fire all pending updates.
Observer = function Observer(Object) {
  
  // == Utilities for defineProperty trap ==
  
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
  
  
  // == Implementation of observe strawman starts here ==
  
  // names starting with a leading underscore (_)
  // correspond to spec-internal [[methods]]/[[properties]]

  // implementation-artefact to identify Observable objects
  // this is irrelevant for the actual strawman
  var _Observables = new WeakMap();
  
  // This list is used to provide a deterministic ordering
  // in which callbacks are called.
  var _ObserverCallbacks = [];
  
  // the following weakmaps all model private [[internal]] properties
  
  // stores a Notifier object's [[Target]] property
  var _NotifierTarget          = new WeakMap();
  // stores a Notifier object's [[ChangeObservers]] property
  var _NotifierChangeObservers = new WeakMap();
  // stores a Function object's [[PendingChangeRecords]] property
  var _FunctionPendingChangeRecords = new WeakMap();
  
  var _NotifierPrototype = Object.create(Object.prototype);
  Object.defineProperty(_NotifierPrototype, "notify", {
    value: function notifyFunction(changeRecord) {
      var notifier = this;
      if (Object(this) !== this) {
        throw new TypeError("this must be an Object, given "+this);
      }
      var target = _NotifierTarget.get(notifier);
      if (target === undefined) { return undefined; }
      var changeObservers = _NotifierChangeObservers.get(notifier);
      if (changeObservers === undefined) { return undefined; }
      var type = changeRecord.type;
      if (typeof type !== "string") {
        throw new TypeError("change record type must be a string, given "+type);
      }
      var newRecord = Object.create(Object.prototype);
      for (var propName in changeRecord) {
        if (propName == "object") { continue; }
        newRecord[propName] = changeRecord[propName];
      }
      newRecord.object = target;
      // Q: perhaps no longer necessary -> newRecord doesn't leak
      Object.preventExtensions(newRecord);
      _EnqueueChangeRecord(newRecord, changeObservers);
      return undefined;
    },
    writable: true,
    enumerable: false,
    configurable: false
  });
  
  function _CreateNotifier(target) {
    var notifier = Object.create(_NotifierPrototype);
    // target and changeObservers are not regular properties
    // but hidden [[internal]] properties. We hide them via a WeakMap.
    _NotifierTarget.set(notifier, target);
    _NotifierChangeObservers.set(notifier, []);
    return notifier;
  };
  
  function _EnqueueChangeRecord(changeRecord, changeObservers) {
    changeObservers.forEach(function (observer) {
      var pendingRecords = _FunctionPendingChangeRecords.get(observer);
      // Q: is pendingRecords guaranteed to exist?
      // A: yes, it is defined to be intially empty
      // In this implementation, lazily intialize it
      if (pendingRecords === undefined) {
        pendingRecords = [];
        _FunctionPendingChangeRecords.set(observer, pendingRecords);
      }
      pendingRecords.push(changeRecord);
    });
  };
  
  function _DeliverChangeRecords(callback) {
    var changeRecords = _FunctionPendingChangeRecords.get(callback) || [];
    _FunctionPendingChangeRecords.set(callback, []);
    var array = [];
    changeRecords.forEach(function (record) {
      array.push(record);
    });
    if (array.length === 0) { return false; }
    // Q: why suppress the callback's exception?
    // (A: because _DeliverChangeRecords is called synchronously
    //     for multiple observers -> if one throws, others won't get
    //     notified)
    // => would be cleaner to call every callback in a separate turn
    //    and let any exception propagate up to the console so we at
    //    least don't hide exceptions from the user
    try {
      callback.call(undefined, array);
    } catch (e) {
      // intentionally ignored
      console.log(e) // at least log the exception
    }
    return true;
  };
  
  // embedder will call this internal algorithm when it is time
  // to deliver the change records.
  // => in this embedding, done via #deliver button click;
  _DeliverAllChangeRecords = function() {
    var observers = _ObserverCallbacks;
    var anyWorkDone = false;
    observers.forEach(function (observer) {
      anyWorkDone = _DeliverChangeRecords(observer) || anyWorkDone;
    });
    // Q: shouldn't we clear _ObserverCallbacks now?
    // A: no, conceptually the list is never cleared to maintain
    // a consistent ordering
    return anyWorkDone;
  };
  
  function _CreateChangeRecord(type, object, name, desc) {
    var changeRecord = {
      type: type,
      object: object,
      name: name
    };
    if (isDataDescriptor(desc)) {
      changeRecord.oldValue = desc.value;
    }
    return changeRecord;
  };
  
  // == Public API ==
  
  // This function is not part of the proposed API!
  // The point of the proposed API would be that _all_ objects
  // are by default "observable". In this prototype implementation,
  // must explicitly create "observable objects".
  Object.createObservable = function(target) {
    if (Object(target) !== target) {
      throw new TypeError("target must be an Object, given "+target);
    }
    var proxy;
    
    // We want other traps, like 'set', to default to the custom
    // defineProperty algorithm specified below.
    // Therefore, our observable proxy handler just inherits from
    // Reflect.Handler, which implements the "derived" behavior
    // of "set", falling back to "this.defineProperty" where necessary
    // Additionally, when e.g. calling Object.freeze(observableProxy),
    // the inherited 'freeze' trap will invoke the defineProperty algorithm
    // for every reconfigured property, so when an object is frozen,
    // its observers get notified of the reconfigurations this entails.
    var handler = new Reflect.Handler();
    
    handler.notifier = undefined;
    
    handler.defineProperty = function(target, name, desc) {
        // all changes w.r.t. ES5.1 [[DefineOwnProperty]] highlighted
        // with /*!*/ in the margin
        var current = Object.getOwnPropertyDescriptor(target, name);
        var extensible = Object.isExtensible(target);
 /*!*/  var notifier = _GetNotifier(proxy);
 /*!*/  var changeObservers = _NotifierChangeObservers.get(notifier);
 /*!*/  var changeType = "reconfigured";
 /*!*/  var changeValue = current;
        if (current === undefined && extensible === false) {
          return false;
        }
        if (current === undefined && extensible === true) {
          Object.defineProperty(target, name, desc); // should never fail
          // FIXME: should pass "proxy" as second argument, passing
          // "target" instead to avoid recursion.
 /*!*/    var r = _CreateChangeRecord("new", target, name, undefined);
 /*!*/    _EnqueueChangeRecord(r, changeObservers);
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
          // no further validation is required
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
          // Q: spec says: if all of these are absent
          // I would want: if all of these are absent or unchanged
          // reason: if the attributes are the same, no actual reconfiguration
 /*!*/    if (!('writable' in desc) || sameValue(desc.writable, current.writable) &&
 /*!*/        !('enumerable' in desc) || sameValue(desc.enumerable, current.enumerable) &&
 /*!*/        !('configurable' in desc) || sameValue(desc.configurable, current.configurable)) {
 /*!*/      changeType = "updated";                
 /*!*/    }
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
        // FIXME: should pass "proxy" as second argument, passing
        // "target" instead to avoid recursion.
 /*!*/  var r = _CreateChangeRecord(changeType, target, name, current);
 /*!*/  _EnqueueChangeRecord(r, changeObservers);
        return true;
    };
            
    handler.deleteProperty = function(target, name) {
      var desc = Object.getOwnPropertyDescriptor(target, name);
      if (desc === undefined) { return true; }
      var notifier = _GetNotifier(proxy);
      var changeObservers = _NotifierChangeObservers.get(notifier);
      if (desc.configurable === true) {
        delete target[name];
        // FIXME: should pass "proxy" as second argument, passing
        // "target" instead to avoid recursion.
        var r = _CreateChangeRecord("deleted", target, name, desc);
        _EnqueueChangeRecord(r, changeObservers);
        return true;
      }
      return false;
    };
      
    proxy = Proxy(target, handler);
    _Observables.set(proxy, handler);
    return proxy;
  };
  
  function _GetNotifier(target) {
    var handler = _Observables.get(target);
    if (handler === undefined) {
      throw "can only get notifier of observable objects, given " + target;
    }
    if (handler.notifier === undefined) {
      handler.notifier = _CreateNotifier(target)      
    }
    return handler.notifier;
  }

  Object.observe = function(target, observer) {
    if (Object(target) !== target) {
      throw new TypeError("target must be an Object, given "+target);
    }
    if (typeof observer !== "function") {
      throw "observer must be a function, given " + observer;
    }
    // Q: why this check?
    // A: probably because frozen functions can't have
    // mutable [[PendingChangeRecords]]
    if (Object.isFrozen(observer)) {
      throw "observer can't be frozen";
    }
    var notifier = _GetNotifier(target);
    var changeObservers = _NotifierChangeObservers.get(notifier);
    if (changeObservers.indexOf(observer) !== -1) {
      return undefined;
    }
    changeObservers.push(observer);

    var observerCallBacks = _ObserverCallbacks;
    if (observerCallBacks.indexOf(observer) !== -1) {
      return undefined;
    }
    observerCallBacks.push(observer);
    return undefined;
  };
  
  Object.unobserve = function(target, observer) {
    if (Object(target) !== target) {
      throw new TypeError("target must be an Object, given "+target);
    }
    var notifier = _GetNotifier(target);
    var changeObservers = _NotifierChangeObservers.get(notifier);
    var index = changeObservers.indexOf(observer);
    if (index === -1) {
      return undefined;
    }
    changeObservers.splice(index, 1);
    // Q: shouldn't the observer be removed from _ObserverCallbacks as well?
    // A: no, _ObserverCallbacks is conceptually never cleared to maintain
    // a consistent ordering among callbacks
    return undefined;
  };
  
  Object.deliverChangeRecords = function(callback) {
    if (typeof callback !== "function") {
      throw "callback must be a function, given " + callback;
    }
    _DeliverChangeRecords(callback);
    return undefined;
  };
  
  Object.getNotifier = function(target) {
    if (Object(target) !== target) {
      throw new TypeError("target must be an Object, given "+target);
    }
    if (Object.isFrozen(target)) {
      return null;
    }
    return _GetNotifier(target);
  };
  
  // return value of the Observer module is a function
  // to be used by embedder to fire all pending updates
  return _DeliverAllChangeRecords;
};
