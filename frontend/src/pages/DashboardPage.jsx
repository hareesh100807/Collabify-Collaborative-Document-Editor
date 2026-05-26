import {useAuth} from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {useEffect,useState} from "react";
import {getDocuments, createDocument, deleteDocument, getShareRequests, acceptShareRequest, rejectShareRequest} from "../api/documentService";
import ShareRequestsModal from "../components/ShareRequestsModal";
import axiosInstance from "../api/axios";

const DashboardPage = () => {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [shareRequests, setShareRequests] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');

    // Fetch user's documents and share requests on component mount
    const fetchData = async () => {
        try {
            setLoading(true);
            const [docs, requests] = await Promise.all([
                getDocuments(),
                getShareRequests()
            ]);
            setDocuments(docs);
            setShareRequests(requests);
        }catch(err){
            setError('Failed to load documents. Please try again.');
        }
        finally{
            setLoading(false);
        }
    };

    // Refetch data whenever user changes (e.g., on login)
    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const handleAcceptRequest = async (requestId) => {
        try {
            setActionLoading(true);
            await acceptShareRequest(requestId);
            setShareRequests(prev => prev.filter(req => req._id !== requestId));
            // Refresh documents to include the new one
            const docs = await getDocuments();
            setDocuments(docs);
        } catch (err) {
            alert('Failed to accept request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectRequest = async (requestId) => {
        try {
            setActionLoading(true);
            await rejectShareRequest(requestId);
            setShareRequests(prev => prev.filter(req => req._id !== requestId));
        } catch (err) {
            alert('Failed to reject request');
        } finally {
            setActionLoading(false);
        }
    };

    // Handler for creating document
    const handleCreateDocument = async () => {
        try {
            const newDoc = await createDocument({ title: "Untitled", content: "" });
            navigate(`/documents/${newDoc._id}`);
        } catch (err) {
            setError('Failed to create document. Please try again.');
        }
    };

    // Handler for logout
    const handleLogout = async () => {
        try {
            await axiosInstance.post('/auth/logout');
            setUser(null);
            navigate('/login');
        } catch (err) {
            console.error("Logout failed:", err);
        }
    };

    //Handler for deleting document
    const handleDeleteDocument = async (id) => {
        try {
            await deleteDocument(id);
            setDocuments((prev)=> prev.filter(doc => doc._id !== id));
        } catch (err) {
            setError('Failed to delete document. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
          {/* Navbar */}
          <div className="bg-white shadow p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">Collaborative Editor</h1>
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="relative text-gray-600 hover:text-black transition p-2"
                    title="Share Requests"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {shareRequests.length > 0 && (
                        <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                            {shareRequests.length}
                        </span>
                    )}
                </button>
                <p>Welcome <span className="font-semibold">{user?.username}</span></p>
                <button className="bg-red-500 text-white px-3 py-1 rounded" onClick={handleLogout}>Logout</button>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-5xl mx-auto p-6">
            {/* Top Section */}
            <div className="flex justify-between items-center mb-6">
              <h2 className=" text-2xl font-bold">My Documents</h2>
              <button className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 transition" onClick={handleCreateDocument}>New Document</button>
            </div>

            {loading ? (
              <p className="text-gray-500">Loading documents...</p>
            ) : (
              <>
                {error && (<p className="text-red-500 mb-4">{error}</p>)}   
                {documents.length === 0 ? (
                  <p className="text-gray-500 italic">No Documents found. Create one to get started!</p>
                ) : (                
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map(doc => (
                      <div key={doc._id} className="bg-white p-4 rounded shadow hover:shadow-lg transition">
                        <h3 className="text-lg font-semibold mb-2">{doc.title}</h3>
                        <p className="text-sm text-gray-600 mb-4">Updated: {new Date(doc.updatedAt).toLocaleString()}</p>
                        <div className="flex justify-end gap-2">
                          <button className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition" onClick={() => navigate(`/documents/${doc._id}`)}>Open</button>
                          <button className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition" onClick={() => handleDeleteDocument(doc._id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          
          <ShareRequestsModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            requests={shareRequests} 
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            loading={actionLoading}
          />
        </div>            
    );
};

export default DashboardPage;