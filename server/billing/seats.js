import crypto from 'node:crypto';
import { EXTRA_SEAT_ADDON, PLANS, seatPlanKey } from './plans.js';

/* Seats, kept deliberately small.
 *
 * A recruiter team is one row in db.teams: the owner plus a members list.
 * Recruiters who never invite anyone never get a row at all — they behave
 * exactly as they always have. That is what keeps this additive: no existing
 * account changes shape, and nothing has to be migrated. */

/** The team a recruiter belongs to, whether they own it or were invited. */
export function findTeam(db, userId) {
  return (db.teams || []).find((team) =>
    team.ownerUserId === userId || team.members.some((m) => m.userId === userId));
}

/** Idempotent — the owner is always member #1, and is always active. */
export function getOrCreateTeam(db, ownerUserId) {
  if (!Array.isArray(db.teams)) db.teams = [];
  const existing = findTeam(db, ownerUserId);
  if (existing) return existing;
  const now = Date.now();
  const team = {
    id: crypto.randomUUID(),
    ownerUserId,
    members: [{ userId: ownerUserId, role: 'owner', status: 'active', joinedAt: now }],
    extraSeats: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.teams.push(team);
  return team;
}

/** Seats a plan grants, including any purchased add-on seats. Accepts old plan
 *  codes as well as catalogue keys — see `seatPlanKey`. */
export function seatsAllowed(planCode, extraSeats = 0) {
  const plan = PLANS[seatPlanKey(planCode)];
  return plan.seats + (extraSeats || 0) * EXTRA_SEAT_ADDON.seats;
}

export function activeMembers(team) {
  return team ? team.members.filter((m) => m.status === 'active') : [];
}

/**
 * Add someone to the team. If every seat is taken they join read-only rather
 * than being refused — the brief's rule is that people are never deleted or
 * locked out, only downgraded to read-only.
 */
export function addMember(db, team, userId, planKey) {
  if (team.members.some((m) => m.userId === userId)) return { outcome: 'already_member' };
  const allowed = seatsAllowed(planKey, team.extraSeats);
  const status = activeMembers(team).length < allowed ? 'active' : 'readonly';
  team.members.push({ userId, role: 'member', status, joinedAt: Date.now() });
  team.updatedAt = Date.now();
  return { outcome: status === 'active' ? 'added' : 'added_readonly', status };
}

/**
 * Fit the team to however many seats it currently has. Nobody is ever removed:
 * the earliest-joined keep the active seats (owner always first) and everyone
 * beyond the limit becomes read-only. Re-subscribing widens the limit and this
 * same function promotes them back, in the same order.
 */
export function reconcileSeats(team, planKey) {
  if (!team) return;
  const allowed = seatsAllowed(planKey, team.extraSeats);
  const ordered = [...team.members].sort((a, b) => {
    if (a.role === 'owner') return -1;
    if (b.role === 'owner') return 1;
    return (a.joinedAt || 0) - (b.joinedAt || 0);
  });
  ordered.forEach((member, index) => { member.status = index < allowed ? 'active' : 'readonly'; });
  team.updatedAt = Date.now();
}
