import { useState } from 'react';
import { useAuth, type User } from '../context/AuthContext';
import { UserPlus, Trash2, Users, AtSign, UserCircle, Key, Image as ImageIcon, Edit2, ThumbsUp, ThumbsDown, X, Save, MessageSquare, Paperclip, Star } from 'lucide-react';
import Avatar from './Avatar';

const UserManagement = () => {
  const { users, addUser, updateUser, deleteUser, user: currentUser, apiFetch } = useAuth();
  const safeUsers = Array.isArray(users) ? users : [];
  const defaultSkills: NonNullable<User['skills']> = { atendimento: 0, proatividade: 0, tratamento: 0, agilidade: 0, dificuldade: 0 };
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarFileKey, setAvatarFileKey] = useState(0);
  const [sector, setSector] = useState<'Suporte' | 'Comercial' | 'RH' | 'Geral'>('Geral');
  const [loading, setLoading] = useState(false);

  // Edit State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editAvatarFileKey, setEditAvatarFileKey] = useState(0);
  const [editSector, setEditSector] = useState<'Suporte' | 'Comercial' | 'RH' | 'Geral'>('Geral');
  const [editRole, setEditRole] = useState<'employee' | 'supervisor'>('employee');
  const [editSkills, setEditSkills] = useState<NonNullable<User['skills']>>(defaultSkills);
  const [editResolutionRate, setEditResolutionRate] = useState(0);

  // Quick Feedback State
  const [feedbackUser, setFeedbackUser] = useState<User | null>(null);
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackAttachment, setFeedbackAttachment] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'positive' | 'negative' | null>(null);

  type SkillKey = keyof NonNullable<User['skills']>;
  const skillFields: { key: SkillKey; label: string }[] = [
    { key: 'atendimento', label: 'Atendimento' },
    { key: 'proatividade', label: 'Proatividade' },
    { key: 'tratamento', label: 'Tratamento' },
    { key: 'agilidade', label: 'Agilidade' },
    { key: 'dificuldade', label: 'Dificuldade' }
  ];

  const setSkillValue = (key: SkillKey, value: number) => {
    const clamped = Math.max(0, Math.min(5, Math.round(value)));
    setEditSkills((prev) => ({ ...prev, [key]: clamped }));
  };

  const setResolutionRateValue = (value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    setEditResolutionRate(clamped);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          if (file.size > 700 * 1024) {
            alert('Imagem muito grande. Use até 700KB.');
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            setFeedbackAttachment(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 700 * 1024) {
        alert('Imagem muito grande. Use até 700KB.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setFeedbackAttachment(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 700 * 1024) {
      alert('Imagem muito grande. Use até 700KB.');
      setAvatarFileKey((v) => v + 1);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result.startsWith('data:image/')) {
        setAvatar(result);
      } else {
        alert('Arquivo inválido. Selecione uma imagem.');
      }
      setAvatarFileKey((v) => v + 1);
    };
    reader.onerror = () => {
      alert('Erro ao ler o arquivo.');
      setAvatarFileKey((v) => v + 1);
    };
    reader.readAsDataURL(file);
  };

  const handleEditAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 700 * 1024) {
      alert('Imagem muito grande. Use até 700KB.');
      setEditAvatarFileKey((v) => v + 1);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result.startsWith('data:image/')) {
        setEditAvatar(result);
      } else {
        alert('Arquivo inválido. Selecione uma imagem.');
      }
      setEditAvatarFileKey((v) => v + 1);
    };
    reader.onerror = () => {
      alert('Erro ao ler o arquivo.');
      setEditAvatarFileKey((v) => v + 1);
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name && username && password) {
      if (password.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      setLoading(true);
      try {
        await addUser({ name, username, password, avatar, sector });
        setName('');
        setUsername('');
        setPassword('');
        setAvatar('');
        setSector('Geral');
      } catch (error: any) {
        alert(error.message || 'Erro ao adicionar usuário');
      } finally {
        setLoading(false);
      }
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditAvatar(user.avatar || '');
    setEditSector(user.sector || 'Geral');
    setEditRole(user.role);
    setEditSkills({ ...defaultSkills, ...(user.skills ?? {}) });
    setEditResolutionRate(typeof user.resolutionRate === 'number' ? user.resolutionRate : 0);
    setEditPassword('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser && editName && editUsername) {
      if (editPassword && editPassword.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      setLoading(true);
      try {
        await updateUser(editingUser._id, {
          name: editName,
          username: editUsername,
          password: editPassword || undefined,
          avatar: editAvatar,
          sector: editSector,
          role: editRole,
          skills: editSkills,
          resolutionRate: editResolutionRate
        });
        setEditingUser(null);
      } catch (error: any) {
        alert(error.message || 'Erro ao atualizar usuário');
      } finally {
        setLoading(false);
      }
    }
  };

  const sendQuickFeedback = async () => {
    if (!feedbackUser || !feedbackContent || !selectedType) return;

    try {
      setLoading(true);
      const response = await apiFetch('/feedbacks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverId: feedbackUser._id, // Usar _id em vez de username
          content: feedbackContent,
          rating: selectedType === 'positive' ? 5 : 1,
          isAnonymous: false,
          type: selectedType,
          attachment: feedbackAttachment
        }),
      });

      if (response.ok) {
        alert(`Feedback ${selectedType === 'positive' ? 'positivo' : 'negativo'} enviado para ${feedbackUser.name}!`);
        setFeedbackUser(null);
        setFeedbackContent('');
        setFeedbackAttachment(null);
        setSelectedType(null);
      }
    } catch (error) {
      console.error('Erro ao enviar feedback rápido:', error);
    } finally {
      setLoading(false);
    }
  };

  const otherUsers = safeUsers.filter(u => u._id !== currentUser?._id);

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm h-full flex flex-col relative">
      <div className="px-6 py-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2 rounded-lg">
            <Users className="w-5 h-5 text-indigo-300" />
          </div>
          Gerenciar Equipe
        </h2>
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
          {otherUsers.length} Membros
        </span>
      </div>

      <div className="p-6 flex-1 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
        {/* Form to Add User */}
        {!editingUser && (
          <form onSubmit={handleAdd} className="space-y-4 p-6 bg-white/[0.02] border border-white/5 rounded-2xl animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-zinc-600/30 to-zinc-800/40 flex items-center justify-center border border-white/10 overflow-hidden shrink-0">
                <Avatar src={avatar} name={name || 'Novo membro'} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 w-full">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Novo Membro</p>
                <p className="text-xs text-gray-500 mb-3 italic">Insira os dados e uma URL de imagem para o perfil.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative group">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-indigo-300 transition-colors" />
                <input type="text" required placeholder="Nome Completo" className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="relative group">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-indigo-300 transition-colors" />
                <input type="text" required placeholder="Usuário de Login" className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="relative group">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-indigo-300 transition-colors" />
                <input type="password" required minLength={6} placeholder="Senha de Acesso" className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="relative group">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-indigo-300 transition-colors" />
                <select 
                  required 
                  className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all appearance-none"
                  value={sector}
                  onChange={(e) => setSector(e.target.value as any)}
                >
                  <option value="Geral">Setor: Geral</option>
                  <option value="Suporte">Setor: Suporte</option>
                  <option value="Comercial">Setor: Comercial</option>
                  <option value="RH">Setor: RH</option>
                </select>
              </div>
              <div className="relative group">
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-indigo-300 transition-colors" />
                <input type="url" placeholder="URL da Foto (opcional)" className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 cursor-pointer transition-all">
                  <ImageIcon className="w-4 h-4 text-zinc-400" />
                  Enviar imagem
                  <input
                    key={avatarFileKey}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                </label>
                <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">
                  Até 700KB
                </span>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><UserPlus className="w-4 h-4" /> Adicionar à Equipe</>}
            </button>
          </form>
        )}

        {/* User List */}
        <div className="space-y-3">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Equipe Atual</p>
          {otherUsers.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
              <p className="text-gray-600 text-sm italic">Nenhum membro cadastrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {otherUsers.map((emp) => (
                <div key={emp._id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-2xl hover:bg-white/[0.05] transition-all group gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-600/30 to-zinc-800/40 flex items-center justify-center border border-white/10 overflow-hidden shadow-inner">
                      <Avatar src={emp.avatar} name={emp.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-white leading-tight">{emp.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500 font-mono opacity-60">{emp.username.includes('@') ? emp.username : `@${emp.username}`}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${
                          emp.sector === 'Suporte' ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-400/20' :
                          emp.sector === 'Comercial' ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20' :
                          emp.sector === 'RH' ? 'bg-violet-500/10 text-violet-300 border border-violet-400/20' :
                          'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}>
                          {emp.sector || 'Geral'}
                        </span>
                        {emp.role === 'supervisor' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight bg-indigo-500/10 text-indigo-300 border border-indigo-400/20">
                            Supervisor
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button onClick={() => setFeedbackUser(emp)} className="flex-1 sm:flex-none p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/20 transition-all flex items-center justify-center gap-2 text-xs font-bold" title="Enviar Feedback">
                      <MessageSquare className="w-4 h-4" /> Feedback
                    </button>
                    <button onClick={() => startEdit(emp)} className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl border border-white/5 transition-all" title="Editar">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={async () => {
                      if (!window.confirm(`Remover ${emp.name}? Esta ação não pode ser desfeita.`)) return;
                      try {
                        await deleteUser(emp._id);
                      } catch (error: any) {
                        alert(error.message || 'Erro ao remover usuário');
                      }
                    }} className="p-2.5 text-gray-600 hover:text-slate-400 hover:bg-slate-400/10 rounded-xl border border-white/5 transition-all" title="Remover">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal Overlay */}
      {editingUser && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-in zoom-in duration-300 my-auto">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Editar <span className="text-indigo-300">Membro</span></h3>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-all"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-300 to-violet-700 p-[1px] mb-4">
                  <div className="w-full h-full rounded-3xl bg-black flex items-center justify-center overflow-hidden">
                    <Avatar src={editAvatar} name={editName || 'Membro'} className="w-full h-full object-cover" />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Prévia da Foto (URL)</p>
              </div>
              <div className="flex items-center justify-center gap-3 -mt-2">
                <label className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 cursor-pointer transition-all">
                  <ImageIcon className="w-4 h-4 text-zinc-400" />
                  Enviar imagem
                  <input
                    key={editAvatarFileKey}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleEditAvatarFileChange}
                  />
                </label>
                <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">
                  Até 700KB
                </span>
              </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative group">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input type="text" required placeholder="Nome Completo" className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 outline-none" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="relative group">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input type="text" required placeholder="Usuário" className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 outline-none" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative group">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input type="password" placeholder="Nova Senha (opcional)" className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 outline-none" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative group">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <select className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all appearance-none" value={editSector} onChange={(e) => setEditSector(e.target.value as any)}>
                      <option value="Geral">Setor: Geral</option>
                      <option value="Suporte">Setor: Suporte</option>
                      <option value="Comercial">Setor: Comercial</option>
                      <option value="RH">Setor: RH</option>
                    </select>
                  </div>
                  <div className="relative group">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <select className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all appearance-none" value={editRole} onChange={(e) => setEditRole(e.target.value as any)}>
                      <option value="employee">Função: Funcionário</option>
                      <option value="supervisor">Função: Supervisor</option>
                    </select>
                  </div>
                </div>

                <div className="relative group">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input type="url" placeholder="URL da Foto" className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 outline-none" value={editAvatar} onChange={(e) => setEditAvatar(e.target.value)} />
                </div>
                
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Habilidades</p>
                  <div className="space-y-3">
                    {skillFields.map(({ key, label }) => {
                      const value = editSkills[key] ?? 0;
                      return (
                        <div key={key} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-gray-300 font-bold">{label}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSkillValue(key, 0)}
                              className={`px-2 py-1 rounded-lg border text-[10px] font-black transition-all ${
                                value === 0 ? 'bg-white/10 border-white/20 text-zinc-200' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10'
                              }`}
                              title="Definir 0"
                            >
                              0
                            </button>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSkillValue(key, s)}
                                className="p-1 rounded-md hover:bg-white/10 transition-all"
                                title={`Definir ${s}`}
                              >
                                <Star className={`w-4 h-4 ${value >= s ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`} />
                              </button>
                            ))}
                            <span className="ml-2 text-xs text-gray-500 font-mono w-5 text-right">{value}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-sm text-gray-300 font-bold">Taxa de Resolução</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-28 px-4 py-2 bg-black border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400/30 outline-none"
                        value={editResolutionRate}
                        onChange={(e) => setResolutionRateValue(Number(e.target.value))}
                      />
                      <span className="text-xs text-gray-500 font-black">%</span>
                    </div>
                  </div>
                </div>
              <button type="submit" disabled={loading} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Save className="w-5 h-5" /> Salvar Alterações</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Quick Feedback Modal Overlay */}
      {feedbackUser && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-in zoom-in duration-300 my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Novo <span className="text-indigo-300">Feedback</span></h3>
              <button onClick={() => setFeedbackUser(null)} className="p-2 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-all"><X className="w-6 h-6" /></button>
            </div>
            
            <p className="text-gray-500 text-sm mb-6 font-medium">Enviar para <span className="text-white font-bold">{feedbackUser.name}</span></p>

            <div className="relative mb-6">
              <textarea 
                required
                className="w-full px-5 py-4 bg-black border border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none text-white transition-all placeholder:text-gray-700 min-h-[120px] resize-none"
                value={feedbackContent}
                onChange={(e) => setFeedbackContent(e.target.value)}
                onPaste={handlePaste}
                placeholder="Descreva o motivo deste feedback... (Você também pode colar uma imagem aqui)"
              />
              
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <label className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg cursor-pointer transition-all border border-white/5" title="Anexar Imagem">
                  <Paperclip className="w-4 h-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
            </div>

            {feedbackAttachment && (
              <div className="mb-6 relative group animate-in zoom-in duration-300">
                <div className="w-full h-40 rounded-2xl border border-white/10 overflow-hidden bg-black flex items-center justify-center">
                  <img src={feedbackAttachment} alt="Anexo" className="max-w-full max-h-full object-contain" />
                </div>
                <button 
                  onClick={() => setFeedbackAttachment(null)}
                  className="absolute -top-2 -right-2 p-1.5 bg-zinc-500 text-white rounded-full shadow-lg hover:bg-zinc-400 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-8">
              <button 
                onClick={() => setSelectedType('positive')}
                className={`py-4 rounded-2xl transition-all flex items-center justify-center gap-3 font-black border ${
                  selectedType === 'positive' 
                    ? 'bg-emerald-500 border-emerald-400 text-black scale-[1.02]' 
                    : 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300 hover:bg-emerald-500/15'
                }`}
              >
                <ThumbsUp className="w-6 h-6" /> POSITIVO
              </button>
              <button 
                onClick={() => setSelectedType('negative')}
                className={`py-4 rounded-2xl transition-all flex items-center justify-center gap-3 font-black border ${
                  selectedType === 'negative' 
                    ? 'bg-rose-600 border-rose-500 text-white scale-[1.02]' 
                    : 'bg-rose-500/10 border-rose-400/20 text-rose-300 hover:bg-rose-500/15'
                }`}
              >
                <ThumbsDown className="w-6 h-6" /> NEGATIVO
              </button>
            </div>

            <button 
              onClick={sendQuickFeedback}
              disabled={!feedbackContent || !selectedType || loading}
              className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 text-lg active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" /> Enviar Feedback
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
