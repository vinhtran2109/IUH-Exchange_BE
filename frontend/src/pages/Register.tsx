import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

const Register: React.FC = () => {
  const [step, setStep] = useState(0);
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
        setStep(1);
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4">
      <div className="max-w-sm w-full">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
          {step === 0 ? (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Đăng ký</h1>
                <p className="text-slate-500 text-sm">Tạo tài khoản sinh viên IUH</p>
              </div>
              
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Mã số sinh viên</label>
                  <input 
                    type="text" 
                    required
                    placeholder="2109..."
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none transition-all text-sm"
                    value={formData.studentId}
                    onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Họ và tên</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none transition-all text-sm"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Email sinh viên</label>
                  <input 
                    type="email" 
                    required
                    placeholder="user@student.iuh.edu.vn"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none transition-all text-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Mật khẩu</label>
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none transition-all text-sm"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>

                {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
                
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {loading ? 'Đang tạo...' : 'Tiếp theo'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Xác thực</h1>
                <p className="text-slate-500 text-sm">Nhập mã OTP đã gửi tới email của bạn</p>
              </div>
              
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <input 
                  type="text" 
                  maxLength={6}
                  required
                  placeholder="• • • • • •"
                  className="w-full px-5 py-4 text-center text-2xl tracking-[0.8rem] rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none transition-all"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />

                {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
                
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {loading ? 'Đang xác thực...' : 'Hoàn tất'}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Đã có tài khoản?{' '}
              <Link to="/login" className="text-slate-900 font-medium hover:underline">Đăng nhập</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
