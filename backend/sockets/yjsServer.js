import * as Y from 'yjs';

//store yjs documents
const documents = new Map();
export const getYDoc = (docId) => {
    //create new document if it doesn't exist
    if (!documents.has(docId)) {
        const ydoc = new Y.Doc();
        documents.set(docId, ydoc);
    }
    return documents.get(docId);
};