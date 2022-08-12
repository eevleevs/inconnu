import bind from "/-/function-bind@v1.1.1-I2U4xSizU1p8sDZSqt3X/dist=es2019,mode=imports/optimized/function-bind.js";
import GetIntrinsic from "/-/get-intrinsic@v1.1.1-vDQgt4R7li5Q5aDeDi2i/dist=es2019,mode=imports/optimized/get-intrinsic.js";
function createCommonjsModule(fn, basedir, module) {
  return module = {
    path: basedir,
    exports: {},
    require: function(path, base) {
      return commonjsRequire(path, base === void 0 || base === null ? module.path : base);
    }
  }, fn(module, module.exports), module.exports;
}
function commonjsRequire() {
  throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
}
var callBind = createCommonjsModule(function(module) {
  var $apply = GetIntrinsic("%Function.prototype.apply%");
  var $call = GetIntrinsic("%Function.prototype.call%");
  var $reflectApply = GetIntrinsic("%Reflect.apply%", true) || bind.call($call, $apply);
  var $gOPD = GetIntrinsic("%Object.getOwnPropertyDescriptor%", true);
  var $defineProperty = GetIntrinsic("%Object.defineProperty%", true);
  var $max = GetIntrinsic("%Math.max%");
  if ($defineProperty) {
    try {
      $defineProperty({}, "a", {value: 1});
    } catch (e) {
      $defineProperty = null;
    }
  }
  module.exports = function callBind2(originalFunction) {
    var func = $reflectApply(bind, $call, arguments);
    if ($gOPD && $defineProperty) {
      var desc = $gOPD(func, "length");
      if (desc.configurable) {
        $defineProperty(func, "length", {value: 1 + $max(0, originalFunction.length - (arguments.length - 1))});
      }
    }
    return func;
  };
  var applyBind = function applyBind2() {
    return $reflectApply(bind, $apply, arguments);
  };
  if ($defineProperty) {
    $defineProperty(module.exports, "apply", {value: applyBind});
  } else {
    module.exports.apply = applyBind;
  }
});
export {callBind as c};
export default null;
