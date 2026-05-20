import {createContext, useState, useContext} from "react";
import {useEffect} from "react";
import axiosInstance from "../api/axios.js";
const AuthContext = createContext();
export const AuthProvider = ({children}) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try{
        const response = await axiosInstance.get("/auth/me");
        setUser(response.data.payload);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{user, setUser}}>
      {children}
    </AuthContext.Provider>
  );
};
export default AuthContext;
export const useAuth = () => useContext(AuthContext);
