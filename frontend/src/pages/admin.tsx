import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Server,
  Database,
  Terminal,
  Activity,
  Cpu,
  HardDrive,
  Users,
  Compass,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  Search,
  Sliders,
  Send,
  Eye,
  Trash2,
  Layers,
  HelpCircle,
  Command,
  FileCode,
  ShieldAlert as AdminShield
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

// ==========================================
// INTERFACES & MOCK DATABASE MODELS
// ==========================================

interface SystemNode {
  id: string;
  name: string;
  type: 'service' | 'cache' | 'broker' | 'database';
  status: 'online' | 'degraded' | 'offline';
  cpu: number;
  memory: number;
  uptime: string;
  version: string;
}

interface QueryLog {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  durationMs: number;
  statusCode: number;
  clientIp: string;
}

// ==========================================
// PRESET MOCK DATASETS
// ==========================================

const MOCK_NODES: SystemNode[] = [
  { id: 'node-1', name: 'API Gateway Proxy', type: 'service', status: 'online', cpu: 14, memory: 42, uptime: '14 ngày, 3 giờ', version: 'v1.4.2' },
  { id: 'node-2', name: 'User Authentication Service', type: 'service', status: 'online', cpu: 8, memory: 31, uptime: '14 ngày, 3 giờ', version: 'v1.1.0' },
  { id: 'node-3', name: 'Product Exchange Catalog', type: 'service', status: 'online', cpu: 22, memory: 58, uptime: '5 ngày, 12 giờ', version: 'v2.0.4' },
  { id: 'node-4', name: 'Order Matching Core', type: 'service', status: 'online', cpu: 45, memory: 88, uptime: '2 ngày, 1 giờ', version: 'v1.8.9' },
  { id: 'node-5', name: 'Redis Cache Cluster', type: 'cache', status: 'online', cpu: 4, memory: 72, uptime: '45 ngày, 8 giờ', version: 'v7.2.1' },
  { id: 'node-6', name: 'Kafka Event Broker', type: 'broker', status: 'degraded', cpu: 78, memory: 91, uptime: '8 ngày, 19 giờ', version: 'v3.5.0' },
  { id: 'node-7', name: 'Primary MongoDB instance', type: 'database', status: 'online', cpu: 19, memory: 64, uptime: '60 ngày, 10 giờ', version: 'v6.0.8' },
];

const MOCK_LOGS: QueryLog[] = [
  { id: 'log-1', timestamp: '2026-06-02T13:14:22Z', method: 'GET', path: '/api/v1/products/available?page=1&size=12', durationMs: 18, statusCode: 200, clientIp: '192.168.1.45' },
  { id: 'log-2', timestamp: '2026-06-02T13:14:25Z', method: 'POST', path: '/api/v1/auth/login', durationMs: 240, statusCode: 200, clientIp: '115.79.42.109' },
  { id: 'log-3', timestamp: '2026-06-02T13:14:31Z', method: 'PUT', path: '/api/v1/users/profile/update', durationMs: 82, statusCode: 401, clientIp: '14.161.22.8' },
  { id: 'log-4', timestamp: '2026-06-02T13:14:38Z', method: 'DELETE', path: '/api/v1/products/delete/64b59f71c', durationMs: 45, statusCode: 204, clientIp: '192.168.1.12' },
  { id: 'log-5', timestamp: '2026-06-02T13:14:45Z', method: 'GET', path: '/api/v1/admin/stats/overview', durationMs: 310, statusCode: 403, clientIp: '27.72.90.155' },
];

const admin: React.FC = () => {
  const { user } = useAuthStore() as any;
  const [activeView, setActiveView] = useState<'status' | 'queries' | 'configs' | 'terminal'>('status');
  const [nodes, setNodes] = useState<SystemNode[]>(MOCK_NODES);
  const [logs, setLogs] = useState<QueryLog[]>(MOCK_LOGS);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    'IUH Exchange Sandbox Kernel Init Successful.',
    'Establishing secure context... DONE.',
    'System status check complete: All core services reported active.',
    'Ready for terminal query dispatch.'
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSimulatingLoad, setIsSimulatingLoad] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState('ALL');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  // Simulated live updates for nodes
  useEffect(() => {
    if (!isSimulatingLoad) return;
    
    const interval = setInterval(() => {
      setNodes((prev) =>
        prev.map((node) => {
          const cpuDelta = Math.floor(Math.random() * 15) - 7; // -7 to +7
          const memDelta = Math.floor(Math.random() * 5) - 2;   // -2 to +2
          return {
            ...node,
            cpu: Math.max(2, Math.min(99, node.cpu + cpuDelta)),
            memory: Math.max(10, Math.min(98, node.memory + memDelta)),
          };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [isSimulatingLoad]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLogs((prev) => [
      {
        id: 'log-' + (prev.length + 1),
        timestamp: new Date().toISOString(),
        method: Math.random() > 0.4 ? 'GET' : 'POST',
        path: '/api/v1/products/search?q=' + ['phone', 'laptop', 'book', 'bike'][Math.floor(Math.random() * 4)],
        durationMs: Math.floor(Math.random() * 120) + 12,
        statusCode: 200,
        clientIp: '192.168.1.' + Math.floor(Math.random() * 254),
      },
      ...prev.slice(0, 8)
    ]);
    setIsRefreshing(false);
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim().toLowerCase();
    let response = `Unknown command: '${cmd}'. Type 'help' for available diagnostic statements.`;

    if (cmd === 'help') {
      response = 'Available sandbox routines: status, cluster-info, clear, simulate-load, sys-health';
    } else if (cmd === 'status') {
      response = `Cluster STATUS: Nominal. Active Services: ${nodes.filter(n => n.status === 'online').length}/${nodes.length}`;
    } else if (cmd === 'cluster-info') {
      response = 'Kubernetes Base Context: base-cluster.iuh.exchange.local | Node Count: 7 | Region: VN-HCM';
    } else if (cmd === 'clear') {
      setTerminalOutput([]);
      setTerminalInput('');
      return;
    } else if (cmd === 'simulate-load') {
      setIsSimulatingLoad(true);
      response = 'Simulated client query thread started. Monitoring metrics...';
    } else if (cmd === 'sys-health') {
      response = 'System Health Metrics: CPU AVG: 21% | RAM AVG: 61% | DB I/O: NORMAL | REDIS HIT: 98.4%';
    }

    setTerminalOutput((prev) => [...prev, `iuh-admin@shell:~$ ${terminalInput}`, response]);
    setTerminalInput('');
  };

  const handleSendBroadcast = () => {
    if (!broadcastMessage.trim()) return;
    setBroadcastSuccess(true);
    setTimeout(() => {
      setBroadcastSuccess(false);
      setBroadcastMessage('');
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600/30">
      {/* Top Banner Alert */}
      <div className="bg-indigo-950 border-b border-indigo-900 text-indigo-300 px-6 py-2.5 text-xs flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="animate-pulse" />
          <span><strong>BẢNG ĐIỀU KHIỂN CHẨN ĐOÁN (SANDBOX):</strong> Đây là giao diện chẩn đoán giả lập biệt lập dành riêng cho Quản trị viên Kỹ thuật (SRE Panel).</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] bg-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded border border-indigo-500/30">SANDBOX ONLY</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Control Panel Navigation */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between">
          <div>
            <div className="p-6 border-b border-slate-800 flex items-center gap-3 bg-slate-950/20">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                <AdminShield size={18} />
              </div>
              <div>
                <h2 className="font-bold text-xs text-white uppercase tracking-wider">IUH Operational</h2>
                <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">Admin Terminal v3</span>
              </div>
            </div>

            <nav className="p-4 space-y-1.5">
              {[
                { id: 'status', label: 'Trạng thái Microservices', icon: Server },
                { id: 'queries', label: 'Luồng Request logs', icon: Database },
                { id: 'configs', label: 'Tham số Cấu hình', icon: Sliders },
                { id: 'terminal', label: 'Console chẩn đoán', icon: Terminal },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveView(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <Icon size={15} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-950/30">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span>SIMULATED LOAD</span>
                <span className={isSimulatingLoad ? 'text-emerald-400' : 'text-slate-500'}>
                  {isSimulatingLoad ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <button
                onClick={() => setIsSimulatingLoad(!isSimulatingLoad)}
                className={`w-full py-1.5 rounded text-[10px] font-bold transition-all ${
                  isSimulatingLoad
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isSimulatingLoad ? 'Hủy mô phỏng' : 'Kích hoạt mô phỏng'}
              </button>
            </div>
          </div>
        </aside>

        {/* Dynamic Main Workspace Area */}
        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <Activity size={20} className="text-indigo-400" />
                <span>Hệ Thống Phân Tích & Chẩn Đoán Cụm Máy Chủ</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">Giám sát tài nguyên CPU, RAM, Cache hit rate và cấu hình các máy chủ của phân hệ User-Service.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <RotateCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Tải lại log</span>
              </button>
            </div>
          </header>

          {/* VIEW: System status */}
          {activeView === 'status' && (
            <div className="space-y-6">
              {/* Aggregated Hardware Usage Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">CPU Usage AVG</span>
                    <h3 className="text-xl font-bold text-white">24.5%</h3>
                    <div className="w-32 bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: '24.5%' }}></div>
                    </div>
                  </div>
                  <Cpu size={28} className="text-indigo-400/20" />
                </div>

                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Memory Allocated</span>
                    <h3 className="text-xl font-bold text-white">6.4 GB / 8.0 GB</h3>
                    <div className="w-32 bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: '80%' }}></div>
                    </div>
                  </div>
                  <HardDrive size={28} className="text-amber-400/20" />
                </div>

                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Network Traffic Out</span>
                    <h3 className="text-xl font-bold text-white">124.8 Mbps</h3>
                    <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-0.5 mt-1">
                      Băng thông ổn định
                    </span>
                  </div>
                  <Activity size={28} className="text-emerald-400/20" />
                </div>
              </div>

              {/* Node Metrics Details */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-800 bg-slate-950/20">
                  <h4 className="text-xs font-bold text-slate-300 uppercase">Danh Sách Cụm Máy Chủ Thành Phần</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                        <th className="p-4">Tên Máy Chủ</th>
                        <th className="p-4">Phân Loại</th>
                        <th className="p-4">Trạng Thái</th>
                        <th className="p-4">CPU sử dụng</th>
                        <th className="p-4">RAM sử dụng</th>
                        <th className="p-4">Uptime</th>
                        <th className="p-4">Phiên bản</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {nodes.map((n) => (
                        <tr key={n.id} className="hover:bg-slate-800/10 transition-colors">
                          <td className="p-4 font-bold text-slate-200">{n.name}</td>
                          <td className="p-4 font-semibold text-slate-400 uppercase text-[9px] tracking-wider">{n.type}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                              n.status === 'online'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : n.status === 'degraded'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                n.status === 'online' ? 'bg-emerald-500' : n.status === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'
                              }`} />
                              {n.status === 'online' ? 'Bình thường' : n.status === 'degraded' ? 'Qúa tải' : 'Ngoại tuyến'}
                            </span>
                          </td>
                          <td className="p-4 font-semibold font-mono text-slate-300">{n.cpu}%</td>
                          <td className="p-4 font-semibold font-mono text-slate-300">{n.memory}%</td>
                          <td className="p-4 text-slate-500">{n.uptime}</td>
                          <td className="p-4 text-slate-500 font-mono">{n.version}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Request logs */}
          {activeView === 'queries' && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-800 bg-slate-950/20">
                <h4 className="text-xs font-bold text-slate-300 uppercase">Lịch Sử Yêu Cầu Gần Nhất (Live Traffic)</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                      <th className="p-4">Mốc Thời Gian</th>
                      <th className="p-4">Phương thức</th>
                      <th className="p-4">Đường dẫn Request</th>
                      <th className="p-4">Độ Trễ Phản Hồi</th>
                      <th className="p-4">Status Code</th>
                      <th className="p-4">Địa Chỉ Client IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/10 transition-colors font-mono">
                        <td className="p-4 text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="p-4">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${
                            log.method === 'GET' ? 'bg-emerald-600' : log.method === 'POST' ? 'bg-indigo-600' : 'bg-amber-600'
                          }`}>{log.method}</span>
                        </td>
                        <td className="p-4 text-slate-200 font-bold">{log.path}</td>
                        <td className="p-4 text-slate-400">{log.durationMs}ms</td>
                        <td className="p-4">
                          <span className={`font-bold ${log.statusCode < 300 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {log.statusCode}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500">{log.clientIp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: Cấu hình system */}
          {activeView === 'configs' && (
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 max-w-2xl space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase">Cấu Hình Biến Môi Trường (System Variables)</h3>
                <p className="text-[10px] text-slate-500 mt-1">Thông số điều khiển hành vi chung của hệ thống User-Service trong chế độ Sandbox.</p>
              </div>

              <div className="space-y-4">
                {[
                  { name: 'Môi trường hệ thống (NODE_ENV)', val: 'production', desc: 'Quyết định chế độ tối ưu hoá bundle và ẩn log debug.' },
                  { name: 'Thời gian sống Token (JWT_EXPIRE_MIN)', val: '15 phút', desc: 'Thời hạn hiệu lực của Access Token được gửi đi.' },
                  { name: 'Thời gian hết hạn OTP (OTP_EXPIRY_MS)', val: '600,000ms (10 phút)', desc: 'Thời gian tối đa để xác thực mã số OTP gửi qua email.' },
                  { name: 'Số lần đăng nhập sai tối đa', val: '5 lần', desc: 'Số lần thử trước khi khoá tạm thời tài khoản trong 15 phút.' },
                  { name: 'Bảo mật 2 lớp Admin Portal', val: 'ENABLED', desc: 'Bắt buộc xác thực OTP 2FA cho tài khoản thuộc quản trị viên.' },
                ].map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-200 block">{item.name}</span>
                      <span className="text-[10px] text-slate-500 block">{item.desc}</span>
                    </div>
                    <span className="text-xs font-mono font-bold bg-slate-900 text-indigo-400 px-3 py-1 rounded border border-slate-800">
                      {item.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: Diagnostic Terminal */}
          {activeView === 'terminal' && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-2">
                  <Terminal size={14} className="text-indigo-400" />
                  Console Hệ Thống Sandbox
                </span>
                <span className="text-[9px] text-slate-500 font-mono">Gõ 'help' để xem danh sách câu lệnh</span>
              </div>

              {/* Console log display */}
              <div className="p-5 bg-slate-950 h-80 overflow-y-auto font-mono text-xs text-slate-300 space-y-2 select-text">
                {terminalOutput.map((line, idx) => (
                  <p key={idx} className={line.startsWith('iuh-admin') ? 'text-indigo-400' : 'text-slate-300'}>
                    {line}
                  </p>
                ))}
              </div>

              {/* Form command input */}
              <form onSubmit={handleTerminalSubmit} className="p-3 border-t border-slate-800 bg-slate-900 flex items-center">
                <span className="text-xs font-mono text-indigo-400 mr-2 select-none">iuh-admin@shell:~$</span>
                <input
                  type="text"
                  placeholder="Nhập câu lệnh chẩn đoán hệ thống..."
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-slate-100 font-mono focus:outline-none"
                />
              </form>
            </div>
          )}

          {/* Broadcast alert simulator */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 max-w-2xl space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase">Mô Phỏng Phát Sóng Khẩn Cấp (Sandbox Broadcast)</h3>
              <p className="text-[10px] text-slate-500 mt-1">Phát đi thông điệp hệ thống hoặc thông báo khẩn cấp dạng banner đến ứng dụng mẫu.</p>
            </div>

            {broadcastSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-semibold">
                Đã xếp hàng phát sóng khẩn cấp thành công!
              </div>
            )}

            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Nhập nội dung thông điệp hệ thống phát đi khẩn cấp..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:border-slate-700 focus:outline-none"
                />
              </div>
              <button
                onClick={handleSendBroadcast}
                disabled={!broadcastMessage.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2"
              >
                <Send size={12} />
                <span>Phát Sóng</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default admin;
