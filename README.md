This is a shim for the ECMAScript 6 [reflection module](http://wiki.ecmascript.org/doku.php?id=harmony:reflect_api).

In a browser, after loading

    <script src="reflect.js"></script>

a global object `Reflect` is defined that contains the functions from the [ES6](http://people.mozilla.org/~jorendorff/es6-draft.html#sec-reflect-object) `reflect` module (see below).

The `Proxy` object is also updated to follow the latest [direct proxies](http://wiki.ecmascript.org/doku.php?id=harmony:direct_proxies) [spec](http://people.mozilla.org/~jorendorff/es6-draft.html#sec-proxy-factory-function). To create such a proxy, call:

    var proxy = new Proxy(target, handler)

If you are using node.js (>= v0.7.8), you can install via [npm](http://npmjs.org):

    npm install harmony-reflect

Then:

    node --harmony
    > require('harmony-reflect');

API
===

This module exports a single object named `Reflect`.

The ECMAScript 6 Proxy API allows one to intercept various operations on Javascript objects.

  * Overview of all [supported traps](https://github.com/tvcutsem/harmony-reflect/tree/master/doc/traps.md) on proxies
  * The [Reflect API](https://github.com/tvcutsem/harmony-reflect/tree/master/doc/api.md) 
  * The Proxy [Handler API](https://github.com/tvcutsem/harmony-reflect/tree/master/doc/handler_api.md)
  
Compatibility
=============

The `Reflect` API, with support for proxies, was tested on:

  * Firefox 12 (should work since Firefox 4)
  * Chrome 19, with the following flag enabled: `chrome://flags/#enable-javascript-harmony` (copy/paste into your address-bar)
  * `node --harmony` (in node v0.7.8)
  * `v8 --harmony` (on 3.11.0, should work since at least v3.6)
  * spidermonkey shell
  
Dependencies
============

  *  ECMAScript 5/strict
  *  To emulate direct proxies:
    *  old Harmony [Proxies](http://wiki.ecmascript.org/doku.php?id=harmony:proxies)
    *  Harmony [WeakMaps](http://wiki.ecmascript.org/doku.php?id=harmony:weak_maps)

After loading `reflect.js` into your page or other JS environment, be aware that the following globals are patched to be able to recognize emulated direct proxies:

    Object.{freeze,seal,preventExtensions}
    Object.{isFrozen,isSealed,isExtensible}
    Object.getPrototypeOf
    Object.prototype.valueOf
    Object.getOwnPropertyDescriptor
    Object.defineProperty
    Function.prototype.toString
    Date.prototype.toString
    Array.isArray
    Array.prototype.concat
    Proxy

Examples
========

The [examples](https://github.com/tvcutsem/harmony-reflect/tree/master/examples) directory contains a number of examples demonstrating the use of proxies:

  * membranes: wrappers that transitively isolate two object-graphs.
  * observer: a self-hosted implementation of the ES7 `Object.observe` notification mechanism.
  * profiler: a simple profiler to collect usage statistics of an object.

Other example uses of proxies (not done by me, but using this library):

  * supporting [negative array indices](https://github.com/sindresorhus/negative-array) a la Python
  * [tpyo](https://github.com/mathiasbynens/tpyo): using proxies to correct typo's in JS property names

Proxy Handler API
=================

The sister project [proxy-handlers](https://github.com/tvcutsem/proxy-handlers)
defines a number of predefined Proxy handlers as "abstract classes" that your 
code can "subclass" The goal is to minimize the number of traps that your proxy
handlers must implement.

Spec Compatibility
==================
  
This library differs from the draft ECMAScript 6 spec. as follows:

  * In ES6, `Proxy` will be a constructor function that will _require_ the use of `new`. That is, you must write `new Proxy(target, handler)`. This library exports `Proxy` as an ordinary function which may be called without using the `new` operator.
  * `Array.isArray(obj)` and `[].concat(obj)` are patched so they work transparently on proxies-for-arrays (e.g. when `obj` is `new Proxy([],{})`). It is as yet unclear how ES6 will spec these operations in the presence of proxies.