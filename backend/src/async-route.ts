import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async route handler so a rejected promise reaches Express.
 *
 * Express 4 only catches *synchronous* throws. An `async` handler that
 * rejects — a dropped database connection, a query against a table that
 * isn't there yet — returns a rejected promise that Express never looks at,
 * so it surfaces as an `unhandledRejection`. Node has terminated the process
 * on those since v15, which means one failed query on a public endpoint takes
 * the entire API down: logins, Stripe webhooks, everything, until Railway
 * restarts it. That is a remote denial of service reachable from an anonymous
 * form.
 *
 * Passing the rejection to `next` routes it to the error middleware in
 * index.ts instead: the caller gets a 500, the stack lands in the logs, and
 * the process stays up for everyone else.
 */
export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
