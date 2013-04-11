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

//  for Direct Proxies, load '../examples/membrane.js'
load('../reflect.js');
load('../examples/membrane.js');

//  for Notification Proxies, load '../notification/membrane.js'
//load('../notification/notify-reflect.js');
//load('../notification/membrane.js');

(function(){
  "use strict";
  
  var ARR_SIZE = 1000;
  
  function wrappedArrayLoop(wetArray, repeats) {
    
    for (var n = 0; n < repeats; n++) {
      
      var membrane = makeMembrane(wetArray);
      var dryArray = membrane.target;

      var total = 0;
      for (var i = 0; i < wetArray.length; i++) {
        var dryElt = dryArray[i];
        total += dryElt.nth;
      }
      
    }
    
    return total;
  }
  
  // benchmark 1: wrap a large array in a membrane, then
  // iterate over all of the elements from outside the membrane
  // this will create a membrane wrapper per retrieved element,
  // and tests the speed of property retrieval through a membrane
  function timeWrappedArrayLoop(repeats) {
    var wetArray = new Array(ARR_SIZE);
    for (var i = 0; i < ARR_SIZE; i++) {
      wetArray[i] = {nth: i};
    }
    
    var start = +(new Date());
    for (var n = 0; n < repeats; n++) {
      wrappedArrayLoop(wetArray, repeats); 
    }
    var elapsed = +(new Date()) - start;
    return elapsed / repeats;
  }
  
  // benchmark 2: same as benchmark 1, but with a frozen array
  function timeWrappedFrozenArrayLoop(repeats) {
    var wetArray = new Array(ARR_SIZE);
    for (var i = 0; i < ARR_SIZE; i++) {
      wetArray[i] = Object.freeze({nth: i});
    }
    Object.freeze(wetArray);
    
    var start = +(new Date());
    for (var n = 0; n < repeats; n++) {
      wrappedArrayLoop(wetArray, repeats); 
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
  // wrap it in a membrane, then do an in-order tree-walk
  // over the tree from outside the membrane.
  // On each tree node, invoke a method. This tests both property
  // retrieval and cross-membrane method calls
  function timeTree(repeats, depth) {
    var wetRoot = genTree(depth, function(x) { return x; });
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

  // benchmark 4: same as 3, but with a deep-frozen tree
  function timeFrozenTree(repeats, depth) {
    var wetRoot = genTree(depth, Object.freeze);
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

  var t1 = timeWrappedArrayLoop(10);  
  var t2 = timeWrappedFrozenArrayLoop(10);
  var t3 = timeTree(10, 10);
  var t4 = timeFrozenTree(10, 10);
  
  print('          array loop: ' + t1);
  print('   frozen array loop: ' + t2);
  print('       tree traverse: ' + t3);
  print('frozen tree traverse: ' + t4);
  
}());