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