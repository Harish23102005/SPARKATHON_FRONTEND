// src/pages/LoginSignup.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import "./LoginSignup.css";

const LoginSignup = ({ isSignup, setIsSignup }) => {
  const navigate = useNavigate();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const togglePassword = () => {
    setPasswordVisible((prev) => !prev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000"; // Fallback for local development
      const url = isSignup ? `${baseUrl}/api/signup` : `${baseUrl}/api/login`;
      const res = await axios.post(url, formData);
      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
        alert(`${isSignup ? "Signup" : "Login"} successful!`);
        navigate("/dashboard");
      } else {
        alert(res.data.error || "Invalid credentials!");
      }
    } catch (error) {
      alert(error.response?.data?.error || "Something went wrong!");
    }
  };
  // Create an array of spans for the background grid
  const spans = Array.from({ length: 480 }).map((_, index) => (
    <span key={index}></span>
  ));

  return (
    <section>
      {spans}
      <div className="box">
        <div className="login">
          <div className="loginBx">
            <h2>
              {isSignup ? "Sign" : "Log"}<i>{isSignup ? "up" : "in"}</i>
            </h2>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Email"
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
              <div className="password-container">
                <input
                  type={passwordVisible ? "text" : "password"}
                  placeholder="Password"
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                />
                <FontAwesomeIcon
                  icon={passwordVisible ? faEye : faEyeSlash}
                  className="eye-icon"
                  onClick={togglePassword}
                />
              </div>
              <input type="submit" value={isSignup ? "Signup" : "Login"} />
            </form>
            <div className="group">
              <a href="#">Forgot Password?</a>
              <a
                onClick={(e) => {
                  e.preventDefault(); // Prevent navigation
                  setIsSignup(!isSignup);
                }}
                style={{ cursor: "pointer" }}
              >
                {isSignup ? "Login" : "Signup"}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoginSignup;