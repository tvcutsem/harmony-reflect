# API

## Reflect.Proxy(target, handler)

This is an alias for the global Proxy function.

Creates and returns a new proxy object. The `handler` object may define [trap functions](handler_api.md). These traps are called whenever an operation is applied to the proxy object.

Both target and handler must be non-null objects.

## Reflect.get(target, name, [receiver])

Equivalent to executing `target[name]`, except if `target[name]` is an accessor. In that case, the accessor's "get" method will be executed with its `this` bound to `receiver`.

If `target` is a proxy, calls that proxy's `get` trap.

`name` must be a string.
`receiver` defaults to `target`.

Returns the value of the property, or `undefined` if the property does not exist.

## Reflect.set(target, name, value, [receiver])

Equivalent to executing `target[name] = value`, except if `target[name]` is an accessor. In that case, the accessor's "set" method will be executed with its `this` bound to `receiver`.

If `target` is a proxy, calls that proxy's `set` trap.

`name` must be a string.
`receiver` defaults to `target`.

Returns a boolean indicating whether or not the update happened successfully.

## Reflect.has(target, name)

Equivalent to performing `name in target`.
If `target` is a proxy, calls that proxy's `has` trap.

Name must be a string. Returns a boolean indicating whether `target` has an own or inherited property called "name".

## Reflect.hasOwn(target, name)

Equivalent to performing `target.hasOwnProperty(name)`, assuming `target` inherits the original `hasOwnProperty` definition from `Object.prototype`.

If `target` is a proxy, calls that proxy's `hasOwn` trap.

Name must be a string. Returns a boolean indicating whether `target` has an own (i.e. non-inherited) property called "name".

## Reflect.keys(target)

Same as the ES5 built-in Object.keys(target).
If `target` is a proxy, calls that proxy's `keys` trap.

Returns an array of strings representing the `target` object's own, enumerable property names.

## Reflect.apply(target, [receiver], args)

Equivalent to calling `target.apply(receiver,args)`, assuming `apply` is the original value of `Function.prototype.apply`.

If `target` is a proxy, calls that proxy's `apply` trap.

`target` must be a function (i.e. `typeof target === "function"`).
`args` must be an array. `receiver` defaults to `undefined`.

Returns whatever the `target` function returns.

## Reflect.construct(target, args)

Equivalent to calling `new target(...args)`, i.e. constructing a function with a variable number of arguments.

If `target` is a proxy, calls that proxy's `construct` trap.

`target` must be a function (i.e. `typeof target === "function"`).
`args` must be an array.

Returns the value of the constructor, or the instance itself if the constructor returns a non-object value.

## Reflect.getOwnPropertyDescriptor(target, name)

Same as the ES5 built-in Object.getOwnPropertyDescriptor(target, name).
If `target` is a proxy, calls that proxy's `getOwnPropertyDescriptor` trap.

`name` must be a string. Returns either a property descriptor object or `undefined` if no own property with that name exists.

## Reflect.defineProperty(target, name, desc)

Same as the ES5 built-in Object.defineProperty(target, name, desc).
If `target` is a proxy, calls that proxy's `defineProperty` trap.

`name` must be a string and `desc` must be a valid property descriptor.
Unlike the ES5 built-in, which either returns the target object or throws an exception, this function returns a boolean to indicate whether or not the definition succeeded.

## Reflect.getOwnPropertyNames(target)

Same as the ES5 built-in Object.getOwnPropertyNames(target).
If `target` is a proxy, calls that proxy's `getOwnPropertyNames` trap.

Returns an array of strings representing the `target` object's "own" (i.e. not inherited) property names.

## Reflect.deleteProperty(target, name)

Calling this function is equivalent to performing `delete target[name]`, except that this function returns a boolean that indicates whether or not the deletion was successful.

`name` must be a string.

## Reflect.enumerate(target)

Returns the enumerable own and inherited properties of the `target` object.
If `target` is a proxy, calls that proxy's `enumerate` trap.

The names are determined as if by executing:

    var props = [];
    for (var name in target) {
      props.push(name);
    }
    return props;

Returns an array of strings.

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

Freezes the object as if by calling `Object.freeze(target)`.
If `target` is a proxy, calls that proxy's `freeze` trap.

Returns a boolean indicating whether the object was successfully frozen.

## Reflect.seal(target)

Seals the object as if by calling `Object.seal(target)`.
If `target` is a proxy, calls that proxy's `seal` trap.

Returns a boolean indicating whether the object was successfully sealed.

## Reflect.preventExtensions(target)

Prevents extensions to the object as if by calling `Object.preventExtensions(target)`.
If `target` is a proxy, calls that proxy's `preventExtensions` trap.

Returns a boolean indicating whether the object was successfully made non-extensible.

## Reflect.VirtualHandler()

Constructor function whose prototype represents a proxy handler that readily implements all "derived" traps.

Use `VirtualHandler` if you want to implement just the bare minimum number of traps, inheriting sensible default operations for all the other traps.

The intent is for users to "subclass" `VirtualHandler` and override the "fundamental" trap methods, like so:

    function MyHandler(){};
    MyHandler.prototype = Object.create(Reflect.VirtualHandler.prototype);
    MyHandler.prototype.getOwnPropertyDescriptor = function(tgt, name) {};
    MyHandler.prototype.getOwnPropertyNames = function(tgt) {};
    MyHandler.prototype.defineProperty = function(tgt,name,desc) {};
    MyHandler.prototype.deleteProperty = function(tgt,name) {};
    MyHandler.prototype.preventExtensions = function(tgt) {};
    MyHandler.prototype.apply = function(tgt,rcvr,args) {};
    
    var proxy = Proxy(target, new MyHandler());

A "derived" operation such as `name in proxy` will trigger the proxy's "has()" trap, which is inherited from `VirtualHandler`. That trap will in turn call the overridden `getOwnPropertyDescriptor` trap to figure out if the proxy has the property.

[Details](http://wiki.ecmascript.org/doku.php?id=harmony:virtual_object_api)