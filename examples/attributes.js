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
 * The Original Code is a demo of Direct Proxies
 *
 * The Initial Developer of the Original Code is
 * Tom Van Cutsem, Vrije Universiteit Brussel.
 * Portions created by the Initial Developer are Copyright (C) 2011-2012
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 */

/**
 * This code demoes how to store additional "expando" properties
 * of an object in a separate _attributes map, and how to make this work out
 * with inheritance.
 */

load('../reflect.js');

// auxiliaries to run in a shell (without a browser)
var console = {log:print};
function p(val) { console.log(JSON.stringify(val)) }

function AttributeProxy(target) {
  return Proxy(target, {
    get: function(target, name, receiver) {
      if (name in target) { return target[name]; }
      // everything not found on the target object itself should
      // be looked up in the target's _attributes map
      return target._attributes[name];
    },
    set: function(target, name, val, receiver) {
      if (name in target) {
        target[name] = val;
        return true;
      }
      // everything not found on the target object itself should
      // be added to the target's _attributes map
      target._attributes[name] = val;
      return true;
    }
  });
}

var Person = function() {
   this._attributes = {};
   return AttributeProxy(this);
};

Person.prototype.walk = function() {
  console.log('Person is walking');
};

var Female = function() {
  // call "super" constructor
  return Person.call(this);
}
// make Female inherit from Person
Female.prototype = Object.create(Person.prototype);
Female.prototype.shop = function() {
  console.log('Female is shopping');
}

// tests
var person = new Person();
person.hair = 'black';
person.walk(); // methods are called normally
p(person.hair) // black
p(person._attributes) // { 'hair' : 'black' }

var female = new Female();
female.hair = 'blonde';
female.walk(); // methods are called normally
female.shop(); // methods are called normally
p(female.hair) // blonde
p(female._attributes) // { 'hair' : 'blonde' }