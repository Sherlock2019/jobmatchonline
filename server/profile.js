/**
 * Profile model helpers: sanitizing partial profile updates and computing
 * the completeness % shown on profile pages. Pure functions, no I/O.
 */
import { ValidationError } from './matching.js';

const has = (value) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);

const str = (value, max = 500) => (typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : undefined);
const num = (value, min, max) => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined);
const strArray = (value, maxItems = 40, maxLen = 120) => (Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === 'string' && item.trim() && item.length <= maxLen).map((item) => item.trim()))].slice(0, maxItems) : undefined);

/** Store a {lat,lng} coordinate if valid. Shared by candidate + recruiter. */
export function setGeo(target, geo) {
  if (!geo || typeof geo !== 'object') return;
  const lat = num(geo.lat, -90, 90);
  const lng = num(geo.lng, -180, 180);
  if (lat !== undefined && lng !== undefined) target.geo = { lat, lng };
}

function objArray(value, shape, maxItems = 20) {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, maxItems).map((item) => {
    if (typeof item !== 'object' || item === null) return null;
    const clean = {};
    for (const [key, sanitize] of Object.entries(shape)) {
      const sanitized = sanitize(item[key]);
      if (sanitized !== undefined) clean[key] = sanitized;
    }
    return Object.keys(clean).length ? clean : null;
  }).filter(Boolean);
}

const SENIORITIES = ['junior', 'mid', 'senior', 'lead', 'exec'];
const VISIBILITIES = ['all', 'after-swipe', 'paused'];
const WORK_MODES = ['remote', 'hybrid', 'onsite'];
const CONTACT_TYPES = ['whatsapp', 'telegram', 'phone', 'signal', 'wechat', 'zalo', 'email', 'other'];
const AGE_PRIVACY = ['public', 'after-match', 'private'];

/** Whitelist-merge a candidate profile update onto a user. Throws ValidationError on bad shapes. */
export function applyCandidateProfile(user, body) {
  const set = (field, value) => { if (value !== undefined) user[field] = value; };
  set('name', str(body.name, 120));
  set('email', str(body.email, 200));
  set('photo', str(body.photo, 600));
  set('headline', str(body.headline, 160));
  set('phone', str(body.phone, 40));
  set('city', str(body.city, 80));
  set('country', str(body.country, 80));
  set('nationality', str(body.nationality, 60));
  set('birthdate', str(body.birthdate, 10)); // ISO YYYY-MM-DD
  if (body.agePrivacy !== undefined && AGE_PRIVACY.includes(body.agePrivacy)) user.agePrivacy = body.agePrivacy;
  if (body.discloseAge !== undefined) user.discloseAge = Boolean(body.discloseAge);
  set('workAuthorization', str(body.workAuthorization, 120));
  if (body.visaSponsorship !== undefined) user.visaSponsorship = Boolean(body.visaSponsorship);
  set('pronouns', str(body.pronouns, 40));
  if (body.contactChannels !== undefined) {
    user.contactChannels = objArray(body.contactChannels, {
      type: (v) => (CONTACT_TYPES.includes(v) ? v : undefined),
      value: (v) => str(v, 120),
    }, 6)?.filter((channel) => channel.type && channel.value) || [];
  }
  set('distanceRangeKm', num(body.distanceRangeKm, 5, 100));
  setGeo(user, body.geo);
  set('title', str(body.title, 120));
  set('yearsExperience', num(body.yearsExperience, 0, 60));
  if (body.seniority !== undefined) {
    if (!SENIORITIES.includes(body.seniority)) throw new ValidationError('seniority', `seniority must be one of ${SENIORITIES.join(', ')}`);
    user.seniority = body.seniority;
    user.experienceLevel = body.seniority; // keeps the fit-score input in sync
  }
  if (body.skillsDetail !== undefined) {
    const skills = objArray(body.skillsDetail, { name: (v) => str(v, 60), level: (v) => num(v, 1, 5), years: (v) => num(v, 0, 60), lastUsed: (v) => str(v, 20) }, 30) || [];
    user.skillsDetail = skills.filter((skill) => skill.name);
    user.skills = user.skillsDetail.map((skill) => skill.name); // matching still reads names
  }
  if (body.languageDetail !== undefined) {
    const languages = objArray(body.languageDetail, { name: (v) => str(v, 40), level: (v) => str(v, 30) }, 12) || [];
    user.languageDetail = languages.filter((language) => language.name);
    user.languages = user.languageDetail.map((language) => language.name);
  }
  set('industries', strArray(body.industries));
  if (body.workExperience !== undefined) user.workExperience = objArray(body.workExperience, { title: (v) => str(v, 120), company: (v) => str(v, 120), from: (v) => str(v, 20), to: (v) => str(v, 20), description: (v) => str(v, 1000) });
  if (body.education !== undefined) user.education = objArray(body.education, { school: (v) => str(v, 140), degree: (v) => str(v, 140), from: (v) => str(v, 20), to: (v) => str(v, 20) });
  set('certifications', strArray(body.certifications));
  // Human stack (card 4) — how the candidate presents as a person.
  set('presentation', str(body.presentation, 2000));
  set('mindset', strArray(body.mindset, 8, 40));
  set('humanSkills', strArray(body.humanSkills, 8, 40));
  set('workingPrefer', strArray(body.workingPrefer, 8, 80));
  set('workingAvoid', strArray(body.workingAvoid, 8, 80));
  set('interests', strArray(body.interests, 10, 40));
  set('motto', str(body.motto, 160));
  set('favoriteSong', str(body.favoriteSong, 400));
  // Recruiter recommendations (card 5) — the candidate chooses what to display.
  if (body.recommendations !== undefined) {
    const ratingsOf = (r) => {
      if (!r || typeof r !== 'object') return undefined;
      const clean = {};
      for (const key of ['technical', 'communication', 'reliability', 'collaboration', 'leadership']) {
        const n = num(r[key], 0, 5); if (n !== undefined) clean[key] = n;
      }
      return Object.keys(clean).length ? clean : undefined;
    };
    user.recommendations = objArray(body.recommendations, {
      recruiterName: (v) => str(v, 120), company: (v) => str(v, 120), role: (v) => str(v, 120),
      text: (v) => str(v, 1200), date: (v) => str(v, 20), photo: (v) => str(v, 600),
      relationship: (v) => str(v, 60), candidateResponse: (v) => str(v, 600),
      wouldWorkAgain: (v) => (typeof v === 'boolean' ? v : undefined),
      verified: (v) => (typeof v === 'boolean' ? v : undefined),
      ratings: ratingsOf,
    }, 12)?.filter((rec) => rec.recruiterName && rec.text) || [];
  }
  if (body.links !== undefined && typeof body.links === 'object' && body.links !== null) {
    user.links = Object.fromEntries(['github', 'portfolio', 'website', 'linkedin'].map((key) => [key, str(body.links[key], 300)]).filter(([, value]) => value));
  }
  if (body.preferences !== undefined && typeof body.preferences === 'object' && body.preferences !== null) {
    const p = body.preferences;
    const prefs = { ...(user.preferences || {}) };
    if (p.desiredRoles !== undefined) prefs.desiredRoles = strArray(p.desiredRoles) || [];
    if (p.employmentTypes !== undefined) prefs.employmentTypes = strArray(p.employmentTypes, 6, 30) || [];
    if (p.workMode !== undefined && typeof p.workMode === 'object' && p.workMode !== null) {
      if (!WORK_MODES.includes(p.workMode.mode)) throw new ValidationError('workMode', `workMode.mode must be one of ${WORK_MODES.join(', ')}`);
      prefs.workMode = { mode: p.workMode.mode, ...(p.workMode.mode === 'hybrid' ? { hybridDays: num(p.workMode.hybridDays, 0, 5) ?? 2 } : {}) };
    }
    if (p.salary !== undefined && typeof p.salary === 'object' && p.salary !== null) {
      const min = num(p.salary.min, 0, 10000000); const max = num(p.salary.max, 0, 10000000);
      if (min !== undefined && max !== undefined && min > max) throw new ValidationError('salary', 'salary.min cannot exceed salary.max');
      prefs.salary = { min, max, currency: str(p.salary.currency, 8) || 'USD', period: str(p.salary.period, 12) || 'year', negotiable: Boolean(p.salary.negotiable) };
    }
    if (p.availability !== undefined) prefs.availability = str(p.availability, 40);
    if (p.noticePeriod !== undefined) prefs.noticePeriod = str(p.noticePeriod, 40);
    if (p.travel !== undefined) prefs.travel = str(p.travel, 40);
    if (p.relocate !== undefined && typeof p.relocate === 'object' && p.relocate !== null) prefs.relocate = { open: Boolean(p.relocate.open), locations: strArray(p.relocate.locations, 12, 80) || [] };
    if (p.companySize !== undefined) prefs.companySize = str(p.companySize, 30);
    if (p.industries !== undefined) prefs.industries = strArray(p.industries, 12, 40) || [];
    if (p.workStyle !== undefined) prefs.workStyle = strArray(p.workStyle, 6, 40) || [];
    user.preferences = prefs;
  }
  if (body.coverLetter !== undefined) { user.documents = { ...(user.documents || {}) }; user.documents.coverLetter = str(body.coverLetter, 4000) ?? ''; }
  if (body.privacy !== undefined && typeof body.privacy === 'object' && body.privacy !== null) {
    const privacy = { ...(user.privacy || {}) };
    if (body.privacy.visibility !== undefined) {
      if (!VISIBILITIES.includes(body.privacy.visibility)) throw new ValidationError('visibility', `visibility must be one of ${VISIBILITIES.join(', ')}`);
      privacy.visibility = body.privacy.visibility;
    }
    if (body.privacy.blockedCompanies !== undefined) privacy.blockedCompanies = strArray(body.privacy.blockedCompanies, 30, 80) || [];
    if (body.privacy.openToWork !== undefined) privacy.openToWork = Boolean(body.privacy.openToWork);
    user.privacy = privacy;
  }
  if (body.onboarding !== undefined) user.onboarding = Boolean(body.onboarding);
  if (body.availability !== undefined) user.availability = str(body.availability, 40);
  return user;
}

/** Whitelist-merge a recruiter (company or headhunter) profile update. */
export function applyRecruiterProfile(user, body) {
  const set = (field, value) => { if (value !== undefined) user[field] = value; };
  if (body.kind !== undefined) {
    if (!['company', 'headhunter'].includes(body.kind)) throw new ValidationError('kind', 'kind must be company or headhunter');
    user.kind = body.kind;
  }
  set('name', str(body.name, 120));
  set('email', str(body.email, 200));
  set('photo', str(body.photo, 600));
  set('title', str(body.title, 120));
  set('phone', str(body.phone, 40));
  set('company', str(body.company, 140));
  set('companyLogo', str(body.companyLogo, 600));
  set('website', str(body.website, 300));
  set('industry', str(body.industry, 80));
  if (body.companySize !== undefined) set('companySize', str(body.companySize, 30));
  set('headquarters', str(body.headquarters, 120));
  set('officeLocations', strArray(body.officeLocations, 15, 80));
  setGeo(user, body.geo);
  set('foundedYear', num(body.foundedYear, 1800, 2100));
  set('about', str(body.about, 2000));
  set('benefits', strArray(body.benefits, 20, 60));
  set('techStack', strArray(body.techStack, 25, 40));
  set('linkedinUrl', str(body.linkedinUrl, 300));
  set('specializations', strArray(body.specializations, 15, 60));
  set('regions', strArray(body.regions, 15, 60));
  set('clients', strArray(body.clients, 20, 100));
  set('contactName', str(body.contactName, 120));
  set('contactEmail', str(body.contactEmail, 200));
  set('calendarLink', str(body.calendarLink, 300));
  if (body.onboarding !== undefined) user.onboarding = Boolean(body.onboarding);
  return user;
}

/** Candidate completeness: required fields dominate, optionals top it up. */
export function candidateCompleteness(user) {
  const required = [
    user.name, user.headline, user.email, user.city, user.country, user.distanceRangeKm,
    user.title, user.yearsExperience, user.seniority,
    (user.skillsDetail || []).length >= 3 || (user.skills || []).length >= 3,
    user.preferences?.desiredRoles?.length, user.preferences?.employmentTypes?.length,
    user.preferences?.workMode?.mode, user.preferences?.salary?.min !== undefined && user.preferences?.salary?.max !== undefined,
    user.preferences?.availability, user.documents?.resume, user.privacy?.visibility, user.privacy?.openToWork !== undefined,
  ];
  const optional = [
    user.photo, user.phone, (user.languageDetail || user.languages || []).length,
    (user.industries || []).length, (user.workExperience || []).length, (user.education || []).length,
    (user.certifications || []).length, user.links && Object.keys(user.links).length,
    user.preferences?.relocate, user.preferences?.companySize, (user.preferences?.workStyle || []).length,
    user.documents?.coverLetter, (user.privacy?.blockedCompanies || []).length,
    user.nationality, (user.contactChannels || []).length, user.presentation,
    (user.mindset || []).length, user.favoriteSong, (user.recommendations || []).length,
  ];
  const requiredScore = required.filter((value) => has(value) || value === true).length / required.length;
  const optionalScore = optional.filter((value) => has(value) || value === true || (typeof value === 'number' && value > 0)).length / optional.length;
  return Math.round(100 * (0.7 * requiredScore + 0.3 * optionalScore));
}

/** Recruiter completeness (company or headhunter branch). */
export function recruiterCompleteness(user) {
  const required = user.kind === 'headhunter'
    ? [user.company, user.name, user.photo, user.title, (user.specializations || []).length, (user.regions || []).length, user.contactName, user.contactEmail]
    : [user.company, user.website, user.industry, user.companySize, user.headquarters, (user.officeLocations || []).length, user.about, user.contactName, user.contactEmail];
  const optional = user.kind === 'headhunter'
    ? [(user.clients || []).length, user.linkedinUrl, user.phone, user.calendarLink]
    : [user.companyLogo, user.foundedYear, (user.benefits || []).length, (user.techStack || []).length, user.linkedinUrl, user.phone, user.calendarLink];
  const requiredScore = required.filter((value) => has(value) || (typeof value === 'number' && value > 0)).length / required.length;
  const optionalScore = optional.filter((value) => has(value) || (typeof value === 'number' && value > 0)).length / optional.length;
  return Math.round(100 * (0.7 * requiredScore + 0.3 * optionalScore));
}
