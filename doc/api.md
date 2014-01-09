# Standard API

## Reflect.Proxy(target, handler)

This is an alias for the global Proxy function.

Creates and returns a new proxy object. The `handler` object may define [trap functions](handler_api.md). These traps are called whenever an operation is applied to the proxy object.

Both target and handler must be non-null objects.

Note: In the official ES6 API, `Proxy` will be a constructor function that
will _require_ the use of `new`. That is, you must write `new Proxy(target, handler)` to construct a proxy object. This library exports `Proxy` as an ordinary function which may be called with or without the `new` operator.
For forward-compatibility, it is advised to always use `new`.

## Proxy.revocable(target, handler)

Returns an object with properties `proxy` and `revoke`. `proxy` is a freshly constructed proxy, as if by calling `new Proxy(target, handler)`. `revoke()` is a function that when called, renders the associated proxy unusable: any trappable operation performed on `proxy` after it has been revoked throws a `TypeError`.

When a proxy is revoked, it no longer refers to its `target` and `handler` so that these may become subject to garbage-collection.

Example:

    var tuple = Proxy.revocable(target, handler);
    var proxy = tuple.proxy;
    var revoke = tuple.revoke;
    proxy.foo // traps
    revoke()  // returns undefined
    proxy.foo // throws TypeError: "proxy is revoked"

## Reflect.get(target, name, [receiver])

Returns the value of `target`'s `name` property, or `undefined` if the property does not exist.

Equivalent to executing `target[name]`, except if `target[name]` is an accessor. In that case, the accessor's "get" method will be executed with its `this` bound to `receiver`.

If `target` is a proxy, calls that proxy's `get` trap.

`name` must be a string.
`receiver` defaults to `target`.

## Reflect.set(target, name, value, [receiver])

Attempts to update the value of `target`'s `name` property to `value`.
Returns a boolean indicating whether or not the update happened successfully.

Equivalent to executing `target[name] = value`, except if `target[name]` is an accessor. In that case, the accessor's "set" method will be executed with its `this` bound to `receiver`.

If `target` is a proxy, calls that proxy's `set` trap.

`name` must be a string.
`receiver` defaults to `target`.

## Reflect.has(target, name)

Returns a boolean indicating whether `target` has an own or inherited property called "name".

Equivalent to performing `name in target`.

If `target` is a proxy, calls that proxy's `has` trap.

`name` must be a string.

## Reflect.apply(target, receiver, [args])

Calls the `target` function with its `this`-value bound to `receiver` and with actual arguments as specified by the `args` array. Returns whatever the `target` function returns.

If `target` is a proxy, calls that proxy's `apply` trap.

`target` must be a function (i.e. `typeof target === "function"`).
`args` defaults to the empty array.

In non-strict code, if `receiver` is `null` or `undefined`, the `this`-value will be set to the global object instead.

## Reflect.construct(target, args)

Equivalent to calling `new target(...args)`, i.e. constructing a function with a variable number of arguments. Returns the value of the constructor, or the instance itself if the constructor returns a non-object value.

If `target` is a proxy, calls that proxy's `construct` trap.

`target` must be a function (i.e. `typeof target === "function"`).
`args` must be an array.

## Reflect.getOwnPropertyDescriptor(target, name)

Returns either a property descriptor object or `undefined` if no own property with that name exists.

Same as the ES5 built-in `Object.getOwnPropertyDescriptor(target, name)`.

If `target` is a proxy, calls that proxy's `getOwnPropertyDescriptor` trap.

`name` must be a string.

## Reflect.defineProperty(target, name, desc)

Same as the ES5 built-in `Object.defineProperty(target, name, desc)` except that this function returns a boolean indicating whether or not the definition succeeded. The ES5 built-in instead either returns the target object or throws an exception.

If `target` is a proxy, calls that proxy's `defineProperty` trap.

`name` must be a string and `desc` must be a valid property descriptor object.

## Reflect.getPrototypeOf(target)

Returns the prototype link of the `target` object.

Same as the ES5 built-in Object.getPrototypeOf(target).
If `target` is a proxy, calls that proxy's `getPrototypeOf` trap.

## Reflect.setPrototypeOf(target, newProto)

Mutates the prototype link of the `target` object and sets it to `newProto`. One can only set the prototype of extensible `target` objects. The operation will throw if `target` is non-extensible. This operation returns a boolean success value, indicating whether the operation succeeded.

This operation only works on platforms that support the non-standard `__proto__`
property, the property is mutable, and is represented as an accessor property on
`Object.prototype`. On these platforms, this library will also define a corresponding `Object.setPrototypeOf(target, newProto)` function.

If `target` is a proxy, calls that proxy's `setPrototypeOf` trap.

## Reflect.deleteProperty(target, name)

Attempts to delete the `name` property on `target`. Calling this function is equivalent to performing `delete target[name]`, except that this function returns a boolean that indicates whether or not the deletion was successful.

`name` must be a string.

## Reflect.enumerate(target)

Returns an array of strings representing the enumerable own and inherited properties of the `target` object.

If `target` is a proxy, calls that proxy's `enumerate` trap.

The names are determined as if by executing:

    var props = [];
    for (var name in target) {
      props.push(name);
    }
    return props;

## Reflect.preventExtensions(target)

Prevents extensions to the object as if by calling `Object.preventExtensions(target)`. Returns a boolean indicating whether the object was successfully made non-extensible.

If `target` is a proxy, calls that proxy's `preventExtensions` trap.

## Reflect.isExtensible(target)

Returns a boolean indicating whether `target` is extensible as if by calling `Object.isExtensible(target)`.

If `target` is a proxy, calls that proxy's `isExtensible` trap.

## Reflect.ownKeys(target)

Returns an iterator that produces all of the string-keyed own property names of `target`.

If `target` is a proxy, calls that proxy's `ownKeys` trap.

Note: in ES6, this method returns an iterator producing strings _or symbols_, rather than just strings. Symbols are a new feature in ES6 that this library does not attempt to emulate. In this library, the method behaves just like the ES5 built-in `Object.keys(target)`, except that it returns an iterator rather than an array.

# Non-standard API

The functions defined below are non-standard. They are not part of the ES6 reflection API.

## Reflect.Handler()

Constructor function whose prototype represents a proxy handler that readily implements all "derived" traps.

Use `Handler` if you want to implement just the bare minimum number of traps (the "fundamental" traps), inheriting sensible default operations for all the other traps (the "derived" traps).

The intent is for users to "subclass" `Handler` and override the "fundamental" trap methods, like so:

    // the "subclass" constructor function
    function MyHandler(){};
    
    // set its prototype to an object inheriting from Handler.prototype
    MyHandler.prototype = new Reflect.Handler();
    
    // now override one or more "fundamental" traps, e.g.:
    MyHandler.prototype.defineProperty = function(tgt,name,desc) {...};
    
    // create a proxy with an instance of the Handler "subclass"
    var proxy = new Proxy(target, new MyHandler());
    
    // MyHandler's inherited "set" trap will call the overridden "defineProperty" trap
    proxy.foo = 42;

A "derived" operation such as `name in proxy` will trigger the proxy's `has` trap, which is inherited from `Handler`. That trap will in turn call the overridden `getOwnPropertyDescriptor` trap to figure out if the proxy has the property.

The following `Handler` traps are regarded as "fundamental", and by default forward to the target object: getOwnPropertyDescriptor, getOwnPropertyNames, getPrototypeOf, defineProperty, deleteProperty, preventExtensions, isExtensible, apply.

All other traps are "derived", and default to one or more of the above "fundamental" traps: get, set, has, hasOwn, keys, enumerate, iterate, seal, freeze, isSealed, isFrozen, construct.

[More details](http://wiki.ecmascript.org/doku.php?id=harmony:virtual_object_api)

# Deprecated functions

The functions defined below were at one point part of the official ES6 API but have since been
deprecated. This library continues to implement them for the sake of backwards-compatibility.

## Reflect.hasOwn(target, name)

Returns a boolean indicating whether `target` has an own (i.e. non-inherited) property called "name".

Equivalent to performing `target.hasOwnProperty(name)`, assuming `target` inherits the original `hasOwnProperty` definition from `Object.prototype`.

If `target` is a proxy, calls that proxy's `hasOwn` trap.

`name` must be a string.

## Reflect.getOwnPropertyNames(target)

Returns an array of strings representing the `target` object's "own" (i.e. not inherited) property names.

Same as the ES5 built-in Object.getOwnPropertyNames(target).
If `target` is a proxy, calls that proxy's `getOwnPropertyNames` trap.

## Reflect.keys(target)

Returns an array of strings representing the `target` object's own, enumerable property names.

Same as the ES5 built-in `Object.keys(target)`.

If `target` is a proxy, calls that proxy's `keys` trap.

## Reflect.freeze(target)

Freezes the object as if by calling `Object.freeze(target)`. Returns a boolean indicating whether the object was successfully frozen.

If `target` is a proxy, calls that proxy's `freeze` trap.

## Reflect.seal(target)

Seals the object as if by calling `Object.seal(target)`. Returns a boolean indicating whether the object was successfully sealed.

If `target` is a proxy, calls that proxy's `seal` trap.

## Reflect.isFrozen(target)

Returns a boolean indicating whether `target` is frozen as if by calling `Object.isFrozen(target)`.

If `target` is a proxy, calls that proxy's `isFrozen` trap.

## Reflect.isSealed(target)

Returns a boolean indicating whether `target` is sealed as if by calling `Object.isSealed(target)`.

If `target` is a proxy, calls that proxy's `isSealed` trap.

## Reflect.iterate(target)

Returns an iterator on the target object. You can call `next()` on the iterator to retrieve subsequent elements until it throws a `StopIteration` exception, like so:

    var iterator = Reflect.iterate(obj);
    try {
      while (true) {
        var elem = iterator.next();
        process(elem);
      }
    } catch (e) {
      if (e !== StopIteration) throw e;
    }

However, in ES6 one would usually use the new `for-of` loop to exhaust an iterator.

If `target` is a proxy, calls that proxy's `iterate` trap.