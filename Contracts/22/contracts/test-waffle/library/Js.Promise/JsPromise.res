type t<+'a> = Js.Promise.t<'a>

@new
external make: ((@uncurry (. 'a) => unit, (. 'e) => unit) => unit) => t<'a> = "Promise"

@val @scope("Promise")
external resolve: 'a => t<'a> = "resolve"

@send external then: (t<'a>, @uncurry ('a => t<'b>)) => t<'b> = "then"
@send external then_: (t<'a>, @uncurry ('a => t<'b>)) => t<'b> = "then"

@send external finally: (t<'a>, unit => unit) => t<'a> = "finally"

@scope("Promise") @val
external reject: exn => t<_> = "reject"

@scope("Promise") @val
external all: array<t<'a>> => t<array<'a>> = "all"

@scope("Promise") @val
external all2: ((t<'a>, t<'b>)) => t<('a, 'b)> = "all"

@scope("Promise") @val
external all3: ((t<'a>, t<'b>, t<'c>)) => t<('a, 'b, 'c)> = "all"

@scope("Promise") @val
external all4: ((t<'a>, t<'b>, t<'c>, t<'d>)) => t<('a, 'b, 'c, 'd)> = "all"

@scope("Promise") @val
external all5: ((t<'a>, t<'b>, t<'c>, t<'d>, t<'e>)) => t<('a, 'b, 'c, 'd, 'e)> = "all"

@scope("Promise") @val
external all6: ((t<'a>, t<'b>, t<'c>, t<'d>, t<'e>, t<'f>)) => t<('a, 'b, 'c, 'd, 'e, 'f)> = "all"

@scope("Promise") @val
external all7: ((t<'a>, t<'b>, t<'c>, t<'d>, t<'e>, t<'f>, t<'g>)) => t<(
  'a,
  'b,
  'c,
  'd,
  'e,
  'f,
  'g,
)> = "all"

@send
external _catch: (t<'a>, @uncurry (exn => t<'a>)) => t<'a> = "catch"

let catch = (promise, callback) => {
  _catch(promise, err => {
    // In future versions, we could use the better version:
    callback(Js.Exn.anyToExnInternal(err))

    // // for now we need to bring our own JsError type
    // let v = if Js.Exn.isCamlExceptionOrOpenVariant(err) {
    //   err
    // } else {
    //   JsError(unsafeToJsExn(err))
    // }
    // callback(v)
  })
}

@scope("Promise") @val
external race: array<t<'a>> => t<'a> = "race"

// Added utilitys (not in upstream)
@send
external map: (t<'a>, @uncurry ('a => 'b)) => t<'b> = "then"
