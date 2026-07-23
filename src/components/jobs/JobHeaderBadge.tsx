import { BadgeCheck, BriefcaseBusiness, MapPin } from 'lucide-react';
import { apiBase } from '../../api';
import type { Job } from '../../types';

function assetUrl(value: string) {
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${apiBase}${value.startsWith('/') ? '' : '/'}${value}`;
}

function workMode(job: Job) {
  if (job.workMode === 'Remote') return job.remoteScope === 'country' ? `Remote · ${job.country || 'country'}` : 'Remote';
  if (job.workMode === 'Hybrid' && job.hybridDays) return `Hybrid · ${job.hybridDays} days/week`;
  return job.workMode;
}

function statusLabel(job: Job) {
  if (job.verified) return 'Verified job';
  if (job.createdAt && Date.now() - job.createdAt < 72 * 60 * 60 * 1000) return 'New';
  if (job.urgency) return job.urgency;
  if (job.status?.toLowerCase() === 'active') return 'Actively hiring';
  return '';
}

export function CompanyLogoMark({ job, small = false }: { job: Job; small?: boolean }) {
  return <span className={small ? 'job-company-mark small' : 'job-company-mark'}>
    {job.companyLogo
      ? <img src={assetUrl(job.companyLogo)} alt={`${job.company} logo`} />
      : <BriefcaseBusiness aria-hidden="true" size={small ? 16 : 21} />}
  </span>;
}

export function JobHeaderBadge({ job, compact = false, actions, className = '' }: {
  job: Job;
  compact?: boolean;
  actions?: React.ReactNode;
  className?: string;
}) {
  const status = statusLabel(job);
  return <header className={`job-header-badge${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`}>
    <div className="job-header-primary">
      <CompanyLogoMark job={job} small={compact} />
      <div className="job-header-copy">
        <h2>{job.title}{job.verified && <BadgeCheck aria-label="Verified job" size={17} />}</h2>
        <strong>{job.company}</strong>
      </div>
      {actions && <div className="job-header-actions">{actions}</div>}
    </div>
    {!compact && <div className="job-header-details">
      <span><BriefcaseBusiness size={13} />{workMode(job)} · {job.type}</span>
      {job.location && <span><MapPin size={13} />{job.location}</span>}
      <span className="job-header-salary">{job.salaryHidden ? 'Salary shared after mutual match' : job.salary}</span>
      {job.match?.score !== undefined && <span className="job-header-match">{job.match.score}% match</span>}
      {status && <span className="job-header-status">{status}</span>}
    </div>}
  </header>;
}
