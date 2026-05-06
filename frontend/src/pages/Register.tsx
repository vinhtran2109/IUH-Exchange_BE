import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

const Register: React.FC = () => {
  const [step, setStep] = useState(0); // 0: Info, 1: OTP
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    studentId: '',
  });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await authService.register(formData);
      if (response.success) {
        setStep(1); // Chuyển sang bước nhập OTP
      } else {
        setError(response.message || 'Đăng ký thất bại');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Lỗi kết nối tới Server');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await authService.verifyOtp(formData.email, otp);
      if (response.success) {
        alert('Xác thực thành công! Hãy đăng nhập ngay.');
        navigate('/login');
      } else {
        setError(response.message || 'Mã OTP không đúng');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Mã OTP không hợp lệ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center py-20 px-4 max-w-md mx-auto">
      <div className={`shadow-2xl p-12 rounded-3xl border border-slate-100 bg-white transition-all ${step === 0 ? 'shadow-emerald-100 hover:border-emerald-200' : 'shadow-indigo-100 hover:border-indigo-200'}`}>
        
        {step === 0 ? (
          <>
            <h1 className="text-4xl font-black text-slate-900 mb-2">Đăng ký</h1>
            <p className="text-slate-500 mb-8 font-medium">Tạo tài khoản sinh viên IUH</p>
            
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="text-left">
                <label className="block text-sm font-bold text-slate-700 mb-1 ml-1">Mã số sinh viên</label>
                <input 
                  type="text" 
                  required
                  placeholder="2109..."
                  className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                  value={formData.studentId}
                  onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                />
              </div>

              <div className="text-left">
                <label className="block text-sm font-bold text-slate-700 mb-1 ml-1">Họ và tên</label>
                <input 
                  type="text" 
                  required
                  placeholder="Nguyễn Văn A"
                  className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="text-left">
                <label className="block text-sm font-bold text-slate-700 mb-1 ml-1">Email sinh viên (@student.iuh.edu.vn)</label>
                <input 
                  type="email" 
                  required
                  placeholder="user@student.iuh.edu.vn"
                  className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="text-left">
                <label className="block text-sm font-bold text-slate-700 mb-1 ml-1">Mật khẩu</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full px-5 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>

              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
              
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-emerald-100 mb-6 disabled:opacity-50"
              >
                {loading ? 'Đang tạo...' : 'Tiếp theo'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-black text-slate-900 mb-2">Xác thực</h1>
            <p className="text-slate-500 mb-8 font-medium">Nhập mã OTP đã gửi tới email của bạn</p>
            
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <input 
                type="text" 
                maxLength={6}
                required
                placeholder="• • • • • •"
                className="w-full px-5 py-5 text-center text-3xl tracking-[1rem] rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />

              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
              
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-indigo-100 mb-6 disabled:opacity-50"
              >
                {loading ? 'Đang xác thực...' : 'Hoàn tất'}
              </button>
            </form>
          </>
        )}

        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 font-medium">
          Đã có tài khoản? 
          <Link to="/login" className="text-emerald-600 font-bold hover:underline">Đăng nhập</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
