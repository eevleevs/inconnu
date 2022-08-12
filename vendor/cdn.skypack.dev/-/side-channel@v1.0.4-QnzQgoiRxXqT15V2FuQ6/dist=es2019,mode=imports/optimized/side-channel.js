import GetIntrinsic from "/-/get-intrinsic@v1.1.1-vDQgt4R7li5Q5aDeDi2i/dist=es2019,mode=imports/optimized/get-intrinsic.js";
import callBound2 from "/-/call-bind@v1.0.2-aQhc5rw7D717dqak1kKd/dist=es2019,mode=imports/optimized/call-bind/callBound.js";
import inspect from "/-/object-inspect@v1.12.0-IB76S71JAEzSjyyJcpt5/dist=es2019,mode=imports/optimized/object-inspect.js";
var $TypeError = GetIntrinsic("%TypeError%");
var $WeakMap = GetIntrinsic("%WeakMap%", true);
var $Map = GetIntrinsic("%Map%", true);
var $weakMapGet = callBound2("WeakMap.prototype.get", true);
var $weakMapSet = callBound2("WeakMap.prototype.set", true);
var $weakMapHas = callBound2("WeakMap.prototype.has", true);
var $mapGet = callBound2("Map.prototype.get", true);
var $mapSet = callBound2("Map.prototype.set", true);
var $mapHas = callBound2("Map.prototype.has", true);
var listGetNode = function(list, key) {
  for (var prev = list, curr; (curr = prev.next) !== null; prev = curr) {
    if (curr.key === key) {
      prev.next = curr.next;
      curr.next = list.next;
      list.next = curr;
      return curr;
    }
  }
};
var listGet = function(objects, key) {
  var node = listGetNode(objects, key);
  return node && node.value;
};
var listSet = function(objects, key, value) {
  var node = listGetNode(objects, key);
  if (node) {
    node.value = value;
  } else {
    objects.next = {
      key,
      next: objects.next,
      value
    };
  }
};
var listHas = function(objects, key) {
  return !!listGetNode(objects, key);
};
var sideChannel = function getSideChannel() {
  var $wm;
  var $m;
  var $o;
  var channel = {
    assert: function(key) {
      if (!channel.has(key)) {
        throw new $TypeError("Side channel does not contain " + inspect(key));
      }
    },
    get: function(key) {
      if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
        if ($wm) {
          return $weakMapGet($wm, key);
        }
      } else if ($Map) {
        if ($m) {
          return $mapGet($m, key);
        }
      } else {
        if ($o) {
          return listGet($o, key);
        }
      }
    },
    has: function(key) {
      if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
        if ($wm) {
          return $weakMapHas($wm, key);
        }
      } else if ($Map) {
        if ($m) {
          return $mapHas($m, key);
        }
      } else {
        if ($o) {
          return listHas($o, key);
        }
      }
      return false;
    },
    set: function(key, value) {
      if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
        if (!$wm) {
          $wm = new $WeakMap();
        }
        $weakMapSet($wm, key, value);
      } else if ($Map) {
        if (!$m) {
          $m = new $Map();
        }
        $mapSet($m, key, value);
      } else {
        if (!$o) {
          $o = {key: {}, next: null};
        }
        listSet($o, key, value);
      }
    }
  };
  return channel;
};
export default sideChannel;
