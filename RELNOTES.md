v1.4.6
======

Release date: April 19th, 2016

  * ES6 `Object.assign(...args)` would fail when one of the arguments is a Proxy object. Patched `Object.assign` to fall back on an ES5 shim when at least one of the arguments is a Proxy object (See issue #72).

v1.4.5
======

Release date: April 5th, 2016

  * Patched `Object.getOwnPropertySymbols(proxy)` to always return `[]` (only if the ES6 global `Object.getOwnPropertySymbols` exists). Symbols are not supported by this shim, but at least this patch stops code that tries to get the own symbol-valued properties of a proxy from crashing. (See issue #71).
  
v1.4.4
======

Release date: March 19th, 2016

  * Minor bugfix in `Reflect.construct()`.
  * Removed deprecation notice when unpatched `Object.getOwnPropertyNames(proxy)` used in external modules would still trigger the old `getOwnPropertyNames` trap (See issue #66).

v1.4.3
======

Release date: March 17th, 2016

  * `Reflect.construct()` now works on ES6 classes (See issue #69).
  * The patched `__proto__` set accessor now converts the argument prototype to an Object. This fixes issue #67 (tab-completion in node.js no longer crashes when this module is loaded).

v1.4.2
======

Release date: August 30th, 2015

  * This library now leaves the `Proxy` global untouched (rather
    than overwriting it with a dummy function) if it exists but
    does not implement the old Proxy API (such as IE Edge).
    See issue #59.
  * Clarified incompatibility of this library with ES6 Symbols in
    the README.

v1.4.0
======

Release date: July 2nd, 2015

  * The patched `Proxy` object exported by this library now leaves
    the old `Proxy.create` and `Proxy.createFunction` untouched, so
    old code that needs it can still use it. Also, this makes the
    library robust against multiple versions of itself being loaded.
    See issue #56.

v1.3.1
======

Release date: June 21st, 2015

  * The `Proxy` object is only patched if `Proxy.create` exists.

v1.3.0
======

Release date: May 28th, 2015

New features:

  * `Object.defineProperties` is patched and will trigger the `defineProperty` trap when called on a proxy. See issue #51.

Bugfixes:

  * `Object.defineProperty(o,p,desc)` now returns `o` (as per ES5 spec) rather than a boolean success value.

v1.2.1
======

Release date: May 20th, 2015

Minor changes:

  * Calling the unpatched, native `Object.getOwnPropertyNames` method on a proxy
    now redirects to that proxy's `ownKeys` trap rather than failing with a TypeError. See issue #48.

v1.2.0
======

Release date: May 11th, 2015

  * `Reflect.construct` now takes third optional `newTarget` parameter, as per ES6 draft April 3, 2015.

v1.1.2
======

Release date: march 13th, 2015

Minor bugfix:

  * `delete` now works on a proxy for a proxy (issue #46)

v1.1.1
======

Release date: november 14th, 2014

Minor bugfixes:

  * `Reflect.enumerate(aProxy)` now works as intended (issue #43)
  * Patched `Object.freeze(obj)` now returns `obj` rather than a boolean (issue #42)

v1.1.0
======

Release date: august 29th, 2014

Improved compliance with August 24, 2014 (Rev 27) ECMAScript 6th edition draft standard.

  * Removed `Reflect.getOwnPropertyNames` and the `getOwnPropertyNames` proxy trap.
    Use `Reflect.ownKeys` and the `ownKeys` trap instead.
  * `Reflect.ownKeys` now returns an array of strings (rather than an ES6 iterator)
  * `ownKeys` trap now checks various invariants previously checked by the
    `getOwnPropertyNames` trap.
  * `Object.keys(proxy)` now triggers `ownKeys` trap, which checks invariants, so the result
    of `Object.keys(proxy)` is again reliable.
  
v1.0.0
======

Warning: this version contains multiple backwards-incompatible changes compared
to v0.0.13 to improve compatibility with the final ES6 spec.
Changes compared to v0.0.13:

  * Improved compliance with May 22 ECMAScript 6th edition draft standard.
  * Removed deprecated Reflect methods and corresponding Proxy traps:
    * `Reflect.hasOwn`
    * `Reflect.keys`
    * `Reflect.freeze`
    * `Reflect.seal`
    * `Reflect.isFrozen`
    * `Reflect.isSealed`
    * `Reflect.iterate`
  * `Reflect.getOwnPropertyNames` no longer marked deprecated (not yet
    reflected in the May 22 draft, but `[[GetOwnPropertyNames]]` should
    return as a built-in operation on objects and proxies).
  * `Reflect.enumerate` and the `enumerate` trap now return an ES6 iterator
    rather than an array.
  * `Reflect.ownKeys` iterator uses new ES6 iterator protocol (next/done/value
    rather than next/StopIteration API).
  * Removed `Reflect.Proxy`. Use the global `Proxy` instead.