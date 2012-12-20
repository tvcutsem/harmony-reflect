// Copyright (C) 2012 Software Languages Lab, Vrije Universiteit Brussel
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
 * The Original Code is a series of unit tests for the ES-harmony reflect module.
 *
 * The Initial Developer of the Original Code is
 * Tom Van Cutsem, Vrije Universiteit Brussel.
 * Portions created by the Initial Developer are Copyright (C) 2012
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 */
// for node.js
if(typeof require === 'function') {
  var load = require;
  var print = function(msg) {
    if(/^fail/.test(msg)) { console.error(msg); }
    else { console.log(msg); }
  }
}
load('../reflect.js');

function assert(b, msg) {
  print((b ? 'success: ' : 'fail: ') + msg);
}

function assertThrows(message, fn) {
  try {
    fn();
    print('fail: expected exception, but succeeded. Message was: '+message);
  } catch(e) {
    assert(e.message === message, "assertThrows: "+e.message);
  }
}

// the 'main' function
function test() {
  
  (function(){
    // https://github.com/tvcutsem/harmony-reflect/issues/11
    function f() {}
    var p = Proxy(f, {});
    var proto = {};
    p.prototype = proto;
    assert(p.prototype === proto, 'prototype changed via p');
    assert(f.prototype === proto, 'prototype changed via f');
  }());
  
}

if (typeof window === "undefined") {
  test();
}