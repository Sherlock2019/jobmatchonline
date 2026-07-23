export function matchingPool(db, viewer) {
  const demo = viewer.demo === true;
  const users = db.users.filter((user) => (user.demo === true) === demo);
  const userIds = new Set(users.map((user) => user.id));
  const jobs = db.jobs.filter((job) => {
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
