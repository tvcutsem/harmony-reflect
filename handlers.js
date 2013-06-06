// Copyright (C) 2011-2013 Software Languages Lab, Vrije Universiteit Brussel
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

// This file implements the Handler API spec at:
// http://wiki.ecmascript.org/doku.php?id=harmony:virtual_object_api

// it relies on direct proxies (as provided by reflect.js)

// it augments the Reflect object with three bindings:
//  DelegatingHandler
//  ForwardingHandler
//  VirtualHandler

// differences with the wiki page:
//  - invoke(), getOwnPropertyKeys() traps not yet implemented

(function(global) { // function-as-module pattern
  "use strict";

  // require("reflect.js")
  if (typeof Reflect === "undefined") {
    throw new Error("require Reflect module");
  }

// == auxiliaries ==

// ---- Normalization functions for property descriptors ----
// (copied from reflect.js)

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

// == handler definitions ==

// === DelegatingHandler ===

function forward(name) {
  return function(/*...args*/) {
    var args = Array.prototype.slice.call(arguments);
    return Reflect[name].apply(undefined, args);
  };
}

function DelegatingHandler() { };
DelegatingHandler.proxyFor = function(target /*,...args*/) {
  var args = Array.prototype.slice.call(arguments, 1);
  return new Proxy(target, Reflect.construct(this, args));
};
DelegatingHandler.revocableProxyFor = function(target /*,...args*/) {
  var args = Array.prototype.slice.call(arguments, 1);
  return Proxy.revocable(target, Reflect.construct(this, args));
};
 
DelegatingHandler.prototype = {
  // fundamental traps
  getOwnPropertyDescriptor: forward("getOwnPropertyDescriptor"),
  getOwnPropertyNames:      forward("getOwnPropertyNames"),
  getOwnPropertyKeys:       forward("getOwnPropertyKeys"),
  getPrototypeOf:           forward("getPrototypeOf"),
  setPrototypeOf:           forward("setPrototypeOf"),
  defineProperty:           forward("defineProperty"),
  deleteProperty:           forward("deleteProperty"),
  preventExtensions:        forward("preventExtensions"),
  apply:                    forward("apply"),
 
  // derived traps
  has: function(target, name) {
    var desc = this.getOwnPropertyDescriptor(target, name);
    desc = normalizeAndCompletePropertyDescriptor(desc);
    if (desc !== undefined) {
      return true;
    }
    var proto = this.getPrototypeOf(target);
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
    var desc = this.getOwnPropertyDescriptor(target, name);
    desc = normalizeAndCompletePropertyDescriptor(desc);
    if (desc === undefined) {
      var proto = this.getPrototypeOf(target);
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
    var ownDesc = this.getOwnPropertyDescriptor(target, name);
    ownDesc = normalizeAndCompletePropertyDescriptor(ownDesc);
    if (isDataDescriptor(ownDesc)) {
      if (!ownDesc.writable) return false;
    }
    if (isAccessorDescriptor(ownDesc)) {
      if(ownDesc.set === undefined) return false;
      ownDesc.set.call(receiver, value);
      return true;
    }
    var proto = this.getPrototypeOf(target);
    if (proto === null) {
      var receiverDesc = Object.getOwnPropertyDescriptor(receiver, name);
      if (isAccessorDescriptor(receiverDesc)) {
        if(receiverDesc.set === undefined) return false;
        receiverDesc.set.call(receiver, value);
        return true;
      }
      if (isDataDescriptor(receiverDesc)) {
        if (!receiverDesc.writable) return false;
        Object.defineProperty(receiver, name, {value: value});
        return true;
      }
      if (!Object.isExtensible(receiver)) return false;
      Object.defineProperty(receiver, name,
        { value: value,
          writable: true,
          enumerable: true,
          configurable: true });
      return true;
    } else {
      return Reflect.set(proto, name, value, receiver);
    }
  },
  enumerate: function (target) {
    var result = [];
    
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
    var proto = this.getPrototypeOf(target);
    if (proto === null) {
      return result;
    }
    var parentResult = Reflect.enumerate(proto);
    // TODO: filter out duplicates
    result.concat(parentResult);
    return result;
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
  },
 
  // deprecated traps:
 
  seal: function(target) {
    var success = this.preventExtensions(target);
    success = !!success; // coerce to Boolean
    if (success) {
      var props = this.getOwnPropertyNames(target);
      var l = +props.length;
      for (var i = 0; i < l; i++) {
        var name = props[i];
        success = success && this.defineProperty(target,name,{configurable:false});
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
        if (IsAccessorDescriptor(desc)) {
          success = success &&
            this.defineProperty(target,name,{writable:false,configurable:false});
        } else if (desc !== undefined) {
          success = success &&
            this.defineProperty(target,name,{configurable:false});
        }
      }
    }
    return success;
  },
  isSealed: function(target) {
    if (this.isExtensible(target)) {
      return false;
    }
    var props = this.getOwnPropertyNames(target);
    return props.every(function(name) {
      return !this.getOwnPropertyDescriptor(target,name).configurable;
    }, this);
  },
  isFrozen: function(target) {
    if (this.isExtensible(target)) {
      return false;
    }
    var props = this.getOwnPropertyNames(target);
    return props.every(function(name) {
      var desc = this.getOwnPropertyDescriptor(target,name);
      return !desc.configurable && ("writable" in desc ? !desc.writable : true);
    }, this);
  },
};

// === ForwardingHandler ===

function ForwardingHandler() {
  DelegatingHandler.call(this); // not strictly necessary
}
ForwardingHandler.prototype = Object.create(DelegatingHandler.prototype);
ForwardingHandler.prototype.get = function(target, name, receiver) {
  var desc = this.getOwnPropertyDescriptor(target, name);
  desc = normalizeAndCompletePropertyDescriptor(desc);
  if (desc === undefined) {
    var proto = this.getPrototypeOf(target);
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
  return desc.get.call(target);
};
ForwardingHandler.prototype.set = function(target, name, value, receiver) {
  var ownDesc = this.getOwnPropertyDescriptor(target, name);
  ownDesc = normalizeAndCompletePropertyDescriptor(ownDesc);
  if (isDataDescriptor(ownDesc)) {
    if (!ownDesc.writable) return false;
  }
  if (isAccessorDescriptor(ownDesc)) {
    if(ownDesc.set === undefined) return false;
    ownDesc.set.call(target, value);
    return true;
  }
  var proto = this.getPrototypeOf(target);
  if (proto === null) {
    var receiverDesc = Object.getOwnPropertyDescriptor(receiver, name);
    if (isAccessorDescriptor(receiverDesc)) {
      if(receiverDesc.set === undefined) return false;
      receiverDesc.set.call(target, value);
      return true;
    }
    if (isDataDescriptor(receiverDesc)) {
      if (!receiverDesc.writable) return false;
      Object.defineProperty(receiver, name, {value: value});
      return true;
    }
    if (!Object.isExtensible(receiver)) return false;
    Object.defineProperty(receiver, name,
      { value: value,
        writable: true,
        enumerable: true,
        configurable: true });
    return true;
  } else {
    return Reflect.set(proto, name, value, receiver);
  }
};

// === VirtualHandler ===

function abstract(name) {
  return function(/*...args*/) {
    throw new TypeError(name + " not implemented");
  };
}
function VirtualHandler() {
  DelegatingHandler.call(this); // not strictly necessary
}
VirtualHandler.prototype = Object.create(DelegatingHandler.prototype);
VirtualHandler.prototype.getOwnPropertyDescriptor = abstract("getOwnPropertyDescriptor");
VirtualHandler.prototype.getOwnPropertyNames      = abstract("getOwnPropertyNames");
VirtualHandler.prototype.getOwnPropertyKeys       = abstract("getOwnPropertyKeys");
VirtualHandler.prototype.getPrototypeOf           = abstract("getPrototypeOf");
VirtualHandler.prototype.setPrototypeOf           = abstract("setPrototypeOf");
VirtualHandler.prototype.defineProperty           = abstract("defineProperty");
VirtualHandler.prototype.deleteProperty           = abstract("deleteProperty");
VirtualHandler.prototype.preventExtensions        = abstract("preventExtensions");
VirtualHandler.prototype.apply                    = abstract("apply");

// == export bindings ==

Reflect.DelegatingHandler = DelegatingHandler;
Reflect.ForwardingHandler = ForwardingHandler;
Reflect.VirtualHandler = VirtualHandler;  

}(typeof exports !== 'undefined' ? global : this)); // function-as-module pattern