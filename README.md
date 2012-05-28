This is a shim for the ECMAScript-Harmony [reflection module](http://wiki.ecmascript.org/doku.php?id=harmony:reflect_api).

In a browser, after loading

    <script src="reflect.js"></script>

a global object `Reflect` is defined that contains the functions from the ES-Harmony `reflect` module (see below).

The `Proxy` object is also updated to follow the latest [direct proxies](http://wiki.ecmascript.org/doku.php?id=harmony:direct_proxies) spec. To create such a proxy, call:

    var proxy = Proxy(target, handler)
    
If you are using node.js (>= v0.7.8), you can install via [npm](http://npmjs.org):

    npm install harmony-reflect
    
Then:

    node
    > require('harmony-reflect');

API
===

The global `Reflect` object defines the following properties:

    // create a proxy handler that readily implements all traps
    Reflect.VirtualHandler() -> object

    // just an alias for the global Proxy object
    // the 'handler' object may define "traps", which have the
    // same name and method signature as the functions defined below
    Reflect.Proxy(target : object, handler : object) -> object

    // (type? stands for type | undefined)
    Reflect.getOwnPropertyDescriptor(target : object, name : string) -> object?
    
    Reflect.defineProperty(target : object, name : string, desc : object) -> bool
    
    Reflect.getOwnPropertyNames(target : object) -> array[string]
    
    Reflect.deleteProperty(target : object, name : string) -> bool
    
    Reflect.enumerate(target : object) -> array[string]
    
    Reflect.iterate(target : object) -> iterator
    
    Reflect.freeze(target : object) -> bool
    
    Reflect.seal(target : object) -> bool
    
    Reflect.preventExtensions(target : object) -> bool
    
    Reflect.has(target : object, name : string) -> bool
    
    Reflect.hasOwn(target : object, name : string) -> bool
    
    Reflect.keys(target : object) -> array[string]
    
    Reflect.get(target : object, name : string, receiver : object?) -> any
    
    Reflect.set(target : object, name : string, value : any, receiver : object?) -> bool
    
    Reflect.apply(target : object, receiver : object?, args : array) -> any
    
    Reflect.construct(target : object, args : array) -> any

Compatibility
=============

The `Reflect` API, with support for proxies, was tested on:

  * Firefox 12 (should work since Firefox 4)
  * Chrome 19, under [an experimental flag](http://www.2ality.com/2012/01/esnext-features.html)
  * spidermonkey shell
  * `v8 --harmony` (on 3.11.0, should work since at least v3.6)
  * `node --harmony` (in node v0.7.8)

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
    Proxy

Issues
======

See the list of [open issues](https://github.com/tvcutsem/harmony-reflect/issues).

Next steps
==========

  *  Provide fallback behavior for part of the API, for environments without Proxy or WeakMap support.
  *  More tests.
  *  Switch to qunit or other unit testing framework.
  *  Add example uses of proxies.
  *  More detailed API description.
