/**
 * @deprecated: see membrane.js for a more complete implementation of membranes.
 *
 * A simple membrane that doesn't distinguish between "inward"
 * and "outward" crossing of the membrane.
 *
 * Uses a "dummy target" to enable Object.getPrototypeOf to expose
 * a wrapped prototype. Exposing non-configurable own properties of
 * the real target will still fail. Why? See:
 * http://soft.vub.ac.be/~tvcutsem/invokedynamic/frozen-proxies
 *
 * @author tvcutsem
 *
 * For a general introduction to membranes, see:
 * http://soft.vub.ac.be/~tvcutsem/invokedynamic/js-membranes
 *
 * usage:
 * var membrane = makeMembrane(obj)
 * var wrappedObj = membrane.target;
 * var wrappedX = wrappedObj.x; // accessed objects are recursively wrapped
 * membrane.revoke(); // touching any wrapped value after this point throws
 */
function makeMembrane(initTarget) {
  var cache = new WeakMap();
  var revoked = false;
  
  function wrap(target) {
    if (Object(target) !== target) return target; // primitives are passed through
    var wrapper = cache.get(target);
    if (wrapper) return wrapper;
    
    
    var dummyTarget;
    if (typeof target === "function") {
      dummyTarget = target;
    } else {
      dummyTarget = Object.create(wrap(Object.getPrototypeOf(target)));      
    }
      
    wrapper = Proxy(dummyTarget, Proxy(dummyTarget, { // "double lifting"
      get: function(dummyTarget, trapName) {
        if (revoked) throw new TypeError("membrane revoked");
        return function(dummyTarget /*, ...args*/) { // generic trap
          var args = Array.prototype.slice.call(arguments, 1).map(wrap);
          return wrap(Reflect[trapName].apply(undefined, [target].concat(args)));
        }
      }
    }));
    cache.set(target, wrapper);
    return wrapper;
  }
  
  function revoke() { revoked = true; }
  
  return {revoke: revoke, target: wrap(initTarget)};
}