Draft implementation of "notification proxies", based on the original (non-direct) Proxy API.

The basic idea was expressed by E. Dean Tribble on the [es-discuss mailing list](https://mail.mozilla.org/pipermail/es-discuss/2012-November/026587.html) (see [this post](https://mail.mozilla.org/pipermail/es-discuss/2012-November/026589.html) for a follow-up).

The basic idea is as follows:

When an operation is intercepted by a proxy:

  - 1) invoke a pre-trap on the handler
  - 2) forward the operation to the target
  - 3) if the pre-trap returned a callable, call the callable as a post-trap
  - 4) return the result of step 2)

Pre-trap generic signature:
`on{Operation}(target, ...args) -> undefined | callable`

Post-trap generic signature:
`function(target, result) -> void`

API of notification proxy handlers:
```
onGetOwnPropertyDescriptor: function(target,name) // post-trap receives copy of the returned descriptor
onGetOwnPropertyNames:      function(target) // post-trap receives copy of the returned array
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
onEnumerate:                function(target) // post-trap receives a "copy of the iterator" (?)
// (post-trap consuming the iterator should have no effect on the iterator returned to clients)
onKeys:                     function(target) // post-trap receives a copy of the result array
onApply:                    function(target,thisArg,args)
onConstruct:                function(target,args)
```