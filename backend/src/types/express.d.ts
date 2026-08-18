// Augments Express's Request type with the field `requireAuth` (in auth.ts)
// attaches after verifying a JWT. Declaration merging, not a separate type —
// this is what lets `req.userId` be used anywhere without a cast.
declare namespace Express {
  export interface Request {
    userId?: number;
  }
}
