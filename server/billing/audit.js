import crypto from 'node:crypto';

/** Every billing-affecting action (admin or automated) gets one row here —
 * append-only, never mutated or deleted, so "what happened and why" is always
 * reconstructible. Lives in db.billingEvents, the same JSON-blob-array
 * pattern as every other collection in this store. */
export function logBillingEvent(db, userId, eventType, entityType, entityId, metadata) {
  if (!Array.isArray(db.billingEvents)) db.billingEvents = [];
  const event = {
    id: crypto.randomUUID(),
    userId: userId || null,
    eventType,
    entityType,
    entityId,
    metadata: metadata || {},
    createdAt: Date.now(),
  };
  db.billingEvents.push(event);
  return event;
}
