# Reflect API

  * [new Proxy(target, handler)](#new-proxytarget-handler)
  * [Proxy.revocable(target, handler)](#proxyrevocabletarget-handler)
  * [Reflect.get(target, name, [receiver])](#reflectgettarget-name-receiver)
  * [Reflect.set(target, name, value, [receiver])](#reflectsettarget-name-value-receiver)
  * [Reflect.has(target, name)](#reflecthastarget-name)
  * [Reflect.apply(target, receiver, args)](#reflectapplytarget-receiver-args)
  * [Reflect.construct(target, args)](#reflectconstructtarget-args)
  * [Reflect.getOwnPropertyDescriptor(target, name)](#reflectgetownpropertydescriptortarget-name)
  * [Reflect.defineProperty(target, name, desc)](#reflectdefinepropertytarget-name-desc)
  * [Reflect.getPrototypeOf(target)](#reflectgetprototypeoftarget)
  * [Reflect.setPrototypeOf(target, newProto)](#reflectsetprototypeoftarget-newproto)
  * [Reflect.deleteProperty(target, name)](#reflectdeletepropertytarget-name)
  * [Reflect.enumerate(target)](#reflectenumeratetarget)
  * [Reflect.preventExtensions(target)](#reflectpreventextensionstarget)
  * [Reflect.isExtensible(target)](#reflectisextensibletarget)
  * [Reflect.ownKeys(target)](#reflectownkeystarget)

## new Proxy(target, handler)

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

## Reflect.apply(target, receiver, args)

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

Returns an ES6 iterator representing the enumerable own and inherited properties of the `target` object.

If `target` is a proxy, calls that proxy's `enumerate` trap.

The ES6 iterator can be drained into an array as follows:

    var props = [];
    var iterator = Reflect.enumerate(target);
    var nxt = iterator.next();
    while (!nxt.done) {
      props.push(nxt.value);
      nxt = iterator.next();
    }
    if (nxt.value !== undefined) {
      props.push(nxt.value);
    }
    return props;

## Reflect.preventExtensions(target)

Prevents extensions to the object as if by calling `Object.preventExtensions(target)`. Returns a boolean indicating whether the object was successfully made non-extensible.

If `target` is a proxy, calls that proxy's `preventExtensions` trap.

## Reflect.isExtensible(target)

Returns a boolean indicating whether `target` is extensible as if by calling `Object.isExtensible(target)`.

If `target` is a proxy, calls that proxy's `isExtensible` trap.

## Reflect.ownKeys(target)

Returns an array of strings representing the `target` object's "own" (i.e. not inherited) property keys.

If `target` is a proxy, calls that proxy's `ownKeys` trap.

Note: in ES6, this method returns an array containing strings _or symbols_, rather than just strings. Symbols are a new feature in ES6 that this library does not attempt to emulate.
As a result, for this shim, this method returns the same result as `Object.getOwnPropertyNames(target)`, which only ever
returns strings, never symbols (even in ES6).