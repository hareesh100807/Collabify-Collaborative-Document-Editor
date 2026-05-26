import React from 'react';

const ShareRequestsModal = ({ isOpen, onClose, requests, onAccept, onReject, loading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold">Pending Invitations</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                
                <div className="p-4 max-h-96 overflow-y-auto">
                    {requests.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No pending invitations.</p>
                    ) : (
                        <div className="space-y-4">
                            {requests.map((req) => (
                                <div key={req._id} className="border p-4 rounded-lg bg-gray-50 flex flex-col gap-2">
                                    <p className="text-sm">
                                        <span className="font-semibold">{req.fromUser?.username || req.fromUser?.email}</span> invited you to edit:
                                    </p>
                                    <p className="font-bold text-lg text-blue-600">{req.document?.title || "Untitled"}</p>
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button 
                                            disabled={loading}
                                            onClick={() => onReject(req._id)}
                                            className="px-4 py-1 text-red-600 border border-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                                        >
                                            Reject
                                        </button>
                                        <button 
                                            disabled={loading}
                                            onClick={() => onAccept(req._id)}
                                            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            Accept
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Close</button>
                </div>
            </div>
        </div>
    );
};

export default ShareRequestsModal;
