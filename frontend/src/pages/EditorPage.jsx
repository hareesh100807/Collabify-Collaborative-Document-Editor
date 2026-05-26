import React, { useEffect, useRef, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { addCollaborator, renameDocument, getCollaborators } from "../api/documentService.js";

const EditorPage = () => {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const quillRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [documentTitle, setDocumentTitle] = useState("Untitled Document");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
const [showCollabModal, setShowCollabModal] = useState(false);
const [collabInfo, setCollabInfo] = useState({ owner: null, collaborators: [], pendingCollaborators: [] });

  /* SOCKET CONNECTION */
  useEffect(() => {
    const s = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:4000", {
      withCredentials: true,
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  /* SOCKET DOCUMENT RENAMED */
  useEffect(() => {
    if (!socket) return;
    const renamedHandler = ({ title }) => {
      setDocumentTitle(title);
    };
    socket.on('document-renamed', renamedHandler);
    return () => {
      socket.off('document-renamed', renamedHandler);
    };
  }, [socket]);

  /*  LOAD DOCUMENT */
  useEffect(() => {
    if (!socket || !quillRef.current) return;
    const quill = quillRef.current.getEditor();
    quill.enable(false);
    socket.emit("join-document", documentId);
    
    /*LOAD DOCUMENT*/
    socket.once("load-document", (document) => {
      setDocumentTitle(document.title || "Untitled Document");
      quill.setContents(document.content || { ops: [] });
      quill.enable(true);
    });
    
    /*DOCUMENT NOT FOUND*/
    socket.on("document-not-found", () => {
      alert("Document not found");
      navigate("/dashboard");
    });
    
    /*NOT AUTHORIZED*/
    socket.on("not-authorized", () => {
      alert("You are not authorized to access this document");
      navigate("/dashboard");
    });
    
    /*ACTIVE USERS*/
    socket.on("active-users", (users) => {
      setActiveUsers(users);
    });
    
    /*RECEIVE CHANGES*/
    const receiveChangesHandler = (delta) => {
        quill.updateContents(delta, "silent");
    };
    socket.on("receive-changes", receiveChangesHandler);

    /* TYPING */
    socket.on("user-typing", (username) => {
      setTypingUser(username);
    });
    socket.on("user-stop-typing", () => {
      setTypingUser("");
    });
    
    return () => {
      socket.off("load-document");
      socket.off("document-not-found");
      socket.off("not-authorized");
      socket.off("active-users");
      socket.off("receive-changes", receiveChangesHandler);
      socket.off("user-typing");
      socket.off("user-stop-typing");
    };
  }, [socket, documentId, navigate]);

  /*SEND CHANGES */
  useEffect(() => {
    if (!socket || !quillRef.current) return;
    const quill = quillRef.current.getEditor();
    let typingTimeout;
    const textChangeHandler = ( delta, oldDelta, source ) => {
      if (source !== "user") return;
      /*SEND CHANGES*/
      socket.emit("send-changes", delta, documentId);
      /* TYPING */
      socket.emit("typing", { documentId, username: user?.username });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.emit("stop-typing", { documentId, username: user?.username });
        // Save document after user stops typing
        const currentContent = quill.getContents();
        socket.emit("save-document", { documentId, content: currentContent });
      }, 1000);
    };
    quill.on("text-change", textChangeHandler);
    return () => {
      quill.off("text-change", textChangeHandler);
    };
  }, [socket, documentId]);

  //document sharing
  const handleShareDocument = async () => {
    if(!shareEmail.trim()) return;
    try{
      setShareLoading(true);
      setShareMessage("");
      const response= await addCollaborator(documentId, shareEmail);
      setShareMessage(response.message||"Collaborator added");
      setShareEmail("");
    }catch(error){
      setShareMessage(error.response?.data?.message || "Error sharing document");
    }finally{
      setShareLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* HEADER */}
      <div className="bg-white shadow p-4 flex justify-between items-center z-10">
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="text-gray-600 hover:text-black font-medium">
            ← Back
          </button>
          {isEditingTitle ? (
            <input
              type="text"
              className="text-xl font-bold border-b border-gray-300 focus:outline-none focus:border-blue-500"
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={async () => {
                if (titleInput.trim() && titleInput !== documentTitle) {
                  try {
                    await renameDocument(documentId, titleInput.trim());
                    setDocumentTitle(titleInput.trim());
                  } catch (err) {
                    console.error('Rename failed', err);
                  }
                }
                setIsEditingTitle(false);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
          ) : (
            <h1 onClick={() => { setIsEditingTitle(true); setTitleInput(documentTitle); }} className="text-xl font-bold text-gray-800 border-l pl-4 cursor-pointer">
              {documentTitle}
            </h1>
          )}

        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">
          {/* TYPING */}
          {typingUser && (
            <p className="text-sm text-gray-500 italic">
              {typingUser} is typing...
            </p>
          )}
          {/* ACTIVE USERS */}
          {activeUsers.length > 0 && (
            <div className="flex gap-2">
              {activeUsers.map((u) => (
                <div
                  key={u.socketId}
                  className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium"
                >
                  {u.username}
                </div>
              ))}
            </div>
          )}
          {/* SHARE & COPY LINK */}
          <div className="flex items-center gap-2 relative">
            <input 
              type="email" 
              placeholder="Collaborator email" 
              value={shareEmail} 
              onChange={(e) => setShareEmail(e.target.value)} 
              className="border border-gray-300 rounded px-3 py-1 text-sm outline-none focus:border-blue-500"
            />
            <button 
              onClick={handleShareDocument}
              disabled={shareLoading}
              className="bg-blue-600 text-white px-4 py-1 rounded text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {shareLoading ? "Sharing..." : "Share"}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert("Link copied to clipboard!");
              }}
              className="bg-gray-200 text-gray-700 px-4 py-1 rounded text-sm font-medium hover:bg-gray-300 transition"
            >
              Copy Link
            </button>
            {shareMessage && (
              <span className="absolute top-full left-0 mt-1 text-xs text-blue-600 bg-white px-2 py-1 border rounded shadow-sm whitespace-nowrap">
                {shareMessage}
              </span>
            )}
          </div>
            {/* COLLABORATOR BUTTON */}
            <button
              onClick={async () => {
                try {
                  const data = await getCollaborators(documentId);
                  setCollabInfo(data);
                  setShowCollabModal(true);
                } catch (err) {
                  console.error('Failed to fetch collaborators', err);
                }
              }}
              className="bg-purple-500 text-white px-4 py-1 rounded text-sm font-medium hover:bg-purple-600 transition"
            >
              Collaborators
            </button>
            {/* Collaborators Modal */}
            {showCollabModal && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div className="bg-white rounded-lg shadow-lg w-96 max-h-[80vh] overflow-y-auto p-4">
                  <h2 className="text-xl font-bold mb-3">Document Access</h2>
                  <div className="mb-2">
                    <span className="font-semibold">Owner:</span> {collabInfo.owner?.username || collabInfo.owner?.email}
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">Collaborators:</span>
                    {collabInfo.collaborators && collabInfo.collaborators.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {collabInfo.collaborators.map((c) => (
                          <li key={c._id}>{c.username || c.email}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">None</p>
                    )}
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">Pending Invites:</span>
                    {collabInfo.pendingCollaborators && collabInfo.pendingCollaborators.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {collabInfo.pendingCollaborators.map((email, idx) => (
                          <li key={idx}>{email}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">None</p>
                    )}
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => setShowCollabModal(false)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Auto Saving
          </div>
        </div>
      </div>
      
      {/* EDITOR */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="max-w-5xl mx-auto bg-white shadow rounded h-full">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default EditorPage;