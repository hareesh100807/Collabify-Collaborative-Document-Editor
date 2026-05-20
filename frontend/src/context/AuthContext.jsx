import {createContext, useState, useContext} from "react";
import {useEffect} from "react";
import axiosInstance from "..utils/axios.js";
const AuthContext = createContext();
export const AuthProvider = ({children}) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const response = await axiosInstance.get("/auth/me");
      setUser(response.data.user);
    };
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{user, setUser}}>
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => useContext(AuthContext);