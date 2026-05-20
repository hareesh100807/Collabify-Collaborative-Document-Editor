import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const EditorPage = () => {
  return(
    <div className="h-screen">

      <div className="bg-gray-800 text-white p-4">

        Collaborative Editor

      </div>



      <ReactQuill
        theme="snow"
        className="h-[90vh]"
      />

    </div>
  );
};

export default EditorPage;