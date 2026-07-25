import { motion } from 'motion/react';
import { X } from 'lucide-react';

/** Minimal Code of Conduct: the policy text itself plus where to report a
 * violation (the existing fraud/scam report queue) — no versioning table,
 * acceptance-audit log, or separate moderation module. See admin plan notes
 * on keeping this scoped for a single-admin operation. */
export function ConductModal({ onClose }: { onClose: () => void }) {
  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="coach-modal conduct-modal" initial={{ y: 26, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
      <header className="coach-head"><div><span className="overline">Policy</span><h2>JobsMatchNow Code of Conduct</h2></div></header>
      <div className="coach-body conduct-body">
        <p>JobsMatchNow is a professional recruitment community. Candidates and recruiters must communicate honestly, respectfully, and professionally.</p>
        <h4>1. Communicate respectfully</h4>
        <p>Use professional, courteous language. No insults, threats, or harassment.</p>
        <h4>2. No discrimination</h4>
        <p>Employment decisions and feedback must be based on legitimate job-related criteria — never race, gender, age, religion, disability, or other protected characteristics.</p>
        <h4>3. Be honest</h4>
        <p>Recruiters must post genuine vacancies with accurate salary and company information. Candidates must provide accurate experience and qualifications.</p>
        <h4>4. Never request improper payments</h4>
        <p>Recruiters and employers must never ask a candidate to pay application fees, interview fees, deposits, or any money to get a job. Report this immediately.</p>
        <h4>5. Protect privacy</h4>
        <p>Use personal information only for legitimate recruitment purposes. Don't share CVs, messages, or contact details without authorization.</p>
        <h4>6. No harassment or pressure</h4>
        <p>No repeated unwanted messages, romantic advances, or pressure to accept an offer immediately.</p>
        <h4>7. Report concerns</h4>
        <p>If something feels wrong — a fake job, a payment request, harassment, or anything else — use the Report option on the job, conversation, or profile involved. Reports go straight to our team for review.</p>
        <h4>Consequences</h4>
        <p>Depending on severity, we may warn, restrict messaging or job posting, suspend, or permanently disable an account. Serious fraud or safety issues can lead to immediate suspension. If you believe an action was a mistake, contact support.</p>
      </div>
    </motion.div>
  </motion.div>;
}
