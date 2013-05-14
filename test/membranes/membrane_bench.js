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

// ----------------------------------------------------------------------------

/**
 * Benchmark comparing membranes implemented using Direct Proxies vs
 * Notification Proxies. Run in a shell.
 *
 * @author tvcutsem
 */

//  for Direct Proxies, load:
//load('../../reflect.js');
//load('../../examples/membrane.js');

//  for Notification Proxies, load:
load('../../notification/notify-reflect.js');
load('../../notification/membrane.js');

(function(global){
  "use strict";
  
  // initialize an array [0,1,2,3,...,size-1]
  // f is either the identity function or Object.freeze
  function buildArray(size, f) {
    var arr = new Array(size);
    for (var i = 0; i < size; i++) {
      arr[i] = f({nth: i});
    }
    return f(arr);
  }
  
  // benchmark 1: wrap a large array in a membrane, then
  // iterate over all of the elements from outside the membrane
  // this will create a membrane wrapper per retrieved element,
  // and tests the speed of property retrieval through a membrane
  function timeWrappedArrayLoop(size, repeats, f) {
    var wetArray = buildArray(size, f);
    
    var start = +(new Date());
    for (var n = 0; n < repeats; n++) {
      
      (function(){
        var membrane = makeMembrane(wetArray);
        var dryArray = membrane.target;

        var total = 0;
        for (var i = 0; i < wetArray.length; i++) {
          var dryElt = dryArray[i];
          total += dryElt.nth;
        }
        return total;
      }());
      
    }
    
    var elapsed = +(new Date()) - start;
    return elapsed / repeats;
  }
  
  function genTree(depth, f) {
    return f({
      left: (depth > 0) ? genTree(depth-1, f): null,
      right: (depth > 0) ? genTree(depth-1, f): null,
      depth: function() { return depth; }
    });
  }
  
  function traverse(tree) {
    var l = (tree.left !== null) ? traverse(tree.left) : 0;
    var r = (tree.right !== null) ? traverse(tree.right) : 0;
    return tree.depth() + l + r;
  }
  
  // benchmark 3: build a balanced binary tree of depth d,
  // wrap it in a membrane, then do a post-order tree-walk
  // over the tree from outside the membrane.
  // On each tree node, invoke a method. This tests both property
  // retrieval and cross-membrane method calls
  function timeTree(repeats, depth, f) {
    var wetRoot = genTree(depth, f);
    var membrane = makeMembrane(wetRoot);
    var dryRoot = membrane.target;
    var total;
    
    var start = +(new Date());
    for (var n = 0; n < repeats; n++) {
      
      total = traverse(dryRoot);
      
    }
    var elapsed = +(new Date()) - start;
    return elapsed / repeats;
  }

  global.runBench = function() {
    var ARR_SIZ = 1000;  // array of length 1000
    var TREE_DEPTH = 10; // tree of depth 10 = 1023 nodes (2^10 -1)
    var identity = function(x) { return x; };

    var t1 = timeWrappedArrayLoop(ARR_SIZ, 10, identity);  
    // benchmark 2: same as 1, but with a deep-frozen array
    var t2 = timeWrappedArrayLoop(ARR_SIZ, 10, Object.freeze);

    var t3 = timeTree(TREE_DEPTH, 10, identity);  
    // benchmark 4: same as 3, but with a deep-frozen tree
    var t4 = timeTree(TREE_DEPTH, 10, Object.freeze);

    print('          array loop: ' + t1);
    print('   frozen array loop: ' + t2);
    print('       tree traverse: ' + t3);
    print('frozen tree traverse: ' + t4);
  }
  
  if (typeof window === "undefined") {
    runBench();
  }
  
}(this));