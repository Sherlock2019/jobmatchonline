import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Swipe, UserProfile, JobPost, Match, ExperienceLevel } from '../types';

export function calculateMatchScore(p1: { skills?: string[], culturalSkills?: string[], languages?: string[] }, p2: { skills?: string[], culturalSkills?: string[], languages?: string[] }) {
  let score = 0;
  
  // Skills match
  const s1 = p1.skills || [];
  const s2 = p2.skills || [];
  const skillMatches = s1.filter(s => s2.includes(s)).length;
  score += skillMatches * 10;

  // Cultural match
  const c1 = p1.culturalSkills || [];
  const c2 = p2.culturalSkills || [];
  const culturalMatches = c1.filter(c => c2.includes(c)).length;
  score += culturalMatches * 15; // Cultural fit weighted higher

  // Language match
  const l1 = p1.languages || [];
  const l2 = p2.languages || [];
  const languageMatches = l1.filter(l => l2.includes(l)).length;
  score += languageMatches * 5;

  return score;
}

export async function getJobsForCandidate(candidate: UserProfile, filters?: { experience?: ExperienceLevel[]; skills?: string[] }) {
  const jobsRef = collection(db, 'jobs');
  try {
    let q = query(jobsRef, limit(100));
    const snap = await getDocs(q);
    let jobs = snap.docs.map(d => ({ id: d.id, ...d.data() } as JobPost));

    // Calculate match scores
    const scoredJobs = jobs.map(job => ({
      ...job,
      score: calculateMatchScore(
        { skills: candidate.skills, culturalSkills: candidate.culturalSkills, languages: candidate.languages },
        { skills: job.requiredSkills, culturalSkills: job.culturalSkills, languages: job.requiredLanguages }
      )
    }));

    // Sort by score descending
    let filteredJobs = scoredJobs.sort((a, b) => b.score - a.score);

    if (filters) {
      if (filters.experience && filters.experience.length > 0) {
        filteredJobs = filteredJobs.filter(j => filters.experience?.includes(j.experienceLevel));
      }
      if (filters.skills && filters.skills.length > 0) {
        filteredJobs = filteredJobs.filter(j => filters.skills?.some(s => j.requiredSkills.includes(s)));
      }
    }

    return filteredJobs;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'jobs');
    return [];
  }
}

export async function getCandidatesForEmployer(employer: UserProfile, filters?: { experience?: ExperienceLevel[]; skills?: string[] }) {
  const profilesRef = collection(db, 'profiles');
  try {
    let q = query(profilesRef, where('role', '==', 'candidate'), limit(100));
    const snap = await getDocs(q);
    let candidates = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));

    // Calculate match scores
    const scoredCandidates = candidates.map(candidate => ({
      ...candidate,
      score: calculateMatchScore(
        { skills: employer.skills, culturalSkills: employer.culturalSkills, languages: employer.languages },
        { skills: candidate.skills, culturalSkills: candidate.culturalSkills, languages: candidate.languages }
      )
    }));

    // Sort by score descending
    let filteredCandidates = scoredCandidates.sort((a, b) => b.score - a.score);

    if (filters) {
      if (filters.experience && filters.experience.length > 0) {
        filteredCandidates = filteredCandidates.filter(c => c.experienceLevel && filters.experience?.includes(c.experienceLevel));
      }
      if (filters.skills && filters.skills.length > 0) {
        filteredCandidates = filteredCandidates.filter(c => c.skills && filters.skills?.some(s => (c.skills || []).includes(s)));
      }
    }

    return filteredCandidates;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'profiles');
    return [];
  }
}

export async function handleSwipeAction(fromUid: string, toId: string, type: Swipe['type'], direction: Swipe['direction']) {
  const swipesRef = collection(db, 'swipes');
  
  try {
    // Save swipe
    await addDoc(swipesRef, {
      fromUid,
      toId,
      type,
      direction,
      timestamp: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'swipes');
  }

  if (direction === 'like') {
    // Check for mutual match
    const reverseType = type === 'candidate-to-job' ? 'employer-to-candidate' : 'candidate-to-job';
    
    // 1. Get the target info
    let targetUid = toId;
    if (type === 'candidate-to-job') {
      try {
        const jobSnap = await getDoc(doc(db, 'jobs', toId));
        if (jobSnap.exists()) targetUid = jobSnap.data().employerUid;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `jobs/${toId}`);
      }
    }

    // 2. Query for reverse swipe
    try {
      const q = query(
        swipesRef, 
        where('fromUid', '==', targetUid),
        where('toId', '==', fromUid),
        where('direction', '==', 'like')
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        // It's a match!
        const matchesRef = collection(db, 'matches');
        const candidateUid = type === 'candidate-to-job' ? fromUid : toId;
        const employerUid = type === 'candidate-to-job' ? targetUid : fromUid;
        const jobPostId = type === 'candidate-to-job' ? toId : snap.docs[0].data().toId; 
        
        await addDoc(matchesRef, {
          candidateUid,
          employerUid,
          jobPostId,
          timestamp: Date.now()
        });
        return true; // Match found
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'matches');
    }
  }

  return false;
}
