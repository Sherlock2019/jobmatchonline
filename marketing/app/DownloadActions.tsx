"use client";

import { useEffect, useState } from "react";
import { Apple, Check, Download, Laptop, MonitorSmartphone, Play, Smartphone } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function DownloadActions() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function installDesktop(platform: "Windows" | "macOS") {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setMessage(choice.outcome === "accepted" ? `JobsMatchNow is being installed on ${platform}.` : "Installation was cancelled—you can try again anytime.");
      if (choice.outcome === "accepted") setInstallPrompt(null);
      return;
    }
    setMessage(platform === "macOS"
      ? "On macOS: open this site in Safari and choose File → Add to Dock, or use Chrome's Install icon in the address bar."
      : "On Windows: open this site in Edge or Chrome and select the Install JobsMatchNow icon in the address bar.");
  }

  return (
    <section className="download-section" id="download">
      <div className="download-heading">
        <span className="eyebrow light"><Download size={14} /> Download JobsMatchNow</span>
        <h2>One account.<br />Every device.</h2>
        <p>Start in your browser, install on your computer, or use the mobile-ready experience. Your profile and matches stay with you.</p>
      </div>
      <div className="download-grid">
        <article className="download-card featured"><div className="download-icon"><MonitorSmartphone /></div><span className="availability live"><i /> Available now</span><h3>Web app</h3><p>Use the complete responsive experience in any modern browser.</p><a href="https://jobsmatchnow.com/app/" className="store-button"><Laptop size={18} /><span><small>OPEN IN YOUR</small>Browser</span></a><ul><li><Check size={13} />No download required</li><li><Check size={13} />Works on mobile and desktop</li></ul></article>
        <article className="download-card"><div className="download-icon"><Laptop /></div><span className="availability live"><i /> Install now</span><h3>Windows</h3><p>Install the progressive web app for a dedicated window and app icon.</p><button className="store-button" onClick={() => installDesktop("Windows")}><span className="windows-mark">⊞</span><span><small>INSTALL FOR</small>Windows</span></button><ul><li><Check size={13} />Windows 10 and 11</li><li><Check size={13} />Automatic updates</li></ul></article>
        <article className="download-card"><div className="download-icon"><Apple /></div><span className="availability live"><i /> Install now</span><h3>macOS</h3><p>Add JobsMatchNow to your Dock from Safari or install with Chrome.</p><button className="store-button" onClick={() => installDesktop("macOS")}><Apple size={20} fill="currentColor" /><span><small>INSTALL FOR</small>macOS</span></button><ul><li><Check size={13} />Apple silicon and Intel</li><li><Check size={13} />Dedicated app window</li></ul></article>
        <article className="download-card"><div className="download-icon"><Smartphone /></div><span className="availability pending">Store review next</span><h3>iPhone & iPad</h3><p>The signed App Store listing activates after Apple review. The web app works today.</p><button className="store-button disabled" disabled><Apple size={21} fill="currentColor" /><span><small>COMING TO THE</small>App Store</span></button><ul><li><Check size={13} />Native project ready</li><li><Check size={13} />Mobile web available now</li></ul></article>
        <article className="download-card"><div className="download-icon"><Play /></div><span className="availability live"><i /> Tester APK ready</span><h3>Android</h3><p>Install the development APK for device testing. The Play Store release still requires production signing and approval.</p><a className="store-button" href="https://jobsmatchnow.com/downloads/JobsMatchNow-android-debug.apk"><Play size={20} fill="currentColor" /><span><small>DOWNLOAD TEST</small>Android APK</span></a><ul><li><Check size={13} />Package: com.jobsmatchnow.app</li><li><Check size={13} />Not a store release</li></ul></article>
      </div>
      {message && <div className="install-message" role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss">×</button></div>}
      <p className="store-note">Apple App Store and Google Play links cannot be created before signed builds are approved. No fake store listings or misleading download links are used.</p>
    </section>
  );
}
