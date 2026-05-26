import {useState} from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import {useAuth} from '../context/AuthContext.jsx';
import { GoogleLogin } from '@react-oauth/google';

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

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            setLoading(true);
            setError("");
            const response = await axiosInstance.post('/auth/google', {
                credential: credentialResponse.credential
            });
            setUser(response.data.payload);
            navigate('/dashboard');
        } catch (error) {
            setError(error.response?.data?.error || "Google Login failed");
        } finally {
            setLoading(false);
        }
    };

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
      
      <div className="my-4 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-gray-300 after:mt-0.5 after:flex-1 after:border-t after:border-gray-300">
          <p className="mx-4 mb-0 text-center font-semibold text-gray-500">OR</p>
      </div>
      <div className="flex justify-center">
          <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google Login failed")}
          />
      </div>
    </form>
  </div>
);
}
export default LoginPage;