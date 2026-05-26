import axiosInstance from "./axios.js";

// get all documents for the logged in user
export const getDocuments = async () => {
  const response = await axiosInstance.get("/documents");
  return response.data.documents;
};

//Create a new document
export const createDocument = async (data) => {
  const response = await axiosInstance.post("/documents", data);
  return response.data.document;
};
//rename document
export const renameDocument = async (id, title) => {
  const response = await axiosInstance.patch(`/documents/${id}/rename`, { title });
  return response.data;
};

//delete document
export const deleteDocument = async (id) => {
  const response = await axiosInstance.delete(`/documents/${id}`);
  return response.data;
};

export const getCollaborators = async (id) => {
  const response = await axiosInstance.get(`/documents/${id}/collaborators`);
  return response.data;
};
export const addCollaborator = async (documentId, email) => {
  const response = await axiosInstance.post(`/share/${documentId}/collaborators`, { email });
  return response.data;
}

//remove collaborator
export const removeCollaborator = async (documentId, email) => {
  const response = await axiosInstance.post(`/share/${documentId}/collaborators/remove`, { email });
  return response.data;
}

//get share requests
export const getShareRequests = async () => {
  const response = await axiosInstance.get('/share/requests');
  return response.data.requests;
}

//accept share request
export const acceptShareRequest = async (requestId) => {
  const response = await axiosInstance.post(`/share/requests/${requestId}/accept`);
  return response.data;
}

//reject share request
export const rejectShareRequest = async (requestId) => {
  const response = await axiosInstance.post(`/share/requests/${requestId}/reject`);
  return response.data;
}

//generate share link
export const generateShareLink = async (documentId) => {
  const response = await axiosInstance.post(`/share/${documentId}/link`);
  return response.data;
}

//handle share link
export const handleShareLink = async (token) => {
  const response = await axiosInstance.get(`/share/invite/${token}`);
  return response.data;
}
