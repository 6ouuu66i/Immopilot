import {
  Bell,
  Building2,
  Check,
  Database,
  KeyRound,
  Lock,
  Save,
  Shield,
  Upload,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useMyAgency } from '../lib/useMyAgency';
import { useMyProfile } from '../lib/useMyProfile';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  profileService,
  type NotificationPreferences,
} from '../lib/services/profileService';

type SettingsTab = 'profile' | 'security' | 'preferences' | 'agency' | 'sources';

const SOURCE_CARDS = [
  {
    name: 'Immoweb',
    status: 'Actif',
    active: true,
    description: 'Source prioritaire pour les annonces residentielles belges et les signaux FSBO.',
  },
  {
    name: 'Zimmo',
    status: 'Bientot disponible',
    active: false,
    description: 'Suivi complementaire des annonces et variations de prix.',
  },
  {
    name: 'Immovlan',
    status: 'Bientot disponible',
    active: false,
    description: 'Couverture francophone supplementaire pour enrichir les opportunites.',
  },
  {
    name: 'Biddit',
    status: 'Bientot disponible',
    active: false,
    description: 'Surveillance des ventes publiques et dossiers notariaux.',
  },
  {
    name: '2ememain',
    status: 'Bientot disponible',
    active: false,
    description: 'Detection future de signaux particuliers et annonces directes.',
  },
];

const PASSWORD_MIN_LENGTH = 8;

function strengthLabel(password: string) {
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return { label: 'Faible', tone: 'weak' };
  if (score <= 3) return { label: 'Correct', tone: 'medium' };
  return { label: 'Fort', tone: 'strong' };
}

function subscriptionLabel(value: string | null | undefined) {
  if (!value) return '-';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function Settings() {
  const { profile: authProfile } = useAuth();
  const profileState = useMyProfile();
  const agencyState = useMyAgency();
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [toast, setToast] = useState<string | null>(null);
  const isAdmin = authProfile?.role === 'admin';

  const tabs = useMemo(() => [
    { key: 'profile' as const, label: 'Mon profil', icon: UserRound },
    { key: 'security' as const, label: 'Securite', icon: Lock },
    { key: 'preferences' as const, label: 'Preferences', icon: Bell },
    ...(isAdmin ? [{ key: 'agency' as const, label: 'Mon agence', icon: Building2 }] : []),
    { key: 'sources' as const, label: 'Sources', icon: Database },
  ], [isAdmin]);

  useEffect(() => {
    if (tab === 'agency' && !isAdmin) setTab('profile');
  }, [isAdmin, tab]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) notify(detail);
    };

    window.addEventListener('ip-settings-toast', handler);
    return () => window.removeEventListener('ip-settings-toast', handler);
  }, []);

  return (
    <main className="settings-react-page">
      <header className="settings-react-header">
        <div>
          <span><Shield size={15} /> Parametres</span>
          <h1>Parametres</h1>
          <p>Gestion du profil, de la securite, des preferences et de la configuration agence.</p>
        </div>
      </header>

      <div className="settings-react-layout">
        <aside className="settings-react-tabs">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} className={tab === item.key ? 'active' : ''} type="button" onClick={() => setTab(item.key)}>
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        <section className="settings-react-content">
          {tab === 'profile' && <ProfileSettings profileState={profileState} onSaved={() => notify('Profil enregistre.')} />}
          {tab === 'security' && <SecuritySettings onSaved={() => notify('Mot de passe mis a jour.')} />}
          {tab === 'preferences' && <PreferenceSettings profileState={profileState} onSaved={() => notify('Preferences enregistrees.')} />}
          {tab === 'agency' && isAdmin && <AgencySettings agencyState={agencyState} onSaved={() => notify('Agence enregistree.')} />}
          {tab === 'sources' && <SourcesSettings />}
        </section>
      </div>

      {toast && <div className="settings-toast"><Check size={15} /> {toast}</div>}
    </main>
  );
}

interface ProfileSettingsProps {
  profileState: ReturnType<typeof useMyProfile>;
  onSaved: () => void;
}

function ProfileSettings({ profileState, onSaved }: ProfileSettingsProps) {
  const profile = profileState.profile;
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [ipiNumber, setIpiNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
    setIpiNumber(profile?.ipi_number ?? '');
    setAvatarUrl(profile?.avatar_url ?? '');
  }, [profile]);

  async function save() {
    setSaving(true);
    try {
      await profileState.updateProfile({ full_name: fullName, phone, ipi_number: ipiNumber, avatar_url: avatarUrl });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setSaving(true);
    try {
      const updated = await profileState.uploadAvatar(file);
      setAvatarUrl(updated.avatar_url ?? '');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-panel">
      <PanelHeader title="Mon profil" description="Informations personnelles visibles dans le workspace agence." />
      {profileState.error && <div className="settings-error">{profileState.error}</div>}
      <div className="settings-form-grid">
        <div className="settings-avatar-field">
          <div className="settings-avatar-preview">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <UserRound size={28} />}
          </div>
          <label className="settings-upload-button">
            <Upload size={14} />
            Importer une image
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { void upload(event.target.files?.[0]); }} />
          </label>
        </div>

        <label>Nom complet<input value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
        <label>Email<input value={profile?.email ?? ''} readOnly /></label>
        <p className="settings-field-note">Pour changer votre email, contactez le support.</p>
        <label>Telephone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label>Numero IPI<input value={ipiNumber} onChange={(event) => setIpiNumber(event.target.value)} /></label>
        <label className="settings-wide">URL avatar<input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} /></label>
      </div>
      <SaveBar onSave={save} saving={saving} />
    </div>
  );
}

function SecuritySettings({ onSaved }: { onSaved: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const strength = strengthLabel(newPassword);

  async function savePassword() {
    setError(null);
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmation ne correspond pas.');
      return;
    }
    setSaving(true);
    try {
      await profileService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      window.dispatchEvent(new CustomEvent('ip-settings-toast', { detail: 'Mot de passe mis a jour.' }));
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Changement de mot de passe impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function signOutEverywhere() {
    await profileService.signOutEverywhere();
    window.location.hash = '#login';
  }

  return (
    <div className="settings-panel">
      <PanelHeader title="Securite" description="Mettez a jour votre mot de passe Supabase Auth." />
      {error && <div className="settings-error">{error}</div>}
      <div className="settings-form-grid">
        <label>Mot de passe actuel<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label>Nouveau mot de passe<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <label>Confirmation<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        <div className={`settings-password-strength ${strength.tone}`}>Force: {strength.label}</div>
      </div>
      <div className="settings-savebar">
        <button type="button" className="settings-secondary-action" onClick={() => { void signOutEverywhere(); }}>
          <KeyRound size={14} /> Se deconnecter de toutes les sessions
        </button>
        <button type="button" onClick={() => { void savePassword(); }} disabled={saving}>{saving ? 'Enregistrement...' : 'Changer le mot de passe'}</button>
      </div>
    </div>
  );
}

function PreferenceSettings({ profileState, onSaved }: ProfileSettingsProps) {
  const preferences = normalizeNotificationPreferences(profileState.profile?.notification_preferences);
  const [draft, setDraft] = useState<NotificationPreferences>(preferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(preferences);
  }, [
    preferences.all,
    preferences.transfers,
    preferences.tasks,
    preferences.deals,
    preferences.commissions,
    preferences.mentions,
  ]);

  function setPreference(key: keyof NotificationPreferences, value: boolean) {
    setDraft((current) => key === 'all' && !value
      ? { ...DEFAULT_NOTIFICATION_PREFERENCES, all: false, transfers: false, tasks: false, deals: false, commissions: false, mentions: false }
      : { ...current, [key]: value });
  }

  async function save() {
    setSaving(true);
    try {
      await profileState.updateProfile({ notification_preferences: draft });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-panel">
      <PanelHeader title="Preferences" description="Controlez les notifications affichees dans le workspace." />
      {profileState.error && <div className="settings-error">{profileState.error}</div>}
      <div className="settings-toggle-list">
        <ToggleRow label="Recevoir les notifications dans l'app" checked={draft.all} onChange={(value) => setPreference('all', value)} />
        <ToggleRow label="Transferts" checked={draft.transfers} disabled={!draft.all} onChange={(value) => setPreference('transfers', value)} />
        <ToggleRow label="Taches" checked={draft.tasks} disabled={!draft.all} onChange={(value) => setPreference('tasks', value)} />
        <ToggleRow label="Deals" checked={draft.deals} disabled={!draft.all} onChange={(value) => setPreference('deals', value)} />
        <ToggleRow label="Commissions" checked={draft.commissions} disabled={!draft.all} onChange={(value) => setPreference('commissions', value)} />
        <ToggleRow label="Mentions" checked={draft.mentions} disabled={!draft.all} onChange={(value) => setPreference('mentions', value)} />
      </div>
      <div className="settings-info-block">
        <strong>Apparence</strong>
        <span>Mode sombre bientot disponible.</span>
      </div>
      <SaveBar onSave={save} saving={saving} />
    </div>
  );
}

interface AgencySettingsProps {
  agencyState: ReturnType<typeof useMyAgency>;
  onSaved: () => void;
}

function AgencySettings({ agencyState, onSaved }: AgencySettingsProps) {
  const agency = agencyState.agency;
  const [name, setName] = useState('');
  const [ipiNumber, setIpiNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(agency?.name ?? '');
    setIpiNumber(agency?.ipi_number ?? '');
    setAddress(agency?.address ?? '');
    setCity(agency?.city ?? '');
    setPostalCode(agency?.postal_code ?? '');
    setPhone(agency?.phone ?? '');
    setEmail(agency?.email ?? '');
    setWebsite(agency?.website ?? '');
    setLogoUrl(agency?.logo_url ?? '');
  }, [agency]);

  async function save() {
    setSaving(true);
    try {
      await agencyState.updateAgency({ name, ipi_number: ipiNumber, address, city, postal_code: postalCode, phone, email, website, logo_url: logoUrl });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setSaving(true);
    try {
      const updated = await agencyState.uploadAgencyLogo(file);
      setLogoUrl(updated.logo_url ?? '');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-panel">
      <PanelHeader title="Mon agence" description="Informations administratives partagees par les agents de l'agence." />
      {agencyState.error && <div className="settings-error">{agencyState.error}</div>}
      <div className="settings-form-grid">
        <div className="settings-avatar-field">
          <div className="settings-avatar-preview is-logo">
            {logoUrl ? <img src={logoUrl} alt="" /> : <Building2 size={28} />}
          </div>
          <label className="settings-upload-button">
            <Upload size={14} />
            Importer un logo
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => { void upload(event.target.files?.[0]); }} />
          </label>
        </div>
        <label>Nom de l'agence<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Slug<input value={agency?.slug ?? ''} readOnly /></label>
        <p className="settings-field-note">Identifiant unique de votre agence dans l'URL.</p>
        <label>Numero IPI agence<input value={ipiNumber} onChange={(event) => setIpiNumber(event.target.value)} /></label>
        <label>Adresse<input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        <label>Ville<input value={city} onChange={(event) => setCity(event.target.value)} /></label>
        <label>Code postal<input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} /></label>
        <label>Telephone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Site web<input value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
        <label className="settings-wide">URL logo<input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} /></label>
      </div>
      <div className="settings-plan-row">
        <span>Plan actuel <strong>{subscriptionLabel(agency?.subscription_plan)}</strong></span>
        <span>Statut <strong>{subscriptionLabel(agency?.subscription_status)}</strong></span>
      </div>
      <SaveBar onSave={save} saving={saving} />
    </div>
  );
}

function SourcesSettings() {
  return (
    <div className="settings-panel">
      <PanelHeader title="Sources" description="Etat des sources de prospection surveillees par ImmoPilot." />
      <div className="settings-source-grid">
        {SOURCE_CARDS.map((source) => (
          <article key={source.name} className="settings-source-card">
            <div>
              <strong>{source.name}</strong>
              <p>{source.description}</p>
            </div>
            <span className={source.active ? 'active' : ''}>{source.status}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="settings-panel-head">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function SaveBar({ onSave, saving }: { onSave: () => Promise<void>; saving: boolean }) {
  return (
    <div className="settings-savebar">
      <button type="button" onClick={() => { void onSave(); }} disabled={saving}>
        <Save size={14} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  );
}

function ToggleRow({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={`settings-toggle-row ${disabled ? 'disabled' : ''}`}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
