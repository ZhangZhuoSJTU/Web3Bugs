module AwaitThen = {
  let let_ = JsPromise.then_;
};
module Await = {
  let let_ = JsPromise.map;
};
