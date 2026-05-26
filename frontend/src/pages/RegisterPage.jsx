import {useState} from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axios";
import {useAuth} from "../context/AuthContext";
import { GoogleLogin } from '@react-oauth/google';

const RegisterPage = () => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { setUser } = useAuth();

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError('');
            const response = await axiosInstance.post('/auth/register', { username, email, password });
            setUser(response.data.payload);
            navigate('/dashboard');
        }
        catch(err){
            setError(err.response?.data?.error || 'Registration failed. Please try again.');
        }
        finally{
            setLoading(false);
        }
    };

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
            setError(error.response?.data?.error || "Google Signup failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center">
            <form onSubmit={handleRegister} className="bg-white p-6 rounded shadow-md w-full max-w-sm">
                <h1 className="text-xl font-bold mb-4">Register</h1>
                {error && (<p className="text-red-500 mb-4">{error}</p>)}
                {/* Username */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Username</label>
                    <input 
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full border p-2 rounded"
                        required
                    />
                </div>
                {/* Email */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full border p-2 rounded"
                        required

                    />
                </div>
                {/* Password */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Password</label>
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border p-2 rounded"
                        required
                    />
                </div>
                {/* Submit Button */}
                <button type="submit" disabled={loading} className="w-full bg-black text-white p-2 rounded">
                    {loading ? 'Registering...' : 'Register'}
                </button>
                
                <div className="my-4 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-gray-300 after:mt-0.5 after:flex-1 after:border-t after:border-gray-300">
                    <p className="mx-4 mb-0 text-center font-semibold text-gray-500">OR</p>
                </div>
                <div className="flex justify-center">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError("Google Signup failed")}
                    />
                </div>
            </form>
        </div>
    );
};

export default RegisterPage;

               