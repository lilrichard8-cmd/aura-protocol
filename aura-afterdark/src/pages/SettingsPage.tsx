import { useState } from 'react';
import { Settings, User, Shield, Bell, Eye, Wallet, Moon, Trash2, Save } from 'lucide-react';

const settingsSections = [
  { id: 'profile', label: 'Profile Settings', icon: User },
  { id: 'security', label: 'Account Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Eye },
  { id: 'wallet', label: 'Wallet Management', icon: Wallet },
  { id: 'display', label: 'Display Preferences', icon: Moon },
  { id: 'danger', label: 'Danger Zone', icon: Trash2 },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const [settings, setSettings] = useState({
    // Profile
    displayName: 'Aurora Dreamer',
    bio: 'Digital artist & creative muse',
    location: 'Los Angeles, CA',
    website: 'https://aurora-art.com',
    
    // Security
    twoFactorEnabled: false,
    passwordLastChanged: '2 months ago',
    loginNotifications: true,
    
    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    marketingEmails: false,
    tipNotifications: true,
    subscriptionNotifications: true,
    liveStreamNotifications: true,
    
    // Privacy
    profileVisibility: 'public',
    messageRestrictions: 'subscribers',
    contentVisibility: 'subscribers',
    ageRestricted: true,
    showOnlineStatus: true,
    
    // Display
    darkMode: true,
    compactMode: false,
    animationsEnabled: true,
    language: 'en',
  });
  
  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const renderProfileSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Display Name</label>
        <input
          type="text"
          value={settings.displayName}
          onChange={(e) => handleSettingChange('displayName', e.target.value)}
          className="w-full px-4 py-3 bg-aura-surface border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Bio</label>
        <textarea
          value={settings.bio}
          onChange={(e) => handleSettingChange('bio', e.target.value)}
          rows={3}
          className="w-full px-4 py-3 bg-aura-surface border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent resize-none"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Location</label>
          <input
            type="text"
            value={settings.location}
            onChange={(e) => handleSettingChange('location', e.target.value)}
            className="w-full px-4 py-3 bg-aura-surface border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Website</label>
          <input
            type="url"
            value={settings.website}
            onChange={(e) => handleSettingChange('website', e.target.value)}
            className="w-full px-4 py-3 bg-aura-surface border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent"
          />
        </div>
      </div>
    </div>
  );
  
  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-aura-surface rounded-lg">
        <div>
          <h3 className="font-medium">Two-Factor Authentication</h3>
          <p className="text-sm text-aura-text-secondary">Add an extra layer of security to your account</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.twoFactorEnabled}
            onChange={(e) => handleSettingChange('twoFactorEnabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-aura-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aura-accent"></div>
        </label>
      </div>
      
      <div className="p-4 bg-aura-surface rounded-lg">
        <h3 className="font-medium mb-2">Password</h3>
        <p className="text-sm text-aura-text-secondary mb-3">Last changed: {settings.passwordLastChanged}</p>
        <button className="px-4 py-2 bg-aura-accent hover:bg-aura-accent-hover text-white rounded-lg transition-colors">
          Change Password
        </button>
      </div>
      
      <div className="flex items-center justify-between p-4 bg-aura-surface rounded-lg">
        <div>
          <h3 className="font-medium">Login Notifications</h3>
          <p className="text-sm text-aura-text-secondary">Get notified when someone logs into your account</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.loginNotifications}
            onChange={(e) => handleSettingChange('loginNotifications', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-aura-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aura-accent"></div>
        </label>
      </div>
    </div>
  );
  
  const renderNotificationSettings = () => (
    <div className="space-y-4">
      {[
        { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
        { key: 'pushNotifications', label: 'Push Notifications', desc: 'Receive push notifications in your browser' },
        { key: 'tipNotifications', label: 'Tip Notifications', desc: 'Get notified when you receive tips' },
        { key: 'subscriptionNotifications', label: 'Subscription Notifications', desc: 'Get notified about new subscribers' },
        { key: 'liveStreamNotifications', label: 'Live Stream Notifications', desc: 'Get notified when creators you follow go live' },
        { key: 'marketingEmails', label: 'Marketing Emails', desc: 'Receive promotional emails and updates' },
      ].map(item => (
        <div key={item.key} className="flex items-center justify-between p-4 bg-aura-surface rounded-lg">
          <div>
            <h3 className="font-medium">{item.label}</h3>
            <p className="text-sm text-aura-text-secondary">{item.desc}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings[item.key as keyof typeof settings] as boolean}
              onChange={(e) => handleSettingChange(item.key, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-aura-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aura-accent"></div>
          </label>
        </div>
      ))}
    </div>
  );
  
  const renderPrivacySettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-3">Who can message you?</label>
        <div className="space-y-2">
          {[
            { value: 'everyone', label: 'Everyone' },
            { value: 'subscribers', label: 'Subscribers only' },
            { value: 'none', label: 'No one' },
          ].map(option => (
            <label key={option.value} className="flex items-center gap-3 p-3 bg-aura-surface rounded-lg cursor-pointer hover:bg-aura-surface/80">
              <input
                type="radio"
                name="messageRestrictions"
                value={option.value}
                checked={settings.messageRestrictions === option.value}
                onChange={(e) => handleSettingChange('messageRestrictions', e.target.value)}
                className="text-aura-accent"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-3">Content visibility</label>
        <div className="space-y-2">
          {[
            { value: 'public', label: 'Public (visible to everyone)' },
            { value: 'subscribers', label: 'Subscribers only' },
            { value: 'private', label: 'Private (invite only)' },
          ].map(option => (
            <label key={option.value} className="flex items-center gap-3 p-3 bg-aura-surface rounded-lg cursor-pointer hover:bg-aura-surface/80">
              <input
                type="radio"
                name="contentVisibility"
                value={option.value}
                checked={settings.contentVisibility === option.value}
                onChange={(e) => handleSettingChange('contentVisibility', e.target.value)}
                className="text-aura-accent"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      
      <div className="flex items-center justify-between p-4 bg-aura-surface rounded-lg">
        <div>
          <h3 className="font-medium">Age-restricted content</h3>
          <p className="text-sm text-aura-text-secondary">Mark your content as 18+</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.ageRestricted}
            onChange={(e) => handleSettingChange('ageRestricted', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-aura-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aura-accent"></div>
        </label>
      </div>
    </div>
  );
  
  const renderWalletSettings = () => (
    <div className="space-y-6">
      <div className="p-4 bg-aura-surface rounded-lg">
        <h3 className="font-medium mb-2">Connected Wallet</h3>
        <p className="text-sm text-aura-text-secondary mb-3">0x1234...5678</p>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-aura-accent hover:bg-aura-accent-hover text-white rounded-lg transition-colors">
            Change Wallet
          </button>
          <button className="px-4 py-2 bg-aura-surface hover:bg-aura-surface/80 border border-aura-border rounded-lg transition-colors">
            Disconnect
          </button>
        </div>
      </div>
      
      <div className="p-4 bg-aura-surface rounded-lg">
        <h3 className="font-medium mb-2">Auto-withdraw</h3>
        <p className="text-sm text-aura-text-secondary mb-3">Automatically withdraw earnings above a threshold</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            placeholder="1000"
            className="flex-1 px-4 py-2 bg-aura-bg border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent"
          />
          <span className="text-sm text-aura-text-secondary">ORA</span>
        </div>
      </div>
    </div>
  );
  
  const renderDisplaySettings = () => (
    <div className="space-y-4">
      {[
        { key: 'darkMode', label: 'Dark Mode', desc: 'Use dark theme (recommended for After Dark)' },
        { key: 'compactMode', label: 'Compact Mode', desc: 'Show more content in less space' },
        { key: 'animationsEnabled', label: 'Animations', desc: 'Enable smooth animations and transitions' },
        { key: 'showOnlineStatus', label: 'Show Online Status', desc: 'Let others see when you\'re online' },
      ].map(item => (
        <div key={item.key} className="flex items-center justify-between p-4 bg-aura-surface rounded-lg">
          <div>
            <h3 className="font-medium">{item.label}</h3>
            <p className="text-sm text-aura-text-secondary">{item.desc}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings[item.key as keyof typeof settings] as boolean}
              onChange={(e) => handleSettingChange(item.key, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-aura-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aura-accent"></div>
          </label>
        </div>
      ))}
    </div>
  );
  
  const renderDangerZone = () => (
    <div className="space-y-6">
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
        <h3 className="font-semibold text-red-400 mb-2">Delete Account</h3>
        <p className="text-sm text-aura-text-secondary mb-4">
          Once you delete your account, there is no going back. This action cannot be undone and will permanently delete your profile, content, and all associated data.
        </p>
        <button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
          Delete Account
        </button>
      </div>
    </div>
  );
  
  const renderCurrentSection = () => {
    switch (activeSection) {
      case 'profile': return renderProfileSettings();
      case 'security': return renderSecuritySettings();
      case 'notifications': return renderNotificationSettings();
      case 'privacy': return renderPrivacySettings();
      case 'wallet': return renderWalletSettings();
      case 'display': return renderDisplaySettings();
      case 'danger': return renderDangerZone();
      default: return renderProfileSettings();
    }
  };
  
  return (
    <div className="min-h-screen bg-aura-bg text-aura-text md:pl-64">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-aura-text-secondary">Manage your account preferences</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-aura-accent hover:bg-aura-accent-hover text-white rounded-lg transition-colors">
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-aura-card p-4 rounded-lg border border-aura-border">
              <nav className="space-y-1">
                {settingsSections.map(section => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                        activeSection === section.id
                          ? 'bg-aura-accent text-white'
                          : 'text-aura-text-secondary hover:text-aura-text hover:bg-aura-surface'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-aura-card p-6 rounded-lg border border-aura-border">
              <h2 className="text-xl font-semibold mb-6">
                {settingsSections.find(s => s.id === activeSection)?.label}
              </h2>
              {renderCurrentSection()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}