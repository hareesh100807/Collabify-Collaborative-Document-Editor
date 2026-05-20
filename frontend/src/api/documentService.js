import axiosInstance from "./axios.js";

// get all documents for the logged in user
export const getDocuments = async () => {
  const response = await axiosInstance.get("/documents");
  return response.data.documents;
};

//Create a new document
export const createDocument = async (data) => {
  const response = await axiosInstance.post("/documents", { data });
  return response.data.document;
};
//delete document
export const deleteDocument = async (id) => {
  const response = await axiosInstance.delete(`/documents/${id}`);
  return response.data;
};