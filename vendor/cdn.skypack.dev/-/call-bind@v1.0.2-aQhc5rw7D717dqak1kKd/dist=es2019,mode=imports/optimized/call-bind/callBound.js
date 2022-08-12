import GetIntrinsic from "/-/get-intrinsic@v1.1.1-vDQgt4R7li5Q5aDeDi2i/dist=es2019,mode=imports/optimized/get-intrinsic.js";
import {c as callBind} from "../common/index-46ba46fb.js";
import "/-/function-bind@v1.1.1-I2U4xSizU1p8sDZSqt3X/dist=es2019,mode=imports/optimized/function-bind.js";
var $indexOf = callBind(GetIntrinsic("String.prototype.indexOf"));
var callBound = function callBoundIntrinsic(name, allowMissing) {
  var intrinsic = GetIntrinsic(name, !!allowMissing);
  if (typeof intrinsic === "function" && $indexOf(name, ".prototype.") > -1) {
    return callBind(intrinsic);
  }
  return intrinsic;
};
export default callBound;
