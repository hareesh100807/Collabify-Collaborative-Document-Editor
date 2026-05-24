import React, { useEffect, useState, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const EditorPage = () => {
  const { id: documentId } = useParams();
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const quillRef = useRef(null);
  const navigate = useNavigate();

  // 1. Initialize Socket Connection
  useEffect(() => {
    const s = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000', {
      withCredentials: true,
    });
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // 2. Load Document and Handle Socket Events
  useEffect(() => {
    if (socket == null || quillRef.current == null) return;

    socket.emit('join-document', documentId);

    socket.once('load-document', (document) => {
      setDocumentTitle(document.title || 'Untitled Document');
      const quill = quillRef.current.getEditor();
      if (document.content && document.content.ops) {
         quill.setContents(document.content); // If it was saved as delta
      } else {
         quill.root.innerHTML = document.content || "";
      }
    });

    socket.on('document-not-found', () => {
       alert("Document not found or access denied.");
       navigate('/dashboard');
    });

    const handler = (delta) => {
      const quill = quillRef.current.getEditor();
      quill.updateContents(delta);
    };
    socket.on('receive-changes', handler);

    return () => {
      socket.off('receive-changes', handler);
      socket.off('load-document');
      socket.off('document-not-found');
    };
  }, [socket, documentId, navigate]);

  // 3. Handle Local Text Changes and Send to Socket
  useEffect(() => {
    if (socket == null || quillRef.current == null) return;

    const quill = quillRef.current.getEditor();
    const handler = (delta, oldDelta, source) => {
      if (source !== 'user') return;
      socket.emit('send-changes', delta, documentId);
    };

    quill.on('text-change', handler);

    return () => {
      quill.off('text-change', handler);
    };
  }, [socket, documentId]);

  // 4. Auto-save periodically
  useEffect(() => {
    if (socket == null || quillRef.current == null) return;

    const interval = setInterval(() => {
      const quill = quillRef.current.getEditor();
      const content = quill.root.innerHTML; 
      socket.emit('save-document', { documentId, content, userId: user._id });
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [socket, documentId, user]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white shadow p-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-gray-800 truncate px-4 border-l">
            {documentTitle}
          </h1>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
             Auto-saving
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <ReactQuill
          ref={quillRef}
          theme="snow"
          className="h-full bg-white max-w-5xl mx-auto shadow-sm"
        />
      </div>
    </div>
  );
};

export default EditorPage;