import {createContext, useState, useContext} from "react";
import {useEffect} from "react";
import axiosInstance from "../api/axios.js";
const AuthContext = createContext();
export const AuthProvider = ({children}) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try{
        const response = await axiosInstance.get("/auth/me");
        setUser(response.data.payload || response.data);
      } catch (error) {
        if(error.response?.status !== 401){
          console.error("Error fetching user:", error);
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const logout = async () => {
    try {
      await axiosInstance.post("/auth/logout");
      setUser(null);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{user, setUser, loading, logout}}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);