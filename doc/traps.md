# Proxy Traps

The following table shows Javascript code on the left, and approximately how that code is trapped and interpreted by the Proxy mechanism on the right.

Assume `proxy` is defined as:

    var proxy = new Proxy(target, handler)

See further notes below for details.

<table
  border="0"
  cellspacing="5"
  cellpadding="5">
  <tr>
    <td colspan="3">Syntactic operations that can be intercepted</td>
  </tr>
  <tr>
    <th>Operation</th>
    <th>Code</th>
    <th>Trapped as</th>
  </tr>
  <tr>
    <td>property access</td>
    <td>proxy.foo<br/>proxy['foo']</td>
    <td>handler.get(target, 'foo', proxy)</td>
  </tr>
  <tr>
    <td>property assignment</td>
    <td>proxy.foo = v<br/>proxy['foo'] = v</td>
    <td>handler.set(target, 'foo', v, proxy)</td>
  </tr>
  <tr>
    <td>property invocation (1)</td>
    <td>proxy.foo(1,2,3)</td>
    <td>handler.get(target, 'foo', proxy).apply(proxy, [1,2,3])</td>
  </tr>
  <tr>
    <td>property query</td>
    <td>'foo' in proxy</td>
    <td>handler.has(target, 'foo')</td>
  </tr>
  <tr>
    <td>property deletion</td>
    <td>delete proxy.foo<br/>delete proxy['foo']</td>
    <td>handler.deleteProperty(target, 'foo')</td>
  </tr>
  <tr>
    <td>property enumeration</td>
    <td>for (var prop in proxy) { ... }</td>
    <td><pre>var $iterator = handler.enumerate(target);
var $nxt = iterator.next();
while (!$nxt.done) {
  var prop = String($nxt.value);
  ...
  $nxt = $iterator.next();
}
</pre></td>
  </tr>
  <tr>
    <td>inherited property access</td>
    <td>var obj = Object.create(proxy);<br/>obj.foo;</td>
    <td>handler.get(target, 'foo', obj)</td>
  </tr>
  <tr>
    <td>inherited property assignment</td>
    <td>var obj = Object.create(proxy);<br/>obj.foo = v;</td>
    <td>handler.set(target, 'foo', v, obj)</td>
  </tr>
  <tr>
    <td colspan="3">Operations on function proxies</td>
  </tr>
  <tr>
    <td>function call (3)</td>
    <td>proxy(...args)</td>
    <td>handler.apply(target, undefined, args)</td>
  </tr>
  <tr>
    <td>function construct</td>
    <td>new proxy(...args)</td>
    <td>handler.construct(target, args)</td>
  </tr>
  <tr>
    <td>method call (4)</td>
    <td>object.proxy(...args)</td>
    <td>handler.apply(target, object, args)</td>
  </tr>
  <tr>
    <td>Function.prototype.call (5)</td>
    <td>proxy.call(object, ...args)</td>
    <td>handler.apply(target, object, args)</td>
  </tr>
  <tr>
    <td colspan="3">Non-interceptable operators</td>
  </tr>
  <tr>
    <td>typeof test</td>
    <td>typeof proxy</td>
    <td>(typeof target === "function") ? "function" : "object"</td>
  </tr>
  <tr>
    <td>identity comparison</td>
    <td>proxy === v</td>
    <td>proxy === v</td>
  </tr>
  <tr>
    <td colspan="3">Built-ins inherited from Object.prototype</td>
  </tr>
  <tr>
    <td>hasOwnProperty (6)</td>
    <td>proxy.hasOwnProperty('foo')</td>
    <td>handler.hasOwn(target, 'foo')</td>
  </tr>
  <tr>
    <td>valueOf (7)</td>
    <td>proxy.valueOf()</td>
    <td>target.valueOf()</td>
  </tr>
  <tr>
    <td>toString (8)</td>
    <td>proxy.toString()</td>
    <td>target.toString()</td>
  </tr>
  <tr>
    <td colspan="3">(Static) operations on Object</td>
  </tr>
  <tr>
    <td>getOwnPropertyNames</td>
    <td>Object.getOwnPropertyNames(proxy)</td>
    <td>handler.ownKeys(target)</td>
  </tr>
  <tr>
    <td>getOwnPropertyDescriptor (9)</td>
    <td>Object.getOwnPropertyDescriptor(proxy, 'foo')</td>
    <td>handler.getOwnPropertyDescriptor(target, 'foo')</td>
  </tr>
  <tr>
    <td>defineProperty (10)</td>
    <td>Object.defineProperty(proxy, 'foo', {value:42})</td>
    <td>handler.defineProperty(target, 'foo', {value:42,writable:true,enumerable:true,configurable:true})</td>
  </tr>
  <tr>
    <td>preventExtensions</td>
    <td>Object.preventExtensions(proxy)</td>
    <td>handler.preventExtensions(target)</td>
  </tr>
  <tr>
    <td>isExtensible</td>
    <td>Object.isExtensible(proxy)</td>
    <td>handler.isExtensible(target)</td>
  </tr>
  <tr>
    <td>getPrototypeOf</td>
    <td>Object.getPrototypeOf(proxy)</td>
    <td>handler.getPrototypeOf(target)</td>
  </tr>
  <tr>
    <td>setPrototypeOf (11)</td>
    <td>Object.setPrototypeOf(proxy, newProto)</td>
    <td>handler.setPrototypeOf(target, newProto)</td>
  </tr>
  <tr>
    <td>keys (12)</td>
    <td>Object.keys(proxy)</td>
    <td>handler.ownKeys(target)</td>
  </tr>
</table>

## Notes

  * (1): in Javascript, a method call like `obj.foo(1,2,3)` is defined as looking up the "foo" property on `obj`, and then calling the resulting function with `obj` as the `this`-binding. If `obj` is a proxy, the same strategy applies. There is no separate `invoke` trap.
  * (3): the syntax `...args` is ECMAScript 6 syntax for "spreading" arguments into a call. `f(...[1,2,3])` is equivalent to `f(1,2,3)`. Function calls can only be intercepted if the target is a function, i.e. `typeof target === "function"`.
  * (4): this assumes that the proxy was installed as a method on `object`, e.g. `var object = { proxy: new Proxy(target, handler) }`.
  * (5): assuming that `proxy.call`, which triggers the proxy's "get" trap, returned `Function.prototype.call`.
  * (6): assuming that `proxy.hasOwnProperty`, which triggers the proxy's "get" trap, returned `Object.prototype.hasOwnProperty`.
  * (7): assuming that `proxy.valueOf`, which triggers the proxy's "get" trap, returned `Object.prototype.valueOf`.
  * (8): assuming that `proxy.toString`, which triggers the proxy's "get" trap, returned `Object.prototype.toString`.
  * (9): the return value of the `getOwnPropertyDescriptor` trap (the property descriptor object) is not the original value returned from the intercepted `Object.getOwnPropertyDescriptor` call. Rather, it is a fresh descriptor object that is guaranteed to be "complete" (i.e. to define values for all relevant ECMAScript property attributes).
  * (10): the third argument to the `defineProperty` trap (the property descriptor object) is not the original value passed into the intercepted `Object.defineProperty` call. Rather, it is a fresh descriptor object that is guaranteed to be "complete" (i.e. to define values for all relevant ECMAScript property attributes).
  * (11): only on platforms that support mutable `__proto__` and where `__proto__` is an accessor property defined on `Object.prototype`.
  * (12): the `ownKeys` trap must return all own property names. `Object.keys` then retains only the keys denoting enumerable properties.
