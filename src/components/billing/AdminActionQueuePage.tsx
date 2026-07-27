import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, apiBase } from '../../api';
import type { ActionQueueItem } from '../../types';
import { HeroAlt, HeroDefault } from '../landing/HeroBanners';

type BannerChoice = 'default' | 'alt' | 'image';
const noop = () => undefined;

const TYPE_LABEL: Record<ActionQueueItem['type'], string> = {
  report: 'Report', support: 'Support request', payment: 'Payment', fair_use_flag: 'Fair-use flag', trial_ending: 'Trial ending',
};

function fmt(ts: number) { return new Date(ts).toLocaleString(); }

/** Read-only triage view combining open reports, open support requests,
 * pending payments, trials ending soon, and fair-use flags into one sorted
 * list — the actual resolve/confirm/etc. actions still live on their own
 * tabs (Billing, Safety & Support), this is just "what needs attention now". */
export function AdminActionQueuePage() {
  const [items, setItems] = useState<ActionQueueItem[] | null>(null);
  const [banner, setBanner] = useState<BannerChoice | null>(null);
  const [bannerImage, setBannerImage] = useState<{ url: string; updatedAt: number | null } | null>(null);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { api.adminActionQueue().then((res) => setItems(res.items)).catch(() => undefined); }, []);
  const loadSettings = () => api.siteSettings().then((res) => { setBanner(res.activeLandingBanner); setBannerImage(res.bannerImage); }).catch(() => undefined);
  useEffect(() => { loadSettings(); }, []);

  const chooseBanner = (value: BannerChoice) => {
    setBannerSaving(true);
    api.adminSetSiteSettings(value).then((res) => setBanner(res.activeLandingBanner)).catch((error) => alert(`Could not switch banner: ${error.message}. Try logging out and back in.`)).finally(() => setBannerSaving(false));
  };

  const uploadImage = (file: File) => {
    setUploading(true);
    api.adminUploadBannerImage(file).then((res) => setBannerImage(res.bannerImage)).catch((error) => alert(`Upload failed: ${error.message}. Try logging out and back in.`)).finally(() => setUploading(false));
  };

  if (!items) return <div className="page"><Loader2 className="spin" size={20} /></div>;

  return <div className="page admin-queue-page">
    <div className="page-title"><div><span className="overline">Admin</span><h1>Action Queue</h1><p>Everything waiting on you, most urgent first.</p></div></div>

    <section className="admin-section">
      <h3>Landing page banner</h3>
      <p className="muted">Choose which hero banner shows on the public landing page. Changes apply to the live site immediately.</p>
      <div className="banner-preview-grid">
        <div className="banner-preview-card">
          <div className="banner-preview-frame"><div className="banner-preview-scale"><HeroDefault onRegister={noop} onLogin={noop} /></div></div>
          <button type="button" className={banner === 'default' ? 'primary-button small' : 'secondary-button small'} disabled={bannerSaving} onClick={() => chooseBanner('default')}>{banner === 'default' ? 'Currently live' : 'Use this banner'}</button>
        </div>
        <div className="banner-preview-card">
          <div className="banner-preview-frame"><div className="banner-preview-scale"><HeroAlt onRegister={noop} onLogin={noop} /></div></div>
          <button type="button" className={banner === 'alt' ? 'primary-button small' : 'secondary-button small'} disabled={bannerSaving} onClick={() => chooseBanner('alt')}>{banner === 'alt' ? 'Currently live' : 'Use this banner'}</button>
        </div>
        <div className="banner-preview-card">
          <div className="banner-preview-frame banner-preview-image">
            {bannerImage ? <img src={`${apiBase}${bannerImage.url}`} alt="Custom uploaded banner" /> : <span className="muted">No image uploaded yet</span>}
          </div>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadImage(file); event.target.value = ''; }} />
          <div className="admin-actions">
            <button type="button" className="secondary-button small" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? 'Uploading…' : bannerImage ? 'Replace image' : 'Upload image'}</button>
            <button type="button" className={banner === 'image' ? 'primary-button small' : 'secondary-button small'} disabled={bannerSaving || !bannerImage} onClick={() => chooseBanner('image')}>{banner === 'image' ? 'Currently live' : 'Use this banner'}</button>
          </div>
        </div>
      </div>
    </section>

    {items.length === 0 ? <p className="muted">Nothing needs attention right now.</p> : <table className="admin-table">
      <thead><tr><th>Priority</th><th>Type</th><th>Summary</th><th>From</th><th>When</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id}>
        <td><span className={`billing-status-pill queue-priority-${item.priority}`}>{item.priority}</span></td>
        <td>{TYPE_LABEL[item.type]}</td>
        <td>{item.summary}{item.detail && <><br /><small className="muted">{item.detail}</small></>}</td>
        <td>{item.submittedBy}</td>
        <td>{fmt(item.createdAt)}</td>
      </tr>)}</tbody>
    </table>}
  </div>;
}
