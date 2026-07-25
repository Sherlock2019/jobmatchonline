import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../api';

type Overview = Awaited<ReturnType<typeof api.adminAnalyticsOverview>>;

export function AdminAnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => { api.adminAnalyticsOverview().then(setOverview).catch(() => undefined); }, []);

  if (!overview) return <div className="page"><Loader2 className="spin" size={20} /></div>;

  return <div className="page admin-analytics-page">
    <div className="page-title"><div><span className="overline">Admin</span><h1>Analytics</h1><p>Marketplace snapshot — real accounts only, seed/demo data excluded.</p></div></div>

    <section className="admin-section">
      <h3>Candidates</h3>
      <div className="admin-stat-row">
        <div className="admin-stat"><strong>{overview.totalCandidates}</strong><span>Total candidates</span></div>
        <div className="admin-stat"><strong>{overview.newCandidates7d}</strong><span>New — last 7 days</span></div>
        <div className="admin-stat"><strong>{overview.newCandidates30d}</strong><span>New — last 30 days</span></div>
      </div>
    </section>

    <section className="admin-section">
      <h3>Recruiters</h3>
      <div className="admin-stat-row">
        <div className="admin-stat"><strong>{overview.totalRecruiters}</strong><span>Total recruiters</span></div>
        <div className="admin-stat"><strong>{overview.newRecruiters7d}</strong><span>New — last 7 days</span></div>
        <div className="admin-stat"><strong>{overview.newRecruiters30d}</strong><span>New — last 30 days</span></div>
      </div>
    </section>

    <section className="admin-section">
      <h3>Jobs &amp; matching activity</h3>
      <div className="admin-stat-row">
        <div className="admin-stat"><strong>{overview.activeJobs}</strong><span>Active jobs</span></div>
        <div className="admin-stat"><strong>{overview.totalJobs}</strong><span>Total jobs ever posted</span></div>
        <div className="admin-stat"><strong>{overview.totalMatches}</strong><span>Total matches</span></div>
        <div className="admin-stat"><strong>{overview.newMatches7d}</strong><span>New matches — last 7 days</span></div>
        <div className="admin-stat"><strong>{overview.totalMessages}</strong><span>Total messages sent</span></div>
      </div>
    </section>
  </div>;
}
