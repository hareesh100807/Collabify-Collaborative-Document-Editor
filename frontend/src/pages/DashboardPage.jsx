import {useAuth} from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {useEffect,useState} from "react";
import {getDocuments, createDocument, deleteDocument} from "../api/documentService";
import axiosInstance from "../api/axios";

const DashboardPage = () => {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetch user's documents on component mount
    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const docs = await getDocuments();
            setDocuments(docs);
        }catch(err){
            setError('Failed to load documents. Please try again.');
        }
        finally{
            setLoading(false);
        }
    };

    // Refetch documents whenever user changes (e.g., on login)
    useEffect(() => {
        if (user) {
            fetchDocuments();
        }
    }, [user]);

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
        </div>            
    );
};

export default DashboardPage;