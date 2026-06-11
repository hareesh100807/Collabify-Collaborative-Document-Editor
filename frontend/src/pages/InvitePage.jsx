import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { handleShareLink } from '../api/documentService';
import { useAuth } from '../context/AuthContext';

const InvitePage = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const [status, setStatus] = useState("Processing invitation...");
    const [error, setError] = useState("");

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            // Not logged in -> redirect to register with invite token in state
            // The auth controller will resolve the token later when they sign up, 
            // actually since it's a link, we need to pass the token to registration.
            // For simplicity, we just ask them to login/register, then they can click the link again,
            // OR we can save the token in localStorage and process it after login.
            localStorage.setItem('pendingInviteToken', token);
            navigate('/register');
            return;
        }

        const processLink = async () => {
            try {
                const data = await handleShareLink(token);
                setStatus("Success! Redirecting to document...");
                setTimeout(() => {
                    navigate(`/documents/${data.documentId}`);
                }, 1000);
            } catch (err) {
                setError(err.response?.data?.message || "Invalid or expired invitation link");
            }
        };

        processLink();
    }, [user, authLoading, token, navigate]);

    if (error) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded shadow-md text-center max-w-sm">
                    <div className="text-red-500 text-5xl mb-4">❌</div>
                    <h2 className="text-xl font-bold mb-2">Invitation Failed</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button onClick={() => navigate('/dashboard')} className="bg-blue-500 text-white px-4 py-2 rounded">
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded shadow-md text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold">{status}</h2>
            </div>
        </div>
    );
};

export default InvitePage;
