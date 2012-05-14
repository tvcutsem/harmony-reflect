This is a shim for the ECMAScript-Harmony [reflection module](http://wiki.ecmascript.org/doku.php?id=harmony:reflect_api).

After loading `reflect.js`, the following methods/objects are patched to be able to recognize emulated direct proxies:

    Object.{freeze,seal,preventExtensions}
    Object.{isFrozen,isSealed,isExtensible}
    Object.getPrototypeOf
    Object.prototype.valueOf
    Proxy

In addition, a global object `Reflect` is defined that houses the functions from the ES-Harmony `reflect` module.

The `Reflect` object defines `Reflect.Proxy` which implements [direct proxies](http://wiki.ecmascript.org/doku.php?id=harmony:direct_proxies). To create a direct proxy, call:

    var proxy = Proxy(target, handler)

API
===

The global `Reflect` object defines the following properties:

    function Proxy(target : object, handler : object) -> object
    
    function VirtualHandler() -> object
    
    // each of the following functions corresponds
    // one-to-one with a Proxy trap from the handler API
    // (type? stands for type | undefined)
    
    function getOwnPropertyDescriptor(target : object, name : string) -> object?
    
    function defineProperty(target : object, name : string, desc : object) -> bool
    
    function getOwnPropertyNames(target : object) -> array[string]
    
    function deleteProperty(target : object, name : string) -> bool
    
    function enumerate(target : object) -> array[string]
    
    function iterate(target : object) -> iterator
    
    function freeze(target : object) -> bool
    
    function seal(target : object) -> bool
    
    function preventExtensions(target : object) -> bool
    
    function has(target : object, name : string) -> bool
    
    function hasOwn(target : object, name : string) -> bool
    
    function keys(target : object) -> array[string]
    
    function get(target : object, name : string, receiver : object?) -> any
    
    function set(target : object, name : string, value : any, receiver : object?) -> bool
    
    function apply(target : object, receiver : object?, args : array) -> any
    
    function construct(target : object, args : array) -> any

Dependencies
============

  *  ECMAScript 5/strict
  *  To emulate direct proxies:
    *  old Harmony [Proxies](http://wiki.ecmascript.org/doku.php?id=harmony:proxies)
    *  Harmony [WeakMaps](http://wiki.ecmascript.org/doku.php?id=harmony:weak_maps)

Compatibility
=============

The `Reflect` API, with support for proxies, was tested on:

  * Firefox 12 (should work since Firefox 4)
  * spidermonkey shell
  * `v8 --harmony_proxies --harmony_weakmaps` (on 3.11.0, should work since at least v3.6)

Next steps
==========

  *  Provide fallback behavior for part of the API, for environments without Proxy or WeakMap support.
  *  More tests.
  *  Switch to qunit or other unit testing framework.
  *  Add example uses of proxies.
  *  More detailed API description.
