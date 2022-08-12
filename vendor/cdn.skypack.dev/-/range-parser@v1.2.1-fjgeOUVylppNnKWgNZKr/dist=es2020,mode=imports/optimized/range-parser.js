/*!
 * range-parser
 * Copyright(c) 2012-2014 TJ Holowaychuk
 * Copyright(c) 2015-2016 Douglas Christopher Wilson
 * MIT Licensed
 */
var rangeParser_1 = rangeParser;
function rangeParser(size, str, options) {
  if (typeof str !== "string") {
    throw new TypeError("argument str must be a string");
  }
  var index = str.indexOf("=");
  if (index === -1) {
    return -2;
  }
  var arr = str.slice(index + 1).split(",");
  var ranges = [];
  ranges.type = str.slice(0, index);
  for (var i = 0; i < arr.length; i++) {
    var range = arr[i].split("-");
    var start = parseInt(range[0], 10);
    var end = parseInt(range[1], 10);
    if (isNaN(start)) {
      start = size - end;
      end = size - 1;
    } else if (isNaN(end)) {
      end = size - 1;
    }
    if (end > size - 1) {
      end = size - 1;
    }
    if (isNaN(start) || isNaN(end) || start > end || start < 0) {
      continue;
    }
    ranges.push({
      start,
      end
    });
  }
  if (ranges.length < 1) {
    return -1;
  }
  return options && options.combine ? combineRanges(ranges) : ranges;
}
function combineRanges(ranges) {
  var ordered = ranges.map(mapWithIndex).sort(sortByRangeStart);
  for (var j = 0, i = 1; i < ordered.length; i++) {
    var range = ordered[i];
    var current = ordered[j];
    if (range.start > current.end + 1) {
      ordered[++j] = range;
    } else if (range.end > current.end) {
      current.end = range.end;
      current.index = Math.min(current.index, range.index);
    }
  }
  ordered.length = j + 1;
  var combined = ordered.sort(sortByRangeIndex).map(mapWithoutIndex);
  combined.type = ranges.type;
  return combined;
}
function mapWithIndex(range, index) {
  return {
    start: range.start,
    end: range.end,
    index
  };
}
function mapWithoutIndex(range) {
  return {
    start: range.start,
    end: range.end
  };
}
function sortByRangeIndex(a, b) {
  return a.index - b.index;
}
function sortByRangeStart(a, b) {
  return a.start - b.start;
}
export default rangeParser_1;
