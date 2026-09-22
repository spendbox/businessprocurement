/**
 * Features that are built but not switched on yet.
 *
 * The buyer/merchant portal works end to end, but it is not wanted in front
 * of customers at this stage. Rather than delete it and rebuild it later,
 * it is gated here: the pages 404, the links are gone, and turning it on is
 * one environment variable.
 */
export const portalEnabled = () =>
  process.env.NEXT_PUBLIC_PORTAL_ENABLED === "true";
