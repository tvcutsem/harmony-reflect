[![NPM version](https://badge.fury.io/js/harmony-reflect.svg)](http://badge.fury.io/js/harmony-reflect) [![Dependencies](https://david-dm.org/tvcutsem/harmony-reflect.png)](https://david-dm.org/tvcutsem/harmony-reflect)

This is a shim for the ECMAScript 6 [Reflect](http://people.mozilla.org/~jorendorff/es6-draft.html#sec-reflect-object) and [Proxy](http://people.mozilla.org/~jorendorff/es6-draft.html#sec-proxy-objects) objects.

Read [Why should I use this library?](https://github.com/tvcutsem/harmony-reflect/wiki)

Installation
============

In a browser, after loading

    <script src="reflect.js"></script>

a global object `Reflect` is defined that contains reflection methods as defined in the [ES6 draft](http://people.mozilla.org/~jorendorff/es6-draft.html#sec-reflect-object).

If your browser supports the "harmony-era" `Proxy` object that predates ES6 (i.e. Firefox or Chrome), that `Proxy` object is also updated to follow the latest [direct proxies](http://wiki.ecmascript.org/doku.php?id=harmony:direct_proxies) [spec](http://people.mozilla.org/~jorendorff/es6-draft.html#sec-proxy-objects). To create such a proxy, call:

    var proxy = new Proxy(target, handler)

If you are using node.js (>= v0.7.8), you can install via [npm](http://npmjs.org):

    npm install harmony-reflect

Then:

    node --harmony
    > var Reflect = require('harmony-reflect');

See [release notes](https://github.com/tvcutsem/harmony-reflect/blob/master/RELNOTES.md) for changes to the npm releases.

API Docs
========

This module exports an object named `Reflect` and updates the global `Proxy` object (if it exists) to be compatible with the latest ECMAScript 6 spec.

The ECMAScript 6 Proxy API allows one to intercept various operations on Javascript objects.

  * Overview of all [supported traps](https://github.com/tvcutsem/harmony-reflect/tree/master/doc/traps.md) on proxies
  * The [Reflect API](https://github.com/tvcutsem/harmony-reflect/tree/master/doc/api.md) 
  * The Proxy [Handler API](https://github.com/tvcutsem/harmony-reflect/tree/master/doc/handler_api.md)
  
Compatibility
=============

The `Reflect` API, with support for proxies, was tested on:

  * Firefox (>= v4.0)
  * Chrome (>= v19 && <= v37), with the following flag enabled: `chrome://flags/#enable-javascript-harmony` (copy/paste into your address-bar)
  * `node --harmony` (>= v0.7.8)

Note: Chrome v38 seems to have [removed](https://code.google.com/p/v8/issues/detail?id=1543#c44)
the `Proxy` constructor. As a result, this library cannot patch the harmony-era `Proxy` object on
Chrome v38. If you're working with chromium directly, it's still possible to enable proxies using
`chromium-browser --js-flags="--harmony_proxies"`.

You can also run the code in one of the following headless JavaScript shells:

  * `v8 --harmony` (>= v3.6)
  * Any recent `js` spidermonkey shell

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
    Object.keys
    Object.prototype.valueOf
    Object.prototype.hasOwnProperty
    Object.getOwnPropertyDescriptor
    Object.defineProperty
    Object.getOwnPropertyNames
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
  * [persistent objects](http://tagtree.tv/es6-proxies): shows how one might go about using proxies to save updates to objects in a database incrementally

For more examples of proxies, and a good overview of their design rationale, I recommend reading [Axel Rauschmayer's blog post on proxies](http://www.2ality.com/2014/12/es6-proxies.html).

Proxy Handler API
=================

The sister project [proxy-handlers](https://github.com/tvcutsem/proxy-handlers)
defines a number of predefined Proxy handlers as "abstract classes" that your 
code can "subclass" The goal is to minimize the number of traps that your proxy
handlers must implement.

Spec Compatibility
==================

This library differs from the [rev 27 (august 2014) draft ECMAScript 6 spec](http://wiki.ecmascript.org/doku.php?id=harmony:specification_drafts#august_24_2014_draft_rev_27) as follows:

  * In ES6, `Proxy` will be a constructor function that will _require_ the use
    of `new`. That is, you must write `new Proxy(target, handler)`. This library
    exports `Proxy` as an ordinary function which may be called with or without using the `new` operator.
  * `Array.isArray(obj)` and `[].concat(obj)` are patched so they work
    transparently on proxies-for-arrays (e.g. when `obj` is `new Proxy([],{})`).
    The current ES6 draft spec [does not treat proxies-for-arrays as genuine
    arrays for these operations](https://esdiscuss.org/topic/array-isarray-new-proxy-should-be-false-bug-1096753). Update (Nov. 2014): it looks like the ES6 spec will change so that `Array.isArray` and other methods that test for arrayness will work transparently on proxies, so this shim's behavior will become the standardized behavior.