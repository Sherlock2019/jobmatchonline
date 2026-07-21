import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return <div className="wz-field">
    <label className="wz-label">{label}{required && <em aria-hidden="true">*</em>}</label>
    {children}
    {hint && <small className="wz-hint">{hint}</small>}
  </div>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="wz-input" {...props} />;
}

export function Segmented<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T | undefined; onChange: (value: T) => void; labels?: Record<string, string> }) {
  return <div className="wz-segmented" role="radiogroup">
    {options.map((option) => <button type="button" key={option} className={value === option ? 'active' : ''} aria-pressed={value === option} onClick={() => onChange(option)}>{labels?.[option] ?? option}</button>)}
  </div>;
}

export function Chips({ options, value, onToggle }: { options: readonly string[]; value: string[]; onToggle: (option: string) => void }) {
  return <div className="wz-chips">
    {options.map((option) => <button type="button" key={option} className={value.includes(option) ? 'active' : ''} aria-pressed={value.includes(option)} onClick={() => onToggle(option)}>{option}</button>)}
  </div>;
}

export function TagInput({ value, onChange, placeholder, suggestions }: { value: string[]; onChange: (tags: string[]) => void; placeholder?: string; suggestions?: readonly string[] }) {
  const [draft, setDraft] = useState('');
  const add = (tag: string) => { const clean = tag.trim(); if (clean && !value.includes(clean)) onChange([...value, clean]); setDraft(''); };
  return <div className="wz-taginput">
    <div className="wz-tags">
      {value.map((tag) => <span key={tag} className="wz-tag">{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((item) => item !== tag))}><X size={11} /></button></span>)}
      <input value={draft} placeholder={placeholder || 'Type and press Enter'} onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(draft); } if (event.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
        onBlur={() => draft.trim() && add(draft)} />
    </div>
    {suggestions && <div className="wz-suggestions">{suggestions.filter((suggestion) => !value.includes(suggestion)).slice(0, 6).map((suggestion) => <button type="button" key={suggestion} onClick={() => add(suggestion)}><Plus size={11} />{suggestion}</button>)}</div>}
  </div>;
}

export function LevelTagInput({ value, onChange, placeholder, maxLevel = 5 }: { value: { name: string; level: number }[]; onChange: (tags: { name: string; level: number }[]) => void; placeholder?: string; maxLevel?: number }) {
  const [draft, setDraft] = useState('');
  const add = () => { const clean = draft.trim(); if (clean && !value.some((tag) => tag.name.toLowerCase() === clean.toLowerCase())) onChange([...value, { name: clean, level: 3 }]); setDraft(''); };
  return <div className="wz-taginput">
    <div className="wz-leveltags">
      {value.map((tag) => <span key={tag.name} className="wz-leveltag">
        <b>{tag.name}</b>
        <span className="wz-dots" role="slider" aria-label={`${tag.name} level`} aria-valuenow={tag.level} aria-valuemin={1} aria-valuemax={maxLevel}>
          {Array.from({ length: maxLevel }, (_, index) => <button type="button" key={index} className={index < tag.level ? 'on' : ''} aria-label={`Set ${tag.name} level to ${index + 1}`} onClick={() => onChange(value.map((item) => item.name === tag.name ? { ...item, level: index + 1 } : item))} />)}
        </span>
        <button type="button" className="wz-tag-remove" aria-label={`Remove ${tag.name}`} onClick={() => onChange(value.filter((item) => item.name !== tag.name))}><X size={11} /></button>
      </span>)}
    </div>
    <div className="wz-tags">
      <input value={draft} placeholder={placeholder || 'Add a skill, press Enter'} onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(); } }} onBlur={() => draft.trim() && add()} />
    </div>
  </div>;
}

export function Repeat<T>({ items, onChange, blank, render, addLabel }: { items: T[]; onChange: (items: T[]) => void; blank: () => T; render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode; addLabel: string }) {
  return <div className="wz-repeat">
    {items.map((item, index) => <div className="wz-repeat-item" key={index}>
      {render(item, (patch) => onChange(items.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry)))}
      <button type="button" className="wz-repeat-remove" aria-label="Remove entry" onClick={() => onChange(items.filter((_, entryIndex) => entryIndex !== index))}><X size={13} /></button>
    </div>)}
    <button type="button" className="wz-repeat-add" onClick={() => onChange([...items, blank()])}><Plus size={13} /> {addLabel}</button>
  </div>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button type="button" className={checked ? 'wz-toggle on' : 'wz-toggle'} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
    <i /><span>{label}</span>
  </button>;
}
