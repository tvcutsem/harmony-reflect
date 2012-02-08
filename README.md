This is a shim for the ECMAScript-Harmony [reflection module](http://wiki.ecmascript.org/doku.php?id=harmony:reflect_api).

After loading `reflect.js`, the following methods/objects are patched:

    Object.{freeze,seal,preventExtensions}
    Object.{isFrozen,isSealed,isExtensible}
    Object.getPrototypeOf
    Object.prototype.valueOf
    Proxy

In addition, a global object `Reflect` is defined that houses the functions from the ES-Harmony `reflect` module.

The global `Proxy` object is patched so that it now supports [direct proxies](http://wiki.ecmascript.org/doku.php?id=harmony:direct_proxies):

    var proxy = Proxy(target, handler)

Dependencies
============

  *  ECMAScript 5/strict
  *  old Harmony [Proxies](http://wiki.ecmascript.org/doku.php?id=harmony:proxies) with non-standard support for passing through non-configurable properties
  *  Harmony [WeakMaps](http://wiki.ecmascript.org/doku.php?id=harmony:weak_maps)

Code tested on Firefox 8 and tracemonkey shell.

Next steps
==========

  *  Provide fallback behavior for part of the API, for environments without Proxy or WeakMap support.
  *  More tests.
  *  Switch to qunit or other unit testing framework.
  *  Add example uses of proxies.