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
 * A "boundary" abstraction implemented using generic membranes, based
 * on the paper:
 *
 * Ownership, Filters & Crossing Handlers, Wernli et al, DLS 2012
 *
 * For background, see the `README.md` file.
 *
 * @author tvcutsem
 */

// require('reflect.js')
// require('examples/generic_membrane.js')

(function(exports){
  "use strict";
  
  function abort(fun, inOrOut, filters) {
    // TypeError: method 'toString' does not match boundary
    // in-filters '[]' ('toString' is not classified)
    var errString = "method '"+fun.name+"' does not match boundary " +
                    inOrOut + "-filters "+filters+" ('"+fun.name+"' is " +
                    (fun.__class__ ? "classified as "+fun.__class__ : "not classified") + ")";
    throw new TypeError(errString);
  }
  
  // returns whether or not fun adheres to the specified set of filters
  // fun is assumed to be a membrane wrapper function
  function filter(fun, inOrOut, filters) {
    //DEBUG: if (fun.name === "toString") throw new Error("");
    // DEBUG: print('filter: '+fun.name+','+inOrOut+','+filters);
      
    var res;
    
    if (filters === '*') {
      return true;
    }
    
    if (typeof filters === "string") {
      if (res = filters.match(/^\.(.*)$/)) {
        var cls = res[1];
        if (fun.__class__ === undefined) {
          return false;
        }
        if (typeof fun.__class__ === "string") {
          return (fun.__class__ === cls);
        }
        if (Array.isArray(fun.__class__)) {
          return fun.__class__.some(function(funcls) { cls === funcls; });
        }
        throw new TypeError("illegal class for function '"+fun.name+"': "+fun.__class__);
      } else if (res = filters.match(/^#(.*)$/)) {
        var clsname = res[1];
        return (fun.name === clsname);
      } else {
        throw new TypeError("illegal filter on function '"+fun.name+
                            "': '" + filters +"' (type: "+typeof filters+")");        
      }
    }
    
    if (Array.isArray(filters)) {
      return filters.some(function(fil) {
        return filter(fun, inOrOut, fil);
      });
    }
    
    throw new TypeError("illegal filter on function '"+fun.name+
                        "': '" + filters +"' (type: "+typeof filters+")");
  }
  
  function boundaryHandler(inOrOut, filters) {
    return {
      onApply: function(wetTarget, args, receiver, dryTarget) {
        if (!filter(dryTarget, inOrOut, filters)) {
          abort(dryTarget, inOrOut, filters);
        }
      }
    };
  }
  
  function Boundary(options) {
    var inFilters = options.in || '*';
    var outFilters = options.out || '*';
    var entry = options.entry;
    if (entry === undefined) {
      throw new TypeError("no entry given for boundary");      
    } 
    
    var membrane = makeGenericMembrane(entry, boundaryHandler("in", inFilters),
                                              boundaryHandler("out", outFilters));
    return {
      in: inFilters,
      out: outFilters,
      entry: membrane.target
    };
  }
  
  exports.Boundary = Boundary;
  
  Function.prototype.class = function(filter) {
    this.__class__ = filter;
    return this;
  }
  
}(typeof exports !== "undefined" ? exports : this));