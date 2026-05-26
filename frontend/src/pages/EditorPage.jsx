import React, { useEffect, useRef, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import {addCollaborator} from "../api/documentService.js";

const EditorPage = () => {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const quillRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [documentTitle, setDocumentTitle] = useState("Untitled Document");
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

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
      }, 1000);
    };
    quill.on("text-change", textChangeHandler);
    return () => {
      quill.off("text-change", textChangeHandler);
    };
  }, [socket, documentId]);

  /* AUTO SAVE */
  useEffect(() => {
    if (!socket || !quillRef.current) return;
    const interval = setInterval(() => {
      const quill = quillRef.current.getEditor();
      const content = quill.getContents();
      socket.emit("save-document", { documentId, content });
    }, 2000);
    return () => {
      clearInterval(interval);
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
          <h1 className="text-xl font-bold text-gray-800 border-l pl-4">
            {documentTitle}
          </h1>
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
          {/* AUTO SAVE */}
          <div className="flex items-center gap-2">
            <input type="email" placeholder="Collaborator email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
            
          </div>
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