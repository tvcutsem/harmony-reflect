## Expressing ownership boundaries using membranes

The file `boundary.js` implements an ownership boundary abstraction based on
generic [membranes](https://soft.vub.ac.be/~tvcutsem/invokedynamic/js-membranes)
(see `../generic_membrane.js`).

The approach is inspired primarily by the paper:

Ownership, Filters & Crossing Handlers, Wernli et al, DLS 2012

That paper explores the use of "ownership types" in a dynamically typed
language. The approach explored in the paper requires modification of the
VM (or rewriting of call sites) to insert runtime checks on method
invocations via references that cross the boundary. Here, we use proxies
rather than modifying the VM to achieve the same effect.

We give a general overview of the basic idea below.

### Classify methods according to topics

To start using ownership boundaries, methods must be classified according
to "topics". A topic is a user-defined description that classifies methods
according to various concerns.

A method may be classified according to multiple topics.

Methods or functions can be classified as follows:

    // label a function
    var sort = function(array){
      // ...
    }.class(["mutator","sorting"]);
    
    // label a method in an object literal
    var iterator = {
      next: function(){...}.class("iteration"),
      hasNext: function(){...}.class(["readonly","iteration"])
    };
    
    // label a method on a Constructor prototype
    function Box(init) {
      this.state = init;
    }
    Box.prototype.read = function(){
      return this.state;
    }.class("readonly");
    Box.prototype.write = function(v) {
      this.state = v;
    }.class("mutator");

The function `class` basically takes a topic, or array of topics, and
marks the receiver function as being classified according to that
topic. `class` returns the classified function.

### Boundaries wrap object graphs

The next step is to define "ownership boundaries" around strategically placed
objects in the object graph.

An ownership boundary encapsulates all objects within the boundary.
It defines two sets of filters, "in"-filters and "out"-filters.

When an object crosses the ownership boundary, the only methods that
may be invoked on the object by objects on the other side, are those
whose topics matches that of the corresponding filter.

The "in"-filter applies to parameters passed as arguments to functions
that reside inside the boundary. It also applies to values originating
from outside the boundary that are assigned to properties of objects
inside the boundary.

The "out"-filter applies to return values or thrown exceptions of
functions that reside inside the boundary. It also applies to values
read from properties of objects inside the boundary, that are exposed
to clients outside the boundary.

An ownership boundary is declared as follows:

    var boundary = new Boundary({
      in: [],
      out: [".readonly"],
      entry: new Box(42)
    });
    var boundBox = boundary.entry;

This creates an ownership boundary around a single Box object.
The first argument to `guard` identifies an object that is to be placed
*inside* the boundary. The return value of `guard` is a proxy giving access
to the box from *outside* the boundary.

The initial object inside the boundary is also named the *entry* object
because this object typically forms the initial entry-point into the object
graph encapsulated by the
boundary. By interacting with the entry object, objects from outside
the boundary can access other objects inside the boundary. The `entry`
object can be a function, which, when called, runs all of its code
*inside* the boundary. Ideally, such a function should be closed (i.e.
have no free variables), to avoid accidentally capturing lexically
visible state that cannot be intercepted by the boundary.

This particular boundary has no in-filters. This implies that
objects *inside* the boundary cannot invoke any method on objects
passed into the boundary. They can only store references to them,
or perform identity tests on them.

The boundary defines a single out-filter, "readonly". This implies
that objects *outside* the boundary can only invoke "readonly" methods
on objects passed out of the boundary. This includes the entry object.

### Filters restrict method calls across boundaries

The boundary works its magic to enforce the restrictions imposed by the
in and out filters. When it encounters a violation, a `TypeError`
exception is raised.

For instance, assume the `Box` also defined the following method:

    Box.prototype.toString = function() {
      return "[Box: " + this.state.toString() + "]";
    };

Then the following code throws:

    var aFoo = {toString: function(){ return "foo"; }};
    
    var boundary = new Boundary({
      in: [], // empty list implies no methods are allowed
      out: '*', // * implies all methods are allowed
      entry: function(init) {
        return new Box(init);
      }
    })
    var boundedBoxMaker = boundary.entry;
        
    var boundBox = boundedBoxMaker(aFoo);
    boundBox.toString()
    // TypeError: method 'toString' does not match boundary
    // in-filters '[]' ('toString' is not classified)

The `toString()` method of the `boundBox` is trying to call the
`toString()` method of `this.state`, which was passed into the boundary,
so the in-filter is applied. The in-filter states that no methods
may be invoked on incoming objects, so the call to `toString` is
rejected.

This is an example of a violation of an in-filter. When an in-filter
is violated, the error always lies with code *inside* the boundary.

An example of the violation of an out-filter is shown below:

    var boundary = new Boundary({
      in: [],
      out: [".readonly"],
      entry: new Box(42)
    });
    var boundBox = boundary.entry;
    
    boundBox.write(24);
    // TypeError: method 'write' does not match boundary
    // out-filters '[".readonly"]' ('write' is classified as
    // '["mutator"]')

When an out-filter is violated, the error always lies with code *outside*
the boundary.

### Specifying in and out filters

The syntax for in and out-filters is loosely based on that of CSS selectors:

  *  "*" matches all methods of an object
  *  ".foo" matches all methods explicitly classified under the "foo" topic
     using `class` (as explained in step 1 above)
  *  "#foo" matches a method explicitly named "foo"
  *  `/regexp/` matches all methods whose name matches the regexp
  * `[".foo",".bar","#baz"]` matches all methods that are classified as
     "foo" OR as "bar" OR whose name is "baz".
  *  `[]` (ie the empty array) matches nothing (no methods)

An in or out-filter can either be an array, a string or a regular expression.
There is no difference between passing `[".foo"]` or just `".foo"`.

### Filters are transitively enforced

The filters applied by boundaries are *transitive*. For example:

    var boundary = new Boundary({
      in: [],
      out: [".readonly", "#init"],
      entry: function init() {
        var calculator = {
          square : function(x) { return x * x; }
        };
        return new Box(calculator);
      }
    });
    var boxedCalculatorMaker = boundary.entry;
    
    var boundBox = boxedCalculatorMaker();
    var calc = boundBox.read(); // ok, read is classified as "readonly"
    calc.square(4);
    // TypeError: method 'square' does not match boundary
    // out-filters '[".readonly","#init"]' ('square' is not classified)

Even though `calc` is a new object reference that we have obtained
via `boundBox`, all filters that are applicable to `boundBox` are
also applicable to `calc`.

Here is another example illustrating the transitive nature of a
boundary:

    var boundary = new Boundary({
      in: [ '#iter' ],
      out: [ '#forEach', '#init' ],
      entry: function init() {
        var circle = { paint: function() { /*...*/ } };
        var triangle = { paint: function() { /*...*/ } };
        var square = { paint: function() { /*...*/ } };
        return [circle, triangle, square];
      }
    });
    var shapeMaker = boundary.entry;
    
    var shapes = shapeMaker();
    shapes.forEach(function iter(shape) {
      // shape parameter passed into the callback also transitively
      // enforces boundary filters
      shape.paint();
      // TypeError: method 'paint' does not match boundary out-filters
      // '[ "#forEach", "#init" ]' ('paint' is not classified)
    });

### Object identity is maintained across boundaries

References to incoming objects that are later passed outward again
are not protected by boundary out-filters. Instead, the original
object passed into the boundary is returned to the outside. Like this,
clients outside of the boundary retain all access rights to their
own objects, and object identity remains stable. For example:

    var token = {};
    var boundary = new Boundary({
      in: [],
      out: '*',
      entry: function(val) {
        return new Box(val);
      }
    });
    var boundedBoxMaker = boundary.entry;
    
    var boundBox = boundedBoxMaker(token);   
    var readToken = boundBox.read();
    assert(token === readToken);

Here we used `"*"` as an out-filter, which allows all function calls.
A boundary whose in-filter and out-filter is both `"*"` is completely
transparent to clients and will never raise a `TypeError`.

### Boundaries can nest

Boundaries can be nested, in which case filters are cumulative. That is,
if boundary b2 is nested in boundary b1, boundary b2 defines
an out-filter [".foo",".bar"] and boundary b1 defines an
out-filter ".foo", then when an object inside b2 is passed outside b1,
only methods classified ".foo" are accessible. For example:

    var b1 = new Boundary({
      in: [],
      out: [".readonly", "#init"],
      entry: function init(val) {
        var b2 = new Boundary({
          in: [],
          out: [".readonly", ".mutator"],
          entry: new Box(42)
        })
        return b2.entry;
      }
    });
    
    var doubleBoundBox = b1.entry(); 
    doubleBoundBox.read() // ok, returns 42
    doubleBoundBox.write(24)
    // TypeError: method 'write' does not match boundary
    // out-filters '[".readonly"]' ('write' is classified as
    // '["mutator"]')
  
### Boundaries are first-class

TODO

Why first-class?

  * Explicit boundary use cases:
    * adding multiple entry points:
      `boundary = new Boundary(options); entry = boundary.own(entryObj)`
    * dynamically updating in and out-filters:
      `boundary.in = [".bar"]`
      (setting `.in` and `.out` to `[]` is almost like revoking a membrane)
      Might this replace the first-class state pattern from the paper?

### Boundary constructor options

The `Boundary` constructor function takes as its first argument an `options`
object. Any subsequent arguments are passed into the `run` function that
acts as an initialisation script running "inside" the boundary. Supported
options are:

  * `in:` (defaults to: `"*"`) the in-filter of the boundary, as specified
    using the rules shown above.
  * `out:` (defaults to: `"*"`) the out-filter of the boundary.
  * `entry:` (mandatory) an object (can also be an array or function)
    representing the initial entry-point into the boundary.    
  * `name:` (defaults to: `""`) a string holding a human-readable name
    for the domain. Used in error messages. Useful for debugging.

The `Boundary` constructor returns a wrapped version of its `entry:` object.

If initialization arguments need to be passed from the outside of the boundary
to the inside, the recommended pattern is to use a function as an entry-point.
The following is __wrong__:

    var content = {};
    var boundBox = new Boundary({
      in: [],
      out: [".readonly"],
      entry: new Box(content)
    });

In this case, the `boundBox` is initialized with a direct reference to the
`content` object outside of the boundary. The boundary will misinterpret this
as if `content` was *inside* of the boundary, since it is directly reachable
from the box object. The __right__ way to encode this pattern is:

    var content = {};
    var boxMaker = new Boundary({
      in: [],
      out: [".readonly", "#init"],
      entry: function init(val) {
        return new Box(val)
      }
    });
    var boundBox = boxMaker(content);

Now, the `content` argument passed into the `boxMaker` function will be
correctly wrapped, and the `val` argument is protected by the in-filter (i.e.
it is correctly recognized as referring to a value from *outside* the
boundary).

## What's the benefit of using membranes?

In the Ownership, Filters and Crossing-handlers paper, the ownership boundary
is defined in terms of an ownership tree: the boundary is *implicitly*
defined as the set of objects *owned* by another object. All objects are
extended with an *explicit* pointer to their owner object. All method calls
are instrumented with ownership checks that make use of the owner field
of the target object. There are no proxy objects.

Using membranes, the ownership boundary is defined *explicitly* as a
first-class entity. An object or function is designated as the entry
object inside the boundary, and any objects created via the entry object
reside implicitly inside the boundary. Objects have no explicit ownership
pointer. Ownership checks are made by proxies along the boundary. Method
calls on ordinary objects do not contain ownership checks.

The two approaches are dual:

  * An implicit ownership boundary has the advantage that object ownership
    can easily be changed. The disadvantage is that ownership checks potentially
    affect all method calls.
  * An explicit ownership boundary has the advantage that not all objects
    must be extended with an ownership pointer, and ownership checks occur
    only in proxies. The downside is that objects cannot easily change
    ownership.

## Aren't boundaries just contracts?

The runtime checks performed by boundaries are indeed similar to the
pre and post-condition checks performed by higher-order contract systems
(such as [contracts.coffee](http://disnetdev.com/contracts.coffee/)).
Contracts, like boundaries, must also transitively wrap values in order
to track and assign blame.

Upon detecting a violation, contract systems usually assign blame to the
"party" responsible for the violation. This helps diagnose the cause of the
error. In contract systems, a "party" is usually a module, and blame is
assigned either to the module implementation, or to the client using the
module.

Boundaries similarly assign blame to either code inside the boundary (i.e.
violation of an in-filter) or code outside the boundary (i.e. violation of
an out-filter).

Boundaries only perform one simple kind of check: does the invoked method
match any of the topics in the in or out-filter of the boundary? They do not
check arbitrary predicates.

Boundaries are meant to be deployed at a finer-grain level than modules.
They are designed to be deployed around containers or around strategic objects
in the object graph. The use cases derive from work on reasoning about
object ownership and aliasing (e.g. ownership types).
