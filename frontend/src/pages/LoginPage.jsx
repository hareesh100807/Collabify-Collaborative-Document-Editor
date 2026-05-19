import {useState} from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import {useAuth} from '../context/AuthContext';

const LoginPage = () => {    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { setUser } = useAuth();
    const handleLogin = async (e) => {
        e.preventDefault();
        try{
          setLoading(true);
          setError("");
          const response = await axiosInstance.post('/auth/login/', { email, password });
          //save user
          setUser(response.data.payload);
          //redirect to home page
          navigate('/dashboard');
        } catch (error) {
          setError(error.response?.data?.error || "Login failed");
        } finally {
          setLoading(false);
        }
    }
}
return (

  <div className="min-h-screen flex items-center justify-center">
    <form onSubmit={handleLogin} className="w-full max-w-sm p-6 border rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">
        Login
      </h1>
      {error && (<p className="text-red-500 mb-4">{error}</p>)}
      {/* Email */}
      <div className="mb-4">
        <label className="block mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
      </div>
      {/* Password */}
      <div className="mb-4">
        <label className="block mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />

      </div>
       <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white p-2 rounded"
      >
        {loading ? "Logging in..." : "Login"}
      </button>
    </form>
  </div>
);
export default LoginPage;