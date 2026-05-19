import {useState} from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axios";
import {useAuth} from "../context/AuthContext";

const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { setUser } = useAuth();