Experimental implementation of "notification proxies", based on the original (non-direct) Proxy API. For background info, read my [blog post](http://soft.vub.ac.be/~tvcutsem/invokedynamic/notification-proxies) on Notification Proxies.

The basic idea is as follows:

When an operation is intercepted by a proxy:

  - 1) invoke a pre-trap on the handler
  - 2) forward the operation to the target
  - 3) if the pre-trap returned a callable, call the callable as a post-trap
  - 4) return the result of step 2)

Pre-trap generic signature:
`on{Operation}(target, ...args) -> undefined | callable`

Post-trap generic signature:
`function(target, ...args, result) -> void`

The post-trap receives all the arguments of the pre-trap, including the result
of applying the operation to the target object.

Notification Proxy Handler API
==============================

```
onGetOwnPropertyDescriptor: function(target,name) // post-trap receives copy of the returned descriptor (with standard attributes frozen)
onGetOwnPropertyNames:      function(target) // post-trap receives frozen copy of the returned array
onGetPrototypeOf:           function(target)
onDefineProperty:           function(target,name, desc) // pre-trap receives normalized copy of the argument descriptor
onDeleteProperty:           function(target,name)
onFreeze:                   function(target)
onSeal:                     function(target)
onPreventExtensions:        function(target)
onIsFrozen:                 function(target)
onIsSealed:                 function(target)
onIsExtensible:             function(target)
onHas:                      function(target,name)
onHasOwn:                   function(target,name)
onGet:                      function(target,name,receiver)
onSet:                      function(target,name,val,receiver)
onEnumerate:                function(target)
onKeys:                     function(target) // post-trap receives a frozen copy of the result array
onApply:                    function(target,thisArg,args)
onConstruct:                function(target,args)
```

Q. Why do some pre- and post-traps receive copies instead of the original?

Property descriptors can be mutable objects. A pre-trap could thus mutate the property descriptor before forwarding, thus confusing the client of the proxy who does not know the property was inadvertently modified.

The post-traps get copies of the result. If they could get access to the actual mutable result, they could mutate the result before it is returned to the client, again confusing the client about the outcome of the operation.

Q. Why do the post-traps receive frozen copies?

Arrays passed into the post-traps are frozen because any updates that would be performed to these values would be ignored anyway. It's better to throw an error alerting a proxy author about an update of the copy, which is probably a bug.

Why Notification Proxies?
=========================

  * They avoid the need for costly invariant enforcement checks
  * They forward operations automatically (no need for traps to forward manually to the target object)
  
Proxy abstractions that do not want operations to be forwarded automatically (i.e. that want to change arguments or return values) need to make an extra effort. The basic pattern is that such proxies use a fake "shadow" target which they "set-up" in the "pre-trap" and (if necessary) clean-up in the post-trap.

Credit and History
==================

The basic idea was expressed by E. Dean Tribble on the [es-discuss mailing list](https://mail.mozilla.org/pipermail/es-discuss/2012-November/026587.html) (see [this post](https://mail.mozilla.org/pipermail/es-discuss/2012-November/026589.html) for a follow-up). The implementation as shown here includes the extra feature of a post-trap which was suggested to me by Mark S. Miller.