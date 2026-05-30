import React, { useState } from 'react';
import { Tenant, User } from '../types';
import {
  Building,
  UserCheck,
  Plus,
  X,
  Edit2,
  Trash2,
  Save,
  Shield,
  Key,
  Briefcase,
  Layers,
  Search,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface EnterpriseAdminConsoleProps {
  tenants: Tenant[];
  setTenants: React.Dispatch<React.SetStateAction<Tenant[]>>;
  usersList: { email: string; pass: string; user: User }[];
  setUsersList: React.Dispatch<React.SetStateAction<{ email: string; pass: string; user: User }[]>>;
  currentUser: User;
}

export default function EnterpriseAdminConsole({
  tenants,
  setTenants,
  usersList,
  setUsersList,
  currentUser
}: EnterpriseAdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<'venues' | 'users'>('venues');

  // Tenant / Venue form states
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [editTenantName, setEditTenantName] = useState('');
  const [newVenueId, setNewVenueId] = useState('');
  const [newVenueName, setNewVenueName] = useState('');
  const [venueSearch, setVenueSearch] = useState('');

  // User form states
  const [editingUserEmail, setEditingUserEmail] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmailField, setEditUserEmailField] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState<'superadmin' | 'client'>('client');
  const [editUserTenantId, setEditUserTenantId] = useState('global');

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'superadmin' | 'client'>('client');
  const [newUserTenantId, setNewUserTenantId] = useState('global');
  const [userSearch, setUserSearch] = useState('');

  // Notifications
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Custom modal prompts for iframe-compatible confirmations (replaces window.confirm)
  const [venueToDelete, setVenueToDelete] = useState<{ id: string; name: string } | null>(null);
  const [userToDelete, setUserToDelete] = useState<{ email: string; name: string } | null>(null);

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg('');
    setTimeout(() => setErrorMsg(''), 4000);
  };

  // --- VENUE MANAGER LOGIC ---
  const handleAddVenue = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newVenueId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanName = newVenueName.trim();

    if (!cleanId || !cleanName) {
      triggerError('Ensure both Establishment Slug and Name are provided.');
      return;
    }

    if (tenants.some((t) => t.id === cleanId)) {
      triggerError(`Establishment ID "${cleanId}" already exists. Provide a unique ID.`);
      return;
    }

    const newTenant: Tenant = {
      id: cleanId,
      name: cleanName,
    };

    setTenants((prev) => [...prev, newTenant]);
    triggerSuccess(`Successfully registered workspace "${cleanName}"!`);
    setNewVenueId('');
    setNewVenueName('');
  };

  const handleStartEditVenue = (t: Tenant) => {
    setEditingTenantId(t.id);
    setEditTenantName(t.name);
  };

  const handleSaveVenueEdit = (id: string) => {
    const trimmed = editTenantName.trim();
    if (!trimmed) {
      triggerError('Establishment name cannot be blank.');
      return;
    }

    setTenants((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: trimmed } : t))
    );
    setEditingTenantId(null);
    triggerSuccess('Establishment details updated on live scope.');
  };

  const handleDeleteVenue = (id: string, name: string) => {
    if (id === 'global') {
      triggerError('The corporate global scope is standard and cannot be deleted.');
      return;
    }

    setVenueToDelete({ id, name });
  };

  const confirmDeleteVenue = () => {
    if (venueToDelete) {
      setTenants((prev) => prev.filter((t) => t.id !== venueToDelete.id));
      triggerSuccess(`Successfully deleted establishment "${venueToDelete.name}".`);
      setVenueToDelete(null);
    }
  };

  // --- USER ACCESS CONTROL LOGIC ---
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newUserEmail.trim().toLowerCase();
    const pass = newUserPass;
    const name = newUserName.trim();

    if (!email || !pass || !name) {
      triggerError('Please fill in all username, email, and security password coordinates.');
      return;
    }

    if (usersList.some((u) => u.email.toLowerCase() === email)) {
      triggerError(`A registered user with email "${email}" already exists.`);
      return;
    }

    const newUserRecord = {
      email,
      pass,
      user: {
        id: `usr-${Date.now()}`,
        email,
        name,
        role: newUserRole,
        tenantId: newUserTenantId,
      } as User
    };

    setUsersList((prev) => [...prev, newUserRecord]);
    triggerSuccess(`Permitted and listed access credentials for ${name}!`);
    setNewUserEmail('');
    setNewUserPass('');
    setNewUserName('');
    setNewUserRole('client');
    setNewUserTenantId('global');
  };

  const handleStartEditUser = (record: { email: string; pass: string; user: User }) => {
    setEditingUserEmail(record.email);
    setEditUserName(record.user.name);
    setEditUserEmailField(record.user.email);
    setEditUserPassword(record.pass);
    setEditUserRole(record.user.role);
    setEditUserTenantId(record.user.tenantId);
  };

  const handleSaveUserEdit = (originalEmail: string) => {
    const trimmedName = editUserName.trim();
    const trimmedEmail = editUserEmailField.trim().toLowerCase();
    const password = editUserPassword;

    if (!trimmedName || !trimmedEmail || !password) {
      triggerError('Name, Email and Password cannot be left bank.');
      return;
    }

    if (
      trimmedEmail !== originalEmail.toLowerCase() &&
      usersList.some((u) => u.email.toLowerCase() === trimmedEmail)
    ) {
      triggerError(`Email address "${trimmedEmail}" is already registered to another user account.`);
      return;
    }

    setUsersList((prev) =>
      prev.map((item) => {
        if (item.email === originalEmail) {
          return {
            email: trimmedEmail,
            pass: password,
            user: {
              ...item.user,
              name: trimmedName,
              email: trimmedEmail,
              role: editUserRole,
              tenantId: editUserTenantId,
            },
          };
        }
        return item;
      })
    );

    setEditingUserEmail(null);
    triggerSuccess('Employee workspace permissions updated successfully!');
  };

  const handleDeleteUser = (email: string, name: string) => {
    if (email.toLowerCase() === currentUser.email.toLowerCase()) {
      triggerError('You cannot delete your own active administrator profile.');
      return;
    }

    setUserToDelete({ email, name });
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      setUsersList((prev) => prev.filter((u) => u.email.toLowerCase() !== userToDelete.email.toLowerCase()));
      triggerSuccess(`Access revoked for ${userToDelete.name}.`);
      setUserToDelete(null);
    }
  };

  // Filter listings
  const filteredVenues = tenants.filter((t) =>
    t.name.toLowerCase().includes(venueSearch.toLowerCase()) ||
    t.id.toLowerCase().includes(venueSearch.toLowerCase())
  );

  const filteredUsers = usersList.filter((item) =>
    item.user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    item.user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    item.user.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6" id="spirit-alchemist-admin-console">
      {/* Page Title & Status Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-slate-100 border border-slate-800 relative overflow-hidden shadow-lg">
        <div className="absolute right-0 top-0 opacity-5 transform translate-x-12 -translate-y-12 scale-150">
          <Shield className="h-44 w-44" />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xxs font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-widest">
            <Shield className="h-3 w-3" /> Spirit Alchemist LLC — Headquarters Control Panel
          </span>
          <h2 className="text-2xl font-black font-sans tracking-tight text-white uppercase select-none">
            Corporate Venue & Access Governance
          </h2>
          <p className="text-slate-400 text-xs leading-relaxed max-w-2xl">
            Administer global enterprise properties and manage multi-tenant user access credentials. Keep formulation secrets locked to specific brands or publish corporate standard baselines globally.
          </p>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn transition-all">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn transition-all">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Console Section Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('venues');
            setEditingTenantId(null);
            setEditingUserEmail(null);
          }}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'venues'
              ? 'border-indigo-600 text-indigo-650'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Building className="h-4 w-4" />
          Venues / Establishments ({tenants.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('users');
            setEditingTenantId(null);
            setEditingUserEmail(null);
          }}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-650'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Team Members & Venue Access ({usersList.length})
        </button>
      </div>

      {/* TAB CONTENT: VENUES */}
      {activeTab === 'venues' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Creation Side Block */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-600" />
              Register New Establishment
            </h3>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Create a dedicated workspace environment for a new venue (e.g. restaurant, hotel lounge, bar branch) to scope formulation, cost, and catalog definitions.
            </p>

            <form onSubmit={handleAddVenue} className="space-y-3.5 pt-1 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Unique Slug ID * (e.g., bar-east)
                </label>
                <input
                  type="text"
                  required
                  placeholder="bar-branch"
                  value={newVenueId}
                  onChange={(e) => setNewVenueId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 font-mono focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Commercial Venue Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Spirit Alchemist Lounge..."
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
              >
                <Plus className="h-3.5 w-3.5" /> Initialize Workspace
              </button>
            </form>
          </div>

          {/* Table Listing Block */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
              <div>
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                  Operational Establishments List
                </h3>
                <p className="text-slate-400 text-[10px]">
                  All active business units configured within Spirit Alchemist’s architecture.
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-48">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search establishments..."
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xxs font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Unique Slug/ID</th>
                    <th className="py-2.5 px-3">Commercial Venue Name</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVenues.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400">
                        No venues match the keyword search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredVenues.map((t) => {
                      const isEditing = editingTenantId === t.id;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-mono text-xxs font-bold text-indigo-650">
                            {t.id}
                          </td>
                          <td className="py-3 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editTenantName}
                                onChange={(e) => setEditTenantName(e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-xs"
                              />
                            ) : (
                              <span className="font-semibold text-slate-800">
                                {t.name}
                                {t.id === 'global' && (
                                  <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-slate-105 border border-slate-200 text-[8px] text-slate-500 rounded uppercase font-bold">
                                    Global Corporate
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSaveVenueEdit(t.id)}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                    title="Save name"
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingTenantId(null)}
                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {t.id !== 'global' && (
                                    <>
                                      <button
                                        onClick={() => handleStartEditVenue(t)}
                                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded cursor-pointer transition"
                                        title="Rename Establishment"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteVenue(t.id, t.name)}
                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition"
                                        title="Delete Establishment"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: USERS & ACCESS */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Creation Side Block */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-600" />
              Register Team Access Account
            </h3>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Create a new user profile with scoped credentials. Assign them as a client scoped strictly to one establishment or a superadmin across all properties.
            </p>

            <form onSubmit={handleAddUser} className="space-y-3.5 pt-1 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Employee Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nico Alchemist..."
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Corporate Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@spiritalchemistllc.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Login Access Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="e.g. securePass123"
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Governance Role *
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => {
                      const role = e.target.value as 'superadmin' | 'client';
                      setNewUserRole(role);
                      if (role === 'superadmin') {
                        setNewUserTenantId('global');
                      }
                    }}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 font-medium"
                  >
                    <option value="client">Client User</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Venue Scope Assign *
                  </label>
                  <select
                    value={newUserTenantId}
                    onChange={(e) => setNewUserTenantId(e.target.value)}
                    disabled={newUserRole === 'superadmin'}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-white disabled:bg-slate-100 disabled:text-slate-400 text-slate-800 font-medium cursor-pointer"
                  >
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-650 hover:bg-indigo-750 text-white font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
              >
                <UserCheck className="h-3.5 w-3.5" /> Authorize Employee Account
              </button>
            </form>
          </div>

          {/* Table Listing Block */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
              <div>
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                  Active Team Members Access Map
                </h3>
                <p className="text-slate-400 text-[10px]">
                  Governs which logins can read/write data in specific properties.
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-48">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xxs font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Account Details</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Access Scope / Venue</th>
                    <th className="py-2.5 px-3">Credentials</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No team credentials matched this look-up search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((item) => {
                      const isEditing = editingUserEmail === item.email;
                      const matchedTenant = tenants.find((t) => t.id === item.user.tenantId);
                      
                      return (
                        <tr key={item.user.id} className="hover:bg-slate-55/30">
                          {/* Account details */}
                          <td className="py-3 px-3">
                            {isEditing ? (
                              <div className="space-y-1.5 max-w-[170px]">
                                <input
                                  type="text"
                                  value={editUserName}
                                  onChange={(e) => setEditUserName(e.target.value)}
                                  placeholder="Full name"
                                  className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                                />
                                <input
                                  type="email"
                                  value={editUserEmailField}
                                  onChange={(e) => setEditUserEmailField(e.target.value)}
                                  placeholder="Email address"
                                  className="px-2 py-0.5 border border-slate-305 rounded text-[10px] bg-white text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-505 w-full"
                                />
                              </div>
                            ) : (
                              <div className="min-w-[130px]">
                                <div className="font-extrabold text-slate-800">{item.user.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{item.user.email}</div>
                              </div>
                            )}
                          </td>

                          {/* Role */}
                          <td className="py-3 px-3">
                            {isEditing ? (
                              <select
                                value={editUserRole}
                                onChange={(e) => {
                                  const r = e.target.value as 'superadmin' | 'client';
                                  setEditUserRole(r);
                                  if (r === 'superadmin') setEditUserTenantId('global');
                                }}
                                className="px-1.5 py-1 border border-slate-300 rounded text-xxs bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="client">Client</option>
                                <option value="superadmin">Superadmin</option>
                              </select>
                            ) : (
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                item.user.role === 'superadmin'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                              }`}>
                                {item.user.role === 'superadmin' ? 'Superadmin' : 'Client User'}
                              </span>
                            )}
                          </td>

                          {/* Tenant Scope */}
                          <td className="py-3 px-3">
                            {isEditing ? (
                              <select
                                value={editUserTenantId}
                                disabled={editUserRole === 'superadmin'}
                                onChange={(e) => setEditUserTenantId(e.target.value)}
                                className="px-1.5 py-1 border border-slate-300 rounded text-xxs bg-white disabled:bg-slate-50 disabled:text-slate-400 text-slate-800 font-bold focus:outline-none w-full max-w-[130px]"
                              >
                                {tenants.map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-700 text-xs truncate max-w-[120px]" title={matchedTenant?.name || item.user.tenantId}>
                                  {matchedTenant?.name || item.user.tenantId}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Password */}
                          <td className="py-3 px-3 font-mono text-xxs">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editUserPassword}
                                onChange={(e) => setEditUserPassword(e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-[90px]"
                              />
                            ) : (
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-205 select-all">
                                {item.pass}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSaveUserEdit(item.email)}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                    title="Save employee"
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingUserEmail(null)}
                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleStartEditUser(item)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded cursor-pointer transition"
                                    title="Modify Access Scope"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(item.email, item.user.name)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition"
                                    title="Revoke All Access"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Venue Delete Confirmation Modal */}
      {venueToDelete && (
        <div className="fixed inset-0 bg-slate-950/45 flex items-center justify-center p-4 z-50 animate-fadeIn animate-duration-150">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-md w-full space-y-5 text-left">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">
                Delete Establishment Workspace
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Are you absolutely sure you want to delete <strong className="text-slate-800">"{venueToDelete.name}"</strong>? 
              Access to ingredients and recipes scoped to this establishment will be restricted and all matching configurations will be locked out from normal views.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setVenueToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteVenue}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                Delete Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-950/45 flex items-center justify-center p-4 z-50 animate-fadeIn animate-duration-150">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-md w-full space-y-5 text-left">
            <div className="flex items-center gap-3 text-amber-600 border-b border-slate-100 pb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">
                Revoke Credentials Access
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to revoke and delete all access credentials for employee <strong className="text-slate-800">"{userToDelete.name}"</strong> ({userToDelete.email})? 
              They will be locked out immediately from querying recipes or ingredients in their assigned establishments.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
