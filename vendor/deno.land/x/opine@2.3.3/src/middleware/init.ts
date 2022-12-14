import type {
  NextFunction,
  Opine,
  OpineRequest,
  OpineResponse,
} from "../../src/types.ts";

const create = Object.create;
const setPrototypeOf = Object.setPrototypeOf;

/**
 * Initialization middleware, exposing the
 * request and response to each other, setting
 * locals if not defined, as well as defaulting
 * the X-Powered-By header field.
 *
 * @param {Opine} app
 * @return {Function} init middleware
 * @private
 */
export const init = function (app: Opine) {
  return function opineInit(
    req: OpineRequest,
    res: OpineResponse,
    next: NextFunction,
  ) {
    if (app.enabled("x-powered-by")) res.set("X-Powered-By", "Opine");

    req.res = res;
    res.req = req;
    req.next = next;

    setPrototypeOf(req, app.request);
    setPrototypeOf(res, app.response);

    // Deno 1.9.0 introduced a change which restricted the interaction with
    // the prototype object requiring properties to be manually copied in
    // this fashion.
    req.app = app.request.app;
    res.app = app.response.app;
    res.locals = res.locals || create(null);

    next();
  };
};
