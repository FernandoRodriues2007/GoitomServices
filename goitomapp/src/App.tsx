/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  LogOut, 
  Plus, 
  History, 
  Users, 
  BarChart3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ChevronRight,
  User,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
type Role = 'admin' | 'employee';

interface UserData {
  id: number;
  email: string;
  role: Role;
  name: string;
}

interface Record {
  id: number;
  employee_name: string;
  provider_name: string;
  bread_count: number;
  cash_amount: number;
  image_url: string;
  timestamp: string;
}

interface Stats {
  totalByDay: { date: string; total: number; total_cash: number }[];
  totalByEmployee: { employee_name: string; total: number; total_cash: number }[];
}

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [view, setView] = useState<'login' | 'signup' | 'dashboard' | 'camera' | 'history' | 'admin-users' | 'admin-stats' | 'profile'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [providerName, setProviderName] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  
  // Data states
  const [records, setRecords] = useState<Record[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [breadCount, setBreadCount] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (user) {
      fetchRecords();
      if (user.role === 'admin') {
        fetchAdminData();
      }
    }
  }, [user, view]);

  const fetchRecords = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/records?userId=${user.id}&role=${user.role}`);
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/stats')
      ]);
      setUsers(await usersRes.json());
      setStats(await statsRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setView('dashboard');
      } else {
        setError(data.error === 'Invalid credentials' ? 'Credenciais inválidas' : data.error);
      }
    } catch (err) {
      setError('Falha na ligação');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Conta criada! Por favor, faça login.');
        setView('login');
      } else {
        setError(data.error === 'Email already exists' ? 'O email já existe' : data.error);
      }
    } catch (err) {
      setError('Falha na ligação');
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setView('camera');
    setCapturedImage(null);
    setBreadCount(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Acesso à câmara negado');
      setView('dashboard');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        
        // Stop camera stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handlePublish = async () => {
    if (!capturedImage || !providerName || !user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          employeeName: user.name,
          providerName,
          cashAmount: parseFloat(cashAmount) || 0,
          imageBase64: capturedImage
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBreadCount(data.breadCount);
        setSuccess(`Publicado! Contagem: ${data.breadCount} pães.`);
        setTimeout(() => {
          setView('dashboard');
          setProviderName('');
          setCashAmount('');
          setSuccess(null);
        }, 2000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Falha ao publicar');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          email,
          name,
          password: password || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setSuccess('Perfil atualizado com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Falha ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Tem a certeza que deseja excluir este funcionário?')) return;
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      fetchAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const logout = () => {
    setUser(null);
    setView('login');
    setEmail('');
    setPassword('');
  };

  // Renderers
  const renderAuth = () => (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex justify-center mb-8">
          <div className="bg-yellow-400 p-3 rounded-xl">
            <Package className="w-8 h-8 text-black" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white text-center mb-2">GoitomApp</h1>
        <p className="text-zinc-400 text-center mb-8">
          {view === 'login' ? 'Bem-vindo de volta à padaria' : 'Junte-se à nossa equipa'}
        </p>

        <form onSubmit={view === 'login' ? handleLogin : handleSignup} className="space-y-4">
          {view === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Nome Completo</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                placeholder="Ex: João Silva"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Endereço de Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
              placeholder="nome@padaria.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Palavra-passe</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 p-3 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4" />
              {success}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (view === 'login' ? 'Entrar' : 'Criar Conta')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setView(view === 'login' ? 'signup' : 'login')}
            className="text-zinc-500 hover:text-yellow-400 text-sm transition-colors"
          >
            {view === 'login' ? "Não tem uma conta? Registe-se" : "Já tem uma conta? Faça login"}
          </button>
        </div>
      </motion.div>
    </div>
  );

  const renderDashboard = () => (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-black border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-400 p-2 rounded-lg">
            <Package className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">GoitomApp</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setName(user?.name || '');
              setEmail(user?.email || '');
              setPassword('');
              setView('profile');
            }}
            className="hidden sm:block text-right hover:opacity-80 transition-opacity"
          >
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-zinc-500 capitalize">{user?.role === 'admin' ? 'Administrador' : 'Funcionário'}</p>
          </button>
          <button 
            onClick={() => {
              setName(user?.name || '');
              setEmail(user?.email || '');
              setPassword('');
              setView('profile');
            }}
            className="sm:hidden p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
          >
            <User className="w-5 h-5" />
          </button>
          <button onClick={logout} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Quick Actions */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={startCamera}
            className="bg-yellow-400 hover:bg-yellow-500 text-black p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all transform hover:scale-[1.02] shadow-lg shadow-yellow-400/10"
          >
            <Camera className="w-10 h-10" />
            <span className="text-lg font-bold">Nova Contagem</span>
          </button>
          <button 
            onClick={() => setView('history')}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
          >
            <History className="w-10 h-10 text-yellow-400" />
            <span className="text-lg font-bold">Ver Histórico</span>
          </button>
        </section>

        {/* Admin Section */}
        {user?.role === 'admin' && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Administração</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => setView('admin-users')}
                className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-yellow-400" />
                  <span className="font-medium">Gerir Funcionários</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600" />
              </button>
              <button 
                onClick={() => setView('admin-stats')}
                className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-yellow-400" />
                  <span className="font-medium">Ver Estatísticas</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600" />
              </button>
            </div>
          </section>
        )}

        {/* Recent Activity */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Registos Recentes</h2>
            <button onClick={() => setView('history')} className="text-xs text-yellow-400 hover:underline">Ver todos</button>
          </div>
          <div className="space-y-3">
            {records.slice(0, 3).map((record) => (
              <div key={record.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                    <img src={record.image_url} alt="Bread" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-medium">{record.bread_count} Pães • {record.cash_amount.toLocaleString('pt-PT', { style: 'currency', currency: 'AOA' })}</p>
                    <p className="text-xs text-zinc-500">Por {record.provider_name} • {new Date(record.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500">{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {records.length === 0 && (
              <div className="text-center py-12 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl">
                <Package className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500">Nenhum registo encontrado.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );

  const renderCamera = () => (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="p-4 flex items-center justify-between bg-black/50 backdrop-blur-md absolute top-0 left-0 right-0 z-10">
        <button onClick={() => setView('dashboard')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </button>
        <span className="font-bold">Nova Contagem</span>
        <div className="w-10" />
      </div>

      {!capturedImage ? (
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-12 left-0 right-0 flex justify-center">
            <button 
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1"
            >
              <div className="w-full h-full bg-white rounded-full hover:scale-95 transition-transform" />
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto pt-20">
          <div className="aspect-square rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800 relative">
            <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
            {breadCount !== null && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-yellow-400 text-black w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black shadow-2xl"
                >
                  {breadCount}
                </motion.div>
                <p className="mt-4 font-bold text-xl">Pães detectados</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Quem trouxe o pão?</label>
                <input 
                  type="text" 
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                  placeholder="Nome da pessoa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Quantia Vendida (Dinheiro)</label>
                <input 
                  type="number" 
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setCapturedImage(null)}
                className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-xl font-bold"
              >
                Repetir
              </button>
              <button 
                onClick={handlePublish}
                disabled={loading || !providerName}
                className="flex-[2] bg-yellow-400 hover:bg-yellow-500 text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="bg-black border-b border-zinc-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => setView('dashboard')} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </button>
        <h1 className="text-xl font-bold">Histórico</h1>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        {records.map((record) => (
          <div key={record.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="aspect-video w-full bg-zinc-800">
              <img src={record.image_url} alt="Bread" className="w-full h-full object-cover" />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{record.bread_count} Pães</h3>
                <p className="text-lg font-semibold text-yellow-400">{record.cash_amount.toLocaleString('pt-PT', { style: 'currency', currency: 'AOA' })}</p>
                <p className="text-sm text-zinc-400">Fornecido por: {record.provider_name}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Registrado por {record.employee_name} em {new Date(record.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="bg-yellow-400/10 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold">
                VERIFICADO
              </div>
            </div>
          </div>
        ))}
        {records.length === 0 && (
          <div className="text-center py-20">
            <History className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-500">Nenhum registo encontrado.</p>
          </div>
        )}
      </main>
    </div>
  );

  const renderAdminUsers = () => (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="bg-black border-b border-zinc-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => setView('dashboard')} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </button>
        <h1 className="text-xl font-bold">Gerir Funcionários</h1>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        {users.map((u) => (
          <div key={u.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-black font-bold">
                {u.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold">{u.name}</p>
                <p className="text-xs text-zinc-500">{u.email}</p>
              </div>
            </div>
            <button 
              onClick={() => deleteUser(u.id)}
              className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </main>
    </div>
  );

  const renderAdminStats = () => (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="bg-black border-b border-zinc-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => setView('dashboard')} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </button>
        <h1 className="text-xl font-bold">Estatísticas</h1>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-yellow-400" />
            Total de Pães por Dia
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
            <div className="flex items-end gap-2 h-40">
              {stats?.totalByDay.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full bg-yellow-400 rounded-t-md transition-all"
                    style={{ height: `${(day.total / Math.max(...stats.totalByDay.map(d => d.total), 1)) * 100}%` }}
                  />
                  <span className="text-[10px] text-zinc-500 rotate-45 mt-2">{day.date.split('-').slice(1).join('/')}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-yellow-400" />
            Melhores Funcionários
          </h2>
          <div className="space-y-3">
            {stats?.totalByEmployee.map((emp, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                <span className="font-medium">{emp.employee_name}</span>
                <div className="text-right">
                  <p className="font-bold text-yellow-400">{emp.total} Pães</p>
                  <p className="text-xs text-zinc-500">{emp.total_cash.toLocaleString('pt-PT', { style: 'currency', currency: 'AOA' })}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );

  const renderProfile = () => (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="bg-black border-b border-zinc-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => setView('dashboard')} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </button>
        <h1 className="text-xl font-bold">Editar Perfil</h1>
      </header>

      <main className="max-w-md mx-auto p-6">
        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-full bg-yellow-400 flex items-center justify-center text-black text-4xl font-black">
              {user?.name.charAt(0)}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Nome Completo</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-yellow-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-yellow-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Nova Palavra-passe (deixe em branco para manter)</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 p-3 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4" />
              {success}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Alterações'}
          </button>
        </form>
      </main>
    </div>
  );

  return (
    <div className="font-sans antialiased text-white bg-black min-h-screen">
      <AnimatePresence mode="wait">
        {view === 'login' || view === 'signup' ? (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderAuth()}
          </motion.div>
        ) : view === 'dashboard' ? (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderDashboard()}
          </motion.div>
        ) : view === 'camera' ? (
          <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderCamera()}
          </motion.div>
        ) : view === 'history' ? (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderHistory()}
          </motion.div>
        ) : view === 'admin-users' ? (
          <motion.div key="admin-users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderAdminUsers()}
          </motion.div>
        ) : view === 'admin-stats' ? (
          <motion.div key="admin-stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderAdminStats()}
          </motion.div>
        ) : view === 'profile' ? (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderProfile()}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
