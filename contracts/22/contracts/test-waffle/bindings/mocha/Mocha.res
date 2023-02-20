@val
external describe: (string, @uncurry (unit => unit)) => unit = "describe"
@val
external describe_skip: (string, @uncurry (unit => unit)) => unit = "describe.skip"
@val
external describe_only: (string, @uncurry (unit => unit)) => unit = "describe.only"

// Why we use uncurry here: https://rescript-lang.org/docs/manual/latest/bind-to-js-function#extra-solution
//    TLDR: then we don't need to use the `.` for uncurrying (https://rescript-lang.org/docs/manual/latest/function#uncurried-function)
@val
external it: (string, @uncurry (unit => 'unitOrPromiseReturnBasedOnTest)) => unit = "it"
@val
external it_only: (string, @uncurry (unit => 'unitOrPromiseReturnBasedOnTest)) => unit = "it.only"
@val
external it_skip: (string, @uncurry (unit => 'unitOrPromiseReturnBasedOnTest)) => unit = "it.skip"
@val
external before_each: (@uncurry (unit => 'unitOrPromiseReturnBasedOnTest)) => unit = "beforeEach"
@val
external before: (@uncurry (unit => 'unitOrPromiseReturnBasedOnTest)) => unit = "before"
