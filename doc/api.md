# API

## Reflect.Proxy(target, handler)

This is an alias for the global Proxy function.

Creates and returns a new proxy object. The `handler` object may define [trap functions](handler_api.md). These traps are called whenever an operation is applied to the proxy object.

Both target and handler must be non-null objects.

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

## Reflect.hasOwn(target, name)

Returns a boolean indicating whether `target` has an own (i.e. non-inherited) property called "name".

Equivalent to performing `target.hasOwnProperty(name)`, assuming `target` inherits the original `hasOwnProperty` definition from `Object.prototype`.

If `target` is a proxy, calls that proxy's `hasOwn` trap.

`name` must be a string.

## Reflect.keys(target)

Returns an array of strings representing the `target` object's own, enumerable property names.

Same as the ES5 built-in `Object.keys(target)`.

If `target` is a proxy, calls that proxy's `keys` trap.

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

## Reflect.getOwnPropertyNames(target)

Returns an array of strings representing the `target` object's "own" (i.e. not inherited) property names.

Same as the ES5 built-in Object.getOwnPropertyNames(target).
If `target` is a proxy, calls that proxy's `getOwnPropertyNames` trap.

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

If `target` is a proxy, calls that proxy's `iterate` trap.

## Reflect.freeze(target)

Freezes the object as if by calling `Object.freeze(target)`. Returns a boolean indicating whether the object was successfully frozen.

If `target` is a proxy, calls that proxy's `freeze` trap.

## Reflect.seal(target)

Seals the object as if by calling `Object.seal(target)`. Returns a boolean indicating whether the object was successfully sealed.

If `target` is a proxy, calls that proxy's `seal` trap.

## Reflect.preventExtensions(target)

Prevents extensions to the object as if by calling `Object.preventExtensions(target)`. Returns a boolean indicating whether the object was successfully made non-extensible.

If `target` is a proxy, calls that proxy's `preventExtensions` trap.

## Reflect.VirtualHandler()

Constructor function whose prototype represents a proxy handler that readily implements all "derived" traps.

Use `VirtualHandler` if you want to implement just the bare minimum number of traps, inheriting sensible default operations for all the other traps.

The intent is for users to "subclass" `VirtualHandler` and override the "fundamental" trap methods, like so:

    // the "subclass" constructor function
    function MyHandler(){};
    // set its prototype to an object inheriting from VirtualHandler.prototype
    MyHandler.prototype = Object.create(Reflect.VirtualHandler.prototype);
    // now override just the following traps:
    MyHandler.prototype.getOwnPropertyDescriptor = function(tgt, name) {};
    MyHandler.prototype.getOwnPropertyNames = function(tgt) {};
    MyHandler.prototype.defineProperty = function(tgt,name,desc) {};
    MyHandler.prototype.deleteProperty = function(tgt,name) {};
    MyHandler.prototype.preventExtensions = function(tgt) {};
    MyHandler.prototype.apply = function(tgt,rcvr,args) {};
    
    var proxy = Proxy(target, new MyHandler());

A "derived" operation such as `name in proxy` will trigger the proxy's `has` trap, which is inherited from `VirtualHandler`. That trap will in turn call the overridden `getOwnPropertyDescriptor` trap to figure out if the proxy has the property.

[More details](http://wiki.ecmascript.org/doku.php?id=harmony:virtual_object_api)