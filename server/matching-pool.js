// "sample" is a distinct category from "demo": a small set of starter
// candidates/jobs auto-generated for real accounts (see generateStarterContent
// in index.js) so a brand-new real recruiter/candidate has something relevant
// to see immediately. Unlike demo:true records, sample:true records
// deliberately cross the demo/live wall in both directions -- they're real
// enough to appear in a live account's pool, but still visually labeled
// "DEMO" in the UI so nobody mistakes one for an actual person or employer.
export function matchingPool(db, viewer) {
  const demo = viewer.demo === true;
  // A sample job's employer (e.g. Sarah, the demo recruiter persona, posting
  // a starter job for a real candidate) needs to be reachable in that real
  // viewer's pool too -- otherwise the "employer liked you" swipe it comes
  // with would be filtered out and never show up.
  const sampleJobEmployerIds = new Set(db.jobs.filter((job) => job.sample === true).map((job) => job.employerId));
  const users = db.users.filter((user) => (user.demo === true) === demo || user.sample === true || sampleJobEmployerIds.has(user.id));
  const userIds = new Set(users.map((user) => user.id));
  const jobs = db.jobs.filter((job) => {
    if (job.sample === true) return true;
    const employer = db.users.find((user) => user.id === job.employerId);
    const jobIsDemo = job.demo === true || employer?.demo === true;
    return jobIsDemo === demo && userIds.has(job.employerId);
  });
  const jobIds = new Set(jobs.map((job) => job.id));
  const swipes = db.swipes.filter((swipe) => userIds.has(swipe.actorId)
    && (swipe.targetType === 'job' ? jobIds.has(swipe.targetId) : userIds.has(swipe.targetId)));
  const matches = db.matches.filter((match) => userIds.has(match.candidateId)
    && userIds.has(match.employerId)
    && jobIds.has(match.jobId));

  return { users, userIds, jobs, jobIds, swipes, matches };
}

export function targetIsInMatchingPool(db, actor, targetType, targetId) {
  const pool = matchingPool(db, actor);
  return targetType === 'job' ? pool.jobIds.has(targetId) : pool.userIds.has(targetId);
}
