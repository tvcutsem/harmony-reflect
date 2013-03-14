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

load('notify-reflect.js');

// indent nested trap invocations
var indent = 0;

function log(/*...args*/) {
  var args = Array.prototype.slice.call(arguments);
  print(new Array(indent).join(" ") + JSON.stringify(args.join("  ")));
}

function logPreAndPost(/*...args*/) {
  var args = Array.prototype.slice.call(arguments);
  indent++;
  log("before", args);
  return function(/*target, ...args, result*/) {
    var result = arguments[arguments.length-1];
    log("after", result);
    indent--;
  }
}

// A generic logger notification proxy handler that just logs every
// operation applied to it (before and after)
// note: onGet and onSet do not log the receiver to avoid infinite recursion
// because of touching the proxy in the traps themselves
var LoggingHandler = {
  onGetOwnPropertyDescriptor: function(target,name) {
    return logPreAndPost("onGetOwnPropertyDescriptor", target, name);
  },
  onGetOwnPropertyNames:      function(target) {
    return logPreAndPost("onGetOwnPropertyNames", target);
  },
  onGetPrototypeOf:           function(target) {
    return logPreAndPost("onGetPrototypeOf", target);
  },
  onDefineProperty:           function(target,name, desc) {
    return logPreAndPost("onDefineProperty", target,name,desc);
  },
  onDeleteProperty:           function(target,name) {
    return logPreAndPost("onDeleteProperty", target,name);
  },
  onFreeze:                   function(target) {
    return logPreAndPost("onFreeze", target);
  },
  onSeal:                     function(target) {
    return logPreAndPost("onSeal", target);
  },
  onPreventExtensions:        function(target) {
    return logPreAndPost("onPreventExtensions", target);
  },
  onIsFrozen:                 function(target) {
    return logPreAndPost("onIsFrozen", target);
  },
  onIsSealed:                 function(target) {
    return logPreAndPost("onIsSealed", target);
  },
  onIsExtensible:             function(target) {
    return logPreAndPost("onIsExtensible", target);
  },
  onHas:                      function(target,name) {
    return logPreAndPost("onHas", target,name);
  },
  onHasOwn:                   function(target,name) {
    return logPreAndPost("onHasOwn", target,name);
  },  
  onGet:                      function(target,name,receiver) {
    return logPreAndPost("onGet", target,name);
  },
  onSet:                      function(target,name,val,receiver) {
    return logPreAndPost("onSet", target,name,val);
  },
  onEnumerate:                function(target) {
    return logPreAndPost("onEnumerate", target);
  },
  onKeys:                     function(target) {
    return logPreAndPost("onKeys", target);
  },
  onApply:                    function(target,thisArg,args) {
    return logPreAndPost("onApply", target, thisArg, args);
  },
  onConstruct:                function(target,args) {
    return logPreAndPost("onConstruct", target, args);
  }
};

function makeLoggingProxy(target) {
  return new Proxy(target, LoggingHandler);
}

function makeGenericLoggingProxy(target) {
  return new Proxy(target,
    new Proxy({
        onGet: function(tgt,name,rcvr) {
          return logPreAndPost("onGet", tgt,name); 
        },
        onSet: function(tgt, name, val, rcvr) {
          return logPreAndPost("onSet", tgt,name,val); 
        }
      }, {
      onGet: function(stash, trapName) {
        if (!(trapName in stash)) {
          stash[trapName] = logPreAndPost.bind(undefined, trapName);
          return function(/*...args*/) {
            delete stash[trapName];
          }       
        }
      }
    }))
}

// a function that just applies all interceptable operations to a target object,
// presumably a proxy
function applyAllOps(proxy) {
  var name = "foo";
  var val = 42;
  var desc = {value:val,writable:true,enumerable:true,configurable:true};
  
  Object.defineProperty(proxy,name,desc)
  
  var desc2 = Object.getOwnPropertyDescriptor(proxy,name);
  
  var ownNames = Object.getOwnPropertyNames(proxy);
  
  var proto = Object.getPrototypeOf(proxy);
  
  delete proxy[name]
  
  var hasResult = name in proxy

  var hasOwnResult = ({}).hasOwnProperty.call(proxy,name)
  
  var getResult = proxy[name];
  
  proxy[name] = val;
  
  var enumKeys = [];
  for (name in proxy) {
    enumKeys.push(name);
  }
  
  var ownKeys = Object.keys(proxy);
  
  var applyResult = proxy(1,2,3)
  var constructResult = new proxy(1,2,3) 
  
  Object.preventExtensions(proxy)
  Object.seal(proxy)
  Object.freeze(proxy) 
}


var target = function(a,b) { return a+b; };
target.toString = function() { return "<the target>"; }

// applyAllOps(makeLoggingProxy(target));
applyAllOps(makeGenericLoggingProxy(target));